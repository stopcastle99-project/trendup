import admin from 'firebase-admin';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

// GitHub Secrets 체크
const rawSecret = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!rawSecret || rawSecret.trim().length === 0) {
  console.error("ERROR: FIREBASE_SERVICE_ACCOUNT environment variable is missing or empty.");
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(rawSecret.trim());
} catch (e) {
  console.error("ERROR: Failed to parse FIREBASE_SERVICE_ACCOUNT JSON. Please check the secret format in GitHub Secrets.");
  process.exit(1);
}

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (e) {
  console.error("ERROR: Firebase initialization failed.");
  console.error(e.message);
  process.exit(1);
}

const db = admin.firestore();

class TrendUpdater {
  async translateBatch(texts, targetLang) {
    if (!texts || texts.length === 0) return texts;
    try {
      // 분할 처리 (너무 긴 쿼리 방지)
      const chunks = [];
      for (let i = 0; i < texts.length; i += 10) {
        chunks.push(texts.slice(i, i + 10));
      }

      const results = [];
      for (const chunk of chunks) {
        const q = chunk.join("\n");
        const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error("Translation failed");
        const data = await res.json();
        const translatedText = data[0].map(x => x[0]).join("");
        results.push(...translatedText.split("\n"));
        await new Promise(r => setTimeout(r, 500)); // Rate limit 방지
      }
      return results.map(r => r.trim());
    } catch (e) {
      console.error(`Translation Error (${targetLang}):`, e.message);
      return texts;
    }
  }

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
      return Array.from(items).slice(0, 10).map(el => {
        const title = el.textContent.trim();
        return {
          title, originalTitle: title,
          growth: 'Portal', source: 'Signal', 
          newsLinks: [{ title: `Google Search: ${title}`, source: 'Search', url: `https://www.google.com/search?q=${encodeURIComponent(title)}&tbm=nws` }], 
          sources: [], snippets: []
        };
      });
    } catch (e) { return []; }
  }

  async getYahooTrends() {
    try {
      const response = await fetch('https://search.yahoo.co.jp/realtime/term');
      if (!response.ok) return [];
      const html = await response.text();
      const dom = new JSDOM(html);
      const items = dom.window.document.querySelectorAll('.Trend_Trend__item__name');
      return Array.from(items).slice(0, 10).map(el => {
        const title = el.textContent.trim();
        return {
          title, originalTitle: title,
          growth: 'Portal', source: 'Yahoo', 
          newsLinks: [{ title: `Yahoo News: ${title}`, source: 'Yahoo', url: `https://news.yahoo.co.jp/search?p=${encodeURIComponent(title)}` }], 
          sources: [], snippets: []
        };
      });
    } catch (e) { return []; }
  }

  async updateAll() {
    try {
      const countries = ['KR', 'JP', 'US'];
      const targetLangs = ['ko', 'ja', 'en'];
      
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
          if (!seen.has(norm)) { 
            seen.add(norm); 
            // 구글 트렌드에 동일 키워드가 있으면 뉴스 데이터 보강
            if (t.source !== 'Google') {
              const match = googleTrends.find(g => g.originalTitle.toLowerCase().includes(t.originalTitle.toLowerCase()) || t.originalTitle.toLowerCase().includes(g.originalTitle.toLowerCase()));
              if (match) {
                t.newsLinks = [...t.newsLinks, ...(match.newsLinks || [])];
                t.sources = [...(t.sources || []), ...(match.sources || [])];
                t.snippets = [...(t.snippets || []), ...(match.snippets || [])];
              }
            }
            unique.push(t); 
          }
          if (unique.length >= 10) break;
        }

        if (unique.length > 0) {
          // 번역 작업
          console.log(`Translating ${code} trends...`);
          for (const item of unique) {
            item.translations = {};
            item.translatedSnippets = {};
            
            for (const lang of targetLangs) {
              const translatedTitle = await this.translateBatch([item.originalTitle], lang);
              item.translations[lang] = translatedTitle[0];
              
              if (item.snippets && item.snippets.length > 0) {
                item.translatedSnippets[lang] = await this.translateBatch(item.snippets.slice(0, 3), lang);
              } else {
                item.translatedSnippets[lang] = [];
              }
            }
          }

          const docRef = db.collection('trends').doc(code);
          const oldDoc = await docRef.get();
          const oldData = oldDoc.exists ? oldDoc.data() : null;
          
          const now = admin.firestore.Timestamp.now();
          await docRef.set({
            items: unique,
            previousItems: oldData?.items || [],
            lastUpdated: now,
            status: 'healthy'
          });
          console.log(`${code} update success: ${unique.length} items.`);
        }
      }
      console.log("Global Background Sync Completed.");
      
      // 상태 점검용 메타데이터 업데이트
      await db.collection('system').doc('status').set({
        lastGlobalUpdate: admin.firestore.Timestamp.now(),
        countries: countries
      });

      process.exit(0);
    } catch (e) {
      console.error("FATAL ERROR during update process:", e);
      process.exit(1);
    }
  }
}

new TrendUpdater().updateAll();
