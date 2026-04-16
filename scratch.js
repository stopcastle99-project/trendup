import { GoogleGenerativeAI } from "@google/generative-ai";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "dummy");

const SUMMARIZER_MODELS = [
  "models/gemini-2.5-flash",
  "models/gemini-3-flash-preview",
  "models/gemma-4-31b-it",
];

async function run() {
  const targetLangName = "Japanese";
  const chunk = ["Apple", "Tesla", "Software Engineer"];
  const prompt = `You are a strict translation API. Translate the provided list of texts into ${targetLangName}.
CRITICAL RULES:
1. You MUST return ONLY a valid JSON array of strings containing the translations, in the exact same order.
2. DO NOT output any markdown blocks (\`\`\`json) or extra conversational text.
3. If the input has ${chunk.length} strings, the output MUST be a JSON array with exactly ${chunk.length} translated strings.

INPUT JSON ARRAY:
${JSON.stringify(chunk)}`;

  for (const m of SUMMARIZER_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: m });
      const result = await model.generateContent({
         contents: [{ role: "user", parts: [{ text: prompt }] }],
         generationConfig: { responseMimeType: "application/json" }
      });
      console.log(`Model: ${m}`);
      console.log(`RawText:`, result.response.text());
break;
    } catch (e) {
      console.error(e.message);
    }
  }
}
run();
