import * as THREE from 'three';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, Timestamp, initializeFirestore } from 'firebase/firestore';

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
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12.2.41 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path></svg>`,
  moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`,
  system: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12.2.40"></path><path d="M12 7V17"></path><path d="M12 12h5"></path><path d="M12.2.40 10 0 0 0 0 20z" fill="currentColor" fill-opacity="0.3"></path></svg>`
};

// --- Localization ---
let i18n = {
  ko: { 
    title: "실시간 글로벌 트렌드", update: "최근 업데이트", summary: "AI 분석 리포트", news: "주요 관련 뉴스", videos: "유튜브 미디어", loading: "데이터 분석 중...", T: "트렌드 설정", L: "언어 설정", original: "원문",
    menu: { about: "TrendUp 소개", privacy: "개인정보처리방침", terms: "이용약관", contact: "문의하기", siteInfo: "사이트 정보" },
    pages: {
      about: { 
        title: "TrendUp: 글로벌 트렌드 인텔리전스", 
        content: `
          <h2 style="margin-bottom:1.5rem;">세상을 읽는 가장 빠른 방법, TrendUp</h2>
          <p style="margin-bottom:1rem; line-height:1.8;">TrendUp은 고도화된 빅데이터 처리 기술과 최신 인공지능(AI) 엔진을 결합하여 대한민국, 일본, 미국 등 주요 국가의 실시간 검색 흐름과 이슈를 분석하고 시각화하는 차세대 데이터 인텔리전스 플랫폼입니다.</p>
          <h3 style="margin:1.5rem 0 0.5rem; border-left:4px solid var(--primary); padding-left:0.8rem;">핵심 기술 및 서비스</h3>
          <ul style="margin-bottom:1rem; padding-left:1.2rem; list-style:disc; line-height:1.8;">
            <li><strong>실시간 데이터 파이프라인:</strong> 전 세계의 신뢰도 높은 트렌드 데이터를 10분 단위로 수집 및 정규화하여 가장 신선한 정보를 제공합니다.</li>
            <li><strong>문맥 기반 AI 분석:</strong> 단순 키워드 나열을 넘어, AI가 해당 트렌드의 발생 배경과 맥락을 파악하여 사용자의 언어로 요약 리포트를 생성합니다.</li>
            <li><strong>글로벌 인사이트:</strong> 국가별 트렌드 비교를 통해 지역적 특색과 전 세계적인 공통 관심사를 한눈에 파악할 수 있습니다.</li>
          </ul>
        ` 
      },
      privacy: { 
        title: "개인정보 처리방침 (Privacy Policy)", 
        content: `
          <h2 style="margin-bottom:1.5rem;">개인정보 처리방침</h2>
          <p style="margin-bottom:1rem;">TrendUp(이하 '서비스')은 이용자의 개인정보 보호를 최우선으로 생각하며, 관련 법령을 준수합니다. (v2.4.5)</p>
          <h3>1. 개인정보 수집 및 이용</h3>
          <p>본 서비스는 회원가입 없이 모든 기능을 이용할 수 있습니다. 다만, 서비스 이용 과정에서 접속 IP, 쿠키, 브라우저 정보, 방문 기록 등이 서비스 최적화 및 광고 게재를 위해 자동 생성되어 수집될 수 있습니다.</p>
          <h3>2. 구글 애드센스 및 쿠키 사용 고지</h3>
          <p>본 사이트는 구글(Google)에서 제공하는 웹 광고 서비스인 '구글 애드센스'를 사용합니다. 구글은 쿠키(Cookie)를 사용하여 사용자가 본 사이트 또는 다른 사이트를 방문한 기록을 바탕으로 맞춤형 광고를 게재합니다.</p>
          <p>사용자는 구글의 <a href="https://www.google.com/settings/ads" target="_blank" style="color:var(--primary);">광고 설정</a>을 방문하여 개인 맞춤형 광고를 해제할 수 있습니다. 자세한 내용은 구글의 <a href="https://policies.google.com/technologies/ads" target="_blank" style="color:var(--primary);">개인정보 보호 및 약관</a>을 참조하시기 바랍니다.</p>
          <h3>3. 개인정보의 보호 및 관리</h3>
          <p>수집된 정보는 서비스 개선 및 통계 분석 목적으로만 사용되며, 법령에 정해진 경우를 제외하고는 이용자의 동의 없이 제3자에게 제공되지 않습니다.</p>
        ` 
      },
      terms: { 
        title: "서비스 이용약관 (Terms of Service)", 
        content: `
          <h2 style="margin-bottom:1.5rem;">서비스 이용약관</h2>
          <p style="margin-bottom:1rem;">본 약관은 TrendUp 서비스 이용과 관련하여 필요한 사항을 규정합니다.</p>
          <h3>1. 정보의 정확성에 관한 면책</h3>
          <p>본 서비스에서 제공하는 모든 트렌드 데이터 및 AI 분석 내용은 공개된 정보를 바탕으로 자동 생성된 결과물입니다. 정보의 실시간성, 정확성, 완전성을 보장하지 않으며, 투자 판단이나 중요한 의사결정의 근거로 사용되기에 적합하지 않습니다. 정보 이용으로 인해 발생하는 결과에 대해 본 서비스는 책임을 지지 않습니다.</p>
          <h3>2. 서비스 이용 제한</h3>
          <p>본 서비스의 서버에 과도한 부하를 주거나, 비정상적인 방법(스크레이핑, 봇 등)으로 데이터를 무단 수집하는 행위를 엄격히 금지합니다.</p>
          <h3>3. 약관의 개정</h3>
          <p>본 서비스는 운영상 필요한 경우 관련 법령을 위배하지 않는 범위 내에서 본 약관을 개정할 수 있습니다.</p>
        ` 
      },
      contact: { 
        title: "문의 및 고객 지원 (Contact Us)", 
        content: `
          <h2 style="margin-bottom:1.5rem;">고객 지원 센터</h2>
          <p style="margin-bottom:1rem;">TrendUp 서비스와 관련된 제안, 피드백, 비즈니스 협력 등 모든 문의 사항은 아래의 이메일로 연락 주시기 바랍니다.</p>
          <p><strong>Email:</strong> <a href="mailto:help@trendup.ai" style="color:var(--primary);">help@trendup.ai</a></p>
          <p style="margin-top:1rem; font-size:0.85rem; color:var(--text-muted);">※ 문의 주신 내용은 검토 후 순차적으로 답변해 드리고 있으나, 사안에 따라 답변이 지연되거나 제한될 수 있습니다.</p>
        ` 
      }
    }
  },
  ja: { 
    title: "リアルタイムトレンド", 
    update: "最終更新", 
    summary: "AI分析レポート", 
    news: "関連ニュース", 
    videos: "YouTubeニュース", 
    loading: "読み込み中...", 
    original: "原文", 
    menu: { about: "TrendUpについて", privacy: "個人情報保護方針", terms: "利用規約", contact: "お問い合わせ", siteInfo: "サイト案内" }, 
    pages: { 
      about: { 
        title: "TrendUpについて", 
        content: `
          <h2 style="margin-bottom:1.5rem;">TrendUp：世界を読む、最速のインテリジェンス</h2>
          <p style="margin-bottom:1rem; line-height:1.8;">TrendUpは、ビッグデータ処理技術と最新のAIエンジンを駆使し、日本、韓国、アメリカなどの主要国における検索トレンドをリアルタイムで分析・可視化する次世代のデータ分析プラットフォームです。</p>
          <h3 style="margin:1.5rem 0 0.5rem; border-left:4px solid var(--primary); padding-left:0.8rem;">主な特徴</h3>
          <ul style="margin-bottom:1rem; padding-left:1.2rem; list-style:disc; line-height:1.8;">
            <li><strong>リアルタイム・データパイプライン：</strong>各国のトレンドデータを最短10分間隔で取得し、最新の情報を提供します。</li>
            <li><strong>AIによる多言語要約：</strong>検索キーワードの背景をAIが分析し、ユーザーの言語で分かりやすく要約します。</li>
            <li><strong>グローバル視点：</strong>国別のトレンド比較を通じて、世界規模での関心事の変化を捉えることができます。</li>
          </ul>
        ` 
      }, 
      privacy: { 
        title: "個人情報保護方針 (Privacy Policy)", 
        content: `
          <h2 style="margin-bottom:1.5rem;">個人情報保護方針</h2>
          <p style="margin-bottom:1rem;">TrendUp（以下「当サービス」）は、ユーザーのプライバシーを尊重し、個人情報の保護に努めます。(v2.4.5)</p>
          <h3>1. 情報の収集について</h3>
          <p>当サービスでは、ユーザー登録なしで利用可能ですが、アクセス解析や広告配信のために、IPアドレス、クッキー（Cookie）、ブラウザ情報などが自動的に収集される場合があります。</p>
          <h3>2. 広告の配信について（Googleアドセンス）</h3>
          <p>当サービスは、第三者配信の広告サービス「Googleアドセンス」を利用しています。広告配信事業者は、ユーザーの興味に応じた広告を表示するためにクッキー（Cookie）を使用することがあります。これにより、当サイトや他のサイトへの過去のアクセス情報に基づいた広告が配信されます。</p>
          <p>ユーザーは、Googleの広告設定でパーソナライズ広告を無効にできます。詳細はGoogleの <a href="https://policies.google.com/technologies/ads" target="_blank" style="color:var(--primary);">広告に関する規約</a> をご確認ください。</p>
          <h3>3. 免責事項</h3>
          <p>当サイトからリンクやバナーなどによって他のサイトに移動された場合、移動先サイトで提供される情報、サービス等について一切の責任を負いません。</p>
        ` 
      }, 
      terms: { 
        title: "サービス利用規約 (Terms of Service)", 
        content: `
          <h2 style="margin-bottom:1.5rem;">サービス利用規約</h2>
          <p style="margin-bottom:1rem;">当サービスを利用することにより、本規約に同意したものとみなされます。</p>
          <h3>1. データの正確性について</h3>
          <p>当サービスが提供するトレンドデータおよびAIによる要約は、外部の公開情報を基に自動生成されています。情報の正確性、完全性、有用性について保証するものではありません。投資や重要な意思決定の判断材料として利用しないでください。</p>
          <h3>2. 禁止事項</h3>
          <p>当サービスのサーバーに過度な負荷をかける行為や、スクレイピング等によるデータの無断取得を禁止します。</p>
          <h3>3. 規約の変更</h3>
          <p>当サービスは、必要に応じて本規約をいつでも変更できるものとします。</p>
        ` 
      }, 
      contact: { 
        title: "お問い合わせ (Contact)", 
        content: `
          <h2 style="margin-bottom:1.5rem;">お問い合わせ</h2>
          <p style="margin-bottom:1rem;">当サービスに関するご質問、フィードバック、ビジネスに関するお問い合わせは、以下のメールアドレスまでご連絡ください。</p>
          <p><strong>Email:</strong> help@trendup.ai</p>
          <p style="margin-top:1rem; font-size:0.85rem; color:var(--text-muted);">※お問い合わせ内容によっては、回答にお時間をいただく場合や、お答えできない場合がございます。</p>
        ` 
      } 
    } 
  },
  en: { 
    title: "Global Trends", 
    update: "Updated", 
    summary: "AI Analysis Report", 
    news: "Top Stories", 
    videos: "YouTube News", 
    loading: "Loading...", 
    original: "Original", 
    menu: { about: "About TrendUp", privacy: "Privacy Policy", terms: "Terms of Service", contact: "Contact Us", siteInfo: "Site Info" }, 
    pages: { 
      about: { 
        title: "About TrendUp", 
        content: `
          <h2 style="margin-bottom:1.5rem;">TrendUp: Global Trend Intelligence</h2>
          <p style="margin-bottom:1rem; line-height:1.8;">TrendUp is a data analysis platform that combines big data processing technology with the latest artificial intelligence (AI) engines to analyze and visualize search trends in real-time from major countries including the United States, Japan, and Korea.</p>
          <h3 style="margin:1.5rem 0 0.5rem; border-left:4px solid var(--primary); padding-left:0.8rem;">Core Features</h3>
          <ul style="margin-bottom:1rem; padding-left:1.2rem; list-style:disc; line-height:1.8;">
            <li><strong>Real-time Data Pipeline:</strong> We normalize high-reliability data from each country every 10 minutes.</li>
            <li><strong>Context-based AI Translation:</strong> Our AI understands the context of keywords and provides optimized translations.</li>
            <li><strong>Global Insight:</strong> Track the lifecycle of trends through precise ranking change monitoring across the globe.</li>
          </ul>
        ` 
      }, 
      privacy: { 
        title: "Privacy Policy", 
        content: `
          <h2 style="margin-bottom:1.5rem;">Privacy Policy</h2>
          <p style="margin-bottom:1rem;">TrendUp ("Service") values users' personal information and complies with relevant laws and regulations. (v2.4.5)</p>
          <h3>1. Information Collection</h3>
          <p>Users can use the service without registration. However, access IP, cookies, and browser information may be automatically collected for analytics and advertising purposes.</p>
          <h3>2. Advertising and Cookies (Google AdSense)</h3>
          <p>This site uses Google AdSense, a web advertising service provided by Google. Google uses cookies to serve ads based on a user's prior visits to this website or other websites. Google's use of advertising cookies enables it and its partners to serve ads to users based on their visit to your sites and/or other sites on the Internet.</p>
          <p>Users may opt out of personalized advertising by visiting <a href="https://www.google.com/settings/ads" target="_blank" style="color:var(--primary);">Ads Settings</a>. For more information, please review Google's <a href="https://policies.google.com/technologies/ads" target="_blank" style="color:var(--primary);">Privacy & Terms</a>.</p>
          <h3>3. Data Security</h3>
          <p>We implement various security measures to maintain the safety of your personal information when you access our site.</p>
        ` 
      }, 
      terms: { 
        title: "Terms of Service", 
        content: `
          <h2 style="margin-bottom:1.5rem;">Terms of Service</h2>
          <p style="margin-bottom:1rem;">By using TrendUp, you agree to comply with and be bound by the following terms.</p>
          <h3>1. Accuracy of Information</h3>
          <p>All trending data and AI-generated summaries are based on publicly available information and are provided for reference only. We do not guarantee the accuracy, completeness, or usefulness of the information. Do not use this as a basis for investment or critical decision-making.</p>
          <h3>2. Prohibited Uses</h3>
          <p>You are prohibited from using the service for any illegal purpose or to violate any laws. Unauthorized data acquisition via scraping or excessive server load is strictly prohibited.</p>
          <h3>3. Modifications</h3>
          <p>We reserve the right to change these terms at any time. Your continued use of the service after changes constitutes acceptance of the new terms.</p>
        ` 
      }, 
      contact: { 
        title: "Contact Us", 
        content: `
          <h2 style="margin-bottom:1.5rem;">Contact Us</h2>
          <p style="margin-bottom:1rem;">If you have any questions, feedback, or business inquiries regarding our service, please contact us via email.</p>
          <p><strong>Email:</strong> help@trendup.ai</p>
          <p style="margin-top:1rem; font-size:0.85rem; color:var(--text-muted);">※ Depending on the content of your inquiry, it may take some time to respond, or we may not be able to answer certain requests.</p>
        ` 
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
    // USE PRE-GENERATED AI REPORT (STRICTLY FROM DB)
    let analysis = trend.aiReport || (trend.snippets && trend.snippets.length > 0 ? trend.snippets.join(' ') : "AI Analysis Report Loading...");
    
    // Final Polish: Clean up any remaining Korean traces if language is Japanese
    if (this.currentLang === 'ja') {
      analysis = analysis
        .replace(/일본/g, '日本')
        .replace(/대한민국/g, '韓国')
        .replace(/미국/g, 'アメリカ')
        .replace(/이\(가\)/g, '')
        .replace(/내에서/g, '国内で')
        .replace(/가 /g, 'が ');
    }
    this.render(trend, lang, analysis);
  }
  hide() { this.isVisible = false; this.shadowRoot.innerHTML = ''; }
  render(trend, lang, analysis) {
    const t = i18n[lang] || i18n.en;
    this.shadowRoot.innerHTML = `<style>.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 9999; cursor: pointer; } .modal { background: var(--bg); width: 92%; max-width: 500px; max-height: 85vh; border-radius: 24px; padding: 2rem; border: 1px solid var(--border); box-shadow: var(--shadow-hover); overflow-y: auto; position: relative; cursor: default; } .close { position: absolute; top: 1rem; right: 1rem; cursor: pointer; border: none; background: var(--border); width: 32px; height: 32px; border-radius: 50%; font-size: 1.2rem; color: var(--text); display: flex; align-items: center; justify-content: center; } .title { font-size: 1.4rem; font-weight: 800; margin-bottom: 1.5rem; color: var(--text); } .section-title { font-weight: 800; color: var(--primary); margin: 1.5rem 0 0.5rem; display: block; font-size: 0.8rem; text-transform: uppercase; } .text { line-height: 1.6; color: var(--text); margin-bottom: 1.5rem; font-size: 0.95rem; white-space: pre-wrap; } .link-group { display: flex; flex-direction: column; gap: 0.5rem; } .link { padding: 0.8rem 1rem; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; text-decoration: none; color: var(--text); font-size: 0.85rem; display: flex; flex-direction: column; } .link-meta { font-size: 0.7rem; font-weight: 800; color: var(--primary); opacity: 0.7; }</style>
      <div class="overlay"><div class="modal"><button class="close">&times;</button><h2 class="title">${trend.originalTitle || trend.title}</h2><span class="section-title">✨ ${t.summary}</span><p class="text">${analysis}</p><span class="section-title">📰 ${t.news}</span><div class="link-group">${(trend.newsLinks || []).slice(0,3).map(l => `<a href="${l.url}" target="_blank" class="link"><span class="link-meta">${l.source}</span><span>📄 ${l.title}</span></a>`).join('')}</div>${(trend.videoLinks && trend.videoLinks.length > 0) ? `<span class="section-title">🎬 ${t.videos}</span><div class="link-group">${trend.videoLinks.map(v => `<a href="${v.url}" target="_blank" class="link"><span class="link-meta">${v.source}</span><span>🎥 ${v.title}</span></a>`).join('')}</div>` : ''}</div></div>`;
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
    this.currentCountry = localStorage.getItem('country') || this.service.autoDetectCountry();
    this.currentLang = localStorage.getItem('lang') || (this.currentCountry === 'KR' ? 'ko' : this.currentCountry === 'JP' ? 'ja' : 'en');
    this.themeMode = localStorage.getItem('theme-mode') || 'system';
    this.db = null;
    this.init();
  }
  async init() {
    console.log("App Init: v2.4.5");
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
      this.db = initializeFirestore(app, { experimentalForceLongPolling: true });
      this.renderNavs();
      await this.update();
    } catch (e) { console.error("Firebase init failed:", e.message); }
  }
  refreshUIText() {
    try {
      const t = i18n[this.currentLang] || i18n.en;
      document.getElementById('current-country-title').textContent = t.title;
      const footerText = document.querySelector('.footer-content p');
      if (footerText) footerText.textContent = `© 2026 TrendUp. All rights reserved. (v2.4.5)`;
      
      const menuTitles = document.querySelectorAll('.menu-section .menu-title');
      if (menuTitles[0]) menuTitles[0].textContent = t.T || "Trend Settings";
      if (menuTitles[1]) menuTitles[1].textContent = t.menu.siteInfo;

      document.querySelectorAll('.nav-label').forEach(label => {
        const text = label.textContent.toLowerCase();
        if (text.includes('trend')) label.textContent = t.labels?.trends || "Country:";
        if (text.includes('lang')) label.textContent = t.labels?.language || "Language:";
      });

      document.querySelectorAll('[data-page]').forEach(link => {
        const key = link.getAttribute('data-page');
        if (t.menu && t.menu[key]) link.textContent = t.menu[key];
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
    const triggerIcon = document.querySelector('.theme-trigger-icon');
    if (triggerIcon) {
      if (mode === 'light') triggerIcon.innerHTML = ICONS.sun;
      else if (mode === 'dark') triggerIcon.innerHTML = ICONS.moon;
      else triggerIcon.innerHTML = ICONS.system;
    }
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
  async switchCountry(code) { this.currentCountry = code; localStorage.setItem('country', code); this.loadLocalCache(); this.renderNavs(); await this.update(); }
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
          const aiReport = item.aiReports?.[this.currentLang] || "";
          
          return {
            ...item,
            displayTitle: originalTitle,
            translatedSubTitle: (translatedTitle !== originalTitle) ? translatedTitle : "",
            aiReport: aiReport
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
