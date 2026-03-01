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
    this.onResize();
  }
  onResize() { if (!this.renderer) return; this.renderer.setSize(window.innerWidth, window.innerHeight); this.camera.aspect = window.innerWidth / window.innerHeight; this.camera.updateProjectionMatrix(); }
  animate() { if (!this.renderer) return; requestAnimationFrame(() => this.animate()); this.particles.forEach(p => { p.mesh.rotation.x += p.rot; p.mesh.rotation.y += p.rot; p.mesh.position.y += p.speed; if (p.mesh.position.y > 10) p.mesh.position.y = -10; }); this.renderer.render(this.scene, this.camera); }
}

// --- Icons ---
const ICONS = {
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" x1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`,
  moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`,
  system: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2v20"></path><path d="M12 7V17"></path><path d="M12 12h5"></path><path d="M12 2a10 10 0 0 0 0 20z" fill="currentColor" fill-opacity="0.3"></path></svg>`
};

// --- Localization (Cleaned & Perfected) ---
let i18n = {
  ko: { 
    title: "실시간 인기 트렌드", update: "최근 업데이트", summary: "분석 리포트", news: "관련 뉴스", videos: "유튜브 소식", loading: "데이터를 불러오는 중...", T: "트렌드 설정", L: "언어 설정", 
    original: "원문",
    countries: { KR: "대한민국", JP: "일본", US: "미국" },
    labels: { trends: "국가:", language: "언어:", site: "사이트 정보" },
    analysisTemplate: (title, sources, snippets) => snippets?.slice(0, 3).join(' ') || '상세 내용이 없습니다.',
    pages: {
      about: { 
        title: "TrendUp 소개", 
        content: `
          <h2 style="margin-bottom:1rem;">TrendUp: 차세대 글로벌 트렌드 인텔리전스</h2>
          <p style="margin-bottom:1rem;">TrendUp은 빅데이터 처리 기술과 최신 인공지능(AI) 번역 엔진을 결합하여, 전 세계 주요 국가(대한민국, 일본, 미국)의 실시간 검색어와 인기 트렌드를 한눈에 파악할 수 있도록 돕는 혁신적인 정보 플랫폼입니다.</p>
          <h3 style="margin:1.5rem 0 0.5rem;">우리의 미션</h3>
          <p>정보의 홍수 속에서 사용자에게 가장 시의성 있고 가치 있는 키워드를 선별하여 제공함으로써, 마케터, 콘텐츠 크리에이터, 그리고 트렌드에 민감한 모든 분들이 세상의 흐름을 놓치지 않도록 지원합니다.</p>
          <h3 style="margin:1.5rem 0 0.5rem;">핵심 기술</h3>
          <ul style="margin-bottom:1rem; padding-left:1.2rem; list-style:disc;">
            <li><strong>실시간 데이터 파이프라인:</strong> 구글 트렌드, 각국 주요 포털의 공개된 데이터를 밀리초 단위로 수집 및 정규화합니다.</li>
            <li><strong>AI 문맥 번역:</strong> 단순한 단어 번역을 넘어, 해당 키워드가 왜 이슈가 되고 있는지 문맥을 파악하여 사용자의 모국어로 자연스럽게 번역합니다.</li>
            <li><strong>데이터 시각화:</strong> 순위 변동 추이(상승, 하락, 신규 진입)를 직관적인 UI로 표현하여 트렌드의 강도를 즉시 알 수 있습니다.</li>
          </ul>
        ` 
      },
      privacy: { 
        title: "개인정보처리방침", 
        content: `
          <h2 style="margin-bottom:1rem;">개인정보처리방침</h2>
          <p style="margin-bottom:1rem;">TrendUp(이하 "서비스")은 이용자의 개인정보를 매우 소중히 다루며, "정보통신망 이용촉진 및 정보보호 등에 관한 법률" 등 모든 관련 법령을 철저히 준수하고 있습니다. 본 방침은 귀하가 본 서비스를 이용할 때 귀하의 정보가 어떻게 수집, 사용, 보호되는지에 대해 투명하게 설명합니다. (v1.9.1)</p>
          
          <h3 style="margin:1.5rem 0 0.5rem;">1. 수집하는 정보의 항목 및 수집 방법</h3>
          <p>본 서비스는 별도의 회원가입 절차 없이 누구나 자유롭게 이용할 수 있습니다. 다만, 서비스 이용 과정에서 다음과 같은 정보들이 자동으로 생성되어 수집될 수 있습니다.</p>
          <ul style="margin-bottom:1rem; padding-left:1.2rem; list-style:disc;">
            <li>이용자의 브라우저 종류 및 OS, 방문 일시, IP 주소, 쿠키(Cookie)</li>
            <li>서비스 내 이용 기록 및 검색 로그</li>
          </ul>
          
          <h3 style="margin:1.5rem 0 0.5rem;">2. 쿠키(Cookie)의 운용 및 거부</h3>
          <p>서비스는 이용자에게 최적화된 맞춤형 정보를 제공하기 위해 '쿠키'를 사용합니다. 쿠키는 웹사이트 서버가 이용자의 브라우저로 전송하는 소량의 데이터 파일입니다.</p>
          <p>이용자는 쿠키 설치에 대한 선택권을 가지고 있으며, 웹 브라우저의 옵션을 설정함으로써 모든 쿠키를 허용하거나, 쿠키가 저장될 때마다 확인을 거치거나, 아니면 모든 쿠키의 저장을 거부할 수 있습니다.</p>

          <h3 style="margin:1.5rem 0 0.5rem;">3. 구글 애드센스 (Google AdSense) 광고 게재</h3>
          <p>본 사이트는 서비스 운영 및 유지 비용을 충당하기 위해 구글 애드센스 광고 시스템을 사용하고 있습니다.</p>
          <ul style="margin-bottom:1rem; padding-left:1.2rem; list-style:disc;">
            <li>Google 및 제3자 광고 사업자는 쿠키를 사용하여 사용자의 과거 본 웹사이트 또는 다른 웹사이트 방문 기록을 토대로 맞춤형 광고를 제공합니다.</li>
            <li>사용자는 <a href="https://www.google.com/settings/ads" target="_blank" style="color:var(--primary);">광고 설정</a> 페이지를 방문하여 맞춤형 광고 게재를 위한 쿠키 사용을 거부할 수 있습니다.</li>
          </ul>
        ` 
      },
      terms: { 
        title: "이용약관", 
        content: `
          <h2 style="margin-bottom:1rem;">이용약관</h2>
          <h3 style="margin:1.5rem 0 0.5rem;">제1조 (목적)</h3>
          <p>본 약관은 TrendUp(이하 "회사" 또는 "서비스")이 제공하는 실시간 트렌드 정보 및 관련 제반 서비스의 이용조건 및 절차, 이용자와 회사의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.</p>
          
          <h3 style="margin:1.5rem 0 0.5rem;">제2조 (정보의 성격 및 면책)</h3>
          <p>본 서비스에서 제공하는 모든 트렌드 데이터, 순위, 뉴스 요약 정보는 주요 포털 사이트 및 검색 엔진의 공개된 데이터를 기반으로 알고리즘에 의해 자동 수집 및 재가공된 참고 자료입니다.</p>
          <ul style="margin-bottom:1rem; padding-left:1.2rem; list-style:disc;">
            <li>회사는 제공되는 정보의 완전성, 무결성, 정확성, 적시성을 보장하지 않습니다.</li>
            <li>본 서비스의 정보를 활용하여 발생한 투자 결과나 비즈니스 의사결정에 대한 책임은 전적으로 이용자 본인에게 있으며, 회사는 이에 대해 어떠한 법적 책임도 지지 않습니다.</li>
          </ul>
          
          <h3 style="margin:1.5rem 0 0.5rem;">제3조 (저작권의 귀속)</h3>
          <p>서비스가 자체적으로 작성한 콘텐츠(UI 디자인, AI 요약 텍스트 등)에 대한 저작권은 회사에 귀속됩니다. 다만, 원본 기사의 링크나 인용된 짧은 스니펫의 저작권은 해당 원저작자에게 있습니다.</p>
        ` 
      },
      contact: { title: "문의하기", content: `<h2 style="margin-bottom:1rem;">고객 지원 센터</h2><p>서비스 이용 중 발생하는 오류 제보, 광고 제휴 문의, 기타 건의 사항은 아래 이메일로 연락 주시기 바랍니다.</p><p style="margin-top:1rem; font-weight:bold;">Email: help@trendup.ai</p>` }
    }
  },
  ja: { 
    title: "リアルタイムトレンド", update: "最終更新", summary: "分析レポート", news: "関連ニュース", videos: "YouTubeニュース", loading: "読み込み中...", T: "トレンド設定", L: "言語設定", 
    original: "原文",
    countries: { KR: "韓国", JP: "日本", US: "アメリカ" },
    labels: { trends: "国:", language: "言語:", site: "사이트 안내" },
    analysisTemplate: (title, sources, snippets) => snippets?.slice(0, 3).join(' ') || '詳細がありません。',
    pages: {
      about: { title: "TrendUpについて", content: `<h2>TrendUpについて</h2><p>TrendUp은 빅데이터와 AI 기술을 활용하여 전 세계의 실시간 트렌드를 분석하고 시각화하는 차세대 정보 플랫폼입니다.</p>` },
      privacy: { title: "個人情報保護方針", content: `<h2>個人情報保護方針</h2><p>TrendUp（以下「当サービス」）は、ユーザーの個人情報を尊重し、関連法規を遵守します。(v1.9.1)</p><h3>Google AdSenseについて</h3><p>当サイト는 Google AdSenseを使用しています。Googleなどの第三者配信事業者は、Cookieを使用して、ユーザーが当サイトや他のウェブサイトに過去にアクセスした際の情報に基づいて広告を配信します。</p>` },
      terms: { title: "利用規約", content: `<h2>利用規約</h2><p>本サービスの利用条件、およびユーザーと運営者の権利・義務を規定します。提供される情報は参考用であり、完全性を保証するものではありません。</p>` },
      contact: { title: "お問い合わせ", content: `<h2>サポート</h2><p>メール: help@trendup.ai</p>` }
    }
  },
  en: { 
    title: "Global Trends", update: "Updated", summary: "Analysis Report", news: "Top Stories", videos: "YouTube News", loading: "Loading...", T: "Trend Settings", L: "Language Setting", 
    original: "Original",
    countries: { KR: "South Korea", JP: "Japan", US: "USA" },
    labels: { trends: "Country:", language: "Language:", site: "Site Info" },
    analysisTemplate: (title, sources, snippets) => snippets?.slice(0, 3).join(' ') || 'No snippets.',
    pages: {
      about: { 
        title: "About TrendUp", 
        content: `
          <h2 style="margin-bottom:1rem;">About TrendUp</h2>
          <p style="margin-bottom:1rem;">TrendUp is a next-generation intelligence platform that leverages big data and AI to analyze and visualize real-time global trends.</p>
          <h3 style="margin:1.5rem 0 0.5rem;">Core Technology</h3>
          <ul style="margin-bottom:1rem; padding-left:1.2rem; list-style:disc;">
            <li><strong>Real-time Data Pipeline:</strong> We collect and normalize public search data from Google Trends and major portals instantly.</li>
            <li><strong>AI Context Analysis:</strong> Our AI summarizes why a topic is trending by synthesizing news and context.</li>
          </ul>
        ` 
      },
      privacy: { 
        title: "Privacy Policy", 
        content: `
          <h2 style="margin-bottom:1rem;">Privacy Policy</h2>
          <p style="margin-bottom:1rem;">TrendUp respects your privacy. This policy explains how we handle your information. (v1.9.1)</p>
          <h3 style="margin:1.5rem 0 0.5rem;">Google AdSense</h3>
          <p>This site uses Google AdSense. Third party vendors, including Google, use cookies to serve ads based on a user's prior visits to your website or other websites.</p>
          <p>Users may opt out of personalized advertising by visiting <a href="https://www.google.com/settings/ads" target="_blank">Ads Settings</a>.</p>
        ` 
      },
      terms: { title: "Terms of Service", content: `<h2>Terms of Service</h2><p>These terms govern your use of TrendUp. The data provided is for informational purposes only, and we do not guarantee its absolute accuracy.</p>` },
      contact: { title: "Contact Us", content: `<h2>Customer Support</h2><p>Email: help@trendup.ai</p>` }
    }
  }
};

const firebaseConfig = { projectId: "test-76cdd" };

// --- Trend Service ---
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

// --- Web Components ---
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
    
    this.shadowRoot.innerHTML = `<style>:host { display: block; } .list { display: flex; flex-direction: column; gap: 0.75rem; } .item { display: grid; grid-template-columns: 40px 1fr auto; align-items: center; background: var(--surface); padding: 1.2rem; border-radius: 16px; border: 1px solid var(--border); transition: 0.2s; color: var(--text); cursor: pointer; user-select: none; position: relative; z-index: 1; } .item:hover { border-color: var(--primary); transform: translateY(-2px); box-shadow: var(--shadow-hover); } .rank { font-size: 1.2rem; font-weight: 900; color: var(--primary); opacity: 0.8; } .title-group { display: flex; flex-direction: column; overflow: hidden; } .display-title { font-size: 1.05rem; font-weight: 700; padding-right: 0.5rem; line-height: 1.4; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; } .original-title { font-size: 0.7rem; color: var(--primary); opacity: 0.7; margin-top: 0.2rem; font-weight: 600; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; } .growth { font-size: 1.1rem; display: flex; align-items: center; justify-content: center; min-width: 45px; } .loading { text-align: center; padding: 4rem; color: var(--text-muted); font-size: 0.9rem; }</style>
      <div class="list">${(!trends || trends.length === 0) ? `<div class="loading">${t.loading}</div>` : trends.map((item, index) => {
        const mainTitle = item.displayTitle || item.originalTitle || item.title;
        const subTitle = (item.originalTitle && item.displayTitle !== item.originalTitle) ? `✨ ${t.original}: ${item.originalTitle}` : "";
        return `<div class="item" data-index="${index}"><span class="rank">${index + 1}</span><div class="title-group"><span class="display-title">${mainTitle}</span>${subTitle ? `<span class="original-title">${subTitle}</span>` : ''}</div><span class="growth">${getTrendIcon(item.trendDir)}</span></div>`;
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
    const analysis = trend.snippets?.[0] || t.analysisTemplate(trend.displayTitle, trend.sources, trend.snippets);
    this.render(trend, lang, analysis);
  }
  hide() { this.isVisible = false; this.shadowRoot.innerHTML = ''; }
  render(trend, lang, analysis) {
    const t = i18n[lang] || i18n.en;
    this.shadowRoot.innerHTML = `<style>.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 9999; } .modal { background: var(--bg); width: 92%; max-width: 500px; max-height: 85vh; border-radius: 24px; padding: 2rem; border: 1px solid var(--border); box-shadow: var(--shadow-hover); overflow-y: auto; position: relative; } .close { position: absolute; top: 1rem; right: 1rem; cursor: pointer; border: none; background: var(--border); width: 32px; height: 32px; border-radius: 50%; font-size: 1.2rem; color: var(--text); } .title { font-size: 1.4rem; font-weight: 800; margin-bottom: 1.5rem; color: var(--text); } .section-title { font-weight: 800; color: var(--primary); margin: 1.5rem 0 0.5rem; display: block; font-size: 0.8rem; text-transform: uppercase; } .text { line-height: 1.6; color: var(--text); margin-bottom: 1.5rem; font-size: 0.95rem; white-space: pre-wrap; } .link-group { display: flex; flex-direction: column; gap: 0.5rem; } .link { padding: 0.8rem 1rem; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; text-decoration: none; color: var(--text); font-size: 0.85rem; display: flex; flex-direction: column; } .link-meta { font-size: 0.7rem; font-weight: 800; color: var(--primary); opacity: 0.7; }</style>
      <div class="overlay"><div class="modal"><button class="close">&times;</button><h2 class="title">${trend.displayTitle || trend.title}</h2><span class="section-title">✨ ${t.summary}</span><p class="text">${analysis}</p><span class="section-title">📰 ${t.news}</span><div class="link-group">${(trend.newsLinks || []).slice(0,3).map(l => `<a href="${l.url}" target="_blank" class="link"><span class="link-meta">${l.source}</span><span>📄 ${l.title}</span></a>`).join('')}</div></div></div>`;
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
    this.themeMode = localStorage.getItem('theme-mode') || 'system';
    this.db = null;
    this.init();
  }
  async init() {
    console.log("App Init: v1.9.1");
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
      if (footerText) footerText.textContent = `© 2026 TrendUp. All rights reserved. (v1.9.1)`;
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
    document.querySelector('.info-modal-close').onclick = () => overlay.classList.add('hidden');
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
            displayTitle: translatedTitle,
            originalTitle: originalTitle,
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
