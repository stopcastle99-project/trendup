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

  containsWrongScript(text, targetLang) {
    if (!text) return true;
    const hasHangul = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(text);
    const hasKana = /[ぁ-んァ-ン]/.test(text);
    if (targetLang === 'ja') return hasHangul;
    if (targetLang === 'en') return hasHangul || hasKana;
    return false;
  }

  isSupportedKeyword(text) {
    if (!text) return false;
    const trimmed = text.trim();
    if (trimmed.length < 2 && !/[\uAC00-\uD7A3\u3040-\u30FF\u4E00-\u9FFF]/.test(trimmed)) return false;
    if (/^\[.*\]$/.test(trimmed)) return false;
    if (!/[\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F\u3040-\u30FF\u4E00-\u9FFFa-zA-Z0-9]/.test(trimmed)) return false;
    const badRegex = /[\u0100-\u024F\u1E00-\u1EFF\u00C0-\u00FF\u0600-\u06FF\u0400-\u04FF\u0E00-\u0E7F]/;
    return !badRegex.test(trimmed);
  }

  async generateBaseAIReport(item, newsTitles, snippets, country) {
    if (!this.genAI) return "";
    const countryName = { 'KR': '대한민국', 'JP': '일본', 'US': '미국' }[country] || country;
    const context = [...newsTitles, ...snippets].join(' / ').slice(0, 1500);
    const prompt = `키워드: '${item.originalTitle}' (${countryName})\n뉴스: ${context}\n\n위 뉴스를 기반으로 이 키워드가 왜 지금 트렌드인지 한국어로 2문장 요약해. 마크다운 쓰지마.`;
    try {
      const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(prompt);
      return result.response.text().trim().replace(/\*\*/g, '');
    } catch (e) { return ""; }
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

      // 1. Fetch Candidates (Increased Pool)
      let itemsPortal = [];
      let url = code === "KR" ? "https://signal.bz/" : (code === "JP" ? "https://search.yahoo.co.jp/realtime/term" : "");
      if (url) {
        try {
          const resP = await fetch(url).then(r => r.text());
          const domP = new JSDOM(resP);
          itemsPortal = Array.from(domP.window.document.querySelectorAll(".rank-item .text, .rank-text, .Trend_Trend__item__name")).map(el => el.textContent.trim()).filter(t => t && t.length > 1);
        } catch (e) {}
      }
      
      const rssGT = await fetch(`https://trends.google.com/trending/rss?geo=${code}`).then(r => r.text()).catch(() => "");
      const domGT = new JSDOM(rssGT, { contentType: "text/xml" });
      const itemsGT = Array.from(domGT.window.document.querySelectorAll("item")).map(item => {
        const title = item.querySelector("title")?.textContent || "";
        const getNodes = (tag) => Array.from(item.childNodes).filter(n => n.localName === tag);
        return { title, snippets: getNodes("news_item_snippet").map(s => s.textContent.replace(/<[^>]*>?/gm, "").trim()), news: getNodes("news_item_title").map(t => t.textContent) };
      });

      // 2. Select Top 10
      const unique = [];
      const seen = new Set();
      const combined = [];
      const maxL = Math.max(itemsGT.length, itemsPortal.length);
      for(let i=0; i<maxL; i++) { if(itemsGT[i]) combined.push(itemsGT[i].title); if(itemsPortal[i]) combined.push(itemsPortal[i]); }

      for (let title of combined) {
        const lower = title.toLowerCase();
        if (!seen.has(lower) && this.isSupportedKeyword(title)) {
          seen.add(lower);
          const gt = itemsGT.find(i => i.title === title) || { snippets: [], news: [] };
          unique.push({ originalTitle: title, snippets: gt.snippets, newsTitles: gt.news, translations: {}, aiReports: {} });
        }
        if (unique.length >= 10) break;
      }

      // Fill with previous if still under 10
      if (unique.length < 10) {
        for (let p of previousItems) {
          if (!seen.has(p.originalTitle.toLowerCase()) && this.isSupportedKeyword(p.originalTitle)) {
            seen.add(p.originalTitle.toLowerCase());
            unique.push({ ...p, translations: {}, aiReports: {} });
          }
          if (unique.length >= 10) break;
        }
      }

      // 3. PARALLEL PROCESSING: News, Videos, and AI Reports
      await Promise.all(unique.map(async (item) => {
        [item.newsLinks, item.videoLinks] = await Promise.all([this.getSupplementaryNews(item.originalTitle, code), this.getYouTubeVideos(item.originalTitle, code)]);
        const freshTitles = item.newsLinks.map(l => l.title);
        const prev = previousItems.find(p => p.originalTitle === item.originalTitle);
        if (prev && JSON.stringify(freshTitles) === JSON.stringify(prev.newsLinks?.map(l => l.title)) && prev.aiReports?.ko) {
          item.aiReports = prev.aiReports;
        } else {
          item.aiReports.ko = await this.generateBaseAIReport(item, freshTitles, item.snippets, code);
        }
      }));

      // 4. Batch Translation
      for (let lang of langs) {
        const toTTitle = unique.filter(i => !i.translations[lang] || this.containsWrongScript(i.translations[lang], lang)).map(i => i.originalTitle);
        if (toTTitle.length > 0) {
          let transT = await this.translateBatch(toTTitle, lang);
          const fIdx = [];
          transT.forEach((t, idx) => { if (this.containsWrongScript(t, lang)) fIdx.push(idx); });
          if (fIdx.length > 0) {
            const gemRes = await this.translateWithGemini(fIdx.map(idx => toTTitle[idx]), lang);
            if (gemRes.length === fIdx.length) fIdx.forEach((idx, gi) => { transT[idx] = gemRes[gi]; });
          }
          unique.filter(i => !i.translations[lang] || this.containsWrongScript(i.translations[lang], lang)).forEach((item, idx) => { item.translations[lang] = transT[idx] || item.originalTitle; });
        }

        const toTRep = unique.filter(i => i.aiReports.ko && (!i.aiReports[lang] || this.isFallback(i.aiReports[lang], lang))).map(i => i.aiReports.ko);
        if (toTRep.length > 0) {
          const transR = await this.translateBatch(toTRep, lang);
          unique.filter(i => i.aiReports.ko && (!i.aiReports[lang] || this.isFallback(i.aiReports[lang], lang))).forEach((item, idx) => {
            if (transR[idx]) item.aiReports[lang] = transR[idx];
            else if (!item.aiReports[lang]) item.aiReports[lang] = this.getFallbackReport(item.originalTitle, lang, code);
          });
        }
      }

      // Final Sanity Fill
      for (let item of unique) {
        for (let l of langs) {
          if (!item.translations[l]) item.translations[l] = item.originalTitle;
          if (!item.aiReports[l]) item.aiReports[l] = this.getFallbackReport(item.originalTitle, l, code);
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
