const fs = require('fs');
const path = require('path');

const runRateAndMessageMultipleLadiesMultiTabs =
  require('./rate-and-message-multiple-ladies.js');

const runMap = require('./run-map.js');

const RUN_STATE_PATH = path.join(__dirname, 'run-state.json');

module.exports = async function runMultiTab(context) {
  console.log('🧵 Runner started');

  /* ─────────────────────────────
     STEP 1: Get today (YYYY-MM-DD)
  ───────────────────────────── */
  const today = new Date().toISOString().slice(0, 10);
  const dayNumber = new Date().getDate();
  const isOddDay = dayNumber % 2 === 1;

  /* ─────────────────────────────
     STEP 2: Read run-state.json
  ───────────────────────────── */
  let runState = JSON.parse(fs.readFileSync(RUN_STATE_PATH, 'utf8'));

  // If new day → reset state
  if (runState.date !== today) {
    console.log('🌅 New day detected. Resetting run state.');
    runState = {
      date: today,
      issuedRuns: []
    };
    fs.writeFileSync(RUN_STATE_PATH, JSON.stringify(runState, null, 2));
  }

  /* ─────────────────────────────
     STEP 3: Select allowed runs
  ───────────────────────────── */
  const todaysRuns = isOddDay
    ? runMap.oddDayRuns
    : runMap.evenDayRuns;

  const allowedRunNumbers = Object.keys(todaysRuns)
    .map(Number)
    .sort((a, b) => a - b);

  /* ─────────────────────────────
     STEP 4: Pick next unused run
  ───────────────────────────── */
  const nextRunNumber = allowedRunNumbers.find(
    runNo => !runState.issuedRuns.includes(runNo)
  );

  if (!nextRunNumber) {
    console.log('✅ All runs for today are already issued. Exiting.');
    return;
  }

  console.log(`▶️ Issuing run ${nextRunNumber}`);

  /* ─────────────────────────────
     STEP 5: LOCK THE RUN (NO DUPES)
  ───────────────────────────── */
  runState.issuedRuns.push(nextRunNumber);
  fs.writeFileSync(RUN_STATE_PATH, JSON.stringify(runState, null, 2));

  /* ─────────────────────────────
     STEP 6: Get workloads for run
  ───────────────────────────── */
  const workloads = todaysRuns[nextRunNumber];
  // workloads === exactly 6 tab configs

  console.log(`🧵 Starting run ${nextRunNumber} with 6 tabs`);

  /* ─────────────────────────────
     STEP 7: EXISTING 6-TAB LOGIC
     (UNCHANGED)
  ───────────────────────────── */
  const tabPromises = workloads.map(async (tierConfig, index) => {
    const page = await context.newPage();
    console.log(`🧵 Tab ${index + 1} launched`);

    try {
      await runRateAndMessageMultipleLadies(page, [tierConfig]);
      console.log(`✅ Tab ${index + 1} finished`);
    } catch (err) {
      console.log(`❌ Tab ${index + 1} failed: ${err.message}`);
      await page.screenshot({
        path: `multiTab-error-run-${nextRunNumber}-tab-${index + 1}.png`,
        fullPage: true
      });
    }
  });

  await Promise.all(tabPromises);

  console.log(`🎉 Run ${nextRunNumber} completed`);
};
