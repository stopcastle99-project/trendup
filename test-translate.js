
async function testTranslate() {
  const texts = ["Apple", "Banana", "Cherry"];
  const targetLang = "ko";
  
  const translateSingle = async (text, tl) => {
    try {
      const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`);
      const data = await res.json();
      return data[0].map(x => x[0]).join("").trim();
    } catch (e) { 
      console.error(`Single translate failed for ${text}:`, e.message);
      return text; 
    }
  };

  try {
    const separator = " ||| ";
    const combinedText = texts.join(separator);
    console.log("Requesting batch translation for:", combinedText);
    
    const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(combinedText)}`);
    const data = await res.json();
    console.log("Raw response data[0]:", JSON.stringify(data[0]));
    
    const results = data[0].map(x => x[0]).join("").split(/\|\|\||\| \| \|/).map(s => s.trim());
    console.log("Parsed results:", results);
    
    if (results.length === texts.length) {
      console.log("Batch translation SUCCESS");
    } else {
      console.log("Batch translation length mismatch, falling back to single...");
      const finalResults = await Promise.all(texts.map(t => translateSingle(t, targetLang)));
      console.log("Final results (single):", finalResults);
    }
  } catch (e) {
    console.error("Batch translate failed:", e.message);
    const finalResults = await Promise.all(texts.map(t => translateSingle(t, targetLang)));
    console.log("Final results (fallback single):", finalResults);
  }
}

testTranslate();
