
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
console.log(">>> CRITICAL: RUNNING UPDATE SCRIPT v3.1.15 <<<");
console.log(">>> TARGET MODEL: Gemini 2.0 (Fallback: Gemma) <<<");
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
        try { fs.unlinkSync(`public/main_v${currentVerInt}.js`); } catch(e){}
        try { fs.unlinkSync(`main_v${currentVerInt}.js`); } catch(e){} // Also clean in Root
        
        fs.writeFileSync("public/style.css", fs.readFileSync("style.css", "utf8"));
        return newVer;
      }
    } catch (e) {
      console.error("Failed to bump version", e);
    }
    return "v3.1.50";
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
    const now = new Date();
    const kst = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    const y = kst.getUTCFullYear();
    const m = kst.getUTCMonth() + 1;
    const d = kst.getUTCDate();
    
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

    // 1. Generate Latest Drafts (Currently Aggregating)
    const currentWeekChunk = (d <= 7) ? 1 : (d <= 14) ? 2 : (d <= 21) ? 3 : 4;
    const weeklyTarget = (currentWeekChunk === 1) ? 8 : (currentWeekChunk === 2) ? 15 : (currentWeekChunk === 3) ? 22 : 1;
    
    const weeklyStartDay = currentWeekChunk === 1 ? 1 : currentWeekChunk === 2 ? 8 : currentWeekChunk === 3 ? 15 : 22;
    const weeklyStart = `${y}-${String(m).padStart(2, '0')}-${String(weeklyStartDay).padStart(2, '0')}`;
    const todayStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const monthlyStart = `${y}-${String(m).padStart(2, '0')}-01`;
    const yearlyStart = `${y}-01-01`;

    const wkStatus = getStatusSuffix(d, weeklyTarget);
    const moStatus = getStatusSuffix(d, 1);
    const yrStatus = (m === 12 && d >= 29) ? "작성중" : "데이터집계중";

    const wkLabel = `${m}월 ${currentWeekChunk}주차 (${String(m).padStart(2, '0')}.${String(weeklyStartDay).padStart(2, '0')} ~ ${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')}) ${wkStatus}`;
    const moLabel = `${m}월 리포트 (${String(m).padStart(2, '0')}.01 ~ ${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')}) ${moStatus}`;
    const yrLabel = `${y}년 리포트 (${y}.01.01 ~ 12.31) ${yrStatus}`;

    await this.generatePeriodReport(country, 'weekly', weeklyStart, todayStr, false, '', wkLabel);
    await this.generatePeriodReport(country, 'monthly', monthlyStart, todayStr, false, '', moLabel);
    await this.generatePeriodReport(country, 'yearly', yearlyStart, todayStr, false, '', yrLabel);

    // 2. Archival Boundaries
    const isWk1End = (d === 8);
    const isWk2End = (d === 15);
    const isWk3End = (d === 22);
    const isWk4End = (d === 1); // 1st of month
    const forceWeekly = force || process.argv.includes('--force-weekly');

    if (forceWeekly || isWk1End || isWk2End || isWk3End || d === 31 || isWk4End) {
      let archStart, archEnd, archSlug, archLabel;
      if (isWk1End || (forceWeekly && currentWeekChunk === 1)) {
        archStart = `${y}-${String(m).padStart(2, '0')}-01`; archEnd = `${y}-${String(m).padStart(2, '0')}-07`; archSlug = `${y}-${String(m).padStart(2, '0')}-week1`; archLabel = `${y}년 ${m}월 1주차 리포트`;
      } else if (isWk2End || (forceWeekly && currentWeekChunk === 2)) {
        archStart = `${y}-${String(m).padStart(2, '0')}-08`; archEnd = `${y}-${String(m).padStart(2, '0')}-14`; archSlug = `${y}-${String(m).padStart(2, '0')}-week2`; archLabel = `${y}년 ${m}월 2주차 리포트`;
      } else if (isWk3End || (forceWeekly && currentWeekChunk === 3)) {
        archStart = `${y}-${String(m).padStart(2, '0')}-15`; archEnd = `${y}-${String(m).padStart(2, '0')}-21`; archSlug = `${y}-${String(m).padStart(2, '0')}-week3`; archLabel = `${y}년 ${m}월 3주차 리포트`;
      } else if (isWk4End || d === 31 || (forceWeekly && currentWeekChunk === 4)) {
        archStart = `${y}-${String(m).padStart(2, '0')}-22`; 
        archEnd = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; 
        archSlug = `${y}-${String(m).padStart(2, '0')}-week4`; 
        archLabel = `${y}년 ${m}월 4주차 리포트`;
      }
      if (archStart) await this.generatePeriodReport(country, 'weekly', archStart, archEnd, true, archSlug, archLabel);
    }
    
    const forceOther = force || process.argv.includes('--force-reports');
    if (forceOther || d === 1) {
      const prevM = m === 1 ? 12 : m - 1;
      const prevY = m === 1 ? y - 1 : y;
      const lastDay = new Date(prevY, prevM, 0).getDate();
      const archStart = `${prevY}-${String(prevM).padStart(2, '0')}-01`;
      const archEnd = `${prevY}-${String(prevM).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      const archSlug = `${prevY}-${String(prevM).padStart(2, '0')}-monthly`;
      const archLabel = `${prevY}년 ${prevM}월 리포트`;
      await this.generatePeriodReport(country, 'monthly', archStart, archEnd, true, archSlug, archLabel);
    }
    
    if (forceOther || (d === 1 && m === 1)) {
      const prevY = y - 1;
      const archStart = `${prevY}-01-01`;
      const archEnd = `${prevY}-12-31`;
      const archSlug = `${prevY}-yearly`;
      const archLabel = `${prevY}년 리포트`;
      await this.generatePeriodReport(country, 'yearly', archStart, archEnd, true, archSlug, archLabel);
    }
  }

  async generateAIReportAnalysis(top5, country, type, label) {
    if (!this.genAI) throw new Error("GEMINI_API_KEY NOT FOUND");
    
    // Split keywords into Rank 1-2 and Rank 3-5
    const rank1_2 = top5.slice(0, 2).map((t, i) => `${i+1}위. ${t.keyword}`).join("\n");
    const rank3_5 = top5.slice(2, 5).map((t, i) => `${i+3}위. ${t.keyword}`).join("\n");
    
    const prompt = `당신은 글로벌 트렌드 분석 전문가입니다. 아래 ${country}의 ${label} 트렌드 키워드를 분석하여 리포트를 작성하세요. 최고 순위(1~2위)와 하위 순위(3~5위)에 따라 분석 깊이를 다르게 작성해야 합니다.

[작성 규칙 (공통)]
- 순수 JSON 포맷으로만 응답하세요 (마크다운 텍스트 백틱 제외).
- 한국어(ko), 영어(en), 일본어(ja) 번역본을 반드시 모두 작성해야 합니다.
- 사람에게 설명하듯 자연스럽게 작성. 중복 표현 및 기계적인 느낌 제거.
- 각 항목은 제목을 붙여 구분하고, 가독성 좋게 줄바꿈을 하세요. 불필요한 기호(마크다운 # 등) 사용 자제.

==================================
[랭크 1위, 2위 집중 심층 분석 요청]
대상 키워드:
${rank1_2}

아래 [구성] 5가지를 반드시 지켜주세요 (단순 나열 금지, 반드시 이유와 해석 포함, 한 언어당 최소 500자 이상 구체적 서술):
1. 한줄 요약 (왜 이 트렌드가 뜨는지 핵심 한줄)
2. 핵심 포인트 3개 (짧게 bullet)
3. 트렌드 개요 (최근 상황 설명)
4. 왜 뜨는지 (가장 중요, 2~3가지 사회/문화/경제적 이유를 설명)
5. 결론 (앞으로 전망 + 한줄 정리)

==================================
[랭크 3위, 4위, 5위 간략 분석 요청]
대상 키워드:
${rank3_5}

아래 [구성] 2가지를 반드시 지켜주세요 (단순 나열 금지, 해석/이유 포함, 핵심 위주 짧은 문단):
1. 한줄 요약 (왜 이 트렌드가 뜨는지 핵심 한줄)
2. 핵심 포인트 3개 (짧게 bullet)

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
      "keyword": "키워드 1 (예: Apple)", 
      "depth": {
        "ko": "1. 한줄 요약\\n...\\n\\n2. 핵심 포인트 3개\\n... (요구된 구성 및 분량에 맞게 텍스트 작성)",
        "en": "...",
        "ja": "..."
      }
    }
  ]
}
`;

    const modelsToTry = ["gemini-2.0-flash", "gemini-1.5-flash-latest", "gemini-1.5-pro"];
    let text = "";
    let usedModel = "";

    try {
      for (const m of modelsToTry) {
        try {
          const model = this.genAI.getGenerativeModel({ model: m });
          const result = await model.generateContent(prompt);
          text = result.response.text().replace(/\u0060\u0060\u0060json|\u0060\u0060\u0060/g, "").trim();
          usedModel = m;
          break;
        } catch (err) {
          console.warn(`  - Report Analysis Fallback: ${m} failed. Trying next...`);
        }
      }

      if (!text) throw new Error("All models failed for report analysis");
      
      const parsed = JSON.parse(text);
      console.log(`  - AI Report Success: ${usedModel} analyzed ${country} ${type} report.`);
      await this.incrementGeminiUsage();
      return parsed;
    } catch (e) {
      console.error(`🚨 AI Analysis failed for ${type} ${country}:`, e.message);
      return { 
        reportTitle: { ko: `${label}`, en: `${label}`, ja: `${label}` },
        analyses: top5.map(t => ({ keyword: t.keyword, depth: { ko: "현재 집계 중이거나 분석 오류가 발생했습니다.", en: "Aggregating...", ja: "集計中..." } }))
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

  async generatePeriodReport(country, type, startDate, endDate, isArchival, slugIdentifier, label) {
    const historyCol = db.collection("trend_history");
    
    // Draft (Latest) doesn't use AI yet to save cost, it just sets the aggregating flag.
    if (!isArchival) {
      const latestData = {
        type, country, dateRange: label, slug: 'latest', isAggregating: true, 
        reportTitle: { ko: `${label} 집계중...`, en: `${label} (Aggregating)`, ja: `${label} 集計中...` },
        items: [],
        lastUpdated: admin.firestore.Timestamp.now()
      };
      await db.collection("reports").doc(type).collection(country).doc("latest").set(latestData);
      return;
    }
    
    try {
      const snapshot = await historyCol.get();
      if (snapshot.empty) return;
      
      const globalScores = {};
      snapshot.forEach(doc => {
        const parts = doc.id.split('_');
        if (parts.length < 2) return;
        const docDate = parts[1];
        if (doc.id.startsWith(country) && docDate >= startDate && docDate <= endDate) {
          const kws = doc.data().keywords || {};
          for (const [kw, stats] of Object.entries(kws)) {
            if (!globalScores[kw]) globalScores[kw] = { score: 0 };
            globalScores[kw].score += (stats.totalRankScore || 0);
          }
        }
      });

      const top5 = Object.entries(globalScores)
        .map(([keyword, data]) => ({ keyword, score: data.score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      if (top5.length > 0) {
        console.log(`  - Generating AI Analysis for ${type} ${country} (${startDate} to ${endDate})...`);
        const analysis = await this.generateAIReportAnalysis(top5, country, type, label);
        
        const top1Slug = this.toSlug(top5[0].keyword);
        const reportSlug = `${slugIdentifier}-${top1Slug}`;
        
        const reportData = {
          type, country,
          dateRange: label,
          slug: reportSlug,
          isAggregating: false,
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

        await db.collection("reports").doc(type).collection(country).doc(reportSlug).set(reportData);
        console.log(`  - ${type.toUpperCase()} archival report snapshot created: ${reportSlug}`);
      }
    } catch (e) {
      console.error(`Error generating ${type} report for ${country}:`, e.message);
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
    console.log(">>> RUNNING IN REPORT-ONLY MODE (NO CRAWLING) <<<");
    const countries = ["KR", "JP", "US"];
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
if (process.argv.includes('--force-reports') || process.argv.includes('--force-weekly')) {
  updater.runReportOnly();
} else {
  updater.updateAll();
}
