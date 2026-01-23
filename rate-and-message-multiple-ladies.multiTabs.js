const fs = require('fs');
const path = require('path');

const runRateAndMessageMultipleLadiesMultiTabs =
  require('./rate-and-message-multiple-ladies.js');

const runMap = require('./run-map.js');

const RUN_STATE_PATH = path.join(__dirname, 'run-state.json');

module.exports = async function runMultiTab(context) {
  console.log('🧵 Runner started');
  console.log('────────────────────────────────────────');

  /* ─────────────────────────────
     STEP 1: Get today (IST)
  ───────────────────────────── */

  // Force IST time (Asia/Kolkata)
  const nowIST = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
  );

  const today = nowIST.toLocaleDateString('en-CA'); // YYYY-MM-DD
  const dayNumber = nowIST.getDate();
  const isOddDay = dayNumber % 2 === 1;

  console.log('🕒 Time diagnostics');
  console.log('   System time     :', new Date().toString());
  console.log('   IST time        :', nowIST.toString());
  console.log('   IST date        :', today);
  console.log('   IST day number  :', dayNumber);
  console.log('   Day type        :', isOddDay ? 'ODD day' : 'EVEN day');
  console.log('────────────────────────────────────────');

  /* ─────────────────────────────
     STEP 2: Read run-state.json
  ───────────────────────────── */

  let runState;
  try {
    runState = JSON.parse(fs.readFileSync(RUN_STATE_PATH, 'utf8'));
    console.log('📄 Loaded run-state.json:', runState);
  } catch (err) {
    console.log('⚠️ run-state.json missing or invalid. Creating fresh state.');
    runState = { date: today, issuedRuns: [] };
    fs.writeFileSync(RUN_STATE_PATH, JSON.stringify(runState, null, 2));
  }

  // If new day → reset state
  if (runState.date !== today) {
    console.log('🌅 New IST day detected');
    console.log('   Previous date:', runState.date);
    console.log('   Resetting issuedRuns');

    runState = {
      date: today,
      issuedRuns: []
    };

    fs.writeFileSync(RUN_STATE_PATH, JSON.stringify(runState, null, 2));
  }

  console.log('📌 Current issued runs:', runState.issuedRuns);
  console.log('────────────────────────────────────────');

  /* ─────────────────────────────
     STEP 3: Select allowed runs
  ───────────────────────────── */

  const todaysRuns = isOddDay
    ? runMap.oddDayRuns
    : runMap.evenDayRuns;

  console.log(
    `📅 Using ${isOddDay ? 'oddDayRuns' : 'evenDayRuns'} from run-map`
  );

  const allowedRunNumbers = Object.keys(todaysRuns)
    .map(Number)
    .sort((a, b) => a - b);

  console.log('🗂 Allowed run numbers today:', allowedRunNumbers);
  console.log('────────────────────────────────────────');

  /* ─────────────────────────────
     STEP 4: Pick next unused run
  ───────────────────────────── */

  const nextRunNumber = allowedRunNumbers.find(
    runNo => !runState.issuedRuns.includes(runNo)
  );

  if (!nextRunNumber) {
    console.log('✅ All runs for today are already issued');
    console.log('🚪 Runner exiting safely');
    return;
  }

  console.log(`▶️ Next run selected: ${nextRunNumber}`);
  console.log('────────────────────────────────────────');

  /* ─────────────────────────────
     STEP 5: LOCK THE RUN (NO DUPES)
  ───────────────────────────── */

  console.log('🔒 Locking run BEFORE execution (duplication safe)');
  runState.issuedRuns.push(nextRunNumber);

  fs.writeFileSync(RUN_STATE_PATH, JSON.stringify(runState, null, 2));
  console.log('📄 Updated run-state.json:', runState);
  console.log('────────────────────────────────────────');

  /* ─────────────────────────────
     STEP 6: Get workloads for run
  ───────────────────────────── */

  const workloads = todaysRuns[nextRunNumber];

  console.log(`🧵 Starting run ${nextRunNumber}`);
  console.log(`🧵 Total tabs: ${workloads.length}`);
  console.log('📦 Workloads:', workloads);
  console.log('────────────────────────────────────────');

  /* ─────────────────────────────
     STEP 7: EXISTING 6-TAB LOGIC
     (UNCHANGED)
  ───────────────────────────── */

  const tabPromises = workloads.map(async (tierConfig, index) => {
    console.log(`🧵 Preparing Tab ${index + 1}`);
    console.log(`   Tier config:`, tierConfig);

    const page = await context.newPage();
    console.log(`🧵 Tab ${index + 1} launched`);

    try {
      await runRateAndMessageMultipleLadiesMultiTabs(page, [tierConfig]);
      console.log(`✅ Tab ${index + 1} finished successfully`);
    } catch (err) {
      console.log(`❌ Tab ${index + 1} failed`);
      console.log(`   Error: ${err.message}`);

      await page.screenshot({
        path: `multiTab-error-run-${nextRunNumber}-tab-${index + 1}.png`,
        fullPage: true
      });

      console.log(`📸 Screenshot saved for Tab ${index + 1}`);
    }
  });

  console.log('⏳ Waiting for all tabs to complete...');
  await Promise.all(tabPromises);

  console.log('────────────────────────────────────────');
  console.log(`🎉 Run ${nextRunNumber} completed`);
  console.log('🛑 Runner finished');
};
