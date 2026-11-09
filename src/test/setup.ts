import { vi } from 'vitest';
import { initializeAuthorityHandshake } from '../engine/simulation/SimulationAuthorityInternal';

// Initialize simulation authority for all tests
initializeAuthorityHandshake();

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
