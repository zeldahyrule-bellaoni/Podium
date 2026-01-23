// rate-and-message-multiple-ladies.js
module.exports = async function runRateAndMessageMultipleLadies(page, tierConfigs) {

  // 🚨 CANONICAL EXCLUSION SET (LADY NAMES, case-insensitive)
  const excludedLadyNames = new Set([
    'Bella Swan','Alice','Eve','Diana','Catherine',
    // add all names you want to exclude
  ].map(n => n.toLowerCase())); // convert to lowercase for case-insensitive matching

  const m1 = '“The face is a mask worn by the mind.” - Friedrich Nietzsche. Thank you! xoxo ₍^. .^₎⟆ ♡♡♡ Max love to you';
  const m2 = '“The face is a mask worn by the mind.” - Friedrich Nietzsche. Thank you! xoxo ₍^. .^₎⟆ ♡♡♡';
  const m3 = '“The face is a mask worn by the mind.” - Friedrich Nietzsche. Thank you! xoxo ₍^. .^₎⟆ ♡♡♡ 168h';

  const tabLabel = page._guid || 'T?'; //internal tab label in playwright

  // now stores objects, not just profileIds
  let collectedLadies = []; //collects profileid, ladyid, name for each lady

  await page.goto('https://v3.g.ladypopular.com', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });
  await page.waitForTimeout(2000);

  // ─────────────────────────────────────────────
  // 🔍 COLLECT LADIES (PROFILE + LADY ID + NAME)
  // ─────────────────────────────────────────────
  for (const { tierId, startPage, endPage } of tierConfigs) { 
    for (let currentPage = startPage; currentPage <= endPage; currentPage++) { //goes page by page inside each tier

      const ladiesOnPage = await page.evaluate(
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
            const guildCell = row.querySelector('.ranking-player-guild');
            if (!guildCell) return;
            const clubLink = guildCell.querySelector('a[href*="guilds.php"]');
            if (!clubLink) return;

            const profileLink = row.querySelector('a[href*="profile.php?id="]');
            if (!profileLink) return;

            const profileMatch = profileLink.href.match(/id=(\d+)/);
            if (!profileMatch) return;

            const profileId = profileMatch[1];

            const chatBtn = row.querySelector('[onclick*="startPrivateChat"]');
            if (!chatBtn) return;

            const onclick = chatBtn.getAttribute('onclick');
            const chatMatch = onclick.match(/startPrivateChat\((\d+),\s*'([^']+)'\)/);
            if (!chatMatch) return;

            const ladyId = chatMatch[1];
            const name = chatMatch[2];

            results.push({ profileId, ladyId, name });
          });

          return results;
        },
        { currentPage, tierId }
      );

      collectedLadies.push(...ladiesOnPage);
      await page.waitForTimeout(700);
    }
  }

  // detects for duplicate entries based on profileId
  const seenProfiles = new Set();
  collectedLadies = collectedLadies.filter(l => {
    if (seenProfiles.has(l.profileId)) return false;
    seenProfiles.add(l.profileId);
    return true;
  });

  // ─────────────────────────────────────────────
  // 🚨 EARLY EXCLUSION (HARD SAFETY)
  // ─────────────────────────────────────────────
  const excludedFound = collectedLadies.filter(l =>
    excludedLadyNames.has(l.name.toLowerCase())
  );

  console.log('⏸ MANUAL VERIFICATION PAUSE INITIATED');

  if (excludedFound.length > 0) {
    console.log('🚨🚨 EXCLUDED LADIES DETECTED 🚨🚨');

    excludedFound.forEach(l => {
      console.log(
        `⛔ EXCLUDED: ${l.name} | ladyId=${l.ladyId} | profileId=${l.profileId}`
      );
    });
  } else {
    console.log('✅ No excluded ladies detected automatically. Please manually cross-verify before continuing.');
  }
  
  console.log('⏸ Pausing for 5 minutes to allow manual cancellation...');
  await page.waitForTimeout(30 * 60 * 1000); // 30 minutes time out

  // final SAFE profiles
  const finalProfiles = collectedLadies
    .filter(l => !excludedLadyNames.has(l.name.toLowerCase()))
    .map(l => l.profileId); //keeps only the profile id for collected ladies

  // ─────────────────────────────────────────────
  // 🔁 MAIN LOOP (UNCHANGED BEHAVIOUR)
  // ─────────────────────────────────────────────
  for (let i = 0; i < finalProfiles.length; i++) {

    const profileId = finalProfiles[i];
    const url = `https://v3.g.ladypopular.com/profile.php?id=${profileId}`;

    let caseType = 'case1';
    let ratingResult = null;
    let ratingGiven = null;
    let messageResult = false;
    let skipped = false;

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(2000);

      const alreadyVotedText = await page
        .locator('.lady-rating-wraper .alreadyVoted')
        .textContent()
        .catch(() => '');

      if (alreadyVotedText.includes('won all podium prizes')) caseType = 'case2';
      else if (alreadyVotedText.includes('already 3 votes')) caseType = 'case3';

      if (caseType === 'case1') {
        try {
          const ratingButtons = await page
            .locator('.lady-rating-wraper ol.rating li.active button')
            .all();
          
          let maxVote = null;
          
          for (const btn of ratingButtons) {
            const onclick = await btn.getAttribute('onclick');
            if (!onclick) continue;
            
            const match = onclick.match(/podiumVote\('(\d+)',(\d+),(\d+)\)/);
            if (!match) continue;
            
            const [, podiumType, ladyId, rating] = match;
            const ratingNum = Number(rating);

            // 🚨 EXCLUSION GUARD — case-insensitive name check (we need to map profileId → name)
            const ladyObj = collectedLadies.find(l => l.ladyId === ladyId);
            if (ladyObj && excludedLadyNames.has(ladyObj.name.toLowerCase())) {
                skipped = true;
                return;
            }

            if (!maxVote || ratingNum > maxVote.ratingNum) { 
              maxVote = { podiumType, ladyId, rating, ratingNum };
            }
          }
          
          if (maxVote) {
            const { podiumType, ladyId, rating } = maxVote;
            
            const res = await page.evaluate(
              async ({ podiumType, ladyId, rating }) => {
                const r = await fetch('/ajax/contest/podium.php', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                  body: new URLSearchParams({ action: 'vote', podiumType, ladyId, rating })
                });
                return r.json();
              },
              { podiumType, ladyId, rating }
            );
            
            ratingResult = res?.status === 1;
            if (ratingResult) ratingGiven = rating;
          }
          
        } catch {
          ratingResult = false;
        }
      }

      const message =
        caseType === 'case1' ? m1 :
        caseType === 'case2' ? m2 : m3;

      const messageButton = page
        .locator('.following-container .message-btn[onclick*="startPrivateChat"]')
        .first();

      const onclickAttr = await messageButton.getAttribute('onclick').catch(() => null);
      if (onclickAttr) {
        const match = onclickAttr.match(/startPrivateChat\('(\d+)',\s*'([^']+)'\)/);
        if (match) {
          const [, id, name] = match;

          await page.evaluate(({ id, name }) => {
            startPrivateChat(id, name);
          }, { id, name });

          try {
            await page.waitForSelector('#msgArea', { timeout: 7000 });
            await page.evaluate(msg => {
              document.getElementById('msgArea').value = msg;
              document.getElementById('_sendMessageButton').click();
            }, message);
            messageResult = true;
          } catch {
            messageResult = false;
          }
        }
      }

    } catch {}

    const ratingEmoji =
      ratingResult === true ? `✅(${ratingGiven})` :
      ratingResult === false ? '❌' : '⚪️';

    const messageEmoji = messageResult ? '✅' : '❌';

    console.log(
      `${tabLabel} - (${i + 1}/${finalProfiles.length}) ${url} | ${caseType} | ${ratingEmoji} ${messageEmoji}`
    );
  }

  console.log('🎉 TAB COMPLETED');
};
