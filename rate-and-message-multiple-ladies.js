// rate-and-message-multiple-ladies.js
module.exports = async function runRateAndMessageMultipleLadies(page, tierConfigs) {

  // ❌ Profiles you NEVER want to visit
  const excludedProfileIds = [
    '7709322','11264860','11264915','11265728','11265695',
    '11266176','11266738','6597974','7722810','7550302',
    '11285359','11258511','2914453','7506725',
  ];

  const m1 = 'Awesome look my dear, max stars and big hugs 😍';
  const m2 = 'Awesome look my dear, big hugs 😍';
  const m3 = 'Awesome look my dear, big hugs 😍 168h';

  console.log("🚀 Collecting profile IDs for assigned workload");

  let allProfiles = [];

  await page.goto('https://v3.g.ladypopular.com', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });
  await page.waitForTimeout(2000);

  // 🔹 SAME LOGIC — just uses injected tierConfigs
  for (const { tierId, startPage, endPage } of tierConfigs) {
    for (let currentPage = startPage; currentPage <= endPage; currentPage++) {

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

            const idMatch = profileLink.href.match(/id=(\d+)/);
            if (idMatch) results.push(idMatch[1]);
          });

          return results;
        },
        { currentPage, tierId }
      );

      allProfiles.push(...profilesOnPage);
      await page.waitForTimeout(700);
    }
  }

  // Dedup + exclude
  allProfiles = [...new Set(allProfiles)].filter(
    id => !excludedProfileIds.includes(id)
  );

  console.log(`✅ ${allProfiles.length} profiles assigned to this tab`);

  // 🔹 FROM HERE ONWARD — YOUR ORIGINAL LOGIC UNCHANGED
  // Visiting profiles, detecting cases, rating, messaging
  // (exact same code you already wrote)
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

