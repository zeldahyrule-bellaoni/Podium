// rate-and-message-multiple-ladies.js
module.exports = async function runRateAndMessageMultipleLadies(page) {

  // ===============================
  // CONFIG (EDIT MANUALLY)
  // ===============================
  const tierConfigs = [
    { tierId: 10, startPage: 8, endPage: 293 },
    { tierId: 9,  startPage: 1, endPage: 87 },
    { tierId: 8,  startPage: 1, endPage: 90 },
    { tierId: 7,  startPage: 1, endPage: 127 },
  ];

  // ❌ Profiles you NEVER want to visit / rate / message (YOUR OWN IDS)
  const excludedProfileIds = [
    '7709322',   // bella
    '11264860', // her majesty
    '11264915', // felis
    '11265728', // wildrose
    '11265695', // agentx
    '11266176', // giggles
    '11266738', // nina
    '6597974',  // oni
    '7722810',  // zelda
    '7550302',  // indila
    '11285359', // pania
    '11258511', // shenhe
    '2914453',  // dd
  ];

  const m1 = 'Awesome look my dear, max stars and big hugs 😍';
  const m2 = 'Awesome look my dear, big hugs 😍';
  const m3 = 'Awesome look my dear, big hugs 😍 168h';

  // ===============================
  // STEP 0 — COLLECT PROFILE IDS
  // ===============================
  console.log("🚀 STEP 0: Collecting profile IDs (ladies in a club)");

  let allProfiles = [];

  await page.goto('https://v3.g.ladypopular.com', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });
  await page.waitForTimeout(2000);

  for (const config of tierConfigs) {
    const { tierId, startPage, endPage } = config;
    console.log(`🏆 Tier ${tierId}: pages ${startPage} → ${endPage}`);

    for (let currentPage = startPage; currentPage <= endPage; currentPage++) {
      console.log(`📄 Scanning tier ${tierId}, page ${currentPage}`);

      const profilesOnPage = await page.evaluate(
        async ({ currentPage, tierId }) => {
          const res = await fetch('/ajax/ranking/players.php', {
            method: 'POST',
            body: new URLSearchParams({
              action: 'getRanking',
              page: currentPage.toString(),
              tierId: tierId.toString()
            }),
            credentials: 'same-origin'
          });

          const data = await res.json();
          if (!data.html) return [];

          const container = document.createElement('div');
          container.innerHTML = data.html;

          const rows = container.querySelectorAll('tr');
          const results = [];

          rows.forEach(row => {
            const profileLink = row.querySelector('a[href*="profile.php?id="]');
            const guildCell = row.querySelector('.ranking-player-guild');
            if (!profileLink || !guildCell) return;

            const clubLink = guildCell.querySelector('a[href*="guilds.php"]');
            if (!clubLink) return;

            const idMatch = profileLink.getAttribute('href').match(/id=(\d+)/);
            if (!idMatch) return;

            results.push(idMatch[1]);
          });

          return results;
        },
        { currentPage, tierId }
      );

      console.log(`   🎯 Found ${profilesOnPage.length} club ladies`);
      allProfiles.push(...profilesOnPage);

      await page.waitForTimeout(700);
    }
  }

  // Deduplicate + normalize
  allProfiles = [...new Set(allProfiles)].map(String);
  console.log(`📊 Profiles before exclusion: ${allProfiles.length}`);

  // ===============================
  // STEP 0.5 — EXCLUDE MANUAL IDS
  // ===============================
  const excludedSet = new Set(excludedProfileIds.map(String));
  const actuallyExcluded = allProfiles.filter(id => excludedSet.has(id));
  allProfiles = allProfiles.filter(id => !excludedSet.has(id));

  console.log(`🚫 Excluded ${actuallyExcluded.length} profile(s) from list`);
  if (actuallyExcluded.length > 0) {
    console.log('   🔹 Excluded IDs:', actuallyExcluded.join(', '));
  }

  console.log(`✅ STEP 0 DONE — Profiles after exclusion: ${allProfiles.length}`);

  // ===============================
  // 🛑 SAFETY CHECK — PREVENT SELF-VOTING
  // ===============================
  const MIN_REQUIRED_EXCLUSIONS = 4;

  if (actuallyExcluded.length < MIN_REQUIRED_EXCLUSIONS) {
    console.error('🛑 SAFETY STOP TRIGGERED 🛑');
    console.error(
      `Expected at least ${MIN_REQUIRED_EXCLUSIONS} excluded profiles, ` +
      `but only ${actuallyExcluded.length} were excluded.`
    );
    console.error('Exclusion likely failed. Script aborted to prevent self-voting.');
    return; // ⛔ HARD STOP
  }

  // ===============================
  // LOOP THROUGH EACH PROFILE
  // ===============================
  for (let i = 0; i < allProfiles.length; i++) {
    const profileId = allProfiles[i];
    const ladyProfileUrl = `https://v3.g.ladypopular.com/profile.php?id=${profileId}`;

    console.log(`\n🌟 (${i + 1}/${allProfiles.length}) Visiting ${ladyProfileUrl}`);

    try {
      // ===============================
      // STEP 1 — OPEN PROFILE
      // ===============================
      await page.goto(ladyProfileUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
      await page.waitForTimeout(2000);

      // ===============================
      // STEP 2 — DETERMINE CASE
      // ===============================
      let caseType = 'case1';
      const alreadyVotedText = await page
        .locator('.lady-rating-wraper .alreadyVoted')
        .textContent()
        .catch(() => '');

      if (alreadyVotedText.includes('won all podium prizes')) caseType = 'case2';
      else if (alreadyVotedText.includes('already 3 votes')) caseType = 'case3';

      console.log(`📌 Case detected: ${caseType}`);

      // ===============================
      // STEP 3 — RATE (CASE 1 ONLY)
      // ===============================
      if (caseType === 'case1') {
        const buttons = await page
          .locator('.lady-rating-wraper ol.rating li.active button')
          .elementHandles();

        if (buttons.length > 0) {
          const onclickText = await buttons[buttons.length - 1].getAttribute('onclick');
          const match = onclickText.match(/podiumVote\('(\d+)',(\d+),(\d+)\)/);

          if (match) {
            const [, podiumType, ladyId, rating] = match;

            const res = await page.evaluate(async ({ podiumType, ladyId, rating }) => {
              const r = await fetch('/ajax/contest/podium.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                  action: 'vote',
                  podiumType,
                  ladyId,
                  rating
                })
              });
              return await r.json();
            }, { podiumType, ladyId, rating });

            if (res.status === 1) console.log('✅ Rating successful');
          }
        }
      }

      // ===============================
      // STEP 4 — MESSAGE
      // ===============================
      const messageButton = await page
        .locator('.following-container .message-btn[onclick*="startPrivateChat"]')
        .first();

      const onclickAttr = await messageButton.getAttribute('onclick');
      const chatMatch = onclickAttr.match(/startPrivateChat\('(\d+)',\s*'([^']+)'\)/);
      if (!chatMatch) continue;

      const [, chatLadyId, chatLadyName] = chatMatch;

      await page.evaluate(({ chatLadyId, chatLadyName }) => {
        startPrivateChat(chatLadyId, chatLadyName);
      }, { chatLadyId, chatLadyName });

      await page.waitForTimeout(1200);

      const message =
        caseType === 'case1' ? m1 :
        caseType === 'case2' ? m2 : m3;

      await page.evaluate(msg => {
        document.getElementById('msgArea').value = msg;
        document.getElementById('_sendMessageButton').click();
      }, message);

      console.log('💬 Message sent');
      await page.waitForTimeout(1200);

    } catch (err) {
      console.log(`❌ Error on profile ${profileId}: ${err.message}`);
    }
  }

  console.log('\n🎉 ALL LADIES PROCESSED');
};
