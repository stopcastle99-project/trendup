import admin from 'firebase-admin';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

const rawSecret = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!rawSecret) process.exit(1);
const serviceAccount = JSON.parse(rawSecret.trim());

try {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} catch (e) { process.exit(1); }

const db = admin.firestore();

class TrendUpdater {
  // 번역 및 요약 로직
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
      const data = await res.json();
      const results = data[0].map(x => x[0]).join("").split(/\|\|\||\| \| \|/).map(s => s.trim());
      return results.length === texts.length ? results : await Promise.all(texts.map(t => translateSingle(t, targetLang)));
    } catch (e) { return await Promise.all(texts.map(t => translateSingle(t, targetLang))); }
  }

  // AI 스타일의 종합 리포트 생성 (가져온 뉴스 기반)
  generateAIReport(item, lang) {
    const newsTitles = item.newsLinks?.map(n => n.title).slice(0, 3) || [];
    const snippets = item.snippets?.slice(0, 2) || [];
    
    if (lang === 'ko') {
      return `현재 '${item.originalTitle}'(이)가 주요 이슈로 떠오르고 있습니다. 관련 보도에 따르면 ${newsTitles.join(', ')} 등의 소식이 화제가 되고 있으며, ${snippets.join(' ')} 등의 맥락이 관찰됩니다. 종합적으로 대중의 관심이 매우 높은 상태입니다.`;
    } else if (lang === 'ja') {
      return `'${item.originalTitle}'이 현재 큰 관심을 받고 있습니다. ${newsTitles.join(', ')} 등의 소식이 전해지고 있으며, ${snippets.join(' ')} 와 같은 배경이 있습니다.`;
    } else {
      return `'${item.originalTitle}' is currently a major trend. News reports highlight ${newsTitles.join(', ')}. The context includes ${snippets.join(' ')}.`;
    }
  }

  async getGoogleTrends(country) {
    try {
      const res = await fetch(`https://trends.google.com/trending/rss?geo=${country}`);
      const text = await res.text();
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
          const nsn = n.getElementsByTagName("ht:news_item_snippet")[0]?.textContent;
          if (nt && nu) {
            newsLinks.push({ title: nt, source: 'News', url: nu });
            if (nsn) snippets.push(nsn.replace(/<[^>]*>?/gm, '').trim());
          }
        }
        return { title, originalTitle: title, growth: traffic, snippets, newsLinks, source: 'Google' };
      });
    } catch (e) { return []; }
  }

  async getPortalTrends(code) {
    const url = code === 'KR' ? 'https://signal.bz/' : 'https://search.yahoo.co.jp/realtime/term';
    try {
      const res = await fetch(url);
      const html = await res.text();
      const dom = new JSDOM(html);
      const items = code === 'KR' ? dom.window.document.querySelectorAll('.rank-item .text') : dom.window.document.querySelectorAll('.Trend_Trend__item__name');
      return Array.from(items).slice(0, 10).map(el => ({ title: el.textContent.trim(), originalTitle: el.textContent.trim(), growth: 'Portal', source: code === 'KR' ? 'Signal' : 'Yahoo', newsLinks: [], snippets: [] }));
    } catch (e) { return []; }
  }

  async updateAll() {
    const countries = ['KR', 'JP', 'US'];
    const langs = ['ko', 'ja', 'en'];
    for (const code of countries) {
      console.log(`Processing ${code}...`);
      let combined = code === 'US' ? await this.getGoogleTrends(code) : [...await this.getPortalTrends(code), ...await this.getGoogleTrends(code)];
      
      const seen = new Set();
      const unique = [];
      for (const t of combined) {
        const norm = t.originalTitle.toLowerCase().replace(/\s/g, '');
        if (!seen.has(norm)) { 
          seen.add(norm); 
          // 구글 트렌드 데이터에서 정보 보강
          if (t.source !== 'Google') {
            const match = combined.find(g => g.source === 'Google' && (g.originalTitle.includes(t.originalTitle) || t.originalTitle.includes(g.originalTitle)));
            if (match) { t.newsLinks = match.newsLinks; t.snippets = match.snippets; t.growth = match.growth; }
          }
          unique.push(t); 
        }
        if (unique.length >= 10) break;
      }

      if (unique.length > 0) {
        for (const lang of langs) {
          console.log(`Translating ${code} to ${lang}...`);
          const titles = unique.map(item => item.originalTitle);
          const translated = await this.translateBatch(titles, lang);
          
          unique.forEach((item, idx) => {
            if (!item.translations) item.translations = {};
            if (!item.aiReports) item.aiReports = {};
            
            item.translations[lang] = translated[idx] || item.originalTitle;
            // AI 분석 리포트 생성 (가져온 뉴스 및 스니펫 기반)
            item.aiReports[lang] = this.generateAIReport(item, lang);
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
    console.log("Global Sync & AI Report Generation Completed.");
    process.exit(0);
  }
}
new TrendUpdater().updateAll();
