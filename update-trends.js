
import admin from "firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import { execSync } from "child_process";

// Firebase Initialization
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

  async generateBaseAIReport(item, news, country) {
    if (!this.genAI) return "";
    const countryNames = { KR: '대한민국', JP: '일본', US: '미국' };
    const countryName = countryNames[country] || country;
    const prompt = `'${item.originalTitle}' 키워드가 현재 ${countryName}에서 왜 트렌드인지 분석해줘. 참고 정보: ${news.join(' / ')}. 분석 내용만 2문장 내외 한국어로 작성.`;
    try {
      const model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContent(prompt);
      return (await result.response).text().trim().replace(/\*\*/g, '');
    } catch (e) { return ""; }
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
    fs.writeFileSync("public/sitemap.xml", s);
    fs.writeFileSync("sitemap.xml", s);
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
        return newVer;
      }
    } catch (e) {}
    return "v2.8.6";
  }

  executeDeploy(ver) {
    try {
      execSync("git add . && git commit -m 'auto: Data update & Translation fix' && git push origin main", { stdio: 'inherit' });
      execSync("npx firebase-tools deploy --only hosting", { stdio: 'inherit' });
    } catch (e) {}
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
      
      for (let item of items) {
        allKeywords.push(item.originalTitle);
        item.aiReports.ko = await this.generateBaseAIReport(item, item.newsTitles, code) || `${code} Hot Trend: ${item.originalTitle}`;
        
        // Fix: Translate into ALL target languages including 'ko' if necessary
        for (let lang of langs) {
          const translatedTitle = await this.translateBatch([item.originalTitle], lang);
          item.translations[lang] = translatedTitle[0] || item.originalTitle;
          
          if (lang === 'ko') continue;
          const translatedReport = await this.translateBatch([item.aiReports.ko], lang);
          item.aiReports[lang] = translatedReport[0] || item.aiReports.ko;
        }
        item.videoLinks = await this.getYouTubeVideos(item.originalTitle, code);
      }
      await docRef.set({ items, previousItems, lastUpdated: admin.firestore.Timestamp.now() });
    }
    this.generateSitemap(allKeywords);
    const ver = this.bumpVersion();
    this.executeDeploy(ver);
    console.log("Translation logic fixed and deployment triggered.");
    process.exit(0);
  }
}
new TrendUpdater().updateAll();
