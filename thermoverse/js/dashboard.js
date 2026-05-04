/* =============================================
   dashboard.js — Analytics dashboard
   ============================================= */

document.addEventListener('DOMContentLoaded', () => {
    const state = ThermoGame.loadState();
    renderStats(state);
    renderIndicators(state);
    renderCategory(state);
    renderDashboardBadges(state);
    renderCharts(state);
    checkConfetti(state);
});

/* ---- Animated Counter ---- */
function animateCounter(el, target, suffix = '', duration = 1200) {
    const start = 0;
    const startTime = performance.now();
    function step(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(eased * target) + suffix;
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

function renderStats(state) {
    const pct = ThermoGame.getCompletionPct(state);
    const totalXP = state.xp || 0;
    const zonesCompleted = Object.values(state.zones).filter(z => z.completed).length;

    const xpEl = document.getElementById('stat-xp');
    const compEl = document.getElementById('stat-completion');
    const zoneEl = document.getElementById('stat-zones');
    const bdgEl = document.getElementById('stat-badges');

    if (xpEl) animateCounter(xpEl, totalXP, ' XP');
    if (compEl) animateCounter(compEl, pct, '%');
    if (zoneEl) animateCounter(zoneEl, zonesCompleted, '/3');
    if (bdgEl) animateCounter(bdgEl, state.badges.length, '');
}

function renderIndicators(state) {
    const thinking = state.thinking || {};
    const indicators = [
        { key: 'critical', name: 'Berpikir Kritis', fillClass: 'fill-critical', color: '#0c3753' },
        { key: 'systemic', name: 'Berpikir Sistemik', fillClass: 'fill-systemic', color: '#165682' },
        { key: 'scientific', name: 'Berpikir Ilmiah', fillClass: 'fill-scientific', color: '#ffaa00' },
        { key: 'innovative', name: 'Berpikir Inovatif', fillClass: 'fill-innovative', color: '#ffffff' }
    ];

    const container = document.getElementById('indicators-grid');
    if (!container) return;

    container.innerHTML = indicators.map(ind => {
        const val = thinking[ind.key] || 0;
        return `
      <div class="indicator-card">
        <div class="indicator-header">
          <span class="indicator-name">${ind.name}</span>
          <span class="indicator-score" style="color:${ind.color}">${val}%</span>
        </div>
        <div class="indicator-bar">
          <div class="indicator-fill ${ind.fillClass}" style="width:0%" data-target="${val}"></div>
        </div>
      </div>`;
    }).join('');

    // Animate bars after DOM paint
    setTimeout(() => {
        container.querySelectorAll('.indicator-fill').forEach(el => {
            el.style.width = el.dataset.target + '%';
        });
    }, 200);
}

function renderCategory(state) {
    const pct = ThermoGame.getCompletionPct(state);
    const cat = ThermoGame.getFinalCategory(pct);

    const labelEl = document.getElementById('category-value');
    const rangeEl = document.getElementById('category-range');
    const emojiEl = document.getElementById('category-emoji');

    if (labelEl) { labelEl.textContent = cat.label; labelEl.style.color = cat.color; }
    if (rangeEl) rangeEl.textContent = `Penyelesaian keseluruhan: ${pct}%`;
    if (emojiEl) emojiEl.textContent = cat.emoji;
}

function renderDashboardBadges(state) {
    BadgeSystem.renderBadges('dashboard-badges-container', state);
}

function renderCharts(state) {
    renderRadarChart(state);
    renderBarChart(state);
}

function renderRadarChart(state) {
    const ctx = document.getElementById('radar-chart');
    if (!ctx || !window.Chart) return;

    const thinking = state.thinking || {};
    new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Kritis', 'Sistemik', 'Ilmiah', 'Inovatif'],
            datasets: [{
                label: 'Skor Berpikir',
                data: [
                    thinking.critical || 0,
                    thinking.systemic || 0,
                    thinking.scientific || 0,
                    thinking.innovative || 0
                ],
                backgroundColor: 'rgba(232,60,0,0.15)',
                borderColor: 'rgba(255,124,0,0.8)',
                pointBackgroundColor: '#0c3753',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#165682',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            scales: {
                r: {
                    min: 0, max: 100,
                    ticks: { color: '#8a4a3a', stepSize: 20, font: { size: 11 } },
                    grid: { color: 'rgba(255,100,0,0.12)' },
                    pointLabels: { color: '#d37f7f', font: { size: 12 } },
                    angleLines: { color: 'rgba(255,100,0,0.1)' }
                }
            },
            plugins: {
                legend: { labels: { color: '#e8f4fd' } }
            }
        }
    });
}

function renderBarChart(state) {
    const ctx = document.getElementById('bar-chart');
    if (!ctx || !window.Chart) return;

    const zones = state.zones;
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Zona 1\nThermodinamika', 'Zona 2\nInovasi', 'Zona 3\nLanjutan'],
            datasets: [{
                label: 'Skor (%)',
                data: [zones.zone1?.score || 0, zones.zone2?.score || 0, zones.zone3?.score || 0],
                backgroundColor: [
                    'rgba(232,60,0,0.45)',
                    'rgba(255,124,0,0.45)',
                    'rgba(255,200,50,0.35)'
                ],
                borderColor: ['#0c3753', '#165682', '#ffdf7a'],
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    min: 0, max: 100,
                    ticks: { color: '#7fb3d3', font: { size: 11 } },
                    grid: { color: 'rgba(255,255,255,0.05)' }
                },
                x: {
                    ticks: { color: '#7fb3d3', font: { size: 11 } },
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { labels: { color: '#e8f4fd' } }
            }
        }
    });
}

/* ---- Confetti ---- */
function checkConfetti(state) {
    const allDone = Object.values(state.zones).every(z => z.completed);
    if (!allDone) return;

    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const pieces = [];
    const colors = ['#0c3753', '#165682', '#ffdf7a', '#a0aec0', '#475569', '#cbd5e1'];

    for (let i = 0; i < 150; i++) {
        pieces.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            w: Math.random() * 12 + 4,
            h: Math.random() * 6 + 3,
            color: colors[Math.floor(Math.random() * colors.length)],
            vy: Math.random() * 3 + 2,
            vx: (Math.random() - 0.5) * 2,
            angle: Math.random() * Math.PI * 2,
            vangle: (Math.random() - 0.5) * 0.1,
            alpha: 1
        });
    }

    let frames = 0;
    function drawConfetti() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        pieces.forEach(p => {
            p.y += p.vy;
            p.x += p.vx;
            p.angle += p.vangle;
            if (frames > 120) p.alpha -= 0.005;

            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            ctx.restore();
        });
        frames++;
        if (frames < 300) requestAnimationFrame(drawConfetti);
        else { ctx.clearRect(0, 0, canvas.width, canvas.height); }
    }

    setTimeout(drawConfetti, 500);
}
