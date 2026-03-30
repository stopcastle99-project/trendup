// Trend Report Detail Logic
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
    initNav();
    loadReport();
    loadSidebar();
});

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
            document.getElementById('report-main').innerHTML = '<div style="padding: 10rem 2rem; text-align:center;"><h2>Report Not Found</h2><p>This report might not have been generated yet.</p><br><a href="../" class="date-badge" style="text-decoration:none;">Back to Home</a></div>';
            return;
        }

        const data = doc.data();
        renderHero(data);
        renderLeadSummary(data.leadSummary);
        renderChart(data.items);
        renderDepthAnalysis(data.items.slice(0, 2));
        renderSimpleAnalysis(data.items.slice(2, 5));
    } catch (e) {
        console.error("Report load error:", e);
    }
}

function renderLeadSummary(summary) {
    const container = document.getElementById('lead-summary');
    if (!container || !summary) {
        if (container) container.style.display = 'none';
        return;
    }
    container.style.display = 'block';
    container.innerHTML = summary.split('\n\n').map(p => `<p>${p}</p>`).join('');
}

async function loadSidebar() {
    const types = ['weekly', 'monthly', 'yearly'];
    const now = new Date();
    
    for (const t of types) {
        try {
            const snapshot = await db.collection("reports").doc(t).collection(country)
                .orderBy("lastUpdated", "desc")
                .limit(20)
                .get();
            
            const container = document.getElementById(`sidebar-${t}`);
            if (!container) continue;

            let html = '';
            let count = 0;
            const existingIds = new Set();
            
            // Calculate current period ID
            let currentPeriodId = '';
            let currentDisplayTitle = '';
            if (t === 'weekly') {
                const start = new Date(now);
                start.setDate(now.getDate() - now.getDay());
                const end = new Date(start);
                end.setDate(start.getDate() + 6);
                currentPeriodId = `${start.toISOString().split('T')[0]}_${end.toISOString().split('T')[0]}`;
                currentDisplayTitle = `${start.getMonth()+1}/${start.getDate()} - ${end.getMonth()+1}/${end.getDate()}`;
            } else if (t === 'monthly') {
                currentPeriodId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                currentDisplayTitle = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
            } else if (t === 'yearly') {
                currentPeriodId = `${now.getFullYear()}`;
                currentDisplayTitle = `${now.getFullYear()}`;
            }

            // Check if current exists
            snapshot.forEach(doc => {
                const data = doc.data();
                existingIds.add(doc.id);
                if (data.periodId) existingIds.add(data.periodId);
            });

            // Prepend "Collecting" if missing
            if (!existingIds.has(currentPeriodId) && !existingIds.has('latest')) {
                html += `<div class="history-sidebar-item pending">
                    ${currentDisplayTitle} <br>
                    <span style="font-size:0.7rem; opacity:0.6;">트렌드 집계 중...</span>
                </div>`;
            }

            snapshot.forEach(doc => {
                const data = doc.data();
                const isCurrent = doc.id === reportId;
                const hiddenClass = count >= 3 ? 'hidden' : '';
                const activeClass = isCurrent ? 'active' : '';
                
                let displayTitle = data.dateRange || data.reportTitle;
                if (t === 'monthly' && data.lastUpdated) {
                    const d = data.lastUpdated.toDate();
                    displayTitle = `${d.getFullYear()} / ${String(d.getMonth() + 1).padStart(2, '0')}`;
                } else if (t === 'yearly' && data.lastUpdated) {
                    displayTitle = `${data.lastUpdated.toDate().getFullYear()} Year`;
                }

                html += `
                <div class="history-sidebar-item ${activeClass} ${hiddenClass}" onclick="navigateTo('${t}', '${doc.id}')">
                    ${displayTitle}
                </div>`;
                count++;
            });

            container.innerHTML = html || '<p style="font-size:0.8rem; color:var(--text-muted); padding:1.2rem; opacity:0.6;">리포트 준비 중...</p>';
            
            const moreBtn = container.nextElementSibling;
            if (count <= 3 && moreBtn) moreBtn.style.display = 'none';
            else if (moreBtn) moreBtn.style.display = 'flex';

        } catch (e) { console.warn(`Sidebar load failed for ${t}`, e); }
    }
}

window.navigateTo = (t, id) => {
    window.location.href = `?type=${t}&country=${country}&id=${id}`;
};

window.toggleCategory = (t) => {
    const container = document.getElementById(`sidebar-${t}`);
    const items = container.querySelectorAll('.history-sidebar-item.hidden');
    const btn = container.nextElementSibling;
    const btnSpan = btn.querySelector('span');
    
    if (items.length > 0) {
        items.forEach(el => {
            el.classList.remove('hidden');
            el.style.animation = 'fadeInUp 0.4s ease forwards';
        });
        if (btnSpan) btnSpan.textContent = '−';
    } else {
        loadSidebar(); // Reset
    }
};

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
                    <iframe width="100%" height="100%" src="https://www.youtube.com/embed/${v.id || v.url?.split('v=')[1]}" frameborder="0" allowfullscreen></iframe>
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
