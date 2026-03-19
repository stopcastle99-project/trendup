import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
  try {
    // API에서 직접 리스트를 가져오는 대신, 현재 라이브러리에서 가장 확실한 모델명을 테스트
    const modelsToTest = [
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite-preview-02-05",
      "gemini-2.5-flash-002",
      "gemini-1.5-pro-002"
    ];

    for (const name of modelsToTest) {
      try {
        const model = genAI.getGenerativeModel({ model: name });
        const result = await model.generateContent("Hello");
        console.log(`✅ Success with model: ${name}`);
        process.exit(0);
      } catch (e) {
        console.log(`❌ Failed with model: ${name} - ${e.message}`);
      }
    }
  } catch (error) {
    console.error("List Models failed:", error);
  }
}

listModels();
