import { GoogleGenerativeAI } from "@google/generative-ai";

const TEST_MODEL = "models/gemma-4-31b-it";
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("🚨 [ERROR] GEMINI_API_KEY 환경 변수가 설정되어 있지 않습니다.");
    process.exit(1);
}

async function runSimpleTest() {
    console.log(`\n🔍 Gemma 4 (${TEST_MODEL}) 연결 테스트 시작...`);
    const genAI = new GoogleGenerativeAI(apiKey);
    
    try {
        const model = genAI.getGenerativeModel({ model: TEST_MODEL });
        const prompt = "안녕, 너는 누구니? 주간/월간 트렌드 리포트 작성이 가능해? 간단하게 대답해줘.";
        
        console.log(`💬 질문: "${prompt}"`);
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        console.log("\n====================================================");
        console.log("✅ [SUCCESS] Gemma 4 응답 내용:");
        console.log("----------------------------------------------------");
        console.log(text);
        console.log("====================================================\n");
    } catch (err) {
        console.error("\n❌ [FAILURE] Gemma 4 연결 중 오류 발생:");
        console.error(err.message);
        if (err.message.includes("404")) {
            console.warn("💡 [TIP] 모델 ID를 'models/gemma-4-26b-a4b-it'로 변경하여 다시 시도해 보세요.");
        }
    }
}

runSimpleTest();
