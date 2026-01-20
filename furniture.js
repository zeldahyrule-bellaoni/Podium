async function runFurniture(page) {
  function parseDollars(text) {
    text = text.toLowerCase().replace(',', '').trim();
    if (text.endsWith('k')) return parseFloat(text) * 1000;
    if (text.endsWith('m')) return parseFloat(text) * 1_000_000;
    return parseFloat(text);
  }

  const ITEM_PRICE = 260;
  const MAX_CART_ITEMS = 100;
  const MIN_LOOP_DURATION = 45000; // 45 seconds.

  while (true) {
    console.log('🛒 Navigating to cart page...');
    await page.goto('https://v3.g.ladypopular.com/mall/cart.php?action=loadMallContent');
    await page.waitForLoadState('networkidle');

    // 💰 Check if we have enough dollars
    const dollarText = await page.locator('#player-dollars').innerText();
    const dollars = parseDollars(dollarText);
    console.log(`💰 Current dollars: ${dollars}`);

    if (dollars < ITEM_PRICE * MAX_CART_ITEMS) {
      console.log('💸 Dollars below 26000. Stopping furniture loop.');
      break;
    }

    // 🛍️ Add 100 items to cart
    console.log(`📦 Adding ${MAX_CART_ITEMS} items to cart...`);
    const start = Date.now();

    for (let i = 0; i < MAX_CART_ITEMS; i++) {
      const response = await page.request.post('https://v3.g.ladypopular.com/ajax/mall/cart.php', {
        form: {
          action: 'addToCart',
          mallType: '3',
          itemId: '726',
          itemCategoryId: '19',
          itemCollectionId: '19',
          itemColor: '1',
          pageNum: '1',
          collectionsPage: 'false',
          orderBy: 'id',
          orderType: 'desc'
        }
      });

      const json = await response.json();
      if (json?.status !== 1) {
        console.warn(`⚠️ Failed to add item ${i + 1}: ${json?.message || 'unknown error'}`);
        break;
      }

      // Small delay per request (optional)
      await page.waitForTimeout(50);
    }

    // 🕒 Ensure at least 45 seconds passed
    const elapsed = Date.now() - start;
    if (elapsed < MIN_LOOP_DURATION) {
      const waitMore = MIN_LOOP_DURATION - elapsed;
      console.log(`⏳ Waiting extra ${waitMore}ms to complete 45s loop duration...`);
      await page.waitForTimeout(waitMore);
    }

    // 🔁 Reload the cart page to reflect new items
    console.log('🔄 Reloading cart page to update UI...');
    await page.goto('https://v3.g.ladypopular.com/mall/cart.php?action=loadMallContent');
    await page.waitForLoadState('networkidle');

    // 🧾 Click Buy button if available
    console.log('🪙 Waiting for Buy Items button...');
    const buyButton = page.locator('#cart-buy-btn');
    try {
      await buyButton.waitFor({ state: 'visible', timeout: 10000 });
      await buyButton.click({ force: true });
      console.log('✅ Buy button clicked.');
    } catch (err) {
      console.error('❌ Buy button not found in 10s:', err.message);
      await page.screenshot({ path: 'buy-button-error.png', fullPage: true });
      break;
    }

    // 💤 Optional wait after purchase
    await page.waitForTimeout(5000);
  }

  console.log('🏁 Furniture automation complete.');
}

module.exports = runFurniture;

