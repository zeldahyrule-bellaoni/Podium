/**
 * Podium BV — Base Version
 * ------------------------
 * PURPOSE:
 * - Read guild_ladies.json
 * - Loop through ladies
 * - Log ladyId & name
 * - NO rating
 * - NO messaging
 * - NO browser actions
 */

const fs = require('fs');
const path = require('path');

module.exports = async function runPodiumBV() {

  console.log('🚀 PodiumBV started');

  // ----------------------------------
  // 1. Load JSON file
  // ----------------------------------
  const jsonPath = path.join(__dirname, 'guild_ladies.json');

  if (!fs.existsSync(jsonPath)) {
    throw new Error('❌ guild_ladies.json not found in repo root');
  }

  const raw = fs.readFileSync(jsonPath, 'utf8');
  const ladies = JSON.parse(raw);

  console.log(`📦 Loaded ${ladies.length} guild ladies`);

  // ----------------------------------
  // 2. Loop & log
  // ----------------------------------
  let count = 0;

  for (const lady of ladies) {
    count++;

    console.log(
      `👩 ${count}. ${lady.name} (${lady.ladyId})`
    );
  }

  console.log('🎉 PodiumBV completed successfully');
};
