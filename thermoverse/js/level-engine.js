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
const TOTAL_QUESTIONS = 10; // CT:4 ST:2 SCI:2 INN:2

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
        <div class="le-meta-item">⏱ <strong>18 Menit</strong><span>Waktu Pengerjaan</span></div>
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
    if(timeRemaining<=0){ clearInterval(timerInterval); finishLevel(); }
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
function renderAllChallenges(){
  ORDER.forEach(renderChallenge);
}

function renderChallenge(key){
  const el=document.getElementById('content-'+key);
  if(!el) return;
  const ch=cfg.challenges[key];
  el.innerHTML=`
    <div class="scenario-box">
      <div class="scenario-label">📍 Skenario / Konteks Masalah</div>
      <div class="scenario-text">${ch.scenario}</div>
    </div>
    ${ch.questions.map((q,i)=>{
      const qxp=getXP(q.ind);
      return `<div class="question-block" id="${key}-q-${i}" style="margin-top:24px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <span class="indicator-label">${q.ind}</span>
          <span class="le-xp-badge">+${qxp} XP</span>
        </div>
        <div class="question-text"><strong>${i+1}. ${q.q}</strong></div>
        <div class="options-grid">
          ${q.a.map((opt,oi)=>`
            <label class="option-btn" onclick="leSelect('${key}',${i},${oi})">
              <input type="radio" name="${key}_q${i}" value="${oi}" style="display:none;">
              <div class="option-key">${String.fromCharCode(65+oi)}</div>
              <div>${opt}</div>
            </label>`).join('')}
        </div>
      </div>`;
    }).join('')}
    <div style="margin-top:24px;display:flex;justify-content:flex-end;">
      <button class="btn btn-primary" onclick="leSubmit('${key}')">✅ Simpan &amp; Lanjut</button>
    </div>`;
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
window.leFinish=function(){
  if(completedSet.size<4){ toast('Selesaikan semua tantangan dulu!','warn'); return; }
  clearInterval(timerInterval);
  const elapsed=cfg.timeSeconds - timeRemaining;
  const bonus=speedBonus(timeRemaining);
  const totalXP=Object.values(xpEarned).reduce((a,b)=>a+b,0)+bonus;

  // Save to game state
  const state=ThermoGame.loadState();
  const allDone=completedSet.size===4;
  const pct=Math.round(totalXP/((calcMaxXP()+60))*100);
  state.zones[cfg.zone]={
    completed:allDone, score:pct,
    xpEarned:totalXP, speedBonus:bonus,
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
  document.querySelectorAll('.challenge-card').forEach(c=>c.style.display='none');
  document.querySelectorAll('.challenge-tabs').forEach(t=>t.style.display='none');

  let correctAll=0, wrongAll=0;
  ORDER.forEach(k=>{
    const ch=cfg.challenges[k];
    (userAnswers[k]||[]).forEach((sel,i)=>{
      if(sel===ch.questions[i].c) correctAll++; else wrongAll++;
    });
  });

  const em=String(Math.floor(elapsed/60)).padStart(2,'0')+':'+String(elapsed%60).padStart(2,'0');
  const chIcons={ct:'🔍',st:'🔗',sci:'🔬',inn:'💡'};
  const chNames={ct:'Critical Thinking',st:'Systemic Thinking',sci:'Scientific Thinking',inn:'Innovative Thinking'};

  const detailRows=ORDER.map(k=>{
    const ch=cfg.challenges[k];
    const xp=xpEarned[k]||0;
    const maxXP=ch.questions.reduce((s,q)=>s+getXP(q.ind),0);
    return `<div class="le-res-row">
      <span>${chIcons[k]} ${chNames[k]}</span>
      <span>⚡ ${xp}/${maxXP} XP</span>
    </div>`;
  }).join('');

  // Koreksi per soal
  const koreksi=ORDER.map(k=>{
    const ch=cfg.challenges[k];
    return `<div class="le-korr-section">
      <div class="le-korr-title">${chIcons[k]} ${chNames[k]}</div>
      ${ch.questions.map((q,i)=>{
        const sel=userAnswers[k]?.[i];
        const benar=sel===q.c;
        return `<div class="le-korr-item ${benar?'k-correct':'k-wrong'}">
          <div class="le-korr-q"><strong>S${i+1}.</strong> ${q.q}</div>
          <div class="le-korr-ans">
            ${benar
              ? `<span class="k-ok">✅ Jawaban kamu: <strong>${String.fromCharCode(65+(sel||0))}. ${q.a[sel||0]}</strong></span>`
              : `<span class="k-err">❌ Jawaban kamu: <strong>${sel!=null?String.fromCharCode(65+sel)+'. '+q.a[sel]:'—'}</strong></span>
                 <span class="k-key">✅ Kunci: <strong>${String.fromCharCode(65+q.c)}. ${q.a[q.c]}</strong></span>`
            }
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }).join('');

  const rs=document.getElementById('result-screen');
  rs.style.display='block';
  rs.innerHTML=`
    <div class="le-result-wrap">
      <div style="font-size:4rem;margin-bottom:12px">${pct>=80?'🏆':pct>=60?'⭐':'📝'}</div>
      <h2 class="le-res-title">Level ${cfg.levelNum} Selesai!</h2>

      <div class="le-stats-grid">
        <div class="le-stat-box"><div class="le-stat-val">⏱ ${em}</div><div class="le-stat-lbl">Waktu Tempuh</div></div>
        <div class="le-stat-box ok"><div class="le-stat-val">✅ ${correctAll}</div><div class="le-stat-lbl">Benar</div></div>
        <div class="le-stat-box err"><div class="le-stat-val">❌ ${wrongAll}</div><div class="le-stat-lbl">Salah</div></div>
        <div class="le-stat-box xp"><div class="le-stat-val">⚡ ${totalXP}</div><div class="le-stat-lbl">Total XP</div></div>
      </div>

      <div class="le-detail-card">
        <div class="le-detail-title">📊 Rincian XP per Tantangan</div>
        ${detailRows}
        <div class="le-res-row bonus-row">
          <span>🚀 Bonus Kecepatan (sisa ${String(Math.floor(timeRemaining/60)).padStart(2,'0')}:${String(timeRemaining%60).padStart(2,'0')})</span>
          <span>⚡ +${bonus} XP</span>
        </div>
        <div class="le-res-row total-row">
          <span>🏅 TOTAL</span>
          <span>⚡ ${totalXP} XP</span>
        </div>
      </div>

      <div class="le-korr-wrap">
        <div class="le-korr-header" onclick="this.nextElementSibling.classList.toggle('open')">
          📋 Lihat Koreksi Jawaban ▾
        </div>
        <div class="le-korr-body">${koreksi}</div>
      </div>

      <a href="map.html" class="btn btn-primary" style="margin-top:28px;padding:14px 48px;font-size:1.1rem;">🗺️ Kembali ke Peta</a>
    </div>`;
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
  timeRemaining=cfg.timeSeconds||18*60;

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
  // Tampilkan tab CT saja (disabled, read-only)
  document.querySelectorAll('.challenge-card').forEach(c=>c.style.display='none');
  document.querySelectorAll('.challenge-tabs').forEach(t=>t.style.display='none');

  const rs=document.getElementById('result-screen');
  if(!rs) return;
  rs.style.display='block';

  const xp=zoneData.xpEarned||0;
  const bonus=zoneData.speedBonus||0;
  const done=Array.isArray(zoneData.challengesDone)?zoneData.challengesDone.length:4;

  rs.innerHTML=`
    <div class="le-result-wrap">
      <div style="font-size:4rem;margin-bottom:12px">🔒</div>
      <h2 class="le-res-title">Level ${cfg.levelNum} Sudah Selesai</h2>
      <p style="color:#64748B;margin-bottom:24px;font-size:.95rem">
        Kamu sudah menyelesaikan level ini. XP tidak dapat ditambah lagi untuk mencegah kecurangan.
      </p>
      <div class="le-stats-grid">
        <div class="le-stat-box ok"><div class="le-stat-val">✅ ${done}/4</div><div class="le-stat-lbl">Challenge Selesai</div></div>
        <div class="le-stat-box xp"><div class="le-stat-val">⚡ ${xp+bonus}</div><div class="le-stat-lbl">XP Didapat</div></div>
      </div>
      <div class="le-detail-card" style="margin-bottom:24px;">
        <div class="le-detail-title">ℹ️ Informasi</div>
        <p style="font-size:.87rem;color:#64748B;line-height:1.6;margin:0">
          Untuk mengerjakan ulang level ini, minta guru untuk me-reset sesi atau daftarkan kelompok baru dengan kode akses baru.
        </p>
      </div>
      <a href="map.html" class="btn btn-primary" style="padding:14px 48px;font-size:1.1rem;">🗺️ Kembali ke Peta</a>
    </div>`;
}


const style=document.createElement('style');
style.textContent=`
/* ── Toast ── */
.le-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);background:#1E293B;color:#fff;padding:10px 22px;border-radius:10px;font-size:.9rem;font-weight:600;z-index:9999;opacity:0;transition:all .3s;white-space:nowrap}
.le-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
.le-toast-warn{background:#92400E}
.le-toast-ok{background:#065F46}

/* ── XP Badge ── */
.le-xp-badge{display:inline-block;background:linear-gradient(135deg,#7C3AED,#EC4899);color:#fff;font-size:.72rem;font-weight:700;padding:3px 10px;border-radius:999px}

/* ── Tab Locked ── */
.tab-btn.locked{opacity:.45;cursor:not-allowed;filter:grayscale(.6)}
.tab-btn.done{position:relative}
.tab-btn.done::after{content:'✓';margin-left:6px;color:#10B981;font-weight:900}

/* ── Intro Overlay ── */
#le-intro{position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:8000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(6px)}
.le-intro-box{background:#fff;border-radius:24px;padding:44px 40px;max-width:520px;width:100%;box-shadow:0 24px 64px rgba(0,0,0,.2);animation:leIn .35s ease}
@keyframes leIn{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
.le-intro-badge{display:inline-block;background:var(--primary);color:#fff;font-size:.78rem;font-weight:700;padding:4px 14px;border-radius:999px;margin-bottom:14px}
.le-intro-title{font-family:var(--font-heading);font-size:1.7rem;color:#0F172A;margin-bottom:6px}
.le-intro-sub{color:#64748B;font-size:.95rem;margin-bottom:20px}
.le-intro-meta{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px}
.le-meta-item{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:12px;text-align:center}
.le-meta-item strong{display:block;font-family:var(--font-heading);font-size:1.1rem;color:#0F172A}
.le-meta-item span{font-size:.74rem;color:#64748B}
.le-intro-challenges{display:flex;flex-direction:column;gap:8px;margin-bottom:16px}
.le-intro-row{display:flex;justify-content:space-between;align-items:center;background:#F1F5F9;border-radius:8px;padding:8px 14px;font-size:.88rem;font-weight:600;color:#334155}
.le-xp-tag{background:#EDE9FE;color:#6D28D9;font-size:.75rem;padding:2px 10px;border-radius:6px;font-weight:700}
.le-speed-info{font-size:.78rem;color:#94A3B8;text-align:center;margin-bottom:20px}
.le-start-btn{width:100%;padding:14px;background:var(--primary);color:#fff;border:none;border-radius:12px;font-family:var(--font-heading);font-size:1.1rem;font-weight:700;cursor:pointer;transition:all .2s;box-shadow:0 4px 16px rgba(124,58,237,.3)}
.le-start-btn:hover{background:#6D28D9;transform:translateY(-2px)}

/* ── Result Screen ── */
.le-result-wrap{max-width:680px;margin:0 auto;text-align:center;padding:20px 0 40px}
.le-res-title{font-family:var(--font-heading);font-size:2rem;color:#0F172A;margin-bottom:20px}
.le-stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
.le-stat-box{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:14px;padding:16px 8px}
.le-stat-box.ok{background:#F0FDF4;border-color:#86EFAC}
.le-stat-box.err{background:#FEF2F2;border-color:#FECACA}
.le-stat-box.xp{background:#F5F3FF;border-color:#DDD6FE}
.le-stat-val{font-family:var(--font-heading);font-size:1.3rem;color:#0F172A;margin-bottom:4px}
.le-stat-lbl{font-size:.74rem;color:#64748B;font-weight:600;text-transform:uppercase}
.le-detail-card{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:14px;padding:20px;margin-bottom:20px;text-align:left}
.le-detail-title{font-weight:700;color:#334155;margin-bottom:12px;font-size:.9rem}
.le-res-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #F1F5F9;font-size:.88rem;color:#475569}
.le-res-row:last-child{border-bottom:none}
.bonus-row{color:#7C3AED;font-weight:600}
.total-row{color:#0F172A;font-weight:700;font-size:1rem;border-top:2px solid #E2E8F0;margin-top:4px;padding-top:10px}

/* ── Koreksi ── */
.le-korr-wrap{border:1px solid #E2E8F0;border-radius:14px;overflow:hidden;text-align:left;margin-bottom:16px}
.le-korr-header{padding:14px 20px;background:#F1F5F9;font-weight:700;color:#334155;cursor:pointer;user-select:none}
.le-korr-body{max-height:0;overflow:hidden;transition:max-height .4s ease}
.le-korr-body.open{max-height:2000px}
.le-korr-section{padding:16px 20px;border-top:1px solid #E2E8F0}
.le-korr-title{font-weight:700;color:#334155;margin-bottom:10px;font-size:.9rem}
.le-korr-item{padding:10px 12px;border-radius:8px;margin-bottom:8px}
.k-correct{background:#F0FDF4;border-left:3px solid #10B981}
.k-wrong{background:#FEF2F2;border-left:3px solid #EF4444}
.le-korr-q{font-size:.85rem;color:#374151;margin-bottom:6px}
.le-korr-ans{font-size:.82rem;display:flex;flex-direction:column;gap:2px}
.k-ok{color:#059669}
.k-err{color:#DC2626}
.k-key{color:#059669}
@media(max-width:600px){.le-stats-grid{grid-template-columns:repeat(2,1fr)}.le-intro-meta{grid-template-columns:1fr 1fr}}
`;
document.head.appendChild(style);
})();
