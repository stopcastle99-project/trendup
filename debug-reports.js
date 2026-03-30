
import admin from "firebase-admin";

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} else {
  admin.initializeApp();
}

const db = admin.firestore();

async function check() {
  const countries = ["KR", "JP", "US"];
  const types = ["weekly", "monthly", "yearly"];
  
  for (const type of types) {
    for (const country of countries) {
      console.log(`\n--- ${type} / ${country} ---`);
      const snap = await db.collection("reports").doc(type).collection(country).get();
      snap.forEach(doc => {
        console.log(`Doc ID: ${doc.id}`);
        console.log(`DateRange: ${doc.data().dateRange}, Slug: ${doc.data().slug}`);
      });
    }
  }
  process.exit(0);
}

check();
