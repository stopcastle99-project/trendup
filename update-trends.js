import admin from 'firebase-admin';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

// GitHub Secrets 체크 및 로깅
const rawSecret = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!rawSecret || rawSecret.trim().length === 0) {
  console.error("ERROR: FIREBASE_SERVICE_ACCOUNT environment variable is missing or empty.");
  process.exit(1);
}

console.log(`Debug: Received secret string with length: ${rawSecret.length}`);

let serviceAccount;
try {
  // 앞뒤 공백 제거 후 파싱
  serviceAccount = JSON.parse(rawSecret.trim());
  console.log("Firebase Service Account JSON parsed successfully.");
} catch (e) {
  console.error("ERROR: Failed to parse FIREBASE_SERVICE_ACCOUNT JSON. Please check the secret format.");
  console.error("Error Message:", e.message);
  // 보안을 위해 실제 내용을 출력하지 않지만, 시작과 끝 문자만 살짝 노출하여 힌트 제공
  console.log(`Hint: String starts with '${rawSecret.substring(0, 5)}...' and ends with '${rawSecret.substring(rawSecret.length - 5)}'`);
  process.exit(1);
}

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log("Firebase initialized successfully.");
} catch (e) {
  console.error("ERROR: Firebase initialization failed.");
  console.error(e.message);
  process.exit(1);
}

const db = admin.firestore();

class TrendUpdater {
  async getGoogleTrends(country) {
    const rssUrl = `https://trends.google.com/trending/rss?geo=${country}`;
    try {
      const response = await fetch(rssUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      const { window } = new JSDOM(text, { contentType: "text/xml" });
      const items = window.document.querySelectorAll("item");
      
      return Array.from(items).map(item => {
        const title = item.querySelector("title")?.textContent || "";
        const trafficEl = item.getElementsByTagName("ht:approx_traffic")[0] || item.getElementsByTagName("approx_traffic")[0];
        const traffic = trafficEl?.textContent || "N/A";
        
        const newsItems = item.getElementsByTagName("ht:news_item") || item.getElementsByTagName("news_item");
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
    } catch (e) { console.error(`Google Trends Error (${country}):`, e.message); return []; }
  }

  async getSignalTrends() {
    try {
      const response = await fetch('https://signal.bz/');
      if (!response.ok) return [];
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
      if (!response.ok) return [];
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
    try {
      const countries = ['KR', 'JP', 'US'];
      for (const code of countries) {
        console.log(`Updating ${code}...`);
        let portalTrends = [];
        if (code === 'KR') portalTrends = await this.getSignalTrends();
        if (code === 'JP') portalTrends = await this.getYahooTrends();
        
        const googleTrends = await this.getGoogleTrends(code);
        const combined = [...portalTrends, ...googleTrends];
        
        const seen = new Set();
        const unique = [];
        for (const t of combined) {
          const norm = t.originalTitle.toLowerCase().replace(/\s/g, '');
          if (!seen.has(norm)) { seen.add(norm); unique.push(t); }
          if (unique.length >= 10) break;
        }

        if (unique.length > 0) {
          const docRef = db.collection('trends').doc(code);
          const oldDoc = await docRef.get();
          const oldData = oldDoc.exists ? oldDoc.data() : null;
          
          await docRef.set({
            items: unique,
            previousItems: oldData?.items || [],
            lastUpdated: admin.firestore.Timestamp.now()
          });
          console.log(`${code} updated with ${unique.length} items.`);
        } else {
          console.warn(`Warning: No trends found for ${code}. Skipping DB update.`);
        }
      }
      console.log("All tasks completed.");
      process.exit(0);
    } catch (e) {
      console.error("FATAL ERROR during update process:");
      console.error(e);
      process.exit(1);
    }
  }
}

new TrendUpdater().updateAll();
