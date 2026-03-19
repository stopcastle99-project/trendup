
import 'dotenv/config';
import admin from 'firebase-admin';

const rawSecret = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!rawSecret) {
  console.error("FIREBASE_SERVICE_ACCOUNT is missing.");
  process.exit(1);
}
const serviceAccount = JSON.parse(rawSecret.trim());

try {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} catch (e) {
  console.error("Firebase init failed:", e.message);
  process.exit(1);
}

const db = admin.firestore();

async function checkMetadata() {
  try {
    const metaRef = db.collection("trends").doc("metadata");
    const doc = await metaRef.get();
    if (doc.exists) {
      console.log("--- Metadata Found in 'trends/metadata' ---");
      console.log(JSON.stringify(doc.data(), null, 2));
    } else {
      console.log("--- Metadata Not Found in 'trends/metadata' ---");
      const statsRef = db.collection("stats").doc("gemini_usage");
      const statsDoc = await statsRef.get();
      if (statsDoc.exists) {
        console.log("--- Metadata Found in 'stats/gemini_usage' ---");
        console.log(JSON.stringify(statsDoc.data(), null, 2));
      } else {
        console.log("--- No Metadata Found ---");
      }
    }
  } catch (e) {
    console.error("Error:", e.message);
  }
}

checkMetadata().then(() => process.exit(0));
