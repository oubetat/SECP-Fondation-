import { vi } from 'vitest';

if (typeof window !== 'undefined') {
  // Use side-effect import for jest-dom matchers in browser environment
  import('@testing-library/jest-dom');
  
  // Mock ResizeObserver which is not available in jsdom
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  window.ResizeObserver = ResizeObserver;
}
