// Trend Report Detail Logic - v3.3.4 (Multi-Language Support)
const ICONS = {
    sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`,
    moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`,
    system: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2v20" opacity="0.5"></path><path d="M12 2a10 10 0 0 0 0 20z" fill="currentColor"></path></svg>`
};

const REPORT_I18N = {
    ko: {
        title: "실시간 글로벌 트렌드 리포트",
        weekly: "주간", monthly: "월간", yearly: "년간",
        period_summary: "집계 기간 : ", current_period: "현재 기간",
        history: "과거 내역", related_news: "관련 뉴스", related_videos: "관련 영상",
        aggregating: "트렌드 집계 중", back_to_main: "메인으로 돌아가기",
        wait: "현재 데이터를 정밀 분석하고 있습니다. 잠시만 기다려 주세요.",
        month: (m) => `${m}월`, year: (y) => `${y}년`
    },
    ja: {
        title: "リアルタイム グローバルトレンドレポート",
        weekly: "週間", monthly: "月間", yearly: "年間",
        period_summary: "集計期間 : ", current_period: "現在の期間",
        history: "過去の履歴", related_news: "関連ニュース", related_videos: "関連動画",
        aggregating: "トレンド集計中", back_to_main: "メインに戻る",
        wait: "現在、データを精密に分析しています。少々お待ちください。",
        month: (m) => `${m}月`, year: (y) => `${y}年`
    },
    en: {
        title: "Global Trend Report",
        weekly: "Weekly", monthly: "Monthly", yearly: "Yearly",
        period_summary: "Aggregation Period : ", current_period: "Current Period",
        history: "Past History", related_news: "Related News", related_videos: "Related Videos",
        aggregating: "Trend Aggregating", back_to_main: "Back to Main",
        wait: "We are carefully analyzing the current data. Please wait a moment.",
        month: (m) => { const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; return mon[m - 1]; },
        year: (y) => `${y}`
    }
};

const firebaseConfig = { projectId: "test-76cdd" };
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
// v3.3.01 Connectivity Fix: Long Polling for stability
db.settings({ experimentalAutoDetectLongPolling: true });

const params = new URLSearchParams(window.location.search);
let type = params.get('type') || 'weekly';
let country = params.get('country') || 'KR';
let reportId = params.get('id') || 'latest';
let lang = localStorage.getItem('lang') || params.get('lang') || (country === 'KR' ? 'ko' : country === 'JP' ? 'ja' : 'en');

// SEO Slug Detection
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
    applyTranslations();
    injectIcons();
    initPeriodNav();
    initCountrySelector();
    initHistoryDropdown();
    initTheme();
    loadReport();
});

function applyTranslations() {
    const t = REPORT_I18N[lang] || REPORT_I18N.en;
    document.documentElement.setAttribute('lang', lang);
    const titleEl = document.getElementById('global-title');
    if (titleEl) titleEl.textContent = t.title;

    // Sidebar Labels
    const sidebarLabels = document.querySelectorAll('.sidebar-label');
    if (sidebarLabels[0]) sidebarLabels[0].textContent = t.current_period;
    if (sidebarLabels[1]) sidebarLabels[1].textContent = t.history;

    // Period Buttons
    document.querySelectorAll('[data-type]').forEach(btn => {
        const type = btn.getAttribute('data-type');
        if (t[type]) btn.textContent = t[type];
    });
}

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

    toggle.onclick = (e) => { e.stopPropagation(); dropdown.classList.toggle('hidden'); };
    opts.forEach(opt => { opt.onclick = () => { setTheme(opt.dataset.theme); dropdown.classList.add('hidden'); }; });
    document.addEventListener('click', () => dropdown.classList.add('hidden'));
    setTheme(localStorage.getItem('theme-mode') || 'system');
}

function initPeriodNav() {
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
        btn.onclick = () => {
            window.location.href = `?type=${btn.dataset.type}&country=${country}&id=latest`;
        };
    });
}

function initCountrySelector() {
    document.querySelectorAll('.country-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.country === country);
        btn.onclick = () => {
            window.location.href = `?type=${type}&country=${btn.dataset.country}&id=latest`;
        };
    });
}

function initHistoryDropdown() {
    const toggleBtn = document.getElementById('history-toggle');
    const list = document.getElementById('history-dropdown-list');
    if (!toggleBtn || !list) return;

    toggleBtn.onclick = () => {
        const isHidden = list.classList.toggle('hidden');
        toggleBtn.textContent = isHidden ? '+' : '-';
    };
}

function injectIcons() {
    document.querySelectorAll('.sun-svg').forEach(el => el.innerHTML = ICONS.sun);
    document.querySelectorAll('.moon-svg').forEach(el => el.innerHTML = ICONS.moon);
    document.querySelectorAll('.system-svg').forEach(el => el.innerHTML = ICONS.system);
}

async function loadReport() {
    try {
        const docRef = db.collection("reports").doc(type).collection(country).doc(reportId);
        const doc = await docRef.get();
        const t = REPORT_I18N[lang] || REPORT_I18N.en;

        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        const isLastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() === now.getDate();

        // Gating logic: Show placeholder for 'latest' Monthly/Yearly if not finalizing period yet
        if (reportId === 'latest') {
            if (type === 'monthly' && !isLastDayOfMonth) {
                renderPlaceholder(`${t.month(currentMonth)} ${t.aggregating}`);
                return;
            }
            if (type === 'yearly' && !(now.getMonth() === 11 && now.getDate() === 31)) {
                renderPlaceholder(`${t.year(currentYear)} ${t.aggregating}`);
                return;
            }
        }

        if (!doc.exists) {
            renderPlaceholder();
            return;
        }

        const data = doc.data();
        renderHero(data);
        renderTrends(data.items);
        loadHistory();
    } catch (e) {
        console.error("Report load error:", e);
        renderPlaceholder();
    }
}

function renderPlaceholder(customMessage) {
    const main = document.getElementById('report-main');
    const t = REPORT_I18N[lang] || REPORT_I18N.en;
    const displayMsg = customMessage || `${t.aggregating}...`;

    main.innerHTML = `
        <div class="aggregating-placeholder">
            <div class="aggregating-icon">📊</div>
            <div class="aggregating-text">
                <h2>${displayMsg}</h2>
                <p>${t.wait}</p>
            </div>
            <a href="../" class="period-btn active" style="padding: 1.2rem 2.5rem; display: inline-block; border-radius: 100px; margin-top: 1rem;">${t.back_to_main}</a>
        </div>
    `;
}

function renderHero(data) {
    const t = REPORT_I18N[lang] || REPORT_I18N.en;
    const periodSummary = document.getElementById('current-period-summary');
    
    // v3.4.1: Precise date range (M/D-M/D)
    let displayRange = data.dateRange || 'Latest Update';
    if (data.startDate && data.endDate) {
        try {
            const s = data.startDate.split('-');
            const e = data.endDate.split('-');
            if (s.length === 3 && e.length === 3) {
                const sM = parseInt(s[1]), sD = parseInt(s[2]);
                const eM = parseInt(e[1]), eD = parseInt(e[2]);
                displayRange = `${sM}/${sD}-${eM}/${eD}`;
            }
        } catch (err) { console.warn("Date parse error:", err); }
    }

    if (periodSummary) periodSummary.textContent = `${t.period_summary} ${displayRange}`;

    const displayElement = document.getElementById('current-period-display');
    if (displayElement) displayElement.textContent = data.dateRange || 'Current Period';
}

function renderTrends(items) {
    const container = document.getElementById('trend-list');
    if (!container) return;
    container.innerHTML = '';

    if (!items || !Array.isArray(items)) {
        return;
    }

    const t = REPORT_I18N[lang] || REPORT_I18N.en;

    items.forEach((item, idx) => {
        const isFeatured = item.rank <= 2;
        const featuredClass = item.rank === 1 ? 'featured-1' : (item.rank === 2 ? 'featured-2' : '');

        const card = document.createElement('div');
        card.className = `trend-card ${featuredClass}`;

        const growth = item.growth || (Math.floor(Math.random() * 15) + 5);
        const gaugeWidth = item.score ? Math.min(100, Math.max(30, item.score / 10)) : (Math.floor(Math.random() * 40) + 60);

        // Localized Content Selection
        const displayKeyword = (item.translations && item.translations[lang]) || item.keyword;
        let displayAnalysis = '';
        if (item.aiReports && item.aiReports[lang]) {
            displayAnalysis = item.aiReports[lang];
        } else if (item.depth && typeof item.depth === 'object') {
            displayAnalysis = item.depth[lang] || item.depth.ko || '';
        } else if (typeof item.depth === 'string') {
            displayAnalysis = item.depth;
        }

        // Clean up excessive leading indentation often added by AI models
        displayAnalysis = displayAnalysis.trim().split('\n').map(line => line.trim()).join('\n');

        const displayGrowth = lang === 'ko' ? `성장률 +${growth}%` : (lang === 'ja' ? `成長率 +${growth}%` : `+${growth}% Growth`);

        card.innerHTML = `
            <div class="card-top">
                <span class="rank-badge">#${item.rank}</span>
                <span class="growth-pill">${displayGrowth}</span>
            </div>
            <h3>${displayKeyword}</h3>
            <div class="card-analysis" style="white-space: pre-wrap; line-height: 1.8; margin-top: 1rem; color: var(--text-secondary);">${displayAnalysis}</div>
            
            <div class="card-viz">
                <div class="progress-bg">
                    <div class="progress-fill" style="width: ${gaugeWidth}%"></div>
                </div>
            </div>

            <div class="card-supplementary">
                ${item.newsLinks ? `
                    <div class="news-section">
                        <h4>${t.related_news}</h4>
                        <div class="news-list">
                            ${item.newsLinks.slice(0, 3).map(n => `
                                <a href="${n.url}" target="_blank" class="news-link">${n.title}</a>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                ${isFeatured && item.videoLinks ? `
                    <div class="video-grid">
                        ${item.videoLinks.filter(v => v.id).slice(0, 2).map(v => `
                            <div class="video-item">
                                <iframe width="100%" height="100%" src="https://www.youtube.com/embed/${v.id}" frameborder="0" allowfullscreen title="${v.title}"></iframe>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;

        container.appendChild(card);
    });
}

async function loadHistory() {
    const list = document.getElementById('history-dropdown-list');
    if (!list) return;
    try {
        const snapshot = await db.collection("reports").doc(type).collection(country)
            .orderBy("lastUpdated", "desc").limit(20).get(); // Increased limit for better dedup room
        list.innerHTML = '';

        const seenTitles = new Set();
        snapshot.forEach(doc => {
            const data = doc.data();
            if (doc.id === 'latest') return;

            // Use dateRange as the unique key for deduplication
            const periodKey = data.dateRange || doc.id;
            if (seenTitles.has(periodKey)) return;
            seenTitles.add(periodKey);

            const isActive = doc.id === reportId;
            const item = document.createElement('div');
            item.className = `history-sidebar-item ${isActive ? 'active' : ''}`;

            // Simplify title to be clear and concise (e.g., "3월 4주차 트렌드 보고서")
            let historyTitle = data.dateRange || doc.id;
            if (historyTitle.includes('리포트')) {
                historyTitle = historyTitle.replace('리포트', '트렌드 보고서');
            } else {
                historyTitle += ' 트렌드 보고서';
            }

            item.textContent = historyTitle;
            item.onclick = () => { window.location.href = `?type=${type}&country=${country}&id=${doc.id}`; };
            list.appendChild(item);
        });
    } catch (e) {
        console.warn("History load failed:", e);
    }
}
