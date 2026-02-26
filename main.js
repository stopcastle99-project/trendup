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
        const traffic = item.getElementsByTagName("ht:approx_traffic")[0]?.textContent || "N/A";
        const description = item.querySelector("description")?.textContent || "";
        const newsElements = item.getElementsByTagName("ht:news_item");
        const links = [];
        let analysis = description;

        for (let i = 0; i < newsElements.length; i++) {
          const newsTitle = newsElements[i].getElementsByTagName("ht:news_item_title")[0]?.textContent;
          const newsUrl = newsElements[i].getElementsByTagName("ht:news_item_url")[0]?.textContent;
          const newsSnippet = newsElements[i].getElementsByTagName("ht:news_item_snippet")[0]?.textContent;
          const newsSource = newsElements[i].getElementsByTagName("ht:news_item_source")[0]?.textContent;

          if (newsTitle && newsUrl) {
            links.push({ type: i === 0 ? 'news' : 'video', title: `[${newsSource}] ${newsTitle}`, url: newsUrl });
          }
          if (i === 0 && newsSnippet) analysis = newsSnippet;
        }

        trends.push({ title, category: "Trending Now", growth: traffic, analysis: analysis || "...", links, picture: "" });
      });
      return trends;
    } catch (e) { return []; }
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
  ko: { title: "실시간 인기 트렌드", update: "최근 업데이트", summary: "트렌드 분석", infoTitle: "TrendUp 정보", infoDesc: "실시간 급상승 키워드를 한눈에 확인하세요.", loading: "데이터 로딩 중..." },
  ja: { title: "リアルタイムトレンド", update: "最終更新", summary: "トレンド分析", infoTitle: "TrendUpについて", infoDesc: "急上昇ワードをリアルタイムでチェック。", loading: "読み込み中..." },
  en: { title: "Trending Now", update: "Last Updated", summary: "Trend Analysis", infoTitle: "About TrendUp", infoDesc: "Stay updated with real-time trends.", loading: "Loading..." }
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
        .modal { background: var(--bg); width: 90%; max-width: 500px; border-radius: 20px; padding: 2rem; position: relative; border: 1px solid var(--border); box-shadow: var(--shadow-hover); }
        .close { position: absolute; top: 1rem; right: 1rem; cursor: pointer; border: none; background: none; font-size: 1.5rem; color: var(--text); }
        .title { font-size: 1.75rem; font-weight: 800; margin-bottom: 1rem; color: var(--text); }
        .label { font-weight: 700; color: var(--primary); margin-bottom: 0.5rem; display: block; }
        .text { line-height: 1.6; color: var(--text); margin-bottom: 2rem; }
        .links { display: flex; flex-direction: column; gap: 0.5rem; }
        .link { padding: 0.75rem; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; text-decoration: none; color: var(--text); font-size: 0.9rem; }
      </style>
      <div class="overlay">
        <div class="modal">
          <button class="close">&times;</button>
          <h2 class="title">${trend.title}</h2>
          <span class="label">${t.summary}</span>
          <p class="text">${trend.analysis}</p>
          <div class="links">${trend.links.map(l => `<a href="${l.url}" target="_blank" class="link">${l.title}</a>`).join('')}</div>
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
