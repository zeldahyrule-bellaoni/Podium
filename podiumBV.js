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
  const messageText = "Have a nice day!"; // <-- replace this with your actual message

  // -----------------------------
  // 3️⃣ Loop through ladies
  // -----------------------------
  let count = 0;

  for (const lady of ladies) {
    count++;

    let ratingStatus = '❌ Unavailable';
    let successfulRating = null;
    let messageResult = '❌ Message failed';

    // -----------------------------
    // STEP 1 — RATE LADY (6 → 3, quick succession)
    // -----------------------------
    const ratings = [6, 5, 4, 3];
    const ratingPromises = [];

    for (const rating of ratings) {
      ratingPromises.push(
        page.evaluate(async ({ ladyId, rating }) => {
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
            return { rating, ...(await res.json()) };
          } catch {
            return { rating, error: true };
          }
        }, { ladyId: lady.ladyId, rating })
      );
    }

    const results = await Promise.all(ratingPromises);
    for (const r of results) {
      if (r.status === 1) {
        ratingStatus = '✅ Successful';
        successfulRating = r.rating;
        break; // take the first successful rating (max rating first)
      }
    }

    // -----------------------------
    // STEP 2 — MESSAGE LADY
    // -----------------------------
    try {
      // Open chat
      await page.evaluate(({ ladyId, ladyName }) => {
        window.startPrivateChat(ladyId, ladyName);
      }, { ladyId: lady.ladyId, ladyName: lady.name });

      // Short fixed wait to let chat switch
      await page.waitForTimeout(100);

      // Type and send message
      await page.evaluate((msg) => {
        const area = document.getElementById('msgArea');
        const sendBtn = document.getElementById('_sendMessageButton');
        area.value = msg;
        sendBtn.click();
      }, messageText);

      messageResult = '✅ Message sent';
    } catch (err) {
      messageResult = `❌ Message failed: ${err.message}`;
    }

    // -----------------------------
    // 4️⃣ Single console log per lady
    // -----------------------------
    console.log(
      `\n👩 ${count}. ${lady.name} (${lady.ladyId})\n` +
      `⭐ Rating: ${ratingStatus}${successfulRating ? ` (Rating: ${successfulRating})` : ''}\n` +
      `💬 Message: ${messageResult}`
    );

    // Small delay to reduce server strain between iterations
    await page.waitForTimeout(100);
  }

  console.log('\n🎉 PodiumBV completed for all ladies');
};
