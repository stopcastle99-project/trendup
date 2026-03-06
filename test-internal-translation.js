
import fetch from 'node-fetch';

async function translateBatch(texts, targetLang) {
  if (!texts || texts.length === 0) return [];
  
  const translateSingle = async (text, tl) => {
    try {
      const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`);
      const data = await res.json();
      return data[0].map(x => x[0]).join("").trim();
    } catch (e) { return text; }
  };

  try {
    const separator = " ||| ";
    const combinedText = texts.join(separator);
    console.log(`[Test] Requesting Batch (${targetLang}): ${texts.slice(0, 3).join(', ')}...`);
    
    const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(combinedText)}`);
    const data = await res.json();
    const results = data[0].map(x => x[0]).join("").split(/\|\|\||\| \| \|/).map(s => s.trim());
    
    if (results.length === texts.length) {
      return results;
    } else {
      console.warn("[Test] Batch length mismatch, falling back to single translation.");
      return await Promise.all(texts.map(t => translateSingle(t, targetLang)));
    }
  } catch (e) {
    console.error("[Test] Batch failed, falling back to single:", e.message);
    return await Promise.all(texts.map(t => translateSingle(t, targetLang)));
  }
}

async function runInternalTest() {
  const testCases = [
    { 
      titles: ["Apple Vision Pro", "Bitcoin All-time High", "NewJeans Hype Boy"], 
      target: "ko",
      label: "English to Korean"
    },
    { 
      titles: ["大谷翔平 ホームラン", "任天堂 スイッチ 2", "東京ディズニーランド"], 
      target: "ko",
      label: "Japanese to Korean"
    },
    { 
      titles: ["손흥민 멀티골", "삼성 갤럭시 S24 울트라", "벚꽃 축제"], 
      target: "ja",
      label: "Korean to Japanese"
    }
  ];

  console.log("=== Internal Title Translation Test Start ===\n");

  for (const test of testCases) {
    console.log(`>> Testing: ${test.label}`);
    const results = await translateBatch(test.titles, test.target);
    test.titles.forEach((orig, i) => {
      console.log(`   - [Original]   : ${orig}`);
      console.log(`   - [Translated] : ${results[i]}`);
    });
    console.log("");
  }
  
  console.log("=== Internal Title Translation Test Finished ===");
}

runInternalTest();
