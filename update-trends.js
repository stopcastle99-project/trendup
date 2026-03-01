import admin from 'firebase-admin';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

const rawSecret = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!rawSecret || rawSecret.trim().length === 0) {
  console.error("ERROR: FIREBASE_SERVICE_ACCOUNT is missing.");
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(rawSecret.trim());
} catch (e) {
  console.error("ERROR: Failed to parse Secret.");
  process.exit(1);
}

try {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} catch (e) {
  console.error("ERROR: Firebase Init Failed.");
  process.exit(1);
}

const db = admin.firestore();

class TrendUpdater {
  // 번역 로직 강화: 배치 번역 실패 시 개별 번역으로 전환
  async translateBatch(texts, targetLang) {
    if (!texts || texts.length === 0) return [];
    
    const translateSingle = async (text, tl) => {
      try {
        const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`);
        const data = await res.json();
        return data[0].map(x => x[0]).join("").trim();
      } catch (e) { return text; }
    };

    try {
      const separator = " ||| ";
      const combinedText = texts.join(separator);
      const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(combinedText)}`);
      
      if (!res.ok) throw new Error("Batch API Error");
      
      const data = await res.json();
      const translatedCombined = data[0].map(x => x[0]).join("");
      
      // 다양한 변형 구분자 대응 (공백 유무 등)
      const results = translatedCombined.split(/\|\|\||\| \| \|/).map(s => s.trim());
      
      if (results.length === texts.length) {
        return results;
      } else {
        console.warn(`Batch failed for ${targetLang}, falling back to individual translation.`);
        return await Promise.all(texts.map(t => translateSingle(t, targetLang)));
      }
    } catch (e) {
      return await Promise.all(texts.map(t => translateSingle(t, targetLang)));
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
        const traffic = (item.getElementsByTagName("ht:approx_traffic")[0] || item.getElementsByTagName("approx_traffic")[0])?.textContent || "N/A";
        const newsItems = item.getElementsByTagName("ht:news_item") || item.getElementsByTagName("news_item");
        const snippets = [];
        const newsLinks = [];
        for (let n of newsItems) {
          const nt = n.getElementsByTagName("ht:news_item_title")[0]?.textContent;
          const nu = n.getElementsByTagName("ht:news_item_url")[0]?.textContent;
          const ns = n.getElementsByTagName("ht:news_item_source")[0]?.textContent;
          const nsn = n.getElementsByTagName("ht:news_item_snippet")[0]?.textContent;
          if (nt && nu) {
            newsLinks.push({ title: nt, source: ns || 'News', url: nu });
            if (nsn) snippets.push(nsn.replace(/<[^>]*>?/gm, '').trim());
          }
        }
        return { title, originalTitle: title, growth: traffic, sources: [], snippets, newsLinks, source: 'Google' };
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
          newsLinks: [{ title: `Naver: ${title}`, source: 'Naver', url: `https://search.naver.com/search.naver?query=${encodeURIComponent(title)}` }], 
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
          newsLinks: [{ title: `Yahoo JP: ${title}`, source: 'Yahoo', url: `https://search.yahoo.co.jp/search?p=${encodeURIComponent(title)}` }], 
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
            console.log(`Translating ${code} items to ${lang}...`);
            const titles = unique.map(item => item.originalTitle);
            const translatedTitles = await this.translateBatch(titles, lang);
            
            const snippets = unique.map(item => (item.snippets && item.snippets.length > 0) ? item.snippets[0] : "");
            const translatedSnippets = await this.translateBatch(snippets, lang);

            unique.forEach((item, idx) => {
              if (!item.translations) item.translations = {};
              if (!item.translatedSnippets) item.translatedSnippets = {};
              item.translations[lang] = translatedTitles[idx] || item.originalTitle;
              item.translatedSnippets[lang] = translatedSnippets[idx] ? [translatedSnippets[idx]] : [];
            });
            await new Promise(r => setTimeout(r, 500));
          }

          const docRef = db.collection('trends').doc(code);
          const oldDoc = await docRef.get();
          await docRef.set({
            items: unique,
            previousItems: oldDoc.exists ? oldDoc.data().items || [] : [],
            lastUpdated: admin.firestore.Timestamp.now()
          });
          console.log(`Saved ${code} to Firestore.`);
        }
      }
      process.exit(0);
    } catch (e) { process.exit(1); }
  }
}

new TrendUpdater().updateAll();
