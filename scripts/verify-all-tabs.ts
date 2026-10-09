import React from 'react';
import ReactDOMServer from 'react-dom/server';
import App from '../src/App';
import * as fs from 'fs';
import * as path from 'path';

// Setup minimal DOM mocks for React SSR
if (typeof window === 'undefined') {
  (global as any).window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    setTimeout: global.setTimeout,
    clearTimeout: global.clearTimeout,
    setInterval: global.setInterval,
    clearInterval: global.clearInterval,
    requestAnimationFrame: (cb: any) => setTimeout(cb, 16),
    cancelAnimationFrame: (id: any) => clearTimeout(id),
    matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    location: { href: 'http://localhost:3000' },
  };
}

if (typeof document === 'undefined') {
  (global as any).document = {
    createElement: (tag: string) => {
      if (tag === 'canvas') {
        return {
          getContext: () => ({
            fillRect: () => {},
            clearRect: () => {},
            getImageData: () => ({ data: new Uint8ClampedArray(4) }),
            putImageData: () => {},
            createImageData: () => ([]),
            setTransform: () => {},
            drawImage: () => {},
            save: () => {},
            fillText: () => {},
            restore: () => {},
            beginPath: () => {},
            moveTo: () => {},
            lineTo: () => {},
            closePath: () => {},
            stroke: () => {},
            translate: () => {},
            scale: () => {},
            rotate: () => {},
            arc: () => {},
            fill: () => {},
            measureText: () => ({ width: 10 }),
            transform: () => {},
            rect: () => {},
            clip: () => {},
          }),
          width: 800,
          height: 600,
          style: {},
          addEventListener: () => {},
          removeEventListener: () => {},
        };
      }
      return {
        style: {},
        setAttribute: () => {},
        getAttribute: () => null,
        appendChild: () => {},
        removeChild: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
      };
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    documentElement: { style: {} },
    body: { style: {}, appendChild: () => {} },
  };
}

// Extract exact registered tabs from App.tsx
const appSource = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf-8');
const tabMatches = appSource.match(/activePatchTab === '([^']+)'/g) || [];
const allTabs: string[] = Array.from(new Set(tabMatches.map(m => m.replace("activePatchTab === '", "").replace("'", "")))).sort();

const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

async function verifyAllTabs() {
  originalConsoleLog('=== SECP INDUSTRIAL OS - CANONICAL 175 WORKBENCH VERIFICATION ===');
  originalConsoleLog(`Discovered ${allTabs.length} canonically registered Workbench tabs in App.tsx.\n`);

  let passedCount = 0;
  let failedCount = 0;
  const failures: { tab: string; error: string }[] = [];

  for (const tab of allTabs) {
    try {
      console.log = () => {};
      console.error = () => {};
      console.warn = () => {};

      const element = React.createElement(App, { initialPatchTab: tab });
      const html = ReactDOMServer.renderToString(element);

      console.log = originalConsoleLog;
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;

      if (html && html.length > 0) {
        originalConsoleLog(`✅ [${tab}] PASSED`);
        passedCount++;
      } else {
        originalConsoleLog(`❌ [${tab}] FAILED: Empty render output`);
        failedCount++;
        failures.push({ tab, error: 'Empty render output' });
      }
    } catch (err: any) {
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;

      const errMsg = err?.message || String(err);
      originalConsoleLog(`❌ [${tab}] FATAL CRASH: ${errMsg}`);
      failedCount++;
      failures.push({ tab, error: errMsg });
    }
  }

  originalConsoleLog('\n==================================================');
  originalConsoleLog(`VERIFICATION SUMMARY: ${passedCount} PASSED / ${failedCount} FAILED out of ${allTabs.length} Tabs`);
  originalConsoleLog('==================================================');

  if (failures.length > 0) {
    originalConsoleLog('\nFAILED TABS DETAILS:');
    failures.forEach(f => originalConsoleLog(`- ${f.tab}: ${f.error}`));
  } else {
    originalConsoleLog(`\n🎉 ALL ${allTabs.length} REGISTERED WORKBENCHES PASSED AUTOMATED UI RENDER VERIFICATION!`);
  }
  process.exit(failedCount > 0 ? 1 : 0);
}

verifyAllTabs();
