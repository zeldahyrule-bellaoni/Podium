const runRateAndMessageMultipleLadies =
  require('./rate-and-message-multiple-ladies.js');

module.exports = async function runMultiTab(context) {

  console.log('🧵 Starting Rate & Message (6 tabs)');

  // 🔹 Explicit, non-overlapping workloads
  const workloads = [
    [{ tierId: 10, startPage: 1,   endPage: 50  }],
    [{ tierId: 10, startPage: 51,  endPage: 100 }],
    [{ tierId: 10, startPage: 101, endPage: 150 }],
    [{ tierId: 10, startPage: 151, endPage: 200 }],
    [{ tierId: 10, startPage: 201, endPage: 250 }],
    [{ tierId: 10, startPage: 251, endPage: 293 }],
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
