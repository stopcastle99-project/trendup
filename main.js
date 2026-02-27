import * as THREE from 'three';

// --- Background Animation (Three.js) ---
class BackgroundScene {
  constructor() {
    this.canvas = document.getElementById('bg-canvas');
    if (!this.canvas) return;
    
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      this.camera.position.z = 5;
      
      this.particles = [];
      this.init();
      this.animate();
      
      window.addEventListener('resize', () => this.onResize());
    } catch (e) {
      console.error("Three.js Init Error:", e);
    }
  }

  init() {
    const geometry = new THREE.IcosahedronGeometry(1, 1);
    for (let i = 0; i < 40; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xff4d4d : 0xffaa00,
        wireframe: true,
        transparent: true,
        opacity: 0.08
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20
      );
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      const scale = Math.random() * 0.4 + 0.1;
      mesh.scale.set(scale, scale, scale);
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        speed: Math.random() * 0.004 + 0.001,
        rot: Math.random() * 0.008
      });
    }
    this.onResize();
  }

  onResize() {
    if (!this.renderer) return;
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  animate() {
    if (!this.renderer) return;
    requestAnimationFrame(() => this.animate());
    this.particles.forEach(p => {
      p.mesh.rotation.x += p.rot;
      p.mesh.rotation.y += p.rot;
      p.mesh.position.y += p.speed;
      if (p.mesh.position.y > 10) p.mesh.position.y = -10;
    });
    this.renderer.render(this.scene, this.camera);
  }
}

// --- Trend Service ---
class TrendService {
  constructor() {
    this.proxyUrl = 'https://api.allorigins.win/get?url=';
    this.refreshInterval = 15 * 60 * 1000;
    this.cache = new Map();
    try {
      const saved = sessionStorage.getItem('trend_cache');
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.keys(parsed).forEach(k => this.cache.set(k, parsed[k]));
      }
    } catch (e) {}
  }

  saveCache() {
    try {
      const obj = {};
      this.cache.forEach((v, k) => { obj[k] = v; });
      sessionStorage.setItem('trend_cache', JSON.stringify(obj));
    } catch (e) {}
  }

  async getTrends(country, targetLang) {
    const rssUrl = `https://trends.google.com/trending/rss?geo=${country}`;
    const targetUrl = encodeURIComponent(rssUrl);
    
    try {
      const response = await fetch(`${this.proxyUrl}${targetUrl}`);
      const data = await response.json();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(data.contents, "text/xml");
      const items = xmlDoc.querySelectorAll("item");
      
      const rawTrends = [];
      const titlesToTranslate = [];

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
        const snippets = [];
        const sources = new Set();

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
            newsLinks.push({ title: `[${nSource || 'News'}] ${nTitle}`, url: nUrl });
            if (nSource) sources.add(nSource);
            const cleanSnippet = nSnippet ? nSnippet.replace(/<[^>]*>?/gm, '').trim() : "";
            if (cleanSnippet && cleanSnippet.length > 20) snippets.push(cleanSnippet);
            else if (nTitle) snippets.push(nTitle);
          }
        }

        rawTrends.push({ 
          title, 
          growth: traffic, 
          sources: Array.from(sources).slice(0, 3),
          snippets: snippets.slice(0, 3),
          newsLinks: newsLinks.slice(0, 5), 
          videoLinks 
        });
        titlesToTranslate.push(title);
      }

      const translatedTitles = await this.translateBatch(titlesToTranslate, targetLang);
      return rawTrends.map((t, i) => ({ ...t, title: translatedTitles[i] || t.title }));
    } catch (e) { 
      console.error("Fetch Trends Error:", e);
      return []; 
    }
  }

  async translateBatch(texts, targetLang) {
    if (!texts || texts.length === 0) return [];
    
    const results = texts.map(t => this.cache.get(`${targetLang}:${t}`));
    if (results.every(r => r !== undefined)) return results;

    const separator = " • "; 
    const combined = texts.join(separator);
    
    const singleTranslate = async (q, tl) => {
      try {
        const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${tl}&dt=t&q=${encodeURIComponent(q)}`);
        const data = await res.json();
        return data[0].map(x => x[0]).join('');
      } catch (e) { return q; }
    };

    const translated = await singleTranslate(combined, targetLang);
    let split = translated.split(/[•·\|]| \. /).map(s => s.trim()).filter(s => s.length > 0);
    
    if (split.length !== texts.length) {
      const individual = await Promise.all(texts.map(t => singleTranslate(t, targetLang)));
      split = individual;
    }
    
    const finalResults = texts.map((t, i) => {
      const res = split[i] || t;
      this.cache.set(`${targetLang}:${t}`, res);
      return res;
    });
    this.saveCache();
    return finalResults;
  }

  getCountries() {
    return [{ code: 'KR', flag: '🇰🇷' }, { code: 'JP', flag: '🇯🇵' }, { code: 'US', flag: '🇺🇸' }];
  }

  getLanguages() {
    return [{ code: 'ko', flag: '🇰🇷' }, { code: 'ja', flag: '🇯🇵' }, { code: 'en', flag: '🇺🇸' }];
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

const i18n = {
  ko: { 
    title: "실시간 인기 트렌드", update: "최근 업데이트", summary: "급상승 배경", news: "관련 기사", videos: "영상 소식", loading: "트렌드 분석 중...", T: "T", L: "L", 
    infoTitle: "TrendUp 정보", infoDesc: "다양한 국가의 실시간 급상승 키워드를 한눈에 확인하고 세상의 흐름을 읽어보세요.",
    analysisTemplate: (title, sources, snippets) => `현재 '${title}' 주제는 ${sources.join(', ')} 등 주요 매체를 통해 집중 보도되며 큰 화제가 되고 있습니다.\n\n${snippets.join('\n\n')}\n\n이러한 소식들이 다양한 채널을 통해 전해지면서 대중의 관심이 집중되어 실시간 트렌드에 올랐습니다.`
  },
  ja: { 
    title: "トレンド", update: "最終更新", summary: "急上昇の背景", news: "記事", videos: "動画", loading: "分析中...", T: "T", L: "L", 
    infoTitle: "TrendUpについて", infoDesc: "各国のリアルタイム急上昇キーワードをひと目で確認し、世界の潮流を把握しましょう。",
    analysisTemplate: (title, sources, snippets) => `現在「${title}」は、${sources.join('、')}などの主要メディアで集中的に報じられ、大きな話題となっています。\n\n${snippets.join('\n\n')}\n\nこれらのニュースが伝えられる中、世間の注目が集まり、リアルタイムトレンドに浮上しました。`
  },
  en: { 
    title: "Trending", update: "Updated", summary: "Trending Context", news: "News", videos: "Videos", loading: "Analyzing...", T: "T", L: "L", 
    infoTitle: "About TrendUp", infoDesc: "Explore real-time trending keywords from various countries and stay updated with global topics.",
    analysisTemplate: (title, sources, snippets) => `The topic '${title}' is currently gaining significant attention through major outlets such as ${sources.join(', ')}.\n\n${snippets.join('\n\n')}\n\nAs these reports circulate across various channels, public interest has surged, placing it on the real-time trending list.`
  }
};

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
          background: var(--surface); padding: 1.2rem; border-radius: 16px;
          border: 1px solid var(--border); transition: 0.2s; color: var(--text); cursor: pointer;
        }
        .item:hover { border-color: var(--primary); transform: translateY(-2px); box-shadow: var(--shadow-hover); }
        .rank { font-size: 1.2rem; font-weight: 900; color: var(--primary); opacity: 0.8; }
        .title { font-size: 1.05rem; font-weight: 700; padding-right: 0.5rem; line-height: 1.4; }
        .growth { font-size: 0.75rem; font-weight: 800; color: oklch(0.6 0.15 140); background: oklch(0.6 0.15 140 / 0.1); padding: 0.2rem 0.5rem; border-radius: 6px; }
        .loading { text-align: center; padding: 4rem; color: var(--text-muted); font-size: 0.9rem; }
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
  async show(trend, lang, service) {
    this.renderLoading();
    this.shadowRoot.querySelector('.overlay').classList.add('active');
    const itemsToTranslate = [...trend.snippets, ...trend.sources];
    const translatedItems = await service.translateBatch(itemsToTranslate, lang);
    const translatedSnippets = translatedItems.slice(0, trend.snippets.length);
    const translatedSources = translatedItems.slice(trend.snippets.length);
    const t = i18n[lang] || i18n.en;
    const analysis = t.analysisTemplate(trend.title, translatedSources, translatedSnippets);
    this.render(trend, lang, analysis);
  }
  hide() { this.shadowRoot.querySelector('.overlay').classList.remove('active'); }
  renderLoading() {
    this.shadowRoot.innerHTML = `
      <style>
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 5000; opacity: 0; pointer-events: none; transition: 0.3s; }
        .overlay.active { opacity: 1; pointer-events: auto; }
        .modal { background: var(--bg); width: 90%; max-width: 450px; border-radius: 24px; padding: 3rem 2rem; border: 1px solid var(--border); text-align: center; color: var(--text-muted); }
      </style>
      <div class="overlay"><div class="modal">Analyzing Trend...</div></div>
    `;
  }
  render(trend, lang, analysis) {
    const t = i18n[lang] || i18n.en;
    this.shadowRoot.innerHTML = `
      <style>
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 5000; opacity: 0; pointer-events: none; transition: 0.3s; }
        .overlay.active { opacity: 1; pointer-events: auto; }
        .modal { background: var(--bg); width: 92%; max-width: 500px; max-height: 80vh; border-radius: 24px; padding: 2rem; border: 1px solid var(--border); box-shadow: var(--shadow-hover); overflow-y: auto; position: relative; }
        .close { position: absolute; top: 1rem; right: 1rem; cursor: pointer; border: none; background: var(--border); width: 32px; height: 32px; border-radius: 50%; font-size: 1.2rem; color: var(--text); }
        .title { font-size: 1.4rem; font-weight: 800; margin-bottom: 1.5rem; color: var(--text); padding-right: 1.5rem; }
        .section-title { font-weight: 800; color: var(--primary); margin: 1.5rem 0 0.5rem; display: block; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; }
        .text { line-height: 1.6; color: var(--text); margin-bottom: 1.5rem; font-size: 0.95rem; white-space: pre-wrap; }
        .link-group { display: flex; flex-direction: column; gap: 0.5rem; }
        .link { padding: 0.8rem 1rem; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; text-decoration: none; color: var(--text); font-size: 0.85rem; display: flex; align-items: center; gap: 0.5rem; transition: 0.2s; }
        .link:hover { border-color: var(--primary); background: var(--border); }
      </style>
      <div class="overlay active">
        <div class="modal">
          <button class="close">&times;</button>
          <h2 class="title">${trend.title}</h2>
          <span class="section-title">✨ ${t.summary}</span>
          <p class="text">${analysis}</p>
          <span class="section-title">📰 ${t.news}</span>
          <div class="link-group">${trend.newsLinks.slice(0,3).map(l => `<a href="${l.url}" target="_blank" class="link">📄 ${l.title}</a>`).join('')}</div>
          <span class="section-title">🎬 ${t.videos}</span>
          <div class="link-group">${trend.videoLinks.map(l => `<a href="${l.url}" target="_blank" class="link">▶️ ${l.title}</a>`).join('')}</div>
        </div>
      </div>
    `;
    this.shadowRoot.querySelector('.close').onclick = () => this.hide();
    this.shadowRoot.querySelector('.overlay').onclick = (e) => { if (e.target === e.currentTarget) this.hide(); };
  }
}

customElements.define('trend-list', TrendList);
customElements.define('trend-modal', TrendModal);

class App {
  constructor() {
    this.service = new TrendService();
    this.scene = new BackgroundScene();
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
    this.initInfoModals();
    this.initCookieBanner();
    this.renderNavs();
    await this.update();
    document.getElementById('top-trends').addEventListener('trend-click', e => this.modal.show(e.detail, this.currentLang, this.service));
    window.addEventListener('click', () => document.querySelectorAll('.pill-nav').forEach(n => n.classList.remove('expanded')));
    setInterval(() => this.update(), this.service.refreshInterval);
  }
  initCookieBanner() {
    const banner = document.getElementById('cookie-banner');
    const acceptBtn = document.getElementById('accept-cookies');
    if (!localStorage.getItem('cookies-accepted')) banner.classList.remove('hidden');
    acceptBtn.onclick = () => { localStorage.setItem('cookies-accepted', 'true'); banner.classList.add('hidden'); };
  }
  initInfoModals() {
    const overlay = document.getElementById('info-modal');
    const body = document.getElementById('info-modal-body');
    const closeBtn = document.querySelector('.info-modal-close');
    const pages = {
      about: { title: "TrendUp 소개", content: `<h2>TrendUp 서비스 소개</h2><p>TrendUp은 실시간 글로벌 트렌드를 AI 기술로 분석하여 요약해주는 대시보드입니다.</p><h3>제공 정보</h3><ul><li>주요 국가 실시간 인기 검색어 TOP 10</li><li>뉴스 기반 트렌드 배경 요약</li><li>관련 뉴스 및 영상 링크</li></ul>` },
      privacy: { title: "개인정보처리방침", content: `<h2>개인정보처리방침</h2><p>개인 식별 정보를 수집하지 않으며, 서비스 개선을 위한 쿠키만 활용합니다.</p>` },
      terms: { title: "이용약관", content: `<h2>이용약관</h2><p>본 서비스에서 제공하는 정보의 정확성을 보장하지 않으며 이용에 따른 책임은 이용자에게 있습니다.</p>` },
      contact: { title: "문의하기", content: `<h2>문의하기</h2><p>이메일: help@trendup.ai</p>` }
    };
    document.querySelectorAll('.info-link').forEach(link => {
      link.onclick = (e) => {
        e.preventDefault();
        const pageKey = link.getAttribute('data-page');
        if (pages[pageKey]) { body.innerHTML = pages[pageKey].content; overlay.classList.remove('hidden'); }
      };
    });
    closeBtn.onclick = () => overlay.classList.add('hidden');
    overlay.onclick = (e) => { if (e.target === overlay) overlay.classList.add('hidden'); };
  }
  renderNavs() {
    try {
      const isMobile = window.innerWidth <= 600;
      const t = i18n[this.currentLang] || i18n.en;
      const renderGroup = (id, items, current, labelKey, onSelect) => {
        const nav = document.getElementById(id);
        if (!nav) return;
        const label = nav.parentElement.querySelector('.nav-label');
        if (label) label.textContent = isMobile ? t[labelKey] : (labelKey === 'T' ? 'Trends:' : 'Language:');
        const activeItem = items.find(i => i.code === current);
        if (!activeItem) return;
        nav.innerHTML = `<button class="country-btn active">${activeItem.flag}</button>${items.filter(i => i.code !== current).map(item => `<button class="country-btn" data-code="${item.code}">${item.flag}</button>`).join('')}`;
        nav.onclick = (e) => { e.stopPropagation(); const wasExpanded = nav.classList.contains('expanded'); document.querySelectorAll('.pill-nav').forEach(n => n.classList.remove('expanded')); if (!wasExpanded) nav.classList.add('expanded'); };
        nav.querySelectorAll('button[data-code]').forEach(btn => btn.onclick = (e) => { e.stopPropagation(); onSelect(btn.dataset.code); nav.classList.remove('expanded'); });
      };
      renderGroup('country-nav', this.service.getCountries(), this.currentCountry, 'T', (code) => this.switchCountry(code));
      renderGroup('lang-nav', this.service.getLanguages(), this.currentLang, 'L', (code) => this.switchLang(code));
    } catch (e) { console.error(e); }
  }
  async switchCountry(code) { this.currentCountry = code; this.renderNavs(); await this.update(); }
  async switchLang(code) { this.currentLang = code; localStorage.setItem('lang', code); this.renderNavs(); await this.update(); }
  async update() {
    try {
      const trends = await this.service.getTrends(this.currentCountry, this.currentLang);
      const t = i18n[this.currentLang] || i18n.en;
      if (document.getElementById('current-country-title')) document.getElementById('current-country-title').textContent = t.title;
      if (document.querySelector('.info-card h3')) document.querySelector('.info-card h3').textContent = t.infoTitle;
      if (document.querySelector('.info-card p')) document.querySelector('.info-card p').textContent = t.infoDesc;
      if (document.getElementById('top-trends')) document.getElementById('top-trends').data = { trends, lang: this.currentLang };
      if (document.getElementById('last-updated')) { const now = new Date(); document.getElementById('last-updated').textContent = `${t.update}: ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`; }
    } catch (e) { console.error(e); }
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => new App());
else new App();
