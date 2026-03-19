import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

async function verify() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  try {
    const result = await model.generateContent("Hello, respond with 'SUCCESS'");
    console.log("🔥 REAL VERIFICATION RESULT:", result.response.text());
  } catch (e) {
    console.error("❌ STILL FAILING:", e.message);
  }
}
verify();
