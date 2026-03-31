import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, Timestamp, initializeFirestore, query, where, limit, orderBy } from 'firebase/firestore';

const ICONS = {
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`,
  moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`,
  system: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2v20" opacity="0.5"></path><path d="M12 2a10 10 0 0 0 0 20z" fill="currentColor"></path></svg>`
};

// --- Localization ---
let i18n = {
  ko: { 
    title: "실시간 글로벌 트렌드", update: "업데이트", summary: "AI 분석 리포트", news: "관련 뉴스", videos: "YouTube 뉴스", loading: "불러오는 중...", T: "트렌드 설정", L: "언어 설정", original: "원문보기",
    labels: { trends: "국가:", language: "언어:", featuredReports: "📅 분석 리포트 수록" },
    reports: { title: "트렌드 리포트", weekly: "주간 리포트", monthly: "월간 리포트", yearly: "년간 리포트", comingSoon: "데이터 집계 중...", pastReports: "과거 리포트 모아보기", view: "리포트 보기", latest: "최신 리포트", currAgg: "현재 집계 중", viewPast: "과거 내역 보기" },
    menu: { about: "TrendUp 소개", privacy: "개인정보처리방침", terms: "이용약관", contact: "문의하기", siteInfo: "사이트 정보" }, 
    pages: { 
      about: { 
        title: "TrendUp 소개", 
        content: `
          <h2 style="margin-bottom:1.5rem;">세상을 읽는 가장 빠른 인텔리전스, TrendUp</h2>
          <p style="margin-bottom:1.2rem; line-height:1.8;">TrendUp은 고도의 빅데이터 처리 기술과 최신 AI 엔진(Google Gemini 2.5)을 융합하여 한국, 일본, 미국 등 주요 국가의 실시간 검색 트렌드를 분석하고 시각화하는 차세대 데이터 인텔리전스 플랫폼입니다.</p>
          <h3 style="margin:1.5rem 0 0.8rem; border-left:4px solid var(--primary); padding-left:0.8rem; font-size:1.1rem;">우리의 미션</h3>
          <p style="margin-bottom:1.2rem; line-height:1.8;">정보의 홍수 속에서 가장 가치 있는 '맥락'을 찾아내는 것이 우리의 목표입니다. 단순한 키워드 나열이 아닌, 왜 이 키워드가 지금 뜨고 있는지, 어떤 사회적 배경이 있는지 심층 분석하여 사용자에게 전달합니다.</p>
          <h3 style="margin:1.5rem 0 0.8rem; border-left:4px solid var(--primary); padding-left:0.8rem; font-size:1.1rem;">주요 기술력</h3>
          <ul style="margin-bottom:1.2rem; padding-left:1.5rem; list-style:disc; line-height:1.8;">
            <li><strong>실시간 글로벌 파이프라인:</strong> 신뢰도 높은 소스로부터 10분 단위로 데이터를 수집·정규화합니다.</li>
            <li><strong>문맥 기반 AI 요약:</strong> 뉴스 조각들과 소셜 반응을 종합하여 리포트 형태로 재구성합니다.</li>
            <li><strong>다국어 인사이트:</strong> 언어의 장벽을 넘어 각국의 트렌드를 모국어로 이해할 수 있도록 정교한 번역을 지원합니다.</li>
          </ul>` 
      },
      privacy: { 
        title: "개인정보 처리방침 (Privacy Policy)", 
        content: `
          <h2 style="margin-bottom:1.5rem;">개인정보 처리방침</h2>
          <p style="margin-bottom:1rem; line-height:1.6;">TrendUp(이하 '본 사이트')은 방문자의 개인정보 보호를 중요하게 생각하며, 관련 법령을 준수합니다. 본 방침은 수집되는 정보의 종류와 사용 목적, 그리고 구글 애드센스 게재 사항을 안내합니다.</p>
          <h3 style="margin:1.2rem 0 0.5rem; font-size:1rem;">1. 개인정보 수집 및 목적</h3>
          <p style="margin-bottom:1rem; line-height:1.6;">본 사이트는 가입이나 식별 정보를 요구하지 않습니다. 다만 통계 분석 및 광고 게재를 위해 기본 접속 로그(IP 주소, 브라우저 종류 등)가 자동 수집될 수 있습니다.</p>
          <h3 style="margin:1.2rem 0 0.5rem; font-size:1rem;">2. 구글 애드센스 사용</h3>
          <p style="margin-bottom:0.8rem; line-height:1.6;">본 사이트는 광고 수익으로 무료 운영되며, 이를 위해 <strong>구글 애드센스(Google AdSense)</strong>를 사용합니다.</p>
          <ul style="margin-bottom:1rem; padding-left:1.5rem; list-style:circle; line-height:1.6;">
            <li>구글은 이전 방문 기록을 바탕으로 광고를 게재하기 위해 쿠키를 사용합니다.</li>
            <li>사용자는 <a href="https://adssettings.google.com" target="_blank" style="color:var(--primary);">구글 광고 설정</a>에서 맞춤 광고를 해제할 수 있습니다.</li>
          </ul>
          <h3 style="margin:1.2rem 0 0.5rem; font-size:1rem;">3. 문의처</h3>
          <p style="margin-bottom:1rem; line-height:1.6;">문의: <a href="mailto:help@globaltrendup.com" style="color:var(--primary);">help@globaltrendup.com</a></p>` 
      },
      terms: { 
        title: "서비스 이용약관 (Terms of Service)", 
        content: `
          <h2 style="margin-bottom:1.5rem;">서비스 이용약관</h2>
          <p style="margin-bottom:1rem; line-height:1.6;">본 약관은 TrendUp 서비스(이하 '서비스') 이용과 관련하여 제공자와 이용자 간의 제반 권리, 의무 및 책임 사항을 규정함을 목적으로 합니다. 서비스를 이용함으로써 귀하는 본 약관에 동의하는 것으로 간주됩니다.</p>
          <h3 style="margin:1.2rem 0 0.5rem; font-size:1rem;">1. 서비스의 목적 및 제공 내용</h3>
          <p style="margin-bottom:0.8rem; line-height:1.6;">본 서비스는 공개된 웹 데이터를 바탕으로 인공지능(AI)이 자동 생성한 트렌드 분석 정보를 제공합니다. 제공되는 데이터, 분석 결과, 번역 등은 기술적 한계나 원본 데이터의 오류 등으로 인해 실제 사실과 다를 수 있습니다.</p>
          <h3 style="margin:1.2rem 0 0.5rem; font-size:1rem;">2. 면책 고지 (중요)</h3>
          <p style="margin-bottom:1rem; line-height:1.6; color:var(--text-muted);">* 본 서비스에서 제공하는 모든 정보는 단순 참고용일 뿐이며, 어떠한 형태의 투자 조언이나 법적, 의학적, 전문적 조언을 대신하지 않습니다. 이용자가 본 서비스의 정보를 바탕으로 내린 결정이나 취한 조치로 인해 발생하는 직간접적인 손실 및 피해에 대해, 당사는 어떠한 법적 책임도 지지 않습니다.</p>
          <h3 style="margin:1.2rem 0 0.5rem; font-size:1rem;">3. 지적재산권 및 서비스 이용 제한</h3>
          <p style="margin-bottom:1rem; line-height:1.6;">본 서비스가 제공하는 로고, 디자인, UI, AI 분석 텍스트 등 제반 콘텐츠에 대한 권리는 TrendUp 운영진에 귀속됩니다. 이용자는 본 서비스를 비상업적인 개인적 목적으로만 이용해야 하며, 사전 서면 동의 없는 상업적 이용, 무단 크롤링(웹 스크래핑), 데이터 복제 및 재배포, 그리고 시스템의 정상적 운영을 방해하는 해킹 등 모든 불법적 행위를 엄격히 금지합니다.</p>
          <h3 style="margin:1.2rem 0 0.5rem; font-size:1rem;">4. 서비스의 변경 및 중단</h3>
          <p style="margin-bottom:1rem; line-height:1.6;">운영상 또는 기술상의 필요(예: API 정책 변화, 서버 점검 등)에 따라 사전 공지 없이 본 서비스의 전부 또는 일부 기능이 예고 없이 변경되거나 중단될 수 있습니다. 이로 인해 발생하는 불편에 대해 당사는 책임지지 않습니다.</p>` 
      },
      contact: { 
        title: "문의하기", 
        content: `
          <h2 style="margin-bottom:1.5rem;">문의하기</h2>
          <p style="margin-bottom:1.2rem; line-height:1.8;">버그 리포트, 제휴 문의는 <a href="mailto:help@globaltrendup.com" style="color:var(--primary);">help@globaltrendup.com</a>을 이용해 주세요. 최대 48시간 이내에 회신해 드립니다.</p>` 
      },
      cookie: { text: "TrendUp은 원활한 서비스 및 맞춤형 콘텐츠 제공을 위해 쿠키를 활용합니다.", btn: "동의 및 계속" }
    }
  },
  ja: { 
    title: "リアルタイムトレンド", update: "最終更新", summary: "AI分析レポート", news: "関連ニュース", videos: "YouTubeニュース", loading: "読み込み中...", T: "トレンド設定", L: "言語設定", original: "原文",
    labels: { trends: "国:", language: "言語:", featuredReports: "📅 掲載リ포트 분석" },
    reports: { title: "トレンドレポート", weekly: "週間レポート", monthly: "月間レポート", yearly: "年間レポート", comingSoon: "データ集計中...", pastReports: "過去のレポート", view: "レポートを見る", latest: "最新レポート", currAgg: "現在集計中", viewPast: "過去履歴表示" },

    menu: { about: "TrendUpについて", privacy: "プライバシーポリシー", terms: "利用規約", contact: "お問い合わせ", siteInfo: "サイト情報" }, 
    pages: { 
      about: { 
        title: "TrendUpについて", 
        content: `
          <h2 style="margin-bottom:1.5rem;">TrendUp: 次世代のデータインテリジェンス</h2>
          <p style="margin-bottom:1.2rem; line-height:1.8;">TrendUpは、日本、米国、韓国などの検索トレンドをリアルタイムで分析するプラットフォームです。AI(Google Gemini 2.5)を活用し、文脈を見つけ出します。</p>
          <ul style="margin-bottom:1.2rem; padding-left:1.5rem; list-style:disc; line-height:1.8;">
            <li><strong>リアルタイム収集：</strong>10分間隔でデータを収集・正規化。</li>
            <li><strong>AI文脈分析：</strong>キーワードの背景にあるストーリーをAIが解説。</li>
            <li><strong>多言語サポート：</strong>母国語で世界の最新動向にアクセス可能。</li>
          </ul>` 
      }, 
      privacy: { 
        title: "プライバシーポリシー", 
        content: `
          <h2 style="margin-bottom:1.5rem;">プライバシーポリシー</h2>
          <p style="margin-bottom:1rem; line-height:1.6;">当サイトでは<strong>Google AdSense</strong>の広告を掲載しており、ユーザー状況に応じた広告配信のためCookieを利用します。ユーザーはアクセス制限設定に従うことができます。第三者配信事業者は過去のサイト訪問に基づきCookieを使用します。<a href="https://adssettings.google.com" target="_blank" style="color:var(--primary);">Google広告設定</a>からパーソナライズを無効にできます。</p>
          <p>お問い合わせ: <a href="mailto:help@globaltrendup.com">help@globaltrendup.com</a></p>` 
      }, 
      terms: { 
        title: "利用規約", 
        content: `
          <h2 style="margin-bottom:1.5rem;">利用規約</h2>
          <p style="margin-bottom:1rem; line-height:1.6;">本規約は、TrendUpサービス（以下「本サービス」）のご利用に関する規約を定めるものです。本サービスを利用することにより、ユーザーは本規約のすべての内容に同意したものとみなされます。</p>
          <h3 style="margin:1.2rem 0 0.5rem; font-size:1rem;">1. サービスの目的と内容</h3>
          <p style="margin-bottom:0.8rem; line-height:1.6;">本サービスは、公開されたデータを基にAI（人工知能）が自動生成したトレンド分析情報を提供します。自動生成の特性上、またはデータ元のエラーにより、提供される情報が最新あるいは正確でない場合があります。</p>
          <h3 style="margin:1.2rem 0 0.5rem; font-size:1rem;">2. 免責事項（重要）</h3>
          <p style="margin-bottom:1rem; line-height:1.6; color:var(--text-muted);">* 本サービスで提供するすべての情報は参考用に過ぎず、いかなる専門的、法的、または投資関連の助言を構成するものではありません。ユーザーが本情報に基づいて行った意思決定や投資などにより生じたいかなる損害・損失について、当サイトは一切の法的責任を負いません。</p>
          <h3 style="margin:1.2rem 0 0.5rem; font-size:1rem;">3. 知的財産権および禁止事項</h3>
          <p style="margin-bottom:1rem; line-height:1.6;">本サービスのロゴ、デザイン、UI、AI分析テキスト等に関する諸権利はTrendUpに帰属します。当サイトの許可を得ない商業利用、無断でのスクレイピング、クローラを利用したデータ収集、大量複製、またはシステムの正常な運用を妨害する行為は固く禁じられます。</p>
          <h3 style="margin:1.2rem 0 0.5rem; font-size:1rem;">4. サービスの変更および終了</h3>
          <p style="margin-bottom:1rem; line-height:1.6;">運営上、または技術上の理由（サーバーメンテナンスやAPIの仕様変更等）により、事前の予告なくサービスの全部または一部の内容を変更、追加、または終了する場合があります。これによってユーザーに生じる不便・不利益について当サイトは責任を負いません。</p>` 
      }, 
      contact: { 
        title: "お問い合わせ", 
        content: `
          <h2 style="margin-bottom:1.5rem;">お問い合わせ</h2>
          <p>サービスに関する報告や提案は <a href="mailto:help@globaltrendup.com">help@globaltrendup.com</a> へお願いいたします。</p>` 
      },
      cookie: { text: "TrendUpはサービス向上のためにCookieを使用します。", btn: "同意して続ける" }
    }
  },
  en: { 
    title: "Global Trends", update: "Updated", summary: "AI Analysis Report", news: "Top Stories", videos: "YouTube News", loading: "Loading...", T: "Trend Settings", L: "Language Settings", original: "Original",
    labels: { trends: "Country:", language: "Language:", featuredReports: "📅 Featured in Reports" },
    reports: { title: "Trend Reports", weekly: "Weekly Report", monthly: "Monthly Report", yearly: "Yearly Report", comingSoon: "Aggregating Data...", pastReports: "Past Reports", view: "View Report", latest: "Latest Report", currAgg: "Aggregating Now", viewPast: "View Archive" },
    menu: { about: "About TrendUp", privacy: "Privacy Policy", terms: "Terms of Service", contact: "Contact Us", siteInfo: "Site Info" }, 
    pages: { 
      about: { 
        title: "About TrendUp", 
        content: `
          <h2 style="margin-bottom:1.5rem;">TrendUp: Global Trend Intelligence</h2>
          <p style="margin-bottom:1.2rem; line-height:1.8;">TrendUp is a next-generation platform utilizing advanced Big Data workflows and AI (Google Gemini 2.5) to analyze real-time search trends from major countries, including the US, Japan, and South Korea.</p>
          <ul style="margin-bottom:1.2rem; padding-left:1.5rem; list-style:disc; line-height:1.8;">
            <li><strong>Real-time Global Pipeline:</strong> Trends updated every 10 minutes.</li>
            <li><strong>Contextual AI Summaries:</strong> Synthesizing news and reactions into intelligent reports.</li>
            <li><strong>Multilingual Insights:</strong> Localization enabling dynamic understanding of global issues.</li>
          </ul>` 
      }, 
      privacy: { 
        title: "Privacy Policy", 
        content: `
          <h2 style="margin-bottom:1.5rem;">Privacy Policy</h2>
          <p style="margin-bottom:1rem; line-height:1.6;">TrendUp operates for free through advertising and uses <strong>Google AdSense</strong>. Third-party vendors, including Google, use cookies to serve ads based on a user's prior visits. You may opt out of personalized advertising by visiting <a href="https://adssettings.google.com" target="_blank" style="color:var(--primary);">Google Ads Settings</a>. We value user privacy and primarily use anonymous analytics data to improve our services.</p>
          <p>Contact: <a href="mailto:help@globaltrendup.com">help@globaltrendup.com</a></p>` 
      }, 
      terms: { 
        title: "Terms of Service", 
        content: `
          <h2 style="margin-bottom:1.5rem;">Terms of Service</h2>
          <p style="margin-bottom:1rem; line-height:1.6;">These Terms of Service (hereinafter referred to as the "Terms") govern the access to and use of the TrendUp service (the "Service"). By accessing or using the Service, you signify your agreement to these Terms.</p>
          <h3 style="margin:1.2rem 0 0.5rem; font-size:1rem;">1. Purpose and Nature of the Service</h3>
          <p style="margin-bottom:0.8rem; line-height:1.6;">The Service provides trend analysis information that is automatically generated by AI (Artificial Intelligence) based on publicly available web data. Due to technological limitations or reliance on underlying third-party data, the generated summaries and translations may occasionally contain inaccuracies, errors, or outdated information.</p>
          <h3 style="margin:1.2rem 0 0.5rem; font-size:1rem;">2. Disclaimer of Warranties and Liability</h3>
          <p style="margin-bottom:1rem; line-height:1.6; color:var(--text-muted);">* All information and data provided by the Service are for general reference and educational purposes only. They do not constitute professional, legal, or financial advice. We shall not assume any legal responsibility or liability for any direct or indirect damages, losses, or consequences arising out of the use of, or inability to use, our Service or any reliance placed upon its content.</p>
          <h3 style="margin:1.2rem 0 0.5rem; font-size:1rem;">3. Intellectual Property Rights and Acceptable Use</h3>
          <p style="margin-bottom:1rem; line-height:1.6;">All content, logos, designs, UI elements, and AI-generated analytical texts available on the Service are the exclusive property of TrendUp. You agree to use the Service solely for personal, non-commercial purposes. Unauthorized commercial use, web scraping, automated crawls, mass duplication, network disruption, or any illicit activities without our prior written consent are strictly prohibited.</p>
          <h3 style="margin:1.2rem 0 0.5rem; font-size:1rem;">4. Modification and Stoppage of Service</h3>
          <p style="margin-bottom:1rem; line-height:1.6;">We reserve the right to modify, suspend, or discontinue all or part of the Service's features at any time, with or without notice, based on operational or technical needs (such as server maintenance or third-party API changes). We will not be liable to you or any third party for any such modifications or discontinuance.</p>` 
      }, 
      contact: { 
        title: "Contact Us", 
        content: `
          <h2 style="margin-bottom:1.5rem;">Contact Us</h2>
          <p>For inquiries, bug reports, and features, please email <a href="mailto:help@globaltrendup.com">help@globaltrendup.com</a>.</p>` 
      },
      cookie: { text: "TrendUp uses cookies to improve service quality and serve optimized content.", btn: "Accept & Continue" }
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
  set data({ trends, lang, country }) { this.render(trends, lang, country); }
  render(trends, lang, country) {
    const t = i18n[lang] || i18n.en;
    const getTrendIcon = (dir) => {
      if (dir === 'up') return '<span style="color: #ff4d4d; font-weight: 900; font-size: 0.9rem;">↑</span>';
      if (dir === 'down') return '<span style="color: #4d79ff; font-weight: 900; font-size: 0.9rem;">↓</span>';
      if (dir === 'new') return '<span style="color: #ffaa00; font-size: 0.6rem; font-weight: 800; border: 1px solid #ffaa00; padding: 1px 4px; border-radius: 4px; letter-spacing: -0.02em;">NEW</span>';
      return '<span style="color: var(--text-muted); opacity: 0.3; font-size: 0.8rem;">-</span>';
    };
    this.shadowRoot.innerHTML = `<style>
      :host { display: block; }
      .list { display: flex; flex-direction: column; gap: 0.75rem; perspective: 1000px; }
      .item { 
        display: grid; 
        grid-template-columns: 46px 1fr auto; 
        align-items: center; 
        background: var(--surface); 
        padding: 1.25rem; 
        border-radius: 20px; 
        border: 1px solid var(--border); 
        transition: all 0.3s cubic-bezier(0.165, 0.84, 0.44, 1); 
        color: var(--text); 
        cursor: pointer; 
        user-select: none; 
        position: relative; 
        z-index: 1;
        opacity: 0;
        animation: slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }
      .item:hover { 
        border-color: var(--primary); 
        transform: translateY(-4px) scale(1.01); 
        box-shadow: var(--shadow-hover); 
      }
      .item:active { transform: scale(0.98); }
      
      .item.top-rank {
        border-color: var(--primary);
        background: linear-gradient(135deg, var(--surface), oklch(0.6 0.2 20 / 0.03));
        box-shadow: 0 10px 30px oklch(0.6 0.2 20 / 0.08);
      }
      .item.top-rank .rank { color: var(--primary); transform: scale(1.2); }
      
      .rank { 
        font-size: 1.3rem; 
        font-weight: 900; 
        color: var(--text-muted); 
        opacity: 0.8; 
        display: flex;
        justify-content: center;
        transition: transform 0.3s ease;
      }
      
      .title-group { display: flex; flex-direction: column; overflow: hidden; gap: 2px; }
      .display-title { font-size: 1.1rem; font-weight: 700; padding-right: 0.5rem; line-height: 1.3; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
      .translated-subtitle { font-size: 0.8rem; color: var(--primary); opacity: 0.9; font-weight: 600; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
      .growth { font-size: 1.1rem; display: flex; align-items: center; justify-content: center; min-width: 45px; }
      .loading { text-align: center; padding: 4rem; color: var(--text-muted); font-size: 0.9rem; }
      
      @keyframes slideUpFade {
        from { opacity: 0; transform: translateY(30px) rotateX(-10deg); }
        to { opacity: 1; transform: translateY(0) rotateX(0); }
      }
    </style>
    <div class="list">${(!trends || trends.length === 0) ? `<div class="loading">${t.loading}</div>` : trends.map((item, index) => {
        const originalTitle = item.originalTitle || item.title;
        const translatedTitle = (item.translations && item.translations[lang]) ? item.translations[lang] : "";
        const hasTranslation = translatedTitle && (translatedTitle.toLowerCase() !== originalTitle.toLowerCase());
        const isTop = index === 0;
        return `<div class="item ${isTop ? 'top-rank' : ''}" data-index="${index}" style="animation-delay: ${index * 0.06}s">
          <span class="rank">${index + 1}</span>
          <div class="title-group">
            <span class="display-title">${originalTitle}</span>
            ${hasTranslation ? `<span class="translated-subtitle">✨ ${translatedTitle}</span>` : ''}
          </div>
          <span class="growth">${getTrendIcon(item.trendDir)}</span>
        </div>`;
      }).join('')}</div>`;
    this.shadowRoot.querySelectorAll('.item').forEach(el => { 
      el.onclick = () => { window.dispatchEvent(new CustomEvent('open-trend-modal', { detail: trends[parseInt(el.dataset.index)] })); };
    });
  }
}

class TrendModal extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `<style>.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 9999; cursor: pointer; opacity: 0; pointer-events: none; transition: opacity 0.2s ease; } .overlay.active { opacity: 1; pointer-events: auto; } .modal { background: var(--bg); width: 92%; max-width: 500px; max-height: 85vh; border-radius: 24px; padding: 2rem; border: 1px solid var(--border); box-shadow: var(--shadow-hover); overflow-y: auto; position: relative; cursor: default; transform: translateY(20px); transition: transform 0.2s ease; } .overlay.active .modal { transform: translateY(0); } .close { position: absolute; top: 1rem; right: 1rem; cursor: pointer; border: none; background: var(--border); width: 32px; height: 32px; border-radius: 50%; font-size: 1.2rem; color: var(--text); display: flex; align-items: center; justify-content: center; transition: background 0.2s; } .close:hover { background: var(--surface); } .title { font-size: 1.4rem; font-weight: 800; margin-bottom: 1.5rem; color: var(--text); } .section-title { font-weight: 800; color: var(--primary); margin: 1.5rem 0 0.5rem; display: block; font-size: 0.8rem; text-transform: uppercase; } .text { line-height: 1.6; color: var(--text); margin-bottom: 1.5rem; font-size: 0.95rem; white-space: pre-wrap; } .link-group { display: flex; flex-direction: column; gap: 0.5rem; } .link { padding: 0.8rem 1rem; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; text-decoration: none; color: var(--text); font-size: 0.85rem; display: flex; flex-direction: column; transition: all 0.2s; } .link:hover { border-color: var(--primary); background: oklch(0.6 0.2 20 / 0.03); transform: translateY(-1px); } .link-meta { font-size: 0.7rem; font-weight: 800; color: var(--primary); opacity: 0.7; } .report-link { border-left: 4px solid var(--primary); background: linear-gradient(to right, oklch(0.6 0.2 20 / 0.05), transparent); }</style>
      <div class="overlay">
        <div class="modal">
          <button class="close">&times;</button>
          <h2 class="title" id="title"></h2>
          <span class="section-title" id="summary-title"></span>
          <p class="text" id="analysis"></p>
          <div id="reports-section">
            <span class="section-title" id="reports-title"></span>
            <div class="link-group" id="reports-links"></div>
          </div>
          <span class="section-title" id="news-title"></span>
          <div class="link-group" id="news-links"></div>
          <div id="video-section">
            <span class="section-title" id="video-title"></span>
            <div class="link-group" id="video-links"></div>
          </div>
        </div>
      </div>`;
      
    this.shadowRoot.querySelector('.close').onclick = () => this.hide();
    this.shadowRoot.querySelector('.overlay').onclick = (e) => { if (e.target === e.currentTarget) this.hide(); };
  }

  show(trend, lang, matchedReports = []) {
    if (!trend) return;
    const t = i18n[lang] || i18n.en;
    const analysis = trend.aiReports?.[lang] || trend.aiReports?.['ko'] || "AI Analysis Report Loading...";
    
    this.shadowRoot.getElementById('title').textContent = trend.originalTitle || trend.title;
    this.shadowRoot.getElementById('summary-title').textContent = `✨ ${t.summary}`;
    this.shadowRoot.getElementById('analysis').textContent = analysis;
    this.shadowRoot.getElementById('news-title').textContent = `📰 ${t.news}`;
    this.shadowRoot.getElementById('news-links').innerHTML = (trend.newsLinks || []).slice(0,3).map(l => `<a href="${l.url}" target="_blank" class="link"><span class="link-meta">${l.source}</span><span>📄 ${l.title}</span></a>`).join('');
    
    const reportsSection = this.shadowRoot.getElementById('reports-section');
    reportsSection.style.display = 'none';
    this.shadowRoot.getElementById('reports-links').innerHTML = '';

    const videoSection = this.shadowRoot.getElementById('video-section');
    if (trend.videoLinks && trend.videoLinks.length > 0) {
      videoSection.style.display = 'block';
      this.shadowRoot.getElementById('video-title').textContent = `🎬 ${t.videos}`;
      this.shadowRoot.getElementById('video-links').innerHTML = trend.videoLinks.map(v => `<a href="${v.url}" target="_blank" class="link"><span class="link-meta">${v.source}</span><span>🎥 ${v.title}</span></a>`).join('');
    } else {
      videoSection.style.display = 'none';
      this.shadowRoot.getElementById('video-links').innerHTML = '';
    }
    
    this.shadowRoot.querySelector('.overlay').classList.add('active');
  }

  updateReports(matchedReports, lang) {
    const t = i18n[lang] || i18n.en;
    const reportsSection = this.shadowRoot.getElementById('reports-section');
    if (matchedReports && matchedReports.length > 0) {
      reportsSection.style.display = 'block';
      this.shadowRoot.getElementById('reports-title').textContent = t.labels.featuredReports || "📅 리포트";
      this.shadowRoot.getElementById('reports-links').innerHTML = matchedReports.map(r => {
        let titleStr = r.reportTitle;
        if (typeof titleStr === 'object') titleStr = titleStr[lang] || titleStr.ko || "Trend Report";
        return `<a href="report/?type=${r.type}&country=${r.country}&id=${r.slug}" target="_blank" class="link report-link"><span class="link-meta">${r.type.toUpperCase()} ANALYSIS</span><span>📈 ${titleStr}</span></a>`;
      }).join('');
    }
  }

  hide() { this.shadowRoot.querySelector('.overlay').classList.remove('active'); }
}

customElements.define('trend-list', TrendList);
customElements.define('trend-modal', TrendModal);

class App {
  constructor() {
    this.service = new TrendService();
    this.currentCountry = localStorage.getItem('country') || this.service.autoDetectCountry();
    this.currentLang = localStorage.getItem('lang') || (this.currentCountry === 'KR' ? 'ko' : this.currentCountry === 'JP' ? 'ja' : 'en');
    this.themeMode = localStorage.getItem('theme-mode') || 'system';
    this.db = null;
    this.init();
  }
  async init() {
    console.log("App Init: v3.2.26");
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
      window.addEventListener('open-trend-modal', async (e) => { 
        if (!this.modal) return;
        const trend = e.detail;
        
        // Show modal immediately without blocking
        this.modal.show(trend, this.currentLang);
        
        // Fetch matched reports async and then append them to UI
        this.findMatchedReports(trend.originalTitle || trend.title).then(matchedReports => {
          this.modal.updateReports(matchedReports, this.currentLang);
        }).catch(err => console.warn("Matched reports fetch error:", err));
      });
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
        if (trendListEl) trendListEl.data = { trends, lang: this.currentLang, country: this.currentCountry };
      }
    } catch (e) {}
  }
  async startAsyncTasks() {
    try {
      const app = initializeApp(firebaseConfig);
      this.db = getFirestore(app);
      this.renderNavs();
      await this.refreshReportCards(); // Ensure cards refresh after DB is ready
      await this.update();
    } catch (e) { console.error("Firebase init failed:", e.message); }
  }

  async findMatchedReports(keyword) {
    if (!this.db) return [];
    try {
      const types = ['weekly', 'monthly', 'yearly'];
      let allMatches = [];
      for (const type of types) {
        const q = query(
          collection(this.db, 'reports', type, this.currentCountry),
          where('keywords', 'array-contains', keyword),
          limit(2)
        );
        const snap = await getDocs(q);
        snap.forEach(doc => {
          const data = doc.data();
          if (data.slug) allMatches.push({ type, slug: data.slug, reportTitle: data.reportTitle });
        });
      }
      return allMatches;
    } catch (e) { return []; }
  }
  refreshUIText() {
    try {
      const t = i18n[this.currentLang] || i18n.en;
      document.documentElement.setAttribute('lang', this.currentLang);
      document.getElementById('current-country-title').textContent = t.title;
      const footerContent = document.querySelector('.footer-content p');
      if (footerContent) footerContent.innerHTML = `&copy; 2026 GlobalTrendUp. All rights reserved. (v3.1.52) <span id="ai-usage" class="ai-usage-footer"></span>`;
      const menuTitles = document.querySelectorAll('.menu-section .menu-title');
      if (menuTitles[0]) menuTitles[0].textContent = t.T || "Trend Settings";
      if (menuTitles[1]) menuTitles[1].textContent = t.menu.siteInfo;
      const navLabels = document.querySelectorAll('.nav-label');
      if (navLabels[0]) navLabels[0].textContent = t.labels?.trends || "Country:";
      if (navLabels[1]) navLabels[1].textContent = t.labels?.language || "Language:";
      document.querySelectorAll('[data-page]').forEach(link => {
        const key = link.getAttribute('data-page');
        if (t.menu && t.menu[key]) link.textContent = t.menu[key];
      });
      const cookieText = document.getElementById('cookie-text');
      if (cookieText && t.pages.cookie) cookieText.textContent = t.pages.cookie.text;
      const cookieBtn = document.getElementById('accept-cookies');
      if (cookieBtn && t.pages.cookie) cookieBtn.textContent = t.pages.cookie.btn;

      const lastUpdatedEl = document.getElementById('last-updated');
      if (lastUpdatedEl && lastUpdatedEl.textContent.includes(':')) {
        const parts = lastUpdatedEl.textContent.split(':');
        const timePart = parts[1] || parts.slice(1).join(':').trim();
        if (timePart) {
           lastUpdatedEl.textContent = `${t.update}: ${timePart.trim()}`;
        }
      }

      document.getElementById('reports-section-title').textContent = t.reports.title;
      document.querySelectorAll('[data-report]').forEach(el => {
        const key = el.getAttribute('data-report');
        if (t.reports[key]) el.textContent = t.reports[key];
      });
      document.querySelectorAll('.coming-soon-badge').forEach(el => {
        el.textContent = t.reports.comingSoon;
      });
      this.refreshReportCards();

      this.updateGeminiUsage();
    } catch (e) { console.error("UI refresh error:", e); }
  }

  updateSEOMeta(firstTrend) {
    if (!firstTrend) return;
    const t = i18n[this.currentLang] || i18n.en;
    const trendTitle = firstTrend.originalTitle || firstTrend.title;
    const translatedTitle = (firstTrend.translations && firstTrend.translations[this.currentLang]) ? firstTrend.translations[this.currentLang] : trendTitle;
    const newTitle = `GlobalTrendUp | ${this.currentCountry} #1: ${translatedTitle}`;
    document.title = newTitle;
    const description = `${this.currentCountry} Real-time Trend #1: "${translatedTitle}". ${t.summary}.`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', description);
  }

  initThemeIcons() {
    try {
      document.querySelectorAll('.sun-svg').forEach(el => el.innerHTML = ICONS.sun);
      document.querySelectorAll('.moon-svg').forEach(el => el.innerHTML = ICONS.moon);
      document.querySelectorAll('.system-svg').forEach(el => el.innerHTML = ICONS.system);
    } catch (e) {}
  }
  initThemeMenu() {
    const toggle = document.getElementById('theme-menu-toggle');
    const dropdown = document.getElementById('theme-dropdown');
    if (!toggle || !dropdown) return;
    toggle.onclick = (e) => { e.stopPropagation(); dropdown.classList.toggle('hidden'); };
    dropdown.querySelectorAll('.theme-opt').forEach(opt => {
      opt.onclick = (e) => { e.stopPropagation(); this.applyTheme(opt.dataset.theme); dropdown.classList.add('hidden'); };
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
    const overlay = document.getElementById('side-menu-overlay');
    const menu = document.getElementById('side-menu');
    if (!toggle || !menu) return;
    toggle.onclick = (e) => { e.stopPropagation(); menu.classList.add('active'); overlay.classList.remove('hidden'); };
    document.getElementById('menu-close')?.addEventListener('click', () => { menu.classList.remove('active'); overlay.classList.add('hidden'); });
    overlay?.addEventListener('click', () => { menu.classList.remove('active'); overlay.classList.add('hidden'); });
  }
  initCookieBanner() {
    const banner = document.getElementById('cookie-banner');
    if (!banner || localStorage.getItem('cookies-accepted')) return;
    banner.classList.remove('hidden');
    banner.querySelector('button')?.addEventListener('click', () => { localStorage.setItem('cookies-accepted', 'true'); banner.classList.add('hidden'); });
  }
  initInfoModals() {
    const overlay = document.getElementById('info-modal');
    const body = document.getElementById('info-modal-body');
    document.querySelectorAll('.info-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const t = i18n[this.currentLang] || i18n.en;
        if (t.pages && t.pages[link.dataset.page] && body && overlay) { body.innerHTML = t.pages[link.dataset.page].content; overlay.classList.remove('hidden'); }
      });
    });
    document.querySelector('.info-modal-close')?.addEventListener('click', () => overlay.classList.add('hidden'));
    overlay?.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.add('hidden'); });
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
  async switchLang(code) { this.currentLang = code; localStorage.setItem('lang', code); this.renderNavs(); this.refreshUIText(); this.loadLocalCache(); await this.update(); }
  
  async refreshReportCards() {
    if (!this.db) return;
    const types = ['weekly', 'monthly', 'yearly'];
    const t = i18n[this.currentLang] || i18n.en;
    
    for (const type of types) {
      const card = document.querySelector(`.report-card[data-type="${type}"]`);
      if (!card) continue;
      
      try {
        const q = query(collection(this.db, "reports", type, this.currentCountry), orderBy("lastUpdated", "desc"), limit(6));
        const snap = await getDocs(q);
        
        let latestDoc = null;
        let pastDocs = [];
        snap.forEach(docSnap => {
          if (docSnap.id === 'latest') latestDoc = docSnap.data();
          else pastDocs.push({ id: docSnap.id, data: docSnap.data() });
        });

        const statusEl = card.querySelector(`[data-status="${type}"]`);
        const periodEl = card.querySelector(`[data-period="${type}"]`);
        const badge = card.querySelector('.coming-soon-badge');

        const isAgg = latestDoc ? (latestDoc.isAggregating !== false) : true;
        const historyExists = pastDocs.length > 0;

        // 1. Current Status Badge
        if (latestDoc) {
          const rawLabel = latestDoc.dateRange || '';
          let badgeHtml = '';
          
          if (isAgg) {
            const isWriting = rawLabel.includes('작성중');
            if (isWriting) {
              badgeHtml = `<span class="status-badge writing">✍️ 작성 중</span>`;
            } else if (type === 'yearly') {
              badgeHtml = `<span class="status-badge live">📊 데이터 집계 중</span>`;
            } else {
              badgeHtml = `<span class="status-badge live">🟢 실시간</span>`;
            }
          } else {
            badgeHtml = `<span class="status-badge completed">✅ 작성 완료</span>`;
          }
          
          statusEl.innerHTML = `${badgeHtml} <span class="status-text">${rawLabel.replace('작성중', '').replace('데이터집계중', '').replace('집계중', '').trim()}</span>`;
          statusEl.style.display = 'block';
        } else {
          statusEl.style.display = 'none';
        }

        // 2. Identify Featured Report (Main Button)
        let featuredDoc = null;
        let isFeaturedNew = false;
        
        // Strict Enforcement: ONLY allow viewing if NOT aggregating (must be 'Completed')
        if (latestDoc && !isAgg) {
          featuredDoc = { id: latestDoc.slug || 'latest', data: latestDoc };
          isFeaturedNew = true;
        }
        // Historical archives will ONLY appear in the archive list below, 
        // not as the main featured button unless the current period is finished.

        // 3. Render Main Card Area
        const isYearlyDraft = (type === 'yearly' && isFeaturedNew);
        if (featuredDoc && !isYearlyDraft) {
          card.classList.remove('disabled');
          card.style.cursor = 'pointer';
          let pTitle = featuredDoc.data.dateRange || featuredDoc.id;
          if (featuredDoc.data.reportTitle && featuredDoc.data.reportTitle[this.currentLang]) {
            pTitle = featuredDoc.data.reportTitle[this.currentLang];
          }
          periodEl.innerHTML = `${isFeaturedNew ? `<span class="new-badge">NEW</span>` : ''}${pTitle}`;
          badge.style.display = 'inline-block';
          badge.textContent = `${t.reports[type]} ${t.reports.view}`;
          badge.classList.add('active-report');
          card.onclick = (e) => {
            if (featuredDoc.data.isAggregating) {
              e.preventDefault();
              alert("현재 AI 분석 서버가 최종 리포트를 작성 중입니다. 잠시만 기다려 주세요! (약 5~10분 소요)");
              return false;
            }
            window.location.href = `report/?type=${type}&country=${this.currentCountry}&id=${featuredDoc.id}`;
          };
        } else {
          card.classList.add('disabled');
          card.style.cursor = 'default';
          card.onclick = null;
          let displayLabel = latestDoc ? latestDoc.dateRange : t.reports.comingSoon;
          // Force Yearly date range for consistency
          if (type === 'yearly') {
            const statusSuffix = (latestDoc && latestDoc.dateRange && latestDoc.dateRange.includes('작성중')) ? '작성중' : '데이터집계중';
            displayLabel = `2026.01.01 ~ 12.31 ${statusSuffix}`;
          }
          periodEl.textContent = displayLabel;
          badge.style.display = 'none';
        }

        // 4. Archive List (Older than featured)
        let pastCtn = card.querySelector('.past-reports-list');
        if (!pastCtn) {
          pastCtn = document.createElement('div');
          pastCtn.className = 'past-reports-list';
          card.appendChild(pastCtn);
        }

        // Precision Filter: Hide any archive that matches the CURRENT draft's Month & Week
        // (E.g. if writing "3월 4주차", hide ALL archived reports containing both "3월" and "4주차")
        const fId = featuredDoc ? featuredDoc.id : null;
        const curSlug = latestDoc ? latestDoc.slug : null;
        const curLabel = latestDoc ? (latestDoc.dateRange || '') : '';
        
        // Extract month/week components for precision matching
        const monthPart = curLabel.match(/\d+월/) ? curLabel.match(/\d+월/)[0] : '';
        const weekPart = curLabel.match(/\d+주차/) ? curLabel.match(/\d+주차/)[0] : '';

        const validArchives = pastDocs.filter(p => {
          const pTitle = p.data.dateRange || '';
          const isOverlap = monthPart && weekPart && pTitle.includes(monthPart) && pTitle.includes(weekPart);
          
          return (
            p.id !== fId &&
            p.id !== curSlug &&
            !isOverlap &&
            p.data.isAggregating === false && 
            p.data.items && 
            p.data.items.length > 0
          );
        });
        const displayArchives = validArchives.slice(0, 3);

        if (displayArchives.length > 0) {
          const listHtml = displayArchives.map(p => {
            let pTitle = p.data.dateRange || p.id;
            if (p.data.reportTitle && p.data.reportTitle[this.currentLang]) {
              pTitle = p.data.reportTitle[this.currentLang];
            }
            return `<a href="report/?type=${type}&country=${this.currentCountry}&id=${p.id}" class="past-report-link" onclick="event.stopPropagation()"><span>📜 ${pTitle}</span></a>`;
          }).join('');
          
          pastCtn.innerHTML = `<span class="past-title">${t.reports.viewPast}</span>` + listHtml;
          pastCtn.style.display = 'block';
        } else {
          pastCtn.style.display = 'none';
        }

      } catch (err) { 
        console.warn(`Failed to refresh ${type} report card:`, err);
      }
    }
  }


  async updateGeminiUsage() {
    if (!this.db) return;
    try {
      const usageDoc = await getDoc(doc(this.db, 'trends', 'metadata'));
      const usageEl = document.getElementById('ai-usage');
      if (usageDoc.exists() && usageEl) {
        const data = usageDoc.data();
        const count = data.gemini_count || 0;
        usageEl.textContent = `(${count}/14400)`;
        if (count > 14000) usageEl.style.color = 'var(--error)';
        else if (count > 12000) usageEl.style.color = 'var(--warning)';
        else usageEl.style.color = 'inherit';
      }
    } catch (e) { console.warn("Failed to fetch AI usage:", e.message); }
  }

  async update() {
    if (!this.db) return;
    try {
      const t = i18n[this.currentLang] || i18n.en;
      await this.updateGeminiUsage();
      await this.refreshReportCards(); // Periodic refresh
      const trendDoc = await getDoc(doc(this.db, 'trends', this.currentCountry));
      if (trendDoc.exists()) {
        const dbData = trendDoc.data();
        const trends = this.service.calculateRankChanges(dbData.items, dbData.previousItems);
        const trendListEl = document.getElementById('top-trends');
        if (trendListEl) {
          trendListEl.data = { trends, lang: this.currentLang, country: this.currentCountry };
          if (trends && trends.length > 0) this.updateSEOMeta(trends[0]);
        }
        const date = dbData.lastUpdated.toDate();
        const lastUpdatedEl = document.getElementById('last-updated');
        if (lastUpdatedEl) lastUpdatedEl.textContent = `${t.update}: ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false})}`;
        localStorage.setItem(`trends_${this.currentCountry}`, JSON.stringify({ items: dbData.items, previousItems: dbData.previousItems, lastUpdated: dbData.lastUpdated.toMillis() }));
      }
    } catch (e) { console.warn("Update failed:", e.message); }
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => new App());
else new App();
