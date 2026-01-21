/**
 * podiumBV.js
 * ------------------------
 * Worker logic:
 * - Rate
 * - Open chat
 * - Confirm correct lady
 * - Send message
 */

module.exports = async function runPodiumBV(page, ladies, tabNumber = 1) {
  if (!page) throw new Error('❌ Playwright page object required');

  console.log(`🪟 Tab ${tabNumber} | 🚀 PodiumBV started`);
  console.log(`🪟 Tab ${tabNumber} | 👩 Ladies loaded: ${ladies.length}`);

  const MESSAGE_TEXT = 'Wishing you a beautiful day, my dear friend! Hugs ฅ^•ﻌ•^ฅ';

  let index = 0;

  for (const lady of ladies) {
    index++;

    const ladyId = lady.ladyId;
    const ladyName = lady.name;

    let ratingStatus = '❌ Unavailable';
    let ratingValue = null;
    let messageStatus = '❌ Message failed';

    // -----------------------------
    // RATE (6 → 3)
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
    } catch {}

    // -----------------------------
    // MESSAGE (SAFE CHAT SYNC)
    // -----------------------------
    try {
      await page.evaluate(
        ({ ladyId, ladyName }) => {
          window.startPrivateChat(ladyId, ladyName);
        },
        { ladyId, ladyName }
      );

      await page.waitForFunction(
        expectedName => {
          const el = document.getElementById('js-chat-newprivate-search-input');
          return el && el.value === expectedName;
        },
        ladyName,
        { timeout: 15000 }
      );

      await page.evaluate(msg => {
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

    console.log(
      `🪟${tabNumber} 👩 ${index}. ${ladyName} (${ladyId}) | ⭐ Rating: ${ratingStatus}${ratingValue ? ` (${ratingValue})` : ''} | 💬 Message: ${messageStatus}`
    );
  }

  console.log(`🪟 Tab ${tabNumber} | 🎉 PodiumBV completed`);
};
