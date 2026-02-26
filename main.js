import * as THREE from 'three';

// --- Trend Service ---
class TrendService {
  constructor() {
    this.proxyUrl = 'https://api.allorigins.win/get?url=';
    this.refreshInterval = 15 * 60 * 1000;
  }

  async getTrends(country) {
    const rssUrl = `https://trends.google.com/trending/rss?geo=${country}`;
    const targetUrl = encodeURIComponent(rssUrl);
    
    try {
      const response = await fetch(`${this.proxyUrl}${targetUrl}`);
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(data.contents, "text/xml");
      const items = xmlDoc.querySelectorAll("item");
      const trends = [];

      items.forEach((item, index) => {
        if (index >= 10) return;
        const title = item.querySelector("title")?.textContent;
        
        const getNS = (tagName) => {
          const el = item.getElementsByTagNameNS("*", tagName)[0] || 
                     item.getElementsByTagName("ht:" + tagName)[0];
          return el?.textContent || "";
        };

        const traffic = getNS("approx_traffic") || "N/A";
        
        const newsElements = item.getElementsByTagNameNS("*", "news_item");
        const newsLinks = [];
        const videoLinks = [];
        let summaryContext = "";

        for (let i = 0; i < newsElements.length; i++) {
          const n = newsElements[i];
          const nTitle = n.getElementsByTagNameNS("*", "news_item_title")[0]?.textContent;
          const nUrl = n.getElementsByTagNameNS("*", "news_item_url")[0]?.textContent;
          const nSource = n.getElementsByTagNameNS("*", "news_item_source")[0]?.textContent;
          const nSnippet = n.getElementsByTagNameNS("*", "news_item_snippet")[0]?.textContent;

          if (nTitle && nUrl) {
            const linkObj = { title: `[${nSource || 'News'}] ${nTitle}`, url: nUrl };
            // Simple URL pattern check for videos
            if (nUrl.includes('youtube.com') || nUrl.includes('youtu.be') || nUrl.includes('vimeo')) {
              videoLinks.push(linkObj);
            } else {
              newsLinks.push(linkObj);
            }
          }
          if (i === 0) summaryContext = nSnippet || nTitle;
        }

        // Logic to generate a cleaner "Why it's trending" analysis
        let analysis = "";
        if (summaryContext) {
          analysis = summaryContext.replace(/<[^>]*>?/gm, '');
          if (analysis.length < 30) analysis = `${title}에 대한 새로운 소식과 대중의 관심이 급증하며 트렌드로 부상했습니다.`;
        } else {
          analysis = `${title} 키워드가 현재 실시간 검색 및 소셜 미디어에서 높은 주목을 받고 있습니다.`;
        }

        trends.push({ 
          title, 
          category: "Trending Now", 
          growth: traffic, 
          analysis: analysis,
          newsLinks, 
          videoLinks,
          picture: "" 
        });
      });
      return trends;
    } catch (e) { 
      return []; 
    }
  }

  getCountries() {
    return [
      { code: 'KR', name: 'South Korea', flag: '🇰🇷', lang: 'ko' },
      { code: 'JP', name: 'Japan', flag: '🇯🇵', lang: 'ja' },
      { code: 'US', name: 'USA', flag: '🇺🇸', lang: 'en' }
    ];
  }

  autoDetectCountry() {
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (timezone.includes('Seoul')) return 'KR';
      if (timezone.includes('Tokyo')) return 'JP';
      return 'US';
    } catch (e) { return 'KR'; }
  }
}

// --- Localization ---
const i18n = {
  ko: { title: "실시간 인기 트렌드", update: "최근 업데이트", summary: "트렌드 요약 및 분석", news: "관련 기사", videos: "관련 영상", infoTitle: "TrendUp 정보", infoDesc: "실시간 급상승 키워드를 한눈에 확인하세요.", loading: "데이터 로딩 중..." },
  ja: { title: "リアルタイムトレンド", update: "最終更新", summary: "トレンド分析", news: "関連記事", videos: "関連動画", infoTitle: "TrendUpについて", infoDesc: "急上昇ワードをリアルタイムでチェック。", loading: "読み込み中..." },
  en: { title: "Trending Now", update: "Last Updated", summary: "Trend Analysis", news: "News Articles", videos: "Video Content", infoTitle: "About TrendUp", infoDesc: "Stay updated with real-time trends.", loading: "Loading..." }
};

// --- Web Components ---
class TrendList extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: 'open' }); }
  set data({ trends, lang }) { this.render(trends, lang); }
  render(trends, lang) {
    const t = i18n[lang] || i18n.en;
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        .list { display: flex; flex-direction: column; gap: 0.75rem; }
        .item {
          display: grid; grid-template-columns: 50px 1fr auto; align-items: center;
          background: var(--surface); padding: 1.25rem; border-radius: 12px;
          border: 1px solid var(--border); transition: all 0.2s; color: var(--text); cursor: pointer;
        }
        .item:hover { border-color: var(--primary); transform: translateY(-2px); box-shadow: var(--shadow-hover); }
        .rank { font-size: 1.25rem; font-weight: 800; color: var(--primary); }
        .title { font-size: 1.1rem; font-weight: 700; }
        .growth { font-size: 0.85rem; font-weight: 700; color: oklch(0.6 0.15 140); }
        .loading { text-align: center; padding: 2rem; color: var(--text-muted); }
      </style>
      <div class="list">
        ${trends.length === 0 ? `<div class="loading">${t.loading}</div>` : 
          trends.map((item, index) => `
            <div class="item" data-index="${index}">
              <span class="rank">${index + 1}</span>
              <span class="title">${item.title}</span>
              <span class="growth">${item.growth}</span>
            </div>
          `).join('')}
      </div>
    `;
    this.shadowRoot.querySelectorAll('.item').forEach(el => {
      el.onclick = () => this.dispatchEvent(new CustomEvent('trend-click', { detail: trends[el.dataset.index], bubbles: true, composed: true }));
    });
  }
}

class TrendModal extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: 'open' }); }
  show(trend, lang) { this.render(trend, lang); this.shadowRoot.querySelector('.overlay').classList.add('active'); }
  hide() { this.shadowRoot.querySelector('.overlay').classList.remove('active'); }
  render(trend, lang) {
    const t = i18n[lang] || i18n.en;
    this.shadowRoot.innerHTML = `
      <style>
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 2000; opacity: 0; pointer-events: none; transition: 0.3s; }
        .overlay.active { opacity: 1; pointer-events: auto; }
        .modal { background: var(--bg); width: 95%; max-width: 550px; max-height: 90vh; border-radius: 20px; padding: 2rem; position: relative; border: 1px solid var(--border); box-shadow: var(--shadow-hover); overflow-y: auto; }
        .close { position: absolute; top: 1rem; right: 1rem; cursor: pointer; border: none; background: none; font-size: 1.5rem; color: var(--text); }
        .title { font-size: 1.75rem; font-weight: 800; margin-bottom: 1rem; color: var(--text); }
        .section-title { font-weight: 800; color: var(--primary); margin: 1.5rem 0 0.5rem; display: block; font-size: 1rem; text-transform: uppercase; }
        .text { line-height: 1.7; color: var(--text); margin-bottom: 1rem; font-size: 1.05rem; }
        .link-group { display: flex; flex-direction: column; gap: 0.5rem; }
        .link { padding: 0.8rem 1rem; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; text-decoration: none; color: var(--text); font-size: 0.9rem; transition: 0.2s; display: flex; align-items: center; gap: 0.5rem; }
        .link:hover { border-color: var(--primary); background: var(--border); }
        .icon { font-size: 1.1rem; }
      </style>
      <div class="overlay">
        <div class="modal">
          <button class="close">&times;</button>
          <h2 class="title">${trend.title}</h2>
          
          <span class="section-title">✨ ${t.summary}</span>
          <p class="text">${trend.analysis}</p>
          
          ${trend.newsLinks.length > 0 ? `
            <span class="section-title">📰 ${t.news}</span>
            <div class="link-group">
              ${trend.newsLinks.map(l => `<a href="${l.url}" target="_blank" class="link"><span class="icon">📄</span> ${l.title}</a>`).join('')}
            </div>
          ` : ''}
          
          ${trend.videoLinks.length > 0 ? `
            <span class="section-title">🎬 ${t.videos}</span>
            <div class="link-group">
              ${trend.videoLinks.map(l => `<a href="${l.url}" target="_blank" class="link"><span class="icon">▶️</span> ${l.title}</a>`).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    `;
    this.shadowRoot.querySelector('.close').onclick = () => this.hide();
  }
}

customElements.define('trend-list', TrendList);
customElements.define('trend-modal', TrendModal);

// --- App ---
class App {
  constructor() {
    this.service = new TrendService();
    this.currentCountry = this.service.autoDetectCountry();
    this.theme = localStorage.getItem('theme') || 'light';
    this.init();
  }

  async init() {
    document.documentElement.setAttribute('data-theme', this.theme);
    this.modal = document.createElement('trend-modal');
    document.body.appendChild(this.modal);

    document.getElementById('theme-toggle').onclick = () => {
      this.theme = this.theme === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', this.theme);
      localStorage.setItem('theme', this.theme);
    };

    this.renderNav();
    await this.update();
    document.getElementById('top-trends').addEventListener('trend-click', e => this.modal.show(e.detail, this.lang));
    setInterval(() => this.update(), this.service.refreshInterval);
  }

  get lang() { return this.service.getCountries().find(c => c.code === this.currentCountry).lang; }

  renderNav() {
    const nav = document.getElementById('country-nav');
    nav.innerHTML = this.service.getCountries().map(c => `
      <button class="country-btn ${c.code === this.currentCountry ? 'active' : ''}" data-code="${c.code}">
        ${c.flag} ${c.code}
      </button>
    `).join('');
    nav.querySelectorAll('button').forEach(btn => btn.onclick = () => this.switch(btn.dataset.code));
  }

  async switch(code) {
    this.currentCountry = code;
    this.renderNav();
    await this.update();
  }

  async update() {
    const trends = await this.service.getTrends(this.currentCountry);
    const t = i18n[this.lang] || i18n.en;
    document.getElementById('current-country-title').textContent = t.title;
    document.querySelector('.info-card h3').textContent = t.infoTitle;
    document.querySelector('.info-card p').textContent = t.infoDesc;
    document.getElementById('top-trends').data = { trends, lang: this.lang };
    const now = new Date();
    document.getElementById('last-updated').textContent = `${t.update}: ${now.toLocaleTimeString()}`;
  }
}

new App();
