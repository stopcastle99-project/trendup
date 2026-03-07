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
  console.log("🚀 Starting Gemini AI Report Test (Forced v1 API)...");
  const models = ["models/gemini-1.5-flash", "models/gemini-1.5-pro", "models/gemini-2.0-flash"];
  
  const prompt = "대한민국 트렌드 '뉴진스'에 대해 한국어로 1문장 요약해줘.";

  for (const modelName of models) {
    try {
      console.log(`Testing model: ${modelName} via API v1...`);
      // Use explicit model ID path for v1
      const model = genAI.getGenerativeModel({ model: modelName }, { apiVersion: 'v1' });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();
      
      if (text) {
        console.log(`✅ SUCCESS with [${modelName}]!`);
        console.log("Response:", text);
        return;
      }
    } catch (error) {
      console.error(`❌ Failed with [${modelName}]:`, error.message.substring(0, 100));
    }
  }
}

testGeminiReport();
