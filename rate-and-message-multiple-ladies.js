// rate-and-message-multiple-ladies.js
module.exports = async function runRateAndMessageMultipleLadies(page) {

  // ===============================
  // CONFIG (EDIT MANUALLY)
  // ===============================
  const tierConfigs = [
    { tierId: 1, startPage: 1, endPage: 2 },
    // { tierId: 9, startPage: 1, endPage: 3 },
  ];

  // ❌ Profiles you NEVER want to visit / rate / message
  const excludedProfileIds = [
    '5770038','4904513','8523231','8523270','8523871','8523849','8524213','11266738','5640193','5780987','8538377','5784006','2914453','11242935',
    // '99887766',
  ];

  const m1 = 'Awesome look my dear, max stars and big hugs 😍'; // rating message
  const m2 = 'Awesome look my dear, big hugs 😍';              // won all podium prizes
  const m3 = 'Awesome look my dear, big hugs 😍 168h';         // 168 hours

  // ===============================
  // STEP 0 — COLLECT PROFILE IDS
  // ===============================
  console.log("🚀 STEP 0: Collecting profile IDs (ladies in a club)");

  let allProfiles = [];

  await page.goto('https://v3.g.ladypopular.com', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });
  await page.waitForTimeout(4000);

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

      await page.waitForTimeout(2000);
    }
  }

  // Remove duplicates across tiers
  allProfiles = [...new Set(allProfiles)];

  console.log(`📊 Profiles before exclusion: ${allProfiles.length}`);

  // ===============================
  // STEP 0.5 — EXCLUDE MANUAL IDS
  // ===============================
  if (excludedProfileIds.length > 0) {
    allProfiles = allProfiles.filter(
      id => !excludedProfileIds.includes(id)
    );
    console.log(`🚫 Excluded ${excludedProfileIds.length} profile(s)`);
  }

  console.log(`✅ STEP 0 DONE — Profiles after exclusion: ${allProfiles.length}`);

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
      await page.waitForTimeout(4000);

      // ===============================
      // STEP 2 — DETERMINE CASE
      // ===============================
      let caseType = 'case1';
      const alreadyVotedText = await page
        .locator('.lady-rating-wraper .alreadyVoted')
        .textContent()
        .catch(() => '');

      if (alreadyVotedText.includes('won all podium prizes')) {
        caseType = 'case2';
      } else if (alreadyVotedText.includes('already 3 votes')) {
        caseType = 'case3';
      }

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

            if (res.status === 1) {
              console.log('✅ Rating successful');
            }
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

      await page.waitForTimeout(3000);

      const message =
        caseType === 'case1' ? m1 :
        caseType === 'case2' ? m2 : m3;

      await page.evaluate(msg => {
        document.getElementById('msgArea').value = msg;
        document.getElementById('_sendMessageButton').click();
      }, message);

      console.log('💬 Message sent');
      await page.waitForTimeout(3000);

    } catch (err) {
      console.log(`❌ Error on profile ${profileId}: ${err.message}`);
    }
  }

  console.log('\n🎉 ALL LADIES PROCESSED');
};
