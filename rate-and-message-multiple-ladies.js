// rate-and-message-multiple-ladies.js
module.exports = async function runRateAndMessageMultipleLadies(page, tierConfigs) {

  // 🚨 CANONICAL EXCLUSION SET (LADY IDs)
  const excludedLadyIds = new Set([
    '7709322','11264860','11264915','11265695','11265728',
    '11266176','11266738','6597974','7722810','7550302',
    '11285359','11258511','2914453','7506725','8525841','8408234',
  ]);

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

      const ladiesOnPage = await page.evaluate( //runs code inside the browser context
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

          const data = await res.json(); //returns html (response) inside json
          if (!data.html) return [];

          const container = document.createElement('div');
          container.innerHTML = data.html; //inserts html into a container so we can search it

          const rows = container.querySelectorAll('tr'); //each plaer is 1 table row
          const results = []; //stores result for the lady

          //filtering logic
          rows.forEach(row => { //meaning in each row
            // 1) must be in a guild 
            const guildCell = row.querySelector('.ranking-player-guild');
            if (!guildCell) return;

            const clubLink = guildCell.querySelector('a[href*="guilds.php"]'); //must have a guild link
            if (!clubLink) return;

            // profile id
            const profileLink = row.querySelector('a[href*="profile.php?id="]');
            if (!profileLink) return;

            const profileMatch = profileLink.href.match(/id=(\d+)/); //pulls the numeric id from profile URL
            if (!profileMatch) return;

            const profileId = profileMatch[1]; //stores the actual profile id number for the lady

            // lady id + name from startPrivateChat
            const chatBtn = row.querySelector('[onclick*="startPrivateChat"]');
            if (!chatBtn) return;

            const onclick = chatBtn.getAttribute('onclick');
            const chatMatch = onclick.match(/startPrivateChat\((\d+),\s*'([^']+)'\)/);
            if (!chatMatch) return;

            const ladyId = chatMatch[1]; //captures ladyid
            const name = chatMatch[2]; //captures name

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
    excludedLadyIds.has(l.ladyId)
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
  await page.waitForTimeout(30 * 60 * 1000); // 30 minutes time out. Comment it and the console log when you are confident.

  // final SAFE profiles
  const finalProfiles = collectedLadies
    .filter(l => !excludedLadyIds.has(l.ladyId)) //removes excluded ladies from collected ladies
    .map(l => l.profileId); //keeps only the profile id for collected ladies

  // ─────────────────────────────────────────────
  // 🔁 MAIN LOOP (UNCHANGED BEHAVIOUR)
  // ─────────────────────────────────────────────
  for (let i = 0; i < finalProfiles.length; i++) {

    const profileId = finalProfiles[i];
    const url = `https://v3.g.ladypopular.com/profile.php?id=${profileId}`;

    //track what happened - used only for logging
    let caseType = 'case1';
    let ratingResult = null;
    let ratingGiven = null;
    let messageResult = false;
    let skipped = false;

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(2000);

      //detecting already voted cases (case where game shows all prizes or 168h), and then separating them as case 2 and case 3
      const alreadyVotedText = await page
        .locator('.lady-rating-wraper .alreadyVoted')
        .textContent()
        .catch(() => '');

      if (alreadyVotedText.includes('won all podium prizes')) caseType = 'case2';
      else if (alreadyVotedText.includes('already 3 votes')) caseType = 'case3';
      // if none of it is true, it remains case 1

      // giving rating to case 1 ladies
      if (caseType === 'case1') {
        try {
          const ratingButtons = await page
          .locator('.lady-rating-wraper ol.rating li.active button')
          .all();
          
          let maxVote = null;
          
          for (const btn of ratingButtons) { //loop through each rating button
            const onclick = await btn.getAttribute('onclick'); //Example result is - "podiumVote('4',6416927,3)"
            if (!onclick) continue;
            
            const match = onclick.match(/podiumVote\('(\d+)',(\d+),(\d+)\)/);
            if (!match) continue;
            
            const [, podiumType, ladyId, rating] = match; //destructures the data to podiumtype, ladyId and rating
            const ratingNum = Number(rating); //converts rating to number 
        
            // 🚨 EXCLUSION GUARD — THIS IS THE EXACT SPOT
            if (excludedLadyIds.has(ladyId)) {
                skipped = true;
                return; // exits the entire function/tab
            } 

            if (!maxVote || ratingNum > maxVote.ratingNum) { 
              maxVote = { podiumType, ladyId, rating, ratingNum }; //We store everything we need for the vote request: rating is string version, ratingNum is numeric version
            }
          }
          
          if (maxVote) { //we are checking if we have a maxVote
            const { podiumType, ladyId, rating } = maxVote; //extracting final vote data
            
            const res = await page.evaluate( //sending the vote request
              async ({ podiumType, ladyId, rating }) => {
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
                
                return r.json();
              },
              { podiumType, ladyId, rating }
            );
            
            ratingResult = res?.status === 1; //determines if success or failure
            if (ratingResult) ratingGiven = rating; //stores the rating value given
          }
          
        } catch {
          ratingResult = false; //if failure, safely continues so script wont crash
        }
      }

      //messaging logic
      //selecting message w.r.t case type
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
            startPrivateChat(id, name); //starts private chat
          }, { id, name });

          try {
            await page.waitForSelector('#msgArea', { timeout: 7000 });
            await page.evaluate(msg => {
              document.getElementById('msgArea').value = msg;
              document.getElementById('_sendMessageButton').click();
            }, message);
            messageResult = true; //means we successfully executed the send action without errors
          } catch {
            messageResult = false;
          }
        }
      }

    } catch {
      // intentionally swallowed
    }

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
