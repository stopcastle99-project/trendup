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
    const historyList = document.getElementById('history-list');
    if (!historyList) return;
    
    try {
        const snapshot = await db.collection("reports").doc(type).collection(country)
            .orderBy("lastUpdated", "desc")
            .limit(6)
            .get();
            
        historyList.innerHTML = '';
        snapshot.forEach(doc => {
            if (doc.id === reportId) return;
            const data = doc.data();
            const item = document.createElement('div');
            item.className = 'history-item';
            item.innerHTML = `
                <div style="font-size: 0.7rem; color:var(--primary); font-weight:800; margin-bottom:0.3rem;">${data.type.toUpperCase()}</div>
                <div style="font-weight:700;">${data.dateRange || data.reportTitle}</div>
            `;
            item.onclick = () => {
                window.location.href = `?type=${type}&country=${country}&id=${doc.id}`;
            };
            historyList.appendChild(item);
        });
    } catch (e) { console.warn("History load failed"); }
}
