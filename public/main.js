import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, Timestamp, initializeFirestore } from 'firebase/firestore';

const ICONS = {
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`,
  moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`,
  system: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2v20" opacity="0.5"></path><path d="M12 2a10 10 0 0 0 0 20z" fill="currentColor"></path></svg>`
};

// --- Localization ---
let i18n = {
  ko: { 
    title: "실시간 인기 트렌드", update: "최근 업데이트", summary: "AI 분석 리포트", news: "관련 뉴스", videos: "YouTube 뉴스", loading: "불러오는 중...", T: "트렌드 설정", L: "언어 설정", original: "원문",
    labels: { trends: "국가:", language: "언어:" },
    menu: { about: "TrendUp 소개", privacy: "개인정보처리방침", terms: "이용약관", contact: "문의하기", siteInfo: "사이트 안내" },
    pages: {
      about: { 
        title: "TrendUp: 글로벌 트렌드 인텔리전스", 
        content: `
          <h2 style="margin-bottom:1.5rem;">세상을 읽는 가장 빠른 인텔리전스, TrendUp</h2>
          <p style="margin-bottom:1rem; line-height:1.8;">TrendUp은 고도의 빅데이터 처리 기술과 최신 AI 엔진을 융합하여 한국, 일본, 미국 등 주요 국가의 검색 트렌드를 실시간으로 분석하고 시각화하는 차세대 데이터 인텔리전스 플랫폼입니다.</p>
          <h3 style="margin:1.5rem 0 0.5rem; border-left:4px solid var(--primary); padding-left:0.8rem;">주요 특징</h3>
          <ul style="margin-bottom:1rem; padding-left:1.2rem; list-style:disc; line-height:1.8;">
            <li><strong>실시간 데이터 파이프라인:</strong> 전 세계의 신뢰도 높은 트렌드 데이터를 10분 간격으로 수집 및 정규화하여 항상 최신 정보를 제공합니다.</li>
            <li><strong>문맥 기반 AI 분석:</strong> 단순한 키워드 나열을 넘어, AI가 해당 트렌드의 발생 배경과 맥락을 파악하여 사용자의 언어로 요약 리포트를 생성합니다.</li>
            <li><strong>글로벌 인사이트:</strong> 국가별 트렌드 비교를 통해 지역적 특색과 전 세계 공통의 관심사를 한눈에 파악할 수 있습니다.</li>
          </ul>
        ` 
      },
      privacy: { 
        title: "개인정보 처리방침 (Privacy Policy)", 
        content: `
          <h2 style="margin-bottom:1.5rem;">개인정보 처리방침</h2>
          <p style="margin-bottom:1rem;">TrendUp(이하 '서비스')은 이용자의 개인정보를 소중히 여기며, 관련 법령을 준수합니다. (v2.5.0)</p>
          <h3>1. 개인정보 수집 및 이용</h3>
          <p>본 서비스는 별도의 회원가입 없이 모든 기능을 이용할 수 있습니다. 다만, 서비스 이용 과정에서 접속 IP, 쿠키, 브라우저 정보 등이 서비스 최적화 및 광고 게재를 위해 자동 수집될 수 있습니다.</p>
          <h3>2. 구글 애드센스 및 쿠키 사용</h3>
          <p>본 사이트는 구글 애드센스를 사용합니다. 구글은 쿠키를 사용하여 사용자의 방문 기록을 바탕으로 맞춤형 광고를 게재합니다. 사용자는 구글의 광고 설정을 통해 이를 해제할 수 있습니다.</p>
        ` 
      },
      terms: { 
        title: "서비스 이용약관 (Terms of Service)", 
        content: `
          <h2 style="margin-bottom:1.5rem;">서비스 이용약관</h2>
          <p style="margin-bottom:1rem;">본 약관은 TrendUp 서비스 이용에 관한 권리와 의무를 규정합니다.</p>
          <h3>1. 정보의 정확성</h3>
          <p>본 서비스에서 제공하는 데이터와 AI 분석 내용은 참고용이며, 정확성이나 완전성을 보장하지 않습니다. 중요한 의사결정의 근거로 사용 시 주의가 필요합니다.</p>
        ` 
      },
      contact: { 
        title: "문의하기 (Contact)", 
        content: `
          <h2 style="margin-bottom:1.5rem;">고객 지원</h2>
          <p style="margin-bottom:1rem;">서비스 관련 제안이나 문의사항은 아래 이메일로 연락 주시기 바랍니다.</p>
          <p><strong>Email:</strong> <a href="mailto:help@trendup.ai" style="color:var(--primary);">help@trendup.ai</a></p>
        ` 
      },
      cookie: {
        text: "TrendUp은 서비스 품질 향상 및 맞춤형 콘텐츠 제공을 위해 쿠키를 사용합니다.",
        btn: "확인 및 동의"
      }
    }
  },
  ja: { 
    title: "リアルタイムトレンド", update: "最終更新", summary: "AI分析レポート", news: "関連ニュース", videos: "YouTubeニュース", loading: "読み込み中...", T: "トレンド設定", L: "言語設定", original: "原文",
    labels: { trends: "国:", language: "言語:" },
    menu: { about: "TrendUpについて", privacy: "個人情報保護方針", terms: "利用規約", contact: "お問い合わせ", siteInfo: "사이트 안내" }, 
    pages: { 
      about: { 
        title: "TrendUpについて", 
        content: `
          <h2 style="margin-bottom:1.5rem;">世界を読む、最速のインテリジェンス, TrendUp</h2>
          <p style="margin-bottom:1rem; line-height:1.8;">TrendUpは、高度なビッグデータ処理技術と最新のAIエンジン을 融合させ、日本、韓国、アメリカなどの主要国における検索トレンドをリアルタイムで分析・可視化する次世代のデータインテリジェンスプラットフォームです.</p>
          <h3 style="margin:1.5rem 0 0.5rem; border-left:4px solid var(--primary); padding-left:0.8rem;">主な特徴</h3>
          <ul style="margin-bottom:1rem; padding-left:1.2rem; list-style:disc; line-height:1.8;">
            <li><strong>リアルタイム・데이터 파이프라인：</strong>世界中の信頼性の高いトレンドデータを10分間隔で収集・正規化し、常に最新の情報を提供します。</li>
            <li><strong>AIによる文脈分析：</strong>単なるキーワードの羅列を超え, AIがトレンドの背景と文脈を把握して、ユーザーの言語で要約レポートを生成します.</li>
            <li><strong>グローバルインサイト：</strong>国別のトレンド比較を通じて、地域的な特色や世界共通의 관심사를 한눈에 파악할 수 있습니다.</li>
          </ul>
        ` 
      }, 
      privacy: { 
        title: "個人情報保護方針 (Privacy Policy)", 
        content: `
          <h2 style="margin-bottom:1.5rem;">個人情報保護方針</h2>
          <p style="margin-bottom:1rem;">TrendUp（以下「当サービス」）は, ユーザーの個人情報を大切にし、関連法規を遵守します。(v2.5.0)</p>
          <h3>1. 情報の収集と利用</h3>
          <p>当サービスは会員登録なしで全ての機能を利用できます。ただし、サービス利用過程で接続IP、クッキー、ブラウザ情報などがサービス最適化および広告掲載のために自動的に収集される場合があります。</p>
          <h3>2. Googleアドセンスおよびクッキーの使用</h3>
          <p>当사이트는 Googleアドセンスを使用しています。Google은 쿠키 사용하여 사용자의 방문 기록을 바탕으로 맞춤형 광고를 게재합니다.</p>
        ` 
      }, 
      terms: { 
        title: "サービス利用規約 (Terms of Service)", 
        content: `
          <h2 style="margin-bottom:1.5rem;">サービス利用規約</h2>
          <p style="margin-bottom:1rem;">本規約は, TrendUp의 이용에 관한 필요한 사항을 규정한 것입니다.</p>
          <h3>1. 정보의 정확성에 관한 면책사항</h3>
          <p>본 서비스에서 제공하는 모든 데이터 및 AI 분석 내용은 참고용이며, 그 정확성이나 완전성을 보장하는 것이 아닙니다. 중요한 의사결정의 근거로 사용하는 것은 자제해 주십시오.</p>
        ` 
      }, 
      contact: { 
        title: "お問い合わせ (Contact)", 
        content: `
          <h2 style="margin-bottom:1.5rem;">カスタ머サポート</h2>
          <p style="margin-bottom:1rem;">서비스 관련 제안이나 문의사항은 아래 이메일로 연락 주시기 바랍니다.</p>
          <p><strong>Email:</strong> <a href="mailto:help@trendup.ai" style="color:var(--primary);">help@trendup.ai</a></p>
        ` 
      },
      cookie: {
        text: "TrendUpはサービス品質向上およびパーソナライズされたコンテンツ提供のためにCookieを使用します。",
        btn: "同意する"
      }
    }
  },
  en: { 
    title: "Global Trends", update: "Updated", summary: "AI Analysis Report", news: "Top Stories", videos: "YouTube News", loading: "Loading...", T: "Trends", L: "Language", original: "Original",
    labels: { trends: "Country:", language: "Language:" },
    menu: { about: "About TrendUp", privacy: "Privacy Policy", terms: "Terms of Service", contact: "Contact Us", siteInfo: "Site Info" }, 
    pages: { 
      about: { 
        title: "About TrendUp", 
        content: `
          <h2 style="margin-bottom:1.5rem;">TrendUp: Global Trend Intelligence</h2>
          <p style="margin-bottom:1rem; line-height:1.8;">TrendUp is a data analysis platform that combines big data processing technology with the latest AI engines to analyze and visualize search trends in real-time from major countries including the US, Japan, and Korea.</p>
          <h3 style="margin:1.5rem 0 0.5rem; border-left:4px solid var(--primary); padding-left:0.8rem;">Core Features</h3>
          <ul style="margin-bottom:1rem; padding-left:1.2rem; list-style:disc; line-height:1.8;">
            <li><strong>Real-time Data Pipeline:</strong> We normalize high-reliability data from each country every 10 minutes.</li>
            <li><strong>Context-based AI Analysis:</strong> Our AI understands the context of keywords and provides optimized summaries.</li>
            <li><strong>Global Insight:</strong> Track the lifecycle of trends through precise ranking change monitoring across the globe.</li>
          </ul>
        ` 
      }, 
      privacy: { 
        title: "Privacy Policy", 
        content: `
          <h2 style="margin-bottom:1.5rem;">Privacy Policy</h2>
          <p style="margin-bottom:1rem;">TrendUp ("Service") values users' personal information and complies with relevant laws and regulations. (v2.5.0)</p>
          <h3>1. Information Collection</h3>
          <p>Users can use the service without registration. However, access IP, cookies, and browser information may be automatically collected for analytics and advertising purposes.</p>
          <h3>2. Advertising and Cookies (Google AdSense)</h3>
          <p>This site uses Google AdSense. Google uses cookies to serve ads based on a user's prior visits. You can opt out of personalized advertising in Google settings.</p>
        ` 
      }, 
      terms: { 
        title: "Terms of Service", 
        content: `
          <h2 style="margin-bottom:1.5rem;">Terms of Service</h2>
          <p style="margin-bottom:1rem;">By using TrendUp, you agree to comply with and be bound by the following terms.</p>
          <h3>1. Accuracy of Information</h3>
          <p>All trending data and AI-generated summaries are for reference only. We do not guarantee accuracy or completeness. Do not use this as a basis for critical decision-making.</p>
        ` 
      }, 
      contact: { 
        title: "Contact Us", 
        content: `
          <h2 style="margin-bottom:1.5rem;">Contact Us</h2>
          <p style="margin-bottom:1rem;">If you have any questions or feedback, please contact us via email.</p>
          <p><strong>Email:</strong> help@trendup.ai</p>
        ` 
      },
      cookie: {
        text: "TrendUp uses cookies to improve service quality and provide personalized content.",
        btn: "Accept"
      }
    } 
  }
};

const firebaseConfig = { projectId: "test-76cdd" };

class TrendService {
  constructor() { this.refreshInterval = 10 * 60 * 1000; }
  calculateRankChanges(newItems, oldItems) {
    if (!newItems) return [];
    return newItems.map((item, index) => {
      const prevRank = oldItems ? oldItems.findIndex(o => (o.originalTitle || o.title)?.toLowerCase() === (item.originalTitle || item.title)?.toLowerCase()) : -1;
      let trendDir = 'steady';
      if (prevRank === -1) trendDir = 'new';
      else if (index < prevRank) trendDir = 'up';
      else if (index > prevRank) trendDir = 'down';
      return { ...item, trendDir };
    });
  }
  getCountries() { return [{ code: 'KR', flag: '🇰🇷' }, { code: 'JP', flag: '🇯🇵' }, { code: 'US', flag: '🇺🇸' }]; }
  getLanguages() { return [{ code: 'ko', flag: '🇰🇷' }, { code: 'ja', flag: '🇯🇵' }, { code: 'en', flag: '🇺🇸' }]; }
  autoDetectCountry() { try { const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone; if (timezone.includes('Seoul')) return 'KR'; if (timezone.includes('Tokyo')) return 'JP'; return 'US'; } catch (e) { return 'KR'; } }
}

class TrendList extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: 'open' }); }
  set data({ trends, lang, country }) { this.render(trends, lang, country); }
  render(trends, lang, country) {
    const t = i18n[lang] || i18n.en;
    const countryToLang = { 'KR': 'ko', 'JP': 'ja', 'US': 'en' };
    const nativeLang = countryToLang[country];

    const getTrendIcon = (dir) => {
      if (dir === 'up') return '<span style="color: #ff4d4d; font-weight: 900; font-size: 0.9rem;">↑</span>';
      if (dir === 'down') return '<span style="color: #4d79ff; font-weight: 900; font-size: 0.9rem;">↓</span>';
      if (dir === 'new') return '<span style="color: #ffaa00; font-size: 0.6rem; font-weight: 800; border: 1px solid #ffaa00; padding: 1px 4px; border-radius: 4px; letter-spacing: -0.02em;">NEW</span>';
      return '<span style="color: var(--text-muted); opacity: 0.3; font-size: 0.8rem;">-</span>';
    };
    this.shadowRoot.innerHTML = `<style>:host { display: block; } .list { display: flex; flex-direction: column; gap: 0.75rem; } .item { display: grid; grid-template-columns: 40px 1fr auto; align-items: center; background: var(--surface); padding: 1.2rem; border-radius: 16px; border: 1px solid var(--border); transition: 0.2s; color: var(--text); cursor: pointer; user-select: none; position: relative; z-index: 1; } .item:hover { border-color: var(--primary); transform: translateY(-2px); box-shadow: var(--shadow-hover); } .rank { font-size: 1.2rem; font-weight: 900; color: var(--primary); opacity: 0.8; } .title-group { display: flex; flex-direction: column; overflow: hidden; } .display-title { font-size: 1.05rem; font-weight: 700; padding-right: 0.5rem; line-height: 1.4; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; } .translated-subtitle { font-size: 0.75rem; color: var(--primary); opacity: 0.85; margin-top: 0.2rem; font-weight: 600; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; } .growth { font-size: 1.1rem; display: flex; align-items: center; justify-content: center; min-width: 45px; } .loading { text-align: center; padding: 4rem; color: var(--text-muted); font-size: 0.9rem; }</style>
      <div class="list">${(!trends || trends.length === 0) ? `<div class="loading">${t.loading}</div>` : trends.map((item, index) => {
        const mainTitle = item.originalTitle || item.title;
        const translatedTitle = item.translations?.[lang];
        const showSub = (lang !== nativeLang) && translatedTitle && (translatedTitle.toLowerCase() !== mainTitle.toLowerCase());
        return `<div class="item" data-index="${index}"><span class="rank">${index + 1}</span><div class="title-group"><span class="display-title">${mainTitle}</span>${showSub ? `<span class="translated-subtitle">✨ ${translatedTitle}</span>` : ''}</div><span class="growth">${getTrendIcon(item.trendDir)}</span></div>`;
      }).join('')}</div>`;
    this.shadowRoot.querySelectorAll('.item').forEach(el => { 
      el.onclick = () => {
        const trendData = trends[parseInt(el.dataset.index)];
        window.dispatchEvent(new CustomEvent('open-trend-modal', { detail: trendData }));
      };
    });
  }
}

class TrendModal extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: 'open' }); this.isVisible = false; }
  show(trend, lang) {
    if (!trend) return;
    this.isVisible = true;
    const t = i18n[lang] || i18n.en;
    let analysis = trend.aiReports?.[lang] || trend.aiReports?.['ko'] || (trend.snippets && trend.snippets.length > 0 ? trend.snippets.join(' ') : "AI Analysis Report Loading...");
    this.render(trend, lang, analysis);
  }
  hide() { this.isVisible = false; this.shadowRoot.innerHTML = ''; }
  render(trend, lang, analysis) {
    const t = i18n[lang] || i18n.en;
    this.shadowRoot.innerHTML = `<style>.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 9999; cursor: pointer; } .modal { background: var(--bg); width: 92%; max-width: 500px; max-height: 85vh; border-radius: 24px; padding: 2rem; border: 1px solid var(--border); box-shadow: var(--shadow-hover); overflow-y: auto; position: relative; cursor: default; } .close { position: absolute; top: 1rem; right: 1rem; cursor: pointer; border: none; background: var(--border); width: 32px; height: 32px; border-radius: 50%; font-size: 1.2rem; color: var(--text); display: flex; align-items: center; justify-content: center; } .title { font-size: 1.4rem; font-weight: 800; margin-bottom: 1.5rem; color: var(--text); } .section-title { font-weight: 800; color: var(--primary); margin: 1.5rem 0 0.5rem; display: block; font-size: 0.8rem; text-transform: uppercase; } .text { line-height: 1.6; color: var(--text); margin-bottom: 1.5rem; font-size: 0.95rem; white-space: pre-wrap; } .link-group { display: flex; flex-direction: column; gap: 0.5rem; } .link { padding: 0.8rem 1rem; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; text-decoration: none; color: var(--text); font-size: 0.85rem; display: flex; flex-direction: column; } .link-meta { font-size: 0.7rem; font-weight: 800; color: var(--primary); opacity: 0.7; }</style>
      <div class="overlay"><div class="modal"><button class="close">&times;</button><h2 class="title">${trend.originalTitle || trend.title}</h2><span class="section-title">✨ ${t.summary}</span><p class="text">${analysis}</p><span class="section-title">📰 ${t.news}</span><div class="link-group">${(trend.newsLinks || []).slice(0,3).map(l => `<a href="${l.url}" target="_blank" class="link"><span class="link-meta">${l.source}</span><span>📄 ${l.title}</span></a>`).join('')}</div>${(trend.videoLinks && trend.videoLinks.length > 0) ? `<span class="section-title">🎬 ${t.videos}</span><div class="link-group">${trend.videoLinks.map(v => `<a href="${v.url}" target="_blank" class="link"><span class="link-meta">${v.source}</span><span>🎥 ${v.title}</span></a>`).join('')}</div>` : ''}</div></div>`;
    this.shadowRoot.querySelector('.close').onclick = (e) => { e.stopPropagation(); this.hide(); };
    this.shadowRoot.querySelector('.overlay').onclick = (e) => { if (e.target === e.currentTarget) this.hide(); };
    this.shadowRoot.querySelector('.modal').onclick = (e) => { e.stopPropagation(); };
  }
}

customElements.define('trend-list', TrendList);
customElements.define('trend-modal', TrendModal);

class App {
  constructor() {
    this.service = new TrendService();
    this.currentCountry = localStorage.getItem('country') || this.service.autoDetectCountry();
    this.currentLang = localStorage.getItem('lang') || (this.currentCountry === 'KR' ? 'ko' : this.currentCountry === 'JP' ? 'ja' : 'en');
    this.themeMode = localStorage.getItem('theme-mode') || 'system';
    this.db = null;
    this.init();
  }
  async init() {
    console.log("App Init: v2.5.0");
    try {
      this.initThemeIcons();
      this.applyTheme(this.themeMode);
      this.modal = document.createElement('trend-modal');
      document.body.appendChild(this.modal);
      this.initSideMenu();
      this.initThemeMenu();
      this.initInfoModals();
      this.initCookieBanner();
      this.renderNavs();
      this.refreshUIText();
      this.loadLocalCache();
      window.addEventListener('open-trend-modal', (e) => { if (this.modal) this.modal.show(e.detail, this.currentLang); });
      window.addEventListener('click', () => { 
        document.querySelectorAll('.pill-nav').forEach(n => n.classList.remove('expanded')); 
        document.getElementById('theme-dropdown')?.classList.add('hidden'); 
      });
      this.startAsyncTasks();
      setInterval(() => this.update(), this.service.refreshInterval);
    } catch (e) { console.error("App init error:", e); }
  }
  loadLocalCache() {
    try {
      const cached = localStorage.getItem(`trends_${this.currentCountry}`);
      if (cached) {
        const data = JSON.parse(cached);
        const trends = this.service.calculateRankChanges(data.items, data.previousItems);
        const trendListEl = document.getElementById('top-trends');
        if (trendListEl) trendListEl.data = { trends, lang: this.currentLang, country: this.currentCountry };
      }
    } catch (e) {}
  }
  async startAsyncTasks() {
    try {
      const app = initializeApp(firebaseConfig);
      this.db = initializeFirestore(app, { experimentalForceLongPolling: true });
      this.renderNavs();
      await this.update();
    } catch (e) { console.error("Firebase init failed:", e.message); }
  }
  refreshUIText() {
    try {
      const t = i18n[this.currentLang] || i18n.en;
      document.getElementById('current-country-title').textContent = t.title;
      const footerText = document.querySelector('.footer-content p');
      if (footerText) footerText.textContent = `© 2026 TrendUp. All rights reserved. (v2.5.0)`;
      
      const menuTitles = document.querySelectorAll('.menu-section .menu-title');
      if (menuTitles[0]) menuTitles[0].textContent = t.T || "Trend Settings";
      if (menuTitles[1]) menuTitles[1].textContent = t.menu.siteInfo;

      document.querySelectorAll('.nav-label').forEach(label => {
        const text = label.textContent.toLowerCase();
        if (text.includes('trend')) label.textContent = t.labels?.trends || "Country:";
        if (text.includes('lang')) label.textContent = t.labels?.language || "Language:";
      });

      document.querySelectorAll('[data-page]').forEach(link => {
        const key = link.getAttribute('data-page');
        if (t.menu && t.menu[key]) link.textContent = t.menu[key];
      });

      const cookieText = document.getElementById('cookie-text');
      if (cookieText && t.pages.cookie) cookieText.textContent = t.pages.cookie.text;
      const cookieBtn = document.getElementById('accept-cookies');
      if (cookieBtn && t.pages.cookie) cookieBtn.textContent = t.pages.cookie.btn;
    } catch (e) {}
  }
  initThemeIcons() {
    try {
      const sunIcons = document.querySelectorAll('.sun-svg');
      const moonIcons = document.querySelectorAll('.moon-svg');
      const systemIcons = document.querySelectorAll('.system-svg');
      sunIcons.forEach(el => el.innerHTML = ICONS.sun);
      moonIcons.forEach(el => el.innerHTML = ICONS.moon);
      systemIcons.forEach(el => el.innerHTML = ICONS.system);
    } catch (e) {}
  }
  initThemeMenu() {
    const toggle = document.getElementById('theme-menu-toggle');
    const dropdown = document.getElementById('theme-dropdown');
    if (!toggle || !dropdown) return;
    toggle.onclick = (e) => { e.stopPropagation(); dropdown.classList.toggle('hidden'); };
    dropdown.querySelectorAll('.theme-opt').forEach(opt => {
      opt.onclick = (e) => {
        e.stopPropagation();
        this.applyTheme(opt.dataset.theme);
        dropdown.classList.add('hidden');
      };
    });
  }
  applyTheme(mode) {
    this.themeMode = mode;
    localStorage.setItem('theme-mode', mode);
    let targetTheme = mode;
    if (mode === 'system') targetTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', targetTheme);
    const triggerIcon = document.querySelector('.theme-trigger-icon');
    if (triggerIcon) {
      if (mode === 'light') triggerIcon.innerHTML = ICONS.sun;
      else if (mode === 'dark') triggerIcon.innerHTML = ICONS.moon;
      else triggerIcon.innerHTML = ICONS.system;
    }
    document.querySelectorAll('.theme-opt').forEach(opt => opt.classList.toggle('active', opt.dataset.theme === mode));
  }
  initSideMenu() {
    const toggle = document.getElementById('menu-toggle');
    const close = document.getElementById('menu-close');
    const overlay = document.getElementById('side-menu-overlay');
    const menu = document.getElementById('side-menu');
    if (!toggle || !menu) return;
    toggle.onclick = (e) => { e.stopPropagation(); menu.classList.add('active'); overlay.classList.remove('hidden'); };
    if (close) close.onclick = () => { menu.classList.remove('active'); overlay.classList.add('hidden'); };
    if (overlay) overlay.onclick = () => { menu.classList.remove('active'); overlay.classList.add('hidden'); };
  }
  initCookieBanner() {
    const banner = document.getElementById('cookie-banner');
    if (!banner || localStorage.getItem('cookies-accepted')) return;
    banner.classList.remove('hidden');
    const btn = banner.querySelector('button');
    if (btn) btn.onclick = () => { localStorage.setItem('cookies-accepted', 'true'); banner.classList.add('hidden'); };
  }
  initInfoModals() {
    const overlay = document.getElementById('info-modal');
    const body = document.getElementById('info-modal-body');
    const closeBtn = document.querySelector('.info-modal-close');
    document.querySelectorAll('.info-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const pageKey = link.getAttribute('data-page');
        const t = i18n[this.currentLang] || i18n.en;
        if (t.pages && t.pages[pageKey] && body && overlay) { 
          body.innerHTML = t.pages[pageKey].content; 
          overlay.classList.remove('hidden'); 
        }
      });
    });
    if (closeBtn) closeBtn.onclick = () => overlay.classList.add('hidden');
    if (overlay) overlay.onclick = (e) => { if (e.target === overlay) overlay.classList.add('hidden'); };
  }
  renderNavs() {
    try {
      const renderGroup = (id, items, current, onSelect) => {
        const nav = document.getElementById(id);
        if (!nav) return;
        const activeItem = items.find(i => i.code === current);
        if (!activeItem) return;
        nav.innerHTML = `<button class="country-btn active">${activeItem.flag}</button>${items.filter(i => i.code !== current).map(item => `<button class="country-btn" data-code="${item.code}">${item.flag}</button>`).join('')}`;
        nav.onclick = (e) => { e.stopPropagation(); nav.classList.toggle('expanded'); };
        nav.querySelectorAll('button[data-code]').forEach(btn => btn.onclick = (e) => { e.stopPropagation(); onSelect(btn.dataset.code); nav.classList.remove('expanded'); });
      };
      renderGroup('country-nav', this.service.getCountries(), this.currentCountry, (code) => this.switchCountry(code));
      renderGroup('lang-nav', this.service.getLanguages(), this.currentLang, (code) => this.switchLang(code));
    } catch (e) {}
  }
  async switchCountry(code) { this.currentCountry = code; localStorage.setItem('country', code); this.loadLocalCache(); this.renderNavs(); await this.update(); }
  async switchLang(code) { this.currentLang = code; localStorage.setItem('lang', code); this.renderNavs(); this.refreshUIText(); this.loadLocalCache(); await this.update(); }
  
  async update() {
    if (!this.db) return;
    try {
      const t = i18n[this.currentLang] || i18n.en;
      const trendDoc = await getDoc(doc(this.db, 'trends', this.currentCountry));
      if (trendDoc.exists()) {
        const dbData = trendDoc.data();
        const trends = this.service.calculateRankChanges(dbData.items, dbData.previousItems);
        const trendListEl = document.getElementById('top-trends');
        if (trendListEl) trendListEl.data = { trends, lang: this.currentLang, country: this.currentCountry };
        const date = dbData.lastUpdated.toDate();
        const lastUpdatedEl = document.getElementById('last-updated');
        if (lastUpdatedEl) lastUpdatedEl.textContent = `${t.update}: ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false})}`;
        localStorage.setItem(`trends_${this.currentCountry}`, JSON.stringify({ items: dbData.items, previousItems: dbData.previousItems, lastUpdated: dbData.lastUpdated.toMillis() }));
      }
    } catch (e) { console.warn("Update failed:", e.message); }
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => new App());
else new App();
