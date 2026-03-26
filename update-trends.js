
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
      const combinedText = texts.join(" ||| ");
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

  async generateBaseAIReport(item, news, country, previousItems = []) {
    if (!this.genAI) return "";
    const existing = previousItems.find(p => p.originalTitle === item.originalTitle);
    if (existing && existing.aiReports && existing.aiReports.ko) return existing.aiReports.ko;

    const currentUsage = await this.getGeminiUsageCount();
    if (currentUsage >= 1480) {
      console.warn(`  - Gemini Safety: Daily limit reached (${currentUsage}/1500).`);
      return "오늘의 AI 분석 할당량이 소진되었습니다.";
    }

    const countryNames = { KR: '대한민국', JP: '일본', US: '미국' };
    const countryName = countryNames[country] || country;
    const prompt = `'${item.originalTitle}' 키워드가 현재 ${countryName}에서 왜 트렌드인지 분석해줘. 참고 정보: ${news.join(' / ')}. 분석 내용만 2문장 내외 한국어로 작성.`;
    try {
      const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(prompt);
      const text = (await result.response).text().trim().replace(/\*\*/g, '');
      if (text) {
        console.log(`  - Gemini Success: gemini-2.5-flash for ${item.originalTitle} (${currentUsage + 1}/1500)`);
        await this.incrementGeminiUsage();
      }
      return text;
    } catch (e) {
      console.error(`  - Gemini Error for ${item.originalTitle}:`, e.message);
      return "";
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
    return "v3.0.3";
  }

  executeDeploy(ver) {
    try {
      execSync(`git add . && git commit -m 'chore: schedule trend update (${ver}) [skip ci]' && git push origin main`, { stdio: 'inherit' });
      const tokenArg = process.env.FIREBASE_TOKEN ? `--token ${process.env.FIREBASE_TOKEN}` : '';
      execSync(`npx firebase-tools deploy --only hosting ${tokenArg}`, { stdio: 'inherit' });
    } catch (e) {
      console.error("  - Deploy/Commit Error:", e.message);
    }
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
      for (const item of items) {
        allKeywords.push(item.originalTitle);
        item.aiReports.ko = await this.generateBaseAIReport(item, item.newsTitles, code, previousItems) || `${code} Hot Trend: ${item.originalTitle}`;
        if (!previousItems.find(p => p.originalTitle === item.originalTitle)) await new Promise(r => setTimeout(r, 4000));
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
    this.executeDeploy(ver);
    console.log("Update Complete.");
    process.exit(0);
  }
}
new TrendUpdater().updateAll();
