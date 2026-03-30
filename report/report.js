// Trend Report Detail Logic
const ICONS = {
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`,
  moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`,
  system: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2v20" opacity="0.5"></path><path d="M12 2a10 10 0 0 0 0 20z" fill="currentColor"></path></svg>`
};

function injectIcons() {
    document.querySelectorAll('.sun-svg').forEach(el => el.innerHTML = ICONS.sun);
    document.querySelectorAll('.moon-svg').forEach(el => el.innerHTML = ICONS.moon);
    document.querySelectorAll('.system-svg').forEach(el => el.innerHTML = ICONS.system);
}
const firebaseConfig = { projectId: "test-76cdd" };
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const params = new URLSearchParams(window.location.search);
let type = params.get('type') || 'weekly';
let country = params.get('country') || 'KR';
let reportId = params.get('id') || 'latest';

// SEO Slug Detection (e.g., /report/kr-weekly-ai-agent-2026-03-29/)
const pathParts = window.location.pathname.split('/').filter(p => p);
const lastPart = pathParts[pathParts.length - 1];
if (lastPart && lastPart !== 'report' && lastPart !== 'index.html') {
    reportId = lastPart;
    const segments = lastPart.split('-');
    if (segments.length >= 2) {
        country = segments[0].toUpperCase();
        type = segments[1].toLowerCase();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    injectIcons();
    initNav();
    initTheme();
    loadReport();
});

function initTheme() {
    const toggle = document.getElementById('theme-menu-toggle');
    const dropdown = document.getElementById('theme-dropdown');
    const opts = document.querySelectorAll('.theme-opt');
    
    if (!toggle || !dropdown) return;
    
    const triggerIcon = toggle.querySelector('.theme-trigger-icon');

    const updateTriggerIcon = (mode) => {
        const activeOpt = document.querySelector(`.theme-opt[data-theme="${mode}"]`);
        if (activeOpt && triggerIcon) {
            const iconClone = activeOpt.querySelector('.opt-icon').cloneNode(true);
            triggerIcon.innerHTML = '';
            triggerIcon.appendChild(iconClone);
        }
    };

    const setTheme = (mode) => {
        let theme = mode;
        if (mode === 'system') theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme-mode', mode);
        updateTriggerIcon(mode);
        opts.forEach(btn => btn.classList.toggle('active', btn.dataset.theme === mode));
    };

    toggle.onclick = (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
    };

    opts.forEach(opt => {
        opt.onclick = () => {
            setTheme(opt.dataset.theme);
            dropdown.classList.add('hidden');
        };
    });

    document.addEventListener('click', () => dropdown.classList.add('hidden'));
    
    const currentMode = localStorage.getItem('theme-mode') || 'system';
    setTheme(currentMode);
}

function initNav() {
    document.querySelectorAll('#report-type-nav .nav-btn').forEach(btn => {
        if (btn.dataset.type === type) btn.classList.add('active');
        btn.onclick = () => {
            window.location.href = `?type=${btn.dataset.type}&country=${country}&id=latest`;
        };
    });
}

async function loadReport() {
    try {
        const doc = await db.collection("reports").doc(type).collection(country).doc(reportId).get();
        if (!doc.exists) {
            document.body.innerHTML = '<div style="padding: 5rem; text-align:center;"><h2>Report Not Found</h2><a href="../">Back to Home</a></div>';
            return;
        }

        const data = doc.data();
        renderHero(data);
        renderChart(data.items);
        renderDepthAnalysis(data.items.slice(0, 2));
        renderSimpleAnalysis(data.items.slice(2, 5));
        loadHistory();
    } catch (e) {
        console.error("Report load error:", e);
    }
}

function renderHero(data) {
    document.getElementById('report-title-text').textContent = data.reportTitle || `${data.type.toUpperCase()} Trend Report`;
    document.getElementById('report-date-range').textContent = data.dateRange;
    document.getElementById('country-badge').textContent = `Region: ${data.country}`;
}

function renderChart(items) {
    const container = document.getElementById('bar-chart');
    if (!container || !items) return;
    
    const maxScore = Math.max(...items.map(i => i.score));
    container.innerHTML = items.map(item => {
        const height = (item.score / maxScore) * 100;
        return `<div class="bar-item" style="height: ${height}%" data-rank="#${item.rank}" title="${item.keyword}: ${item.score}pts"></div>`;
    }).join('');
}

function renderDepthAnalysis(items) {
    items.forEach((item, idx) => {
        const card = document.getElementById(`top-rank-${idx + 1}`);
        if (!card) return;
        
        card.querySelector('.keyword').textContent = item.keyword;
        card.querySelector('.analysis-text').innerHTML = item.depth.split('\n\n').map(p => `<p>${p}</p>`).join('');
        
        const newsList = card.querySelector('.news-list');
        if (item.newsLinks) {
            newsList.innerHTML = item.newsLinks.slice(0, 3).map(n => `<a href="${n.url}" target="_blank" class="news-link">${n.title}</a>`).join('');
        }

        const videoGrid = card.querySelector('.video-grid');
        if (item.videoLinks) {
            videoGrid.innerHTML = item.videoLinks.slice(0, 2).map(v => `
                <div class="video-item">
                    <iframe width="100%" height="100%" src="https://www.youtube.com/embed/${v.id}" frameborder="0" allowfullscreen></iframe>
                </div>
            `).join('');
        }
    });
}

function renderSimpleAnalysis(items) {
    const container = document.querySelector('.grid-345');
    if (!container) return;
    
    container.innerHTML = items.map(item => `
        <div class="simple-card">
            <span class="rank-mini">RANK #${item.rank}</span>
            <h3>${item.keyword}</h3>
            <p>${item.depth}</p>
        </div>
    `).join('');
}

async function loadHistory() {
    const types = ['weekly', 'monthly', 'yearly'];
    
    for (const t of types) {
        const container = document.getElementById(`sidebar-${t}`);
        if (!container) continue;
        
        try {
            const snapshot = await db.collection("reports").doc(t).collection(country)
                .orderBy("lastUpdated", "desc")
                .limit(10)
                .get();
                
            container.innerHTML = '';
            snapshot.forEach(doc => {
                const data = doc.data();
                const isActive = doc.id === reportId && t === type;
                
                const item = document.createElement('div');
                item.className = `history-sidebar-item ${isActive ? 'active' : ''}`;
                item.innerHTML = `
                    <div class="item-date">${data.dateRange || data.reportTitle}</div>
                    <div class="item-meta">${t.toUpperCase()}</div>
                `;
                item.onclick = () => {
                    window.location.href = `?type=${t}&country=${country}&id=${doc.id}`;
                };
                container.appendChild(item);
            });
            
            if (snapshot.empty) {
                container.innerHTML = '<div class="history-sidebar-item pending">Coming Soon...</div>';
            }
        } catch (e) {
            console.warn(`History load failed for ${t}:`, e);
        }
    }
}

function toggleCategory(cat) {
    const container = document.getElementById(`sidebar-${cat}`);
    if (!container) return;
    
    const isExpanded = container.classList.toggle('expanded');
    const btn = container.parentElement.querySelector('.more-btn span');
    if (btn) btn.textContent = isExpanded ? '-' : '+';
}

// Add CSS for expansion
const style = document.createElement('style');
style.textContent = `
    .history-list { max-height: 220px; overflow: hidden; transition: max-height 0.5s ease; }
    .history-list.expanded { max-height: 1000px; }
    .history-sidebar-item { margin-bottom: 0.5rem; }
    .item-date { font-weight: 700; font-size: 0.85rem; }
    .item-meta { font-size: 0.65rem; opacity: 0.7; text-transform: uppercase; margin-top: 0.2rem; }
`;
document.head.appendChild(style);
