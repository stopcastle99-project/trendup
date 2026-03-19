
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

async function initMetadata() {
  const metaRef = db.collection("trends").doc("metadata");
  const now = new Date();
  const resetTimeUTC = new Date(now);
  resetTimeUTC.setUTCHours(7, 0, 0, 0); 
  if (now < resetTimeUTC) resetTimeUTC.setUTCDate(resetTimeUTC.getUTCDate() - 1);
  const resetDateStr = resetTimeUTC.toISOString().split('T')[0];

  try {
    const doc = await metaRef.get();
    if (!doc.exists) {
      console.log("Creating initial metadata document...");
      await metaRef.set({ gemini_count: 0, gemini_last_reset: resetDateStr });
    } else {
      console.log("Metadata already exists:", doc.data());
    }
  } catch (e) {
    console.error("Error:", e.message);
  }
}

initMetadata().then(() => process.exit(0));
