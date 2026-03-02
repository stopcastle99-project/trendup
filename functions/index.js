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

  async generateRealAIReport(item, lang, newsTitles, snippets, country) {
    if (!this.genAI) return this.getFallbackReport(item.originalTitle, lang, newsTitles, country);
    
    const title = item.translations?.[lang] || item.originalTitle;
    const countryNames = { 'KR': '대한민국', 'JP': '일본', 'US': '미국' };
    const countryName = countryNames[country] || country;

    const prompt = `
      You are a professional trend analyst. Analyze the trending keyword '${title}' in ${countryName}.
      
      Reference Materials:
      - Related News: ${newsTitles.join(' / ')}
      - Context Snippets: ${snippets.join(' ')}

      Task: Write a insightful 2-3 sentence report in ${lang === 'ko' ? 'Korean' : (lang === 'ja' ? 'Japanese' : 'English')}.
      1. Explain why this is trending specifically in ${countryName}.
      2. Synthesize the news to provide context. Do not just list titles.
      3. Describe public reaction or social significance.
      4. Maintain a professional, natural tone. No markdown bolding.

      Write ONLY the final analysis. No headers, no intro.
    `;

    // Try models that are proven to work with this key
    const modelsToTry = ["gemini-flash-latest", "gemini-pro-latest", "gemini-2.0-flash-exp"];
    
    for (const modelName of modelsToTry) {
      try {
        const model = this.genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const analysis = response.text().trim().replace(/\*\*/g, '');
        if (analysis && analysis.length > 10) return analysis;
      } catch (e) {
        console.warn(`Attempt with ${modelName} failed:`, e.message);
      }
    }

    return this.getFallbackReport(title, lang, newsTitles, country);
  }

  getFallbackReport(title, lang, newsTitles, country) {
    const countryNames = { 'KR': '대한민국', 'JP': '일본', 'US': '미국' };
    const countryName = countryNames[country] || country;
    if (lang === 'ko') {
      return `${countryName} 내에서 '${title}' 키워드가 관련 보도를 통해 큰 주목을 받고 있습니다. 실시간 검색 및 소셜 미디어를 통해 대중의 높은 관심이 확인됩니다.`;
    } else if (lang === 'ja') {
      return `${countryName}内で'${title}'がニュースやSNSを通じて大きな注目を集めています.`;
    } else {
      return `'${title}' is drawing significant attention in ${countryName} through various news reports and social discussions.`;
    }
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
            newsLinks.push({ title: nt, source: "News", url: nu });
            if (nsn) snippets.push(nsn.replace(/<[^>]*>?/gm, "").trim());
          }
        }
        return { title, originalTitle: title, growth: traffic, snippets, newsLinks, source: "Google" };
      });
    } catch (e) { return []; }
  }

  async getPortalTrends(code) {
    const url = code === "KR" ? "https://signal.bz/" : "https://search.yahoo.co.jp/realtime/term";
    try {
      const res = await fetch(url);
      const html = await res.text();
      const dom = new JSDOM(html);
      const items = code === "KR" ? dom.window.document.querySelectorAll(".rank-item .text") : dom.window.document.querySelectorAll(".Trend_Trend__item__name");
      return Array.from(items).slice(0, 10).map(el => ({ title: el.textContent.trim(), originalTitle: el.textContent.trim(), growth: "Portal", source: code === "KR" ? "Signal" : "Yahoo", newsLinks: [], snippets: [] }));
    } catch (e) { return []; }
  }

  async updateAll() {
    const countries = ["KR", "JP", "US"];
    const langs = ["ko", "ja", "en"];
    for (const code of countries) {
      console.log(`Updating ${code}...`);
      let combined = code === "US" ? await this.getGoogleTrends(code) : [...await this.getPortalTrends(code), ...await this.getGoogleTrends(code)];
      const seen = new Set();
      const unique = [];
      for (const t of combined) {
        const norm = t.originalTitle.toLowerCase().replace(/\s/g, "");
        if (!seen.has(norm)) { seen.add(norm); unique.push(t); }
        if (unique.length >= 10) break;
      }
      if (unique.length > 0) {
        for (let item of unique) {
          const localNews = await this.getSupplementaryNews(item.originalTitle, code);
          if (localNews && localNews.length > 0) item.newsLinks = localNews;
          item.videoLinks = await this.getYouTubeVideos(item.originalTitle, code);
        }
        
        for (const lang of langs) {
          console.log(`  Language: ${lang}`);
          let allTexts = [];
          const mapping = [];
          unique.forEach((item, itemIdx) => {
            allTexts.push(item.originalTitle);
            mapping.push({ type: "title", itemIdx });
            const nts = item.newsLinks?.map(n => n.title).slice(0, 3) || [];
            nts.forEach(nt => { allTexts.push(nt); mapping.push({ type: "news", itemIdx }); });
            const snips = item.snippets?.slice(0, 2) || [];
            snips.forEach(snip => { allTexts.push(snip); mapping.push({ type: "snippet", itemIdx }); });
          });
          const translatedAll = await this.translateBatch(allTexts, lang);
          const tempTranslations = unique.map(() => ({ title: "", news: [], snippets: [] }));
          translatedAll.forEach((txt, idx) => {
            const m = mapping[idx];
            if (m.type === "title") tempTranslations[m.itemIdx].title = txt;
            else if (m.type === "news") tempTranslations[m.itemIdx].news.push(txt);
            else if (m.type === "snippet") tempTranslations[m.itemIdx].snippets.push(txt);
          });

          for (let i = 0; i < unique.length; i++) {
            const item = unique[i];
            const trans = tempTranslations[i];
            if (!item.translations) item.translations = {};
            if (!item.aiReports) item.aiReports = {};
            item.translations[lang] = trans.title || item.originalTitle;
            item.aiReports[lang] = await this.generateRealAIReport(item, lang, trans.news, trans.snippets, code);
            await new Promise(res => setTimeout(res, 2000));
          }
        }
        const docRef = db.collection("trends").doc(code);
        const oldDoc = await docRef.get();
        await docRef.set({ items: unique, previousItems: oldDoc.exists ? oldDoc.data().items || [] : [], lastUpdated: admin.firestore.Timestamp.now() });
      }
    }
  }
}

export const scheduledTrendUpdate = onSchedule({
  schedule: "every 10 minutes",
  secrets: ["GEMINI_API_KEY"],
  timeoutSeconds: 540
}, async (event) => {
  const updater = new TrendUpdater();
  await updater.updateAll();
  console.log("Trend update cycle completed successfully.");
});
