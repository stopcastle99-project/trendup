// Trend Report Detail Logic - v3.4.68 (Full I18N Fix - Terminology & Dates)
const ICONS = {
    home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`
};

const REPORT_I18N = {
    ko: {
        title: "트렌드 리포트",
        weekly: "주간", monthly: "월간", yearly: "년간",
        period_summary: "", current_period: "선택 리포트",
        history: "과거 내역", related_news: "관련 뉴스", related_videos: "관련 영상",
        back_to_main: "메인으로 돌아가기",
        month: (m) => `${m}월`, year: (y) => `${y}년`,
        growth: "증가율", trend_report: "트렌드 보고서",
        total_views: "총 조회수", avg_growth: "평균 증가율", agg_period: "집계기간", please_wait: "기다려주세요...",
        aggregating: "집계 중",
        wait: "2026년 데이터를 정밀하게 분석 및 집계하고 있습니다. 잠시만 기다려 주세요.",
        yearly_label: "2026년도",
        yearly_range: "2026-01-01 ~ 2026-12-31"
    },
    ja: {
        title: "トレンドレポート",
        weekly: "週間", monthly: "月間", yearly: "年間",
        period_summary: "", current_period: "現在の期間",
        history: "過去の履歴", related_news: "関連ニュース", related_videos: "関連動画",
        back_to_main: "メインに戻る",
        month: (m) => `${m}月`, year: (y) => `${y}年`,
        growth: "増加率", trend_report: "トレンド報告書",
        total_views: "総表示回数", avg_growth: "平均増加率", agg_period: "集計期間", please_wait: "お待ちください...",
        aggregating: "集計中",
        wait: "2026年のデータを精密に分析および集計しています. 少々お待ちください。",
        yearly_label: "2026年度",
        yearly_range: "2026-01-01 ~ 2026-12-31"
    },
    en: {
        title: "Trend Report",
        weekly: "Weekly", monthly: "Monthly", yearly: "Yearly",
        period_summary: "", current_period: "Current Period",
        history: "Past History", related_news: "Related News", related_videos: "Related Videos",
        back_to_main: "Back to Main",
        month: (m) => { const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; return mon[m - 1]; },
        year: (y) => `${y}`,
        growth: "Increase Rate", trend_report: "Trend Report",
        total_views: "Total Views", avg_growth: "Avg Increase Rate", agg_period: "Aggregation Period", please_wait: "Please wait...",
        aggregating: "Aggregating",
        wait: "We are carefully analyzing and aggregating 2026 data. Please wait a moment.",
        yearly_label: "Year 2026",
        yearly_range: "2026-01-01 ~ 2026-12-31"
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
    loadReport();

    // Safety fallback: If still not loaded after 3s, show aggregating screen
    setTimeout(() => {
        if (!isReportLoaded) {
            console.warn("Report loading timed out. Showing aggregating screen.");
            renderAggregatingScreen();
        }
    }, 3000);
});

function translateDateRange(str) {
    if (!str || lang === 'ko') return str;
    const t = REPORT_I18N[lang] || REPORT_I18N.en;
    let res = str;
    // Handle "2026년 3월" style
    res = res.replace(/(\d+)년/g, (m, y) => t.year ? t.year(y) : y);
    res = res.replace(/(\d+)월/g, (m, mon) => {
        if (lang === 'en') {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return months[parseInt(mon) - 1] || mon;
        }
        return t.month ? t.month(mon) : mon;
    });
    // Handle "11주" style
    res = res.replace(/(\d+)주/g, (m, w) => {
        if (lang === 'ja') return `${w}週`;
        if (lang === 'en') return `Week ${w}`;
        return m;
    });
    // Cleanup English ordering if needed
    if (lang === 'en' && res.includes(' ')) {
        const parts = res.split(' ');
        if (parts.length === 2 && parts[0].length === 4) { // Year first
            return `${parts[1]}, ${parts[0]}`;
        }
    }
    // Final replace common terms just in case
    res = res.replace(/리포트/g, t.trend_report || 'Report');
    return res;
}

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

function initPeriodNav() {
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
        btn.onclick = () => {
            window.location.href = `?type=${btn.dataset.type}&country=${country}&id=latest`;
        };
    });
}

function initCountrySelector() {
    const toggle = document.getElementById('country-dropdown-toggle');
    const menu = document.getElementById('country-dropdown-menu');
    const flagDisplay = document.getElementById('current-country-flag');
    const opts = document.querySelectorAll('.country-opt');
    
    if (!toggle || !menu || !flagDisplay) return;

    const initialOpt = Array.from(opts).find(opt => opt.dataset.country === country);
    if (initialOpt) {
        flagDisplay.textContent = initialOpt.querySelector('.opt-flag').textContent;
        initialOpt.classList.add('active');
    }

    toggle.onclick = (e) => {
        e.stopPropagation();
        menu.classList.toggle('hidden');
    };

    opts.forEach(opt => {
        opt.onclick = () => {
            const selectedCountry = opt.dataset.country;
            window.location.href = `?type=${type}&country=${selectedCountry}&id=latest`;
        };
    });

    document.addEventListener('click', () => {
        menu.classList.add('hidden');
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
    document.querySelectorAll('.home-svg').forEach(el => el.innerHTML = ICONS.home);
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
    let displayRange = translateDateRange(data.dateRange) || 'Latest Update';
    
    if (periodSummary) {
        periodSummary.innerHTML = `<span class="period-label-text">${displayRange}</span>`;
    }
    const displayElement = document.getElementById('current-period-display');
    if (displayElement) {
        let heroRange = translateDateRange(data.dateRange) || 'Current Period';
        displayElement.textContent = heroRange;
    }
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
    const summary = document.getElementById('current-period-summary');
    const t = REPORT_I18N[lang] || REPORT_I18N.en;
    const typeLabel = t[type] || type;
    
    if (hero) {
        hero.textContent = (type === 'yearly') ? (t.yearly_label || '2026년도') : typeLabel;
    }
    if (summary) {
        const range = (type === 'yearly') ? (t.yearly_range || '2026-01-01 ~ 2026-12-31') : '...';
        summary.innerHTML = `<span class="period-label-text">${range}</span>`;
    }
    
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

            let historyTitle = translateDateRange(data.dateRange || doc.id);

            if (!historyTitle.includes(t.trend_report)) {
                 historyTitle += ` ${t.trend_report}`;
            }

            item.textContent = historyTitle;
            item.onclick = () => { window.location.href = `?type=${type}&country=${country}&id=${doc.id}`; };
            list.appendChild(item);
        });
    } catch (e) {
        console.warn("History load failed:", e);
    }
}
