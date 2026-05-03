// ================================================
//  session.js — Group Session Management
//  ThermoExplore Multiplayer System
// ================================================

const SessionManager = (() => {
  const KEY = 'thermoexplore_session_v1';

  /* ---------- Local helpers ---------- */
  function slugify(str) {
    return str.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .substring(0, 30) || 'kelompok';
  }

  function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let c = 'THERM-';
    for (let i = 0; i < 4; i++) c += chars[Math.floor(Math.random() * chars.length)];
    return c;
  }

  /* ---------- Session storage ---------- */
  function getSession() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function setSession(code, groupName, groupId) {
    localStorage.setItem(KEY, JSON.stringify({
      code: code.toUpperCase().trim(),
      groupName,
      groupId,
      joinedAt: Date.now()
    }));
  }

  function clearSession() {
    localStorage.removeItem(KEY);
  }

  /* ---------- Firebase operations ---------- */
  async function validateSession(code) {
    if (!window.FIREBASE_READY) return { valid: false, error: 'Firebase belum dikonfigurasi' };
    try {
      const snap = await window.firebaseDB
        .ref(`sessions/${code.toUpperCase()}/meta`).once('value');
      const meta = snap.val();
      if (!meta)        return { valid: false, error: 'Kode sesi tidak ditemukan' };
      if (!meta.active) return { valid: false, error: 'Sesi sudah ditutup oleh guru' };
      return { valid: true, meta };
    } catch (e) {
      return { valid: false, error: 'Gagal terhubung ke server' };
    }
  }

  async function joinSession(code, groupName) {
    const upperCode = code.toUpperCase().trim();
    const groupId   = slugify(groupName);

    if (!window.FIREBASE_READY) {
      // Offline fallback — works on single device testing
      setSession(upperCode, groupName, groupId);
      return { success: true, groupId, offline: true };
    }

    const check = await validateSession(upperCode);
    if (!check.valid) return { success: false, error: check.error };

    try {
      await window.firebaseDB.ref(`sessions/${upperCode}/groups/${groupId}`).set({
        name:      groupName,
        xp:        0,
        completion: 0,
        zones:     { zone1: false, zone2: false, zone3: false },
        finishedAt: null,
        lastUpdate: Date.now()
      });
      setSession(upperCode, groupName, groupId);
      // Game state otomatis fresh karena ThermoGame.getStateKey() pakai groupId baru
      // Tidak perlu reset manual — key localStorage = 'thermo_state_' + groupId
      return { success: true, groupId };
    } catch (e) {
      return { success: false, error: 'Gagal bergabung: ' + e.message };
    }
  }


  /* ---------- Guru / Admin operations ---------- */
  async function createSession(className, teacherName) {
    if (!window.FIREBASE_READY) return { success: false, error: 'Firebase belum dikonfigurasi' };
    const code = generateCode();
    try {
      await window.firebaseDB.ref(`sessions/${code}`).set({
        meta: { className, teacherName, createdAt: Date.now(), active: true, code },
        groups: {}
      });
      return { success: true, code };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async function closeSession(code) {
    if (!window.FIREBASE_READY) return false;
    try {
      await window.firebaseDB.ref(`sessions/${code}/meta/active`).set(false);
      return true;
    } catch (e) { return false; }
  }

  async function resetGroups(code) {
    if (!window.FIREBASE_READY) return false;
    try {
      await window.firebaseDB.ref(`sessions/${code}/groups`).remove();
      return true;
    } catch (e) { return false; }
  }

  async function syncGroupState(state) {
    const session = getSession();
    if (!session || !window.FIREBASE_READY) return;
    try {
      const zones  = state.zones || {};
      const z1done = zones.zone1?.challengesDone?.length || 0;
      const z2done = zones.zone2?.challengesDone?.length || 0;
      const z3done = zones.zone3?.challengesDone?.length || 0;

      // completion = rata-rata score dari semua zona yang sudah punya skor
      const scores = [zones.zone1?.score||0, zones.zone2?.score||0, zones.zone3?.score||0];
      const activeCnt = [z1done,z2done,z3done].filter(n=>n>0).length;
      const pct = activeCnt > 0 ? Math.round(scores.slice(0,activeCnt).reduce((a,b)=>a+b,0)/3) : 0;

      const allDone = ['zone1','zone2','zone3'].every(k => zones[k]?.completed);

      await window.firebaseDB
        .ref(`sessions/${session.code}/groups/${session.groupId}`)
        .update({
          name:       session.groupName,
          xp:         state.xp || 0,
          completion: pct,
          zones: {
            zone1: z1done > 0,   // aktif jika sudah mulai, bukan hanya completed
            zone2: z2done > 0,
            zone3: z3done > 0,
          },
          zonesCompleted: {
            zone1: zones.zone1?.completed || false,
            zone2: zones.zone2?.completed || false,
            zone3: zones.zone3?.completed || false,
          },
          challengesDone: { z1: z1done, z2: z2done, z3: z3done },
          finishedAt:  allDone ? (Date.now()) : null,
          lastUpdate:  Date.now()
        });
    } catch (e) {
      console.warn('Sync failed:', e);
    }
  }


  return {
    getSession, setSession, clearSession,
    validateSession, joinSession,
    createSession, closeSession, resetGroups,
    syncGroupState, generateCode
  };
})();

window.SessionManager = SessionManager;
