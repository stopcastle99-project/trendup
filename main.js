import * as THREE from 'three';

// --- Trend Service ---
class TrendService {
  constructor() {
    this.trends = {
      KR: [
        { 
          title: "ChatGPT-5 출시 임박", 
          category: "Technology", 
          growth: "+1250%",
          analysis: "최근 오픈AI의 차세대 거대언어모델(LLM)인 ChatGPT-5에 대한 새로운 벤치마크 결과와 내부 테스트 소식이 유출되면서 전 세계 IT 업계의 이목이 집중되고 있습니다. 이전 모델보다 비약적으로 발전된 추론 능력과 멀티모달 기능이 기대되고 있습니다.",
          links: [
            { type: 'news', title: "오픈AI, 차세대 모델 'GPT-5' 성능 유출 소동", url: "https://example.com/news1" },
            { type: 'video', title: "GPT-5 무엇이 달라지나? 핵심 요약", url: "https://youtube.com/watch?v=example1" }
          ]
        },
        { 
          title: "손흥민 멀티골", 
          category: "Sports", 
          growth: "+850%",
          analysis: "토트넘 홋스퍼의 손흥민 선수가 오늘 새벽 열린 프리미어리그 경기에서 환상적인 멀티골을 기록하며 팀의 승리를 이끌었습니다. 이로써 손흥민 선수는 득점 순위 상위권으로 도약하며 다시 한번 '월드클래스'임을 증명했습니다.",
          links: [
            { type: 'news', title: "손흥민, 리그 15·16호골 폭발... 팀은 3-0 완승", url: "https://example.com/news2" },
            { type: 'video', title: "[H/L] 토트넘 vs 맨시티 손흥민 멀티골 하이라이트", url: "https://youtube.com/watch?v=example2" }
          ]
        },
        { 
          title: "환율 1400원 돌파", 
          category: "Economy", 
          growth: "+600%",
          analysis: "미국 연준의 고금리 유지 기조와 글로벌 경제 불확실성이 지속되면서 원-달러 환율이 심리적 저항선인 1400원을 돌파했습니다. 수입 물가 상승에 따른 인플레이션 우려가 커지면서 금융 당국의 개입 여부에 시장이 주목하고 있습니다.",
          links: [
            { type: 'news', title: "환율 1400원선 터치... 외환 당국 긴급 구두 개입", url: "https://example.com/news3" },
            { type: 'video', title: "고환율 시대, 우리 경제에 미치는 영향은?", url: "https://youtube.com/watch?v=example3" }
          ]
        },
        { title: "신작 게임 '스타렐' 오픈", category: "Gaming", growth: "+520%", analysis: "유명 개발사의 신작 오픈월드 RPG '스타렐'이 오늘 정식 서비스를 시작했습니다. 압도적인 그래픽과 자유도 높은 게임성으로 출시 직후 수많은 유저들이 몰리며 서버 대기열이 발생하는 등 뜨거운 반응을 얻고 있습니다.", links: [{ type: 'news', title: "'스타렐' 출시 첫날 동접자 100만 돌파", url: "#" }, { type: 'video', title: "스타렐 초반 공략 가이드", url: "#" }] },
        { title: "벚꽃 개화 시기", category: "Lifestyle", growth: "+480%", analysis: "올해 평년보다 따뜻한 기온이 이어지면서 벚꽃 개화 시기가 예년보다 3~5일 앞당겨질 것으로 예측되었습니다. 주말 나들이를 계획하는 시민들이 늘어나면서 전국 벚꽃 명소와 축제 일정에 대한 검색량이 급증하고 있습니다.", links: [{ type: 'news', title: "2024 전국 벚꽃 지도 공개", url: "#" }] },
        { title: "아이폰 16 루머", category: "Tech", growth: "+410%", analysis: "올가을 출시 예정인 아이폰 16 시리즈에 대한 새로운 디자인 유출 정보가 공개되었습니다. 특히 카메라 배열의 변화와 새로운 '캡처 버튼' 도입 소식이 전해지면서 테크 커뮤니티에서 활발한 토론이 벌어지고 있습니다.", links: [{ type: 'news', title: "아이폰 16, 디자인 대변화 예고", url: "#" }] },
        { title: "제주도 여행 특가", category: "Travel", growth: "+350%", analysis: "대형 항공사들이 봄 시즌을 맞아 제주도 노선 대규모 할인 프로모션을 진행하면서 여행객들의 관심이 쏠리고 있습니다. 왕복 5만 원대 특가 항공권이 쏟아지며 실속 있는 봄 여행을 준비하는 사람들이 늘고 있습니다.", links: [{ type: 'news', title: "봄맞이 제주 항공권 특가 정보", url: "#" }] },
        { title: "K-POP 글로벌 빌보드", category: "Entertainment", growth: "+310%", analysis: "한국의 신인 걸그룹이 데뷔곡으로 빌보드 '핫 100' 차트 진입에 성공하며 전 세계를 놀라게 했습니다. 강력한 퍼포먼스와 중독성 있는 멜로디가 글로벌 숏폼 플랫폼에서 챌린지 열풍을 일으킨 것이 주효했습니다.", links: [{ type: 'video', title: "K-POP 신인 그룹 빌보드 기록 분석", url: "#" }] },
        { title: "비트코인 신고가", category: "Finance", growth: "+290%", analysis: "비트코인이 현물 ETF 자금 유입 가속화와 반감기 기대감에 힘입어 역대 최고가를 경신했습니다. 기관 투자자들의 참여가 확대되면서 가상자산 시장 전반에 긍정적인 에너지가 확산되고 있습니다.", links: [{ type: 'news', title: "비트코인 신고가 경신, 다음 목표가는?", url: "#" }] },
        { title: "봄 코디 추천", category: "Fashion", growth: "+210%", analysis: "본격적인 봄 날씨가 시작되면서 린넨 셔츠, 파스텔 톤 가디건 등 가벼운 아우터와 밝은 컬러의 아이템들이 인기 키워드로 떠오르고 있습니다. 올해 트렌드인 '콰이어트 럭셔리' 스타일링이 주목받고 있습니다.", links: [{ type: 'video', title: "2024 봄 트렌드 코디북", url: "#" }] }
      ],
      JP: [
        { 
          title: "大谷翔平 홈런", 
          category: "Sports", 
          growth: "+1500%",
          analysis: "ドジャースの大谷翔平選手が、今日の試合で今季第10号となる特大ホームランを放ちました。MLB全体での本塁打王争いでもトップ에立ち、日本人選手としての最多記録を連일更新しています。",
          links: [
            { type: 'news', title: "大谷翔平、10号本塁打でリーグ単独首位に", url: "#" },
            { type: 'video', title: "【速報】大谷翔平 第10号ホームラン全角度映像", url: "#" }
          ]
        },
        { 
          title: "新NISA 活用法", 
          category: "Economy", 
          growth: "+920%",
          analysis: "今年から始まった新NISA制度について、具体的な銘柄選びや長期運用のメリット를解説するコンテンツが急増しています。将来の資産形成に対する関心が高まり、20대から30대を中心に口座開設数が伸びています。",
          links: [
            { type: 'news', title: "新NISAで初心者が注意すべき3つのポイント", url: "#" }
          ]
        },
        { title: "桜前線 2024", category: "Lifestyle", growth: "+810%", analysis: "気象庁から最新の桜開花予想が発表されました。東京や京都では例年より早い開花が見込まれており、花見の場所取りや予約に関する検索が急増しています。", links: [{ type: 'news', title: "2024年 桜開花・満開予想", url: "#" }] },
        { title: "任天堂 次世代機", category: "Gaming", growth: "+750%", analysis: "Nintendo Switchの後継機に関する詳細なスペック案がサプライヤー側からリークされ、世界中のゲーマー이熱狂しています。4K対応や互換性の有無について公式発表が待たれています。", links: [{ type: 'news', title: "スイッチ次世代機、年内発表の可能性", url: "#" }] },
        { title: "円安 150円台", category: "Finance", growth: "+680%", analysis: "外国為替市場でドル円相場이一時1ドル150円台に乗せました。原材料高に伴う食品やエネルギー価格への転嫁が懸念されており、政府의介入に対する警戒感が強まっています。", links: [{ type: 'video', title: "円安150円台、家計への影響を徹底解説", url: "#" }] },
        { title: "モンスターハン터 新作", category: "Gaming", growth: "+590%", analysis: "人気シリーズ『モンスターハンター』の最新作の映像이公開され、新モンスターや狩猟アクションの進化이話題となっています。SNSではマルチプレイの募集や装備의予想で盛り上がっています。", links: [{ type: 'video', title: "モンハン最新作 ティザーPV考察", url: "#" }] },
        { title: "東京スカイツリー イベント", category: "Travel", growth: "+420%", analysis: "東京スカイツリーで開催される人気アニメとのコラボイベント이本日スタートしました。限定グッズや特別ライトアップを目当てに、国内外から多くの観光客이訪れています。", links: [{ type: 'news', title: "スカイツリー×人気アニメ コラボ詳細", url: "#" }] },
        { title: "アニメ '推しの子'", category: "Anime", growth: "+390%", analysis: "大ヒットアニメ『推しの子』の第2期放送日이決定し、新キャラクターのキャスト情報이解禁されました。衝撃的な展開と高品質な作画で期待値이最高潮에達しています。", links: [{ type: 'news', title: "『推しの子』第2期 7月放送決定", url: "#" }] },
        { title: "日本酒 フェスティバル", category: "Food", growth: "+310%", analysis: "都内で最大級の日本酒イベント이開催され、全国から100以上의蔵元이集結しています。若者の日本酒離れ를食い止めるべく、スタイリッシュな飲み方의提案이受けています。", links: [{ type: 'news', title: "日本酒フェス 2024 開催レポート", url: "#" }] },
        { title: "AI 翻訳ツール", category: "Tech", growth: "+280%", analysis: "リアルタイムで自然な会話이可能한新しいAI翻訳デバイス이登場しました。인바운드 수요의 회복에 따라 接客業이나 観光地에서의 導入이 進むと見られています。", links: [{ type: 'news', title: "最新AI翻訳機、驚きの精度を検証", url: "#" }] }
      ]
    };
  }

  async getTrends(country) {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve(this.trends[country] || []);
      }, 300);
    });
  }

  getCountries() {
    return [
      { code: 'KR', name: 'South Korea' },
      { code: 'JP', name: 'Japan' }
    ];
  }
}

// --- Web Components ---

class TrendList extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  set trends(data) {
    this.render(data);
  }

  render(data) {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        .list { display: flex; flex-direction: column; gap: 1rem; }
        .item {
          display: grid;
          grid-template-columns: 60px 1fr auto;
          align-items: center;
          background: oklch(0.2 0.03 240 / 0.5);
          padding: 1.25rem 1.5rem;
          border-radius: 16px;
          border: 1px solid oklch(0.3 0.03 240 / 0.5);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          text-decoration: none;
          color: white;
          cursor: pointer;
        }
        .item:hover {
          transform: translateY(-4px) scale(1.02);
          background: oklch(0.25 0.04 240 / 0.8);
          border-color: oklch(0.65 0.25 20);
          box-shadow: 0 20px 40px -10px oklch(0 0 0 / 0.5);
        }
        .rank {
          font-size: 1.5rem;
          font-weight: 800;
          color: oklch(0.65 0.25 20);
          opacity: 0.8;
        }
        .content { display: flex; flex-direction: column; gap: 0.25rem; }
        .title { font-size: 1.15rem; font-weight: 700; }
        .category { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: oklch(0.7 0.02 240); }
        .growth {
          font-family: monospace;
          color: oklch(0.8 0.15 140);
          font-weight: 700;
          background: oklch(0.8 0.15 140 / 0.1);
          padding: 0.25rem 0.6rem;
          border-radius: 6px;
        }
      </style>
      <div class="list">
        ${data.map((item, index) => `
          <div class="item" data-index="${index}">
            <span class="rank">${index + 1}</span>
            <div class="content">
              <span class="category">${item.category}</span>
              <span class="title">${item.title}</span>
            </div>
            <span class="growth">${item.growth}</span>
          </div>
        `).join('')}
      </div>
    `;

    this.shadowRoot.querySelectorAll('.item').forEach(item => {
      item.addEventListener('click', () => {
        const index = item.dataset.index;
        this.dispatchEvent(new CustomEvent('trend-click', {
          detail: data[index],
          bubbles: true,
          composed: true
        }));
      });
    });
  }
}

class TrendModal extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  show(trend) {
    this.render(trend);
    this.shadowRoot.querySelector('.overlay').classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  hide() {
    this.shadowRoot.querySelector('.overlay').classList.remove('active');
    document.body.style.overflow = '';
  }

  render(trend) {
    const linksHtml = trend.links ? `
      <div class="links-section">
        <h4 class="links-title">관련 정보 및 뉴스</h4>
        <div class="links-grid">
          ${trend.links.map(link => `
            <a href="${link.url}" target="_blank" class="link-item ${link.type}">
              <span class="link-icon">${link.type === 'video' ? '🎬' : '📰'}</span>
              <span class="link-text">${link.title}</span>
              <span class="link-arrow">→</span>
            </a>
          `).join('')}
        </div>
      </div>
    ` : '';

    this.shadowRoot.innerHTML = `
      <style>
        .overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.4s;
        }
        .overlay.active {
          opacity: 1;
          pointer-events: auto;
        }
        .modal {
          background: oklch(0.15 0.02 240);
          width: 90%;
          max-width: 650px;
          max-height: 85vh;
          border-radius: 24px;
          border: 1px solid oklch(0.3 0.03 240 / 0.5);
          box-shadow: 0 30px 60px -15px rgba(0,0,0,0.9);
          overflow-y: auto;
          transform: translateY(20px);
          transition: transform 0.4s;
          display: flex;
          flex-direction: column;
        }
        .overlay.active .modal {
          transform: translateY(0);
        }
        .header {
          padding: 2.5rem 2rem 1.5rem;
          background: linear-gradient(to bottom, oklch(0.2 0.03 240), transparent);
          border-bottom: 1px solid oklch(0.3 0.03 240 / 0.3);
          position: relative;
        }
        .close-btn {
          position: absolute;
          top: 1.5rem;
          right: 1.5rem;
          background: oklch(0.25 0.04 240);
          border: none;
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.2rem;
        }
        .category {
          color: oklch(0.65 0.25 20);
          text-transform: uppercase;
          font-size: 0.8rem;
          font-weight: 800;
          letter-spacing: 0.1em;
          margin-bottom: 0.5rem;
          display: block;
        }
        .title {
          font-size: clamp(1.5rem, 5vw, 2.25rem);
          font-weight: 800;
          line-height: 1.2;
          margin: 0;
        }
        .content {
          padding: 2rem;
          flex: 1;
        }
        .analysis-label {
          font-weight: 700;
          font-size: 1.2rem;
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: white;
        }
        .analysis-label::before { content: "✨"; }
        .text {
          color: oklch(0.85 0.02 240);
          line-height: 1.8;
          font-size: 1.15rem;
          margin-bottom: 2.5rem;
        }
        .links-section {
          background: oklch(0.12 0.02 240 / 0.5);
          padding: 1.5rem;
          border-radius: 16px;
          border: 1px solid oklch(0.3 0.03 240 / 0.3);
        }
        .links-title {
          font-size: 0.9rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: oklch(0.7 0.02 240);
          margin-bottom: 1rem;
        }
        .links-grid {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .link-item {
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 1rem;
          background: oklch(0.2 0.03 240);
          padding: 1rem 1.25rem;
          border-radius: 12px;
          text-decoration: none;
          color: white;
          border: 1px solid transparent;
          transition: all 0.2s;
        }
        .link-item:hover {
          background: oklch(0.25 0.04 240);
          border-color: oklch(0.3 0.03 240);
          transform: scale(1.01);
        }
        .link-icon { font-size: 1.2rem; }
        .link-text { font-size: 1rem; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .link-arrow { color: oklch(0.7 0.02 240); }
        .video:hover { border-color: oklch(0.6 0.2 20 / 0.5); }
        .news:hover { border-color: oklch(0.5 0.1 240 / 0.5); }
        .footer {
          padding: 1.5rem 2rem;
          background: oklch(0.12 0.02 240);
          border-top: 1px solid oklch(0.3 0.03 240 / 0.3);
        }
      </style>
      <div class="overlay">
        <div class="modal">
          <div class="header">
            <button class="close-btn">&times;</button>
            <span class="category">${trend.category}</span>
            <h2 class="title">${trend.title}</h2>
          </div>
          <div class="content">
            <div class="analysis-label">AI 트렌드 분석</div>
            <p class="text">${trend.analysis}</p>
            ${linksHtml}
          </div>
          <div class="footer">
            <div class="ad-slot" style="min-height: 50px; width: 100%; border-style: solid; margin: 0;">
              <p style="font-size: 0.6rem;">Ad Placeholder</p>
            </div>
          </div>
        </div>
      </div>
    `;

    this.shadowRoot.querySelector('.close-btn').addEventListener('click', () => this.hide());
    this.shadowRoot.querySelector('.overlay').addEventListener('click', (e) => {
      if (e.target === this.shadowRoot.querySelector('.overlay')) this.hide();
    });
  }
}

customElements.define('trend-list', TrendList);
customElements.define('trend-modal', TrendModal);

// --- App Controller ---

class App {
  constructor() {
    this.service = new TrendService();
    this.currentCountry = 'KR';
    this.init();
    this.initThreeBg();
  }

  async init() {
    this.modal = document.createElement('trend-modal');
    document.body.appendChild(this.modal);

    this.renderCountryNav();
    await this.updateTrends();
    
    document.getElementById('top-trends').addEventListener('trend-click', (e) => {
      this.modal.show(e.detail);
    });

    setInterval(() => this.updateTrends(), 300000);
  }

  renderCountryNav() {
    const nav = document.getElementById('country-nav');
    const countries = this.service.getCountries();
    
    nav.innerHTML = countries.map(c => `
      <button class="country-btn ${c.code === this.currentCountry ? 'active' : ''}" 
              data-code="${c.code}">
        ${c.name}
      </button>
    `).join('');

    nav.querySelectorAll('.country-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const code = e.target.dataset.code;
        if (code !== this.currentCountry) {
          this.switchCountry(code);
        }
      });
    });
  }

  async switchCountry(code) {
    this.currentCountry = code;
    document.querySelectorAll('.country-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.code === code);
    });
    
    document.getElementById('current-country-title').textContent = 
      `${this.service.getCountries().find(c => code === code ? true : false).name} 실시간 트렌드`;
    
    await this.updateTrends();
  }

  async updateTrends() {
    const trends = await this.service.getTrends(this.currentCountry);
    const trendList = document.getElementById('top-trends');
    trendList.trends = trends;
    
    const now = new Date();
    document.getElementById('last-updated').textContent = 
      `최근 업데이트: ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  }

  initThreeBg() {
    const canvas = document.querySelector('#bg-canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    const particlesGeometry = new THREE.BufferGeometry();
    const count = 1000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count * 3; i++) {
      positions[i] = (Math.random() - 0.5) * 15;
      colors[i] = Math.random();
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particlesMaterial = new THREE.PointsMaterial({
      size: 0.02,
      vertexColors: true,
      transparent: true,
      opacity: 0.5
    });

    const particles = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particles);

    const animate = () => {
      requestAnimationFrame(animate);
      particles.rotation.y += 0.001;
      particles.rotation.x += 0.0005;
      renderer.render(scene, camera);
    };

    animate();

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }
}

new App();
