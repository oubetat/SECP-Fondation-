const puppeteer = require('puppeteer');

(async () => {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    const errors = [];
    const unhandledRejections = [];

    page.on('pageerror', err => {
      errors.push(err.toString());
    });
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Error') || text.includes('error') || text.includes('Exception')) {
        // console.log('CONSOLE ERROR:', text);
      }
    });

    console.log('Navigating to http://localhost:3000 ...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 30000 });

    // Check if startup error overlay is present
    const startupErr = await page.evaluate(() => {
      const el = document.getElementById('startup-error-overlay');
      return el ? el.innerText : null;
    });
    if (startupErr) {
      console.log('STARTUP ERROR FOUND:', startupErr);
    }

    // Get list of all patch tabs from the UI or window
    const patchTabs = await page.evaluate(() => {
      // Find all buttons in the nav
      const select = document.querySelector('select');
      if (select) {
        select.value = 'ALL';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const nav = document.querySelector('nav');
      if (!nav) return [];
      const buttons = Array.from(nav.querySelectorAll('button'));
      return buttons.map((b, idx) => {
        const text = b.innerText.split('\n');
        return {
          idx,
          label: text[0] || '',
          idText: text[1] || text[0] || ''
        };
      });
    });

    console.log(`Found ${patchTabs.length} tabs to test.`);
    const failingTabs = [];

    for (let i = 0; i < patchTabs.length; i++) {
      const tab = patchTabs[i];
      // Click tab i
      const tabResult = await page.evaluate(async (tabIdx) => {
        const nav = document.querySelector('nav');
        if (!nav) return { error: 'No nav found' };
        const buttons = nav.querySelectorAll('button');
        const btn = buttons[tabIdx];
        if (!btn) return { error: 'Button not found' };
        btn.click();
        await new Promise(r => setTimeout(r, 200));

        // Check for error overlay
        const overlay = document.getElementById('startup-error-overlay');
        const hasOverlay = !!overlay && overlay.style.display !== 'none';
        const overlayText = hasOverlay ? overlay.innerText : null;

        // Check for isolated error boundary
        const isolatedErr = document.querySelector('[id*="error"], .text-rose-400, .bg-rose-950\\/30');
        let errorMsg = null;
        if (document.body.innerText.includes('تعذر تحميل بيئة العمل') || document.body.innerText.includes('Workbench Runtime Error')) {
          const diag = Array.from(document.querySelectorAll('div, p, pre')).find(el => el.innerText && el.innerText.includes('TypeError'));
          errorMsg = diag ? diag.innerText : 'Workbench Runtime Error';
        }

        return {
          hasOverlay,
          overlayText,
          errorMsg
        };
      }, i);

      if (tabResult.hasOverlay || tabResult.errorMsg) {
        console.log(`❌ TAB FAILED [${i}] ${tab.label} (${tab.idText}):`);
        if (tabResult.hasOverlay) console.log(`   Overlay Error: ${tabResult.overlayText?.slice(0, 150)}`);
        if (tabResult.errorMsg) console.log(`   Runtime Error: ${tabResult.errorMsg?.slice(0, 150)}`);
        failingTabs.push({
          idx: i,
          tab,
          result: tabResult
        });
      }
    }

    console.log(`\n========================================`);
    console.log(`TEST COMPLETED. Total failing tabs: ${failingTabs.length}`);
    console.log(`========================================`);
  } catch (err) {
    console.error('Puppeteer test crashed:', err);
  } finally {
    if (browser) await browser.close();
  }
})();
