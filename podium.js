/**
 * Rate & Message Ladies Script (Podium)
 * ----------------------------------------
 * - Iterates through tierIds and page ranges (manual input)
 * - Fetches ranking pages via internal POST (no clicks)
 * - Extracts lady info from returned HTML
 * - Applies eligibility checks
 * - Rates via internal POST (6 → 3)
 * - Categorizes lady (Type 1 / Type 2)
 * - Opens private chat & sends message
 */

module.exports = async function runPodium(page) {

  // =========================
  // STEP 0 — MANUAL INPUTS
  // =========================

  // INPUT 1 — Tier & Page Ranges
  const TIERS = [
    { tierId: 1, startPage: 1, endPage: 2 },
    { tierId: 2, startPage: 1, endPage: 1 },
  ];

  // INPUT 2 — Exclusion Set (own / protected accounts)
  const EXCLUDED = {
    ids: new Set([
      6520966, // Katarina L.
      789012,
    ]),
    names: new Set([
      'Brenda Walsh',
      'MyAlt2',
    ])
  };

  // INPUT 3 — Messages
  const m1 = "Hey 😊 I left start for you! 💖";
  const m2 = "Hi there 🌸 visited you!";

  // Rating attempts (max → min)
  const RATING_ATTEMPTS = [6, 5, 4, 3];

  // Small random delay helper
  const randomDelay = async (min = 300, max = 900) => {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await page.waitForTimeout(delay);
  };

  console.log("🚀 Podium script started");

  // =========================
  // STEP 1–8 — MAIN FLOW
  // =========================

  for (const { tierId, startPage, endPage } of TIERS) {
    console.log(`🏷️ Tier ${tierId} | Pages ${startPage} → ${endPage}`);

    for (let pageNum = startPage; pageNum <= endPage; pageNum++) {

      // STEP 2 — Fetch ranking page (SAFE JSON PARSE)
      const rankingRes = await page.evaluate(async ({ tierId, pageNum }) => {
        const res = await fetch('/ajax/ranking/players.php', {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: new URLSearchParams({
            action: 'getRanking',
            tierId,
            page: pageNum,
          }),
        });

        const text = await res.text();

        try {
          return JSON.parse(text);
        } catch {
          return { error: true, raw: text };
        }
      }, { tierId, pageNum });

      if (rankingRes?.error || !rankingRes?.html) {
        console.log(`⚠️ Tier ${tierId} Page ${pageNum}: Invalid or empty response`);
        await randomDelay(2000, 3500);
        continue;
      }

      // STEP 3 — Parse ladies from HTML
      const ladies = await page.evaluate((html) => {
        const container = document.createElement('div');
        container.innerHTML = html;

        const rows = [...container.querySelectorAll('tr[id^="num"]')];

        return rows.map(row => {
          const chatBtn = row.querySelector('button[onclick^="startPrivateChat"]');
          if (!chatBtn) return null;

          const onclick = chatBtn.getAttribute('onclick');
          const match = onclick.match(/startPrivateChat\((\d+),\s*'([^']+)'\)/);
          if (!match) return null;

          const ladyId = parseInt(match[1], 10);
          const name = match[2];

          const guildCell = row.querySelector('.ranking-player-guild');
          const inGuild = !!guildCell?.querySelector('a[href*="guilds.php"]');

          return { ladyId, name, inGuild };
        }).filter(Boolean);
      }, rankingRes.html);

      // STEP 4–7 — Process each lady
      for (const lady of ladies) {

        // Eligibility checks
        let eligible = true;
        if (!lady.inGuild) eligible = false;
        if (EXCLUDED.ids.has(lady.ladyId) || EXCLUDED.names.has(lady.name)) {
          eligible = false;
        }

        let ladyType = 'SKIPPED';
        let rated = false;
        let messageSent = false;

        if (eligible) {

          // STEP 4 — Rate (internal POST)
          for (const rating of RATING_ATTEMPTS) {
            const voteRes = await page.evaluate(async ({ ladyId, rating }) => {
              const res = await fetch('/ajax/contest/podium.php', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                  'X-Requested-With': 'XMLHttpRequest',
                },
                body: new URLSearchParams({
                  action: 'vote',
                  podiumType: 4,
                  ladyId,
                  rating,
                }),
              });

              const text = await res.text();
              try {
                return JSON.parse(text);
              } catch {
                return { error: true };
              }
            }, { ladyId: lady.ladyId, rating });

            if (voteRes?.status === 1) {
              rated = true;
              ladyType = 'TYPE 1';
              break;
            }

            await randomDelay(150, 300);
          }

          if (!rated) {
            ladyType = 'TYPE 2';
          }

          // STEP 5 — Open chat & send message
          try {
            await page.evaluate(({ id, name }) => {
              window.startPrivateChat(id, name);
            }, { id: lady.ladyId, name: lady.name });

            await page.waitForSelector('#msgArea', { timeout: 10000 });

            const message = ladyType === 'TYPE 1' ? m1 : m2;

            await page.evaluate((msg) => {
              document.getElementById('msgArea').value = msg;
              document.getElementById('_sendMessageButton').click();
            }, message);

            messageSent = true;
          } catch {
            messageSent = false;
          }
        }

        // STEP 8 — Log result
        console.log(
          `👩 ${lady.name} (${lady.ladyId}) | Guild: ${lady.inGuild ? '▶️' : 'N'} | ` +
          `Type: ${ladyType} | Rated: ${rated ? '🟢' : 'N'} | Msg: ${messageSent ? '🟢' : 'N'}`
        );

        await randomDelay();
      }
    }
  }

  console.log("🎉 Podium script completed.");
};
