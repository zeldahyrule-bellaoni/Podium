/**
 * podiumBV.js
 * ------------------------
 * 0️⃣ Go to ranking page
 * 1️⃣ Rate guild ladies (6→3 in parallel)
 * 2️⃣ Open private chat and send message ONLY after correct lady chat is confirmed
 * 3️⃣ Stay on ranking page throughout
 */

const fs = require('fs');
const path = require('path');

module.exports = async function runPodiumBV(page) {
  if (!page) throw new Error('❌ Playwright page object required');

  console.log('🚀 Starting: Podium BV');

  // -----------------------------
  // 0️⃣ Go to ranking page
  // -----------------------------
  const rankingUrl = 'https://v3.g.ladypopular.com/ranking/players.php';
  await page.goto(rankingUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

  console.log('🏁 PodiumBV started');

  // -----------------------------
  // 1️⃣ Load JSON
  // -----------------------------
  const jsonPath = path.join(__dirname, 'guild_ladies.json');
  if (!fs.existsSync(jsonPath)) throw new Error('❌ guild_ladies.json not found');

  const ladies = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`👩 Total ladies loaded: ${ladies.length}`);

  // -----------------------------
  // 2️⃣ Message text
  // -----------------------------
  const MESSAGE_TEXT = 'Hello!';

  let index = 0;

  // -----------------------------
  // 3️⃣ Main loop
  // -----------------------------
  for (const lady of ladies) {
    index++;

    const ladyId = lady.ladyId;
    const ladyName = lady.name;

    let ratingStatus = '❌ Unavailable';
    let ratingValue = null;
    let messageStatus = '❌ Message failed';

    // -----------------------------
    // STEP 1 — RATE (6 → 3)
    // -----------------------------
    try {
      const ratings = [6, 5, 4, 3];

      const responses = await Promise.all(
        ratings.map(rating =>
          page.evaluate(async ({ ladyId, rating }) => {
            const res = await fetch(
              'https://v3.g.ladypopular.com/ajax/contest/podium.php',
              {
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
              }
            );

            try {
              return { rating, data: await res.json() };
            } catch {
              return { rating, data: null };
            }
          }, { ladyId, rating })
        )
      );

      const success = responses.find(r => r.data && r.data.status === 1);
      if (success) {
        ratingStatus = '✅ Successful';
        ratingValue = success.rating;
      }
    } catch {
      // silently fail rating
    }

    // -----------------------------
    // STEP 2 — MESSAGE (SAFE CHAT SYNC)
    // -----------------------------
    try {
      // Open chat
      await page.evaluate(
        ({ ladyId, ladyName }) => {
          window.startPrivateChat(ladyId, ladyName);
        },
        { ladyId, ladyName }
      );

      // Wait until CENTER chat input shows THIS lady's name
      await page.waitForFunction(
        (expectedName) => {
          const el = document.getElementById('js-chat-newprivate-search-input');
          return el && el.value === expectedName;
        },
        ladyName,
        { timeout: 15000 }
      );

      // Send message
      await page.evaluate((msg) => {
        const area = document.getElementById('msgArea');
        const btn = document.getElementById('_sendMessageButton');
        if (!area || !btn) throw new Error('Chat input missing');

        area.value = msg;
        btn.click();
      }, MESSAGE_TEXT);

      messageStatus = '✅ Message sent';
    } catch {
      messageStatus = '❌ Message failed';
    }

    // -----------------------------
    // FINAL LOG (ONCE PER LADY)
    // -----------------------------
    console.log(`
👩 ${index}. ${ladyName} (${ladyId})
⭐ Rating: ${ratingStatus}${ratingValue ? ` (${ratingValue})` : ''}
💬 Message: ${messageStatus}
`);
  }

  console.log('🎉 PodiumBV completed');
};
