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

        // Add a guaranteed YouTube search link
        videoLinks.push({
          title: `YouTube: '${title}' 관련 뉴스 및 영상 검색`,
          url: `https://www.youtube.com/results?search_query=${encodeURIComponent(title + " 뉴스")}`,
          isSystem: true
        });

        for (let i = 0; i < newsElements.length; i++) {
          const n = newsElements[i];
          const nTitle = n.getElementsByTagNameNS("*", "news_item_title")[0]?.textContent;
          const nUrl = n.getElementsByTagNameNS("*", "news_item_url")[0]?.textContent;
          const nSource = n.getElementsByTagNameNS("*", "news_item_source")[0]?.textContent;
          const nSnippet = n.getElementsByTagNameNS("*", "news_item_snippet")[0]?.textContent;

          if (nTitle && nUrl) {
            const linkObj = { title: `[${nSource || 'News'}] ${nTitle}`, url: nUrl };
            if (nUrl.includes('youtube.com') || nUrl.includes('youtu.be')) {
              videoLinks.push(linkObj);
            } else {
              newsLinks.push(linkObj);
            }
          }
          if (i === 0) summaryContext = nSnippet || nTitle;
        }

        trends.push({ 
          title, 
          growth: traffic, 
          analysis: summaryContext ? summaryContext.replace(/<[^>]*>?/gm, '') : "Trend analysis loading...",
          newsLinks, 
          videoLinks 
        });
      });
      return trends;
    } catch (e) { return []; }
  }

  getCountries() {
    return [
      { code: 'KR', name: 'Korea', flag: '🇰🇷' },
      { code: 'JP', name: 'Japan', flag: '🇯🇵' },
      { code: 'US', name: 'USA', flag: '🇺🇸' }
    ];
  }

  getLanguages() {
    return [
      { code: 'ko', name: '한국어', flag: '🇰🇷' },
      { code: 'ja', name: '日本語', flag: '🇯🇵' },
      { code: 'en', name: 'English', flag: '🇺🇸' }
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
  ko: { title: "실시간 인기 트렌드", update: "최근 업데이트", summary: "트렌드 요약 및 분석", news: "관련 기사", videos: "관련 영상 소식", infoTitle: "TrendUp 정보", infoDesc: "실시간 급상승 키워드를 한눈에 확인하세요.", loading: "데이터 로딩 중...", youtubeSearch: "YouTube 검색 결과" },
  ja: { title: "リアルタイムトレンド", update: "最終更新", summary: "トレンド分析", news: "関連記事", videos: "関連動画・ニュース", infoTitle: "TrendUpについて", infoDesc: "急上昇ワード를 실시간으로 체크.", loading: "読み込み中...", youtubeSearch: "YouTube検索結果" },
  en: { title: "Trending Now", update: "Last Updated", summary: "Trend Analysis", news: "News Articles", videos: "Related Videos", infoTitle: "About TrendUp", infoDesc: "Stay updated with real-time trends.", loading: "Loading...", youtubeSearch: "Search on YouTube" }
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
        .modal { background: var(--bg); width: 95%; max-width: 550px; max-height: 90vh; border-radius: 20px; padding: 2rem; border: 1px solid var(--border); box-shadow: var(--shadow-hover); overflow-y: auto; position: relative; }
        .close { position: absolute; top: 1rem; right: 1rem; cursor: pointer; border: none; background: none; font-size: 1.5rem; color: var(--text); }
        .title { font-size: 1.75rem; font-weight: 800; margin-bottom: 1rem; color: var(--text); }
        .section-title { font-weight: 800; color: var(--primary); margin: 1.5rem 0 0.5rem; display: block; font-size: 0.9rem; text-transform: uppercase; }
        .text { line-height: 1.7; color: var(--text); margin-bottom: 1rem; font-size: 1.05rem; }
        .link-group { display: flex; flex-direction: column; gap: 0.5rem; }
        .link { padding: 0.8rem 1rem; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; text-decoration: none; color: var(--text); font-size: 0.9rem; display: flex; align-items: center; gap: 0.5rem; transition: 0.2s; }
        .link:hover { border-color: var(--primary); background: var(--border); }
        .system-link { background: oklch(0.6 0.2 20 / 0.1); border-color: oklch(0.6 0.2 20 / 0.3); font-weight: 600; }
      </style>
      <div class="overlay">
        <div class="modal">
          <button class="close">&times;</button>
          <h2 class="title">${trend.title}</h2>
          <span class="section-title">✨ ${t.summary}</span>
          <p class="text">${trend.analysis}</p>
          
          <span class="section-title">📰 ${t.news}</span>
          <div class="link-group">
            ${trend.newsLinks.map(l => `<a href="${l.url}" target="_blank" class="link">📄 ${l.title}</a>`).join('')}
          </div>
          
          <span class="section-title">🎬 ${t.videos}</span>
          <div class="link-group">
            ${trend.videoLinks.map(l => `<a href="${l.url}" target="_blank" class="link ${l.isSystem ? 'system-link' : ''}">▶️ ${l.title}</a>`).join('')}
          </div>
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
    this.currentLang = localStorage.getItem('lang') || (this.currentCountry === 'KR' ? 'ko' : this.currentCountry === 'JP' ? 'ja' : 'en');
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

    this.renderNavs();
    await this.update();
    document.getElementById('top-trends').addEventListener('trend-click', e => this.modal.show(e.detail, this.currentLang));
    setInterval(() => this.update(), this.service.refreshInterval);
  }

  renderNavs() {
    const cNav = document.getElementById('country-nav');
    cNav.innerHTML = this.service.getCountries().map(c => `
      <button class="country-btn ${c.code === this.currentCountry ? 'active' : ''}" data-code="${c.code}">${c.flag} ${c.code}</button>
    `).join('');
    cNav.querySelectorAll('button').forEach(btn => btn.onclick = () => this.switchCountry(btn.dataset.code));

    const lNav = document.getElementById('lang-nav');
    lNav.innerHTML = this.service.getLanguages().map(l => `
      <button class="country-btn ${l.code === this.currentLang ? 'active' : ''}" data-code="${l.code}">${l.flag} ${l.code.toUpperCase()}</button>
    `).join('');
    lNav.querySelectorAll('button').forEach(btn => btn.onclick = () => this.switchLang(btn.dataset.code));
  }

  async switchCountry(code) {
    this.currentCountry = code;
    this.renderNavs();
    await this.update();
  }

  async switchLang(code) {
    this.currentLang = code;
    localStorage.setItem('lang', code);
    this.renderNavs();
    await this.update();
  }

  async update() {
    const trends = await this.service.getTrends(this.currentCountry);
    const t = i18n[this.currentLang] || i18n.en;
    document.getElementById('current-country-title').textContent = t.title;
    document.querySelector('.info-card h3').textContent = t.infoTitle;
    document.querySelector('.info-card p').textContent = t.infoDesc;
    document.getElementById('top-trends').data = { trends, lang: this.currentLang };
    const now = new Date();
    document.getElementById('last-updated').textContent = `${t.update}: ${now.toLocaleTimeString()}`;
  }
}

new App();
