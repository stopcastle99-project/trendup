
async function getSupplementaryNews(keyword, countryCode) {
  const hl = countryCode === "KR" ? "ko" : countryCode === "JP" ? "ja" : "en";
  const gl = countryCode;
  const query = `${keyword}${ { 'KR': ' 뉴스', 'JP': ' ニュース', 'US': ' News' }[countryCode] || ' News'}`;
  console.log(`Querying: ${query} (hl: ${hl}, gl: ${gl})`);
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${hl}&gl=${gl}&ceid=${gl}:${hl}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      }
    });
    const text = await res.text();
    console.log(`Response length: ${text.length}`);
    
    // Simple regex parsing for <item>
    const items = [];
    const itemRegex = /<item>(.*?)<\/item>/gs;
    let match;
    while ((match = itemRegex.exec(text)) !== null && items.length < 3) {
      const content = match[1];
      const title = content.match(/<title>(.*?)<\/title>/)?.[1] || "";
      const link = content.match(/<link>(.*?)<\/link>/)?.[1] || "";
      items.push({ 
        title: title.split(" - ")[0], 
        url: link, 
        source: title.split(" - ").pop() || "News" 
      });
    }
    return items;
  } catch (e) { 
    console.error("Error fetching news:", e);
    return []; 
  }
}

async function test() {
  const keywords = ["삼성전자", "iPhone 16", "大谷翔平"];
  const countries = ["KR", "US", "JP"];

  for (let i = 0; i < keywords.length; i++) {
    console.log(`--- Testing ${keywords[i]} (${countries[i]}) ---`);
    const news = await getSupplementaryNews(keywords[i], countries[i]);
    console.log(JSON.stringify(news, null, 2));
  }
}

test();
