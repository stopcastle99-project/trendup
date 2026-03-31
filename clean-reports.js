
import admin from "firebase-admin";

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} else {
  admin.initializeApp();
}

const db = admin.firestore();

async function deleteCollection(path) {
  const collectionRef = db.collection(path);
  const snapshot = await collectionRef.get();
  
  const batchSize = 100;
  if (snapshot.size === 0) return;

  const chunks = [];
  const docs = snapshot.docs;
  for (let i = 0; i < docs.length; i += batchSize) {
    chunks.push(docs.slice(i, i + batchSize));
  }

  for (const chunk of chunks) {
    const batch = db.batch();
    chunk.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
  console.log(`Deleted ${snapshot.size} docs from ${path}`);
}

async function cleanAll() {
  const types = ['weekly', 'monthly', 'yearly'];
  const countries = ['KR', 'JP', 'US'];

  for (const type of types) {
    for (const country of countries) {
      const path = `reports/${type}/${country}`;
      await deleteCollection(path);
    }
  }
  console.log("Cleanup complete.");
}

cleanAll().then(() => process.exit(0)).catch(err => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
