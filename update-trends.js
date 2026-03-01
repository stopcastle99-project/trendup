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
  console.error("ERROR: Failed to parse FIREBASE_SERVICE_ACCOUNT JSON.");
  process.exit(1);
}

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (e) {
  console.error("ERROR: Firebase initialization failed.");
  process.exit(1);
}

const db = admin.firestore();

class TrendUpdater {
  // 번역 일괄 처리 개선
  async translateBatch(texts, targetLang) {
    if (!texts || texts.length === 0) return [];
    
    try {
      // 더 안전한 구분자 사용
      const separator = " [SEP] ";
      const combinedText = texts.join(separator);
      const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(combinedText)}`);
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const data = await res.json();
      const translatedCombined = data[0].map(x => x[0]).join("");
      
      // 구분자로 분리 후 공백 정리
      const results = translatedCombined.split("[SEP]").map(s => s.trim());
      
      if (results.length !== texts.length) {
        console.warn(`Mismatch for ${targetLang}: expected ${texts.length}, got ${results.length}. Falling back.`);
        return texts; 
      }
      return results;
    } catch (e) {
      console.error(`Translation Error (${targetLang}):`, e.message);
      return texts;
    }
  }

  async getGoogleTrends(country) {
    const rssUrl = `https://trends.google.com/trending/rss?geo=${country}`;
    try {
      const response = await fetch(rssUrl);
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
    } catch (e) { return []; }
  }

  async getSignalTrends() {
    try {
      const response = await fetch('https://signal.bz/');
      const html = await response.text();
      const dom = new JSDOM(html);
      const items = dom.window.document.querySelectorAll('.rank-item .text');
      return Array.from(items).slice(0, 10).map(el => {
        const title = el.textContent.trim();
        return {
          title, originalTitle: title, growth: 'Portal', source: 'Signal', 
          newsLinks: [{ title: `Naver News: ${title}`, source: 'Naver', url: `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(title)}` }], 
          sources: [], snippets: []
        };
      });
    } catch (e) { return []; }
  }

  async getYahooTrends() {
    try {
      const response = await fetch('https://search.yahoo.co.jp/realtime/term');
      const html = await response.text();
      const dom = new JSDOM(html);
      const items = dom.window.document.querySelectorAll('.Trend_Trend__item__name');
      return Array.from(items).slice(0, 10).map(el => {
        const title = el.textContent.trim();
        return {
          title, originalTitle: title, growth: 'Portal', source: 'Yahoo', 
          newsLinks: [{ title: `Yahoo JP: ${title}`, source: 'Yahoo', url: `https://news.yahoo.co.jp/search?p=${encodeURIComponent(title)}` }], 
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
        let combined = [];
        if (code === 'KR') combined = [...await this.getSignalTrends(), ...await this.getGoogleTrends(code)];
        else if (code === 'JP') combined = [...await this.getYahooTrends(), ...await this.getGoogleTrends(code)];
        else combined = await this.getGoogleTrends(code);
        
        const seen = new Set();
        const unique = [];
        for (const t of combined) {
          const norm = t.originalTitle.toLowerCase().replace(/\s/g, '');
          if (!seen.has(norm)) { seen.add(norm); unique.push(t); }
          if (unique.length >= 10) break;
        }

        if (unique.length > 0) {
          for (const lang of targetLangs) {
            console.log(`Translating ${code} to ${lang}...`);
            const titles = unique.map(item => item.originalTitle);
            const translatedTitles = await this.translateBatch(titles, lang);
            
            const firstSnippets = unique.map(item => (item.snippets && item.snippets.length > 0) ? item.snippets[0] : "");
            const translatedSnippets = await this.translateBatch(firstSnippets, lang);

            unique.forEach((item, idx) => {
              if (!item.translations) item.translations = {};
              if (!item.translatedSnippets) item.translatedSnippets = {};
              item.translations[lang] = translatedTitles[idx] || item.originalTitle;
              item.translatedSnippets[lang] = translatedSnippets[idx] ? [translatedSnippets[idx]] : [];
            });
          }

          const docRef = db.collection('trends').doc(code);
          const oldDoc = await docRef.get();
          await docRef.set({
            items: unique,
            previousItems: oldDoc.exists ? oldDoc.data().items || [] : [],
            lastUpdated: admin.firestore.Timestamp.now()
          });
        }
      }
      console.log("Sync Completed.");
      process.exit(0);
    } catch (e) { process.exit(1); }
  }
}

new TrendUpdater().updateAll();
