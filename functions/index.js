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

  async generateRealAIReport(keyword, lang, newsTitles, snippets) {
    if (!this.genAI) return this.getFallbackReport(keyword, lang, newsTitles);
    try {
      const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = `Analyze the trend "${keyword}" based on these headlines: ${newsTitles.join(", ")}. 
      Write a concise, natural 3-sentence summary in ${lang === "ko" ? "pure Korean (no English mixed)" : lang === "ja" ? "Japanese" : "English"}. 
      Explain why it is trending and the current context. Do not use markdown bolding.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      let analysis = response.text().trim();
      if (!analysis || analysis.length < 10) throw new Error("Empty response");
      return analysis;
    } catch (e) {
      console.error("Gemini Error:", e.message);
      return this.getFallbackReport(keyword, lang, newsTitles);
    }
  }

  getFallbackReport(keyword, lang, newsTitles) {
    const titles = newsTitles.slice(0, 2).join(", ");
    if (lang === "ko") {
      return `현재 "${keyword}" 키워드가 한국에서 활발히 논의되고 있습니다. 관련 소식으로는 ${titles || "다양한 실시간 이슈"} 등이 있으며, 사회적 관심도가 매우 높은 상태입니다.`;
    } else if (lang === "ja") {
      return `現在、「${keyword}」が日本で大きな注目を集めています。主なニュースには${titles || "様々な社会情勢"}などがあり、関心が高まっています。`;
    } else {
      return `"${keyword}" is currently a major trend. Key highlights include ${titles || "various updates"}, drawing significant public interest.`;
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
            item.aiReports[lang] = await this.generateRealAIReport(item.originalTitle, lang, trans.news, trans.snippets);
            await new Promise(res => setTimeout(res, 4000));
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
