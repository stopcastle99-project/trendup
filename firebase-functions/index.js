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

  // Backup Translation using Gemini for proper nouns and slang
  async translateWithGemini(titles, targetLang) {
    if (!this.genAI || !titles || titles.length === 0) return [];
    const langNames = { 'ko': 'Korean', 'ja': 'Japanese', 'en': 'English' };
    const targetLangName = langNames[targetLang] || 'English';
    
    const prompt = `
      Translate the following trending keywords into natural ${targetLangName}.
      Rules:
      1. If it's a person's name or a brand, use the official ${targetLangName} name.
      2. Provide only the translated results, separated by " ||| ".
      3. Do not include any explanation or numbering.
      
      Keywords to translate:
      ${titles.join('\n')}
    `;

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

  // Generate a single report in Korean (Base Language)
  async generateBaseAIReport(item, newsTitles, snippets, country) {
    if (!this.genAI) return "";
    
    const countryNames = { 'KR': '대한민국', 'JP': '일본', 'US': '미국' };
    const countryName = countryNames[country] || country;
    const title = item.originalTitle;

    // Enhanced Context: Merge news titles and snippets for better grounding
    const combinedContext = [...newsTitles, ...snippets].join(' / ').slice(0, 1000);

    const prompt = `
      '${title}' 키워드가 현재 ${countryName}에서 왜 트렌드인지 분석해줘.
      참고 정보: ${combinedContext}
      지시사항:
      1. 인사말, 자기소개, 불필요한 미사여구 없이 바로 분석 내용만 작성해.
      2. 위 정보를 바탕으로 트렌드의 구체적인 원인과 현재 상황을 2문장 내외로 요약해.
      3. 반드시 한국어(Korean)로 작성해.
      4. '**' 같은 마크다운 기호는 절대 사용하지마.
    `;

    const modelsToTry = ["gemini-2.5-flash", "gemini-2.0-flash-001", "gemini-flash-latest", "gemini-pro"];
    for (const modelName of modelsToTry) {
      try {
        const model = this.genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().trim().replace(/\*\*/g, '');
        if (text && text.length > 15 && !text.includes("죄송합니다") && !text.includes("알 수 없")) return text;
      } catch (e) { console.warn(`AI Attempt ${modelName} failed:`, e.message); }
    }
    return "";
  }

  getFallbackReport(title, lang, country) {
    const mapping = {
      'ko': { 'KR': '대한민국', 'JP': '일본', 'US': '미국' },
      'ja': { 'KR': '韓国', 'JP': '日本', 'US': 'アメリカ' },
      'en': { 'KR': 'South Korea', 'JP': 'Japan', 'US': 'USA' }
    };
    const countryName = mapping[lang]?.[country] || mapping['en'][country] || country;

    if (lang === 'ko') return `${countryName}에서 '${title}' 키워드가 관련 보도를 통해 주목받고 있습니다.`;
    if (lang === 'ja') return `${countryName}国内で'${title}'が注目を集めています。`; // '가' 제거 및 'が'로 교체
    return `'${title}' is drawing attention in ${countryName} through various news reports.`;
  }

  // Check if the current report is just a fallback template or contains errors
  isFallback(report, lang) {
    if (!report) return true;
    const fallbacks = ["주목받고 있습니다", "注目を集めています", "drawing attention", "지연되고 있으나", "生成中です"];
    const hasKoreanInJapanese = lang === 'ja' && (report.includes("일본") || report.includes("대한민국") || report.includes("미국") || report.includes("가 주목"));
    return fallbacks.some(f => report.includes(f)) || report.length < 30 || hasKoreanInJapanese;
  }

  async getSupplementaryNews(keyword, countryCode, snippets = []) {
    const hl = countryCode === "KR" ? "ko" : countryCode === "JP" ? "ja" : "en";
    const gl = countryCode;
    
    // 1. Context-Aware Query Building
    let refinedQuery = keyword;
    if (snippets && snippets.length > 0) {
      // Use the first part of the snippet to narrow down the context
      const context = snippets[0].split(/[.!?]/)[0].split(' ').slice(0, 3).join(' ');
      if (context && context.length > 2 && !context.includes(keyword)) refinedQuery = `${keyword} ${context}`;
    }

    const countrySuffix = { 'KR': ' 뉴스', 'JP': ' ニュース', 'US': ' News' };
    let query = `${refinedQuery}${countrySuffix[countryCode] || ' News'}`;

    try {
      const res = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${hl}&gl=${gl}&ceid=${gl}:${hl}`);
      const text = await res.text();
      const dom = new JSDOM(text, { contentType: "text/xml" });
      const items = dom.window.document.querySelectorAll("item");
      
      const trustedSources = ['연합뉴스', 'YTN', 'KBS', 'SBS', 'MBC', 'NHK', 'Yahoo', 'Reuters', 'AP', 'BBC', 'CNN', 'Times', 'NYT'];
      const links = Array.from(items).map(item => {
        const title = item.querySelector("title")?.textContent || "";
        const source = title.split(" - ").pop() || "News";
        return {
          title: title.split(" - ")[0],
          url: item.querySelector("link")?.textContent || "",
          source: source
        };
      });

      // 2. Priority Sorting: Trusted sources first
      const sorted = links.sort((a, b) => {
        const aTrusted = trustedSources.some(s => a.source.includes(s));
        const bTrusted = trustedSources.some(s => b.source.includes(s));
        return bTrusted - aTrusted;
      });

      const uniqueSources = new Set();
      return sorted.filter(l => {
        if (uniqueSources.has(l.source) || uniqueSources.size >= 3) return false;
        uniqueSources.add(l.source);
        return true;
      });
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

  async updateAll() {
    const countries = ["KR", "JP", "US"];
    const langs = ["ko", "ja", "en"];
    
    for (const code of countries) {
      console.log(`Updating ${code}...`);
      const docRef = db.collection("trends").doc(code);
      const oldDoc = await docRef.get();
      const previousItems = oldDoc.exists ? oldDoc.data().items || [] : [];
      const prevReportMap = new Map(previousItems.map(i => [i.originalTitle, i.aiReports || {}]));

      // 1. Fetch Trends
      let url = code === "KR" ? "https://signal.bz/" : "https://search.yahoo.co.jp/realtime/term";
      const resPortal = await fetch(url).then(r => r.text()).catch(() => "");
      const domPortal = new JSDOM(resPortal);
      const itemsPortal = code === "KR" ? Array.from(domPortal.window.document.querySelectorAll(".rank-item .text")).slice(0,10).map(el => el.textContent.trim()) : Array.from(domPortal.window.document.querySelectorAll(".Trend_Trend__item__name")).slice(0,10).map(el => el.textContent.trim());
      
      const rssGT = await fetch(`https://trends.google.com/trending/rss?geo=${code}`).then(r => r.text()).catch(() => "");
      const domGT = new JSDOM(rssGT, { contentType: "text/xml" });
      const itemsGT = Array.from(domGT.window.document.querySelectorAll("item")).map(item => {
        const title = item.querySelector("title")?.textContent || "";
        // Fix: Use localName to find tags with namespaces like 'ht:news_item_snippet'
        const getNodes = (tagName) => Array.from(item.childNodes).filter(n => n.localName === tagName);
        const snippets = getNodes("news_item_snippet").map(s => s.textContent.replace(/<[^>]*>?/gm, "").trim());
        const news = getNodes("news_item_title").map(t => t.textContent);
        return { title, snippets, news };
      });

      const unique = [];
      const seen = new Set();
      const rawTitles = [...itemsPortal, ...itemsGT.map(i => i.title)];
      for (let title of rawTitles) {
        if (!seen.has(title.toLowerCase())) {
          seen.add(title.toLowerCase());
          const gtData = itemsGT.find(i => i.title === title) || { snippets: [], news: [] };
          unique.push({ originalTitle: title, snippets: gtData.snippets, newsTitles: gtData.news, translations: {}, aiReports: {} });
        }
        if (unique.length >= 10) break;
      }

      // 2. Reuse or Generate/Refine AI Report
      for (let item of unique) {
        const prevItem = previousItems.find(p => p.originalTitle === item.originalTitle);
        const existingReports = prevItem ? prevItem.aiReports : null;
        
        // Smart Check: Reuse ONLY if news content is identical AND report exists
        const isNewsSame = prevItem && JSON.stringify(item.newsTitles) === JSON.stringify(prevItem.newsTitles);
        const hasValidReport = existingReports && existingReports.ko && !this.isFallback(existingReports.ko);

        if (isNewsSame && hasValidReport) {
          item.aiReports = existingReports;
        } else {
          // Generate NEW or Update changed content
          console.log(`  - ${prevItem ? 'Updating' : 'Generating'} report for: ${item.originalTitle}`);
          const baseReport = await this.generateBaseAIReport(item, item.newsTitles, item.snippets, code);
          if (baseReport) {
            item.aiReports.ko = baseReport;
            // Clear other languages to force re-translation for the new context
            langs.filter(l => l !== 'ko').forEach(l => item.aiReports[l] = "");
            await new Promise(r => setTimeout(r, 2000)); // Rate limiting
          } else if (hasValidReport) {
            // Fallback to old report if new generation fails but old one exists
            item.aiReports = existingReports;
          }
        }
      }

      // 3. Batch Translate missing items
      for (let lang of langs) {
        // Translate titles with Hybrid Logic (Google -> Gemini Fallback)
        const toTranslateTitles = unique.filter(i => !i.translations[lang] || this.containsWrongScript(i.translations[lang], lang)).map(i => i.originalTitle);
        if (toTranslateTitles.length > 0) {
          // Attempt 1: Google Translate (Free)
          let translatedTitles = await this.translateBatch(toTranslateTitles, lang);
          
          // Identify failures (items that still contain source script)
          const failedIndices = [];
          translatedTitles.forEach((t, idx) => {
            if (this.containsWrongScript(t, lang)) failedIndices.push(idx);
          });

          // Attempt 2: Gemini Fallback for failures
          if (failedIndices.length > 0) {
            console.log(`  - Gemini fallback translation for ${failedIndices.length} items in ${lang}`);
            const failedTitles = failedIndices.map(idx => toTranslateTitles[idx]);
            const geminiResults = await this.translateWithGemini(failedTitles, lang);
            if (geminiResults.length === failedTitles.length) {
              failedIndices.forEach((idx, gIdx) => { translatedTitles[idx] = geminiResults[gIdx]; });
            }
          }

          unique.filter(i => !i.translations[lang] || this.containsWrongScript(i.translations[lang], lang)).forEach((item, idx) => { 
            item.translations[lang] = (translatedTitles && translatedTitles[idx]) ? translatedTitles[idx] : item.originalTitle; 
          });
        }

        // Translate reports (only those that are empty or were cleared due to content change)
        const toTranslateReports = unique.filter(i => i.aiReports.ko && (!i.aiReports[lang] || this.isFallback(i.aiReports[lang], lang))).map(i => i.aiReports.ko);
        if (toTranslateReports.length > 0) {
          const translatedReports = await this.translateBatch(toTranslateReports, lang);
          unique.filter(i => i.aiReports.ko && (!i.aiReports[lang] || this.isFallback(i.aiReports[lang], lang))).forEach((item, idx) => { 
            if (translatedReports && translatedReports[idx]) {
              item.aiReports[lang] = translatedReports[idx];
            } else if (!item.aiReports[lang]) {
              item.aiReports[lang] = this.getFallbackReport(item.originalTitle, lang, code);
            }
          });
        }
      }

      // 4. Final Sanity Check: Ensure all keys exist to prevent frontend failures
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
  console.log("Real-time refined trend update cycle completed.");
});
