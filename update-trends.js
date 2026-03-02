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
  async generateAIReport(item, lang, newsTitles, snippets, country) {
    const title = item.translations?.[lang] || item.originalTitle;
    const countryNames = { 'KR': '대한민국', 'JP': '일본', 'US': '미국' };
    const countryName = countryNames[country] || country;

    const context = {
      keyword: title,
      news: newsTitles || [],
      snippets: snippets || [],
      lang: lang === 'ko' ? '한국어' : (lang === 'ja' ? '일본어' : '영어'),
      targetCountry: countryName
    };

    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `
        You are a professional trend analyst. Analyze the trending keyword '${context.keyword}' in ${context.targetCountry}.
        
        Reference Materials:
        - Related News: ${context.news.join(' / ')}
        - Context Snippets: ${context.snippets.join(' ')}

        Task: Write a insightful 2-3 sentence report in ${context.lang}.
        1. Explain the specific event or reason causing this trend in ${context.targetCountry}.
        2. Do NOT just list the news titles. Synthesize the information to provide insight.
        3. Describe the public's reaction or the social significance.
        4. Maintain a professional yet accessible tone.

        Write ONLY the final analysis in ${context.lang}. No headers, no intro.
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim().replace(/\*\*/g, '');
    } catch (e) {
      console.error(`Gemini summary failed for ${title} (${country}):`, e.message);
      // Fallback
      if (lang === 'ko') {
        return `${countryName} 내에서 '${title}' 키워드가 관련 보도를 통해 큰 주목을 받고 있습니다. 상세 분석이 지연되고 있으나, 실시간 검색 및 소셜 미디어를 통해 대중의 높은 관심이 확인됩니다.`;
      } else if (lang === 'ja') {
        return `${countryName}内で'${title}'がニュースやSNSを通じて大きな注目を集めています。現在、詳細なAI分析を生成中です。`;
      } else {
        return `'${title}' is drawing significant attention in ${countryName} through various news reports. Detailed AI analysis is being processed.`;
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
