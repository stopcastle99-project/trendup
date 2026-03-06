
import { GoogleGenerativeAI } from "@google/generative-ai";

async function testGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is missing!");
    return;
  }
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  
  const prompt = "Translate: 'Apple' into Korean.";
  
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    console.log("Gemini Response:", response.text());
  } catch (e) {
    console.error("Gemini API Error:", e.message);
  }
}

testGemini();
