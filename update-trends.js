
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
      const results = data[0].map(x => x[0]).join("").split(/\s*\|[ |]*\|[ |]*\|\s*/).map(s => s.trim());
      return results.length === texts.length ? results : await Promise.all(texts.map(t => translateSingle(t, targetLang)));
    } catch (e) { return await Promise.all(texts.map(t => translateSingle(t, targetLang))); }
  }

  async generateBaseAIReport(item, country) {
    if (!this.genAI) return "";
    const countryNames = { KR: '대한민국', JP: '일본', US: '미국' };
    const countryName = countryNames[country] || country;
    const prompt = `'${item.originalTitle}' 키워드가 현재 ${countryName}에서 왜 트렌드인지 분석해줘. 분석 내용만 2문장 내외 한국어로 작성.`;
    try {
      const model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContent(prompt);
      return (await result.response).text().trim().replace(/\*\*/g, '');
    } catch (e) { return ""; }
  }

  async fetchGoogleTrends(code) {
    try {
      const res = await fetch(`https://trends.google.com/trending/rss?geo=${code}`).then(r => r.text());
      const titles = [...res.matchAll(/<title>(.*?)<\/title>/g)].slice(1, 11).map(m => m[1].replace("<![CDATA[", "").replace("]]>", "").trim());
      return titles.map(t => ({ originalTitle: t, translations: {}, aiReports: {} }));
    } catch (e) { return []; }
  }

  generateSitemap(allTrends) {
    const baseUrl = "https://globaltrendup.com";
    const lastMod = new Date().toISOString().split('T')[0];
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    sitemap += `  <url><loc>${baseUrl}/</loc><lastmod>${lastMod}</lastmod><priority>1.0</priority></url>\n`;
    [...new Set(allTrends)].slice(0, 50).forEach(kw => {
      sitemap += `  <url><loc>${baseUrl}/?q=${encodeURIComponent(kw)}</loc><lastmod>${lastMod}</lastmod><priority>0.8</priority></url>\n`;
    });
    sitemap += `</urlset>`;
    fs.writeFileSync("public/sitemap.xml", sitemap);
    fs.writeFileSync("sitemap.xml", sitemap);
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
    return "v2.8.5";
  }

  executeDeploy(ver) {
    try {
      execSync("git add . && git commit -m 'auto: Update trends' && git push origin main", { stdio: 'inherit' });
      execSync("npx firebase-tools deploy --only hosting", { stdio: 'inherit' });
    } catch (e) {}
  }

  async updateAll() {
    const countries = ["KR", "JP", "US"];
    const langs = ["ko", "ja", "en"];
    let allKeywords = [];
    for (const code of countries) {
      console.log(`Updating ${code}...`);
      const items = await this.fetchGoogleTrends(code);
      const docRef = db.collection("trends").doc(code);
      const oldDoc = await docRef.get();
      const previousItems = oldDoc.exists ? oldDoc.data().items || [] : [];
      
      for (let item of items) {
        allKeywords.push(item.originalTitle);
        item.aiReports.ko = await this.generateBaseAIReport(item, code) || `${code} Hot Trend: ${item.originalTitle}`;
        for (let lang of langs) {
          if (lang !== 'ko') {
            item.aiReports[lang] = (await this.translateBatch([item.aiReports.ko], lang))[0];
            item.translations[lang] = (await this.translateBatch([item.originalTitle], lang))[0];
          }
        }
      }
      await docRef.set({ items, previousItems, lastUpdated: admin.firestore.Timestamp.now() });
    }
    this.generateSitemap(allKeywords);
    const ver = this.bumpVersion();
    this.executeDeploy(ver);
    console.log("Completed.");
    process.exit(0);
  }
}
new TrendUpdater().updateAll();
