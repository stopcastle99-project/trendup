import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

async function runSurgicalTest() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ API KEY MISSING");
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  // 구글 공식 문서에서 현재 가장 권장하는 모델 ID들입니다.
  const testModels = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"];

  console.log("🛠️  STRICT INTERNAL TESTING START...");

  for (const m of testModels) {
    try {
      console.log(`- Testing [${m}]...`);
      const model = genAI.getGenerativeModel({ model: m });
      const result = await model.generateContent("Hello, say 'OK'");
      const text = result.response.text().trim();
      
      if (text) {
        console.log(`✅ SUCCESS! Model [${m}] responded: ${text}`);
        process.exit(0); // 하나라도 성공하면 즉시 종료
      }
    } catch (e) {
      console.log(`❌ [${m}] FAILED: ${e.message.substring(0, 100)}`);
    }
  }
  console.log("⚠️ ALL MODELS FAILED IN THIS TEST.");
}

runSurgicalTest();
