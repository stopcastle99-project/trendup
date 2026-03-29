
import admin from "firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import { execSync } from "child_process";

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} else {
  admin.initializeApp();
}

const db = admin.firestore();
console.log("====================================================");
console.log(">>> CRITICAL: RUNNING UPDATE SCRIPT v3.1.15 <<<");
console.log(">>> TARGET MODEL: Gemma 3 / 2 (Batch Mode) <<<");
console.log("====================================================");

class TrendUpdater {
  constructor() {
    this.genAI = null;
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) this.genAI = new GoogleGenerativeAI(apiKey);
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
      // Free translate API can block giant URLs, so for translations we just use single promises if it's too big, or rely on small chunks.
      const combinedText = texts.join(" ||| ");
      if (combinedText.length > 1500) {
        return await Promise.all(texts.map(t => translateSingle(t, targetLang)));
      }
      const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(combinedText)}`, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      const data = await res.json();
      const combinedResult = data[0].map(x => x[0]).join("");
      const results = combinedResult.split(/\s*\|[ |]*\|[ |]*\|\s*/).map(s => s.trim());
      return results.length === texts.length ? results : await Promise.all(texts.map(t => translateSingle(t, targetLang)));
    } catch (e) { return await Promise.all(texts.map(t => translateSingle(t, targetLang))); }
  }

  async getGeminiUsageCount() {
    try {
      const metaRef = db.collection("trends").doc("metadata");
      const doc = await metaRef.get();
      if (!doc.exists) return 0;
      
      const data = doc.data();
      const now = new Date();
      const resetTimeUTC = new Date(now);
      resetTimeUTC.setUTCHours(7, 0, 0, 0);
      if (now < resetTimeUTC) resetTimeUTC.setUTCDate(resetTimeUTC.getUTCDate() - 1);
      const resetDateStr = resetTimeUTC.toISOString().split('T')[0];

      if (data.gemini_last_reset !== resetDateStr) return 0;
      return data.gemini_count || 0;
    } catch (e) { return 0; }
  }

  async incrementGeminiUsage() {
    const metaRef = db.collection("trends").doc("metadata");
    const now = new Date();
    const resetTimeUTC = new Date(now);
    resetTimeUTC.setUTCHours(7, 0, 0, 0);
    if (now < resetTimeUTC) resetTimeUTC.setUTCDate(resetTimeUTC.getUTCDate() - 1);
    const resetDateStr = resetTimeUTC.toISOString().split('T')[0];

    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(metaRef);
      if (!doc.exists || doc.data().gemini_last_reset !== resetDateStr) {
        transaction.set(metaRef, { gemini_count: 1, gemini_last_reset: resetDateStr }, { merge: true });
      } else {
        transaction.update(metaRef, { gemini_count: admin.firestore.FieldValue.increment(1) });
      }
    });
  }

  async generateBatchAIReports(itemsToProcess, country, previousItems) {
    if (!this.genAI || itemsToProcess.length === 0) return {};
    const currentUsage = await this.getGeminiUsageCount();
    if (currentUsage >= 14350) {
      console.warn(`  - AI Safety: Daily limit reached (Gemma max 14400).`);
      return {};
    }

    const countryNames = { KR: '대한민국', JP: '일본', US: '미국' };
    const countryName = countryNames[country] || country;
    
    const prompt = `당신은 글로벌 검색어 트렌드 분석 전문가입니다. 현재 ${countryName}에서 화제가 되고 있는 아래의 '트렌드 키워드 리스트'와 각 '키워드별 관련 뉴스 제목들'을 바탕으로, 각 키워드가 왜 트렌드인지 단 2문장 내외의 한국어로 명료하게 요약해주세요.
반드시 아래의 JSON 배열 형식으로만 응답해야 하며, JSON 외의 다른 부연 설명은 절대 덧붙이지 마세요.
[
  { "keyword": "키워드1", "summary": "요약 내용..." },
  { "keyword": "키워드2", "summary": "요약 내용..." }
]

분석할 키워드 리스트:
${itemsToProcess.map(i => `- 키워드: ${i.originalTitle}\n  관련 뉴스: ${i.newsTitles.join(' / ')}`).join('\n\n')}
`;

    try {
      let text = "";
      let usedModel = "gemma-3-27b-it";
      const modelsToTry = ["gemma-3-27b-it", "gemma-2-27b-it", "gemini-2.5-flash"];
      
      for (const m of modelsToTry) {
        try {
          const model = this.genAI.getGenerativeModel({ model: m });
          const result = await model.generateContent(prompt);
          const response = await result.response;
          text = response.text().trim();
          usedModel = m;
          break;
        } catch (err) {
          console.log(`  - Model fallback: ${m} failed (${err.message}). Trying next...`);
        }
      }
      
      if (!text) {
        throw new Error("All AI models failed to generate content.");
      }
      
      if (text.startsWith("\`\`\`json")) text = text.replace(/^\`\`\`json/g, "").replace(/\`\`\`$/g, "").trim();
      else if (text.startsWith("\`\`\`")) text = text.replace(/^\`\`\`/g, "").replace(/\`\`\`$/g, "").trim();
      
      const parsed = JSON.parse(text);
      if (parsed) {
        console.log(`  - AI Batch Success: ${usedModel} processed ${itemsToProcess.length} items (${currentUsage + 1}/14400)`);
        await this.incrementGeminiUsage();
      }
      
      const reportMap = {};
      parsed.forEach(p => { reportMap[p.keyword] = p.summary; });
      return reportMap;
    } catch (e) {
      console.error(`🚨 [v3.1.48 ERROR] AI Batch Error for ${country}:`, e.message);
      if (e.response) console.error(`  - Error Details:`, JSON.stringify(e.response));
      return {};
    }
  }

  async fetchTrends(code) {
    try {
      const res = await fetch(`https://trends.google.com/trending/rss?geo=${code}`).then(r => r.text());
      const items = [...res.matchAll(/<item>(.*?)<\/item>/gs)].slice(0, 10).map(match => {
        const content = match[1];
        const title = content.match(/<title>(.*?)<\/title>/)?.[1].replace("<![CDATA[", "").replace("]]>", "").trim() || "";
        const news = [...content.matchAll(/<ht:news_item_title>(.*?)<\/ht:news_item_title>/g)].map(m => m[1].replace("<![CDATA[", "").replace("]]>", "").trim());
        return { originalTitle: title, newsTitles: news, translations: {}, aiReports: {}, newsLinks: [], videoLinks: [] };
      });
      return items;
    } catch (e) { return []; }
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
        items.push({ title: title.split(" - ")[0], url: link, source: title.split(" - ").pop() || "News" });
      }
      return items;
    } catch (e) { return []; }
  }

  async getYouTubeVideos(keyword, countryCode) {
    const hl = countryCode === "KR" ? "ko" : countryCode === "JP" ? "ja" : "en";
    try {
      const res = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(keyword)}&gl=${countryCode}&hl=${hl}`);
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

  generateSitemap(allTrends) {
    const baseUrl = "https://globaltrendup.com";
    const lastMod = new Date().toISOString().split('T')[0];
    let s = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    s += `  <url><loc>${baseUrl}/</loc><lastmod>${lastMod}</lastmod><priority>1.0</priority></url>\n`;
    [...new Set(allTrends)].slice(0, 50).forEach(kw => {
      s += `  <url><loc>${baseUrl}/?q=${encodeURIComponent(kw)}</loc><lastmod>${lastMod}</lastmod><priority>0.8</priority></url>\n`;
    });
    s += `</urlset>`;
    fs.writeFileSync("sitemap.xml", s);
  }

  generateRSS(allTrends) {
    const baseUrl = "https://globaltrendup.com";
    const now = new Date().toUTCString();
    let r = `<?xml version="1.0" encoding="UTF-8" ?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n<channel>\n`;
    r += `  <title>GlobalTrendUp | Real-time Global Trends</title>\n`;
    r += `  <link>${baseUrl}</link>\n`;
    r += `  <description>Real-time global trending keywords (KR, JP, US) and AI-powered context summaries.</description>\n`;
    r += `  <language>ko</language>\n`;
    r += `  <lastBuildDate>${now}</lastBuildDate>\n`;
    r += `  <atom:link href="${baseUrl}/rss.xml" rel="self" type="application/rss+xml" />\n`;
    [...new Set(allTrends)].slice(0, 20).forEach(kw => {
      r += `  <item>\n    <title>${kw}</title>\n    <link>${baseUrl}/?q=${encodeURIComponent(kw)}</link>\n    <pubDate>${now}</pubDate>\n    <guid>${baseUrl}/?q=${encodeURIComponent(kw)}</guid>\n  </item>\n`;
    });
    r += `</channel>\n</rss>`;
    fs.writeFileSync("rss.xml", r);
  }

  bumpVersion() {
    try {
      const indexHtml = fs.readFileSync("index.html", "utf8");
      const match = indexHtml.match(/v(\d+)\.(\d+)\.(\d+)/);
      if (match) {
        const newVer = `v${match[1]}.${match[2]}.${parseInt(match[3]) + 1}`;
        const updated = indexHtml.replace(/v(\d+)\.(\d+)\.(\d+)/g, newVer);
        fs.writeFileSync("index.html", updated);
        fs.writeFileSync("public/index.html", updated);
        // Sync main assets
        fs.writeFileSync("public/main.js", fs.readFileSync("main.js", "utf8"));
        fs.writeFileSync("public/style.css", fs.readFileSync("style.css", "utf8"));
        return newVer;
      }
    } catch (e) {}
    return "v3.1.48";
  }


  async updateAll() {
    const countries = ["KR", "JP", "US"];
    const langs = ["ko", "ja", "en"];
    let allKeywords = [];
    for (const code of countries) {
      console.log(`Updating ${code}...`);
      const items = await this.fetchTrends(code);
      const docRef = db.collection("trends").doc(code);
      const oldDoc = await docRef.get();
      const previousItems = oldDoc.exists ? oldDoc.data().items || [] : [];
      const itemsToProcess = items.filter(item => {
        const existing = previousItems.find(p => p.originalTitle === item.originalTitle);
        const hasValidReport = existing && existing.aiReports && existing.aiReports.ko && !existing.aiReports.ko.includes("Hot Trend:");
        return !hasValidReport;
      });

      let newReportsMap = {};
      if (itemsToProcess.length > 0) {
        newReportsMap = await this.generateBatchAIReports(itemsToProcess, code, previousItems);
      }

      for (const item of items) {
        allKeywords.push(item.originalTitle);
        const existing = previousItems.find(p => p.originalTitle === item.originalTitle);
        const hasValidReport = existing && existing.aiReports && existing.aiReports.ko && !existing.aiReports.ko.includes("Hot Trend:");
        
        if (hasValidReport) {
          item.aiReports.ko = existing.aiReports.ko;
        } else {
          item.aiReports.ko = newReportsMap[item.originalTitle] || `${code} Hot Trend: ${item.originalTitle}`;
        }
      }
      for (const lang of langs) {
        const titlesToTranslate = items.map(i => i.originalTitle);
        const translatedTitles = await this.translateBatch(titlesToTranslate, lang);
        items.forEach((item, idx) => { item.translations[lang] = translatedTitles[idx] || item.originalTitle; });
        if (lang !== 'ko') {
          const reportsToTranslate = items.map(i => i.aiReports.ko);
          const translatedReports = await this.translateBatch(reportsToTranslate, lang);
          items.forEach((item, idx) => { item.aiReports[lang] = translatedReports[idx] || item.aiReports.ko; });
        }
      }
      await Promise.all(items.map(async (item) => {
        [item.newsLinks, item.videoLinks] = await Promise.all([this.getSupplementaryNews(item.originalTitle, code), this.getYouTubeVideos(item.originalTitle, code)]);
      }));
      await docRef.set({ items, previousItems, lastUpdated: admin.firestore.Timestamp.now() });
    }
    this.generateSitemap(allKeywords);
    this.generateRSS(allKeywords);
    const ver = this.bumpVersion();
    console.log(`Data crawling complete. Version bumped to ${ver}`);
    process.exit(0);
  }
}
new TrendUpdater().updateAll();
