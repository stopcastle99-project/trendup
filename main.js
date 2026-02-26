import * as THREE from 'three';

// --- Trend Service ---
class TrendService {
  constructor() {
    this.proxyUrl = 'https://api.allorigins.win/get?url=';
    this.refreshInterval = 15 * 60 * 1000;
  }

  async getTrends(country, targetLang) {
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

      const rawTrends = [];
      for (let i = 0; i < Math.min(items.length, 10); i++) {
        const item = items[i];
        const title = item.querySelector("title")?.textContent || "";
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

        videoLinks.push({
          title: `YouTube: '${title}'`,
          url: `https://www.youtube.com/results?search_query=${encodeURIComponent(title + " news")}`,
          isSystem: true
        });

        for (let j = 0; j < newsElements.length; j++) {
          const n = newsElements[j];
          const nTitle = n.getElementsByTagNameNS("*", "news_item_title")[0]?.textContent;
          const nUrl = n.getElementsByTagNameNS("*", "news_item_url")[0]?.textContent;
          const nSource = n.getElementsByTagNameNS("*", "news_item_source")[0]?.textContent;
          const nSnippet = n.getElementsByTagNameNS("*", "news_item_snippet")[0]?.textContent;

          if (nTitle && nUrl) {
            const linkObj = { title: `[${nSource || 'News'}] ${nTitle}`, url: nUrl };
            if (nUrl.includes('youtube.com') || nUrl.includes('youtu.be')) videoLinks.push(linkObj);
            else newsLinks.push(linkObj);
          }
          if (j === 0) summaryContext = nSnippet || nTitle;
        }

        rawTrends.push({ 
          title, 
          growth: traffic, 
          analysis: summaryContext ? summaryContext.replace(/<[^>]*>?/gm, '') : "...",
          newsLinks, 
          videoLinks 
        });
      }

      // Parallel Translation for all trends
      const translatedTrends = await Promise.all(rawTrends.map(async (t) => {
        const [translatedTitle, translatedAnalysis] = await Promise.all([
          this.translate(t.title, targetLang),
          this.translate(t.analysis, targetLang)
        ]);
        return { ...t, title: translatedTitle, analysis: translatedAnalysis };
      }));

      return translatedTrends;
    } catch (e) { return []; }
  }

  async translate(text, targetLang) {
    if (!text || text === "..." || targetLang === 'en') return text; // Google RSS often provides English context for JP/KR tags sometimes, but let's assume auto-detect
    try {
      const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`);
      const data = await res.json();
      return data[0].map(x => x[0]).join('');
    } catch (e) { return text; }
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
      { code: 'ko', name: 'KO', flag: '🇰🇷' },
      { code: 'ja', name: 'JA', flag: '🇯🇵' },
      { code: 'en', name: 'EN', flag: '🇺🇸' }
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
  ko: { title: "실시간 인기 트렌드", update: "최근 업데이트", summary: "트렌드 요약 및 분석", news: "관련 기사", videos: "관련 영상 소식", infoTitle: "TrendUp 정보", infoDesc: "실시간 급상승 키워드를 한눈에 확인하세요.", loading: "번역 및 로딩 중..." },
  ja: { title: "リアルタイムトレンド", update: "最終更新", summary: "トレンド分析", news: "関連記事", videos: "関連動画", infoTitle: "TrendUpについて", infoDesc: "急上昇ワード를 실시간으로 체크.", loading: "翻訳・読み込み中..." },
  en: { title: "Trending Now", update: "Last Updated", summary: "Trend Analysis", news: "News Articles", videos: "Related Videos", infoTitle: "About TrendUp", infoDesc: "Stay updated with real-time trends.", loading: "Translating..." }
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
          display: grid; grid-template-columns: 40px 1fr auto; align-items: center;
          background: var(--surface); padding: 1.25rem; border-radius: 12px;
          border: 1px solid var(--border); transition: all 0.2s; color: var(--text); cursor: pointer;
        }
        .item:hover { border-color: var(--primary); transform: scale(1.01); box-shadow: var(--shadow-hover); }
        .rank { font-size: 1.25rem; font-weight: 800; color: var(--primary); }
        .title { font-size: 1.05rem; font-weight: 700; padding-right: 1rem; }
        .growth { font-size: 0.8rem; font-weight: 700; color: oklch(0.6 0.15 140); background: oklch(0.6 0.15 140 / 0.1); padding: 0.2rem 0.5rem; border-radius: 6px; }
        .loading { text-align: center; padding: 3rem; color: var(--text-muted); font-weight: 600; }
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
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 2000; opacity: 0; pointer-events: none; transition: 0.3s; }
        .overlay.active { opacity: 1; pointer-events: auto; }
        .modal { background: var(--bg); width: 92%; max-width: 500px; max-height: 85vh; border-radius: 24px; padding: 2rem; border: 1px solid var(--border); box-shadow: var(--shadow-hover); overflow-y: auto; position: relative; }
        .close { position: absolute; top: 1rem; right: 1rem; cursor: pointer; border: none; background: var(--border); width: 32px; height: 32px; border-radius: 50%; font-size: 1.2rem; color: var(--text); }
        .title { font-size: 1.5rem; font-weight: 800; margin-bottom: 1.5rem; line-height: 1.3; color: var(--text); }
        .section-title { font-weight: 800; color: var(--primary); margin: 1.5rem 0 0.5rem; display: block; font-size: 0.85rem; text-transform: uppercase; }
        .text { line-height: 1.6; color: var(--text); margin-bottom: 1rem; font-size: 1rem; }
        .link-group { display: flex; flex-direction: column; gap: 0.5rem; }
        .link { padding: 0.75rem 1rem; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; text-decoration: none; color: var(--text); font-size: 0.85rem; display: flex; align-items: center; gap: 0.5rem; transition: 0.2s; }
        .link:hover { border-color: var(--primary); transform: translateY(-1px); }
      </style>
      <div class="overlay">
        <div class="modal">
          <button class="close">&times;</button>
          <h2 class="title">${trend.title}</h2>
          <span class="section-title">✨ ${t.summary}</span>
          <p class="text">${trend.analysis}</p>
          <span class="section-title">📰 ${t.news}</span>
          <div class="link-group">${trend.newsLinks.map(l => `<a href="${l.url}" target="_blank" class="link">📄 ${l.title}</a>`).join('')}</div>
          <span class="section-title">🎬 ${t.videos}</span>
          <div class="link-group">${trend.videoLinks.map(l => `<a href="${l.url}" target="_blank" class="link">▶️ ${l.title}</a>`).join('')}</div>
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
    
    // Close dropdowns on outside click
    window.addEventListener('click', () => {
      document.querySelectorAll('.pill-nav').forEach(n => n.classList.remove('expanded'));
    });

    setInterval(() => this.update(), this.service.refreshInterval);
  }

  renderNavs() {
    const renderGroup = (id, items, current, onSelect) => {
      const nav = document.getElementById(id);
      const activeItem = items.find(i => i.code === current);
      
      nav.innerHTML = `
        <button class="country-btn active">${activeItem.flag}</button>
        ${items.filter(i => i.code !== current).map(item => `
          <button class="country-btn" data-code="${item.code}">${item.flag}</button>
        `).join('')}
      `;
      
      nav.onclick = (e) => {
        e.stopPropagation();
        const wasExpanded = nav.classList.contains('expanded');
        document.querySelectorAll('.pill-nav').forEach(n => n.classList.remove('expanded'));
        if (!wasExpanded) nav.classList.add('expanded');
      };

      nav.querySelectorAll('button[data-code]').forEach(btn => btn.onclick = (e) => {
        e.stopPropagation();
        onSelect(btn.dataset.code);
        nav.classList.remove('expanded');
      });
    };

    renderGroup('country-nav', this.service.getCountries(), this.currentCountry, (code) => this.switchCountry(code));
    renderGroup('lang-nav', this.service.getLanguages(), this.currentLang, (code) => this.switchLang(code));
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
    // Show loading state
    document.getElementById('top-trends').data = { trends: [], lang: this.currentLang };
    
    const trends = await this.service.getTrends(this.currentCountry, this.currentLang);
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
