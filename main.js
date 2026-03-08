import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, Timestamp, initializeFirestore } from 'firebase/firestore';

const ICONS = {
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`,
  moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`,
  system: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2v20" opacity="0.5"></path><path d="M12 2a10 10 0 0 0 0 20z" fill="currentColor"></path></svg>`
};

// --- Localization ---
let i18n = {
  ko: { 
    title: "실시간 인기 트렌드", update: "최근 업데이트", summary: "AI 분석 리포트", news: "관련 뉴스", videos: "YouTube 뉴스", loading: "불러오는 중...", T: "트렌드 설정", L: "언어 설정", original: "원문",
    labels: { trends: "국가:", language: "언어:" },
    menu: { about: "TrendUp 소개", privacy: "개인정보처리방침", terms: "이용약관", contact: "문의하기", siteInfo: "사이트 안내" },
    pages: {
      about: { 
        title: "TrendUp: 글로벌 트렌드 인텔리전스", 
        content: `
          <h2 style="margin-bottom:1.5rem;">세상을 읽는 가장 빠른 인텔리전스, TrendUp</h2>
          <p style="margin-bottom:1.2rem; line-height:1.8;">TrendUp은 고도의 빅데이터 처리 기술과 최신 AI 엔진(Google Gemini 2.0)을 융합하여 한국, 일본, 미국 등 주요 국가의 실시간 검색 트렌드를 분석하고 시각화하는 차세대 데이터 인텔리전스 플랫폼입니다.</p>
          <h3 style="margin:1.5rem 0 0.8rem; border-left:4px solid var(--primary); padding-left:0.8rem; font-size:1.1rem;">우리의 미션</h3>
          <p style="margin-bottom:1.2rem; line-height:1.8;">정보의 홍수 속에서 가장 가치 있는 '맥락'을 찾아내는 것이 우리의 목표입니다. 단순한 키워드 나열이 아닌, 왜 이 키워드가 지금 뜨고 있는지, 어떤 사회적 배경이 있는지 AI를 통해 심층 분석하여 사용자에게 전달합니다.</p>
          <h3 style="margin:1.5rem 0 0.8rem; border-left:4px solid var(--primary); padding-left:0.8rem; font-size:1.1rem;">주요 기술력</h3>
          <ul style="margin-bottom:1.2rem; padding-left:1.5rem; list-style:disc; line-height:1.8;">
            <li><strong>실시간 글로벌 파이프라인:</strong> 전 세계의 신뢰도 높은 트렌드 소스로부터 10분 단위로 데이터를 수집하여 정규화합니다.</li>
            <li><strong>문맥 기반 AI 요약:</strong> 수집된 뉴스 조각들과 소셜 반응을 종합하여, AI가 인간이 읽기 편한 형태의 리포트로 재구성합니다.</li>
            <li><strong>다국어 인사이트:</strong> 언어의 장벽을 넘어 각국의 트렌드를 모국어로 이해할 수 있도록 정교한 번역 및 로컬라이징을 지원합니다.</li>
          </ul>
        ` 
      },
      privacy: { 
        title: "개인정보 처리방침 (Privacy Policy)", 
        content: `
          <h2 style="margin-bottom:1.5rem;">개인정보 처리방침</h2>
          <p style="margin-bottom:1rem; line-height:1.6;">TrendUp(이하 '본 사이트')은 방문자의 개인정보 보호를 중요하게 생각하며, 관련 법령을 준수합니다. 본 방침은 수집되는 정보의 종류와 사용 목적, 그리고 구글 애드센스 광고 게재와 관련된 사항을 안내합니다.</p>
          
          <h3 style="margin:1.2rem 0 0.5rem; font-size:1rem;">1. 개인정보 수집 및 목적</h3>
          <p style="margin-bottom:1rem; line-height:1.6;">본 사이트는 별도의 회원가입이나 개인 식별 정보(성명, 연락처 등)를 수집하지 않습니다. 다만, 서비스 품질 개선 및 통계 분석, 광고 게재를 위해 다음과 같은 정보가 자동으로 생성 및 수집될 수 있습니다: IP 주소, 브라우저 종류, 방문 시간, 서비스 이용 기록 등.</p>

          <h3 style="margin:1.2rem 0 0.5rem; font-size:1rem;">2. 구글 애드센스 및 쿠키(Cookie) 사용</h3>
          <p style="margin-bottom:0.8rem; line-height:1.6;">본 사이트는 광고 수익을 통해 서비스를 무료로 운영하며, 이를 위해 <strong>구글 애드센스(Google AdSense)</strong>를 사용합니다.</p>
          <ul style="margin-bottom:1rem; padding-left:1.5rem; list-style:circle; line-height:1.6;">
            <li>구글을 포함한 타사 공급업체는 사용자의 이전 방문 기록을 바탕으로 광고를 게재하기 위해 쿠키를 사용합니다.</li>
            <li>구글의 광고 쿠키(DART 쿠키)를 사용하면 본 사이트 및 인터넷상의 다른 사이트에 대한 방문 기록을 기반으로 사용자에게 맞춤형 광고를 제공할 수 있습니다.</li>
            <li>사용자는 <a href="https://adssettings.google.com" target="_blank" style="color:var(--primary);">구글 광고 설정</a>을 방문하여 맞춤 설정된 광고를 해제할 수 있습니다.</li>
          </ul>

          <h3 style="margin:1.2rem 0 0.5rem; font-size:1rem;">3. 데이터 분석 및 타사 도구</h3>
          <p style="margin-bottom:1rem; line-height:1.6;">본 사이트는 서비스 이용 분석을 위해 Google Analytics 등을 활용할 수 있으며, 이 과정에서 익명화된 데이터가 타사 플랫폼으로 전송될 수 있습니다. 이는 오직 더 나은 사용자 경험을 제공하기 위한 목적으로만 사용됩니다.</p>

          <h3 style="margin:1.2rem 0 0.5rem; font-size:1rem;">4. 문의처</h3>
          <p style="margin-bottom:1rem; line-height:1.6;">개인정보 보호와 관련하여 궁금한 사항은 <a href="mailto:help@trendup.ai" style="color:var(--primary);">help@trendup.ai</a>로 문의해 주시기 바랍니다.</p>
          <p style="font-size:0.85rem; color:var(--text-muted);">최종 업데이트: 2026년 3월 4일</p>
        ` 
      },
      terms: { 
        title: "서비스 이용약관 (Terms of Service)", 
        content: `
          <h2 style="margin-bottom:1.5rem;">서비스 이용약관</h2>
          <p style="margin-bottom:1rem; line-height:1.6;">본 약관은 TrendUp 서비스(이하 '서비스') 이용과 관련하여 제공자와 이용자 간의 권리, 의무 및 책임 사항을 규정함을 목적으로 합니다.</p>
          
          <h3 style="margin:1.2rem 0 0.5rem; font-size:1rem;">1. 서비스의 목적 및 면책 고지</h3>
          <p style="margin-bottom:0.8rem; line-height:1.6;">서비스는 공개된 데이터를 바탕으로 AI가 자동 생성한 분석 정보를 제공합니다. 제공되는 데이터와 분석 결과는 기술적 한계나 원천 데이터의 오류로 인해 실제와 다를 수 있습니다.</p>
          <p style="margin-bottom:1rem; line-height:1.6; color:var(--text-muted);">* 본 서비스에서 제공하는 모든 정보는 참고용이며, 이를 바탕으로 행해진 투자나 결정에 따른 결과에 대해 본 사이트는 어떠한 법적 책임도 지지 않습니다.</p>

          <h3 style="margin:1.2rem 0 0.5rem; font-size:1rem;">2. 저작권 및 콘텐츠 이용</h3>
          <p style="margin-bottom:1rem; line-height:1.6;">서비스가 제공하는 로고, 디자인, AI 분석 텍스트 등에 대한 권리는 TrendUp에 있습니다. 이용자는 서비스를 개인적 용도로만 이용해야 하며, 사전 동의 없는 상업적 이용이나 무단 크롤링, 대량 복제 행위를 금합니다.</p>

          <h3 style="margin:1.2rem 0 0.5rem; font-size:1rem;">3. 서비스의 변경 및 중단</h3>
          <p style="margin-bottom:1rem; line-height:1.6;">서비스는 운영상 또는 기술상의 필요에 따라 제공하는 기능의 전부 또는 일부를 예고 없이 수정하거나 중단할 수 있습니다.</p>

          <h3 style="margin:1.2rem 0 0.5rem; font-size:1rem;">4. 약관의 개정</h3>
          <p style="margin-bottom:1rem; line-height:1.6;">본 사이트는 필요 시 약관을 개정할 수 있으며, 변경된 내용은 사이트 내 공지를 통해 효력이 발생합니다.</p>
        ` 
      },
      contact: { 
        title: "문의하기 (Contact)", 
        content: `
          <h2 style="margin-bottom:1.5rem;">고객 지원 및 비즈니스 문의</h2>
          <p style="margin-bottom:1.2rem; line-height:1.8;">TrendUp에 관심을 가져주셔서 감사합니다. 서비스 개선을 위한 제안, 오류 제보, 광고 및 비즈니스 협력 문의는 아래 채널을 통해 전달해 주시기 바랍니다.</p>
          
          <div style="background:var(--surface); padding:1.5rem; border-radius:12px; border:1px solid var(--border);">
            <p style="margin-bottom:0.8rem;"><strong>이메일 문의:</strong></p>
            <p style="font-size:1.1rem;"><a href="mailto:help@trendup.ai" style="color:var(--primary); font-weight:700;">help@trendup.ai</a></p>
          </div>
          
          <ul style="margin-top:1.5rem; font-size:0.9rem; color:var(--text-muted); line-height:1.6;">
            <li>* 모든 문의는 영업일 기준 48시간 이내에 검토 후 답변드리기 위해 노력하고 있습니다.</li>
            <li>* 무분별한 스팸이나 비방 목적의 메일은 답변이 제한될 수 있습니다.</li>
          </ul>
        ` 
      },
      cookie: {
        text: "TrendUp은 서비스 품질 향상 및 맞춤형 콘텐츠 제공을 위해 쿠키를 사용합니다.",
        btn: "확인 및 동의"
      }
    }
  },
  ja: { 
    title: "リアルタイムトレンド", update: "最終更新", summary: "AI分析レポート", news: "関連ニュース", videos: "YouTubeニュース", loading: "読み込み中...", T: "トレンド設定", L: "言語設定", original: "原文",
    labels: { trends: "国:", language: "言語:" },
    menu: { about: "TrendUpについて", privacy: "プライバシーポリシー", terms: "利用規約", contact: "お問い合わせ", siteInfo: "サイト情報" }, 
    pages: { 
      about: { 
        title: "TrendUpについて", 
        content: `
          <h2 style="margin-bottom:1.5rem;">世界を読む、最速のインテリジェンス TrendUp</h2>
          <p style="margin-bottom:1rem; line-height:1.8;">TrendUpは、高度なビッグデータ処理技術と最新のAIエンジンを融合させ、日本、米国、韓国などの主要国における検索トレンドをリアルタイムで分析・可視化する次世代のデータインテリジェンスプラットフォームです。</p>
          <h3 style="margin:1.5rem 0 0.5rem; border-left:4px solid var(--primary); padding-left:0.8rem;">主な特徴</h3>
          <ul style="margin-bottom:1rem; padding-left:1.2rem; list-style:disc; line-height:1.8;">
            <li><strong>リアルタイム・データパイプライン：</strong>世界中の信頼性の高いトレンドデータを10分間隔で収集・正規化し、常に最新の情報を提供します。</li>
            <li><strong>AIによる文脈分析：</strong>単なるキーワードの羅列を超え、AIがトレンドの背景と文脈を把握して、ユーザーの言語で最適化された要約レポートを生成します。</li>
            <li><strong>グローバルインサイト：</strong>国別のトレンド比較を通じて、地域的な特色や世界共通の関心事を一目で把握し、世の中の動向を先読みできます。</li>
          </ul>
        ` 
      }, 
      privacy: { 
        title: "プライバシーポリシー (Privacy Policy)", 
        content: `
          <h2 style="margin-bottom:1.5rem;">プライバシーポリシー</h2>
          <p style="margin-bottom:1rem;">TrendUp（以下「当サービス」）は、ユーザーの個人情報の保護を重要な責務と認識し、以下の通りプライバシーポリシーを定めます。(v2.8.4)</p>
          <h3 style="margin:1.2rem 0 0.5rem;">1. 個人情報の収集および収集方法</h3>
          <p>当サービスは、会員登録なしで全ての機能を利用可能です。ただし、サービスの利用過程で、IPアドレス、クッキー（Cookie）、ブラウザの種類、アクセス日時などの情報がアクセスログとして自動的に収集される場合があります。</p>
          <h3 style="margin:1.2rem 0 0.5rem;">2. 広告の配信について（Googleアドセンス）</h3>
          <p>当サイトは、第三者配信の広告サービス「Googleアドセンス」を利用しています。Googleなどの広告配信事業者は、ユーザーの興味に応じた商品やサービスの広告を表示するため、クッキー（Cookie）を使用することがあります。これには、ユーザーが当サイトや他のサイトに過去にアクセスした際の情報が含まれますが、氏名、住所、メールアドレス、電話番号など個人を特定する情報は含まれません。</p>
          <p>ユーザーは、Googleの<a href="https://www.google.com/settings/ads" target="_blank" style="color:var(--primary);">広告設定</a>でパーソナライズ広告を無効にできます。また、<a href="https://www.aboutads.info/" target="_blank" style="color:var(--primary);">www.aboutads.info</a>にアクセスすることで、第三者配信事業者のクッキーを無効にすることもできます。</p>
          <h3 style="margin:1.2rem 0 0.5rem;">3. アクセス解析ツールについて</h3>
          <p>当サイトでは、Googleによるアクセス解析ツール「Googleアナリティクス」を利用しています。このGoogleアナリティクスはトラフィックデータの収集のためにクッキーを使用しています。このトラフィックデータは匿名で収集されており、個人を特定するものではありません。</p>
          <h3 style="margin:1.2rem 0 0.5rem;">4. 個人情報の利用目的</h3>
          <p>収集した情報は、サービスの運営改善、利用状況の分析、および不正利用の防止のために利用されます。</p>
        ` 
      }, 
      terms: { 
        title: "利用規約 (Terms of Service)", 
        content: `
          <h2 style="margin-bottom:1.5rem;">利用規約</h2>
          <p style="margin-bottom:1rem;">この規約（以下「本規約」）は、TrendUp（以下「当サービス」）が提供するコンテンツの利用条件を定めるものです。</p>
          <h3 style="margin:1.2rem 0 0.5rem;">1. 免責事項</h3>
          <p>当サービスで提供される全てのトレンドデータおよびAIによる分析内容は、公開されている情報を基に自動生成されたものであり、その正確性、完全性、妥当性を保証するものではありません。情報の利用によって生じた損害や不利益について、当サービスは一切の責任を負いません。重要な意思決定の根拠として使用される際は、自己責任において行ってください。</p>
          <h3 style="margin:1.2rem 0 0.5rem;">2. 禁止事項</h3>
          <p>ユーザーは、以下の行為を行ってはなりません。</p>
          <ul style="margin-bottom:1rem; padding-left:1.2rem; list-style:disc;">
            <li>サーバーへの過度な負荷をかける行為</li>
            <li>スクレイピングやクローラー、自動化ツールを用いたデータの無断取得</li>
            <li>当サービスの運営を妨害する行為</li>
            <li>その他、法令または公序良俗に反する行為</li>
          </ul>
          <h3 style="margin:1.2rem 0 0.5rem;">3. 知的財産権</h3>
          <p>当サービスに含まれるロゴ、デザイン、プログラム等の知的財産権は、当サービスまたは正当な権利者に帰属します。</p>
          <h3 style="margin:1.2rem 0 0.5rem;">4. 規約の変更</h3>
          <p>当サービスは、必要に応じて本規約を変更することがあります。変更後の規約は、本サイト上に掲示した時点から効力を生じるものとします。</p>
        ` 
      }, 
      contact: { 
        title: "お問い合わせ (Contact)", 
        content: `
          <h2 style="margin-bottom:1.5rem;">カスタマーサポート</h2>
          <p style="margin-bottom:1rem;">TrendUpに関するご意見、ご要望、ビジネスに関するお問い合わせは、以下のメールアドレスまでご連絡ください。</p>
          <p><strong>Email:</strong> <a href="mailto:help@trendup.ai" style="color:var(--primary);">help@trendup.ai</a></p>
          <p style="margin-top:1rem; font-size:0.85rem; color:var(--text-muted);">※ お問い合わせ内容によっては、回答にお時間をいただく場合や回答を差し控えさせていただく場合がございます。</p>
        ` 
      },
      cookie: {
        text: "TrendUpはサービス品質向上およびパーソナライズされたコンテンツ提供のためにCookieを使用します。",
        btn: "同意する"
      }
    }
  },
  en: { 
    title: "Global Trends", update: "Updated", summary: "AI Analysis Report", news: "Top Stories", videos: "YouTube News", loading: "Loading...", T: "Trends", L: "Language", original: "Original",
    labels: { trends: "Country:", language: "Language:" },
    menu: { about: "About TrendUp", privacy: "Privacy Policy", terms: "Terms of Service", contact: "Contact Us", siteInfo: "Site Info" }, 
    pages: { 
      about: { 
        title: "About TrendUp", 
        content: `
          <h2 style="margin-bottom:1.5rem;">TrendUp: Global Trend Intelligence</h2>
          <p style="margin-bottom:1rem; line-height:1.8;">TrendUp is a data analysis platform that combines big data processing technology with the latest AI engines to analyze and visualize search trends in real-time from major countries including the US, Japan, and Korea.</p>
          <h3 style="margin:1.5rem 0 0.5rem; border-left:4px solid var(--primary); padding-left:0.8rem;">Core Features</h3>
          <ul style="margin-bottom:1rem; padding-left:1.2rem; list-style:disc; line-height:1.8;">
            <li><strong>Real-time Data Pipeline:</strong> We normalize high-reliability data from each country every 10 minutes.</li>
            <li><strong>Context-based AI Analysis:</strong> Our AI understands the context of keywords and provides optimized summaries.</li>
            <li><strong>Global Insight:</strong> Track the lifecycle of trends through precise ranking change monitoring across the globe.</li>
          </ul>
        ` 
      }, 
      privacy: { 
        title: "Privacy Policy", 
        content: `
          <h2 style="margin-bottom:1.5rem;">Privacy Policy</h2>
          <p style="margin-bottom:1rem;">TrendUp ("Service") values users' personal information and complies with relevant laws and regulations. (v2.8.4)</p>
          <h3>1. Information Collection</h3>
          <p>Users can use the service without registration. However, access IP, cookies, and browser information may be automatically collected for analytics and advertising purposes.</p>
          <h3>2. Advertising and Cookies (Google AdSense)</h3>
          <p>This site uses Google AdSense. Google uses cookies to serve ads based on a user's prior visits. You can opt out of personalized advertising in Google settings.</p>
        ` 
      }, 
      terms: { 
        title: "Terms of Service", 
        content: `
          <h2 style="margin-bottom:1.5rem;">Terms of Service</h2>
          <p style="margin-bottom:1rem;">By using TrendUp, you agree to comply with and be bound by the following terms.</p>
          <h3>1. Accuracy of Information</h3>
          <p>All trending data and AI-generated summaries are for reference only. We do not guarantee accuracy or completeness. Do not use this as a basis for critical decision-making.</p>
        ` 
      }, 
      contact: { 
        title: "Contact Us", 
        content: `
          <h2 style="margin-bottom:1.5rem;">Contact Us</h2>
          <p style="margin-bottom:1rem;">If you have any questions or feedback, please contact us via email.</p>
          <p><strong>Email:</strong> help@trendup.ai</p>
        ` 
      },
      cookie: {
        text: "TrendUp uses cookies to improve service quality and provide personalized content.",
        btn: "Accept"
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
  set data({ trends, lang, country }) { this.render(trends, lang, country); }
  render(trends, lang, country) {
    const t = i18n[lang] || i18n.en;
    const countryToLang = { 'KR': 'ko', 'JP': 'ja', 'US': 'en' };
    const nativeLang = countryToLang[country];

    const getTrendIcon = (dir) => {
      if (dir === 'up') return '<span style="color: #ff4d4d; font-weight: 900; font-size: 0.9rem;">↑</span>';
      if (dir === 'down') return '<span style="color: #4d79ff; font-weight: 900; font-size: 0.9rem;">↓</span>';
      if (dir === 'new') return '<span style="color: #ffaa00; font-size: 0.6rem; font-weight: 800; border: 1px solid #ffaa00; padding: 1px 4px; border-radius: 4px; letter-spacing: -0.02em;">NEW</span>';
      return '<span style="color: var(--text-muted); opacity: 0.3; font-size: 0.8rem;">-</span>';
    };
    this.shadowRoot.innerHTML = `<style>:host { display: block; } .list { display: flex; flex-direction: column; gap: 0.75rem; } .item { display: grid; grid-template-columns: 40px 1fr auto; align-items: center; background: var(--surface); padding: 1.2rem; border-radius: 16px; border: 1px solid var(--border); transition: 0.2s; color: var(--text); cursor: pointer; user-select: none; position: relative; z-index: 1; } .item:hover { border-color: var(--primary); transform: translateY(-2px); box-shadow: var(--shadow-hover); } .rank { font-size: 1.2rem; font-weight: 900; color: var(--primary); opacity: 0.8; } .title-group { display: flex; flex-direction: column; overflow: hidden; } .display-title { font-size: 1.05rem; font-weight: 700; padding-right: 0.5rem; line-height: 1.4; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; } .translated-subtitle { font-size: 0.75rem; color: var(--text-muted); opacity: 0.7; margin-top: 0.2rem; font-weight: 500; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; } .growth { font-size: 1.1rem; display: flex; align-items: center; justify-content: center; min-width: 45px; } .loading { text-align: center; padding: 4rem; color: var(--text-muted); font-size: 0.9rem; }</style>
      <div class="list">${(!trends || trends.length === 0) ? `<div class="loading">${t.loading}</div>` : trends.map((item, index) => {
        const originalTitle = item.originalTitle || item.title;
        const translatedTitle = (item.translations && item.translations[lang]) ? item.translations[lang] : "";

        // UI Requirement: Original title large, Translation small
        const hasTranslation = translatedTitle && (translatedTitle.toLowerCase() !== originalTitle.toLowerCase());

        return `<div class="item" data-index="${index}"><span class="rank">${index + 1}</span><div class="title-group"><span class="display-title">${originalTitle}</span>${hasTranslation ? `<span class="translated-subtitle">${translatedTitle}</span>` : ''}</div><span class="growth">${getTrendIcon(item.trendDir)}</span></div>`;
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
    let analysis = trend.aiReports?.[lang] || trend.aiReports?.['ko'] || (trend.snippets && trend.snippets.length > 0 ? trend.snippets.join(' ') : "AI Analysis Report Loading...");
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
    this.currentCountry = localStorage.getItem('country') || this.service.autoDetectCountry();
    this.currentLang = localStorage.getItem('lang') || (this.currentCountry === 'KR' ? 'ko' : this.currentCountry === 'JP' ? 'ja' : 'en');
    this.themeMode = localStorage.getItem('theme-mode') || 'system';
    this.db = null;
    this.init();
  }
  async init() {
    console.log("App Init: v2.5.2");
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
        if (trendListEl) trendListEl.data = { trends, lang: this.currentLang, country: this.currentCountry };
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
      document.documentElement.setAttribute('lang', this.currentLang); // Update HTML lang attribute
      document.getElementById('current-country-title').textContent = t.title;
      const footerText = document.querySelector('.footer-content p');
      if (footerText) footerText.textContent = `© 2026 GlobalTrendUp. All rights reserved. (v2.8.4)`;
      
      const menuTitles = document.querySelectorAll('.menu-section .menu-title');
      if (menuTitles[0]) menuTitles[0].textContent = t.T || "Trend Settings";
      if (menuTitles[1]) menuTitles[1].textContent = t.menu.siteInfo;

      // Translate 'Trends:' and 'Language:' labels in side menu
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
    } catch (e) { console.error("UI refresh error:", e); }
  }

  updateSEOMeta(firstTrend) {
    if (!firstTrend) return;
    const t = i18n[this.currentLang] || i18n.en;
    const trendTitle = firstTrend.originalTitle || firstTrend.title;
    const translatedTitle = (firstTrend.translations && firstTrend.translations[this.currentLang]) ? firstTrend.translations[this.currentLang] : trendTitle;
    
    // 1. Update Document Title
    const newTitle = `GlobalTrendUp | ${this.currentCountry} #1: ${translatedTitle}`;
    document.title = newTitle;

    // 2. Update Meta Description
    const description = `${this.currentCountry} Real-time Trend #1: "${translatedTitle}". ${t.summary}. | Check out the latest global trends with AI summaries on GlobalTrendUp.`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', description);

    // 3. Update Open Graph Meta
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', newTitle);
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', description);
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
  async switchLang(code) { this.currentLang = code; localStorage.setItem('lang', code); this.renderNavs(); this.refreshUIText(); this.loadLocalCache(); await this.update(); }
  
  async update() {
    if (!this.db) return;
    try {
      const t = i18n[this.currentLang] || i18n.en;
      const trendDoc = await getDoc(doc(this.db, 'trends', this.currentCountry));
      if (trendDoc.exists()) {
        const dbData = trendDoc.data();
        const trends = this.service.calculateRankChanges(dbData.items, dbData.previousItems);
        const trendListEl = document.getElementById('top-trends');
        if (trendListEl) {
          trendListEl.data = { trends, lang: this.currentLang, country: this.currentCountry };
          // Update SEO Meta with the #1 trending topic
          if (trends && trends.length > 0) {
            this.updateSEOMeta(trends[0]);
          }
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
