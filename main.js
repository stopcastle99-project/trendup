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

// --- Icons (Minimalist SVGs) ---
const ICONS = {
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`,
  moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`,
  system: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2v20"></path><path d="M12 7V17"></path><path d="M12 12h5"></path><path d="M12 2a10 10 0 0 0 0 20z" fill="currentColor" fill-opacity="0.3"></path></svg>`
};

// --- Localization (Initial Hardcoded as Fallback) ---
let i18n = {
  ko: { 
    title: "실시간 인기 트렌드", update: "최근 업데이트", summary: "분석 리포트", news: "관련 뉴스", videos: "유튜브 소식", loading: "트렌드 분석 중...", T: "트렌드 설정", L: "언어 설정", 
    infoTitle: "TrendUp 정보", infoDesc: "다양한 국가의 실시간 급상승 키워드를 한눈에 확인하고 세상의 흐름을 읽어보세요.",
    cookie: "본 사이트는 사용자 경험 개선을 위해 쿠키를 사용합니다.", accept: "확인",
    siteGuide: "사이트 안내", menuAbout: "TrendUp 소개", menuPrivacy: "개인정보처리방침", menuTerms: "이용약관", menuContact: "문의하기",
    countries: { KR: "대한민국", JP: "일본", US: "미국" },
    themes: { light: "밝게", dark: "어둡게", system: "시스템" },
    labels: { trends: "국가:", language: "언어:", site: "사이트 정보" },
    analysisTemplate: (title, sources, snippets) => {
      if (snippets.length === 0) return `'${title}' 주제가 현재 검색 포털을 통해 빠르게 확산되며 대중의 큰 관심을 받고 있습니다.`;
      const cleanSnippets = Array.from(new Set(snippets.map(s => s.trim()))).filter(s => s.length > 20);
      const mainSummary = cleanSnippets.slice(0, 3).join(' ');
      const sourceInfo = sources.length > 0 ? `\n\n[보도 매체: ${sources.slice(0, 3).join(', ')} 등]` : "";
      return `${mainSummary}${sourceInfo}`;
    },
    pages: {
      about: { title: "TrendUp 소개", content: `<h2>세상의 흐름을 읽는 가장 빠른 방법, TrendUp</h2><p>TrendUp은 실시간으로 변화하는 글로벌 트렌드를 빅데이터와 AI 기술을 결합하여 분석하고, 사용자에게 핵심 정보를 요약하여 제공하는 프리미엄 트렌드 대시보드입니다.</p><h3>차별화된 가치</h3><ul><li><strong>다양한 소스 통합</strong>: 구글, 네이버(Signal), 야후 재팬 등 국가별 주요 포털의 데이터를 실시간으로 교차 검증합니다.</li><li><strong>AI 심층 요약</strong>: 단순한 키워드 나열을 넘어, 해당 트렌드가 발생한 배경과 맥락을 AI가 분석하여 스토리 형태로 제공합니다.</li><li><strong>신뢰할 수 있는 뉴스</strong>: 검증된 주요 언론사의 기사와 영상 소식을 연결하여 정보의 신뢰도를 높였습니다.</li></ul>` },
      privacy: { title: "개인정보처리방침", content: `<h2>개인정보처리방침</h2><p>TrendUp은 이용자의 개인정보 보호를 최우선으로 하며, 관련 법령을 준수합니다.</p><h3>1. 수집하는 정보</h3><p>본 서비스는 이름, 이메일 등 개인을 식별할 수 있는 정보를 수집하지 않습니다. 다만, 서비스 개선 및 통계 분석을 위해 쿠키와 접속 로그(IP 주소, 브라우저 정보 등)가 자동으로 생성되어 수집될 수 있습니다.</p><h3>2. 애드센스 및 쿠키 사용</h3><p>본 사이트는 구글 애드센스(Google AdSense)를 사용하여 광고를 게재합니다. 구글은 사용자의 방문 기록을 바탕으로 맞춤형 광고 제공을 위해 쿠키를 사용하며, 사용자는 구글 광고 설정에서 이를 해제할 수 있습니다. (v1.5.2)</p>` },
      terms: { title: "이용약관", content: `<h2>이용약관</h2><p>TrendUp 서비스를 이용해 주셔서 감사합니다. 본 약관은 서비스 이용 조건 및 절차를 규정합니다.</p><h3>1. 서비스의 목적</h3><p>본 서비스는 공개된 트렌드 데이터를 수집하여 사용자에게 요약된 정보를 제공하는 것을 목적으로 합니다.</p><h3>2. 책임의 한계</h3><p>TrendUp은 수집된 정보의 정확성과 완전성을 보장하기 위해 노력하나, 외부 데이터 소스의 오류로 인한 결과에 대해서는 법적 책임을 지지 않습니다. 모든 투자나 의사결정의 책임은 이용자 본인에게 있습니다.</p><h3>3. 저작권</h3><p>제공되는 요약 문구의 저작권은 TrendUp에 있으며, 관련 뉴스 및 영상의 저작권은 각 원저작권자에게 있습니다.</p>` },
      contact: { title: "문의하기", content: `<h2>고객 지원 및 문의</h2><p>서비스 이용 중 불편한 점이나 제안하고 싶은 아이디어가 있으시면 언제든지 아래 채널을 통해 연락해 주세요.</p><div style="background:var(--surface); padding:1.5rem; border-radius:12px; border:1px solid var(--border); margin-top:1rem;"><p><strong>이메일</strong>: help@trendup.ai</p><p><strong>운영 시간</strong>: 평일 09:00 ~ 18:00 (KST)</p><p>보내주신 소중한 의견은 서비스 개선에 적극적으로 반영하겠습니다.</p></div>` }
    }
  },
  ja: { 
    title: "トレンド", update: "最終更新", summary: "分析レポート", news: "関連ニュース", videos: "YouTubeニュース", loading: "分析中...", T: "トレンド設定", L: "言語設定", 
    infoTitle: "TrendUpについて", infoDesc: "各国のリアルタイム急上昇キーワード를 ひと目で確認し、世界の潮流를 把握しましょう。",
    cookie: "本사이트는 ユーザー体験向상의 위해 쿠키를 사용합니다.", accept: "確認",
    siteGuide: "사이트 안내", menuAbout: "TrendUpについて", menuPrivacy: "個人정보保護方針", menuTerms: "利用規約", menuContact: "お問い合わせ",
    countries: { KR: "韓国", JP: "日本", US: "アメリカ" },
    themes: { light: "ライト", dark: "ダーク", system: "システム" },
    labels: { trends: "国:", language: "言語:", site: "サイト案内" },
    analysisTemplate: (title, sources, snippets) => {
      if (snippets.length === 0) return `「${title}」가 現在リアルタイムトレンドとして大きな注目を集めています.`;
      const cleanSnippets = Array.from(new Set(snippets.map(s => s.trim()))).filter(s => s.length > 10);
      const mainSummary = cleanSnippets.slice(0, 3).join(' ');
      return `${mainSummary}\n\n[報道メディア: ${sources.slice(0, 3).join('、')} など]`;
    },
    pages: {
      about: { title: "TrendUpについて", content: `<h2>世界の潮流를 読み解く、TrendUp</h2><p>TrendUpは, リアルタイムで変化하는 グロー바ルトレンド를 AI技術で分析し、ユーザー에 최적의 요약 정보를 제공하는 프리미엄 대시보드입니다.</p><h3>TrendUp의 가치</h3><ul><li><strong>複数ソースの統合</strong>: Google、Yahoo! JAPANなどの主要ポータル데이터를 실시간으로 교차 검증합니다.</li><li><strong>AI深層分析</strong>: 単なるキーワード의 나열을 넘어, 해당 트렌드가 발생한 배경이나 문맥을 AI가 분석해서 제공합니다.</li><li><strong>信頼性の高いニュース</strong>: 検証된 주요 언론사의 기사와 영상 소식을 연결하여 정보의 신뢰도를 높였습니다.</li></ul>` },
      privacy: { title: "個人情報保護方針", content: `<h2>個人情報保護方針</h2><p>TrendUpは利用者の個人情報の保護를 최우선으로 합니다.</p><h3>1. 収集하는 情報</h3><p>当 서비스는 성함이나 메일 주소 등의 개인을 식별할 수 있는 정보를 수집하지 않습니다. 다만, 서비스 개선이나 통계 분석을 위해 쿠키나 액세스 로그가 자동으로 생성·수집될 수 있습니다. (v1.5.2)</p>` },
      terms: { title: "利用規約", content: `<h2>利用規約</h2><h3>1. サービスの目的</h3><p>본 서비스는 공개된 트렌드 데이터를 수집하여 사용자에게 요약된 정보를 제공하는 것을 목적으로 합니다.</p><h3>2. 免責事項</h3><p>情報の正確性에는 만전을 기하고 있으나, 외부 데이터 소스의 오류에 기인하는 결과에 대해서는 법적 책임을 지지 않습니다.</p>` },
      contact: { title: "お問い合わせ", content: `<h2>お問い合わせ</h2><p>ご意見やご提案がございましたら, お気軽にメールにてご連絡ください。</p><p><strong>メール</strong>: help@trendup.ai</p>` }
    }
  },
  en: { 
    title: "Trending", update: "Updated", summary: "Analysis Report", news: "Top Stories", videos: "YouTube News", loading: "Analyzing...", T: "Trend Settings", L: "Language Setting", 
    infoTitle: "About TrendUp", infoDesc: "Explore real-time trending keywords from various countries and stay updated with global topics.",
    cookie: "This site uses cookies to improve user experience.", accept: "Accept",
    siteGuide: "Site Information", menuAbout: "About TrendUp", menuPrivacy: "Privacy Policy", menuTerms: "Terms of Service", menuContact: "Contact Us",
    countries: { KR: "South Korea", JP: "Japan", US: "USA" },
    themes: { light: "Light", dark: "Dark", system: "System" },
    labels: { trends: "Country:", language: "Language:", site: "Site Information" },
    analysisTemplate: (title, sources, snippets) => {
      if (snippets.length === 0) return `The topic '${title}' is currently gaining significant traction across major portals.`;
      const cleanSnippets = Array.from(new Set(snippets.map(s => s.trim()))).filter(s => s.length > 10);
      const mainSummary = cleanSnippets.slice(0, 3).join(' ');
      return `${mainSummary}\n\n[Sources: ${sources.slice(0, 3).join(', ')}]`;
    },
    pages: {
      about: { title: "About TrendUp", content: `<h2>The Fastest Way to Read the World, TrendUp</h2><p>TrendUp is a premium trend dashboard that analyzes global real-time trends using AI and big data.</p><h3>Our Value</h3><ul><li><strong>Source Integration</strong>: Real-time validation across Google, Yahoo Japan, and other local portals.</li><li><strong>AI Summary</strong>: Deep context analysis using AI to provide storytelling beyond simple keywords.</li><li><strong>Verified News</strong>: Direct links to reputable news outlets and video content.</li></ul>` },
      privacy: { title: "Privacy Policy", content: `<h2>Privacy Policy</h2><p>We prioritize your privacy and comply with global data protection standards. (v1.5.2)</p>` },
      terms: { title: "Terms of Service", content: `<h2>Terms of Service</h2><h3>1. Purpose</h3><p>TrendUp provides summarized real-time trend information collected from public sources.</p><h3>2. Limitation of Liability</h3><p>While we strive for accuracy, we are not responsible for any issues arising from inaccuracies in external data sources.</p>` },
      contact: { title: "Contact Us", content: `<h2>Contact Us</h2><p>If you have any questions or suggestions, please contact us at help@trendup.ai.</p>` }
    }
  }
};

// --- Firebase Configuration ---
const firebaseConfig = {
  projectId: "trendup-ai"
};

// --- Trend Service ---
class TrendService {
  constructor() {
    this.proxies = [
      'https://api.allorigins.win/get?url=',
      'https://corsproxy.io/?',
      'https://thingproxy.freeboard.io/fetch/'
    ];
    this.refreshInterval = 10 * 60 * 1000; // 10 minutes
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
          if (match) { t.newsLinks = match.newsLinks; t.sources = match.sources; t.snippets = match.snippets; if (t.growth === 'Portal') t.growth = match.growth; }
        }
        if (!t.newsLinks || t.newsLinks.length === 0) {
          t.newsLinks = [{ title: `Google Search: '${t.title}'`, source: 'Search', url: `https://www.google.com/search?q=${encodeURIComponent(t.title)}`, isSystem: true }];
        }
        const primarySearch = (t.newsLinks[0] && !t.newsLinks[0].isSystem) ? t.newsLinks[0].title : t.title;
        t.videoLinks = [{ title: `관련 영상 확인: '${t.title}'`, url: `https://www.youtube.com/results?search_query=${encodeURIComponent(primarySearch + " news")}`, isSystem: true }];
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
    if (split.length !== texts.length) split = await Promise.all(texts.map(t => singleTranslate(t, targetLang)));
    const finalResults = texts.map((t, i) => { const res = split[i] || t; this.cache.set(`${targetLang}:${t}`, res); return res; });
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
    this.shadowRoot.innerHTML = `<style>:host { display: block; } .list { display: flex; flex-direction: column; gap: 0.75rem; } .item { display: grid; grid-template-columns: 40px 1fr auto; align-items: center; background: var(--surface); padding: 1.2rem; border-radius: 16px; border: 1px solid var(--border); transition: 0.2s; color: var(--text); cursor: pointer; } .item:hover { border-color: var(--primary); transform: translateY(-2px); box-shadow: var(--shadow-hover); } .rank { font-size: 1.2rem; font-weight: 900; color: var(--primary); opacity: 0.8; } .title-group { display: flex; flex-direction: column; } .title { font-size: 1.05rem; font-weight: 700; padding-right: 0.5rem; line-height: 1.4; } .growth { font-size: 1rem; font-weight: 800; display: flex; align-items: center; justify-content: center; min-width: 40px; } .loading { text-align: center; padding: 4rem; color: var(--text-muted); font-size: 0.9rem; } .source-badge { font-size: 0.6rem; color: var(--text-muted); opacity: 0.6; display: block; margin-top: 0.2rem; }</style>
      <div class="list">${trends.length === 0 ? `<div class="loading">${t.loading}</div>` : trends.map((item, index) => `<div class="item" data-index="${index}"><span class="rank">${index + 1}</span><div class="title-group"><span class="title">${item.title}</span><span class="source-badge">${item.source}</span></div><span class="growth">${getTrendIcon(item.trendDir)}</span></div>`).join('')}</div>`;
    this.shadowRoot.querySelectorAll('.item').forEach(el => { el.onclick = () => this.dispatchEvent(new CustomEvent('trend-click', { detail: trends[el.dataset.index], bubbles: true, composed: true })); });
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
  renderLoading() { this.shadowRoot.innerHTML = `<style>.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 5000; opacity: 0; pointer-events: none; transition: 0.3s; } .overlay.active { opacity: 1; pointer-events: auto; } .modal { background: var(--bg); width: 90%; max-width: 450px; border-radius: 24px; padding: 3rem 2rem; border: 1px solid var(--border); text-align: center; color: var(--text-muted); }</style><div class="overlay"><div class="modal">Analyzing Trend...</div></div>`; }
  render(trend, lang, analysis) {
    const t = i18n[lang] || i18n.en;
    this.shadowRoot.innerHTML = `<style>.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 5000; opacity: 0; pointer-events: none; transition: 0.3s; } .overlay.active { opacity: 1; pointer-events: auto; } .modal { background: var(--bg); width: 92%; max-width: 500px; max-height: 80vh; border-radius: 24px; padding: 2rem; border: 1px solid var(--border); box-shadow: var(--shadow-hover); overflow-y: auto; position: relative; } .close { position: absolute; top: 1rem; right: 1rem; cursor: pointer; border: none; background: var(--border); width: 32px; height: 32px; border-radius: 50%; font-size: 1.2rem; color: var(--text); } .title { font-size: 1.4rem; font-weight: 800; margin-bottom: 1.5rem; color: var(--text); padding-right: 1.5rem; } .section-title { font-weight: 800; color: var(--primary); margin: 1.5rem 0 0.5rem; display: block; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; } .text { line-height: 1.6; color: var(--text); margin-bottom: 1.5rem; font-size: 0.95rem; white-space: pre-wrap; } .link-group { display: flex; flex-direction: column; gap: 0.5rem; } .link { padding: 0.8rem 1rem; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; text-decoration: none; color: var(--text); font-size: 0.85rem; display: flex; align-items: center; gap: 0.5rem; transition: 0.2s; } .link:hover { border-color: var(--primary); background: var(--border); } .link-meta { font-size: 0.7rem; font-weight: 800; color: var(--primary); opacity: 0.7; margin-bottom: -0.2rem; }</style>
      <div class="overlay active"><div class="modal"><button class="close">&times;</button><h2 class="title">${trend.title}</h2><span class="section-title">✨ ${t.summary}</span><p class="text">${analysis}</p><span class="section-title">📰 ${t.news}</span><div class="link-group">${trend.newsLinks.slice(0,3).map(l => `<a href="${l.url}" target="_blank" class="link"><div><div class="link-meta">${l.source}</div><div>📄 ${l.title}</div></div></a>`).join('')}</div><span class="section-title">🎬 ${t.videos}</span><div class="link-group">${trend.videoLinks.map(l => `<a href="${l.url}" target="_blank" class="link">▶️ ${l.title}</a>`).join('')}</div></div></div>`;
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
    this.currentRequestId = 0;
    this.db = null;
    this.init();
  }
  async init() {
    console.log("App Init: v1.5.2");
    try {
      const app = initializeApp(firebaseConfig);
      this.db = getFirestore(app);
      await this.syncLocalization();
    } catch (e) { console.error("Firebase init failed:", e); }

    this.initThemeIcons();
    this.applyTheme(this.themeMode);
    this.modal = document.createElement('trend-modal');
    document.body.appendChild(this.modal);
    
    this.initInfoModals();
    this.initCookieBanner();
    this.initSideMenu();
    this.initThemeMenu();
    this.renderNavs();
    await this.update();
    this.backgroundSyncAll(); 
    
    document.getElementById('top-trends').addEventListener('trend-click', e => this.modal.show(e.detail, this.currentLang, this.service));
    window.addEventListener('click', () => {
      document.querySelectorAll('.pill-nav').forEach(n => n.classList.remove('expanded'));
      document.getElementById('theme-dropdown')?.classList.add('hidden');
    });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (this.themeMode === 'system') this.applyTheme('system');
    });
    setInterval(() => this.update(), this.service.refreshInterval);
  }

  async syncLocalization() {
    if (!this.db) return;
    try {
      const cached = localStorage.getItem('i18n_cache');
      if (cached) { i18n = JSON.parse(cached); }
      const colRef = collection(this.db, 'localization');
      const snapshot = await getDocs(colRef);
      if (!snapshot.empty) {
        const remoteData = {};
        snapshot.forEach(doc => { remoteData[doc.id] = doc.data(); });
        i18n = remoteData;
        localStorage.setItem('i18n_cache', JSON.stringify(i18n));
      } else {
        for (const lang of Object.keys(i18n)) { await setDoc(doc(this.db, 'localization', lang), i18n[lang]); }
      }
    } catch (e) { console.error("Localization sync failed:", e); }
  }

  async backgroundSyncAll() {
    if (!this.db) return;
    const countries = this.service.getCountries();
    for (const c of countries) {
      if (c.code === this.currentCountry) continue;
      try {
        const trendDoc = await getDoc(doc(this.db, 'trends', c.code));
        const dbData = trendDoc.exists() ? trendDoc.data() : null;
        const now = Date.now();
        const lastUpdated = dbData?.lastUpdated?.toMillis() || 0;
        if (!dbData || (now - lastUpdated > this.service.refreshInterval)) {
          const freshItems = await this.service.fetchFreshTrends(c.code, this.currentLang);
          if (freshItems && freshItems.length >= 5) {
            await setDoc(doc(this.db, 'trends', c.code), {
              items: freshItems,
              previousItems: dbData?.items || [],
              lastUpdated: Timestamp.now()
            });
          }
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      } catch (e) { console.error(`Background sync for ${c.code} failed:`, e); }
    }
  }

  initThemeIcons() {
    const sunIcons = document.querySelectorAll('.sun-svg');
    const moonIcons = document.querySelectorAll('.moon-svg');
    const systemIcons = document.querySelectorAll('.system-svg');
    sunIcons.forEach(el => el.innerHTML = ICONS.sun);
    moonIcons.forEach(el => el.innerHTML = ICONS.moon);
    systemIcons.forEach(el => el.innerHTML = ICONS.system);
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
    this.themeMode = mode;
    localStorage.setItem('theme-mode', mode);
    let targetTheme = mode;
    if (mode === 'system') {
      targetTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', targetTheme);
    const triggerIcon = document.querySelector('.theme-trigger-icon');
    if (triggerIcon) {
      if (mode === 'light') triggerIcon.innerHTML = ICONS.sun;
      else if (mode === 'dark') triggerIcon.innerHTML = ICONS.moon;
      else triggerIcon.innerHTML = ICONS.system;
    }
    document.querySelectorAll('.theme-opt').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.theme === mode);
    });
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
    close.onclick = closeMenu;
    overlay.onclick = closeMenu;
    menu.querySelectorAll('.info-link').forEach(link => { const originalClick = link.onclick; link.onclick = (e) => { if (originalClick) originalClick(e); closeMenu(); }; });
  }
  initCookieBanner() {
    const banner = document.getElementById('cookie-banner');
    if (!banner) return;
    const t = i18n[this.currentLang] || i18n.en;
    banner.querySelector('p').textContent = t.cookie;
    banner.querySelector('button').textContent = t.accept;
    if (!localStorage.getItem('cookies-accepted')) banner.classList.remove('hidden');
    banner.querySelector('button').onclick = () => { localStorage.setItem('cookies-accepted', 'true'); banner.classList.add('hidden'); };
  }
  initInfoModals() {
    const overlay = document.getElementById('info-modal');
    const body = document.getElementById('info-modal-body');
    const closeBtn = document.querySelector('.info-modal-close');
    document.querySelectorAll('.info-link').forEach(link => {
      link.onclick = (e) => {
        e.preventDefault();
        const pageKey = link.getAttribute('data-page');
        const t = i18n[this.currentLang] || i18n.en;
        if (t.pages[pageKey]) { body.innerHTML = t.pages[pageKey].content; overlay.classList.remove('hidden'); }
      };
    });
    closeBtn.onclick = () => overlay.classList.add('hidden');
    overlay.onclick = (e) => { if (e.target === overlay) overlay.classList.add('hidden'); };
  }
  renderNavs() {
    try {
      const t = i18n[this.currentLang] || i18n.en;
      const renderGroup = (id, items, current, labelKey, onSelect) => {
        const nav = document.getElementById(id);
        if (!nav) return;
        const label = nav.parentElement.querySelector('.nav-label');
        if (label) {
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
    } catch (e) { console.error(e); }
  }
  async switchCountry(code) { this.currentCountry = code; this.renderNavs(); await this.update(false, true); }
  async switchLang(code) { this.currentLang = code; localStorage.setItem('lang', code); this.renderNavs(); this.initCookieBanner(); await this.update(true); }
  
  async update(isLanguageSwitch = false, isCountrySwitch = false) {
    const requestId = ++this.currentRequestId;
    try {
      const t = i18n[this.currentLang] || i18n.en;
      let dbData = null;
      if (this.db) {
        try {
          const trendDoc = await getDoc(doc(this.db, 'trends', this.currentCountry));
          if (trendDoc.exists()) {
            dbData = trendDoc.data();
            const trends = this.service.calculateRankChanges(dbData.items, dbData.previousItems);
            if (document.getElementById('top-trends')) document.getElementById('top-trends').data = { trends, lang: this.currentLang };
            const date = dbData.lastUpdated.toDate();
            if (document.getElementById('last-updated')) document.getElementById('last-updated').textContent = `${t.update}: ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
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
          if (document.getElementById('top-trends')) document.getElementById('top-trends').data = { trends, lang: this.currentLang };
          const nowObj = new Date();
          if (document.getElementById('last-updated')) document.getElementById('last-updated').textContent = `${t.update}: ${nowObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
          
          if (this.db) {
            await setDoc(doc(this.db, 'trends', this.currentCountry), {
              items: freshItems,
              previousItems: dbData?.items || [],
              lastUpdated: Timestamp.now()
            });
          }
        }
      }

      if (document.getElementById('current-country-title')) document.getElementById('current-country-title').textContent = t.title;
      if (document.querySelector('.info-card h3')) document.querySelector('.info-card h3').textContent = t.infoTitle;
      if (document.querySelector('.info-card p')) document.querySelector('.info-card p').textContent = t.infoDesc;
      const menuSections = document.querySelectorAll('.menu-section');
      if (menuSections[0]) menuSections[0].querySelector('.menu-title').textContent = t.T;
      if (menuSections[1]) menuSections[1].querySelector('.menu-title').textContent = t.labels.site;
      document.querySelectorAll('.theme-opt').forEach(opt => {
        const key = opt.dataset.theme;
        const label = opt.querySelector('.opt-label');
        if (label && t.themes[key]) label.textContent = t.themes[key];
      });
      document.querySelectorAll('[data-page]').forEach(el => {
        const key = el.getAttribute('data-page');
        if (key === 'about') el.textContent = t.menuAbout;
        if (key === 'privacy') el.textContent = t.menuPrivacy;
        if (key === 'terms') el.textContent = t.menuTerms;
        if (key === 'contact') el.textContent = t.menuContact;
      });
    } catch (e) { console.error("Update failed:", e); }
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => new App());
else new App();
