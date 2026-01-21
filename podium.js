/**
 * Collect Ladies Data Script (Podium)
 * ----------------------------------------
 * - Iterates through tierIds and page ranges
 * - Fetches ranking pages via internal POST
 * - Extracts lady info from returned HTML
 * - Logs info for in-club ladies only
 */

module.exports = async function runPodium(page) {

  // =========================
  // STEP 0 — MANUAL INPUTS
  // =========================

  const TIERS = [
    { tierId: 10, startPage: 1, endPage: 293 },
    { tierId: 9, startPage: 1, endPage: 87 },
    { tierId: 8, startPage: 1, endPage: 90 },
    { tierId: 7, startPage: 1, endPage: 127 },
    // Add other tiers as needed
  ];

  const EXCLUDED = {
    ids: new Set([6520966, 789012]),  // optional exclusions
    names: new Set(['Brenda Walsh', 'MyAlt2'])
  };

  const randomDelay = async (min = 300, max = 900) => {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await page.waitForTimeout(delay);
  };

  console.log("🚀 Podium Data Collection started");

  // =========================
  // MAIN FLOW — Collect Only
  // =========================

  for (const { tierId, startPage, endPage } of TIERS) {
    console.log(`🏷️ Tier ${tierId} | Pages ${startPage} → ${endPage}`);

    for (let pageNum = startPage; pageNum <= endPage; pageNum++) {

      // Fetch ranking page
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

      // Parse ladies from HTML
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

      // Process each lady — only log essentials
      for (const lady of ladies) {
        if (EXCLUDED.ids.has(lady.ladyId) || EXCLUDED.names.has(lady.name)) continue;

        // Log info
        console.log(
          `👩 ${lady.name} (${lady.ladyId}) | Guild: ${lady.inGuild ? '▶️' : 'N'}`
        );
      }

      await randomDelay();
    }
  }

  console.log("🎉 Data collection completed.");
};
