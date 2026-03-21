const fs = require('fs');
const filePath = '/Users/stopcastle/trendup/main.js';
let content = fs.readFileSync(filePath, 'utf8');

const newI18n = `const i18n = {
  ko: { 
    title: "실시간 글로벌 트렌드", update: "업데이트", summary: "AI 분석 리포트", news: "관련 뉴스", videos: "YouTube 뉴스", loading: "불러오는 중...", T: "트렌드 설정", L: "언어 설정", original: "원문보기",
    labels: { trends: "국가:", language: "언어:" },
    menu: { about: "TrendUp 소개", privacy: "개인정보처리방침", terms: "이용약관", contact: "문의하기", siteInfo: "사이트 정보" }, 
    pages: { 
      about: { 
        title: "TrendUp 소개", 
        content: \`
          <h2 style="margin-bottom:1.5rem;">세상을 읽는 가장 빠른 인텔리전스, TrendUp</h2>
          <p style="margin-bottom:1.2rem; line-height:1.8;">TrendUp은 고도의 빅데이터 처리 기술과 최신 AI 엔진(Google Gemini 2.5)을 융합하여 한국, 일본, 미국 등 주요 국가의 실시간 검색 트렌드를 분석하고 시각화하는 차세대 데이터 인텔리전스 플랫폼입니다.</p>
          <h3 style="margin:1.5rem 0 0.8rem; border-left:4px solid var(--primary); padding-left:0.8rem; font-size:1.1rem;">우리의 미션</h3>
          <p style="margin-bottom:1.2rem; line-height:1.8;">정보의 홍수 속에서 가장 가치 있는 '맥락'을 찾아내는 것이 우리의 목표입니다. 단순한 키워드 나열이 아닌, 왜 이 키워드가 지금 뜨고 있는지, 어떤 사회적 배경이 있는지 심층 분석하여 사용자에게 전달합니다.</p>
          <h3 style="margin:1.5rem 0 0.8rem; border-left:4px solid var(--primary); padding-left:0.8rem; font-size:1.1rem;">주요 기술력</h3>
          <ul style="margin-bottom:1.2rem; padding-left:1.5rem; list-style:disc; line-height:1.8;">
            <li><strong>실시간 글로벌 파이프라인:</strong> 신뢰도 높은 소스로부터 10분 단위로 데이터를 수집·정규화합니다.</li>
            <li><strong>문맥 기반 AI 요약:</strong> 뉴스 조각들과 소셜 반응을 종합하여 리포트 형태로 재구성합니다.</li>
            <li><strong>다국어 인사이트:</strong> 언어의 장벽을 넘어 각국의 트렌드를 모국어로 이해할 수 있도록 정교한 번역을 지원합니다.</li>
          </ul>\` 
      },
      privacy: { 
        title: "개인정보 처리방침 (Privacy Policy)", 
        content: \`
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
          <p style="margin-bottom:1rem; line-height:1.6;">문의: <a href="mailto:help@globaltrendup.com" style="color:var(--primary);">help@globaltrendup.com</a></p>\` 
      },
      terms: { 
        title: "서비스 이용약관 (Terms of Service)", 
        content: \`
          <h2 style="margin-bottom:1.5rem;">서비스 이용약관</h2>
          <p style="margin-bottom:1rem; line-height:1.6;">본 약관은 데이터 분석 결과를 제공하는 서비스 이용과 관련한 권리, 의무를 규정함을 목적으로 합니다.</p>
          <p style="margin-bottom:0.8rem; line-height:1.6;">본 서비스의 모든 정보는 참고용이며, 투자 등 결정에 대한 법적 책임을 지지 않습니다. 또한 무단 스크래핑 및 상업적 복제를 금합니다.</p>\` 
      },
      contact: { 
        title: "문의하기", 
        content: \`
          <h2 style="margin-bottom:1.5rem;">문의하기</h2>
          <p style="margin-bottom:1.2rem; line-height:1.8;">버그 리포트, 제휴 문의는 <a href="mailto:help@globaltrendup.com" style="color:var(--primary);">help@globaltrendup.com</a>을 이용해 주세요. 최대 48시간 이내에 회신해 드립니다.</p>\` 
      },
      cookie: { text: "TrendUp은 원활한 서비스 및 맞춤형 콘텐츠 제공을 위해 쿠키를 활용합니다.", btn: "동의 및 계속" }
    }
  },
  ja: { 
    title: "リアルタイムトレンド", update: "最終更新", summary: "AI分析レポート", news: "関連ニュース", videos: "YouTubeニュース", loading: "読み込み中...", T: "トレンド設定", L: "言語設定", original: "原文",
    labels: { trends: "国:", language: "言語:" },
    menu: { about: "TrendUpについて", privacy: "プライバシーポリシー", terms: "利用規約", contact: "お問い合わせ", siteInfo: "サイト情報" }, 
    pages: { 
      about: { 
        title: "TrendUpについて", 
        content: \`
          <h2 style="margin-bottom:1.5rem;">TrendUp: 次世代のデータインテリジェンス</h2>
          <p style="margin-bottom:1.2rem; line-height:1.8;">TrendUpは、日本、米国、韓国などの検索トレンドをリアルタイムで分析するプラットフォームです。AI(Google Gemini 2.5)を活用し、文脈を見つけ出します。</p>
          <ul style="margin-bottom:1.2rem; padding-left:1.5rem; list-style:disc; line-height:1.8;">
            <li><strong>リアルタイム収集：</strong>10分間隔でデータを収集・正規化。</li>
            <li><strong>AI文脈分析：</strong>キーワードの背景にあるストーリーをAIが解説。</li>
            <li><strong>多言語サポート：</strong>母国語で世界の最新動向にアクセス可能。</li>
          </ul>\` 
      }, 
      privacy: { 
        title: "プライバシーポリシー", 
        content: \`
          <h2 style="margin-bottom:1.5rem;">プライバシーポリシー</h2>
          <p style="margin-bottom:1rem; line-height:1.6;">当サイトでは<strong>Google AdSense</strong>の広告を掲載しており、ユーザー状況に応じた広告配信のためCookieを利用します。ユーザーはアクセス制限設定に従うことができます。第三者配信事業者は過去のサイト訪問に基づきCookieを使用します。<a href="https://adssettings.google.com" target="_blank" style="color:var(--primary);">Google広告設定</a>からパーソナライズを無効にできます。</p>
          <p>お問い合わせ: <a href="mailto:help@globaltrendup.com">help@globaltrendup.com</a></p>\` 
      }, 
      terms: { 
        title: "利用規約", 
        content: \`
          <h2 style="margin-bottom:1.5rem;">利用規約</h2>
          <p style="margin-bottom:0.8rem; line-height:1.6;">提供される情報は参考用であり、いかなる法的責任も負いません。事前の同意のないスクレイピング等も禁止します。</p>\` 
      }, 
      contact: { 
        title: "お問い合わせ", 
        content: \`
          <h2 style="margin-bottom:1.5rem;">お問い合わせ</h2>
          <p>サービスに関する報告や提案は <a href="mailto:help@globaltrendup.com">help@globaltrendup.com</a> へお願いいたします。</p>\` 
      },
      cookie: { text: "TrendUpはサービス向上のためにCookieを使用します。", btn: "同意して続ける" }
    }
  },
  en: { 
    title: "Global Trends", update: "Updated", summary: "AI Analysis Report", news: "Top Stories", videos: "YouTube News", loading: "Loading...", T: "Trend Settings", L: "Language Settings", original: "Original",
    labels: { trends: "Country:", language: "Language:" },
    menu: { about: "About TrendUp", privacy: "Privacy Policy", terms: "Terms of Service", contact: "Contact Us", siteInfo: "Site Info" }, 
    pages: { 
      about: { 
        title: "About TrendUp", 
        content: \`
          <h2 style="margin-bottom:1.5rem;">TrendUp: Global Trend Intelligence</h2>
          <p style="margin-bottom:1.2rem; line-height:1.8;">TrendUp is a next-generation platform utilizing advanced Big Data workflows and AI (Google Gemini 2.5) to analyze real-time search trends from major countries, including the US, Japan, and South Korea.</p>
          <ul style="margin-bottom:1.2rem; padding-left:1.5rem; list-style:disc; line-height:1.8;">
            <li><strong>Real-time Global Pipeline:</strong> Trends updated every 10 minutes.</li>
            <li><strong>Contextual AI Summaries:</strong> Synthesizing news and reactions into intelligent reports.</li>
            <li><strong>Multilingual Insights:</strong> Localization enabling dynamic understanding of global issues.</li>
          </ul>\` 
      }, 
      privacy: { 
        title: "Privacy Policy", 
        content: \`
          <h2 style="margin-bottom:1.5rem;">Privacy Policy</h2>
          <p style="margin-bottom:1rem; line-height:1.6;">TrendUp operates for free through advertising and uses <strong>Google AdSense</strong>. Third-party vendors, including Google, use cookies to serve ads based on a user's prior visits. You may opt out of personalized advertising by visiting <a href="https://adssettings.google.com" target="_blank" style="color:var(--primary);">Google Ads Settings</a>. We value user privacy and primarily use anonymous analytics data to improve our services.</p>
          <p>Contact: <a href="mailto:help@globaltrendup.com">help@globaltrendup.com</a></p>\` 
      }, 
      terms: { 
        title: "Terms of Service", 
        content: \`
          <h2 style="margin-bottom:1.5rem;">Terms of Service</h2>
          <p style="margin-bottom:0.8rem; line-height:1.6;">Information provided is generated automatically by AI and is intended for reference purposes only. We shall not assume legal responsibility for the outcomes of any decisions based on this data. Unauthorized scraping is strictly prohibited.</p>\` 
      }, 
      contact: { 
        title: "Contact Us", 
        content: \`
          <h2 style="margin-bottom:1.5rem;">Contact Us</h2>
          <p>For inquiries, bug reports, and features, please email <a href="mailto:help@globaltrendup.com">help@globaltrendup.com</a>.</p>\` 
      },
      cookie: { text: "TrendUp uses cookies to improve service quality and serve optimized content.", btn: "Accept & Continue" }
    } 
  }
};`;

const firebaseConfigIndex = content.indexOf('const firebaseConfig');
if (firebaseConfigIndex > -1) {
  content = newI18n + '\\n\\n' + content.substring(firebaseConfigIndex);
}

// Ensure refreshUIText translates last-updated properly
content = content.replace(
  /const cookieBtn = document\.getElementById\('accept-cookies'\);\s+if \(cookieBtn && t\.pages\.cookie\) cookieBtn\.textContent = t\.pages\.cookie\.btn;\s+this\.updateGeminiUsage\(\);/gs,
  \`const cookieBtn = document.getElementById('accept-cookies');
      if (cookieBtn && t.pages.cookie) cookieBtn.textContent = t.pages.cookie.btn;
      
      const lastUpdatedEl = document.getElementById('last-updated');
      if (lastUpdatedEl && lastUpdatedEl.textContent.includes(':')) {
        const parts = lastUpdatedEl.textContent.split(':');
        const timePart = parts.slice(1).join(':').trim();
        if (timePart.length > 0) {
           lastUpdatedEl.textContent = \\\`\\\${t.update}: \\\${timePart}\\\`;
        }
      }
      this.updateGeminiUsage();\`
);

fs.writeFileSync(filePath, content);
console.log('Fixed syntax, expanded content, and handled #last-updated language switch.');
