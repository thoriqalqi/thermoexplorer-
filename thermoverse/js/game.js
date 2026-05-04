// ====================================================
//  THERMOEXPLORER — Game State Manager
//  Centralized localStorage state management
// ====================================================

const ThermoGame = (() => {
  // Key is per-session-group sehingga tiap kelompok punya state sendiri
  function getStateKey() {
    const sess = window.SessionManager && SessionManager.getSession();
    if (sess && sess.groupId) return 'thermo_state_' + sess.groupId;
    return 'thermoexplorer_state_v2'; // fallback tanpa sesi
  }

  const DEFAULT_STATE = {
    playerName: '',
    xp: 0,
    badges: {},
    zones: {
      zone1: { completed: false, score: 0, scores: {}, challengesDone: [], answers: {} },
      zone2: { completed: false, score: 0, scores: {}, challengesDone: [], answers: {} },
      zone3: { completed: false, score: 0, scores: {}, challengesDone: [], answers: {} },
    }
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(getStateKey());
      if (!raw) return JSON.parse(JSON.stringify(DEFAULT_STATE));
      const parsed = JSON.parse(raw);
      if (!parsed.zones) parsed.zones = JSON.parse(JSON.stringify(DEFAULT_STATE.zones));
      ['zone1','zone2','zone3'].forEach(k => {
        if (!parsed.zones[k]) parsed.zones[k] = JSON.parse(JSON.stringify(DEFAULT_STATE.zones[k]));
        if (!parsed.zones[k].scores) parsed.zones[k].scores = {};
        if (!parsed.zones[k].challengesDone) parsed.zones[k].challengesDone = [];
        if (!parsed.zones[k].answers) parsed.zones[k].answers = {};
      });
      return parsed;
    } catch (e) {
      console.error('Error loading state:', e);
      return JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(getStateKey(), JSON.stringify(state));
      return true;
    } catch (e) {
      console.warn('Cannot save state:', e);
      return false;
    }
  }

  function setPlayerName(name) {
    const state = loadState();
    state.playerName = name.trim();
    saveState(state);
    return state;
  }

  function getPlayerName() {
    const state = loadState();
    return state.playerName || '';
  }

  function isZoneUnlocked(state, zoneKey) {
    if (zoneKey === 'zone1') return true;
    if (zoneKey === 'zone2') return state.zones.zone1.completed || (state.zones.zone1.score >= 60);
    if (zoneKey === 'zone3') return state.zones.zone2.completed || (state.zones.zone2.score >= 60);
    return false;
  }

  function addXP(state, amount) {
    state.xp = (state.xp || 0) + amount;
    return state;
  }

  function saveZoneChallenge(state, zoneKey, challengeKey, scores, answers = {}) {
    if (!state.zones[zoneKey]) state.zones[zoneKey] = JSON.parse(JSON.stringify(DEFAULT_STATE.zones[zoneKey]));
    state.zones[zoneKey].scores[challengeKey] = scores;
    state.zones[zoneKey].answers[challengeKey] = answers;
    
    if (!state.zones[zoneKey].challengesDone.includes(challengeKey)) {
      state.zones[zoneKey].challengesDone.push(challengeKey);
    }
    
    // Calculate zone score from all challenges
    const allScores = Object.values(state.zones[zoneKey].scores);
    if (allScores.length > 0) {
      const avg = allScores.reduce((a, b) => {
        const bVal = typeof b === 'object' ? Object.values(b).reduce((x, y) => x + y, 0) / Object.values(b).length : b;
        return a + bVal;
      }, 0) / allScores.length;
      state.zones[zoneKey].score = Math.round(avg);
    }
    
    if (state.zones[zoneKey].challengesDone.length >= 4) { // 4 challenges (CT,ST,SCI,INN)
      state.zones[zoneKey].completed = true;
    }
    
    saveState(state);
    // Sync ke Firebase setiap kali ada jawaban baru
    syncToSession(state);
    return state;
  }

  function getZoneProgress(zoneKey) {
    const state = loadState();
    return state.zones[zoneKey] || {};
  }

  function resetState() {
    localStorage.removeItem(getStateKey());
  }


  /* ---- Completion & Category ---- */
  function getCompletionPct(state) {
    const zoneList = Object.values(state.zones || {});
    if (!zoneList.length) return 0;
    const avg = zoneList.reduce((sum, z) => sum + (z.score || 0), 0) / zoneList.length;
    return Math.round(avg);
  }

  function getFinalCategory(pct) {
    if (pct >= 85) return { label: 'Termofisikawan Unggul', color: '#0c3753', emoji: '🔥' };
    if (pct >= 70) return { label: 'Penjelajah Termal',     color: '#165682', emoji: '⚡' };
    if (pct >= 50) return { label: 'Peneliti Pemula',       color: '#ffaa00', emoji: '🌡️' };
    return { label: 'Kadet Termo', color: '#888', emoji: '🧪' };
  }

  /* ---- Mark zone complete (called by quiz.js) ---- */
  function markZoneComplete(state, zoneKey, pct, totalXP, thinkingScores) {
    if (!state.zones[zoneKey]) {
      state.zones[zoneKey] = JSON.parse(JSON.stringify(DEFAULT_STATE.zones.zone1));
    }
    state.zones[zoneKey].score     = pct;
    state.zones[zoneKey].completed = pct >= 70;
    state = addXP(state, totalXP);

    if (!state.thinking) state.thinking = {};
    Object.keys(thinkingScores || {}).forEach(k => {
      state.thinking[k] = Math.max(state.thinking[k] || 0, thinkingScores[k] || 0);
    });

    saveState(state);
    syncToSession(state);
    return state;
  }

  /* ---- Firebase sync ---- */
  function syncToSession(state) {
    if (window.SessionManager) {
      SessionManager.syncGroupState(state).catch(() => {});
    }
  }

  /* ---- XP Float animation ---- */
  function showXPFloat(amount) {
    const el = document.createElement('div');
    el.textContent = `+${amount} XP`;
    Object.assign(el.style, {
      position: 'fixed', top: '80px', right: '24px',
      background: 'linear-gradient(135deg,#0c3753,#165682)',
      color: '#fff', fontWeight: '700', fontSize: '1.1rem',
      padding: '8px 18px', borderRadius: '999px',
      boxShadow: '0 4px 20px rgba(255,100,0,.5)',
      zIndex: 9999, pointerEvents: 'none',
      animation: 'xpFloat 1.4s ease forwards'
    });
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1500);

    if (!document.getElementById('xp-float-style')) {
      const s = document.createElement('style');
      s.id = 'xp-float-style';
      s.textContent = '@keyframes xpFloat{0%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-60px)}}';
      document.head.appendChild(s);
    }
  }

  /* ---- Nav XP refresh ---- */
  function updateNavXP() {
    const st = loadState();
    document.querySelectorAll('#nav-xp, .nav-xp').forEach(el => {
      el.textContent = `${st.xp || 0} XP`;
    });
  }

  return {
    loadState,
    saveState,
    setPlayerName,
    getPlayerName,
    isZoneUnlocked,
    addXP,
    saveZoneChallenge,
    getZoneProgress,
    resetState,
    getCompletionPct,
    getFinalCategory,
    markZoneComplete,
    syncToSession,
    showXPFloat,
    updateNavXP
  };
})();
