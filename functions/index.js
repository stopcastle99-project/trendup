import { onSchedule } from "firebase-functions/v2/scheduler";
import admin from "firebase-admin";
import { JSDOM } from "jsdom";
import { GoogleGenerativeAI } from "@google/generative-ai";

admin.initializeApp();
const db = admin.firestore();

class TrendUpdater {
  constructor() {
    this.genAI = null;
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
  }

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

  // Generate a single report in Korean (Base Language)
  async generateBaseAIReport(item, newsTitles, snippets, country) {
    if (!this.genAI) return "";
    
    const countryNames = { 'KR': '대한민국', 'JP': '일본', 'US': '미국' };
    const countryName = countryNames[country] || country;
    const title = item.originalTitle;

    const prompt = `
      You are a professional trend analyst. Analyze why '${title}' is trending in ${countryName}.
      Ref News: ${newsTitles.join(' / ')}
      Context: ${snippets.join(' ')}
      Task: Write a insightful 2-sentence summary in Korean (한국어). 
      Synthesize information, explain the cause and public reaction. No bolding.
    `;

    const modelsToTry = ["gemini-flash-latest", "gemini-pro-latest", "gemini-2.0-flash-exp"];
    for (const modelName of modelsToTry) {
      try {
        const model = this.genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().trim().replace(/\*\*/g, '');
        if (text && text.length > 20) return text; // Ensure it's a real analysis, not a short failure response
      } catch (e) { console.warn(`AI Attempt ${modelName} failed:`, e.message); }
    }
    return "";
  }

  getFallbackReport(title, lang, country) {
    const mapping = {
      'ko': { 'KR': '대한민국', 'JP': '일본', 'US': '미국' },
      'ja': { 'KR': '韓国', 'JP': '日本', 'US': 'アメリカ' },
      'en': { 'KR': 'South Korea', 'JP': 'Japan', 'US': 'USA' }
    };
    const countryName = mapping[lang]?.[country] || mapping['en'][country] || country;

    if (lang === 'ko') return `${countryName}에서 '${title}' 키워드가 관련 보도를 통해 주목받고 있습니다.`;
    if (lang === 'ja') return `${countryName}国内で'${title}'가注目を集めています。`; 
    return `'${title}' is drawing attention in ${countryName} through various news reports.`;
  }

  // Check if the current report is just a fallback template
  isFallback(report) {
    if (!report) return true;
    const fallbacks = ["주목받고 있습니다", "注目を集めています", "drawing attention", "지연되고 있으나", "生成中です"];
    return fallbacks.some(f => report.includes(f)) || report.length < 30;
  }

  async getSupplementaryNews(keyword, countryCode) {
    const hl = countryCode === "KR" ? "ko" : countryCode === "JP" ? "ja" : "en";
    const gl = countryCode;
    let query = keyword;
    if (countryCode === "KR") query += " 한국 뉴스";
    else if (countryCode === "JP") query += " 日本 ニュース";
    else query += " News";
    try {
      const res = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${hl}&gl=${gl}&ceid=${gl}:${hl}`);
      const text = await res.text();
      const dom = new JSDOM(text, { contentType: "text/xml" });
      const items = dom.window.document.querySelectorAll("item");
      return Array.from(items).slice(0, 3).map(item => ({
        title: item.querySelector("title")?.textContent || "",
        url: item.querySelector("link")?.textContent || "",
        source: "Local News"
      }));
    } catch (e) { return []; }
  }

  async getYouTubeVideos(keyword, countryCode) {
    const hl = countryCode === "KR" ? "ko" : countryCode === "JP" ? "ja" : "en";
    const gl = countryCode;
    let query = keyword;
    if (countryCode === "KR") query += " 한국 뉴스";
    else if (countryCode === "JP") query += " 日本 ニュース";
    else query += " News";
    try {
      const res = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&gl=${gl}&hl=${hl}`);
      const html = await res.text();
      const regex = /"videoRenderer":\{"videoId":"([^"]+)","thumbnail":\{.*?"title":\{"runs":\[\{"text":"([^"]+)"\}\]/g;
      const videos = [];
      let match;
      while ((match = regex.exec(html)) !== null && videos.length < 2) {
        videos.push({ title: match[2], url: `https://www.youtube.com/watch?v=${match[1]}`, source: "Local YouTube" });
      }
      return videos;
    } catch (e) { return []; }
  }

  async updateAll() {
    const countries = ["KR", "JP", "US"];
    const langs = ["ko", "ja", "en"];
    
    for (const code of countries) {
      console.log(`Updating ${code}...`);
      const docRef = db.collection("trends").doc(code);
      const oldDoc = await docRef.get();
      const previousItems = oldDoc.exists ? oldDoc.data().items || [] : [];
      const prevReportMap = new Map(previousItems.map(i => [i.originalTitle, i.aiReports || {}]));

      // 1. Fetch Trends
      let url = code === "KR" ? "https://signal.bz/" : "https://search.yahoo.co.jp/realtime/term";
      const resPortal = await fetch(url).then(r => r.text()).catch(() => "");
      const domPortal = new JSDOM(resPortal);
      const itemsPortal = code === "KR" ? Array.from(domPortal.window.document.querySelectorAll(".rank-item .text")).slice(0,10).map(el => el.textContent.trim()) : Array.from(domPortal.window.document.querySelectorAll(".Trend_Trend__item__name")).slice(0,10).map(el => el.textContent.trim());
      
      const rssGT = await fetch(`https://trends.google.com/trending/rss?geo=${code}`).then(r => r.text()).catch(() => "");
      const domGT = new JSDOM(rssGT, { contentType: "text/xml" });
      const itemsGT = Array.from(domGT.window.document.querySelectorAll("item")).map(item => {
        const title = item.querySelector("title")?.textContent || "";
        const snippets = Array.from(item.getElementsByTagName("ht:news_item_snippet")).map(s => s.textContent.replace(/<[^>]*>?/gm, "").trim());
        const news = Array.from(item.getElementsByTagName("ht:news_item_title")).map(t => t.textContent);
        return { title, snippets, news };
      });

      const unique = [];
      const seen = new Set();
      const rawTitles = [...itemsPortal, ...itemsGT.map(i => i.title)];
      for (let title of rawTitles) {
        if (!seen.has(title.toLowerCase())) {
          seen.add(title.toLowerCase());
          const gtData = itemsGT.find(i => i.title === title) || { snippets: [], news: [] };
          unique.push({ originalTitle: title, snippets: gtData.snippets, newsTitles: gtData.news, translations: {}, aiReports: {} });
        }
        if (unique.length >= 10) break;
      }

      // 2. Reuse or Generate/Refine AI Report
      for (let item of unique) {
        const existingReports = prevReportMap.get(item.originalTitle);
        // SMART CHECK: Only reuse if it's NOT a fallback message
        if (existingReports && existingReports.ko && !this.isFallback(existingReports.ko)) {
          item.aiReports = existingReports;
        } else {
          // Generate NEW or Replace Fallback
          console.log(`  - Generating/Refining report for: ${item.originalTitle}`);
          const baseReport = await this.generateBaseAIReport(item, item.newsTitles, item.snippets, code);
          if (baseReport) {
            item.aiReports.ko = baseReport;
            await new Promise(r => setTimeout(r, 3000)); // Safer delay for RPM
          }
        }
      }

      // 3. Batch Translate missing items
      for (let lang of langs) {
        const toTranslateTitles = unique.filter(i => !i.translations[lang]).map(i => i.originalTitle);
        if (toTranslateTitles.length > 0) {
          const translatedTitles = await this.translateBatch(toTranslateTitles, lang);
          unique.filter(i => !i.translations[lang]).forEach((item, idx) => { item.translations[lang] = translatedTitles[idx] || item.originalTitle; });
        }

        const toTranslateReports = unique.filter(i => i.aiReports.ko && (!i.aiReports[lang] || this.isFallback(i.aiReports[lang]))).map(i => i.aiReports.ko);
        if (toTranslateReports.length > 0) {
          const translatedReports = await this.translateBatch(toTranslateReports, lang);
          unique.filter(i => i.aiReports.ko && (!i.aiReports[lang] || this.isFallback(i.aiReports[lang]))).forEach((item, idx) => { 
            item.aiReports[lang] = translatedReports[idx] || this.getFallbackReport(item.originalTitle, lang, code); 
          });
        } else {
          // Final sanity fill
          unique.forEach(item => { if(!item.aiReports[lang]) item.aiReports[lang] = this.getFallbackReport(item.originalTitle, lang, code); });
        }
      }

      // 4. Final Meta (News/Videos)
      for (let item of unique) {
        item.newsLinks = await this.getSupplementaryNews(item.originalTitle, code);
        item.videoLinks = await this.getYouTubeVideos(item.originalTitle, code);
      }

      await docRef.set({ items: unique, previousItems: previousItems, lastUpdated: admin.firestore.Timestamp.now() });
    }
  }
}

export const scheduledTrendUpdate = onSchedule({
  schedule: "every 30 minutes", 
  secrets: ["GEMINI_API_KEY"],
  timeoutSeconds: 540
}, async (event) => {
  const updater = new TrendUpdater();
  await updater.updateAll();
  console.log("Smart refined trend update cycle completed.");
});
