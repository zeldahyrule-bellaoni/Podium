/**
 * podiumBV.multiTabs.js
 * ------------------------
 * Opens multiple tabs, navigates once per tab,
 * and runs podiumBV logic in parallel
 */

const fs = require('fs');
const path = require('path');
const runPodiumBV = require('./podiumBV');

module.exports = async function runPodiumBVMultiTabs(context, tabCount = 4) {
  if (!context) throw new Error('❌ Playwright browser context required');

  console.log(`🧩 Starting PodiumBV in ${tabCount} tabs`);

  // -----------------------------
  // Load JSON ONCE
  // -----------------------------
  const jsonPath = path.join(__dirname, 'guild_ladies.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error('❌ guild_ladies.json not found');
  }

  const ladies = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const total = ladies.length;

  console.log(`👩 Total ladies: ${total}`);

  const chunkSize = Math.ceil(total / tabCount);
  const rankingUrl = 'https://v3.g.ladypopular.com/ranking/players.php';

  const tasks = [];

  // -----------------------------
  // Create tabs + assign work
  // -----------------------------
  for (let i = 0; i < tabCount; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, total);
    const slice = ladies.slice(start, end);

    if (slice.length === 0) continue;

    tasks.push(
      (async () => {
        const page = await context.newPage();

        console.log(`🪟 Tab ${i + 1} navigating to ranking page`);

        // ✅ NAVIGATION IS DONE HERE (as requested)
        await page.goto(rankingUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });

        console.log(
          `🪟 Tab ${i + 1}: ladies ${start + 1} → ${end}`
        );

        await runPodiumBV(page, slice, i + 1);
      })()
    );
  }

  // -----------------------------
  // Run all tabs in parallel
  // -----------------------------
  await Promise.all(tasks);

  console.log('🎉 PodiumBV multi-tab run completed');
};
