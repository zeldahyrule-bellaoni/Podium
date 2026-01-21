/**
 * podiumBV.js
 * ------------------------
 * Subscript to:
 * 0️⃣ Go to ranking page
 * 1️⃣ Rate guild ladies (6→3 in quick succession, then check responses)
 * 2️⃣ Open private chat and send a fixed message (without clicks)
 * 3️⃣ Stay on ranking page for all iterations
 *
 * Syncs with main script.
 */

const fs = require('fs');
const path = require('path');

module.exports = async function runPodiumBV(page) {
  if (!page) throw new Error('❌ Playwright page object required');

  console.log('🚀 PodiumBV started');

  // -----------------------------
  // 0️⃣ Go to ranking page (stay here)
  // -----------------------------
  const rankingUrl = 'https://v3.g.ladypopular.com/ranking/players.php';
  await page.goto(rankingUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  console.log(`🌐 Navigated to ranking page: ${rankingUrl}`);

  // -----------------------------
  // 1️⃣ Load guild_ladies.json
  // -----------------------------
  const jsonPath = path.join(__dirname, 'guild_ladies.json');
  if (!fs.existsSync(jsonPath)) throw new Error('❌ guild_ladies.json not found');

  const raw = fs.readFileSync(jsonPath, 'utf8');
  const ladies = JSON.parse(raw);
  console.log(`📦 Loaded ${ladies.length} guild ladies`);

  // -----------------------------
  // 2️⃣ Hardcoded message text
  // -----------------------------
  const messageText = "Hello!";

  // -----------------------------
  // 3️⃣ Loop through ladies
  // -----------------------------
  let count = 0;

  for (const lady of ladies) {
    count++;
    console.log(`\n👩 Processing ${count}. ${lady.name} (${lady.ladyId})`);

    // -----------------------------
    // STEP 1 — RATE LADY (6 → 3, quick succession)
    // -----------------------------
    const ratings = [6, 5, 4, 3];
    const ratingPromises = [];

    for (const rating of ratings) {
      ratingPromises.push(page.evaluate(async ({ ladyId, rating }) => {
        const res = await fetch('https://v3.g.ladypopular.com/ajax/contest/podium.php', {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: new URLSearchParams({
            action: 'vote',
            podiumType: 4,
            ladyId,
            rating
          })
        });

        try {
          return await res.json();
        } catch {
          return { error: true };
        }
      }, { ladyId: lady.ladyId, rating }));
    }

    const results = await Promise.all(ratingPromises);
    const successful = results.some(r => r.status === 1);
    console.log(`⭐ Rating: ${successful ? '✅ Successful' : '❌ Unavailable'}`);

    // -----------------------------
    // STEP 2 — MESSAGE LADY
    // -----------------------------
    try {
      await page.evaluate(({ ladyId, ladyName }) => {
        window.startPrivateChat(ladyId, ladyName);
      }, { ladyId: lady.ladyId, ladyName: lady.name });

      await page.waitForSelector('#msgArea', { timeout: 10000 });

      await page.evaluate((msg) => {
        document.getElementById('msgArea').value = msg;
        document.getElementById('_sendMessageButton').click();
      }, messageText);

      console.log(`💬 Message sent to ${lady.name}`);
    } catch (err) {
      console.log(`⚠️ Could not message ${lady.name}: ${err.message}`);
    }

    // Small delay to reduce server strain
    await page.waitForTimeout(100);
  }

  console.log('\n🎉 PodiumBV completed for all ladies');
};
