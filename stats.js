// recruit-ladies-playwright.js
module.exports = async function runStatsExtractor(page) {
  // -------------------------------
  // Phase 1: Profile ID Extraction
  // -------------------------------
  console.log("🚀 Starting Phase 1: Profile ID Extraction (IN Club)");

  const startPage = 1; // change
  const endPage = 2; // change
  const tierId = 10;    // change
  let allProfiles = [];

  await page.goto('https://v3.g.ladypopular.com', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });
  await page.waitForTimeout(4000);

  console.log(`🔍 Scanning pages ${startPage} → ${endPage}`);

  for (let currentPage = startPage; currentPage <= endPage; currentPage++) {
    console.log(`📄 Processing page ${currentPage}...`);

    try {
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

            // ✅ CHANGE: keep ONLY ladies who ARE in a club
            const clubLink = guildCell.querySelector('a[href*="guilds.php"]');
            if (!clubLink) return;

            const idMatch = profileLink
              .getAttribute('href')
              .match(/id=(\d+)/);
            if (!idMatch) return;

            const nameEl = row.querySelector('.player-avatar-name');
            const name = nameEl ? nameEl.textContent.trim() : 'Unknown';

            results.push({
              profileId: idMatch[1],
              name
            });
          });

          return results;
        },
        { currentPage, tierId }
      );

      console.log(`   🎯 Found ${profilesOnPage.length} profiles in a club`);
      allProfiles.push(...profilesOnPage);
    } catch (err) {
      console.log(`❌ Error on page ${currentPage}: ${err.message}`);
    }

    await page.waitForTimeout(2000);
  }

  console.log("✅ Phase 1 Complete");
  console.log(`👭 Total profiles in a club: ${allProfiles.length}`);
  console.log("📋 Sample output:", allProfiles.slice(0, 5));

  // -------------------------------
  // Phase 2: Extract Lady IDs (View Outfit Button)
  // -------------------------------
  console.log(`🚀 Starting Phase 2: Extract Lady IDs from view outfit button`);
  let allLadies = [];

  for (let i = 0; i < allProfiles.length; i++) {
    const profile = allProfiles[i];
    console.log(
      `📄 Visiting profile ${i + 1}/${allProfiles.length}: ${profile.name} (${profile.profileId})`
    );

    try {
      const profileUrl = `https://v3.g.ladypopular.com/profile.php?id=${profile.profileId}`;
      await page.goto(profileUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
      await page.waitForTimeout(2000);

      const ladyId = await page.evaluate(() => {
        const button = document.querySelector('button[data-tag="view_outfit"]');
        return button ? button.getAttribute('data-lady-id') : null;
      });

      if (ladyId) {
        console.log(`   🆔 Found Lady ID: ${ladyId}`);
        allLadies.push({ name: profile.name, ladyId });
      } else {
        console.log(
          `⚠️ Could not find Lady ID for ${profile.name} (${profile.profileId})`
        );
      }
    } catch (err) {
      console.log(
        `❌ Error processing profile ${profile.name} (${profile.profileId}): ${err.message}`
      );
    }

    await page.waitForTimeout(1500);
  }

  console.log(`✅ Phase 2 Complete. Total Lady IDs found: ${allLadies.length}`);
  console.log("📋 Sample output:", allLadies.slice(0, 5));

  // -------------------------------
  // Phase 3: Sending Invites
  // -------------------------------
  if (allLadies.length === 0) {
    console.log("❌ No ladies to invite. Phase 3 skipped.");
    return;
  }

  console.log(`🚀 Starting Phase 3: Sending invites to ${allLadies.length} ladies`);

  const inviteMessage = `Hi sweetie! We’d love to have you join our club. Donations are completely voluntary, and we have plenty of club fights where you can really showcase your strength. The only requirement is that you participate most of the club fights. Hope to see you with us! ✨`;

  for (let i = 0; i < allLadies.length; i++) {
    const lady = allLadies[i];
    console.log(`📤 Sending invite ${i + 1}/${allLadies.length}`);
    console.log(`   👩 Name: ${lady.name}`);
    console.log(`   🆔 Lady ID: ${lady.ladyId}`);
    console.log(`   🌐 Current page: ${await page.url()}`);

    try {
      const res = await page.evaluate(
        async ({ ladyId, message }) => {
          const response = await fetch('/ajax/guilds.php', {
            method: 'POST',
            body: new URLSearchParams({
              type: 'invite',
              lady: ladyId,
              message
            }),
            credentials: 'same-origin'
          });
          return await response.json();
        },
        { ladyId: lady.ladyId, message: inviteMessage }
      );

      console.log(`   📝 Response: ${JSON.stringify(res)}`);
      if (res.status === 1) {
        console.log(`✅ Invite sent to ${lady.name} (${lady.ladyId})`);
      } else {
        console.log(
          `⚠️ Failed to send invite to ${lady.name} (${lady.ladyId}): ${res.message || 'Unknown error'}`
        );
      }
    } catch (err) {
      console.log(
        `❌ Error sending invite to ${lady.name} (${lady.ladyId}): ${err.message}`
      );
    }

    await page.waitForTimeout(2000);
  }

  console.log("✅ Phase 3 Complete. All invites processed.");
};
