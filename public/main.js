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
    } catch (e) { console.error("Three.js error:", e); }
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

// --- Localization (애드센스 승인을 위한 3개국어 대규모 보강) ---
let i18n = {
  ko: { 
    title: "실시간 글로벌 트렌드", update: "최근 업데이트", summary: "트렌드 분석 리포트", news: "주요 관련 뉴스", videos: "유튜브 미디어", loading: "데이터 분석 중...", T: "트렌드 설정", L: "언어 설정", original: "원문",
    pages: {
      about: { 
        title: "About TrendUp: 글로벌 트렌드 데이터 인텔리전스", 
        content: `
          <h2 style="margin-bottom:1.5rem;">전 세계의 흐름을 한눈에, TrendUp</h2>
          <p style="margin-bottom:1rem; line-height:1.8;">TrendUp은 빅데이터 처리 기술과 최신 인공지능(AI) 번역 엔진을 결합하여, 대한민국, 일본, 미국 등 주요 국가의 실시간 검색어와 급상승 트렌드를 정밀하게 추적하는 데이터 분석 플랫폼입니다.</p>
          
          <h3 style="margin:1.5rem 0 0.5rem; border-left:4px solid var(--primary); padding-left:0.8rem;">우리의 기술적 차별성</h3>
          <ul style="margin-bottom:1.5rem; padding-left:1.2rem; list-style:disc; line-height:1.8;">
            <li><strong>독자적인 데이터 파이프라인:</strong> Google Trends, Naver Signal, Yahoo Japan Realtime Search 등 각 지역별 신뢰도 높은 데이터를 10분 단위로 정규화합니다.</li>
            <li><strong>문맥 기반 AI 번역:</strong> 단순한 단어 대치를 넘어 해당 키워드가 왜 이슈가 되고 있는지 맥락을 파악하여 사용자의 언어로 최적화하여 제공합니다.</li>
            <li><strong>실시간 분석 모듈:</strong> 관련 뉴스와 소셜 미디어 반응을 종합하여 트렌드의 배경을 AI가 요약하여 리포트합니다.</li>
          </ul>
          
          <h3 style="margin:1.5rem 0 0.5rem; border-left:4px solid var(--primary); padding-left:0.8rem;">정보 민주화의 실현</h3>
          <p>언어의 장벽 때문에 놓쳤던 글로벌 이슈들을 이제 실시간으로 확인하세요. TrendUp은 마케터, 비즈니스 리더, 그리고 세상의 변화에 민감한 모든 사람들을 위한 최적의 도구입니다.</p>
        ` 
      },
      privacy: { 
        title: "개인정보 처리방침 (Privacy Policy)", 
        content: `
          <h2 style="margin-bottom:1.5rem;">개인정보 처리방침</h2>
          <p style="margin-bottom:1rem;">TrendUp(이하 '서비스')은 이용자의 개인정보를 매우 소중하게 생각하며, 관련 법령을 준수하기 위해 최선을 다하고 있습니다. 본 방침은 서비스 이용 과정에서 수집되는 정보의 종류와 이용 목적을 투명하게 안내합니다.</p>
          
          <h3 style="margin:1.5rem 0 0.5rem;">1. 수집하는 개인정보 항목</h3>
          <p>회원가입 없이 누구나 서비스를 이용할 수 있습니다. 다만 품질 개선 및 통계 분석을 위해 아래 정보가 자동 수집될 수 있습니다.</p>
          <ul style="margin-bottom:1rem; padding-left:1.2rem; list-style:disc;">
            <li>이용자의 IP 주소, 쿠키(Cookie), 접속 로그, 브라우저 정보, 운영체제(OS) 환경</li>
          </ul>
          
          <h3 style="margin:1.5rem 0 0.5rem;">2. 쿠키(Cookie) 및 구글 애드센스</h3>
          <p>본 사이트는 서비스 운영 비용 충당을 위해 구글 애드센스(Google AdSense) 광고를 게재합니다.</p>
          <ul style="margin-bottom:1rem; padding-left:1.2rem; list-style:disc;">
            <li>구글을 포함한 제3자 광고 파트너는 이용자의 과거 방문 기록을 바탕으로 쿠키를 사용하여 개인화된 맞춤 광고를 제공합니다.</li>
            <li>이용자는 <a href="https://www.google.com/settings/ads" target="_blank" style="color:var(--primary);">구글 광고 설정</a> 페이지를 통해 개인화 광고를 해제할 수 있습니다.</li>
          </ul>

          <h3 style="margin:1.5rem 0 0.5rem;">3. 데이터 보호 및 제3자 제공</h3>
          <p>우리는 수집된 익명 데이터를 외부에 판매하거나 상업적으로 유통하지 않습니다. 통계 목적 이외에는 사용되지 않으며 보안 정책에 따라 안전하게 관리됩니다.</p>
          <p style="margin-top:1rem; font-size:0.8rem; color:var(--text-muted);">발효일: 2026년 3월 1일 (v2.0.0)</p>
        ` 
      },
      terms: { 
        title: "서비스 이용약관 (Terms of Service)", 
        content: `
          <h2 style="margin-bottom:1.5rem;">서비스 이용약관</h2>
          <h3 style="margin:1.5rem 0 0.5rem;">제1조 (목적)</h3>
          <p>본 약관은 TrendUp 서비스가 제공하는 실시간 트렌드 분석 도구의 이용 조건 및 절차를 정의합니다.</p>
          
          <h3 style="margin:1.5rem 0 0.5rem;">제2조 (정보 제공 및 면책)</h3>
          <p>TrendUp이 제공하는 모든 데이터(순위, 분석 내용 등)는 포털 사이트의 공개 데이터를 알고리즘이 처리한 결과물입니다.</p>
          <ul style="margin-bottom:1rem; padding-left:1.2rem; list-style:disc;">
            <li>정보의 완전성, 정확성, 무결성에 대해 어떠한 법적 보증도 하지 않습니다.</li>
            <li>데이터 수집처의 서버 상태나 알고리즘 오류로 인해 정보가 누락되거나 지연될 수 있습니다.</li>
            <li>본 정보의 활용으로 발생하는 모든 유무형의 결과에 대한 책임은 이용자 본인에게 있습니다.</li>
          </ul>
          
          <h3 style="margin:1.5rem 0 0.5rem;">제3조 (저작권)</h3>
          <p>서비스의 독창적인 디자인, 분석 텍스트, 구성 방식에 대한 저작권은 TrendUp에 있습니다. 인용된 원문 뉴스 스니펫의 권리는 해당 원저작자에게 있습니다.</p>
        ` 
      },
      contact: { 
        title: "문의 및 고객 지원 (Contact)", 
        content: `
          <h2 style="margin-bottom:1.5rem;">고객 지원 센터</h2>
          <p>TrendUp 서비스 이용 중 겪으시는 불편함이나 제안 사항, 비즈니스 제휴 문의는 아래 채널을 통해 언제든 연락 주시기 바랍니다.</p>
          <div style="margin-top:2rem; padding:1.5rem; background:var(--surface); border-radius:16px; border:1px solid var(--border);">
            <p style="margin-bottom:0.5rem;"><strong>공식 이메일:</strong> help@trendup.ai</p>
            <p style="margin-bottom:0.5rem;"><strong>제휴 및 광고 문의:</strong> marketing@trendup.ai</p>
            <p><strong>운영 시간:</strong> 평일 09:00 - 18:00 (대한민국 표준시 기준)</p>
          </div>
          <p style="margin-top:1.5rem;">문의하신 내용은 영업일 기준 24시간 이내에 검토 후 회신해 드리고자 최선을 다하고 있습니다.</p>
        ` 
      }
    }
  },
  ja: { 
    title: "リアルタイムトレンド", update: "最終更新", summary: "分析レポート", news: "関連ニュース", videos: "YouTubeニュース", loading: "読み込み中...", original: "原文",
    pages: {
      about: { 
        title: "TrendUpについて: グローバルトレンド・インテリジェンス", 
        content: `<h2 style="margin-bottom:1.5rem;">世界の流れを瞬時に把握、TrendUp</h2><p style="line-height:1.8;">TrendUpは、ビッグデータ処理技術と最新のAI翻訳エンジンを組み合わせ、日本、韓国、米国などの主要国の検索トレンドをリアルタイムで分析・可視化するデータプラットフォームです。</p><h3 style="margin-top:1.5rem;">コア技術</h3><p>Google、Yahoo Japan、Naverなどの主要ポータルの公開データを10分ごとに正規化し、言語の壁なしに世界の潮流を理解できるようサポートします。</p>` 
      },
      privacy: { 
        title: "個人情報保護方針 (Privacy Policy)", 
        content: `<h2 style="margin-bottom:1.5rem;">個人情報保護方針</h2><p>TrendUp（以下「当サービス」）は、ユーザーの個人情報を尊重し、関連法規を遵守します。</p><h3>1. 収集情報</h3><p>アクセスログ、クッキー、ブラウザ情報などが統計分析や広告の最適化のために自動的に収集される場合があります。</p><h3>2. Google AdSense</h3><p>当サイトはGoogle AdSenseを使用しています。Googleなどの第三者配信事業者は、Cookieを使用してユーザーの過去のアクセス情報に基づいて広告を配信します。ユーザーはGoogleの広告設定でパーソナライズ広告を無効にできます。</p>` 
      },
      terms: { 
        title: "利用規約 (Terms of Service)", 
        content: `<h2>利用規約</h2><p>提供される全てのデータは参考用であり、完全性や正確性を保証するものではありません。情報の利用に関する最終的な責任はユーザーに帰属します。</p>` 
      },
      contact: { 
        title: "お問い合わせ (Contact)", 
        content: `<h2 style="margin-bottom:1.5rem;">サポートセンター</h2><p>サービスに関するお問い合わせは、以下のメールアドレスまでお願いいたします。</p><div style="margin-top:1rem; padding:1rem; background:var(--surface); border-radius:12px;"><p><strong>Email:</strong> help@trendup.ai</p></div>` 
      }
    }
  },
  en: { 
    title: "Global Trends", update: "Updated", summary: "Analysis Report", news: "Top Stories", videos: "YouTube News", loading: "Loading...", original: "Original",
    pages: {
      about: { 
        title: "About TrendUp: Global Trend Intelligence", 
        content: `<h2 style="margin-bottom:1.5rem;">Global Trends at a Glance, TrendUp</h2><p style="line-height:1.8;">TrendUp is a next-generation data intelligence platform that leverages advanced AI translation and data processing technologies to track real-time search trends across major nations including the US, Korea, and Japan.</p><h3 style="margin-top:1.5rem;">Our Methodology</h3><p>We normalize public indicators from Google Trends and regional portals every 10 minutes, providing contextual summaries using LLM technology to bridge the information gap across borders.</p>` 
      },
      privacy: { 
        title: "Privacy Policy", 
        content: `<h2 style="margin-bottom:1.5rem;">Privacy Policy</h2><p>TrendUp respects your privacy and is committed to protecting it. (v2.0.0)</p><h3>1. Information Collection</h3><p>We automatically collect technical data such as IP addresses, browser types, and access logs for statistical analysis and site improvement.</p><h3>2. Google AdSense</h3><p>We use Google AdSense to serve ads. Third-party vendors, including Google, use cookies to serve ads based on a user's prior visits to your website or other websites. You may opt out of personalized advertising by visiting Google Ads Settings.</p>` 
      },
      terms: { 
        title: "Terms of Service", 
        content: `<h2>Terms of Service</h2><p>All data and insights provided by TrendUp are for informational purposes only. We do not guarantee the absolute accuracy or timeliness of the information. Users assume full responsibility for any decisions made based on this data.</p>` 
      },
      contact: { 
        title: "Contact Us", 
        content: `<h2 style="margin-bottom:1.5rem;">Customer Support</h2><p>For any inquiries, feedback, or business proposals, please contact us via email.</p><div style="margin-top:1rem; padding:1rem; background:var(--surface); border-radius:12px;"><p><strong>Official Email:</strong> help@trendup.ai</p></div>` 
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
    console.log("App Init: v2.0.0");
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
        if (trendListEl) trendListEl.data = { trends, lang: this.currentLang };
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
      const titleEl = document.getElementById('current-country-title');
      if (titleEl) titleEl.textContent = t.title;
      const footerText = document.querySelector('.footer-content p');
      if (footerText) footerText.textContent = `© 2026 TrendUp. All rights reserved. (v2.0.0)`;
      document.querySelectorAll('.nav-label').forEach(label => {
        const text = label.textContent.toLowerCase();
        if (text.includes('trend')) label.textContent = t.labels?.trends || "Trends:";
        if (text.includes('lang')) label.textContent = t.labels?.language || "Language:";
      });
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
        const trendListEl = document.getElementById('top-trends');
        if (trendListEl) trendListEl.data = { trends, lang: this.currentLang };
        const date = dbData.lastUpdated.toDate();
        const lastUpdatedEl = document.getElementById('last-updated');
        if (lastUpdatedEl) lastUpdatedEl.textContent = `${t.update}: ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false})}`;
        localStorage.setItem(`trends_${this.currentCountry}`, JSON.stringify({ items: itemsMapped, previousItems: dbData.previousItems, lastUpdated: dbData.lastUpdated.toMillis() }));
      }
    } catch (e) { console.warn("Update failed:", e.message); }
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => new App());
else new App();
