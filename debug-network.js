import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

async function checkApiKey() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.log("❌ NO API KEY FOUND");
    return;
  }
  // 안전하게 앞뒤 4자리만 출력하여 확인
  console.log(`🔑 API Key starts with: ${key.substring(0, 4)}... and ends with: ${key.substring(key.length - 4)}`);
  
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    const data = await res.json();
    if (data.models) {
      console.log("✅ Network OK! Available Models found:", data.models.length);
      console.log("First model:", data.models[0].name);
    } else {
      console.log("❌ API responded but no models found. Error:", JSON.stringify(data));
    }
  } catch (e) {
    console.log("❌ Network Connection Failed:", e.message);
  }
}

checkApiKey();
