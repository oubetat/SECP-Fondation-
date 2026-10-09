import React from 'react';
import ReactDOMServer from 'react-dom/server';
import App from '../src/App';

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
          toDataURL: () => '',
        };
      }
      return { style: {}, appendChild: () => {} };
    },
    getElementById: () => null,
    body: { appendChild: () => {} },
  };
}

const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

const tabList: string[] = ['PATCH-008', 'PATCH-043', 'PATCH-176', 'PATCH-233', 'PATCH-276'];

async function verifyTargetedTabs() {
  originalConsoleLog('=== SECP INDUSTRIAL OS - TARGETED TABS RENDER VERIFICATION ===');
  originalConsoleLog('Checking specific tabs: ' + tabList.join(', ') + '\n');

  let passedCount = 0;
  let failedCount = 0;
  const failures: { tab: string; error: string }[] = [];

  for (const tab of tabList) {
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
        originalConsoleLog(`❌ [${tab}] RENDERED EMPTY HTML`);
        failedCount++;
        failures.push({ tab, error: 'Empty HTML output' });
      }
    } catch (err: any) {
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;

      const errMsg = err?.stack || err?.message || String(err);
      originalConsoleLog(`❌ [${tab}] FATAL CRASH: ${errMsg}`);
      failedCount++;
      failures.push({ tab, error: errMsg });
    }
  }

  originalConsoleLog('\nSUMMARY: ' + passedCount + ' PASSED / ' + failedCount + ' FAILED');
  if (failures.length > 0) {
     process.exit(1);
  }
}

verifyTargetedTabs();
