/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { InteractiveEngineeringWorkbench } from '../InteractiveEngineeringWorkbench';
import React from 'react';

// Mock canvas getContext in JSDOM
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    fillText: vi.fn(),
    strokeRect: vi.fn(),
    closePath: vi.fn(),
  }) as any;

  window.ResizeObserver = class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  };
});

// Mock CadViewport3D because it uses Three.js which is hard to test in jsdom without canvas mocks
vi.mock('../CadViewport3D', () => ({
  CadViewport3D: () => <div data-testid="cad-viewport">Mocked Viewport</div>
}));

describe('InteractiveEngineeringWorkbench Data Consumption', () => {
  it('updates electrothermal results when voltage is changed', async () => {
    render(<InteractiveEngineeringWorkbench />);
    
    // Check initial state
    const voltageDisplay = screen.getByText(/24.0 V/);
    expect(voltageDisplay).toBeInTheDocument();
    
    // Find voltage slider (range input)
    const sliders = screen.getAllByRole('slider');
    const voltageSlider = sliders.find(s => (s as HTMLInputElement).value === '24');
    
    if (!voltageSlider) throw new Error('Voltage slider not found');
    
    // Change voltage to 48V
    fireEvent.change(voltageSlider, { target: { value: '48' } });
    
    // Check if UI updated
    expect(screen.getByText(/48.0 V/)).toBeInTheDocument();
    
    // The component uses useMemo to recalculate electrothermalResult
    const convergedCard = screen.getByText('Converged Junction T_j').closest('div');
    const tempMatch = convergedCard?.textContent?.match(/([0-9.]+) °C/);
    const convergedTemp = parseFloat(tempMatch ? tempMatch[1] : '0');
    
    // Ambient is 25°C, higher voltage yields significant Joule heating (>> 25°C)
    expect(convergedTemp).toBeGreaterThan(25);
  });

  it('detects adversarial input and updates the ledger log', async () => {
    render(<InteractiveEngineeringWorkbench />);
    
    // Navigate to Ledger Audit tab
    const ledgerTabButton = screen.getByText(/Evidence Ledger & Invalidation/);
    fireEvent.click(ledgerTabButton);
    
    // Click "Mutate Input Voltage" button
    const mutateButton = screen.getByText(/Mutate Input Voltage/);
    fireEvent.click(mutateButton);
    
    // Check if the mutation log contains the rejected entry
    expect(await screen.findByText(/STALE_REJECTED/)).toBeInTheDocument();
    expect(await screen.findByText(/EvidenceIntegrityChecker verdict=INVALID/i)).toBeInTheDocument();
  });
});
