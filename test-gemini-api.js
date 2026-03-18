
import { GoogleGenerativeAI } from "@google/generative-ai";

async function testGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is missing!");
    return;
  }
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const models = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
  
  for (const modelName of models) {
    console.log(`Testing model: ${modelName}...`);
    const model = genAI.getGenerativeModel({ model: modelName });
    const prompt = "Translate: 'Apple' into Korean.";
    
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      console.log(`[${modelName}] Success:`, response.text().trim());
    } catch (e) {
      console.error(`[${modelName}] Error:`, e.message);
    }
  }
}

testGemini();
