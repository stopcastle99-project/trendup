import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

async function testGemini() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // 404를 피하기 위해 'latest' 키워드가 포함된 공식 모델명 사용
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    
    console.log("Testing Gemini with model: gemini-flash-latest...");
    const result = await model.generateContent("Hello! Are you working now? Answer in one short Korean sentence.");
    const response = await result.response;
    console.log("Gemini Response:", response.text().trim());
    process.exit(0);
  } catch (e) {
    console.error("Gemini Test Failed:", e.message);
    process.exit(1);
  }
}
testGemini();
