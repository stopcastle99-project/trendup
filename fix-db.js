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

async function fixJapaneseReports() {
  const countries = ['KR', 'JP', 'US'];
  
  for (const code of countries) {
    console.log(`Fixing DB data for ${code}...`);
    const docRef = db.collection('trends').doc(code);
    const doc = await docRef.get();
    
    if (!doc.exists) continue;
    
    const data = doc.data();
    let isChanged = false;
    
    const updatedItems = data.items.map(item => {
      if (item.aiReports && item.aiReports.ja) {
        let original = item.aiReports.ja;
        let corrected = original
          .replace(/일본/g, '日本')
          .replace(/대한민국/g, '韓国')
          .replace(/미국/g, 'アメリカ')
          .replace(/이\(가\)/g, '')
          .replace(/가 /g, 'が ')
          .replace(/내에서/g, '国内で');
        
        if (original !== corrected) {
          console.log(`  - Corrected [${item.originalTitle}] in 'ja' report.`);
          item.aiReports.ja = corrected;
          isChanged = true;
        }
      }
      return item;
    });

    if (isChanged) {
      await docRef.update({ items: updatedItems });
      console.log(`  => Successfully updated ${code} document.`);
    } else {
      console.log(`  => No changes needed for ${code}.`);
    }
  }
  
  console.log("Database cleanup completed.");
  process.exit(0);
}

fixJapaneseReports();
