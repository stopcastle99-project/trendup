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

// --- Trend Service ---
class TrendService {
  constructor() {
    this.proxyUrl = 'https://api.allorigins.win/get?url=';
    this.refreshInterval = 15 * 60 * 1000;
    this.cache = new Map();
    this.prevRanks = new Map();
    try {
      const saved = sessionStorage.getItem('trend_cache');
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.keys(parsed).forEach(k => this.cache.set(k, parsed[k]));
      }
      const savedRanks = sessionStorage.getItem('prev_ranks');
      if (savedRanks) {
        const parsedRanks = JSON.parse(savedRanks);
        Object.keys(parsedRanks).forEach(k => this.prevRanks.set(k, parsedRanks[k]));
      }
    } catch (e) {}
  }
  saveCache() { 
    try { 
      const obj = {}; this.cache.forEach((v, k) => { obj[k] = v; }); 
      sessionStorage.setItem('trend_cache', JSON.stringify(obj)); 
    } catch (e) {} 
  }
  saveRanks(trends, country) {
    try {
      const ranks = {};
      trends.forEach((t, i) => { ranks[`${country}:${t.originalTitle}`] = i; });
      const currentRanks = JSON.parse(sessionStorage.getItem('prev_ranks') || '{}');
      sessionStorage.setItem('prev_ranks', JSON.stringify({ ...currentRanks, ...ranks }));
      Object.keys(ranks).forEach(k => this.prevRanks.set(k, ranks[k]));
    } catch (e) {}
  }

  async getGoogleTrends(country) {
    const rssUrl = `https://trends.google.com/trending/rss?geo=${country}`;
    try {
      const response = await fetch(`${this.proxyUrl}${encodeURIComponent(rssUrl)}`);
      const data = await response.json();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(data.contents, "text/xml");
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
            newsLinks.push({ title: `[${ns || 'News'}] ${nt}`, url: nu });
            if (ns) sources.add(ns);
            const cleanSnippet = nsn ? nsn.replace(/<[^>]*>?/gm, '').trim() : "";
            if (cleanSnippet) snippets.push(cleanSnippet);
          }
        }
        return { title, originalTitle: title, growth: traffic, sources: Array.from(sources), snippets, newsLinks, source: 'Google' };
      });
    } catch (e) { return []; }
  }

  async getPortalTrends(country) {
    if (country === 'KR') {
      try {
        const response = await fetch(`${this.proxyUrl}${encodeURIComponent('https://signal.bz/')}`);
        const data = await response.json();
        const parser = new DOMParser();
        const doc = parser.parseFromString(data.contents, 'text/html');
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
        const response = await fetch(`${this.proxyUrl}${encodeURIComponent('https://search.yahoo.co.jp/realtime/term')}`);
        const data = await response.json();
        const parser = new DOMParser();
        const doc = parser.parseFromString(data.contents, 'text/html');
        // More robust selectors for Yahoo Japan
        const selectors = ['section[class^="Trend_Trend"] a', '.Trend_Trend__item__rank a', 'a[data-cl-params*="tp_bz"]'];
        let items = [];
        for (const sel of selectors) {
          items = doc.querySelectorAll(sel);
          if (items.length > 0) break;
        }
        if (items.length === 0) throw new Error("No Yahoo items");
        return Array.from(items).slice(0, 10).map(el => {
          const text = el.innerText || el.textContent;
          const cleanText = text.replace(/^\d+\s*/, '').trim(); // Remove rank number if present
          return { 
            title: cleanText, 
            originalTitle: cleanText, 
            growth: 'Portal', 
            source: 'Yahoo',
            newsLinks: [], sources: [], snippets: []
          };
        });
      } catch (e) { return []; }
    }
    return [];
  }

  async getTrends(country, targetLang) {
    try {
      const [google, portal] = await Promise.all([
        this.getGoogleTrends(country),
        this.getPortalTrends(country)
      ]);

      const combined = [...portal, ...google];
      const seen = new Set();
      const uniqueTrends = [];
      
      for (const t of combined) {
        if (!t.originalTitle) continue;
        const norm = t.originalTitle.toLowerCase().replace(/\s/g, '');
        if (!seen.has(norm)) {
          seen.add(norm);
          uniqueTrends.push(t);
        }
        if (uniqueTrends.length >= 15) break; // Collect more to ensure 10 after de-dupe
      }

      const finalTen = uniqueTrends.slice(0, 10);

      for (const t of finalTen) {
        if (t.newsLinks.length === 0) {
          const match = google.find(g => g.originalTitle.toLowerCase().includes(t.originalTitle.toLowerCase()) || t.originalTitle.toLowerCase().includes(g.originalTitle.toLowerCase()));
          if (match) {
            t.newsLinks = match.newsLinks;
            t.sources = match.sources;
            t.snippets = match.snippets;
            if (t.growth === 'Portal') t.growth = match.growth;
          }
        }
        if (!t.newsLinks || t.newsLinks.length === 0) {
          t.newsLinks = [{ title: `Search: '${t.title}'`, url: `https://www.google.com/search?q=${encodeURIComponent(t.title)}`, isSystem: true }];
        }
        t.videoLinks = [{ title: `YouTube: '${t.title}'`, url: `https://www.youtube.com/results?search_query=${encodeURIComponent(t.title + " news")}`, isSystem: true }];

        const prevRank = this.prevRanks.get(`${country}:${t.originalTitle}`);
        const currentIndex = finalTen.indexOf(t);
        t.trendDir = 'new';
        if (prevRank !== undefined) {
          if (currentIndex < prevRank) t.trendDir = 'up';
          else if (currentIndex > prevRank) t.trendDir = 'down';
          else t.trendDir = 'steady';
        }
      }

      const titlesToTranslate = finalTen.map(t => t.title);
      const translatedTitles = await this.translateBatch(titlesToTranslate, targetLang);
      const results = finalTen.map((t, i) => ({ ...t, title: translatedTitles[i] || t.title }));
      
      this.saveRanks(results, country);
      return results;
    } catch (e) { console.error(e); return []; }
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

// --- Localization ---
const i18n = {
  ko: { 
    title: "실시간 인기 트렌드", update: "최근 업데이트", summary: "급상승 배경", news: "관련 기사", videos: "영상 소식", loading: "트렌드 분석 중...", T: "T", L: "L", 
    infoTitle: "TrendUp 정보", infoDesc: "다양한 국가의 실시간 급상승 키워드를 한눈에 확인하고 세상의 흐름을 읽어보세요.",
    cookie: "본 사이트는 사용자 경험 개선을 위해 쿠키를 사용합니다.", accept: "확인",
    siteGuide: "사이트 안내", menuAbout: "TrendUp 소개", menuPrivacy: "개인정보처리방침", menuTerms: "이용약관", menuContact: "문의하기",
    analysisTemplate: (title, sources, snippets) => `현재 '${title}' 주제는 ${sources.join(', ')} 등 주요 매체를 통해 집중 보도되며 큰 화제가 되고 있습니다.\n\n${snippets.join('\n\n')}\n\n이러한 소식들이 다양한 채널을 통해 전해지면서 대중의 관심이 집중되어 실시간 트렌드에 올랐습니다.`,
    pages: {
      about: { title: "TrendUp 소개", content: `<h2>TrendUp 서비스 소개</h2><p>TrendUp은 실시간 글로벌 트렌드를 AI 기술로 분석하여 요약해주는 대시보드입니다.</p><h3>제공 정보</h3><ul><li>주요 국가 실시간 인기 검색어 TOP 10</li><li>뉴스 기반 트렌드 배경 요약</li><li>관련 뉴스 및 영상 링크</li></ul>` },
      privacy: { title: "개인정보처리방침", content: `<h2>개인정보처리방침</h2><p>TrendUp은 이용자의 개인 식별 정보를 수집하지 않으며, 서비스 개선 및 통계 분석을 위한 브라우저 쿠키만 활용합니다. 제3자 광고 서비스(Google AdSense)는 맞춤형 광고 제공을 위해 비식별 정보를 사용할 수 있습니다.</p>` },
      terms: { title: "이용약관", content: `<h2>이용약관</h2><p>본 서비스는 공개된 데이터를 수집하여 제공하며, 정보의 정확성을 100% 보장하지 않습니다. 이용 과정에서 발생하는 결과에 대한 책임은 이용자 본인에게 있습니다.</p>` },
      contact: { title: "문의하기", content: `<h2>문의하기</h2><p>서비스 이용 관련 문의나 제안은 help@trendup.ai로 이메일을 보내주시기 바랍니다.</p>` }
    }
  },
  ja: { 
    title: "トレンド", update: "最終更新", summary: "急上昇の背景", news: "記事", videos: "動画", loading: "分析中...", T: "T", L: "L", 
    infoTitle: "TrendUpについて", infoDesc: "各国のリアルタイム急上昇キーワードをひと目で確認し、世界の潮流を把握しましょう。",
    cookie: "本サイトはユーザー体験向上のためにクッキーを使用しています。", accept: "確認",
    siteGuide: "サイト案内", menuAbout: "TrendUpについて", menuPrivacy: "個人情報保護方針", menuTerms: "利用規約", menuContact: "お問い合わせ",
    analysisTemplate: (title, sources, snippets) => `現在「${title}」は、${sources.join('、')}などの主要メディアで集中的に報じられ、大きな話題となっています。\n\n${snippets.join('\n\n')}\n\nこれらのニュースが伝えられる中、世間の注目が集まり、リアルタイムトレンドに浮上しました。`,
    pages: {
      about: { title: "TrendUpについて", content: `<h2>TrendUpサービス紹介</h2><p>TrendUpは、リアルタイムのグローバルトレンドをAI技術で分析・要約するダッシュボードです。</p><h3>提供情報</h3><ul><li>主要国のリアルタイム人気検索ワード TOP 10</li><li>ニュースに基づくトレンド背景の要約</li><li>関連ニュースおよび動画リンク</li></ul>` },
      privacy: { title: "個人情報保護方針", content: `<h2>個人情報保護方針</h2><p>TrendUpは利用者の個人識別 정보를 収集せず、サービス改善のためのクッキーのみを使用します。第三者広告サービス（Google AdSense）は、最適な広告提供のために非識別情報を使用することがあります。</p>` },
      terms: { title: "利用規約", content: `<h2>利用規約</h2><p>本サービスは公開データを収集して提供しており、情報の正確性を完全に保証するものではありません。利用によって生じる結果については、利用者が責任を負うものとします。</p>` },
      contact: { title: "お問い合わせ", content: `<h2>お問い合わせ</h2><p>お問い合わせやご提案は、help@trendup.aiまでメールをお送りください。</p>` }
    }
  },
  en: { 
    title: "Trending", update: "Updated", summary: "Trending Context", news: "News", videos: "Videos", loading: "Analyzing...", T: "T", L: "L", 
    infoTitle: "About TrendUp", infoDesc: "Explore real-time trending keywords from various countries and stay updated with global topics.",
    cookie: "This site uses cookies to improve user experience.", accept: "Accept",
    siteGuide: "Site Information", menuAbout: "About TrendUp", menuPrivacy: "Privacy Policy", menuTerms: "Terms of Service", menuContact: "Contact Us",
    analysisTemplate: (title, sources, snippets) => `The topic '${title}' is currently gaining significant attention through major outlets such as ${sources.join(', ')}.\n\n${snippets.join('\n\n')}\n\nAs these reports circulate across various channels, public interest has surged, placing it on the real-time trending list.`,
    pages: {
      about: { title: "About TrendUp", content: `<h2>About TrendUp</h2><p>TrendUp is a dashboard that analyzes and summarizes global real-time trends using AI technology.</p><h3>What we provide</h3><ul><li>Real-time Top 10 trending keywords from major countries</li><li>AI-powered summaries of trending context based on news</li><li>Links to related news and videos</li></ul>` },
      privacy: { title: "Privacy Policy", content: `<h2>Privacy Policy</h2><p>TrendUp does not collect personally identifiable information. We only use browser cookies for service improvement and analytics. Third-party advertising services (Google AdSense) may use non-identifying information to provide personalized ads.</p>` },
      terms: { title: "Terms of Service", content: `<h2>Terms of Service</h2><p>This service provides information collected from public data and does not guarantee 100% accuracy. Users are responsible for their use of the information provided.</p>` },
      contact: { title: "Contact Us", content: `<h2>Contact Us</h2><p>For inquiries or suggestions, please email us at help@trendup.ai.</p>` }
    }
  }
};

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
    this.shadowRoot.innerHTML = `<style>:host { display: block; } .list { display: flex; flex-direction: column; gap: 0.75rem; } .item { display: grid; grid-template-columns: 40px 1fr auto; align-items: center; background: var(--surface); padding: 1.2rem; border-radius: 16px; border: 1px solid var(--border); transition: 0.2s; color: var(--text); cursor: pointer; } .item:hover { border-color: var(--primary); transform: translateY(-2px); box-shadow: var(--shadow-hover); } .rank { font-size: 1.2rem; font-weight: 900; color: var(--primary); opacity: 0.8; } .title { font-size: 1.05rem; font-weight: 700; padding-right: 0.5rem; line-height: 1.4; } .growth { font-size: 1rem; font-weight: 800; display: flex; align-items: center; justify-content: center; min-width: 40px; } .loading { text-align: center; padding: 4rem; color: var(--text-muted); font-size: 0.9rem; } .source-badge { font-size: 0.6rem; color: var(--text-muted); opacity: 0.6; display: block; margin-top: 0.2rem; }</style>
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
    this.shadowRoot.innerHTML = `<style>.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 5000; opacity: 0; pointer-events: none; transition: 0.3s; } .overlay.active { opacity: 1; pointer-events: auto; } .modal { background: var(--bg); width: 92%; max-width: 500px; max-height: 80vh; border-radius: 24px; padding: 2rem; border: 1px solid var(--border); box-shadow: var(--shadow-hover); overflow-y: auto; position: relative; } .close { position: absolute; top: 1rem; right: 1rem; cursor: pointer; border: none; background: var(--border); width: 32px; height: 32px; border-radius: 50%; font-size: 1.2rem; color: var(--text); } .title { font-size: 1.4rem; font-weight: 800; margin-bottom: 1.5rem; color: var(--text); padding-right: 1.5rem; } .section-title { font-weight: 800; color: var(--primary); margin: 1.5rem 0 0.5rem; display: block; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; } .text { line-height: 1.6; color: var(--text); margin-bottom: 1.5rem; font-size: 0.95rem; white-space: pre-wrap; } .link-group { display: flex; flex-direction: column; gap: 0.5rem; } .link { padding: 0.8rem 1rem; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; text-decoration: none; color: var(--text); font-size: 0.85rem; display: flex; align-items: center; gap: 0.5rem; transition: 0.2s; } .link:hover { border-color: var(--primary); background: var(--border); }</style>
      <div class="overlay active"><div class="modal"><button class="close">&times;</button><h2 class="title">${trend.title}</h2><span class="section-title">✨ ${t.summary}</span><p class="text">${analysis}</p><span class="section-title">📰 ${t.news}</span><div class="link-group">${trend.newsLinks.slice(0,3).map(l => `<a href="${l.url}" target="_blank" class="link">📄 ${l.title}</a>`).join('')}</div><span class="section-title">🎬 ${t.videos}</span><div class="link-group">${trend.videoLinks.map(l => `<a href="${l.url}" target="_blank" class="link">▶️ ${l.title}</a>`).join('')}</div></div></div>`;
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
    this.currentRequestId = 0; // Track current request
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
  async switchLang(code) { this.currentLang = code; localStorage.setItem('lang', code); this.renderNavs(); this.initCookieBanner(); await this.update(true); }
  async update(isLanguageSwitch = false) {
    const requestId = ++this.currentRequestId;
    const refreshIcon = document.getElementById('refresh-icon');
    if (refreshIcon) refreshIcon.classList.remove('hidden');

    try {
      const delayPromise = isLanguageSwitch ? Promise.resolve() : new Promise(resolve => setTimeout(resolve, 3500));
      const trendsPromise = this.service.getTrends(this.currentCountry, this.currentLang);
      
      const [trends] = await Promise.all([trendsPromise, delayPromise]);
      
      if (requestId !== this.currentRequestId) return;

      const t = i18n[this.currentLang] || i18n.en;

      if (trends && trends.length >= 5) {
        if (document.getElementById('top-trends')) {
          document.getElementById('top-trends').data = { trends, lang: this.currentLang };
        }
      }

      if (document.getElementById('current-country-title')) document.getElementById('current-country-title').textContent = t.title;
      if (document.querySelector('.info-card h3')) document.querySelector('.info-card h3').textContent = t.infoTitle;
      if (document.querySelector('.info-card p')) document.querySelector('.info-card p').textContent = t.infoDesc;
      
      const siteGuide = document.querySelector('.policy-card h4');
      if (siteGuide) siteGuide.textContent = t.siteGuide;

      document.querySelectorAll('[data-page]').forEach(el => {
        const key = el.getAttribute('data-page');
        if (key === 'about') el.textContent = t.menuAbout;
        if (key === 'privacy') el.textContent = t.menuPrivacy;
        if (key === 'terms') el.textContent = t.menuTerms;
        if (key === 'contact') el.textContent = t.menuContact;
      });

      if (document.getElementById('last-updated')) { 
        const now = new Date(); 
        document.getElementById('last-updated').textContent = `${t.update}: ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`; 
      }
    } catch (e) { 
      if (requestId === this.currentRequestId) console.error("Update failed:", e);
    } finally {
      if (requestId === this.currentRequestId && refreshIcon) refreshIcon.classList.add('hidden');
    }
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => new App());
else new App();
