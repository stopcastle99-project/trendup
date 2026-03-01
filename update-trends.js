import admin from 'firebase-admin';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

// GitHub Secrets에서 가져올 서비스 계정 정보
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

class TrendUpdater {
  async getGoogleTrends(country) {
    const rssUrl = `https://trends.google.com/trending/rss?geo=${country}`;
    try {
      const response = await fetch(rssUrl);
      const text = await response.text();
      const { window } = new JSDOM(text, { contentType: "text/xml" });
      const items = window.document.querySelectorAll("item");
      
      return Array.from(items).map(item => {
        const title = item.querySelector("title")?.textContent || "";
        const traffic = item.getElementsByTagName("ht:approx_traffic")[0]?.textContent || "N/A";
        const newsItems = item.getElementsByTagName("ht:news_item");
        const snippets = [];
        const sources = new Set();
        const newsLinks = [];

        for (let n of newsItems) {
          const nt = n.getElementsByTagName("ht:news_item_title")[0]?.textContent;
          const nu = n.getElementsByTagName("ht:news_item_url")[0]?.textContent;
          const ns = n.getElementsByTagName("ht:news_item_source")[0]?.textContent;
          const nsn = n.getElementsByTagName("ht:news_item_snippet")[0]?.textContent;
          if (nt && nu) {
            newsLinks.push({ title: nt, source: ns || 'News', url: nu });
            if (ns) sources.add(ns);
            const cleanSnippet = nsn ? nsn.replace(/<[^>]*>?/gm, '').trim() : "";
            if (cleanSnippet) snippets.push(cleanSnippet);
          }
        }
        return { 
          title, originalTitle: title, growth: traffic, 
          sources: Array.from(sources), snippets, newsLinks, source: 'Google' 
        };
      });
    } catch (e) { console.error(`Google Trends Error (${country}):`, e); return []; }
  }

  async getSignalTrends() {
    try {
      const response = await fetch('https://signal.bz/');
      const html = await response.text();
      const dom = new JSDOM(html);
      const items = dom.window.document.querySelectorAll('.rank-item .text');
      return Array.from(items).slice(0, 10).map(el => ({
        title: el.textContent.trim(), originalTitle: el.textContent.trim(),
        growth: 'Portal', source: 'Signal', newsLinks: [], sources: [], snippets: []
      }));
    } catch (e) { return []; }
  }

  async getYahooTrends() {
    try {
      const response = await fetch('https://search.yahoo.co.jp/realtime/term');
      const html = await response.text();
      const dom = new JSDOM(html);
      const items = dom.window.document.querySelectorAll('.Trend_Trend__item__name');
      return Array.from(items).slice(0, 10).map(el => ({
        title: el.textContent.trim(), originalTitle: el.textContent.trim(),
        growth: 'Portal', source: 'Yahoo', newsLinks: [], sources: [], snippets: []
      }));
    } catch (e) { return []; }
  }

  async updateAll() {
    const countries = ['KR', 'JP', 'US'];
    for (const code of countries) {
      console.log(`Updating ${code}...`);
      let portalTrends = [];
      if (code === 'KR') portalTrends = await this.getSignalTrends();
      if (code === 'JP') portalTrends = await this.getYahooTrends();
      
      const googleTrends = await this.getGoogleTrends(code);
      const combined = [...portalTrends, ...googleTrends];
      
      // 중복 제거 및 상위 10개 추출
      const seen = new Set();
      const unique = [];
      for (const t of combined) {
        const norm = t.originalTitle.toLowerCase().replace(/\s/g, '');
        if (!seen.has(norm)) { seen.add(norm); unique.push(t); }
        if (unique.length >= 10) break;
      }

      if (unique.length >= 5) {
        const docRef = db.collection('trends').doc(code);
        const oldDoc = await docRef.get();
        const oldData = oldDoc.exists ? oldDoc.data() : null;
        
        await docRef.set({
          items: unique,
          previousItems: oldData?.items || [],
          lastUpdated: admin.firestore.Timestamp.now()
        });
        console.log(`${code} updated successfully.`);
      }
    }
    process.exit(0);
  }
}

new TrendUpdater().updateAll();
