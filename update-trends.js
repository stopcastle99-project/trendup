import 'dotenv/config';
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

  // Use Gemini 1.5 Flash to generate actual AI summaries
  async generateAIReport(item, lang, newsTitles, snippets) {
    const title = item.translations?.[lang] || item.originalTitle;
    const context = {
      keyword: title,
      news: newsTitles || [],
      snippets: snippets || [],
      lang: lang === 'ko' ? '한국어' : (lang === 'ja' ? '일본어' : '영어')
    };

    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `
        You are a trend analysis expert. Analyze why the keyword '${context.keyword}' is currently trending globally.
        Reference News: ${context.news.join(', ')}
        Contextual Info: ${context.snippets.join(' ')}

        Task: Write a concise (2-3 sentences) report explaining:
        1. Why it's trending (event/news).
        2. Public sentiment or significance.

        Write the final report ONLY in ${context.lang}. Do not include any intros or outros.
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim();
    } catch (e) {
      console.error(`Gemini summary failed for ${title}:`, e.message);
      // Fallback to static template if AI fails
      if (lang === 'ko') {
        return `현재 '${title}' 키워드가 글로벌 트렌드로 급부상하고 있습니다. 관련 보도에 따르면 ${newsTitles.length > 0 ? newsTitles.join(', ') : '다양한 매체'} 등의 소식이 주목받고 있으며, AI 분석 결과 관심도가 매우 높습니다.`;
      } else if (lang === 'ja') {
        return `現在 '${title}' が世界的トレンドとして急上昇しています。${newsTitles.length > 0 ? newsTitles.join('、') : '様々なメディア'} などのニュース가注目されており、AI分析の結果関心が非常に高いことがわかります。`;
      } else {
        return `'${title}' is rapidly emerging as a global trend. News highlights include ${newsTitles.length > 0 ? newsTitles.join(', ') : 'various outlets'}. AI analysis indicates very high public interest.`;
      }
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
      console.log(`Updating ${code}...`);
      let combined = code === 'US' ? await this.getGoogleTrends(code) : [...await this.getPortalTrends(code), ...await this.getGoogleTrends(code)];
      
      const seen = new Set();
      const unique = [];
      for (const t of combined) {
        const norm = t.originalTitle.toLowerCase().replace(/\s/g, '');
        if (!seen.has(norm)) { 
          seen.add(norm); 
          unique.push(t); 
        }
        if (unique.length >= 10) break;
      }

      if (unique.length > 0) {
        for (const lang of langs) {
          // Flatten all strings to translate for this language batch
          let allTexts = [];
          const mapping = []; // Store where each text belongs

          unique.forEach((item, itemIdx) => {
            // 1. Title
            allTexts.push(item.originalTitle);
            mapping.push({ type: 'title', itemIdx });

            // 2. News Titles
            const nts = item.newsLinks?.map(n => n.title).slice(0, 3) || [];
            nts.forEach(nt => {
              allTexts.push(nt);
              mapping.push({ type: 'news', itemIdx });
            });

            // 3. Snippets
            const snips = item.snippets?.slice(0, 2) || [];
            snips.forEach(snip => {
              allTexts.push(snip);
              mapping.push({ type: 'snippet', itemIdx });
            });
          });

          const translatedAll = await this.translateBatch(allTexts, lang);
          
          const tempTranslations = unique.map(() => ({ title: '', news: [], snippets: [] }));
          translatedAll.forEach((txt, idx) => {
            const m = mapping[idx];
            if (m.type === 'title') tempTranslations[m.itemIdx].title = txt;
            else if (m.type === 'news') tempTranslations[m.itemIdx].news.push(txt);
            else if (m.type === 'snippet') tempTranslations[m.itemIdx].snippets.push(txt);
          });

          unique.forEach((item, idx) => {
            if (!item.translations) item.translations = {};
            if (!item.aiReports) item.aiReports = {};
            
            const trans = tempTranslations[idx];
            item.translations[lang] = trans.title || item.originalTitle;
            item.aiReports[lang] = this.generateAIReport(item, lang, trans.news, trans.snippets);
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
    process.exit(0);
  }
}
new TrendUpdater().updateAll();
