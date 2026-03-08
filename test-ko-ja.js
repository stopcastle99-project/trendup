
async function testTranslate() {
  const texts = ["방탄소년단", "이강인", "뉴진스"];
  const targetLang = "ja";
  const translateSingle = async (text, tl) => {
    try {
      const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      const data = await res.json();
      return data[0].map(x => x[0]).join("").trim();
    } catch (e) { return text; }
  };
  
  console.log("Testing translation from Korean to Japanese...");
  for (const text of texts) {
    const result = await translateSingle(text, targetLang);
    console.log(`${text} -> ${result}`);
  }
}
testTranslate();
