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
        const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`, {
          headers: { "User-Agent": "Mozilla/5.0" }
        });
        const data = await res.json();
        return data[0].map(x => x[0]).join("").trim();
      } catch (e) { return text; }
    };
    try {
      const separator = " ||| ";
      const combinedText = texts.join(separator);
      const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(combinedText)}`, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      const data = await res.json();
      const combinedResult = data[0].map(x => x[0]).join("");
      const results = combinedResult.split(/\s*\|[ |]*\|[ |]*\|\s*/).map(s => s.trim());
      return results.length === texts.length ? results : await Promise.all(texts.map(t => translateSingle(t, targetLang)));
    } catch (e) { return await Promise.all(texts.map(t => translateSingle(t, targetLang))); }
  }

  async translateWithGemini(titles, targetLang) {
    if (!this.genAI || !titles || titles.length === 0) return [];
    const langNames = { 'ko': 'Korean', 'ja': 'Japanese', 'en': 'English' };
    const targetLangName = langNames[targetLang] || 'English';
    const prompt = `Translate the following trending keywords into natural ${targetLangName}. Separated by " ||| ". No explanations.\n${titles.join('\n')}`;
    try {
      const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim().split(/\s*\|[ |]*\|[ |]*\|\s*/).map(s => s.trim());
    } catch (e) { return []; }
  }

  async generateBaseAIReport(item, newsTitles, snippets, country) {
    if (!this.genAI) return "";
    const countryName = { 'KR': '대한민국', 'JP': '일본', 'US': '미국' }[country] || country;
    const context = [...newsTitles, ...snippets].join(' / ').slice(0, 1500);
    const prompt = `대상 키워드: '${item.originalTitle}' (${countryName})\n참고 정보: ${context}\n\n위 정보를 분석하여 이 키워드가 왜 지금 트렌드인지 한국어로 2문장 요약해줘. 마크다운(**) 금지.`;
    
    // Most standard and reliable model list
    const modelNames = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"];
    
    for (const name of modelNames) {
      try {
        const model = this.genAI.getGenerativeModel({ model: name });
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim().replace(/\*\*/g, '');
        if (text && text.length > 10) {
          console.log(`  - Gemini Success: ${name} for ${item.originalTitle}`);
          return text;
        }
      } catch (e) {
        console.warn(`  - Gemini Attempt [${name}] failed:`, e.message.substring(0, 80));
      }
    }
    return "";
  }

  async getSupplementaryNews(keyword, countryCode) {
    const hl = countryCode === "KR" ? "ko" : countryCode === "JP" ? "ja" : "en";
    const gl = countryCode;
    const query = `${keyword}${ { 'KR': ' 뉴스', 'JP': ' ニュース', 'US': ' News' }[countryCode] || ' News'}`;
    try {
      const res = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${hl}&gl=${gl}&ceid=${gl}:${hl}`);
      const text = await res.text();
      const dom = new JSDOM(text, { contentType: "text/xml" });
      return Array.from(dom.window.document.querySelectorAll("item")).slice(0, 3).map(item => {
        const title = item.querySelector("title")?.textContent || "";
        return { title: title.split(" - ")[0], url: item.querySelector("link")?.textContent || "", source: title.split(" - ").pop() || "News" };
      });
    } catch (e) { return []; }
  }

  async getYouTubeVideos(keyword, countryCode) {
    const hl = countryCode === "KR" ? "ko" : countryCode === "JP" ? "ja" : "en";
    const gl = countryCode;
    const query = keyword + (countryCode === "KR" ? " 한국 뉴스" : (countryCode === "JP" ? " 日本 ニュース" : " News"));
    try {
      const res = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&gl=${gl}&hl=${hl}`);
      const html = await res.text();
      const regex = /"videoRenderer":\{"videoId":"([^"]+)","thumbnail":\{.*?"title":\{"runs":\[\{"text":"([^"]+)"\}\]/g;
      const videos = [];
      let m;
      while ((m = regex.exec(html)) !== null && videos.length < 2) {
        videos.push({ title: m[2], url: `https://www.youtube.com/watch?v=${m[1]}`, source: "YouTube" });
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

      // 1. Simple Fetch (Reverting complex filtering)
      let itemsPortal = [];
      let url = code === "KR" ? "https://signal.bz/" : (code === "JP" ? "https://search.yahoo.co.jp/realtime/term" : "");
      if (url) {
        try {
          const resP = await fetch(url).then(r => r.text());
          const domP = new JSDOM(resP);
          itemsPortal = Array.from(domP.window.document.querySelectorAll(".rank-item .text, .rank-text, .Trend_Trend__item__name")).map(el => el.textContent.trim()).filter(t => t);
        } catch (e) {}
      }
      
      const rssGT = await fetch(`https://trends.google.com/trending/rss?geo=${code}`).then(r => r.text()).catch(() => "");
      const domGT = new JSDOM(rssGT, { contentType: "text/xml" });
      const itemsGT = Array.from(domGT.window.document.querySelectorAll("item")).map(item => {
        const title = item.querySelector("title")?.textContent || "";
        const getNodes = (tag) => Array.from(item.childNodes).filter(n => n.localName === tag);
        return { title, snippets: getNodes("news_item_snippet").map(s => s.textContent.replace(/<[^>]*>?/gm, "").trim()), news: getNodes("news_item_title").map(t => t.textContent) };
      });

      const unique = [];
      const seen = new Set();
      const combined = [...itemsPortal, ...itemsGT.map(i => i.title)];

      for (let title of combined) {
        const lower = title.toLowerCase();
        if (!seen.has(lower)) {
          seen.add(lower);
          const gt = itemsGT.find(i => i.title === title) || { snippets: [], news: [] };
          unique.push({ originalTitle: title, snippets: gt.snippets, newsTitles: gt.news, translations: {}, aiReports: {} });
        }
        if (unique.length >= 10) break;
      }

      // 2. Parallel Processing (Keep this for speed)
      await Promise.all(unique.map(async (item) => {
        [item.newsLinks, item.videoLinks] = await Promise.all([this.getSupplementaryNews(item.originalTitle, code), this.getYouTubeVideos(item.originalTitle, code)]);
        item.aiReports.ko = await this.generateBaseAIReport(item, item.newsLinks.map(l => l.title), item.snippets, code);
      }));

      // 3. Simple Translation
      for (let lang of langs) {
        const toTTitle = unique.filter(i => !i.translations[lang]).map(i => i.originalTitle);
        if (toTTitle.length > 0) {
          const transT = await this.translateBatch(toTTitle, lang);
          unique.filter(i => !i.translations[lang]).forEach((item, idx) => { item.translations[lang] = transT[idx] || item.originalTitle; });
        }
        const toTRep = unique.filter(i => i.aiReports.ko && !i.aiReports[lang]).map(i => i.aiReports.ko);
        if (toTRep.length > 0) {
          const transR = await this.translateBatch(toTRep, lang);
          unique.filter(i => i.aiReports.ko && !i.aiReports[lang]).forEach((item, idx) => { item.aiReports[lang] = transR[idx] || ""; });
        }
      }

      await docRef.set({ items: unique, previousItems: previousItems, lastUpdated: admin.firestore.Timestamp.now() });
    }
  }
}

export const scheduledTrendUpdate = onSchedule({
  schedule: "every 10 minutes", 
  secrets: ["GEMINI_API_KEY"],
  timeoutSeconds: 540
}, async (event) => {
  await new TrendUpdater().updateAll();
});
