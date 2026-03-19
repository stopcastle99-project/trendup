
import admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

async function listDocs() {
  try {
    const snap = await db.collection("trends").get();
    console.log(`--- Found ${snap.size} documents in 'trends' collection ---`);
    snap.forEach(doc => {
      console.log(`- ID: ${doc.id}, data keys: ${Object.keys(doc.data())}`);
      if (doc.id === 'metadata') {
        console.log("  Content:", JSON.stringify(doc.data(), null, 2));
      }
    });
  } catch (e) {
    console.error("Error listing documents:", e.message);
  }
}

listDocs().then(() => process.exit(0));
