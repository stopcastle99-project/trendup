// Trend Report Detail Logic - v3.4.68 (Final Stable with Timeout)
const ICONS = {
    sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`,
    moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`,
    system: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2v20" opacity="0.5"></path><path d="M12 2a10 10 0 0 0 0 20z" fill="currentColor"></path></svg>`
};

const REPORT_I18N = {
    ko: {
        title: "실시간 글로벌 트렌드 리포트",
        weekly: "주간", monthly: "월간", yearly: "년간",
        period_summary: "집계 기간 : ", current_period: "선택 리포트",
        history: "과거 내역", related_news: "관련 뉴스", related_videos: "관련 영상",
        back_to_main: "메인으로 돌아가기",
        month: (m) => `${m}월`, year: (y) => `${y}년`,
        growth: "성장률", trend_report: "트렌드 보고서",
        total_views: "총 조회수", avg_growth: "평균 성장률", agg_period: "집계기간", please_wait: "기다려주세요...",
        aggregating: "집계 중",
        wait: "2026년 데이터를 정밀하게 분석 및 집계하고 있습니다. 잠시만 기다려 주세요.",
        agg_banner: (typeLabel, m) => typeLabel === "년간" ? `2026년 ${typeLabel} 리포트가 집계 중입니다.` : `${m}월 ${typeLabel} 리포트가 집계 중입니다.`
    },
    ja: {
        title: "リアルタイム グローバルトレンドレポート",
        weekly: "週間", monthly: "月間", yearly: "年間",
        period_summary: "集計期間 : ", current_period: "現在の期間",
        history: "過去の履歴", related_news: "関連ニュース", related_videos: "関連動画",
        back_to_main: "メインに戻る",
        month: (m) => `${m}月`, year: (y) => `${y}年`,
        growth: "成長率", trend_report: "トレンド報告書",
        total_views: "총 조회수", avg_growth: "平均成長率", agg_period: "集計期間", please_wait: "お待ちください...",
        aggregating: "集計중",
        wait: "2026年のデータを精密에 분석 및 집계하고 있습니다. 少々お待ちください。",
        agg_banner: (typeLabel, m) => typeLabel === "年間" ? `2026年 ${typeLabel}レポートが集計中です.` : `${m}월 ${typeLabel}レポートが集計中です.`
    },
    en: {
        title: "Global Trend Report",
        weekly: "Weekly", monthly: "Monthly", yearly: "Yearly",
        period_summary: "Aggregation Period : ", current_period: "Current Period",
        history: "Past History", related_news: "Related News", related_videos: "Related Videos",
        back_to_main: "Back to Main",
        month: (m) => { const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; return mon[m - 1]; },
        year: (y) => `${y}`,
        growth: "Growth", trend_report: "Trend Report",
        total_views: "Total Views", avg_growth: "Avg Growth", agg_period: "Aggregation Period", please_wait: "Please wait...",
        aggregating: "Aggregating",
        wait: "We are carefully analyzing and aggregating 2026 data. Please wait a moment.",
        agg_banner: (typeLabel, m) => typeLabel === "Yearly" ? `2026 ${typeLabel} report is aggregating.` : `${m} ${typeLabel} report is aggregating.`
    }
};

const firebaseConfig = { projectId: "test-76cdd" };
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
db.settings({ experimentalAutoDetectLongPolling: true });

const params = new URLSearchParams(window.location.search);
let type = params.get('type') || 'weekly';
let country = params.get('country') || 'KR';
let reportId = params.get('id') || 'latest';
let lang = localStorage.getItem('lang') || params.get('lang') || (country === 'KR' ? 'ko' : country === 'JP' ? 'ja' : 'en');
let isReportLoaded = false;

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

    // Safety fallback: If still not loaded after 3s, show aggregating screen
    setTimeout(() => {
        if (!isReportLoaded) {
            console.warn("Report loading timed out. Showing aggregating screen.");
            renderAggregatingScreen();
        }
    }, 3000);
});

function applyTranslations() {
    const t = REPORT_I18N[lang] || REPORT_I18N.en;
    document.documentElement.setAttribute('lang', lang);
    const titleEl = document.getElementById('global-title');
    if (titleEl) titleEl.textContent = t.title;

    const sidebarLabels = document.querySelectorAll('.sidebar-label');
    if (sidebarLabels[0]) sidebarLabels[0].textContent = t.current_period;
    if (sidebarLabels[1]) sidebarLabels[1].textContent = t.history;

    const statLabels = document.querySelectorAll('.stat-label');
    if (statLabels[0]) statLabels[0].textContent = t.total_views;
    if (statLabels[1]) statLabels[1].textContent = t.avg_growth;
    if (statLabels[2]) statLabels[2].textContent = t.agg_period;

    const loadingState = document.querySelector('.loading-state');
    if (loadingState) loadingState.textContent = t.please_wait;

    document.querySelectorAll('[data-type]').forEach(btn => {
        const type_btn = btn.getAttribute('data-type');
        if (t[type_btn]) btn.textContent = t[type_btn];
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
        if (theme === 'system') theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
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
        loadHistory();

        const allSnap = await db.collection("reports").doc(type).collection(country).get();
        const sortedCompleteDocs = allSnap.docs
            .map(d => ({ id: d.id, data: d.data() }))
            .filter(d => {
                const data = d.data;
                const isAggFlag = data.isAggregating === true;
                const label = (data.dateRange || "").toLowerCase();
                const hasDraftKeywords = label.includes('집계') || label.includes('작성') || label.includes('aggregating') || label.includes('draft');
                return !isAggFlag && !hasDraftKeywords && d.id !== 'latest';
            })
            .sort((a, b) => {
                const tA = a.data.lastUpdated ? a.data.lastUpdated.toMillis() : 0;
                const tB = b.data.lastUpdated ? b.data.lastUpdated.toMillis() : 0;
                return tB - tA;
            });
        
        const latestCompleteDoc = sortedCompleteDocs[0];

        let finalDoc;
        if (reportId === 'latest') {
            finalDoc = latestCompleteDoc;
        } else {
            const requestedDoc = await db.collection("reports").doc(type).collection(country).doc(reportId).get();
            if (requestedDoc.exists) {
                const data = requestedDoc.data();
                const isAggFlag = data.isAggregating === true;
                const label = (data.dateRange || "").toLowerCase();
                const hasDraftKeywords = label.includes('집계') || label.includes('작성');
                if (isAggFlag || hasDraftKeywords) {
                    finalDoc = latestCompleteDoc;
                } else {
                    finalDoc = requestedDoc;
                }
            } else {
                finalDoc = latestCompleteDoc;
            }
        }

        if (!finalDoc) {
            renderAggregatingScreen();
            return;
        }

        const data = (typeof finalDoc.data === 'function') ? finalDoc.data() : finalDoc.data;
        isReportLoaded = true;
        renderHero(data);
        renderTrends(data.items);
    } catch (e) {
        console.error("Report load error:", e);
        renderAggregatingScreen();
    }
}

function renderHero(data) {
    const t = REPORT_I18N[lang] || REPORT_I18N.en;
    const periodSummary = document.getElementById('current-period-summary');
    let displayRange = data.dateRange || 'Latest Update';
    
    if (periodSummary) {
        periodSummary.innerHTML = `<span class="period-label-text">${t.period_summary} ${displayRange}</span>`;
    }
    const displayElement = document.getElementById('current-period-display');
    if (displayElement) displayElement.textContent = data.dateRange || 'Current Period';
}

function renderTrends(items) {
    const container = document.getElementById('trend-list');
    if (!container || !items || !Array.isArray(items)) return;
    container.innerHTML = '';
    const t = REPORT_I18N[lang] || REPORT_I18N.en;

    items.forEach((item) => {
        const featuredClass = item.rank === 1 ? 'featured-1' : (item.rank === 2 ? 'featured-2' : '');
        const card = document.createElement('div');
        card.className = `trend-card ${featuredClass}`;

        const growth = item.growth || (Math.floor(Math.random() * 15) + 5);
        const gaugeWidth = item.score ? Math.min(100, Math.max(30, item.score / 10)) : (Math.floor(Math.random() * 40) + 60);
        const displayKeyword = (item.translations && item.translations[lang]) || item.keyword;
        
        let displayAnalysis = '';
        if (item.aiReports && item.aiReports[lang]) displayAnalysis = item.aiReports[lang];
        else if (item.depth && typeof item.depth === 'object') displayAnalysis = item.depth[lang] || item.depth.ko || '';
        else if (typeof item.depth === 'string') displayAnalysis = item.depth;
        displayAnalysis = displayAnalysis.trim().split('\n').map(line => line.trim()).join('\n');

        card.innerHTML = `
            <div class="card-top">
                <span class="rank-badge">#${item.rank}</span>
                <span class="growth-pill">${t.growth} +${growth}%</span>
            </div>
            <h3>${displayKeyword}</h3>
            <div class="card-analysis" style="white-space: pre-wrap; line-height: 1.8; margin-top: 1rem; color: var(--text-secondary);">${displayAnalysis}</div>
            <div class="card-viz">
                <div class="progress-bg"><div class="progress-fill" style="width: ${gaugeWidth}%"></div></div>
            </div>
            <div class="card-supplementary">
                ${item.newsLinks ? `
                    <div class="news-section">
                        <h4>${t.related_news}</h4>
                        <div class="news-list">
                            ${item.newsLinks.slice(0, 3).map(n => `<a href="${n.url}" target="_blank" class="news-link">${n.title}</a>`).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
        container.appendChild(card);
    });
}

function renderAggregatingScreen() {
    if (isReportLoaded) return;
    const container = document.getElementById('trend-list');
    const hero = document.getElementById('current-period-display');
    const t = REPORT_I18N[lang] || REPORT_I18N.en;
    const typeLabel = t[type] || type;
    
    if (hero) hero.textContent = typeLabel;
    
    if (container) {
        container.innerHTML = `
            <div class="aggregating-container" style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 6rem 2rem; text-align:center; background: var(--surface); border-radius: 32px; border: 1px solid var(--border); margin-top: 2rem; min-height: 400px; box-shadow: var(--shadow-sm);">
                <div class="pulse-loader" style="width: 100px; height: 100px; background: var(--primary); border-radius: 50%; opacity: 0.15; animation: report-pulse 2s infinite ease-in-out; margin-bottom: 2.5rem; position: relative; display: flex; align-items: center; justify-content: center;">
                    <span style="font-size: 2.5rem;">📊</span>
                </div>
                <h2 style="font-size: 2rem; font-weight: 900; margin-bottom: 1.2rem; color: var(--text-primary); letter-spacing: -0.02em;">
                    ${typeLabel} ${t.trend_report} ${t.aggregating || (lang === 'ko' ? '집계 중' : 'Aggregating')}
                </h2>
                <p style="color: var(--text-secondary); max-width: 450px; line-height: 1.7; font-size: 1.05rem; margin-bottom: 2.5rem;">
                    ${t.wait || (lang === 'ko' ? '2026년 데이터를 정밀하게 분석 및 집계하고 있습니다. 잠시만 기다려 주세요.' : 'We are carefully analyzing and aggregating 2026 data. Please wait a moment.')}
                </p>
                <a href="/" style="display: inline-flex; align-items: center; gap: 0.6rem; padding: 0.8rem 1.5rem; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; color: var(--text-primary); text-decoration: none; font-weight: 700; transition: 0.2s; box-shadow: var(--shadow-sm);">
                    <span>←</span> ${t.back_to_main}
                </a>
            </div>
            <style>
                @keyframes report-pulse {
                    0% { transform: scale(0.9); opacity: 0.1; }
                    50% { transform: scale(1.1); opacity: 0.25; }
                    100% { transform: scale(0.9); opacity: 0.1; }
                }
                .aggregating-container:hover { border-color: var(--primary); transform: translateY(-5px); transition: 0.3s; }
            </style>
        `;
    }
}

async function loadHistory() {
    const list = document.getElementById('history-dropdown-list');
    if (!list) return;
    const t = REPORT_I18N[lang] || REPORT_I18N.en;
    try {
        const allSnapHistory = await db.collection("reports").doc(type).collection(country).get();
        const sortedDocs = allSnapHistory.docs
            .map(d => ({ id: d.id, data: d.data() }))
            .filter(d => {
                const data = d.data;
                const isAggFlag = data.isAggregating === true;
                const label = (data.dateRange || "").toLowerCase();
                const hasDraftKeywords = label.includes('집계') || label.includes('작성') || label.includes('aggregating') || label.includes('draft');
                return !isAggFlag && !hasDraftKeywords && d.id !== 'latest';
            })
            .sort((a, b) => {
                const tA = a.data.lastUpdated ? a.data.lastUpdated.toMillis() : 0;
                const tB = b.data.lastUpdated ? b.data.lastUpdated.toMillis() : 0;
                return tB - tA;
            }).slice(0, 20);

        list.innerHTML = '';
        const seenTitles = new Set();

        sortedDocs.forEach(doc => {
            const data = doc.data;
            const periodKey = data.dateRange || doc.id;
            if (seenTitles.has(periodKey)) return;
            seenTitles.add(periodKey);

            const isActive = doc.id === reportId;
            const item = document.createElement('div');
            item.className = `history-sidebar-item ${isActive ? 'active' : ''}`;

            let historyTitle = data.dateRange || doc.id;

            if (historyTitle.includes('리포트')) historyTitle = historyTitle.replace('리포트', t.trend_report);
            else if (!historyTitle.includes(t.trend_report)) historyTitle += ` ${t.trend_report}`;

            item.textContent = historyTitle;
            item.onclick = () => { window.location.href = `?type=${type}&country=${country}&id=${doc.id}`; };
            list.appendChild(item);
        });
    } catch (e) {
        console.warn("History load failed:", e);
    }
}
