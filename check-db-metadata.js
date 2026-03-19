
import admin from "firebase-admin";

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} else {
  admin.initializeApp();
}

const db = admin.firestore();

async function checkMetadata() {
  try {
    const metaRef = db.collection("trends").doc("metadata");
    const doc = await metaRef.get();
    if (doc.exists) {
      console.log("--- Metadata Found ---");
      console.log(JSON.stringify(doc.data(), null, 2));
    } else {
      console.log("--- Metadata Not Found in 'trends/metadata' ---");
      
      // Try alternative path if it was moved
      const altRef = db.collection("stats").doc("gemini_usage");
      const altDoc = await altRef.get();
      if (altDoc.exists) {
        console.log("--- Metadata Found in 'stats/gemini_usage' ---");
        console.log(JSON.stringify(altDoc.data(), null, 2));
      } else {
        console.log("--- No Metadata Found Anywhere ---");
      }
    }
  } catch (e) {
    console.error("Error checking metadata:", e.message);
  }
}

checkMetadata().then(() => process.exit(0));
