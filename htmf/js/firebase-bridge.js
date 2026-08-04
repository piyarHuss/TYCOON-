/*
 * STONE TYCOON Firebase Bridge (browser global, no build step)
 * - Anonymous sign-in for players
 * - Uploads localStorage save to Firestore users/{uid}
 * - Downloads admin economy config from settings/gameConfig
 * - Applies admin commands from adminCommands/{uid}
 *
 * Requires Firebase compat SDK scripts loaded first:
 * firebase-app-compat.js, firebase-auth-compat.js, firebase-firestore-compat.js
 */
(function () {
  'use strict';

  const SAVE_KEY = 'stone_tycoon_save_v1';
  const ADMIN_CONFIG_KEY = 'stone_tycoon_admin_config_v1';
  const DEVICE_KEY = 'stone_tycoon_device_id_v1';

  const cfg = window.ST_FIREBASE_CONFIG || {};
  if (!cfg.enabled || !cfg.apiKey || !window.firebase) {
    console.log('[StoneTycoon Firebase] disabled (edit js/firebase-config.js to enable)');
    return;
  }

  function deviceId() {
    try {
      let id = localStorage.getItem(DEVICE_KEY);
      if (!id) {
        id = (crypto && crypto.randomUUID) ? crypto.randomUUID() : 'dev_' + Date.now().toString(36) + Math.random().toString(36).slice(2);
        localStorage.setItem(DEVICE_KEY, id);
      }
      return id;
    } catch {
      return 'device_unknown';
    }
  }

  function readSave() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { return null; }
  }
  function writeSave(s) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(s));
      window.dispatchEvent(new CustomEvent('stone-tycoon-save-updated', { detail: s }));
      return true;
    } catch { return false; }
  }
  function cleanSave(s) {
    if (!s || typeof s !== 'object') return null;
    const out = JSON.parse(JSON.stringify(s));
    // prevent gigantic accidental payloads
    if (Array.isArray(out.withdrawals)) out.withdrawals = out.withdrawals.slice(0, 50);
    return out;
  }

  function mergePatch(target, patch) {
    if (!target || typeof target !== 'object') target = {};
    Object.keys(patch || {}).forEach((k) => {
      const v = patch[k];
      if (v && typeof v === 'object' && !Array.isArray(v)) target[k] = mergePatch(target[k] || {}, v);
      else target[k] = v;
    });
    return target;
  }

  let app, auth, db, uid, userRef, syncing = false, lastHash = '';

  async function init() {
    try {
      app = firebase.apps && firebase.apps.length ? firebase.app() : firebase.initializeApp(cfg);
      try { if (firebase.analytics && cfg.measurementId) firebase.analytics(); } catch (e) {}
      auth = firebase.auth();
      db = firebase.firestore();
      await auth.signInAnonymously();
      uid = auth.currentUser.uid;
      userRef = db.collection('users').doc(uid);
      window.ST_FIREBASE = { app, auth, db, uid, deviceId: deviceId() };
      console.log('[StoneTycoon Firebase] connected as', uid);

      await userRef.set({
        uid,
        deviceId: deviceId(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
        userAgent: navigator.userAgent,
        source: location.href,
      }, { merge: true });

      listenConfig();
      listenCommands();
      listenRemoteSave();
      startUploader();
    } catch (e) {
      console.error('[StoneTycoon Firebase] init failed:', e);
    }
  }

  function listenConfig() {
    db.collection('settings').doc('gameConfig').onSnapshot((snap) => {
      if (!snap.exists) return;
      const data = snap.data() || {};
      try {
        localStorage.setItem(ADMIN_CONFIG_KEY, JSON.stringify(data));
        window.dispatchEvent(new CustomEvent('stone-tycoon-config-updated', { detail: data }));
        console.log('[StoneTycoon Firebase] config updated', data);
      } catch (e) {
        console.warn('[StoneTycoon Firebase] config save failed', e);
      }
    });
  }

  function listenCommands() {
    db.collection('adminCommands').doc(uid).onSnapshot(async (snap) => {
      if (!snap.exists) return;
      const cmd = snap.data() || {};
      if (!cmd.type || cmd.status === 'done') return;
      const save = readSave() || {};
      if (cmd.type === 'patchSave') {
        mergePatch(save, cmd.patch || {});
        writeSave(save);
        await uploadNow('admin-command');
        await snap.ref.set({ status: 'done', appliedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        if (cmd.reload !== false) setTimeout(() => location.reload(), 500);
      }
      if (cmd.type === 'wipeSave') {
        localStorage.removeItem(SAVE_KEY);
        await uploadNow('admin-wipe');
        await snap.ref.set({ status: 'done', appliedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        setTimeout(() => location.reload(), 500);
      }
    });
  }

  function listenRemoteSave() {
    userRef.onSnapshot((snap) => {
      if (!snap.exists) return;
      const d = snap.data() || {};
      if (d.forceSave && d.forceSave.save) {
        writeSave(d.forceSave.save);
        userRef.set({ forceSave: firebase.firestore.FieldValue.delete() }, { merge: true });
        setTimeout(() => location.reload(), 500);
      }
    });
  }

  function hash(obj) {
    try { return JSON.stringify(obj); } catch { return ''; }
  }

  async function uploadNow(reason) {
    if (!userRef || syncing) return;
    const save = cleanSave(readSave());
    if (!save) return;
    const h = hash(save);
    if (h === lastHash && reason !== 'manual') return;
    syncing = true;
    try {
      lastHash = h;
      const payload = {
        uid,
        deviceId: deviceId(),
        lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
        updatedReason: reason || 'auto',
        summary: {
          coins: Number(save.coins || 0),
          gems: Number(save.gems || 0),
          cash: Number(save.cash || 0),
          level: Number(save.level || 1),
          bestLevel: Number(save.bestLevel || save.level || 1),
          adsWatched: Number(save.adsWatched || 0),
          totalBroken: Number(save.totalBroken || 0),
          withdrawals: Array.isArray(save.withdrawals) ? save.withdrawals.length : 0,
        },
        save,
      };
      await userRef.set(payload, { merge: true });

      const withdrawals = Array.isArray(save.withdrawals) ? save.withdrawals : [];
      for (const w of withdrawals.slice(0, 10)) {
        if (!w || !w.id) continue;
        await db.collection('withdrawals').doc(w.id).set({ ...w, uid, deviceId: deviceId(), updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
      }
    } catch (e) {
      console.warn('[StoneTycoon Firebase] upload failed', e);
    } finally {
      syncing = false;
    }
  }

  function startUploader() {
    uploadNow('start');
    setInterval(() => uploadNow('interval'), 8000);
    window.addEventListener('beforeunload', () => uploadNow('beforeunload'));
    window.addEventListener('pagehide', () => uploadNow('pagehide'));
    window.ST_UPLOAD_NOW = () => uploadNow('manual');
  }

  init();
})();
