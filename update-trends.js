
import admin from "firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} else {
  admin.initializeApp();
}

const db = admin.firestore();
console.log("====================================================");
console.log(">>> CRITICAL: RUNNING UPDATE SCRIPT v3.7.1 <<<");
console.log(">>> TARGET: Gemini-3.1-Pro-Peak / Gemma-4-Pure (Daily) <<<");
console.log("====================================================");

// 2026 Next-Gen Pro AI Architecture (v3.7.1)
const SUMMARIZER_MODELS = [
  "models/gemma-4-26b-a4b-it",
  "models/gemma-4-31b-it"
];
const REPORT_MODELS = [
  "models/gemini-3.1-pro-preview",
  "models/gemma-3-27b-it",        // Gemma 3 added for reasoning    // Peak Reasoning
  "models/gemini-3-flash-preview",     // Next-Gen Speed/Quality
  "models/gemini-2.5-pro",            // Stable High-Perf
  "models/gemini-2.5-flash",
  "models/gemini-2.5-flash-lite",
  "models/gemini-2.0-pro-exp"         // Safety Fallback (2.0)
];

class TrendUpdater {
  constructor() {
    this.genAI = null;
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) this.genAI = new GoogleGenerativeAI(apiKey);
  }

  extractJSON(text) {
    if (!text) return null;
    try {
      const arrayMatch = text.match(/\[[\s\S]*\]/);
      if (arrayMatch) return JSON.parse(arrayMatch[0]);
      const objectMatch = text.match(/\{[\s\S]*\}/);
      if (objectMatch) return JSON.parse(objectMatch[0]);
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  }

  async translateBatch(texts, targetLang) {
    if (!texts || texts.length === 0) return [];
    if (!this.genAI) return texts;

    const langNames = { ko: 'Korean', en: 'English', ja: 'Japanese' };
    const targetLangName = langNames[targetLang] || targetLang;

    // Chunking to respect model limits
    const chunks = [];
    for (let i = 0; i < texts.length; i += 10) {
      chunks.push(texts.slice(i, i + 10));
    }

    let allResults = [];
    for (const chunk of chunks) {
      const prompt = `Translate this JSON array of strings into ${targetLangName}. 
Maintain original formatting and order. Return ONLY the resulting JSON array of strings.
Input: ${JSON.stringify(chunk)}`;

      let chunkResult = null;
      for (const m of SUMMARIZER_MODELS) {
        try {
          const model = this.genAI.getGenerativeModel({ model: m });
          const result = await model.generateContent(prompt);
          const rawText = result.response.text();
          const parsed = this.extractJSON(rawText);
          if (Array.isArray(parsed)) {
            chunkResult = parsed;
            break;
          }
        } catch (e) {
          console.warn(`  - Gemma Translation Fallback: ${m} failed (${e.message}). Trying next...`);
        }
      }

      if (chunkResult) {
        allResults = allResults.concat(chunkResult);
      } else {
        console.warn("  - All Gemma Translation models failed for chunk.");
        allResults = allResults.concat(chunk);
      }
    }
    return allResults;
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

    const prompt = `당신은 글로벌 검색어 트렌드 분석 전문가입니다. 현재 ${countryName}에서 화제가 되고 있는 아래의 '트렌드 키워드 리스트'와 각 '키워드별 관련 뉴스 제목들'을 바탕으로, 각 키워드가 왜 트렌드인지 단 3문장 내외의 한국어로 명료하게 요약해주세요. 
절대로 중간에 내용을 생략하거나 '...', '***' 등 상징적인 기호를 사용하여 요약을 대체하지 마세요. 모든 리스트에 대해 완전한 JSON 데이터를 작성해야 합니다.

반드시 아래의 JSON 배열 형식으로만 응답해야 하며, JSON 외의 다른 부연 설명은 절대 덧붙이지 마세요.
[
  { "keyword": "키워드1", "summary": "요약 내용..." },
  { "keyword": "키워드2", "summary": "요약 내용..." }
]

분석할 키워드 리스트:
${itemsToProcess.map(i => {
      const rssNews = i.newsTitles.slice(0, 2).join(' / ');
      const extraNews = (i.supplementaryNews || []).join(' / ');
      return `- 키워드: ${i.originalTitle}\n  관련 기사: ${rssNews}${extraNews ? ' / ' + extraNews : ''}`;
    }).join('\n\n')}
`;

    try {
      let text = "";
      let usedModel = "";
      const modelsToTry = SUMMARIZER_MODELS;

      for (const m of modelsToTry) {
        try {
          const model = this.genAI.getGenerativeModel({ model: m });
          const result = await model.generateContent(prompt);
          const response = await result.response;
          let rawText = response.text().trim();

          // Pre-parse Scrub: Remove invalid AI shorthands
          text = rawText.replace(/,\s*\.\.\.\s*\]/g, "]").replace(/\.\.\.\s*\}/g, "}").replace(/\*\*\*/g, "").replace(/json/g, "").trim();

          usedModel = m;
          break;
        } catch (err) {
          console.log(`  - Model fallback: ${m} failed (${err.message}). Trying next...`);
        }
      }

      if (!text) {
        throw new Error("All AI models failed to generate content.");
      }

      // Robust JSON Extraction (Heal conversational prefix/suffix)
      let jsonContent = text.trim();

      // Try to find the first block that looks like JSON array or object
      const startBracket = text.indexOf('[');
      const startBrace = text.indexOf('{');
      const firstStart = (startBracket !== -1 && (startBrace === -1 || startBracket < startBrace)) ? startBracket : startBrace;

      if (firstStart !== -1) {
        const lastBracket = text.lastIndexOf(']');
        const lastBrace = text.lastIndexOf('}');
        const lastEnd = Math.max(lastBracket, lastBrace);
        if (lastEnd > firstStart) {
          jsonContent = text.substring(firstStart, lastEnd + 1).trim();
        }
      }

      let parsed = null;
      try {
        parsed = JSON.parse(jsonContent);
      } catch (parseErr) {
        // Self-healing: progressively trim from the end until valid JSON is found
        let tempContent = jsonContent.trim();
        let healed = false;
        while (tempContent.length > 2) {
          try {
            parsed = JSON.parse(tempContent);
            healed = true;
            break;
          } catch (e) {
            const lastBracketIdx = tempContent.lastIndexOf(']');
            const lastBraceIdx = tempContent.lastIndexOf('}');
            const lastIdx = Math.max(lastBracketIdx, lastBraceIdx);

            if (lastIdx === -1) break;
            if (lastIdx === tempContent.length - 1) {
              tempContent = tempContent.slice(0, -1).trim();
            } else {
              tempContent = tempContent.substring(0, lastIdx + 1).trim();
            }
          }
        }
        if (healed) {
          console.log(`  - [HEALED] AI JSON parse succeeded after cleaning trailing characters.`);
        }
      }

      if (!parsed) throw new Error("Failed to parse AI response even after self-healing.");

      console.log(`  - AI Batch Success: ${usedModel} processed ${itemsToProcess.length} items`);

      // Only increment Firestore counter if we used an actual Gemini model (not Gemma)
      if (usedModel.toLowerCase().includes("gemini")) {
        await this.incrementGeminiUsage();
      }

      const reportMap = {};
      const itemsToIterate = Array.isArray(parsed) ? parsed : (parsed.items || []);
      itemsToIterate.forEach(p => { if (p.keyword) reportMap[p.keyword] = p.summary; });
      return reportMap;
    } catch (e) {
      console.error(`🚨 [v3.6.0 ERROR] AI Batch Error for ${country}:`, e.message);
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
    const query = `${keyword}${{ 'KR': ' 뉴스', 'JP': ' ニュース', 'US': ' News' }[countryCode] || ' News'}`;
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

    // Trends by query
    [...new Set(allTrends)].slice(0, 50).forEach(kw => {
      s += `  <url><loc>${baseUrl}/?q=${encodeURIComponent(kw)}</loc><lastmod>${lastMod}</lastmod><priority>0.8</priority></url>\n`;
    });

    // Trend Reports (Static Pre-rendered Pages)
    const reportDir = "public/report";
    if (fs.existsSync(reportDir)) {
      const slugs = fs.readdirSync(reportDir).filter(f => fs.statSync(path.join(reportDir, f)).isDirectory());
      slugs.forEach(slug => {
        s += `  <url><loc>${baseUrl}/report/${slug}/</loc><lastmod>${lastMod}</lastmod><priority>0.9</priority></url>\n`;
      });
    }

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
      let indexHtml = fs.readFileSync("index.html", "utf8");
      const match = indexHtml.match(/v(\d+)\.(\d+)\.(\d+)/);
      if (match) {
        const currentVerInt = parseInt(match[3]);
        const newVerInt = currentVerInt + 1;
        const newVer = `v${match[1]}.${match[2]}.${newVerInt}`;

        indexHtml = indexHtml.replace(/v(\d+)\.(\d+)\.(\d+)/g, newVer);

        // Update physical JS file reference for aggressive Cloudflare cachebusting
        indexHtml = indexHtml.replace(`main_v${currentVerInt}.js`, `main_v${newVerInt}.js`);

        fs.writeFileSync("index.html", indexHtml);
        fs.writeFileSync("public/index.html", indexHtml);

        // Sync main assets and create a physically unique JS file
        const jsCode = fs.readFileSync("main.js", "utf8");
        fs.writeFileSync("public/main.js", jsCode);
        fs.writeFileSync(`public/main_v${newVerInt}.js`, jsCode);
        fs.writeFileSync(`main_v${newVerInt}.js`, jsCode); // Also Sync to Root for local Dev

        // Clean up old physically unique JS files
        try { fs.unlinkSync(`public/main_v${currentVerInt}.js`); } catch (e) { }
        try { fs.unlinkSync(`main_v${currentVerInt}.js`); } catch (e) { } // Also clean in Root

        fs.writeFileSync("public/style.css", fs.readFileSync("style.css", "utf8"));
        return newVer;
      }
    } catch (e) {
      console.error("Failed to bump version", e);
    }
    return "v3.5.0";
  }


  async archiveHistory(items, country) {
    const today = new Date().toISOString().split('T')[0];
    const historyRef = db.collection("trend_history").doc(`${country}_${today}`);

    try {
      await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(historyRef);
        const existingData = (doc.exists && doc.data()) ? doc.data().keywords || {} : {};

        items.forEach((item, index) => {
          const keyword = item.originalTitle || item.title;
          const rank = index + 1;
          const current = (existingData && existingData[keyword]) ? existingData[keyword] : { count: 0, bestRank: 99, totalRankScore: 0 };

          current.count += 1;
          if (rank < current.bestRank) current.bestRank = rank;
          current.totalRankScore += (11 - rank); // 1st = 10pts, 10th = 1pt

          existingData[keyword] = current;
        });

        transaction.set(historyRef, { keywords: existingData, lastUpdated: admin.firestore.Timestamp.now() }, { merge: true });
      });
      console.log(`  - History archived for ${country} (${today})`);
    } catch (e) {
      console.error(`  - Error archiving history for ${country}:`, e.message);
    }
  }

  async aggregateReports(country, force = false) {
    const forceArg = force || process.argv.includes("--force-reports") || process.argv.includes("--force-weekly");
    const now = new Date();
    const kst = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    const y = kst.getUTCFullYear();
    const m = kst.getUTCMonth() + 1;
    const d = kst.getUTCDate();
    const currentWeekChunk = (d <= 7) ? 1 : (d <= 14) ? 2 : (d <= 21) ? 3 : 4;
    const weeklyTarget = (currentWeekChunk === 1) ? 8 : (currentWeekChunk === 2) ? 15 : (currentWeekChunk === 3) ? 22 : 1;

    // Status Logic Helpers
    const getStatusSuffix = (currentDay, targetDay) => {
      // If targetDay is in next month (1st), we need to check last day of current month
      let daysLeft;
      if (targetDay === 1) {
        const lastDay = new Date(y, m, 0).getDate();
        daysLeft = lastDay - currentDay + 1;
      } else {
        daysLeft = targetDay - currentDay;
      }
      return (daysLeft <= 2) ? "작성중" : "데이터집계중";
    };

    // 1. Archival Boundaries (Perform Archiving FIRST)
    const isWk1End = (d === 8);
    const isWk2End = (d === 15);
    const isWk3End = (d === 22);
    const isLastDayOfMonth = new Date(y, m, 0).getDate() === d;
    const isDaily = process.argv.includes('--daily');
    const isWeekly = process.argv.includes('--weekly');
    const isMonthly = process.argv.includes('--monthly');
    const isYearly = process.argv.includes('--yearly');
    const forceAll = force || process.argv.includes('--force-all');

    // 1. Archival Boundaries (Perform Archiving FIRST)
    // v3.4.32: Sunday-only compatibility (d === target logic replaced with ranges)
    if (isWeekly || forceAll) {
      const isWk1End = (d >= 8 && d <= 14);
      const isWk2End = (d >= 15 && d <= 21);
      const isWk3End = (d >= 22);
      const isWk4End = (d <= 7); // Covers previous month week 4 archive during first Sunday of new month

      let archStart, archEnd, archSlug, archLabel;
      if (isWk1End || (forceAll && currentWeekChunk === 1)) {
        archStart = `${y}-${String(m).padStart(2, '0')}-01`; archEnd = `${y}-${String(m).padStart(2, '0')}-07`; archSlug = `${y}-${String(m).padStart(2, '0')}-week1`; archLabel = `${y}년 ${m}월 1주차 리포트`;
      } else if (isWk2End || (forceAll && currentWeekChunk === 2)) {
        archStart = `${y}-${String(m).padStart(2, '0')}-08`; archEnd = `${y}-${String(m).padStart(2, '0')}-14`; archSlug = `${y}-${String(m).padStart(2, '0')}-week2`; archLabel = `${y}년 ${m}월 2주차 리포트`;
      } else if (isWk3End || (forceAll && currentWeekChunk === 3)) {
        archStart = `${y}-${String(m).padStart(2, '0')}-15`; archEnd = `${y}-${String(m).padStart(2, '0')}-21`; archSlug = `${y}-${String(m).padStart(2, '0')}-week3`; archLabel = `${y}년 ${m}월 3주차 리포트`;
      } else if (isWk4End || (forceAll && currentWeekChunk === 4)) {
        // Find previous month info
        const prevM = m === 1 ? 12 : m - 1;
        const prevY = m === 1 ? y - 1 : y;
        const lastDay = new Date(prevY, prevM, 0).getDate();
        archStart = `${prevY}-${String(prevM).padStart(2, '0')}-22`;
        archEnd = `${prevY}-${String(prevM).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        archSlug = `${prevY}-${String(prevM).padStart(2, '0')}-week4`;
        archLabel = `${prevY}년 ${prevM}월 4주차 리포트`;
      }
      if (archStart) await this.generatePeriodReport(country, 'weekly', archStart, archEnd, true, archSlug, archLabel, forceArg);
    }

    if (isMonthly || forceAll) {
      let archStart, archEnd, archSlug, archLabel;
      if (d === 1) {
        const prevM = m === 1 ? 12 : m - 1;
        const prevY = m === 1 ? y - 1 : y;
        const lastDay = new Date(prevY, prevM, 0).getDate();
        archStart = `${prevY}-${String(prevM).padStart(2, '0')}-01`;
        archEnd = `${prevY}-${String(prevM).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        archSlug = `${prevY}-${String(prevM).padStart(2, '0')}-monthly`;
        archLabel = `${prevY}년 ${prevM}월 리포트`;
      } else if (isLastDayOfMonth) {
        archStart = `${y}-${String(m).padStart(2, '0')}-01`;
        archEnd = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        archSlug = `${y}-${String(m).padStart(2, '0')}-monthly`;
        archLabel = `${y}년 ${m}월 리포트`;
      }
      if (archStart) await this.generatePeriodReport(country, 'monthly', archStart, archEnd, true, archSlug, archLabel, forceArg);
    }

    if (isYearly || (forceAll && d === 1 && m === 1)) {
      const prevY = y - 1;
      const archStart = `${prevY}-01-01`;
      const archEnd = `${prevY}-12-31`;
      const archSlug = `${prevY}-yearly`;
      const archLabel = `${prevY}년 리포트`;
      await this.generatePeriodReport(country, 'yearly', archStart, archEnd, true, archSlug, archLabel, forceArg);
    }

    // 2. Generate Latest Drafts (Live Aggregation - Daily Update Only)
    const kstDay = kst.getUTCDay(); // 0:Sun, 3:Wed, 4:Thu
    const isTransitionDay = (kstDay === 3 || kstDay === 4);

    // v3.7.6 Smart Sync: If we just performed a FORCED archival run (forceArg) on a transition day,
    // skip the 'Aggregating' draft generation to keep the finalized report visible on the dashboard.
    const skipDraftSync = forceArg && isTransitionDay && (isWeekly || isMonthly || isYearly);

    if ((isDaily || isWeekly || isMonthly || isYearly || forceAll) && !skipDraftSync) {
      const weeklyStartDay = currentWeekChunk === 1 ? 1 : currentWeekChunk === 2 ? 8 : currentWeekChunk === 3 ? 15 : 22;
      const weeklyStart = `${y}-${String(m).padStart(2, '0')}-${String(weeklyStartDay).padStart(2, '0')}`;
      const todayStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const monthlyStart = `${y}-${String(m).padStart(2, '0')}-01`;
      const yearlyStart = `${y}-01-01`;

      const wkStatus = getStatusSuffix(d, weeklyTarget);
      const moStatus = getStatusSuffix(d, 1);
      const yrStatus = (m === 12 && d >= 29) ? "작성중" : "데이터집계중";

      const wkEndDay = (currentWeekChunk === 1) ? 7 : (currentWeekChunk === 2) ? 14 : (currentWeekChunk === 3) ? 21 : new Date(y, m, 0).getDate();
      const moEndDay = new Date(y, m, 0).getDate();

      const wkLabel = `${m}월 ${currentWeekChunk}주차 (${String(m).padStart(2, '0')}.${String(weeklyStartDay).padStart(2, '0')} ~ ${String(m).padStart(2, '0')}.${String(wkEndDay).padStart(2, '0')}) ${wkStatus}`;
      const moLabel = `${m}월 리포트 (${String(m).padStart(2, '0')}.01 ~ ${String(m).padStart(2, '0')}.${String(moEndDay).padStart(2, '0')}) ${moStatus}`;
      const yrLabel = `${y}년 리포트 (${y}.01.01 ~ 12.31) ${yrStatus}`;

      await this.generatePeriodReport(country, 'weekly', weeklyStart, todayStr, false, '', wkLabel, forceArg);
      await this.generatePeriodReport(country, 'monthly', monthlyStart, todayStr, false, '', moLabel, forceArg);
      await this.generatePeriodReport(country, 'yearly', yearlyStart, `${y}-12-31`, false, '', yrLabel, forceArg);
    }
  }

  async generateAIReportAnalysis(topItems, country, type, label, newsContext = []) {
    if (!this.genAI) throw new Error("GEMINI_API_KEY NOT FOUND");

    const keywordsWithNews = topItems.map((t, i) => {
      const news = newsContext.find(n => n.keyword === t.keyword);
      const newsInfo = news ? `\n  - 관련 뉴스: ${news.newsTitles.join(' / ')}` : "";
      return `${i + 1}위. ${t.keyword}${newsInfo}`;
    }).join("\n\n");

    const prompt = `당신은 글로벌 트렌드 분석 전문가입니다. 아래 ${country}의 ${label} 트렌드 키워드 5개를 분석하여 리포트를 작성하세요. 모든 키워드에 대해 균등하게 심층적인 분석을 제공해야 합니다.

[작성 규칙 (공통)]
- 순수 JSON 포맷으로만 응답하세요 (마크다운 텍스트 백틱 제외).
- 한국어(ko), 영어(en), 일본어(ja) 번역본을 반드시 모두 작성해야 합니다.
- 사람에게 설명하듯 자연스럽게 작성. 중복 표현 및 기계적인 느낌 제거.
- 각 항목은 제목을 붙여 구분하고, 문단 사이에는 빈 줄(Double Newline)을 넣어 가독성을 극대화하세요. 불필요한 기호(마크다운 # 등) 사용 자제.
- 절대로 문장 시작 부분에 공백(Space)이나 탭(Tab)을 넣어 들여쓰기를 하지 마세요. 모든 문장은 왼쪽 끝에서 시작해야 합니다.

==================================
[분석 요청 사항]
대상 키워드 및 관련 뉴스 리스트:
${keywordsWithNews}

아래 [구성]을 모든 키워드에 대해 반드시 지켜주세요 (제공된 관련 뉴스 내용을 참고하여 왜 이 트렌드가 뜨는지 심층 분석하세요. 만약 일본(ja) 등 특정 지역의 뉴스 데이터가 부족하더라도 키워드 자체의 의미와 사회적 맥락을 고려하여 반드시 풍부한 문장으로 요약과 분석을 작성해야 합니다.):
1. 한줄 요약 (왜 이 트렌드가 뜨는지 핵심 한줄)
2. 트렌드 분석 (최근 상황 및 사회/문화적 배경 설명)
3. 핵심 인사이트 (3가지 포인트를 bullet으로 정리)

==================================
반드시 아래 JSON 형식으로만 문자열을 출력하세요:
{
  "reportTitle": {
    "ko": "사람이 쓴 듯한 매력적인 리포트 한국어 제목",
    "en": "Human-like engaging English title",
    "ja": "人間らしい魅力的な日本語タイトル"
  },
  "leadSummary": {
    "ko": "전체 분석을 관통하는 도입부 요약 (3~4문장)",
    "en": "...",
    "ja": "..."
  },
  "analyses": [
    { 
      "keyword": "키워드 (예: Apple)", 
      "depth": {
        "ko": "1. 한줄 요약\\n...\\n\\n2. 트렌드 분석\\n...\\n\\n3. 핵심 인사이트\\n- 포인트1\\n- 포인트2\\n- 포인트3",
        "en": "...",
        "ja": "..."
      }
    }
  ]
}
`;

    const modelsToTry = REPORT_MODELS;
    let text = "";
    let usedModel = "";

    // Helper for sleep to avoid 429 Rate Limits
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    try {
      for (const m of modelsToTry) {
        try {
          console.log(`  - Trying AI analysis with ${m}...`);
          const model = this.genAI.getGenerativeModel({ model: m });
          const result = await model.generateContent(prompt);
          text = result.response.text().replace(/\u0060\u0060\u0060json|\u0060\u0060\u0060/g, "").trim();
          usedModel = m;

          if (text) break;
        } catch (err) {
          console.warn(`  - Model ${m} failed: ${err.message}. Retrying in 5s with next model...`);
          await sleep(5000); // 5 second cool-down
        }
      }

      if (!text) throw new Error("All Gemini models exhausted or blocked.");

      const parsed = JSON.parse(text);
      console.log(`  - AI Report Success: ${usedModel} analyzed ${country} ${type} report.`);
      await this.incrementGeminiUsage();
      return parsed;
    } catch (e) {
      console.error(`🚨 Critical AI Analysis failure for ${type} ${country}:`, e.message);
      return {
        reportTitle: { ko: `${label}`, en: `${label}`, ja: `${label}` },
        analyses: top5.map(t => ({ keyword: t.keyword, depth: { ko: "현재 AI 분석 서버가 매우 정체되어 있습니다. 잠시 후 다시 시도해 주십시오.", en: "AI analysis server is congested. Please try again later.", ja: "AI分析サーバーが混雑しています。後で再試行してください。" } }))
      };
    }
  }

  toSlug(text) {
    if (!text) return "report";
    let slug = text.trim().toLowerCase()
      .replace(/[^가-힣a-z0-9]/gi, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    return slug || "report";
  }

  // Phase 1: Ranking Engine (계층형 랭킹 추출)
  async extractRanking(country, type, startDate, endDate, slug) {
    if (!slug) return [];
    const db = admin.firestore();
    const rankingsRef = db.collection('rankings').doc(type).collection(country).doc(slug);
    const doc = await rankingsRef.get();

    if (doc.exists && doc.data().top10 && doc.data().top10.length > 0) {
      console.log(`  -> [RANKING HIT] Found existing ${type} ranking for ${slug}`);
      return doc.data().top10;
    }

    console.log(`  -> [RANKING COMPUTE] Calculating ${type} ranking for ${slug}`);
    let globalScores = {};

    if (type === 'weekly') {
      const historyCol = db.collection("trend_history");
      const snapshot = await historyCol.get();
      snapshot.forEach(hdoc => {
        const parts = hdoc.id.split('_');
        if (parts.length < 2) return;
        const docDate = parts[1];
        if (hdoc.id.startsWith(country) && docDate >= startDate && docDate <= endDate) {
          const kws = hdoc.data().keywords || {};
          for (const [kw, stats] of Object.entries(kws)) {
            if (!globalScores[kw]) globalScores[kw] = { score: 0 };
            globalScores[kw].score += (stats.totalRankScore || 0);
          }
        }
      });
    } else if (type === 'monthly') {
      // 월간 테이블은 오직 주간 테이블만 분석
      const weeklyCol = db.collection('rankings').doc('weekly').collection(country);
      const snapshot = await weeklyCol.get();
      const yStr = startDate.substring(0, 4);
      const mStr = startDate.substring(5, 7);
      const targetPrefix = `${yStr}-${mStr}-week`;

      snapshot.forEach(wdoc => {
        if (wdoc.id.startsWith(targetPrefix)) {
          const t10 = wdoc.data().top10 || wdoc.data().top5 || [];
          for (const item of t10) {
            if (!globalScores[item.keyword]) globalScores[item.keyword] = { score: 0 };
            globalScores[item.keyword].score += item.score;
          }
        }
      });
    } else if (type === 'yearly') {
      // 년간 테이블은 오직 월간 테이블만 분석
      const monthlyCol = db.collection('rankings').doc('monthly').collection(country);
      const snapshot = await monthlyCol.get();
      const yStr = startDate.substring(0, 4);
      const targetSuffix = `-monthly`;

      snapshot.forEach(mdoc => {
        if (mdoc.id.startsWith(yStr) && mdoc.id.endsWith(targetSuffix)) {
          const t10 = mdoc.data().top10 || mdoc.data().top5 || [];
          for (const item of t10) {
            if (!globalScores[item.keyword]) globalScores[item.keyword] = { score: 0 };
            globalScores[item.keyword].score += item.score;
          }
        }
      });
    }

    const top10 = Object.entries(globalScores)
      .map(([keyword, data]) => ({ keyword, score: data.score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    if (top10.length > 0) {
      await rankingsRef.set({ type, country, startDate, endDate, slug, top10, lastUpdated: admin.firestore.Timestamp.now() });
    }
    return top10;
  }

  // 실시간 랭킹 (초안용)
  async getLiveDraftRanking(country, startDate, endDate) {
    const db = admin.firestore();
    const historyCol = db.collection("trend_history");
    const snapshot = await historyCol.get();
    let globalScores = {};
    snapshot.forEach(hdoc => {
      const parts = hdoc.id.split('_');
      if (parts.length < 2) return;
      const docDate = parts[1];
      if (hdoc.id.startsWith(country) && docDate >= startDate && docDate <= endDate) {
        const kws = hdoc.data().keywords || {};
        for (const [kw, stats] of Object.entries(kws)) {
          if (!globalScores[kw]) globalScores[kw] = { score: 0 };
          globalScores[kw].score += (stats.totalRankScore || 0);
        }
      }
    });
    return Object.entries(globalScores).map(([keyword, data]) => ({ keyword, score: data.score })).sort((a, b) => b.score - a.score).slice(0, 10);
  }

  // Phase 2: Reporting Engine
  async generatePeriodReport(country, type, startDate, endDate, isArchival, slugIdentifier, label, force = false) {
    const db = admin.firestore();
    const latestDocRef = db.collection("reports").doc(type).collection(country).doc("latest");
    const reportSlug = slugIdentifier || `${startDate.replace(/-/g, '')}_${endDate.replace(/-/g, '')}_${type}`;

    // 1. SMART LOCKDOWN:
    if (isArchival && reportSlug) {
      const archDoc = await db.collection('reports').doc(type).collection(country).doc(reportSlug).get();
      if (archDoc.exists && archDoc.data().isAggregating === false) {
        const archData = archDoc.data();
        const contentStr = JSON.stringify(archData.leadSummary || {});
        const isCorrupted = contentStr.includes('정체되어') || contentStr.includes('집계 중입니다') || contentStr.includes('발행됩니다');

        if (!isCorrupted && !force) {
          console.log(`  - [STABLE ARCHIVE] ${type} for ${reportSlug} is already finalized. Syncing to latest.`);
          await latestDocRef.set({ ...archData, lastUpdated: admin.firestore.Timestamp.now() });
          return;
        } else {
          console.log(`  - [HEAL] ${type} for ${reportSlug} contains placeholders. Triggering RE-ANALYSIS.`);
        }
      }
    }

    // 2. Draft Flagging
    await latestDocRef.set({
      type, country, dateRange: label, isAggregating: true,
      lastUpdated: admin.firestore.Timestamp.now()
    }, { merge: true });

    let top5 = [];
    try {
      // NEW: 2-Tier Ranking Fetch
      if (isArchival && reportSlug) {
        const fullRanking = await this.extractRanking(country, type, startDate, endDate, reportSlug);
        top5 = fullRanking.slice(0, 5);
      } else {
        // Live Draft: Still Top 10 for visibility, or match Archival?
        // User Vision: Archival uses Rank 1-5.
        const fullRanking = await this.getLiveDraftRanking(country, startDate, endDate);
        top5 = fullRanking.slice(0, 5);
      }

      if (top5.length === 0) {
        await latestDocRef.set({ isAggregating: false }, { merge: true });
        return;
      }

      let analysis = null;

      if (isArchival) {
        console.log(`  - Fetching latest news for periodic analysis (${type} ${country})...`);
        const newsContext = await Promise.all(top5.map(async (t) => {
          const news = await this.getSupplementaryNews(t.keyword, country);
          return { keyword: t.keyword, newsTitles: news.map(n => n.title) };
        }));

        console.log(`  - Generating ARCHIVAL AI Analysis with news context...`);
        analysis = await this.generateAIReportAnalysis(top5, country, type, label, newsContext);
      } else {
        analysis = {
          reportTitle: { ko: `${label} (실시간 집계)`, en: `${label} (Live)`, ja: `${label} (ライブ)` },
          leadSummary: { ko: "현재 가장 뜨거운 트렌드 키워드들을 실시간으로 집계한 결과입니다.", en: "Live aggregation of top trending keywords.", ja: "現在のトレンドキーワードをリアルタイムで集계한結果です。" },
          analyses: top5.map(t => ({ keyword: t.keyword, depth: { ko: "현재 데이터 집계 중입니다. 정식 리포트는 마감일에 발행됩니다.", en: "Aggregating data...", ja: "集計中..." } }))
        };
      }

      const reportData = {
        type, country,
        startDate, endDate, // v3.4.0: Store raw dates for precise UI display
        dateRange: label,
        slug: reportSlug,
        isAggregating: !isArchival, // Draft is true, Archival is false
        reportTitle: analysis.reportTitle,
        leadSummary: analysis.leadSummary || null,
        keywords: top5.map(t => t.keyword),
        items: await Promise.all(top5.map(async (t, i) => {
          const extra = analysis.analyses.find(a => a.keyword === t.keyword) || { depth: { ko: "내용 없음", en: "No content", ja: "内容なし" } };
          return {
            keyword: t.keyword, score: t.score, rank: i + 1, depth: extra.depth,
            newsLinks: await this.getSupplementaryNews(t.keyword, country),
            videoLinks: await this.getYouTubeVideos(t.keyword, country)
          };
        })),
        lastUpdated: admin.firestore.Timestamp.now()
      };

      if (isArchival) {
        await db.collection("reports").doc(type).collection(country).doc(reportSlug).set(reportData);
      }

      await latestDocRef.set(reportData);
      console.log(`  - ${type.toUpperCase()} report ${isArchival ? 'archived' : 'updated'}: ${reportSlug}`);

    } catch (e) {
      console.error(`Error generating ${type} report for ${country}:`, e.message);
      await latestDocRef.set({ isAggregating: false, lastUpdated: admin.firestore.Timestamp.now() }, { merge: true });
    }
  }

  async healExistingReports() {
    console.log(">>> HEALING EXISTING 2026 REPORTS (v3.4.2) <<<");

    let countries = ["KR", "JP", "US"];
    const countryArg = process.argv.find(arg => arg.startsWith('--country='));
    if (countryArg) {
      const target = countryArg.split('=')[1].toUpperCase();
      if (countries.includes(target)) {
        countries = [target];
        console.log(`>>> Filtering for single country: ${target} <<<`);
      }
    }

    const types = ["weekly", "monthly", "yearly"];

    for (const code of countries) {
      for (const type of types) {
        const colRef = db.collection("reports").doc(type).collection(code);
        const snap = await colRef.get();

        for (const docSnap of snap.docs) {
          const id = docSnap.id;
          if (id === 'latest') continue;

          let update = {};
          // ID Pattern: 2026-03-week1
          if (id.startsWith('2026-03-week')) {
            const w = id.split('week')[1];
            if (w === '1') update = { startDate: "2026-03-01", endDate: "2026-03-08" };
            else if (w === '2') update = { startDate: "2026-03-09", endDate: "2026-03-15" };
            else if (w === '3') update = { startDate: "2026-03-16", endDate: "2026-03-22" };
            else if (w === '4') update = { startDate: "2026-03-23", endDate: "2026-03-31" };
          } else if (id === '2026-03-monthly') {
            update = { startDate: "2026-03-01", endDate: "2026-03-31" };
          } else if (id === '2026-yearly') {
            update = { startDate: "2026-01-01", endDate: "2026-12-31" };
          }

          if (Object.keys(update).length > 0) {
            await docSnap.ref.update(update);
            console.log(`  - Healed ${type}/${code}/${id}: ${update.startDate} ~ ${update.endDate}`);
          }
        }
      }
    }
  }

  async updateAll() {
    await this.healExistingReports(); // v3.4.2 Migration

    let countries = ["KR", "JP", "US"];
    const countryArg = process.argv.find(arg => arg.startsWith('--country='));
    if (countryArg) {
      const target = countryArg.split('=')[1].toUpperCase();
      if (countries.includes(target)) {
        countries = [target];
        console.log(`>>> Filtering for single country: ${target} <<<`);
      }
    }

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
        console.log(`  - Fetching supplementary news for ${itemsToProcess.length} keywords in ${code}...`);
        await Promise.all(itemsToProcess.map(async (item) => {
          // Token Optimization: Limit to top 2 news titles
          const extra = await this.getSupplementaryNews(item.originalTitle, code);
          item.supplementaryNews = extra.slice(0, 2).map(n => n.title);
        }));
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

      // NEW: Archive and Aggregate
      await this.archiveHistory(items, code);
      const forceReports = process.argv.includes('--force-reports');
      await this.aggregateReports(code, forceReports);
    }
    this.generateSitemap(allKeywords);
    this.generateRSS(allKeywords);
    const ver = this.bumpVersion();
    console.log(`Data crawling complete. Version bumped to ${ver}`);
    process.exit(0);
  }
  async runReportOnly() {
    await this.healExistingReports(); // v3.4.2 Migration
    console.log(">>> RUNNING IN REPORT-ONLY MODE (NO CRAWLING) <<<");

    let countries = ["KR", "JP", "US"];
    const countryArg = process.argv.find(arg => arg.startsWith('--country='));
    if (countryArg) {
      const target = countryArg.split('=')[1].toUpperCase();
      if (countries.includes(target)) {
        countries = [target];
        console.log(`>>> Filtering for single country: ${target} <<<`);
      }
    }

    const forceReports = process.argv.includes('--force-reports');
    const forceWeekly = process.argv.includes('--force-weekly');

    for (const code of countries) {
      await this.aggregateReports(code, forceReports || forceWeekly);
    }
    console.log("Periodic report aggregation complete.");
    process.exit(0);
  }
}

const updater = new TrendUpdater();
if (process.argv.includes('--daily')) {
  updater.updateAll();
} else if (process.argv.includes('--weekly') || process.argv.includes('--monthly') || process.argv.includes('--yearly')) {
  updater.runReportOnly();
} else if (process.argv.includes('--force-reports') || process.argv.includes('--force-weekly')) {
  updater.runReportOnly();
} else {
  // Default: Run as Daily for safety if no flag (backward compatibility)
  updater.updateAll();
}
