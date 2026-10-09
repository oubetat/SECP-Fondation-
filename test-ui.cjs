const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  
  await page.goto('http://localhost:3000', {waitUntil: 'networkidle0'});
  
  // click hamburger menu to check if tabs are there
  const menuBtn = await page.$('button[title="Toggle Sidebar"]');
  if (menuBtn) {
    console.log('Hamburger menu found! Clicking it...');
    await menuBtn.click();
    await new Promise(r => setTimeout(r, 500));
  } else {
    console.log('No hamburger menu found');
  }
  
  await browser.close();
})();
