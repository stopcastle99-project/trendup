
import admin from "firebase-admin";

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} else {
  admin.initializeApp();
}

const db = admin.firestore();

async function checkUsage() {
  console.log("🔍 Checking Gemini usage data in Firestore...");
  try {
    const doc = await db.collection("stats").doc("gemini_usage").get();
    if (doc.exists) {
      console.log("✅ Data Found:");
      console.log(JSON.stringify(doc.data(), null, 2));
    } else {
      console.log("❌ Document 'stats/gemini_usage' does not exist.");
    }
  } catch (e) {
    console.error("❌ Error reading Firestore:", e.message);
  }
  process.exit(0);
}

checkUsage();
