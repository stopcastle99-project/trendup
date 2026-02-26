import * as THREE from 'three';

// --- Trend Service (Real API Integration via RSS) ---
class TrendService {
  constructor() {
    this.proxyUrl = 'https://api.allorigins.win/get?url=';
    this.refreshInterval = 15 * 60 * 1000; // 15 minutes
  }

  async getTrends(country) {
    const rssUrl = `https://trends.google.com/trending/rss?geo=${country}`;
    const targetUrl = encodeURIComponent(rssUrl);
    
    try {
      const response = await fetch(`${this.proxyUrl}${targetUrl}`);
      if (!response.ok) throw new Error('Network response was not ok');
      
      const data = await response.json();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(data.contents, "text/xml");
      
      const items = xmlDoc.querySelectorAll("item");
      const trends = [];

      items.forEach((item, index) => {
        if (index >= 10) return; // Top 10 only

        const title = item.querySelector("title")?.textContent;
        const traffic = item.getElementsByTagName("ht:approx_traffic")[0]?.textContent || "N/A";
        const description = item.querySelector("description")?.textContent || "";
        const picture = item.getElementsByTagName("ht:picture")[0]?.textContent || "";
        
        // Parse News Items
        const newsElements = item.getElementsByTagName("ht:news_item");
        const links = [];
        let analysis = description;

        for (let i = 0; i < newsElements.length; i++) {
          const newsTitle = newsElements[i].getElementsByTagName("ht:news_item_title")[0]?.textContent;
          const newsUrl = newsElements[i].getElementsByTagName("ht:news_item_url")[0]?.textContent;
          const newsSnippet = newsElements[i].getElementsByTagName("ht:news_item_snippet")[0]?.textContent;
          const newsSource = newsElements[i].getElementsByTagName("ht:news_item_source")[0]?.textContent;

          if (newsTitle && newsUrl) {
            links.push({
              type: i === 0 ? 'news' : 'video', // Mocking type for UI variety
              title: `[${newsSource}] ${newsTitle}`,
              url: newsUrl
            });
          }

          // Use the first news snippet as a more detailed analysis if description is empty
          if (i === 0 && newsSnippet) {
            analysis = newsSnippet;
          }
        }

        trends.push({
          title,
          category: "Trending Now",
          growth: traffic,
          analysis: analysis || "최신 트렌드 분석 데이터가 업데이트 중입니다.",
          links: links.length > 0 ? links : [{ type: 'news', title: '관련 검색 결과 확인', url: item.querySelector("link")?.textContent || "#" }],
          picture
        });
      });

      return trends;
    } catch (error) {
      console.error("Error fetching trends:", error);
      return []; // Return empty or fallback
    }
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
          color: white;
          cursor: pointer;
        }
        .item:hover {
          transform: translateY(-4px);
          background: oklch(0.25 0.04 240 / 0.8);
          border-color: oklch(0.65 0.25 20);
          box-shadow: 0 20px 40px -10px oklch(0 0 0 / 0.5);
        }
        .rank {
          font-size: 1.5rem;
          font-weight: 800;
          color: oklch(0.65 0.25 20);
        }
        .content { display: flex; flex-direction: column; gap: 0.25rem; }
        .title { font-size: 1.15rem; font-weight: 700; }
        .category { font-size: 0.75rem; text-transform: uppercase; color: oklch(0.7 0.02 240); }
        .growth {
          font-family: monospace;
          color: oklch(0.8 0.15 140);
          font-weight: 700;
          background: oklch(0.8 0.15 140 / 0.1);
          padding: 0.25rem 0.6rem;
          border-radius: 6px;
        }
        .loading { text-align: center; padding: 2rem; color: var(--text-muted); }
      </style>
      <div class="list">
        ${data.length === 0 ? '<div class="loading">트렌드 데이터를 불러오는 중입니다...</div>' : 
          data.map((item, index) => `
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
        <h4 class="links-title">실시간 관련 소식</h4>
        <div class="links-grid">
          ${trend.links.map(link => `
            <a href="${link.url}" target="_blank" class="link-item">
              <span class="link-icon">${link.type === 'video' ? '📺' : '📰'}</span>
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
          top: 0; left: 0; width: 100%; height: 100%;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(10px);
          display: flex; align-items: center; justify-content: center;
          z-index: 2000; opacity: 0; pointer-events: none; transition: opacity 0.4s;
        }
        .overlay.active { opacity: 1; pointer-events: auto; }
        .modal {
          background: oklch(0.15 0.02 240);
          width: 90%; max-width: 650px; max-height: 85vh;
          border-radius: 24px; border: 1px solid oklch(0.3 0.03 240 / 0.5);
          box-shadow: 0 30px 60px -15px rgba(0,0,0,0.9);
          overflow-y: auto; transform: translateY(20px); transition: transform 0.4s;
          display: flex; flex-direction: column;
        }
        .overlay.active .modal { transform: translateY(0); }
        .header {
          padding: 2.5rem 2rem 1.5rem;
          background: linear-gradient(to bottom, oklch(0.2 0.03 240), transparent);
          border-bottom: 1px solid oklch(0.3 0.03 240 / 0.3);
          position: relative;
        }
        .close-btn {
          position: absolute; top: 1.5rem; right: 1.5rem;
          background: oklch(0.25 0.04 240); border: none; color: white;
          width: 32px; height: 32px; border-radius: 50%; cursor: pointer;
          display: flex; align-items: center; justify-content: center; font-size: 1.2rem;
        }
        .category {
          color: oklch(0.65 0.25 20); text-transform: uppercase;
          font-size: 0.8rem; font-weight: 800; letter-spacing: 0.1em; margin-bottom: 0.5rem; display: block;
        }
        .title { font-size: clamp(1.5rem, 5vw, 2.25rem); font-weight: 800; line-height: 1.2; margin: 0; }
        .content { padding: 2rem; flex: 1; }
        .analysis-label { font-weight: 700; font-size: 1.2rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; color: white; }
        .analysis-label::before { content: "🔥"; }
        .text { color: oklch(0.85 0.02 240); line-height: 1.8; font-size: 1.15rem; margin-bottom: 2.5rem; }
        .links-section { background: oklch(0.12 0.02 240 / 0.5); padding: 1.5rem; border-radius: 16px; border: 1px solid oklch(0.3 0.03 240 / 0.3); }
        .links-title { font-size: 0.9rem; text-transform: uppercase; color: oklch(0.7 0.02 240); margin-bottom: 1rem; }
        .links-grid { display: flex; flex-direction: column; gap: 0.75rem; }
        .link-item {
          display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 1rem;
          background: oklch(0.2 0.03 240); padding: 1rem 1.25rem; border-radius: 12px;
          text-decoration: none; color: white; transition: all 0.2s;
        }
        .link-item:hover { background: oklch(0.25 0.04 240); transform: scale(1.01); border: 1px solid oklch(0.65 0.25 20); }
        .link-icon { font-size: 1.2rem; }
        .link-text { font-size: 0.95rem; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .footer { padding: 1.5rem 2rem; background: oklch(0.12 0.02 240); border-top: 1px solid oklch(0.3 0.03 240 / 0.3); }
      </style>
      <div class="overlay">
        <div class="modal">
          <div class="header">
            <button class="close-btn">&times;</button>
            <span class="category">${trend.category}</span>
            <h2 class="title">${trend.title}</h2>
          </div>
          <div class="content">
            <div class="analysis-label">실시간 트렌드 요약</div>
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

    // 15-minute refresh
    setInterval(() => this.updateTrends(), this.service.refreshInterval);
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
    
    const countryName = this.service.getCountries().find(c => c.code === code).name;
    document.getElementById('current-country-title').textContent = `${countryName} 실시간 트렌드`;
    
    await this.updateTrends();
  }

  async updateTrends() {
    // Show loading if needed (clear existing or handled in component)
    const trends = await this.service.getTrends(this.currentCountry);
    const trendList = document.getElementById('top-trends');
    trendList.trends = trends;
    
    const now = new Date();
    document.getElementById('last-updated').textContent = 
      `최근 업데이트: ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  }

  initThreeBg() {
    const canvas = document.querySelector('#bg-canvas');
    if (!canvas) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    const particlesGeometry = new THREE.BufferGeometry();
    const count = 1000;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) {
      positions[i] = (Math.random() - 0.5) * 15;
    }
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particlesMaterial = new THREE.PointsMaterial({ size: 0.02, color: 0x888888, transparent: true, opacity: 0.5 });
    const particles = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particles);

    const animate = () => {
      requestAnimationFrame(animate);
      particles.rotation.y += 0.001;
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
