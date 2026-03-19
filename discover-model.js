import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

async function findWorkingModel() {
  console.log("🔍 Fetching available models...");
  try {
    // Note: The JS SDK doesn't have a direct listModels, so we test known aliases
    const commonNames = [
      "gemini-2.5-flash",
      "gemini-1.5-pro",
      "gemini-pro"
    ];

    for (const name of commonNames) {
      try {
        console.log(`Testing [${name}]...`);
        const model = genAI.getGenerativeModel({ model: name });
        const result = await model.generateContent("test");
        console.log(`✅ FOUND WORKING MODEL: ${name}`);
        return name;
      } catch (e) {
        console.log(`   - [${name}] failed: ${e.message.substring(0, 100)}`);
      }
    }
  } catch (error) {
    console.error("Discovery failed:", error);
  }
  return null;
}

findWorkingModel();
