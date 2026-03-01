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
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`,
  moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`,
  system: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2v20"></path><path d="M12 7V17"></path><path d="M12 12h5"></path><path d="M12 2a10 10 0 0 0 0 20z" fill="currentColor" fill-opacity="0.3"></path></svg>`
};

// --- Localization (Cleaned & Perfected) ---
let i18n = {
  ko: { 
    title: "실시간 인기 트렌드", update: "최근 업데이트", summary: "분석 리포트", news: "관련 뉴스", videos: "유튜브 소식", loading: "트렌드 분석 중...", analyzing: "상세 내용 분석 중...", T: "트렌드 설정", L: "언어 설정", 
    cookie: "본 사이트는 사용자 경험 개선을 위해 쿠키를 사용합니다.", accept: "확인",
    siteGuide: "사이트 안내", menuAbout: "TrendUp 소개", menuPrivacy: "개인정보처리방침", menuTerms: "이용약관", menuContact: "문의하기",
    countries: { KR: "대한민국", JP: "일본", US: "미국" },
    themes: { light: "밝게", dark: "어둡게", system: "시스템" },
    labels: { trends: "국가:", language: "언어:", site: "사이트 정보" },
    sysLinks: { search: "구글 검색", video: "관련 영상 확인" },
    analysisTemplate: (title, sources, snippets) => {
      if (!snippets || snippets.length === 0) return `'${title}' 주제가 현재 검색 포털을 통해 빠르게 확산되며 대중의 큰 관심을 받고 있습니다.`;
      const cleanSnippets = Array.from(new Set(snippets.map(s => s.trim()))).filter(s => s.length > 20);
      const mainSummary = cleanSnippets.slice(0, 3).join(' ');
      const sourceInfo = (sources && sources.length > 0) ? `\n\n[보도 매체: ${sources.slice(0, 3).join(', ')} 등]` : "";
      return `${mainSummary}${sourceInfo}`;
    },
    pages: {
      about: { 
        title: "TrendUp 소개", 
        content: `
          <h2 style="margin-bottom:1rem;">TrendUp: 글로벌 트렌드 인사이트 플랫폼</h2>
          <p style="margin-bottom:1rem;">TrendUp은 빅데이터와 AI 기술을 활용하여 전 세계의 실시간 트렌드를 분석하고 시각화하는 차세대 정보 플랫폼입니다. 우리는 정보의 홍수 속에서 사용자에게 가장 가치 있고 시의성 있는 키워드를 선별하여 제공하는 것을 목표로 합니다.</p>
          <h3 style="margin:1.5rem 0 0.5rem;">핵심 기술 및 방법론</h3>
          <ul style="margin-bottom:1rem; padding-left:1.2rem; list-style:disc;">
            <li><strong>실시간 데이터 파이프라인:</strong> 구글 트렌드, 주요 포털 사이트의 검색 데이터를 실시간으로 수집하여 중복을 제거하고 정규화합니다.</li>
            <li><strong>AI 문맥 분석:</strong> 수집된 키워드가 왜 화제가 되고 있는지, 관련 뉴스와 소셜 미디어 반응을 종합하여 AI가 요약 리포트를 생성합니다.</li>
            <li><strong>다국어 지원:</strong> 한국, 미국, 일본 등 주요 국가의 트렌드를 언어 장벽 없이 이해할 수 있도록 자동 번역 및 현지화 기능을 제공합니다.</li>
          </ul>
          <p>TrendUp을 통해 세상의 흐름을 읽고, 비즈니스 인사이트를 얻거나 대화의 주제를 선점하세요. 우리는 지속적으로 알고리즘을 개선하여 데이터의 정확도를 높이고 있습니다.</p>
        ` 
      },
      privacy: { 
        title: "개인정보처리방침", 
        content: `
          <h2 style="margin-bottom:1rem;">개인정보처리방침</h2>
          <p style="margin-bottom:1rem;">TrendUp(이하 "서비스")은 이용자의 개인정보를 소중히 다루며, "정보통신망 이용촉진 및 정보보호 등에 관한 법률"을 준수하고 있습니다. 본 방침은 귀하가 서비스를 이용할 때 귀하의 정보가 어떻게 수집, 사용, 보호되는지 설명합니다. (v1.6.6)</p>
          
          <h3 style="margin:1.5rem 0 0.5rem;">1. 수집하는 개인정보 항목</h3>
          <p>서비스는 회원가입 없이 이용 가능하며, 기본적인 서비스 제공을 위해 쿠키(Cookie) 및 이용 기록(접속 로그, 접속 IP 정보)을 자동으로 수집할 수 있습니다. 이는 서비스 품질 향상 및 통계 분석을 위해 사용됩니다.</p>
          
          <h3 style="margin:1.5rem 0 0.5rem;">2. 쿠키(Cookie)의 운용 및 거부</h3>
          <p>서비스는 이용자에게 개별적인 맞춤 서비스를 제공하기 위해 이용정보를 저장하고 수시로 불러오는 '쿠키'를 사용합니다.</p>
          <ul style="margin-bottom:1rem; padding-left:1.2rem; list-style:disc;">
            <li>쿠키는 웹사이트를 운영하는데 이용되는 서버가 이용자의 브라우저에 보내는 소량의 정보이며 이용자 컴퓨터의 하드디스크에 저장되기도 합니다.</li>
            <li>이용자는 쿠키 설치에 대한 선택권을 가지고 있습니다. 웹브라우저 옵션 설정을 통해 모든 쿠키를 허용하거나, 쿠키가 저장될 때마다 확인을 거치거나, 모든 쿠키의 저장을 거부할 수 있습니다.</li>
          </ul>

          <h3 style="margin:1.5rem 0 0.5rem;">3. 구글 애드센스 (Google AdSense) 광고</h3>
          <p>본 사이트는 수익 창출을 위해 구글 애드센스 광고를 게재하고 있습니다.</p>
          <ul style="margin-bottom:1rem; padding-left:1.2rem; list-style:disc;">
            <li>Google 및 제3자 벤더는 쿠키를 사용하여 사용자의 본 웹사이트 또는 다른 웹사이트 방문 기록을 기반으로 광고를 게재합니다.</li>
            <li>Google의 광고 쿠키 사용으로 Google 및 파트너는 사용자의 본 사이트 방문 또는 인터넷의 다른 사이트 방문 기록을 기반으로 사용자에게 적절한 광고를 게재할 수 있습니다.</li>
            <li>사용자는 <a href="https://www.google.com/settings/ads" target="_blank">광고 설정</a>을 방문하여 맞춤형 광고를 선택 해제할 수 있습니다.</li>
          </ul>
        ` 
      },
      terms: { 
        title: "이용약관", 
        content: `
          <h2 style="margin-bottom:1rem;">이용약관</h2>
          <h3 style="margin:1.5rem 0 0.5rem;">제1조 (목적)</h3>
          <p>본 약관은 TrendUp(이하 "회사")이 제공하는 트렌드 정보 서비스의 이용조건 및 절차, 이용자와 회사의 권리, 의무, 책임사항을 규정함을 목적으로 합니다.</p>
          
          <h3 style="margin:1.5rem 0 0.5rem;">제2조 (서비스의 제공)</h3>
          <p>회사는 다음과 같은 서비스를 제공합니다.</p>
          <ul style="margin-bottom:1rem; padding-left:1.2rem; list-style:disc;">
            <li>국가별 실시간 검색어 순위 정보 제공</li>
            <li>키워드 관련 뉴스 및 미디어 콘텐츠 큐레이션</li>
            <li>AI 기반 트렌드 요약 정보</li>
          </ul>
          
          <h3 style="margin:1.5rem 0 0.5rem;">제3조 (면책 조항)</h3>
          <p>회사가 제공하는 트렌드 정보는 검색 엔진 및 포털의 공개 데이터를 기반으로 자동 수집/분석된 참고 자료입니다. 회사는 해당 정보의 완전성, 정확성, 신뢰성에 대해 보증하지 않으며, 이를 활용하여 발생한 결과에 대해 법적 책임을 지지 않습니다.</p>
        ` 
      },
      contact: { title: "문의하기", content: `<h2 style="margin-bottom:1rem;">고객 지원</h2><p>서비스 이용 중 발생하는 오류 제보나 제휴 문의는 아래 이메일로 연락 주시기 바랍니다.</p><p style="margin-top:1rem; font-weight:bold;">Email: help@trendup.ai</p>` }
    }
  },
  ja: { 
    title: "リアルタイムトレンド", update: "最終更新", summary: "分析レポート", news: "関連ニュース", videos: "YouTubeニュース", loading: "トレンド分析中...", analyzing: "詳細分析中...", T: "トレンド設定", L: "言語設定", 
    cookie: "本サイトはユーザー体験向上のためにクッキーを使用しています。", accept: "了解",
    siteGuide: "サイト案内", menuAbout: "TrendUpについて", menuPrivacy: "個人情報保護方針", menuTerms: "利用規約", menuContact: "お問い合わせ",
    countries: { KR: "韓国", JP: "日本", US: "アメリカ" },
    themes: { light: "ライト", dark: "ダーク", system: "システム" },
    labels: { trends: "国:", language: "言語:", site: "サイト案内" },
    sysLinks: { search: "Google検索", video: "関連動画を確認" },
    analysisTemplate: (title, sources, snippets) => {
      if (!snippets || snippets.length === 0) return `「${title}」が現在、検索ポータルを通じて急速に拡散され、大きな注目を集めています。`;
      const cleanSnippets = Array.from(new Set(snippets.map(s => s.trim()))).filter(s => s.length > 10);
      const mainSummary = cleanSnippets.slice(0, 3).join(' ');
      const sourceInfo = (sources && sources.length > 0) ? `\n\n[報道メディア: ${sources.slice(0, 3).join('、')} など]` : "";
      return `${mainSummary}${sourceInfo}`;
    },
    pages: {
      about: { 
        title: "TrendUpについて", 
        content: `
          <h2 style="margin-bottom:1rem;">TrendUp: グローバルトレンド・インサイト</h2>
          <p style="margin-bottom:1rem;">TrendUpは、ビッグデータとAI技術を活用して世界中のリアルタイムトレンドを分析・可視化する次世代情報プラットフォームです。</p>
          <h3 style="margin:1.5rem 0 0.5rem;">コア技術</h3>
          <ul style="margin-bottom:1rem; padding-left:1.2rem; list-style:disc;">
            <li><strong>リアルタイムデータ:</strong> Googleトレンドや主要ポータルの検索データをリアルタイムで収集・正規化します。</li>
            <li><strong>AI文脈分析:</strong> なぜそのキーワードが話題なのか、関連ニュースや反応をAIが統合・要約します。</li>
          </ul>
        ` 
      },
      privacy: { 
        title: "個人情報保護方針", 
        content: `
          <h2 style="margin-bottom:1rem;">個人情報保護方針</h2>
          <p style="margin-bottom:1rem;">TrendUp（以下「当サービス」）は、ユーザーの個人情報を尊重し、関連法規を遵守します。(v1.6.6)</p>
          <h3 style="margin:1.5rem 0 0.5rem;">1. 収集情報とクッキー</h3>
          <p>当サービスはサービス向上のため、アクセスログやクッキー(Cookie)を使用する場合があります。</p>
          <h3 style="margin:1.5rem 0 0.5rem;">2. Google AdSenseについて</h3>
          <p>当サイトはGoogle AdSenseを使用しています。Googleなどの第三者配信事業者は、Cookieを使用して、ユーザーが当サイトや他のウェブサイトに過去にアクセスした際の情報に基づいて広告を配信します。</p>
          <p>ユーザーは<a href="https://www.google.com/settings/ads" target="_blank">広告設定</a>でパーソナライズ広告を無効にできます。</p>
        ` 
      },
      terms: { title: "利用規約", content: `<h2>利用規約</h2><p>本サービスの利用条件、およびユーザーと運営者の権利・義務を規定します。提供される情報は参考用であり、完全性を保証するものではありません。</p>` },
      contact: { title: "お問い合わせ", content: `<h2>サポート</h2><p>メール: help@trendup.ai</p>` }
    }
  },
  en: { 
    title: "Global Trends", update: "Updated", summary: "Analysis Report", news: "Top Stories", videos: "YouTube News", loading: "Analyzing...", analyzing: "Analyzing context...", T: "Trend Settings", L: "Language Setting", 
    cookie: "This site uses cookies to improve user experience.", accept: "Accept",
    siteGuide: "Site Information", menuAbout: "About TrendUp", menuPrivacy: "Privacy Policy", menuTerms: "Terms of Service", menuContact: "Contact Us",
    countries: { KR: "South Korea", JP: "Japan", US: "USA" },
    themes: { light: "Light", dark: "Dark", system: "System" },
    labels: { trends: "Country:", language: "Language:", site: "Site Information" },
    sysLinks: { search: "Google Search", video: "Check Related Videos" },
    analysisTemplate: (title, sources, snippets) => {
      if (!snippets || snippets.length === 0) return `The topic '${title}' is currently gaining significant traction across major portals.`;
      const cleanSnippets = Array.from(new Set(snippets.map(s => s.trim()))).filter(s => s.length > 10);
      const mainSummary = cleanSnippets.slice(0, 3).join(' ');
      const sourceInfo = (sources && sources.length > 0) ? `\n\n[Sources: ${sources.slice(0, 3).join(', ')}]` : "";
      return `${mainSummary}${sourceInfo}`;
    },
    pages: {
      about: { 
        title: "About TrendUp", 
        content: `
          <h2 style="margin-bottom:1rem;">About TrendUp</h2>
          <p style="margin-bottom:1rem;">TrendUp is a next-generation intelligence platform that leverages big data and AI to analyze and visualize real-time global trends.</p>
          <h3 style="margin:1.5rem 0 0.5rem;">Methodology</h3>
          <ul style="margin-bottom:1rem; padding-left:1.2rem; list-style:disc;">
            <li><strong>Real-time Aggregation:</strong> We collect and normalize search data from Google Trends and major portals instantly.</li>
            <li><strong>AI Analysis:</strong> Our AI summarizes why a topic is trending by synthesizing news and context.</li>
          </ul>
        ` 
      },
      privacy: { 
        title: "Privacy Policy", 
        content: `
          <h2 style="margin-bottom:1rem;">Privacy Policy</h2>
          <p style="margin-bottom:1rem;">TrendUp respects your privacy. This policy explains how we handle your information. (v1.6.6)</p>
          <h3 style="margin:1.5rem 0 0.5rem;">1. Cookies & Data</h3>
          <p>We may use cookies and access logs to improve service quality and analyze traffic.</p>
          <h3 style="margin:1.5rem 0 0.5rem;">2. Google AdSense</h3>
          <p>This site uses Google AdSense. Third party vendors, including Google, use cookies to serve ads based on a user's prior visits to your website or other websites.</p>
          <p>Users may opt out of personalized advertising by visiting <a href="https://www.google.com/settings/ads" target="_blank">Ads Settings</a>.</p>
        ` 
      },
      terms: { title: "Terms of Service", content: `<h2>Terms of Service</h2><p>These terms govern your use of TrendUp. The data provided is for informational purposes only, and we do not guarantee its absolute accuracy.</p>` },
      contact: { title: "Contact Us", content: `<h2>Customer Support</h2><p>Email: help@trendup.ai</p>` }
    }
  }
};

// --- Firebase Configuration ---
const firebaseConfig = { projectId: "trendup-ai" };

// --- Trend Service ---
class TrendService {
  constructor() {
    this.proxies = ['https://api.allorigins.win/get?url=', 'https://corsproxy.io/?', 'https://thingproxy.freeboard.io/fetch/'];
    this.refreshInterval = 10 * 60 * 1000;
    this.cache = new Map();
    try {
      const saved = sessionStorage.getItem('trend_cache');
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.keys(parsed).forEach(k => this.cache.set(k, parsed[k]));
      }
    } catch (e) {}
  }

  async fetchHtmlWithRetry(url) {
    for (const proxy of this.proxies) {
      try {
        const targetUrl = proxy.includes('allorigins') ? `${proxy}${encodeURIComponent(url)}` : `${proxy}${url}`;
        const response = await fetch(targetUrl);
        if (!response.ok) continue;
        if (proxy.includes('allorigins')) {
          const data = await response.json();
          if (data.contents) return data.contents;
        } else {
          const text = await response.text();
          if (text) return text;
        }
      } catch (e) { continue; }
    }
    return null;
  }

  saveCache() { 
    try { 
      const obj = {}; this.cache.forEach((v, k) => { obj[k] = v; }); 
      sessionStorage.setItem('trend_cache', JSON.stringify(obj)); 
    } catch (e) {} 
  }

  async getGoogleTrends(country) {
    const rssUrl = `https://trends.google.com/trending/rss?geo=${country}`;
    try {
      const contents = await this.fetchHtmlWithRetry(rssUrl);
      if (!contents) return [];
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(contents, "text/xml");
      const items = xmlDoc.querySelectorAll("item");
      return Array.from(items).map(item => {
        const title = item.querySelector("title")?.textContent || "";
        const traffic = (item.getElementsByTagNameNS("*", "approx_traffic")[0] || item.getElementsByTagName("ht:approx_traffic")[0])?.textContent || "N/A";
        const newsItems = item.getElementsByTagNameNS("*", "news_item");
        const newsLinks = [];
        const snippets = [];
        const sources = new Set();
        for (let j = 0; j < newsItems.length; j++) {
          const n = newsItems[j];
          const nt = n.getElementsByTagNameNS("*", "news_item_title")[0]?.textContent;
          const nu = n.getElementsByTagNameNS("*", "news_item_url")[0]?.textContent;
          const ns = n.getElementsByTagNameNS("*", "news_item_source")[0]?.textContent;
          const nsn = n.getElementsByTagNameNS("*", "news_item_snippet")[0]?.textContent;
          if (nt && nu) {
            newsLinks.push({ title: nt, source: ns || 'News', url: nu });
            if (ns) sources.add(ns);
            const cleanSnippet = nsn ? nsn.replace(/<[^>]*>?/gm, '').trim() : "";
            if (cleanSnippet && cleanSnippet.length > 10) snippets.push(cleanSnippet);
          }
        }
        return { title, originalTitle: title, growth: traffic, sources: Array.from(sources), snippets, newsLinks, source: 'Google' };
      });
    } catch (e) { return []; }
  }

  async getPortalTrends(country) {
    if (country === 'KR') {
      try {
        const contents = await this.fetchHtmlWithRetry('https://signal.bz/');
        if (!contents) return [];
        const parser = new DOMParser();
        const doc = parser.parseFromString(contents, 'text/html');
        const items = doc.querySelectorAll('.rank-item .text');
        if (items.length === 0) throw new Error("No Signal items");
        return Array.from(items).slice(0, 10).map(el => ({ 
          title: el.textContent.trim(), 
          originalTitle: el.textContent.trim(), 
          growth: 'Portal', 
          source: 'Signal',
          newsLinks: [], sources: [], snippets: []
        }));
      } catch (e) { return []; }
    }
    if (country === 'JP') {
      try {
        const contents = await this.fetchHtmlWithRetry('https://search.yahoo.co.jp/realtime/term');
        if (!contents) return [];
        const parser = new DOMParser();
        const doc = parser.parseFromString(contents, 'text/html');
        const selectors = ['section[class^="Trend_Trend"] a', '.Trend_Trend__item__rank a', 'a[data-cl-params*="tp_bz"]', '.Trend_Trend__item__name'];
        let items = [];
        for (const sel of selectors) {
          items = doc.querySelectorAll(sel);
          if (items.length > 0) break;
        }
        if (items.length === 0) throw new Error("No Yahoo items");
        return Array.from(items).slice(0, 10).map(el => {
          const text = el.innerText || el.textContent;
          const cleanText = text.replace(/^\d+\s*/, '').trim();
          return { title: cleanText, originalTitle: cleanText, growth: 'Portal', source: 'Yahoo', newsLinks: [], sources: [], snippets: [] };
        });
      } catch (e) { return []; }
    }
    return [];
  }

  async fetchFreshTrends(country, targetLang) {
    try {
      const [google, portal] = await Promise.all([this.getGoogleTrends(country), this.getPortalTrends(country)]);
      const combined = [...portal, ...google];
      const seen = new Set();
      const uniqueTrends = [];
      for (const t of combined) {
        if (!t.originalTitle) continue;
        const norm = t.originalTitle.toLowerCase().replace(/\s/g, '');
        if (!seen.has(norm)) { seen.add(norm); uniqueTrends.push(t); }
        if (uniqueTrends.length >= 15) break;
      }
      const finalTen = uniqueTrends.slice(0, 10);
      for (const t of finalTen) {
        if (t.newsLinks.length === 0) {
          const match = google.find(g => g.originalTitle.toLowerCase().includes(t.originalTitle.toLowerCase()) || t.originalTitle.toLowerCase().includes(g.originalTitle.toLowerCase()));
          if (match) { 
            t.newsLinks = match.newsLinks || []; 
            t.sources = match.sources || []; 
            t.snippets = match.snippets || []; 
            if (t.growth === 'Portal') t.growth = match.growth; 
          }
        }
        const tObj = i18n[targetLang] || i18n.ko;
        if (!t.newsLinks || t.newsLinks.length === 0) {
          t.newsLinks = [{ title: `${tObj.sysLinks.search}: '${t.title}'`, source: 'Search', url: `https://www.google.com/search?q=${encodeURIComponent(t.title)}`, isSystem: true }];
        }
        if (!t.sources) t.sources = [];
        if (!t.snippets) t.snippets = [];
        const primarySearch = (t.newsLinks[0] && !t.newsLinks[0].isSystem) ? t.newsLinks[0].title : t.title;
        t.videoLinks = [{ title: `${tObj.sysLinks.video}: '${t.title}'`, url: `https://www.youtube.com/results?search_query=${encodeURIComponent(primarySearch + " news")}`, isSystem: true }];
      }
      const titlesToTranslate = finalTen.map(t => t.title);
      const translatedTitles = await this.translateBatch(titlesToTranslate, targetLang);
      return finalTen.map((t, i) => ({ ...t, title: translatedTitles[i] || t.title }));
    } catch (e) { console.error(e); return []; }
  }

  calculateRankChanges(newItems, oldItems) {
    if (!newItems) return [];
    return newItems.map((item, index) => {
      const prevRank = oldItems ? oldItems.findIndex(o => o.originalTitle.toLowerCase() === item.originalTitle.toLowerCase()) : -1;
      let trendDir = 'new';
      if (prevRank !== -1) {
        if (index < prevRank) trendDir = 'up';
        else if (index > prevRank) trendDir = 'down';
        else trendDir = 'steady';
      }
      return { ...item, trendDir };
    });
  }

  async translateBatch(texts, targetLang) {
    if (!texts || texts.length === 0) return [];
    if (targetLang === 'ko') return texts;
    const singleTranslate = async (q, tl) => {
      try {
        const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${tl}&dt=t&q=${encodeURIComponent(q)}`);
        const data = await res.json();
        return data[0].map(x => x[0]).join('');
      } catch (e) { return q; }
    };
    const finalResults = await Promise.all(texts.map(async (t) => {
      if (this.cache.has(`${targetLang}:${t}`)) return this.cache.get(`${targetLang}:${t}`);
      const res = await singleTranslate(t, targetLang);
      this.cache.set(`${targetLang}:${t}`, res);
      return res;
    }));
    this.saveCache();
    return finalResults;
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
      if (dir === 'up') return '<span style="color: #ff4d4d;">▲</span>';
      if (dir === 'down') return '<span style="color: #4d79ff;">▼</span>';
      if (dir === 'new') return '<span style="color: #ffaa00; font-size: 0.6rem; border: 1px solid #ffaa00; padding: 0 4px; border-radius: 4px;">NEW</span>';
      return '<span style="color: var(--text-muted); opacity: 0.5;">-</span>';
    };
    this.shadowRoot.innerHTML = `<style>:host { display: block; } .list { display: flex; flex-direction: column; gap: 0.75rem; } .item { display: grid; grid-template-columns: 40px 1fr auto; align-items: center; background: var(--surface); padding: 1.2rem; border-radius: 16px; border: 1px solid var(--border); transition: 0.2s; color: var(--text); cursor: pointer; user-select: none; position: relative; z-index: 1; } .item:hover { border-color: var(--primary); transform: translateY(-2px); box-shadow: var(--shadow-hover); } .rank, .title-group, .growth { pointer-events: none; } .rank { font-size: 1.2rem; font-weight: 900; color: var(--primary); opacity: 0.8; } .title-group { display: flex; flex-direction: column; } .title { font-size: 1.05rem; font-weight: 700; padding-right: 0.5rem; line-height: 1.4; } .growth { font-size: 1rem; font-weight: 800; display: flex; align-items: center; justify-content: center; min-width: 40px; } .loading { text-align: center; padding: 4rem; color: var(--text-muted); font-size: 0.9rem; } .source-badge { font-size: 0.6rem; color: var(--text-muted); opacity: 0.6; display: block; margin-top: 0.2rem; }</style>
      <div class="list">${(!trends || trends.length === 0) ? `<div class="loading">${t.loading}</div>` : trends.map((item, index) => `<div class="item" data-index="${index}"><span class="rank">${index + 1}</span><div class="title-group"><span class="title">${item.title}</span><span class="source-badge">${item.source}</span></div><span class="growth">${getTrendIcon(item.trendDir)}</span></div>`).join('')}</div>`;
    this.shadowRoot.querySelectorAll('.item').forEach(el => { 
      el.onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        const trendData = trends[parseInt(el.dataset.index)];
        window.dispatchEvent(new CustomEvent('open-trend-modal', { detail: trendData, bubbles: true, composed: true }));
      };
    });
  }
}

class TrendModal extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: 'open' }); this.isVisible = false; }
  async show(trend, lang, service) {
    if (!trend) return;
    this.isVisible = true;
    this.renderLoading();
    const t = i18n[lang] || i18n.en;
    this.render(trend, lang, t.analyzing);
    const snippets = trend.snippets || [];
    const sources = trend.sources || [];
    const itemsToTranslate = [...snippets, ...sources];
    const translatedItems = await service.translateBatch(itemsToTranslate, lang);
    if (!this.isVisible) return;
    const translatedSnippets = (translatedItems || []).slice(0, snippets.length);
    const translatedSources = (translatedItems || []).slice(snippets.length);
    const analysis = t.analysisTemplate(trend.title, translatedSources, translatedSnippets);
    this.render(trend, lang, analysis);
  }
  hide() { this.isVisible = false; const overlay = this.shadowRoot.querySelector('.overlay'); if (overlay) { overlay.classList.remove('active'); setTimeout(() => { if (!this.isVisible) this.shadowRoot.innerHTML = ''; }, 300); } }
  renderLoading() { this.shadowRoot.innerHTML = `<style>.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 9999; opacity: 1; transition: 0.3s; } .modal { background: var(--bg); width: 90%; max-width: 450px; border-radius: 24px; padding: 3rem 2rem; border: 1px solid var(--border); text-align: center; color: var(--text-muted); }</style><div class="overlay"><div class="modal">Analyzing...</div></div>`; this.shadowRoot.querySelector('.overlay').onclick = (e) => { if (e.target === e.currentTarget) this.hide(); }; }
  render(trend, lang, analysis) {
    if (!this.isVisible) return;
    const t = i18n[lang] || i18n.en;
    this.shadowRoot.innerHTML = `<style>.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 9999; opacity: 1; transition: 0.3s; } .modal { background: var(--bg); width: 92%; max-width: 500px; max-height: 80vh; border-radius: 24px; padding: 2rem; border: 1px solid var(--border); box-shadow: var(--shadow-hover); overflow-y: auto; position: relative; z-index: 10000; } .close { position: absolute; top: 1rem; right: 1rem; cursor: pointer; border: none; background: var(--border); width: 32px; height: 32px; border-radius: 50%; font-size: 1.2rem; color: var(--text); display: flex; align-items: center; justify-content: center; line-height: 1; } .title { font-size: 1.4rem; font-weight: 800; margin-bottom: 1.5rem; color: var(--text); padding-right: 1.5rem; } .section-title { font-weight: 800; color: var(--primary); margin: 1.5rem 0 0.5rem; display: block; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; } .text { line-height: 1.6; color: var(--text); margin-bottom: 1.5rem; font-size: 0.95rem; white-space: pre-wrap; } .link-group { display: flex; flex-direction: column; gap: 0.5rem; } .link { padding: 0.8rem 1rem; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; text-decoration: none; color: var(--text); font-size: 0.85rem; display: flex; align-items: center; gap: 0.5rem; transition: 0.2s; } .link:hover { border-color: var(--primary); background: var(--border); } .link-meta { font-size: 0.7rem; font-weight: 800; color: var(--primary); opacity: 0.7; margin-bottom: -0.2rem; }</style>
      <div class="overlay active"><div class="modal"><button class="close" aria-label="Close">&times;</button><h2 class="title">${trend.title}</h2><span class="section-title">✨ ${t.summary}</span><p class="text">${analysis}</p><span class="section-title">📰 ${t.news}</span><div class="link-group">${(trend.newsLinks || []).slice(0,3).map(l => `<a href="${l.url}" target="_blank" class="link"><div><div class="link-meta">${l.source}</div><div>📄 ${l.title}</div></div></a>`).join('')}</div><span class="section-title">🎬 ${t.videos}</span><div class="link-group">${(trend.videoLinks || []).map(l => `<a href="${l.url}" target="_blank" class="link">▶️ ${l.title}</a>`).join('')}</div></div></div>`;
    const closeBtn = this.shadowRoot.querySelector('.close');
    const overlay = this.shadowRoot.querySelector('.overlay');
    if (closeBtn) closeBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); this.hide(); };
    if (overlay) overlay.onclick = (e) => { if (e.target === overlay) { e.preventDefault(); e.stopPropagation(); this.hide(); } };
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
    this.currentRequestId = 0;
    this.db = null;
    this.init();
  }
  async init() {
    console.log("App Init: v1.6.6");
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
      window.addEventListener('open-trend-modal', (e) => { if (this.modal) this.modal.show(e.detail, this.currentLang, this.service); });
      window.addEventListener('click', () => { document.querySelectorAll('.pill-nav').forEach(n => n.classList.remove('expanded')); document.getElementById('theme-dropdown')?.classList.add('hidden'); });
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (this.themeMode === 'system') this.applyTheme('system'); });
      this.startAsyncTasks();
      setInterval(() => { this.update(); this.backgroundSyncAll(); }, this.service.refreshInterval);
    } catch (e) { console.error("App init failed:", e); }
  }
  
  loadLocalCache() {
    try {
      const cached = localStorage.getItem(`trends_${this.currentCountry}`);
      if (cached) {
        const data = JSON.parse(cached);
        const trends = this.service.calculateRankChanges(data.items, data.previousItems);
        const trendListEl = document.getElementById('top-trends');
        if (trendListEl) trendListEl.data = { trends, lang: this.currentLang };
        const lastUpdatedEl = document.getElementById('last-updated');
        if (lastUpdatedEl && data.lastUpdated) {
          const t = i18n[this.currentLang] || i18n.en;
          const date = new Date(data.lastUpdated);
          lastUpdatedEl.textContent = `${t.update}: ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        }
      }
    } catch (e) {}
  }

  async startAsyncTasks() {
    try {
      const app = initializeApp(firebaseConfig);
      this.db = getFirestore(app);
      await this.syncLocalization();
      this.refreshUIText();
      this.renderNavs();
      await this.update();
      this.backgroundSyncAll();
    } catch (e) { console.error("Async tasks failed:", e); await this.update(); }
  }
  async syncLocalization() {
    if (!this.db) return;
    try {
      for (const lang of Object.keys(i18n)) { await setDoc(doc(this.db, 'localization', lang), i18n[lang]); }
      const snapshot = await getDocs(collection(this.db, 'localization'));
      if (!snapshot.empty) {
        const remoteData = {};
        snapshot.forEach(doc => { remoteData[doc.id] = doc.data(); });
        i18n = remoteData;
        localStorage.setItem('i18n_cache', JSON.stringify(i18n));
      }
    } catch (e) { console.error("Localization sync failed:", e); }
  }
  refreshUIText() {
    try {
      const t = i18n[this.currentLang] || i18n.en;
      const titleEl = document.getElementById('current-country-title');
      if (titleEl) titleEl.textContent = t.title;
      const menuSections = document.querySelectorAll('.menu-section');
      if (menuSections[0]) {
        const menuTitle = menuSections[0].querySelector('.menu-title');
        if (menuTitle) menuTitle.textContent = t.T;
      }
      if (menuSections[1]) {
        const menuTitle = menuSections[1].querySelector('.menu-title');
        if (menuTitle) menuTitle.textContent = t.labels?.site || "Site Info";
      }
      document.querySelectorAll('.nav-label').forEach(label => {
        const text = label.textContent.toLowerCase();
        if (text.includes('trend') || text.includes('국가') || text.includes('国')) label.textContent = t.labels?.trends || "Country:";
        if (text.includes('lang') || text.includes('언어') || text.includes('言語')) label.textContent = t.labels?.language || "Language:";
      });
      document.querySelectorAll('[data-page]').forEach(el => {
        const key = el.getAttribute('data-page');
        if (key === 'about') el.textContent = t.menuAbout;
        else if (key === 'privacy') el.textContent = t.menuPrivacy;
        else if (key === 'terms') el.textContent = t.menuTerms;
        else if (key === 'contact') el.textContent = t.menuContact;
      });
      document.querySelectorAll('.theme-opt').forEach(opt => {
        const key = opt.dataset.theme;
        const label = opt.querySelector('.opt-label');
        if (label && t.themes && t.themes[key]) label.textContent = t.themes[key];
      });
      const cookieBanner = document.getElementById('cookie-banner');
      if (cookieBanner) {
        const p = cookieBanner.querySelector('p');
        const btn = cookieBanner.querySelector('button');
        if (p) p.textContent = t.cookie;
        if (btn) btn.textContent = t.accept;
      }
      const footerText = document.querySelector('.footer-content p');
      if (footerText) footerText.textContent = `© 2026 TrendUp. All rights reserved. (v1.6.6)`;
      const sideMenuFooter = document.querySelector('.side-menu-footer p');
      if (sideMenuFooter) sideMenuFooter.textContent = `© 2026 TrendUp. All rights reserved.`;
    } catch (e) { console.error("UI Refresh failed:", e); }
  }
  async backgroundSyncAll() {
    if (!this.db) return;
    try {
      const countries = this.service.getCountries();
      for (const c of countries) {
        const trendDoc = await getDoc(doc(this.db, 'trends', c.code));
        const dbData = trendDoc.exists() ? trendDoc.data() : null;
        const now = Date.now();
        const lastUpdated = dbData?.lastUpdated?.toMillis() || 0;
        if (!dbData || (now - lastUpdated > this.service.refreshInterval)) {
          const freshItems = await this.service.fetchFreshTrends(c.code, this.currentLang);
          if (freshItems && freshItems.length >= 5) {
            await setDoc(doc(this.db, 'trends', c.code), { items: freshItems, previousItems: dbData?.items || [], lastUpdated: Timestamp.now() });
          }
          await new Promise(res => setTimeout(res, 2000));
        }
      }
    } catch (e) { console.error("Background sync failed:", e); }
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
        const theme = opt.dataset.theme;
        this.applyTheme(theme);
        dropdown.classList.add('hidden');
      };
    });
  }
  applyTheme(mode) {
    try {
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
    } catch (e) {}
  }
  initSideMenu() {
    const toggle = document.getElementById('menu-toggle');
    const close = document.getElementById('menu-close');
    const overlay = document.getElementById('side-menu-overlay');
    const menu = document.getElementById('side-menu');
    if (!toggle || !menu) return;
    const openMenu = () => { menu.classList.add('active'); overlay.classList.remove('hidden'); document.body.style.overflow = 'hidden'; };
    const closeMenu = () => { menu.classList.remove('active'); overlay.classList.add('hidden'); document.body.style.overflow = ''; };
    toggle.onclick = (e) => { e.stopPropagation(); openMenu(); };
    if (close) close.onclick = closeMenu;
    if (overlay) overlay.onclick = closeMenu;
    menu.querySelectorAll('.info-link').forEach(link => { link.onclick = (e) => { closeMenu(); }; });
  }
  initCookieBanner() {
    const banner = document.getElementById('cookie-banner');
    if (!banner) return;
    const t = i18n[this.currentLang] || i18n.en;
    const p = banner.querySelector('p');
    const btn = banner.querySelector('button');
    if (p) p.textContent = t.cookie;
    if (btn) btn.textContent = t.accept;
    if (!localStorage.getItem('cookies-accepted')) banner.classList.remove('hidden');
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
        if (t.pages && t.pages[pageKey] && body && overlay) { body.innerHTML = t.pages[pageKey].content; overlay.classList.remove('hidden'); }
      });
    });
    if (closeBtn) closeBtn.onclick = () => overlay?.classList.add('hidden');
    if (overlay) overlay.onclick = (e) => { if (e.target === overlay) overlay.classList.add('hidden'); };
  }
  renderNavs() {
    try {
      const t = i18n[this.currentLang] || i18n.en;
      const renderGroup = (id, items, current, labelKey, onSelect) => {
        const nav = document.getElementById(id);
        if (!nav) return;
        const label = nav.parentElement?.querySelector('.nav-label');
        if (label && t.labels) {
          if (labelKey === 'T') label.textContent = t.labels.trends;
          else if (labelKey === 'L') label.textContent = t.labels.language;
        }
        const activeItem = items.find(i => i.code === current);
        if (!activeItem) return;
        nav.innerHTML = `<button class="country-btn active">${activeItem.flag}</button>${items.filter(i => i.code !== current).map(item => `<button class="country-btn" data-code="${item.code}">${item.flag}</button>`).join('')}`;
        nav.onclick = (e) => { e.stopPropagation(); const wasExpanded = nav.classList.contains('expanded'); document.querySelectorAll('.pill-nav').forEach(n => n.classList.remove('expanded')); if (!wasExpanded) nav.classList.add('expanded'); };
        nav.querySelectorAll('button[data-code]').forEach(btn => btn.onclick = (e) => { e.stopPropagation(); onSelect(btn.dataset.code); nav.classList.remove('expanded'); });
      };
      renderGroup('country-nav', this.service.getCountries(), this.currentCountry, 'T', (code) => this.switchCountry(code));
      renderGroup('lang-nav', this.service.getLanguages(), this.currentLang, 'L', (code) => this.switchLang(code));
    } catch (e) { console.error("Render navs failed:", e); }
  }
  async switchCountry(code) { this.currentCountry = code; this.loadLocalCache(); this.renderNavs(); await this.update(false, true); }
  async switchLang(code) { this.currentLang = code; localStorage.setItem('lang', code); this.renderNavs(); this.refreshUIText(); await this.update(true); }
  
  async update(isLanguageSwitch = false, isCountrySwitch = false) {
    const requestId = ++this.currentRequestId;
    try {
      const t = i18n[this.currentLang] || i18n.en;
      this.refreshUIText();
      let dbData = null;
      if (this.db) {
        try {
          const trendDoc = await getDoc(doc(this.db, 'trends', this.currentCountry));
          if (trendDoc.exists()) {
            dbData = trendDoc.data();
            const trends = this.service.calculateRankChanges(dbData.items, dbData.previousItems);
            const trendListEl = document.getElementById('top-trends');
            if (trendListEl) trendListEl.data = { trends, lang: this.currentLang };
            localStorage.setItem(`trends_${this.currentCountry}`, JSON.stringify({ items: dbData.items, previousItems: dbData.previousItems, lastUpdated: dbData.lastUpdated.toMillis() }));
            const lastUpdatedEl = document.getElementById('last-updated');
            if (lastUpdatedEl && dbData.lastUpdated) {
              const date = dbData.lastUpdated.toDate();
              lastUpdatedEl.textContent = `${t.update}: ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
            }
          }
        } catch (dbErr) { console.error("DB Load Error:", dbErr); }
      }
      const now = Date.now();
      const lastUpdated = dbData?.lastUpdated?.toMillis() || 0;
      const needsUpdate = isCountrySwitch || isLanguageSwitch || (now - lastUpdated > this.service.refreshInterval) || !dbData;
      if (needsUpdate) {
        const freshItems = await this.service.fetchFreshTrends(this.currentCountry, this.currentLang);
        if (requestId !== this.currentRequestId) return;
        if (freshItems && freshItems.length >= 5) {
          const trends = this.service.calculateRankChanges(freshItems, dbData?.items || null);
          const trendListEl = document.getElementById('top-trends');
          if (trendListEl) trendListEl.data = { trends, lang: this.currentLang };
          const nowObj = new Date();
          const lastUpdatedEl = document.getElementById('last-updated');
          if (lastUpdatedEl) lastUpdatedEl.textContent = `${t.update}: ${nowObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
          if (this.db) await setDoc(doc(this.db, 'trends', this.currentCountry), { items: freshItems, previousItems: dbData?.items || [], lastUpdated: Timestamp.now() });
          localStorage.setItem(`trends_${this.currentCountry}`, JSON.stringify({ items: freshItems, previousItems: dbData?.items || [], lastUpdated: nowObj.getTime() }));
        }
      }
    } catch (e) { console.error("Update failed:", e); }
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => new App());
else new App();
