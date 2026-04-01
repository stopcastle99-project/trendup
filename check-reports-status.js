import admin from "firebase-admin";

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: "test-76cdd" });
} else {
  admin.initializeApp({ projectId: "test-76cdd" });
}

const db = admin.firestore();

async function checkReports() {
  const countries = ["KR", "JP", "US"];
  const types = ["weekly", "monthly", "yearly"];

  console.log("--- Report Aggregation Status ---");
  for (const type of types) {
    for (const country of countries) {
      try {
        const doc = await db.collection("reports").doc(type).collection(country).doc("latest").get();
        if (doc.exists) {
          const data = doc.data();
          console.log(`[${type}] [${country}] Status: ${data.isAggregating ? "WRITING (Aggregating)" : "COMPLETED"} | DateRange: ${data.dateRange}`);
        } else {
          console.log(`[${type}] [${country}] NO LATEST DOC FOUND`);
        }
      } catch (e) {
        console.error(`Error checking ${type} for ${country}:`, e.message);
      }
    }
  }
}

checkReports().then(() => process.exit(0));
