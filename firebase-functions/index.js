
import { onSchedule } from "firebase-functions/v2/scheduler";
import admin from "firebase-admin";
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

  async generateBaseAIReport(item, newsTitles, snippets, country, previousItems = []) {
    if (!this.genAI) return "";

    // Check if report already exists for this title in previous items
    const existing = previousItems.find(p => p.originalTitle === item.originalTitle);
    if (existing && existing.aiReports && existing.aiReports.ko) {
      console.log(`  - Reusing existing AI report for: ${item.originalTitle}`);
      return existing.aiReports.ko;
    }

    const countryName = { 'KR': '대한민국', 'JP': '일본', 'US': '미국' }[country] || country;
    const context = [...newsTitles, ...snippets].join(' / ').slice(0, 1500);
    const prompt = `대상 키워드: '${item.originalTitle}' (${countryName})\n참고 정보: ${context}\n\n위 정보를 분석하여 이 키워드가 왜 지금 트렌드인지 한국어로 2문장 요약해줘. 마크다운(**) 금지.`;

    try {
      const model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim().replace(/\*\*/g, '');
      if (text && text.length > 10) {
        console.log(`  - Gemini Success: gemini-2.5-flash for ${item.originalTitle}`);
        return text;
      }
    } catch (e) {
      console.warn(`  - Gemini failed:`, e.message.substring(0, 80));
    }
    return "";
  }

  async getSupplementaryNews(keyword, countryCode) {
    const hl = countryCode === "KR" ? "ko" : countryCode === "JP" ? "ja" : "en";
    const gl = countryCode;
    const query = `${keyword}${ { 'KR': ' 뉴스', 'JP': ' ニュース', 'US': ' News' }[countryCode] || ' News'}`;
    try {
      const res = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${hl}&gl=${gl}&ceid=${gl}:${hl}`, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      const text = await res.text();
      const items = [];
      const itemRegex = /<item>(.*?)<\/item>/gs;
      let m;
      while ((m = itemRegex.exec(text)) !== null && items.length < 3) {
        const content = m[1];
        const title = (content.match(/<title>(.*?)<\/title>/)?.[1] || "").replace("<![CDATA[", "").replace("]]>", "").trim();
        const link = (content.match(/<link>(.*?)<\/link>/)?.[1] || "").trim();
        items.push({ 
          title: title.split(" - ")[0], 
          url: link, 
          source: title.split(" - ").pop() || "News" 
        });
      }
      return items;
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
      const previousData = oldDoc.exists ? oldDoc.data() : { items: [] };
      const previousItems = previousData.items || [];

      // 1. Simple Fetch
      let itemsPortal = [];
      let url = code === "KR" ? "https://signal.bz/" : (code === "JP" ? "https://search.yahoo.co.jp/realtime/term" : "");
      if (url) {
        try {
          const resP = await fetch(url).then(r => r.text());
          const portalRegex = /<span[^>]*class="[^"]*(?:rank-text|text|Trend_Trend__item__name)[^"]*"[^>]*>(.*?)<\/span>/g;
          let m;
          while ((m = portalRegex.exec(resP)) !== null) {
            const cleanText = m[1].replace(/<[^>]*>?/gm, "").trim();
            if (cleanText) itemsPortal.push(cleanText);
          }
        } catch (e) {}
      }

      const rssGT = await fetch(`https://trends.google.com/trending/rss?geo=${code}`).then(r => r.text()).catch(() => "");
      const itemsGT = [...rssGT.matchAll(/<item>(.*?)<\/item>/gs)].map(match => {
        const content = match[1];
        const title = content.match(/<title>(.*?)<\/title>/)?.[1].replace("<![CDATA[", "").replace("]]>", "").trim() || "";
        const news = [...content.matchAll(/<ht:news_item_title>(.*?)<\/ht:news_item_title>/g)].map(m => m[1].replace("<![CDATA[", "").replace("]]>", "").trim());
        const snippets = [...content.matchAll(/<ht:news_item_snippet>(.*?)<\/ht:news_item_snippet>/g)].map(m => m[1].replace("<![CDATA[", "").replace("]]>", "").replace(/<[^>]*>?/gm, "").trim());
        return { title, snippets, news };
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

      // 2. Sequential Processing to avoid Rate Limits
      for (const item of unique) {
        [item.newsLinks, item.videoLinks] = await Promise.all([this.getSupplementaryNews(item.originalTitle, code), this.getYouTubeVideos(item.originalTitle, code)]);
        item.aiReports.ko = await this.generateBaseAIReport(item, item.newsLinks.map(l => l.title), item.snippets, code, previousItems);
        // Small delay between AI calls to stay safe (4 seconds for Free Tier)
        if (!previousItems.find(p => p.originalTitle === item.originalTitle)) {
           await new Promise(r => setTimeout(r, 4000));
        }
      }

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
  schedule: "every 1 hours", 
  secrets: ["GEMINI_API_KEY"],
  timeoutSeconds: 540
}, async (event) => {
  await new TrendUpdater().updateAll();
});

