// podiumBV.js
require('dotenv').config();
const fs = require('fs');

/**
 * Assumptions:
 * 1. You are ALREADY logged in.
 * 2. This script is called with a Playwright `page` instance.
 * 3. guild_ladies.json is in the same folder.
 * 4. We stay on ranking/players.php the whole time.
 */

module.exports = async function runPodiumBV(page) {
  console.log('🏁 PodiumBV started');

  // --------------------------------------------------
  // CONFIG
  // --------------------------------------------------
  const MESSAGE_TEXT = 'Hello! 🌸';
  const LADIES_FILE = './guild_ladies.json';

  // --------------------------------------------------
  // LOAD LADIES
  // --------------------------------------------------
  const ladies = JSON.parse(fs.readFileSync(LADIES_FILE, 'utf8'));

  console.log(`👩 Total ladies loaded: ${ladies.length}`);

  // --------------------------------------------------
  // ENSURE BASE PAGE
  // --------------------------------------------------
  await page.goto('https://v3.g.ladypopular.com/ranking/players.php', {
    waitUntil: 'domcontentloaded'
  });

  // --------------------------------------------------
  // MAIN LOOP
  // --------------------------------------------------
  for (let i = 0; i < ladies.length; i++) {
    const { id: ladyId, name: ladyName } = ladies[i];

    let ratingResult = '❌ Unavailable';
    let messageResult = '❌ Not sent';

    console.log(`\n👩 Processing ${i + 1}. ${ladyName} (${ladyId})`);

    try {
      // ----------------------------------------------
      // STEP 1: TRY RATING (3–6)
      // ----------------------------------------------
      ratingResult = await page.evaluate((id) => {
        if (typeof window.ratePlayer !== 'function') return '❌ Unavailable';

        for (let r = 6; r >= 3; r--) {
          try {
            const res = window.ratePlayer(id, r);
            if (res !== false) {
              return `✅ Successful (${r}⭐)`;
            }
          } catch (_) {}
        }
        return '❌ Unavailable';
      }, ladyId);
    } catch (_) {
      ratingResult = '❌ Unavailable';
    }

    try {
      // ----------------------------------------------
      // STEP 2: OPEN PRIVATE CHAT
      // ----------------------------------------------
      await page.evaluate((id, name) => {
        window.startPrivateChat(id, name);
      }, ladyId, ladyName);

      // ----------------------------------------------
      // STEP 3: WAIT FOR *CORRECT CHAT CONTEXT*
      // (THIS IS THE CRITICAL FIX)
      // ----------------------------------------------
      await page.waitForFunction(
        (expectedName) => {
          const input = document.querySelector(
            '#js-chat-newprivate-search-input'
          );
          return input && input.value.trim() === expectedName;
        },
        ladyName,
        { timeout: 15000 }
      );

      // ----------------------------------------------
      // STEP 4: SEND MESSAGE
      // ----------------------------------------------
      await page.evaluate((msg) => {
        const textarea = document.querySelector('#msgArea');
        const sendBtn = document.querySelector('#_sendMessageButton');

        if (!textarea || !sendBtn) {
          throw new Error('Chat input not ready');
        }

        textarea.value = msg;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        sendBtn.click();
      }, MESSAGE_TEXT);

      messageResult = '✅ Message sent';
    } catch (err) {
      messageResult = `❌ Message failed`;
    }

    // ------------------------------------------------
    // FINAL LOG (ONLY ONCE PER LADY — AS REQUESTED)
    // ------------------------------------------------
    console.log(`⭐ Rating: ${ratingResult}`);
    console.log(`💬 Message: ${messageResult}`);
  }

  console.log('\n🎉 PodiumBV completed');
};
