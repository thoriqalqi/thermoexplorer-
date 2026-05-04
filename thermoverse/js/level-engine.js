// ================================================
//  level-engine.js — ThermoExplorer Shared Engine
//  Handles all level logic for level1/2/3.html
// ================================================
// Requires: LEVEL_CONFIG (defined per-level), ThermoGame, SessionManager

(function(){
'use strict';

// ── State ──────────────────────────────────────
let cfg, timeRemaining, timerInterval=null, levelStarted=false;
let completedSet = new Set();
let challengeXP  = {}; // {ct:80, st:45, ...}
let userAnswers  = {}; // {ct:[1,0,...], st:[1], ...}
let xpEarned     = {}; // {ct:60, st:45, ...}
const ORDER = ['ct','st','sci','inn'];
let TOTAL_QUESTIONS = 0;

// XP mapping by indicator keyword
const XP_MAP = {
  'interpretasi':15, 'analisis':20, 'evaluasi':25, 'penjelasan':20,
  'pemahaman':20, 'analisis sistem':25, 'analisis & evaluasi':25,
  'inquiry':15, 'inquiry & hypothesis':20, 'analysis & argumentation':25, 'analysis':25,
  'flexibility':20, 'creative':30, 'identifying':20
};

function getXP(ind){
  const key = ind.toLowerCase();
  for(const k in XP_MAP){ if(key.includes(k)) return XP_MAP[k]; }
  return 15;
}

function calcMaxXP(){
  let total=0;
  ORDER.forEach(k=>{
    const ch=cfg.challenges[k];
    if(ch) ch.questions.forEach(q=>{ total+=getXP(q.ind); });
  });
  return total;
}

function speedBonus(secs){
  if(secs>12*60) return 60;
  if(secs>9*60)  return 40;
  if(secs>6*60)  return 25;
  if(secs>3*60)  return 10;
  return 0;
}

// ── Toast notification ─────────────────────────
function toast(msg, type='info'){
  const t=document.createElement('div');
  t.className='le-toast le-toast-'+type;
  t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>t.classList.add('show'),10);
  setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=>t.remove(),300); },2800);
}

// ── Intro Screen ───────────────────────────────
function showIntro(){
  const maxXP=calcMaxXP();
  const rows=ORDER.map(k=>{
    const ch=cfg.challenges[k];
    const icons={ct:'🔍',st:'🔗',sci:'🔬',inn:'💡'};
    const names={ct:'Critical Thinking',st:'Systemic Thinking',sci:'Scientific Thinking',inn:'Innovative Thinking'};
    const kxp=ch.questions.reduce((s,q)=>s+getXP(q.ind),0);
    return `<div class="le-intro-row"><span>${icons[k]} ${names[k]}</span><span class="le-xp-tag">max ${kxp} XP</span></div>`;
  }).join('');

  const overlay=document.createElement('div');
  overlay.id='le-intro';
  overlay.innerHTML=`
    <div class="le-intro-box">
      <div class="le-intro-badge">LEVEL ${cfg.levelNum}</div>
      <h2 class="le-intro-title">${cfg.title}</h2>
      <p class="le-intro-sub">${cfg.subtitle}</p>
      <div class="le-intro-meta">
        <div class="le-meta-item">⏱ <strong>30 Menit</strong><span>Waktu Pengerjaan</span></div>
        <div class="le-meta-item">⚡ <strong>${maxXP+60} XP</strong><span>Maks (+ Speed Bonus)</span></div>
        <div class="le-meta-item">📝 <strong>${TOTAL_QUESTIONS} Soal</strong><span>Total Pertanyaan</span></div>
      </div>
      <div class="le-intro-challenges">${rows}</div>
      <div class="le-speed-info">🚀 Bonus kecepatan: selesai lebih cepat = XP ekstra (max +60 XP)</div>
      <button class="le-start-btn" id="le-start-btn">▶ Mulai Sekarang</button>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('le-start-btn').onclick=startLevel;
}

// ── Start Level ────────────────────────────────
function startLevel(){
  document.getElementById('le-intro').remove();
  levelStarted=true;
  renderAllChallenges();
  updateTabLocks();
  switchTab('ct');
  startTimer();
  syncProgress();
}

// ── Timer ──────────────────────────────────────
function startTimer(){
  const disp=document.getElementById('timer-val');
  timerInterval=setInterval(()=>{
    timeRemaining--;
    const m=Math.floor(timeRemaining/60), s=timeRemaining%60;
    if(disp) disp.textContent=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
    if(timeRemaining<=60) document.getElementById('main-timer')?.classList.add('urgent');
    if(timeRemaining<=0){ 
      clearInterval(timerInterval); 
      toast('Waktu Habis! Mengumpulkan jawaban...', 'warn');
      leFinish(true); 
    }
  },1000);
}

// ── Tab switching ──────────────────────────────
function switchTab(tab){
  if(!levelStarted) return;
  if(tab!=='ct' && !completedSet.has(ORDER[ORDER.indexOf(tab)-1])){
    const prev={st:'Critical Thinking',sci:'Systemic Thinking',inn:'Scientific Thinking'};
    toast(`Selesaikan ${prev[tab]} dulu! 🔒`,'warn');
    return;
  }
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-'+tab)?.classList.add('active');
  document.querySelectorAll('.challenge-card').forEach(c=>c.style.display='none');
  document.getElementById('panel-'+tab).style.display='block';
}
window.switchTab=switchTab;

function updateTabLocks(){
  ORDER.forEach((k,i)=>{
    const btn=document.getElementById('tab-'+k);
    if(!btn) return;
    const locked=i>0 && !completedSet.has(ORDER[i-1]);
    btn.classList.toggle('locked',locked);
    btn.title=locked?`Selesaikan ${ORDER[i-1].toUpperCase()} dulu`:'';
  });
}

// ── Render challenges ──────────────────────────
function renderAllChallenges(savedAnswers = null){
  ORDER.forEach(k => renderChallenge(k, savedAnswers ? savedAnswers[k] : null));
}

function renderChallenge(key, savedAnswers = null){
  const el=document.getElementById('content-'+key);
  if(!el) return;
  const ch=cfg.challenges[key];
  const isReviewMode = savedAnswers != null;

  el.innerHTML=`
    <div class="scenario-box">
      <div class="scenario-label">📍 Skenario / Konteks Masalah</div>
      <div class="scenario-text">${ch.scenario}</div>
    </div>
    ${ch.questions.map((q,i)=>{
      const qxp=getXP(q.ind);
      let explHTML = '';
      if(isReviewMode) {
        explHTML = `<div class="le-korr-expl" style="margin-top:16px; padding:14px; background:rgba(255,255,255,0.7); border-radius:8px; font-size:0.9rem; border:1px dashed #CBD5E1; color:#334155;">
             <strong>💡 Pembahasan:</strong><br/>${q.p || 'Pembahasan terperinci akan ditambahkan oleh guru.'}
          </div>`;
      }
      return `<div class="question-block" id="${key}-q-${i}" style="margin-top:24px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <span class="indicator-label">${q.ind}</span>
          <span class="le-xp-badge">+${qxp} XP</span>
        </div>
        <div class="question-text"><strong>${i+1}. ${q.q}</strong></div>
        <div class="options-grid">
          ${q.a.map((opt,oi)=>{
            let extraClass = '';
            let isSelected = false;
            if(isReviewMode) {
               const sel = savedAnswers[i];
               if(oi === q.c) extraClass = 'correct';
               else if(oi === sel) extraClass = 'wrong';
               isSelected = (oi === sel);
            }
            return `<label class="option-btn ${extraClass} ${isSelected?'selected':''}" ${!isReviewMode ? `onclick="leSelect('${key}',${i},${oi})"` : 'style="pointer-events:none"'}>
              <input type="radio" name="${key}_q${i}" value="${oi}" style="display:none;" ${isSelected?'checked':''} ${isReviewMode?'disabled':''}>
              <div class="option-key">${String.fromCharCode(65+oi)}</div>
              <div>${opt}</div>
            </label>`;
          }).join('')}
        </div>
        ${explHTML}
      </div>`;
    }).join('')}
    ${!isReviewMode ? `<div style="margin-top:24px;display:flex;justify-content:flex-end;">
      <button class="btn btn-primary" onclick="leSubmit('${key}')">✅ Simpan &amp; Lanjut</button>
    </div>` : ''}`;
}

// ── Select option ──────────────────────────────
window.leSelect=function(key,qi,oi){
  const block=document.getElementById(`${key}-q-${qi}`);
  block.querySelectorAll('.option-btn').forEach(b=>b.classList.remove('selected'));
  block.querySelectorAll('.option-btn')[oi].classList.add('selected');
};

// ── Submit challenge ───────────────────────────
window.leSubmit=function(key){
  const ch=cfg.challenges[key];
  const answered=document.querySelectorAll(`#panel-${key} input[type="radio"]:checked`);
  if(answered.length<ch.questions.length){
    toast('Jawab semua soal dulu! 📝','warn'); return;
  }

  let xp=0;
  userAnswers[key]=[];
  ch.questions.forEach((q,i)=>{
    const sel=parseInt(document.querySelector(`input[name="${key}_q${i}"]:checked`).value);
    userAnswers[key].push(sel);
    if(sel===q.c) xp+=getXP(q.ind);
    // Show correct/wrong
    const block=document.getElementById(`${key}-q-${i}`);
    block.querySelectorAll('.option-btn').forEach((btn,bi)=>{
      btn.style.pointerEvents='none';
      if(bi===q.c)   btn.classList.add('correct');
      else if(bi===sel) btn.classList.add('wrong');
    });
  });

  xpEarned[key]=xp;
  challengeXP[key]=xp;
  completedSet.add(key);
  document.getElementById('tab-'+key)?.classList.add('done');

  // Update running XP in header
  const runXP=Object.values(xpEarned).reduce((a,b)=>a+b,0);
  const el=document.getElementById('current-xp');
  if(el) el.textContent=runXP;
  ThermoGame.showXPFloat(xp);

  updateTabLocks();
  syncProgress();

  const idx=ORDER.indexOf(key);
  if(idx<ORDER.length-1){
    toast(`✅ Selesai! +${xp} XP. Lanjut ke tantangan berikutnya!`,'ok');
    setTimeout(()=>switchTab(ORDER[idx+1]),600);
  } else {
    document.getElementById('finish-level-container').style.display='flex';
    toast('🎉 Semua tantangan selesai! Klik Selesaikan Level.','ok');
  }
};

// ── Finish Level ───────────────────────────────
window.leFinish=function(isTimeout=false){
  if(!isTimeout && completedSet.size<4){ toast('Selesaikan semua tantangan dulu!','warn'); return; }
  
  if(isTimeout) {
    ORDER.forEach(key => {
      if(!completedSet.has(key)) {
        const ch = cfg.challenges[key];
        let xp = 0;
        userAnswers[key] = [];
        ch.questions.forEach((q, i) => {
          const selNode = document.querySelector(`input[name="${key}_q${i}"]:checked`);
          const sel = selNode ? parseInt(selNode.value) : -1;
          userAnswers[key].push(sel);
          if(sel === q.c) xp += getXP(q.ind);
        });
        xpEarned[key] = xp;
        completedSet.add(key);
      }
    });
  }

  clearInterval(timerInterval);
  const elapsed=cfg.timeSeconds - Math.max(0, timeRemaining);
  const bonus=speedBonus(timeRemaining);
  const totalXP=Object.values(xpEarned).reduce((a,b)=>a+b,0)+bonus;

  // Save to game state
  const state=ThermoGame.loadState();
  const allDone=completedSet.size===4;
  const pct=Math.round(totalXP/((calcMaxXP()+60))*100);
  state.zones[cfg.zone]={
    completed:allDone, score:pct,
    xpEarned:totalXP, speedBonus:bonus,
    timeTaken:elapsed,
    challengesDone:Array.from(completedSet),
    answers:userAnswers
  };
  ThermoGame.addXP(state,totalXP);
  ThermoGame.saveState(state);
  if(window.SessionManager) SessionManager.syncGroupState(state);

  showResult(elapsed, bonus, totalXP, pct);
};

// ── Result / Koreksi Screen ────────────────────
function showResult(elapsed, bonus, totalXP, pct){
  const headerRight = document.querySelector('.level-header-right');
  if(headerRight) headerRight.style.display = 'none';

  let correctAll=0, wrongAll=0, baseXP=0;
  ORDER.forEach(k=>{
    const ch=cfg.challenges[k];
    (userAnswers[k]||[]).forEach((sel,i)=>{
      if(sel===ch.questions[i].c) {
        correctAll++;
        baseXP += getXP(ch.questions[i].ind);
      } else {
        wrongAll++;
      }
    });
  });

  const em=String(Math.floor(elapsed/60)).padStart(2,'0')+':'+String(elapsed%60).padStart(2,'0');

  const banner = document.createElement('div');
  banner.innerHTML = `
    <div style="background:var(--bg-card); border-radius:16px; padding:32px; box-shadow:0 8px 30px rgba(12, 55, 83, 0.15); margin-bottom:24px; text-align:center; border:1px solid var(--border);">
      <div style="font-size:3.5rem;margin-bottom:12px">${pct>=80?'🏆':pct>=60?'⭐':'📝'}</div>
      <h2 style="font-family:var(--font-heading);font-size:1.8rem;color:var(--text);margin-bottom:20px;">Level ${cfg.levelNum} Selesai!</h2>
      <div class="le-stats-grid" style="max-width:700px; margin:0 auto 20px;">
        <div class="le-stat-box ok"><div class="le-stat-val">✅ ${correctAll}</div><div class="le-stat-lbl">Benar (⚡${baseXP})</div></div>
        <div class="le-stat-box err"><div class="le-stat-val">❌ ${wrongAll}</div><div class="le-stat-lbl">Salah</div></div>
        <div class="le-stat-box"><div class="le-stat-val">⏱ ${em}</div><div class="le-stat-lbl">Bonus ⚡${bonus}</div></div>
        <div class="le-stat-box xp"><div class="le-stat-val">⚡ ${totalXP}</div><div class="le-stat-lbl">Total XP Akhir</div></div>
      </div>
      <p style="color:var(--muted); font-size:0.95rem; margin-bottom:24px;">Silakan lihat pembahasan jawaban Anda di bawah ini.</p>
      <a href="map.html" class="btn btn-primary" style="padding:12px 36px;font-size:1.05rem;">🗺️ Kembali ke Peta</a>
    </div>
  `;
  document.querySelector('.level-header').insertAdjacentElement('afterend', banner);
  
  // Render review mode
  renderAllChallenges(userAnswers);
  ORDER.forEach(k => completedSet.add(k));
  updateTabLocks(true);
  switchTab('ct');
}

// ── Progress sync to Firebase ──────────────────
function syncProgress(){
  const state=ThermoGame.loadState();
  const answered=Object.values(userAnswers).reduce((s,a)=>s+a.length,0);
  const pct=Math.round((answered/TOTAL_QUESTIONS)*100);
  const runXP=Object.values(xpEarned).reduce((a,b)=>a+b,0);

  const zones=state.zones||{};
  const zoneData=zones[cfg.zone]||{};
  zoneData.challengesDone=Array.from(completedSet);
  zoneData.xpEarned=runXP;
  zones[cfg.zone]=zoneData;

  // Patch state for sync
  const patch={...state, xp:(state.xp||0)};
  patch.zones=zones;
  if(window.SessionManager){
    const sess=SessionManager.getSession();
    if(sess && window.FIREBASE_READY){
      const z1=cfg.zone==='zone1',z2=cfg.zone==='zone2',z3=cfg.zone==='zone3';
      window.firebaseDB.ref(`sessions/${sess.code}/groups/${sess.groupId}`).update({
        name: sess.groupName,
        xp: patch.xp,
        completion: pct,
        [`zones/${cfg.zone}`]: completedSet.size>0,
        lastUpdate: Date.now()
      }).catch(()=>{});
    }
  }
}

// ── Init ───────────────────────────────────────
document.addEventListener('DOMContentLoaded',()=>{
  cfg=window.LEVEL_CONFIG;
  timeRemaining=cfg.timeSeconds||30*60;
  
  // Hitung dinamis total soal
  TOTAL_QUESTIONS = 0;
  ORDER.forEach(k => {
    if(cfg.challenges[k] && cfg.challenges[k].questions) {
      TOTAL_QUESTIONS += cfg.challenges[k].questions.length;
    }
  });

  // Hide challenge panels initially
  document.querySelectorAll('.challenge-card').forEach(c=>c.style.display='none');
  // Hide tab-quiz permanently
  document.getElementById('tab-quiz')?.style.setProperty('display','none','important');
  document.getElementById('panel-quiz')?.style.setProperty('display','none','important');

  setTimeout(()=>document.getElementById('loading-screen')?.classList.add('hidden'),1000);

  // Nav XP
  const state=ThermoGame.loadState();
  const sess=window.SessionManager&&SessionManager.getSession();
  const label=(sess&&sess.groupName)||state.playerName||'';
  const navEl=document.getElementById('nav-xp-value');
  if(navEl) navEl.textContent=(label?label+' | ':'')+state.xp+' XP';
  const cxp=document.getElementById('current-xp');
  if(cxp) cxp.textContent=state.xp;

  // ── Cek apakah level ini sudah selesai → tampilkan completed screen ──
  const zoneData=state.zones&&state.zones[cfg.zone];
  if(zoneData&&zoneData.completed){
    showAlreadyCompleted(zoneData);
    return; // jangan tampilkan intro
  }

  // Show intro
  showIntro();
});


// ── Already Completed Screen ───────────────────
function showAlreadyCompleted(zoneData){
  const headerRight = document.querySelector('.level-header-right');
  if(headerRight) headerRight.style.display = 'none';

  let correctAll=0, wrongAll=0, baseXP=0;
  const ans = zoneData.answers || {};
  ORDER.forEach(k=>{
    const ch=cfg.challenges[k];
    if(ans[k]){
      ans[k].forEach((sel,i)=>{
        if(sel===ch.questions[i].c) {
          correctAll++;
          baseXP += getXP(ch.questions[i].ind);
        } else {
          wrongAll++;
        }
      });
    }
  });

  const totalXP=zoneData.xpEarned||0;
  const bonus=zoneData.speedBonus||0;
  const score=zoneData.score||0;
  
  let em = "30:00";
  if (zoneData.timeTaken !== undefined) {
    em = String(Math.floor(zoneData.timeTaken/60)).padStart(2,'0')+':'+String(zoneData.timeTaken%60).padStart(2,'0');
  } else {
    // Estimasi untuk data lama
    if(bonus >= 60) em = "< 06:00";
    else if(bonus >= 40) em = "< 09:00";
    else if(bonus >= 25) em = "< 12:00";
    else if(bonus >= 10) em = "< 15:00";
  }
  
  const reviewBanner = document.createElement('div');
  reviewBanner.innerHTML = `
    <div style="background:var(--bg-card); border-radius:16px; padding:32px; box-shadow:0 8px 30px rgba(0,0,0,0.5); margin-bottom:24px; text-align:center; border:1px solid var(--border);">
      <div style="font-size:3.5rem;margin-bottom:12px">${score>=80?'🏆':score>=60?'⭐':'📝'}</div>
      <h2 style="font-family:var(--font-heading);font-size:1.8rem;color:var(--text);margin-bottom:20px;">✅ Level ${cfg.levelNum} Sudah Selesai</h2>
      <div class="le-stats-grid" style="max-width:700px; margin:0 auto 20px;">
        <div class="le-stat-box ok"><div class="le-stat-val">✅ ${correctAll}</div><div class="le-stat-lbl">Benar (⚡${baseXP})</div></div>
        <div class="le-stat-box err"><div class="le-stat-val">❌ ${wrongAll}</div><div class="le-stat-lbl">Salah</div></div>
        <div class="le-stat-box"><div class="le-stat-val">⏱ ${em}</div><div class="le-stat-lbl">Bonus ⚡${bonus}</div></div>
        <div class="le-stat-box xp"><div class="le-stat-val">⚡ ${totalXP}</div><div class="le-stat-lbl">Total XP Akhir</div></div>
      </div>
      <p style="color:var(--muted); font-size:0.95rem; margin-bottom:24px;">Kamu berada di mode Review Jawaban & Pembahasan.</p>
      <a href="map.html" class="btn btn-primary" style="padding:12px 36px;font-size:1.05rem;">🗺️ Kembali ke Peta</a>
    </div>
  `;
  document.querySelector('.level-header').insertAdjacentElement('afterend', reviewBanner);

  // Render review mode
  levelStarted = true;
  ORDER.forEach(k => completedSet.add(k));
  renderAllChallenges(ans);
  updateTabLocks();
  switchTab('ct');
}


const style=document.createElement('style');
style.textContent=`
/* ── Toast ── */
.le-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);background:#1E293B;color:#fff;padding:10px 22px;border-radius:10px;font-size:.9rem;font-weight:600;z-index:9999;opacity:0;transition:all .3s;white-space:nowrap}
.le-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
.le-toast-warn{background:#92400E}
.le-toast-ok{background:#065F46}

/* ── XP Badge ── */
.le-xp-badge{display:inline-block;background:linear-gradient(135deg,var(--secondary),var(--primary));color:#fff;font-size:.72rem;font-weight:700;padding:3px 10px;border-radius:999px}

/* ── Tab Locked ── */
.tab-btn.locked{opacity:.45;cursor:not-allowed;filter:grayscale(.6)}
.tab-btn.done{position:relative}
.tab-btn.done::after{content:'✓';margin-left:6px;color:#10B981;font-weight:900}

/* ── Intro Overlay ── */
#le-intro{position:fixed;inset:0;background:rgba(12, 55, 83, 0.85);z-index:8000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(6px)}
.le-intro-box{background:var(--bg-card);border:1px solid var(--border);border-radius:24px;padding:44px 40px;max-width:520px;width:100%;box-shadow:0 24px 64px rgba(12, 55, 83, 0.2);animation:leIn .35s ease}
@keyframes leIn{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
.le-intro-badge{display:inline-block;background:var(--primary);color:#fff;font-size:.78rem;font-weight:700;padding:4px 14px;border-radius:999px;margin-bottom:14px}
.le-intro-title{font-family:var(--font-heading);font-size:1.7rem;color:var(--text);margin-bottom:6px}
.le-intro-sub{color:var(--muted);font-size:.95rem;margin-bottom:20px}
.le-intro-meta{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px}
.le-meta-item{background:var(--bg-surface);border:1px solid var(--border);border-radius:12px;padding:12px;text-align:center}
.le-meta-item strong{display:block;font-family:var(--font-heading);font-size:1.1rem;color:var(--text)}
.le-meta-item span{font-size:.74rem;color:var(--muted)}
.le-intro-challenges{display:flex;flex-direction:column;gap:8px;margin-bottom:16px}
.le-intro-row{display:flex;justify-content:space-between;align-items:center;background:var(--bg);border-radius:8px;padding:8px 14px;font-size:.88rem;font-weight:600;color:var(--text); border:1px solid var(--border);}
.le-xp-tag{background:var(--surface);color:var(--primary);border:1px solid var(--border);font-size:.75rem;padding:2px 10px;border-radius:6px;font-weight:700}
.le-intro-btn{width:100%;justify-content:center;padding:14px;font-size:1.1rem;margin-top:10px}
.le-start-btn{width:100%;padding:14px;background:var(--primary);color:#fff;border:none;border-radius:12px;font-family:var(--font-heading);font-size:1.1rem;font-weight:700;cursor:pointer;transition:all .2s;box-shadow:0 4px 16px rgba(12, 55, 83, 0.2)}
.le-start-btn:hover{background:var(--primary-light);transform:translateY(-2px)}

/* ── Result Screen ── */
.le-result-wrap{max-width:680px;margin:0 auto;text-align:center;padding:20px 0 40px}
.le-res-title{font-family:var(--font-heading);font-size:2rem;color:var(--text);margin-bottom:20px}
.le-stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
.le-stat-box{background:var(--bg-surface);border:1px solid var(--border);border-radius:14px;padding:16px 8px}
.le-stat-box.ok{background:rgba(34,197,94,.1);border-color:rgba(34,197,94,.4)}
.le-stat-box.err{background:rgba(239,68,68,.1);border-color:rgba(239,68,68,.4)}
.le-stat-box.xp{background:rgba(255,223,122,.2);border-color:rgba(255,223,122,.6)}
.le-stat-val{font-family:var(--font-heading);font-size:1.3rem;color:var(--text);margin-bottom:4px}
.le-stat-lbl{font-size:.74rem;color:var(--muted);font-weight:600;text-transform:uppercase}
.le-detail-card{background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:20px;margin-bottom:20px;text-align:left}
.le-detail-title{font-weight:700;color:var(--text);margin-bottom:12px;font-size:.9rem}
.le-res-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);font-size:.88rem;color:var(--muted)}
.le-res-row:last-child{border-bottom:none}
.bonus-row{color:var(--primary);font-weight:600}
.total-row{color:var(--text);font-weight:700;font-size:1rem;border-top:2px solid var(--border);margin-top:4px;padding-top:10px}

/* ── Koreksi ── */
.le-korr-wrap{border:1px solid var(--border);border-radius:14px;overflow:hidden;text-align:left;margin-bottom:16px}
.le-korr-header{padding:14px 20px;background:var(--bg-surface);font-weight:700;color:var(--text);cursor:pointer;user-select:none}
.le-korr-body{max-height:0;overflow:hidden;transition:max-height .4s ease}
.le-korr-body.open{max-height:2000px}
.le-korr-section{padding:16px 20px;border-top:1px solid var(--border)}
.le-korr-title{font-weight:700;color:var(--text);margin-bottom:10px;font-size:.9rem}
.le-korr-item{padding:10px 12px;border-radius:8px;margin-bottom:8px}
.k-correct{background:rgba(34,197,94,.1);border-left:3px solid #10B981}
.k-wrong{background:rgba(239,68,68,.1);border-left:3px solid #EF4444}
.le-korr-q{font-size:.85rem;color:var(--text);margin-bottom:6px}
.le-korr-ans{font-size:.82rem;display:flex;flex-direction:column;gap:2px}
.k-ok{color:#10B981}
.k-err{color:#EF4444}
.k-key{color:#10B981}
@media(max-width:600px){.le-stats-grid{grid-template-columns:repeat(2,1fr)}.le-intro-meta{grid-template-columns:1fr 1fr}}
`;
document.head.appendChild(style);
})();
