const runRateAndMessageMultipleLadies =
  require('./rate-and-message-multiple-ladies.js');

module.exports = async function runMultiTab(context) {

  console.log('🧵 Starting Rate & Message (6 tabs)');

  // 🔹 Explicit, non-overlapping workloads
  const workloads = [
    [{ tierId: 5, startPage: 1,   endPage: 15  }],
    [{ tierId: 5, startPage: 16,  endPage: 30 }],
    [{ tierId: 5, startPage: 31, endPage: 45 }],
    [{ tierId: 5, startPage: 46, endPage: 60 }],
    [{ tierId: 5, startPage: 61, endPage: 75 }],
    [{ tierId: 5, startPage: 76, endPage: 90 }],
  ];

  const tabPromises = workloads.map(async (tierConfig, index) => {
    const page = await context.newPage();
    console.log(`🧵 Tab ${index + 1} launched`);

    try {
      await runRateAndMessageMultipleLadies(page, tierConfig);
      console.log(`✅ Tab ${index + 1} finished`);
    } catch (err) {
      console.log(`❌ Tab ${index + 1} failed: ${err.message}`);
      await page.screenshot({
        path: `multiTab-error-tab-${index + 1}.png`,
        fullPage: true
      });
    }
  });

  await Promise.all(tabPromises);

  console.log('🎉 All 6 tabs completed');
};
