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
    const prompt = `Translate the following trending keywords into natural ${targetLangName}. Rules: 1. If it's a person's name or a brand, use the official ${targetLangName} name. 2. Provide only the translated results, separated by " ||| ". 3. Do not include any explanation or numbering.\n\nKeywords to translate:\n${titles.join('\n')}`;
    const modelsToTry = ["gemini-2.0-flash", "gemini-1.5-flash"];
    for (const modelName of modelsToTry) {
      try {
        const model = this.genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().trim();
        const results = text.split(/\s*\|[ |]*\|[ |]*\|\s*/).map(s => s.trim());
        if (results.length === titles.length) return results;
      } catch (e) { console.warn(`Gemini Translation Attempt ${modelName} failed:`, e.message); }
    }
    return [];
  }

  containsWrongScript(text, targetLang) {
    if (!text) return true;
    const hasHangul = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(text);
    const hasKana = /[ぁ-んァ-ン]/.test(text);
    if (targetLang === 'ja') return hasHangul;
    if (targetLang === 'en') return hasHangul || hasKana;
    return false;
  }

  // REFINED: Balanced Filtering
  isSupportedKeyword(text) {
    if (!text) return false;
    // 1. Must contain at least one character from KO, JA, or standard EN/Numeric
    const hasSupported = /[\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F\u3040-\u30FF\u4E00-\u9FFF[a-zA-Z0-9]/.test(text);
    // 2. Must NOT contain specific noise scripts (Arabic, Cyrillic, Thai, etc.)
    const hasNoiseScript = /[\u0600-\u06FF\u0400-\u04FF\u0E00-\u0E7F]/.test(text);
    // 3. Exclude European accents (to block French/Spanish spikes in KO/JP/US views)
    const hasEuropeanAccents = /[\u00C0-\u00FF]/.test(text);
    
    return hasSupported && !hasNoiseScript && !hasEuropeanAccents;
  }

  async generateBaseAIReport(item, newsTitles, snippets, country) {
    if (!this.genAI) return "";
    const countryNames = { 'KR': '대한민국', 'JP': '일본', 'US': '미국' };
    const countryName = countryNames[country] || country;
    const combinedContext = [...newsTitles, ...snippets].join(' / ').slice(0, 1000);
    const prompt = `분석 대상 키워드: '${item.originalTitle}'\n해당 국가: ${countryName}\n참고 뉴스/정보: ${combinedContext}\n\n위 정보를 바탕으로, 이 키워드가 왜 '지금 이 순간' ${countryName}에서 급상승 트렌드인지 분석해줘. 지시사항: 1. 일반적인 역사나 인물 프로필 설명은 배제하고, 반드시 '오늘' 발생한 특정 사건이나 뉴스에만 집중해. 2. 왜 지금 화제인지 그 핵심 이유를 첫 문장에 바로 언급해. 3. 2문장 내외로 명확하고 전문적으로 작성해. 4. 반드시 한국어로 작성하고 마크다운(**)은 쓰지마.`;
    const modelsToTry = ["gemini-2.5-flash", "gemini-2.0-flash-001"];
    for (const modelName of modelsToTry) {
      try {
        const model = this.genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().trim().replace(/\*\*/g, '');
        if (text && text.length > 15) return text;
      } catch (e) {}
    }
    return "";
  }

  getFallbackReport(title, lang, country) {
    const mapping = {
      'ko': { 'KR': '대한민국', 'JP': '일본', 'US': '미국' },
      'ja': { 'KR': '韓国', 'JP': '日本', 'US': 'アメリカ' },
      'en': { 'KR': 'South Korea', 'JP': 'Japan', 'US': 'USA' }
    };
    const c = mapping[lang]?.[country] || mapping['en'][country] || country;
    if (lang === 'ko') return `${c}에서 '${title}' 키워드가 주목받고 있습니다.`;
    if (lang === 'ja') return `${c}国内で'${title}'が注目を集めています.`;
    return `'${title}' is drawing attention in ${c}.`;
  }

  isFallback(report, lang) {
    if (!report) return true;
    const fbs = ["주목받고 있습니다", "注目を集めています", "drawing attention", "生成中です"];
    return fbs.some(f => report.includes(f)) || report.length < 20;
  }

  async getSupplementaryNews(keyword, countryCode) {
    const hl = countryCode === "KR" ? "ko" : countryCode === "JP" ? "ja" : "en";
    const gl = countryCode;
    const suffix = { 'KR': ' 뉴스', 'JP': ' ニュース', 'US': ' News' };
    const query = `${keyword}${suffix[countryCode] || ' News'}`;
    try {
      const res = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${hl}&gl=${gl}&ceid=${gl}:${hl}`);
      const text = await res.text();
      const dom = new JSDOM(text, { contentType: "text/xml" });
      const items = Array.from(dom.window.document.querySelectorAll("item")).slice(0, 3);
      return items.map(item => {
        const title = item.querySelector("title")?.textContent || "";
        return { title: title.split(" - ")[0], url: item.querySelector("link")?.textContent || "", source: title.split(" - ").pop() || "News" };
      });
    } catch (e) { return []; }
  }

  async getYouTubeVideos(keyword, countryCode) {
    const hl = countryCode === "KR" ? "ko" : countryCode === "JP" ? "ja" : "en";
    const gl = countryCode;
    const query = countryCode === "KR" ? `${keyword} 한국 뉴스` : (countryCode === "JP" ? `${keyword} 日本 ニュース` : `${keyword} News`);
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

      // 1. Fetch Trends (Extended Pool)
      let url = code === "KR" ? "https://signal.bz/" : (code === "JP" ? "https://search.yahoo.co.jp/realtime/term" : "");
      let itemsPortal = [];
      if (url) {
        try {
          const resP = await fetch(url).then(r => r.text());
          const domP = new JSDOM(resP);
          itemsPortal = code === "KR" ? 
            Array.from(domP.window.document.querySelectorAll(".rank-item .text")).map(el => el.textContent.trim()) : 
            Array.from(domP.window.document.querySelectorAll(".Trend_Trend__item__name")).map(el => el.textContent.trim());
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
      const rawTitles = [...itemsPortal, ...itemsGT.map(i => i.title)];
      for (let title of rawTitles) {
        const lower = title.toLowerCase();
        if (!seen.has(lower) && this.isSupportedKeyword(title)) {
          seen.add(lower);
          const gt = itemsGT.find(i => i.title === title) || { snippets: [], news: [] };
          unique.push({ originalTitle: title, snippets: gt.snippets, newsTitles: gt.news, translations: {}, aiReports: {} });
        }
        if (unique.length >= 10) break;
      }

      // 2. Generate/Reuse AI Report
      for (let item of unique) {
        const prev = previousItems.find(p => p.originalTitle === item.originalTitle);
        if (prev && JSON.stringify(item.newsTitles) === JSON.stringify(prev.newsTitles) && prev.aiReports?.ko && !this.isFallback(prev.aiReports.ko)) {
          item.aiReports = prev.aiReports;
        } else {
          const base = await this.generateBaseAIReport(item, item.newsTitles, item.snippets, code);
          if (base) {
            item.aiReports.ko = base;
            langs.filter(l => l !== 'ko').forEach(l => item.aiReports[l] = "");
            await new Promise(r => setTimeout(r, 2000));
          } else if (prev && prev.aiReports?.ko) {
            item.aiReports = prev.aiReports;
          }
        }
      }

      // 3. Hybrid Translation
      for (let lang of langs) {
        const toTTitle = unique.filter(i => !i.translations[lang] || this.containsWrongScript(i.translations[lang], lang)).map(i => i.originalTitle);
        if (toTTitle.length > 0) {
          let transT = await this.translateBatch(toTTitle, lang);
          const fIdx = [];
          transT.forEach((t, idx) => { if (this.containsWrongScript(t, lang)) fIdx.push(idx); });
          if (fIdx.length > 0) {
            const fTitles = fIdx.map(idx => toTTitle[idx]);
            const gemRes = await this.translateWithGemini(fTitles, lang);
            if (gemRes.length === fTitles.length) fIdx.forEach((idx, gi) => { transT[idx] = gemRes[gi]; });
          }
          unique.filter(i => !i.translations[lang] || this.containsWrongScript(i.translations[lang], lang)).forEach((item, idx) => { 
            item.translations[lang] = (transT && transT[idx]) ? transT[idx] : item.originalTitle; 
          });
        }

        const toTRep = unique.filter(i => i.aiReports.ko && (!i.aiReports[lang] || this.isFallback(i.aiReports[lang], lang))).map(i => i.aiReports.ko);
        if (toTRep.length > 0) {
          const transR = await this.translateBatch(toTRep, lang);
          unique.filter(i => i.aiReports.ko && (!i.aiReports[lang] || this.isFallback(i.aiReports[lang], lang))).forEach((item, idx) => { 
            if (transR && transR[idx]) item.aiReports[lang] = transR[idx];
            else if (!item.aiReports[lang]) item.aiReports[lang] = this.getFallbackReport(item.originalTitle, lang, code);
          });
        }
      }

      // 4. Final Sanity Check
      for (let item of unique) {
        for (let l of langs) {
          if (!item.translations[l]) item.translations[l] = item.originalTitle;
          if (!item.aiReports[l]) item.aiReports[l] = this.getFallbackReport(item.originalTitle, l, code);
        }
        item.newsLinks = await this.getSupplementaryNews(item.originalTitle, code);
        item.videoLinks = await this.getYouTubeVideos(item.originalTitle, code);
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
  const updater = new TrendUpdater();
  await updater.updateAll();
});
