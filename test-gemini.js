import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

async function testGemini() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent("Hello, are you working? Answer in one short sentence.");
    const response = await result.response;
    console.log("Gemini Response:", response.text().trim());
    process.exit(0);
  } catch (e) {
    console.error("Gemini Test Failed:", e.message);
    process.exit(1);
  }
}
testGemini();

