import * as THREE from 'three';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, Timestamp } from 'firebase/firestore';

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
    } catch (e) { console.error(e); }
  }
  init() {
    const geometry = new THREE.IcosahedronGeometry(1, 1);
    for (let i = 0; i < 40; i++) {
      const material = new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0xff4d4d : 0xffaa00, wireframe: true, transparent: true, opacity: 0.08 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20);
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      const scale = Math.random() * 0.4 + 0.1;
      mesh.scale.set(scale, scale, scale);
      this.scene.add(mesh);
      this.particles.push({ mesh, speed: Math.random() * 0.004 + 0.001, rot: Math.random() * 0.008 });
    }
  }
  onResize() { if (!this.renderer) return; this.renderer.setSize(window.innerWidth, window.innerHeight); this.camera.aspect = window.innerWidth / window.innerHeight; this.camera.updateProjectionMatrix(); }
  animate() { if (!this.renderer) return; requestAnimationFrame(() => this.animate()); this.particles.forEach(p => { p.mesh.rotation.x += p.rot; p.mesh.rotation.y += p.rot; p.mesh.position.y += p.speed; if (p.mesh.position.y > 10) p.mesh.position.y = -10; }); this.renderer.render(this.scene, this.camera); }
}

const ICONS = {
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" x1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" x1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" x1="18.36" x2="19.78" y2="19.78"></line><line x1="1" x1="12" x2="3" y2="12"></line><line x1="21" x1="12" x2="23" y2="12"></line><line x1="4.22" x1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" x1="5.64" x2="19.78" y2="4.22"></line></svg>`,
  moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`,
  system: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2v20"></path><path d="M12 7V17"></path><path d="M12 12h5"></path><path d="M12 2a10 10 0 0 0 0 20z" fill="currentColor" fill-opacity="0.3"></path></svg>`
};

// --- Localization (애드센스 통과용 고품질 콘텐츠) ---
let i18n = {
  ko: { 
    title: "실시간 글로벌 트렌드", update: "최근 업데이트", summary: "트렌드 분석 리포트", news: "주요 관련 뉴스", videos: "유튜브 미디어", loading: "데이터 분석 중...", T: "트렌드 설정", L: "언어 설정", original: "원문",
    pages: {
      about: { 
        title: "About TrendUp: 글로벌 트렌드 인텔리전스", 
        content: `
          <h2 style="margin-bottom:1.5rem;">세상을 읽는 가장 빠른 방법, TrendUp</h2>
          <p style="margin-bottom:1rem; line-height:1.8;">TrendUp은 빅데이터 처리 기술과 고도화된 인공지능(AI) 엔진을 결합하여 전 세계 주요 국가의 검색 흐름을 실시간으로 분석하고 시각화하는 프리미엄 데이터 플랫폼입니다.</p>
          <h3 style="margin:1.5rem 0 0.5rem; border-left:4px solid var(--primary); padding-left:0.8rem;">우리의 비전</h3>
          <p style="margin-bottom:1rem;">정보의 홍수 속에서 사용자에게 '진짜 가치'가 있는 인사이트를 선별하여 제공하는 것입니다.</p>
          <h3 style="margin:1.5rem 0 0.5rem; border-left:4px solid var(--primary); padding-left:0.8rem;">핵심 기술</h3>
          <ul style="margin-bottom:1rem; padding-left:1.2rem; list-style:disc; line-height:1.8;">
            <li><strong>초정밀 실시간 수집:</strong> 주요 플랫폼의 공개 API를 10분 단위로 정규화합니다.</li>
            <li><strong>AI 다국어 현지화:</strong> 언어 장벽 없이 로컬 트렌드를 이해할 수 있도록 최적화합니다.</li>
          </ul>
        ` 
      },
      privacy: { 
        title: "개인정보 처리방침 (Privacy Policy)", 
        content: `
          <h2 style="margin-bottom:1.5rem;">개인정보 처리방침</h2>
          <p style="margin-bottom:1rem;">TrendUp(v1.9.7)은 이용자의 개인정보를 소중히 다루며, 관련 법령을 철저히 준수합니다.</p>
          <h3>1. 수집하는 정보</h3>
          <p>접속 IP, 브라우저 정보, 쿠키 등이 통계 및 광고 최적화를 위해 자동 수집될 수 있습니다.</p>
          <h3>2. 구글 애드센스 광고</h3>
          <p>본 사이트는 구글 애드센스를 사용하며, Google은 쿠키를 사용하여 맞춤형 광고를 제공합니다. 이용자는 구글 광고 설정에서 이를 해제할 수 있습니다.</p>
        ` 
      },
      terms: { 
        title: "서비스 이용약관 (Terms of Service)", 
        content: `<h2>서비스 이용약관</h2><p>TrendUp이 제공하는 모든 데이터는 참고용이며, 정확성이나 완전성을 보장하지 않습니다. 본 데이터 사용에 따른 책임은 사용자에게 있습니다.</p>` 
      },
      contact: { 
        title: "문의 및 고객 지원 (Contact)", 
        content: `<h2 style="margin-bottom:1.5rem;">고객 지원</h2><p>서비스 관련 문의는 아래 메일로 연락 주시기 바랍니다.</p><div style="margin-top:1rem; padding:1rem; background:var(--surface); border-radius:12px;"><p><strong>Email:</strong> help@trendup.ai</p></div>` 
      }
    }
  },
  ja: { title: "リアルタイムトレンド", update: "最終更新", summary: "分析レポート", news: "関連ニュース", videos: "YouTubeニュース", loading: "読み込み中...", original: "原文" },
  en: { title: "Global Trends", update: "Updated", summary: "Analysis Report", news: "Top Stories", videos: "YouTube News", loading: "Loading...", original: "Original" }
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
  set data({ trends, lang }) { this.render(trends, lang); }
  render(trends, lang) {
    const t = i18n[lang] || i18n.en;
    const getTrendIcon = (dir) => {
      if (dir === 'up') return '<span style="color: #ff4d4d; font-weight: 900; font-size: 0.9rem;">↑</span>';
      if (dir === 'down') return '<span style="color: #4d79ff; font-weight: 900; font-size: 0.9rem;">↓</span>';
      if (dir === 'new') return '<span style="color: #ffaa00; font-size: 0.6rem; font-weight: 800; border: 1px solid #ffaa00; padding: 1px 4px; border-radius: 4px; letter-spacing: -0.02em;">NEW</span>';
      return '<span style="color: var(--text-muted); opacity: 0.3; font-size: 0.8rem;">-</span>';
    };
    this.shadowRoot.innerHTML = `<style>:host { display: block; } .list { display: flex; flex-direction: column; gap: 0.75rem; } .item { display: grid; grid-template-columns: 40px 1fr auto; align-items: center; background: var(--surface); padding: 1.2rem; border-radius: 16px; border: 1px solid var(--border); transition: 0.2s; color: var(--text); cursor: pointer; user-select: none; position: relative; z-index: 1; } .item:hover { border-color: var(--primary); transform: translateY(-2px); box-shadow: var(--shadow-hover); } .rank { font-size: 1.2rem; font-weight: 900; color: var(--primary); opacity: 0.8; } .title-group { display: flex; flex-direction: column; overflow: hidden; } .display-title { font-size: 1.05rem; font-weight: 700; padding-right: 0.5rem; line-height: 1.4; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; } .translated-subtitle { font-size: 0.75rem; color: var(--primary); opacity: 0.85; margin-top: 0.2rem; font-weight: 600; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; } .growth { font-size: 1.1rem; display: flex; align-items: center; justify-content: center; min-width: 45px; } .loading { text-align: center; padding: 4rem; color: var(--text-muted); font-size: 0.9rem; }</style>
      <div class="list">${(!trends || trends.length === 0) ? `<div class="loading">${t.loading}</div>` : trends.map((item, index) => {
        const mainTitle = item.originalTitle || item.title;
        const subTitle = item.translatedSubTitle || "";
        return `<div class="item" data-index="${index}"><span class="rank">${index + 1}</span><div class="title-group"><span class="display-title">${mainTitle}</span>${subTitle ? `<span class="translated-subtitle">✨ ${subTitle}</span>` : ''}</div><span class="growth">${getTrendIcon(item.trendDir)}</span></div>`;
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
    const analysis = trend.snippets?.[0] || t.analysisTemplate(trend.originalTitle, trend.sources, trend.snippets);
    this.render(trend, lang, analysis);
  }
  hide() { this.isVisible = false; this.shadowRoot.innerHTML = ''; }
  render(trend, lang, analysis) {
    const t = i18n[lang] || i18n.en;
    this.shadowRoot.innerHTML = `<style>.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 9999; cursor: pointer; } .modal { background: var(--bg); width: 92%; max-width: 500px; max-height: 85vh; border-radius: 24px; padding: 2rem; border: 1px solid var(--border); box-shadow: var(--shadow-hover); overflow-y: auto; position: relative; cursor: default; } .close { position: absolute; top: 1rem; right: 1rem; cursor: pointer; border: none; background: var(--border); width: 32px; height: 32px; border-radius: 50%; font-size: 1.2rem; color: var(--text); display: flex; align-items: center; justify-content: center; } .title { font-size: 1.4rem; font-weight: 800; margin-bottom: 1.5rem; color: var(--text); } .section-title { font-weight: 800; color: var(--primary); margin: 1.5rem 0 0.5rem; display: block; font-size: 0.8rem; text-transform: uppercase; } .text { line-height: 1.6; color: var(--text); margin-bottom: 1.5rem; font-size: 0.95rem; white-space: pre-wrap; } .link-group { display: flex; flex-direction: column; gap: 0.5rem; } .link { padding: 0.8rem 1rem; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; text-decoration: none; color: var(--text); font-size: 0.85rem; display: flex; flex-direction: column; } .link-meta { font-size: 0.7rem; font-weight: 800; color: var(--primary); opacity: 0.7; }</style>
      <div class="overlay"><div class="modal"><button class="close">&times;</button><h2 class="title">${trend.originalTitle || trend.title}</h2><span class="section-title">✨ ${t.summary}</span><p class="text">${analysis}</p><span class="section-title">📰 ${t.news}</span><div class="link-group">${(trend.newsLinks || []).slice(0,3).map(l => `<a href="${l.url}" target="_blank" class="link"><span class="link-meta">${l.source}</span><span>📄 ${l.title}</span></a>`).join('')}</div></div></div>`;
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
    this.scene = new BackgroundScene();
    this.currentCountry = this.service.autoDetectCountry();
    this.currentLang = localStorage.getItem('lang') || (this.currentCountry === 'KR' ? 'ko' : this.currentCountry === 'JP' ? 'ja' : 'en');
    this.themeMode = localStorage.getItem('theme-mode') || 'system';
    this.db = null;
    this.init();
  }
  async init() {
    console.log("App Init: v1.9.7");
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
      window.addEventListener('click', () => { document.querySelectorAll('.pill-nav').forEach(n => n.classList.remove('expanded')); document.getElementById('theme-dropdown')?.classList.add('hidden'); });
      this.startAsyncTasks();
      setInterval(() => this.update(), this.service.refreshInterval);
    } catch (e) { console.error("App init failed:", e); }
  }
  loadLocalCache() {
    try {
      const cached = localStorage.getItem(`trends_${this.currentCountry}`);
      if (cached) {
        const data = JSON.parse(cached);
        const trends = this.service.calculateRankChanges(data.items, data.previousItems);
        document.getElementById('top-trends').data = { trends, lang: this.currentLang };
      }
    } catch (e) {}
  }
  async startAsyncTasks() {
    try {
      const app = initializeApp(firebaseConfig);
      this.db = getFirestore(app);
      this.renderNavs();
      await this.update();
    } catch (e) { console.error("Firebase init failed:", e.message); }
  }
  refreshUIText() {
    try {
      const t = i18n[this.currentLang] || i18n.en;
      document.getElementById('current-country-title').textContent = t.title;
      document.querySelectorAll('.nav-label').forEach(label => {
        const text = label.textContent.toLowerCase();
        if (text.includes('trend')) label.textContent = t.labels.trends;
        if (text.includes('lang')) label.textContent = t.labels.language;
      });
      const footerText = document.querySelector('.footer-content p');
      if (footerText) footerText.textContent = `© 2026 TrendUp. All rights reserved. (v1.9.7)`;
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
    document.querySelectorAll('.theme-opt').forEach(opt => opt.classList.toggle('active', opt.dataset.theme === mode));
  }
  initSideMenu() {
    const toggle = document.getElementById('menu-toggle');
    const close = document.getElementById('menu-close');
    const overlay = document.getElementById('side-menu-overlay');
    const menu = document.getElementById('side-menu');
    if (!toggle || !menu) return;
    toggle.onclick = (e) => { e.stopPropagation(); menu.classList.add('active'); overlay.classList.remove('hidden'); };
    close.onclick = overlay.onclick = () => { menu.classList.remove('active'); overlay.classList.add('hidden'); };
  }
  initCookieBanner() {
    const banner = document.getElementById('cookie-banner');
    if (!banner || localStorage.getItem('cookies-accepted')) return;
    banner.classList.remove('hidden');
    banner.querySelector('button').onclick = () => { localStorage.setItem('cookies-accepted', 'true'); banner.classList.add('hidden'); };
  }
  initInfoModals() {
    const overlay = document.getElementById('info-modal');
    const body = document.getElementById('info-modal-body');
    document.querySelectorAll('.info-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const pageKey = link.getAttribute('data-page');
        const t = i18n[this.currentLang] || i18n.en;
        if (t.pages && t.pages[pageKey]) { body.innerHTML = t.pages[pageKey].content; overlay.classList.remove('hidden'); }
      });
    });
    const closeBtn = document.querySelector('.info-modal-close');
    if (closeBtn) closeBtn.onclick = () => overlay.classList.add('hidden');
    if (overlay) overlay.onclick = (e) => { if (e.target === overlay) overlay.classList.add('hidden'); };
  }
  renderNavs() {
    try {
      const renderGroup = (id, items, current, onSelect) => {
        const nav = document.getElementById(id);
        if (!nav) return;
        const activeItem = items.find(i => i.code === current);
        nav.innerHTML = `<button class="country-btn active">${activeItem.flag}</button>${items.filter(i => i.code !== current).map(item => `<button class="country-btn" data-code="${item.code}">${item.flag}</button>`).join('')}`;
        nav.onclick = (e) => { e.stopPropagation(); nav.classList.toggle('expanded'); };
        nav.querySelectorAll('button[data-code]').forEach(btn => btn.onclick = (e) => { e.stopPropagation(); onSelect(btn.dataset.code); nav.classList.remove('expanded'); });
      };
      renderGroup('country-nav', this.service.getCountries(), this.currentCountry, (code) => this.switchCountry(code));
      renderGroup('lang-nav', this.service.getLanguages(), this.currentLang, (code) => this.switchLang(code));
    } catch (e) {}
  }
  async switchCountry(code) { this.currentCountry = code; this.loadLocalCache(); this.renderNavs(); await this.update(); }
  async switchLang(code) { this.currentLang = code; localStorage.setItem('lang', code); this.renderNavs(); this.refreshUIText(); await this.update(); }
  
  async update() {
    if (!this.db) return;
    try {
      const t = i18n[this.currentLang] || i18n.en;
      const trendDoc = await getDoc(doc(this.db, 'trends', this.currentCountry));
      if (trendDoc.exists()) {
        const dbData = trendDoc.data();
        const itemsMapped = dbData.items.map(item => {
          const originalTitle = item.originalTitle || item.title;
          const translatedTitle = item.translations?.[this.currentLang] || originalTitle;
          return {
            ...item,
            displayTitle: originalTitle,
            translatedSubTitle: (translatedTitle !== originalTitle) ? translatedTitle : "",
            snippets: item.translatedSnippets?.[this.currentLang] || item.snippets || []
          };
        });
        const trends = this.service.calculateRankChanges(itemsMapped, dbData.previousItems);
        document.getElementById('top-trends').data = { trends, lang: this.currentLang };
        const date = dbData.lastUpdated.toDate();
        document.getElementById('last-updated').textContent = `${t.update}: ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false})}`;
        localStorage.setItem(`trends_${this.currentCountry}`, JSON.stringify({ items: itemsMapped, previousItems: dbData.previousItems, lastUpdated: dbData.lastUpdated.toMillis() }));
      }
    } catch (e) { console.warn("Update failed:", e.message); }
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => new App());
else new App();
