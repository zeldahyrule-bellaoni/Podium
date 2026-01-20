module.exports = async function rateAndMessageLady(page) {
  // ⬅️ Update these manually in the code
  const ladyProfileUrl = 'https://v3.g.ladypopular.com/profile.php?lady_id=4904513';
  const m1 = 'Hello! Great profile 👑';          // Message for case 1
  const m2 = 'Just stopping by to say hi 👋';     // Message for case 2
  const m3 = 'Visited your profile 😉';           // Message for case 3

  console.log(`🌟 Navigating to lady's profile: ${ladyProfileUrl}`);
  await page.goto(ladyProfileUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);

  // STEP 2: Determine case
  let caseType = null;
  const alreadyVotedText = await page.locator('.lady-rating-wraper .alreadyVoted').textContent().catch(() => '');
  
  if (alreadyVotedText.includes('This lady has won all podium prizes')) {
    caseType = 'case2';
    console.log('⚠️ Lady has won all podium prizes → case 2');
  } else if (alreadyVotedText.includes('There are already 3 votes for this lady from the same IP for 168 hours')) {
    caseType = 'case3';
    console.log('⚠️ Already voted 3 times in 168 hours → case 3');
  } else {
    caseType = 'case1';
    console.log('✅ Lady can be rated → case 1');
  }

  // STEP 3: Rate the lady (only for case 1)
  if (caseType === 'case1') {
    console.log('🎯 Extracting rating options...');
    const buttons = await page.locator('.lady-rating-wraper ol.rating li.active button').elementHandles();
    
    if (buttons.length === 0) {
      console.log('❌ No active rating buttons found. Skipping rating.');
    } else {
      const onclickText = await buttons[buttons.length - 1].getAttribute('onclick'); // max rating = last button
      const regex = /podiumVote\('(\d+)',(\d+),(\d+)\)/;
      const match = onclickText.match(regex);
      
      if (!match) {
        console.log('❌ Could not parse rating info. Skipping rating.');
      } else {
        const podiumType = match[1];
        const ladyId = match[2];
        const rating = match[3];
        console.log(`🎯 Rating info: podiumType=${podiumType}, ladyId=${ladyId}, rating=${rating}`);

        const voteResult = await page.evaluate(async ({ podiumType, ladyId, rating }) => {
          const res = await fetch('/ajax/contest/podium.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              action: 'vote',
              podiumType,
              ladyId,
              rating
            })
          });
          return await res.json();
        }, { podiumType, ladyId, rating });

        if (voteResult.status === 1) {
          console.log('✅ Successfully rated the lady!');
        } else {
          console.log(`❌ Rating failed: ${voteResult.message || 'Unknown error'}`);
        }
      }
    }
  }

  // STEP 4: Send message
  console.log('💬 Sending message...');
  const messageButton = await page.locator('.following-container .message-btn[onclick*="startPrivateChat"]').first();
  if (!messageButton) {
    console.log('❌ Could not find private chat button. Skipping message.');
    return;
  }

  const onclickAttr = await messageButton.getAttribute('onclick');
  const chatMatch = onclickAttr.match(/startPrivateChat\('(\d+)',\s*'([^']+)'\)/);
  if (!chatMatch) {
    console.log('❌ Could not parse private chat info. Skipping message.');
    return;
  }

  const chatLadyId = chatMatch[1];
  const chatLadyName = chatMatch[2];
  console.log(`💬 Opening private chat with ${chatLadyName} (${chatLadyId})`);

  await page.evaluate(({ chatLadyId, chatLadyName }) => {
    startPrivateChat(chatLadyId, chatLadyName);
  }, { chatLadyId, chatLadyName });

  await page.waitForTimeout(3000);

  let messageToSend = '';
  if (caseType === 'case1') messageToSend = m1;
  if (caseType === 'case2') messageToSend = m2;
  if (caseType === 'case3') messageToSend = m3;

  console.log(`💬 Typing message: ${messageToSend}`);
  await page.evaluate((msg) => {
    const msgArea = document.getElementById('msgArea');
    if (msgArea) msgArea.value = msg;
  }, messageToSend);

  console.log('📤 Sending message...');
  await page.evaluate(() => {
    const sendBtn = document.getElementById('_sendMessageButton');
    if (sendBtn) sendBtn.click();
  });

  console.log('✅ Message sent!');
};
