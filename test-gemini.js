import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

async function testGemini() {
  // 접두사 models/ 를 포함한 완전한 경로로 시도
  const modelsToTry = [
    "gemini-2.5-flash",
    "models/gemini-2.5-flash",
    "models/gemini-1.5-pro",
    "models/gemini-pro"
  ];
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  
  for (const modelName of modelsToTry) {
    try {
      console.log(`Trying explicit model path: ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent("Say 'I am here'.");
      const response = await result.response;
      console.log(`SUCCESS with ${modelName}! Response:`, response.text().trim());
      process.exit(0);
    } catch (e) {
      console.warn(`Model ${modelName} failed:`, e.message);
    }
  }
  process.exit(1);
}
testGemini();
