// rate-and-message-multiple-ladies.js
module.exports = async function runRateAndMessageMultipleLadies(page, tierConfigs) {

  // 🛑 IMPORTANT:
  // These are LADY IDs (used in podiumVote & startPrivateChat)
  // NOT profile.php?id values
  // Any ID here will NEVER be rated or messaged
  const excludedLadyIds = [
    '7709322','11264860','11264915','11265695','11265728',
    '11266176','11266738','6597974','7722810','7550302',
    '11285359','11258511','2914453','7506725','3954859','8345982','7913725',
  ];

  // 💬 Messages (unchanged)
  const m1 = '“The face is a mask worn by the mind.” - Friedrich Nietzsche. Thank you! xoxo ₍^. .^₎⟆ ♡♡♡ Max love to you';
  const m2 = '“The face is a mask worn by the mind.” - Friedrich Nietzsche. Thank you! xoxo ₍^. .^₎⟆ ♡♡♡';
  const m3 = '“The face is a mask worn by the mind.” - Friedrich Nietzsche. Thank you! xoxo ₍^. .^₎⟆ ♡♡♡ 168h';

  const tabLabel = page._guid || 'T?'; // tab identifier
  let allProfiles = [];

  // Open base domain once (unchanged)
  await page.goto('https://v3.g.ladypopular.com', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });
  await page.waitForTimeout(2000);

  // 🔍 Collect profile IDs from rankings (UNCHANGED)
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

  // Remove duplicates (UNCHANGED)
  allProfiles = [...new Set(allProfiles)];

  // ─────────────────────────────────────────────
  // 🔁 MAIN LOOP — one profile at a time
  // ─────────────────────────────────────────────
  for (let i = 0; i < allProfiles.length; i++) {

    const profileId = allProfiles[i];
    const url = `https://v3.g.ladypopular.com/profile.php?id=${profileId}`;

    let caseType = 'case1';
    let ratingResult = null;     // true | false | null
    let messageResult = false;   // true | false
    let skipped = false;         // 🛑 NEW: safety flag
    let ladyIdUsed = null;       // 🆔 stores extracted ladyId

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(2000);

      const alreadyVotedText = await page
        .locator('.lady-rating-wraper .alreadyVoted')
        .textContent()
        .catch(() => '');

      if (alreadyVotedText.includes('won all podium prizes')) caseType = 'case2';
      else if (alreadyVotedText.includes('already 3 votes')) caseType = 'case3';

      // ⭐⭐⭐ RATING LOGIC (SAFE-GUARDED)
      if (caseType === 'case1') {
        try {
          const buttons = await page
            .locator('.lady-rating-wraper ol.rating li.active button')
            .elementHandles();

          if (buttons.length) {
            const onclickText = await buttons.at(-1).getAttribute('onclick');
            const match = onclickText.match(/podiumVote\('(\d+)',(\d+),(\d+)\)/);

            if (match) {
              const [, podiumType, ladyId, rating] = match;
              ladyIdUsed = ladyId;

              // 🚨 SAFETY CHECK — DO NOT TOUCH OWN IDs
              if (excludedLadyIds.includes(ladyId)) {
                skipped = true;
                ratingResult = null;
                messageResult = null;
              } else {
                const res = await page.evaluate(
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

                ratingResult = res?.status === 1;
              }
            }
          }
        } catch {
          ratingResult = false;
        }
      }

      // 💬 MESSAGE LOGIC (SKIPPED IF OWN ID)
      if (!skipped) {
        const message =
          caseType === 'case1' ? m1 :
          caseType === 'case2' ? m2 : m3;

        const trySendMessage = async () => {
          const messageButton = page
            .locator('.following-container .message-btn[onclick*="startPrivateChat"]')
            .first();

          const onclickAttr = await messageButton.getAttribute('onclick').catch(() => null);
          if (!onclickAttr) return false;

          const match = onclickAttr.match(/startPrivateChat\('(\d+)',\s*'([^']+)'\)/);
          if (!match) return false;

          const [, id, name] = match;

          await page.evaluate(({ id, name }) => {
            startPrivateChat(id, name);
          }, { id, name });

          try {
            await page.waitForSelector('#msgArea', { timeout: 4000 });
            await page.evaluate(msg => {
              document.getElementById('msgArea').value = msg;
              document.getElementById('_sendMessageButton').click();
            }, message);
            return true;
          } catch {
            return false;
          }
        };

        messageResult = await trySendMessage();

        if (!messageResult) {
          await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
          await page.waitForTimeout(2000);
          messageResult = await trySendMessage();
        }
      }

    } catch {
      // swallowed intentionally
    }

    // 🖨 FINAL LOGGING (CLEAR & SAFE)
    const ratingEmoji = skipped
      ? '⏭ skipped'
      : ratingResult === true ? '✅'
      : ratingResult === false ? '❌'
      : '⚪️';

    const messageEmoji = skipped
      ? '⏭ skipped'
      : messageResult ? '✅' : '❌';

    console.log(
      `${tabLabel} - (${i + 1}/${allProfiles.length}) ${url} | ${caseType} | ${ratingEmoji} ${messageEmoji}`
    );
  }

  console.log('🎉 TAB COMPLETED');
};
