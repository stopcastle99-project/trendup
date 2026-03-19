import { GoogleGenerativeAI } from "@google/generative-ai";
import 'dotenv/config';

async function listModels() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  try {
    // There is no direct listModels in the generative-ai SDK for Node.js in some versions
    // We try to test common aliases
    const models = [
      "gemini-2.5-flash",
      "gemini-2.5-flash-8b",
      "gemini-1.5-pro",
      "gemini-2.0-flash-exp"
    ];
    
    for (const m of models) {
      try {
        const model = genAI.getGenerativeModel({ model: m });
        const result = await model.generateContent("hi");
        console.log(`✅ Model ${m} is WORKING!`);
      } catch (e) {
        console.log(`❌ Model ${m} failed: ${e.message.substring(0, 100)}`);
      }
    }
  } catch (e) {
    console.error("Fatal:", e);
  }
}

listModels();
