import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("❌ GEMINI_API_KEY is not set in environment variables.");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function testGeminiReport() {
  console.log("🚀 Starting Gemini AI Report Test...");
  
  const testKeyword = "뉴진스";
  const testNewsTitles = [
    "뉴진스, 새로운 미니 앨범 발표 및 월드 투어 일정 공개",
    "빌보드 차트 휩쓴 뉴진스, 글로벌 영향력 입증",
    "뉴진스 멤버들의 최근 패션 화보 화제"
  ];
  const testSnippets = [
    "뉴진스가 오늘 오전 기자회견을 통해 새로운 프로젝트 소식을 전했습니다.",
    "팬들의 기대감이 고조되는 가운데 실시간 검색어 1위에 올랐습니다."
  ];

  const countryName = "대한민국";
  const context = [...testNewsTitles, ...testSnippets].join(' / ');
  
  const prompt = `키워드: '${testKeyword}' (${countryName})\n뉴스: ${context}\n\n위 정보를 바탕으로 이 키워드가 왜 현재 트렌드인지 한국어로 2문장 요약해줘.`;

  console.log(`- Prompt: ${prompt.substring(0, 50)}...`);

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();
    
    if (text) {
      console.log("✅ Success! Gemini AI Response:");
      console.log("-----------------------------------------");
      console.log(text);
      console.log("-----------------------------------------");
    } else {
      console.error("❌ Received empty response from Gemini AI.");
    }
  } catch (error) {
    console.error("❌ Gemini AI Test failed:", error.message);
  }
}

testGeminiReport();
