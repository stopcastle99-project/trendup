
async function translateBatch(texts, targetLang) {
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
    console.log("Combined Result:", combinedResult);
    const results = combinedResult.split(/\s*\|[ |]*\|[ |]*\|\s*/).map(s => s.trim());
    return results.length === texts.length ? results : await Promise.all(texts.map(t => translateSingle(t, targetLang)));
  } catch (e) { return await Promise.all(texts.map(t => translateSingle(t, targetLang))); }
}

async function test() {
  const texts = ["방탄소년단", "이강인", "뉴진스"];
  console.log("Testing Batch Translation (KO -> JA)...");
  const results = await translateBatch(texts, "ja");
  console.log("Results:", results);
}
test();
