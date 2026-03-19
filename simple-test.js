import { GoogleGenerativeAI } from "@google/generative-ai";
import 'dotenv/config';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function test() {
  const modelName = "gemini-1.5-flash";
  console.log(`Testing with model: ${modelName}`);
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent("Hello, are you there?");
    console.log("Response:", (await result.response).text());
  } catch (e) {
    console.error("Error:", e.message);
  }
}

test();
