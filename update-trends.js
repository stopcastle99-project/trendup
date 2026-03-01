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
  // 번역 일괄 처리 (속도 및 정확도 향상)
  async translateBatch(texts, targetLang) {
    if (!texts || texts.length === 0) return [];
    if (targetLang === 'auto') return texts;
    
    try {
      // 텍스트들을 구분자(|||)와 함께 하나의 문자열로 결합
      const combinedText = texts.join(" ||| ");
      const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(combinedText)}`);
      
      if (!res.ok) throw new Error(`Translation API HTTP ${res.status}`);
      
      const data = await res.json();
      // 결과 조각들을 합치고 다시 구분자로 분리
      const translatedCombined = data[0].map(x => x[0]).join("");
      const results = translatedCombined.split("|||").map(s => s.trim());
      
      // 개수가 안 맞을 경우를 대비한 안전 장치
      if (results.length !== texts.length) {
        console.warn(`Translation count mismatch for ${targetLang}: expected ${texts.length}, got ${results.length}`);
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
          newsLinks: [{ title: `네이버 뉴스 검색: ${title}`, source: 'Naver', url: `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(title)}` }], 
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
          newsLinks: [{ title: `Yahoo Japan News: ${title}`, source: 'Yahoo', url: `https://news.yahoo.co.jp/search?p=${encodeURIComponent(title)}` }], 
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
        console.log(`--- Processing ${code} ---`);
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
            // 포털 데이터에 구글 뉴스 데이터가 있으면 합침
            const match = googleTrends.find(g => g.originalTitle.toLowerCase().includes(t.originalTitle.toLowerCase()) || t.originalTitle.toLowerCase().includes(g.originalTitle.toLowerCase()));
            if (match && t.source !== 'Google') {
              t.newsLinks = [...t.newsLinks, ...(match.newsLinks || [])];
              t.sources = [...new Set([...(t.sources || []), ...(match.sources || [])])];
              t.snippets = [...new Set([...(t.snippets || []), ...(match.snippets || [])])];
              if (t.growth === 'Portal') t.growth = match.growth;
            }
            unique.push(t); 
          }
          if (unique.length >= 10) break;
        }

        if (unique.length > 0) {
          console.log(`Translating ${unique.length} items for ${code}...`);
          
          // 모든 언어에 대해 일괄 번역 수행
          for (const lang of targetLangs) {
            // 1. 제목 번역 모으기
            const titlesToTranslate = unique.map(item => item.originalTitle);
            const translatedTitles = await this.translateBatch(titlesToTranslate, lang);
            
            // 2. 스니펫 번역 모으기 (각 아이템의 첫 번째 스니펫만 번역하여 속도 최적화)
            const snippetsToTranslate = unique.map(item => (item.snippets && item.snippets.length > 0) ? item.snippets[0] : "");
            const translatedSnippets = await this.translateBatch(snippetsToTranslate, lang);

            // 결과 할당
            unique.forEach((item, idx) => {
              if (!item.translations) item.translations = {};
              if (!item.translatedSnippets) item.translatedSnippets = {};
              
              item.translations[lang] = translatedTitles[idx] || item.originalTitle;
              item.translatedSnippets[lang] = translatedSnippets[idx] ? [translatedSnippets[idx]] : [];
            });
            
            await new Promise(r => setTimeout(r, 300)); // API 부하 방지
          }

          const docRef = db.collection('trends').doc(code);
          const oldDoc = await docRef.get();
          const oldData = oldDoc.exists ? oldDoc.data() : null;
          
          await docRef.set({
            items: unique,
            previousItems: oldData?.items || [],
            lastUpdated: admin.firestore.Timestamp.now(),
            status: 'healthy'
          });
          console.log(`${code} update success.`);
        }
      }
      
      await db.collection('system').doc('status').set({
        lastGlobalUpdate: admin.firestore.Timestamp.now(),
        countries: countries
      });

      console.log("All updates completed successfully.");
      process.exit(0);
    } catch (e) {
      console.error("FATAL ERROR during update process:", e);
      process.exit(1);
    }
  }
}

new TrendUpdater().updateAll();
