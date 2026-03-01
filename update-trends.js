import admin from 'firebase-admin';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

const rawSecret = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!rawSecret) process.exit(1);
const serviceAccount = JSON.parse(rawSecret.trim());

try {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} catch (e) { process.exit(1); }

const db = admin.firestore();

class TrendUpdater {
  async translateBatch(texts, targetLang) {
    if (!texts || texts.length === 0) return [];
    const translateSingle = async (text, tl) => {
      try {
        const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`);
        const data = await res.json();
        return data[0].map(x => x[0]).join("").trim();
      } catch (e) { return text; }
    };
    try {
      const combinedText = texts.join(" ||| ");
      const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(combinedText)}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const translated = data[0].map(x => x[0]).join("");
      const results = translated.split(/\|\|\||\| \| \|/).map(s => s.trim());
      return results.length === texts.length ? results : await Promise.all(texts.map(t => translateSingle(t, targetLang)));
    } catch (e) { return await Promise.all(texts.map(t => translateSingle(t, targetLang))); }
  }

  async getGoogleTrends(country) {
    try {
      const res = await fetch(`https://trends.google.com/trending/rss?geo=${country}`);
      const text = await res.text();
      const { window } = new JSDOM(text, { contentType: "text/xml" });
      const items = window.document.querySelectorAll("item");
      return Array.from(items).map(item => {
        const title = item.querySelector("title")?.textContent || "";
        const traffic = (item.getElementsByTagName("ht:approx_traffic")[0] || item.getElementsByTagName("approx_traffic")[0])?.textContent || "N/A";
        const newsItems = item.getElementsByTagName("ht:news_item") || item.getElementsByTagName("news_item");
        const snippets = [];
        const newsLinks = [];
        for (let n of newsItems) {
          const nt = n.getElementsByTagName("ht:news_item_title")[0]?.textContent;
          const nu = n.getElementsByTagName("ht:news_item_url")[0]?.textContent;
          const nsn = n.getElementsByTagName("ht:news_item_snippet")[0]?.textContent;
          if (nt && nu) {
            newsLinks.push({ title: nt, source: 'News', url: nu });
            if (nsn) snippets.push(nsn.replace(/<[^>]*>?/gm, '').trim());
          }
        }
        return { title, originalTitle: title, growth: traffic, snippets, newsLinks, source: 'Google' };
      });
    } catch (e) { return []; }
  }

  async getPortalTrends(code) {
    const url = code === 'KR' ? 'https://signal.bz/' : 'https://search.yahoo.co.jp/realtime/term';
    try {
      const res = await fetch(url);
      const html = await res.text();
      const dom = new JSDOM(html);
      const items = code === 'KR' ? dom.window.document.querySelectorAll('.rank-item .text') : dom.window.document.querySelectorAll('.Trend_Trend__item__name');
      return Array.from(items).slice(0, 10).map(el => {
        const title = el.textContent.trim();
        return { title, originalTitle: title, growth: 'Portal', source: code === 'KR' ? 'Signal' : 'Yahoo', newsLinks: [], snippets: [] };
      });
    } catch (e) { return []; }
  }

  async updateAll() {
    const countries = ['KR', 'JP', 'US'];
    const langs = ['ko', 'ja', 'en'];
    for (const code of countries) {
      console.log(`Processing ${code}...`);
      let combined = code === 'US' ? await this.getGoogleTrends(code) : [...await this.getPortalTrends(code), ...await this.getGoogleTrends(code)];
      const seen = new Set();
      const unique = [];
      for (const t of combined) {
        const norm = t.originalTitle.toLowerCase().replace(/\s/g, '');
        if (!seen.has(norm)) { seen.add(norm); unique.push(t); }
        if (unique.length >= 10) break;
      }
      if (unique.length > 0) {
        for (const lang of langs) {
          const titles = unique.map(item => item.originalTitle);
          const translated = await this.translateBatch(titles, lang);
          unique.forEach((item, idx) => {
            if (!item.translations) item.translations = {};
            item.translations[lang] = translated[idx] || item.originalTitle;
          });
        }
        const docRef = db.collection('trends').doc(code);
        const oldDoc = await docRef.get();
        await docRef.set({
          items: unique,
          previousItems: oldDoc.exists ? oldDoc.data().items || [] : [],
          lastUpdated: admin.firestore.Timestamp.now()
        });
      }
    }
    process.exit(0);
  }
}
new TrendUpdater().updateAll();
