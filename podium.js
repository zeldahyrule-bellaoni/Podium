/**
 * Rate & Message Ladies Script (Podium) — Optimized
 * ----------------------------------------
 * - Faster processing per page
 * - Combines chat open + send message
 * - Skips/reduces delays for skipped ladies
 * - Keeps original logic intact
 */

module.exports = async function runPodium(page) {
  // =========================
  // STEP 0 — MANUAL INPUTS
  // =========================

  const TIERS = [
    { tierId: 10, startPage: 11, endPage: 20 },
    // add more tiers as needed
  ];

  const EXCLUDED = {
    ids: new Set([6520966, 789012]),
    names: new Set(['Brenda Walsh', 'MyAlt2'])
  };

  const m1 = "Hey 😊 I left start for you! 💖";
  const m2 = "Hi there 🌸 visited you!";

  const RATING_ATTEMPTS = [6, 5, 4, 3];

  // Small random delay
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

      // STEP 2 — Fetch ranking page
      const rankingRes = await page.evaluate(async ({ tierId, pageNum }) => {
        try {
          const res = await fetch('/ajax/ranking/players.php', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
            body: new URLSearchParams({ action: 'getRanking', tierId, page: pageNum })
          });
          const text = await res.text();
          return JSON.parse(text);
        } catch {
          return { error: true };
        }
      }, { tierId, pageNum });

      if (rankingRes?.error || !rankingRes?.html) {
        console.log(`⚠️ Tier ${tierId} Page ${pageNum}: Invalid or empty response`);
        await randomDelay(2000, 3500);
        continue;
      }

      // STEP 3 — Parse ladies efficiently
      const ladies = await page.evaluate((html) => {
        const rows = [...html.matchAll(/startPrivateChat\((\d+),\s*'([^']+)'\)/g)];
        return Array.from(rows).map(match => {
          const ladyId = parseInt(match[1], 10);
          const name = match[2];

          // check guild presence by looking at surrounding <tr>
          const rowIndex = html.indexOf(match[0]);
          const snippet = html.slice(Math.max(0, rowIndex - 200), rowIndex + 200);
          const inGuild = /href="\/guilds\.php/.test(snippet);

          return { ladyId, name, inGuild };
        });
      }, rankingRes.html);

      // STEP 4–7 — Process each lady
      for (const lady of ladies) {

        const eligible = lady.inGuild && !EXCLUDED.ids.has(lady.ladyId) && !EXCLUDED.names.has(lady.name);

        let ladyType = 'SKIPPED';
        let rated = false;
        let messageSent = false;

        if (eligible) {

          // STEP 4 — Rate (attempt 6→3)
          for (const rating of RATING_ATTEMPTS) {
            const voteRes = await page.evaluate(async ({ ladyId, rating }) => {
              try {
                const res = await fetch('/ajax/contest/podium.php', {
                  method: 'POST',
                  credentials: 'same-origin',
                  headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
                  body: new URLSearchParams({ action: 'vote', podiumType: 4, ladyId, rating })
                });
                return await res.json();
              } catch {
                return { error: true };
              }
            }, { ladyId: lady.ladyId, rating });

            if (voteRes?.status === 1) {
              rated = true;
              ladyType = 'TYPE 1';
              break;
            }

            await randomDelay(100, 200);
          }

          if (!rated) ladyType = 'TYPE 2';

          // STEP 5 — Open chat & send message in single evaluate
          try {
            await page.evaluate(({ id, name, msg }) => {
              window.startPrivateChat(id, name);
              const sendMessage = () => {
                const textarea = document.getElementById('msgArea');
                const sendBtn = document.getElementById('_sendMessageButton');
                if (textarea && sendBtn) {
                  textarea.value = msg;
                  sendBtn.click();
                  return true;
                }
                return false;
              };
              sendMessage();
            }, { id: lady.ladyId, name: lady.name, msg: ladyType === 'TYPE 1' ? m1 : m2 });

            messageSent = true;
          } catch {
            messageSent = false;
          }
        }

        // STEP 8 — Compact log per lady
        console.log(
          `👩 ${lady.name} (${lady.ladyId}) | Guild: ${lady.inGuild ? '▶️' : 'N'} | ` +
          `Type: ${ladyType} | Rated: ${rated ? '🟢' : 'N'} | Msg: ${messageSent ? '🟢' : 'N'}`
        );

        // Random delay only if lady was processed
        if (eligible) await randomDelay();
        else await randomDelay(0, 150); // minimal delay for skipped ladies
      }
    }
  }

  console.log("🎉 Podium script completed.");
};
