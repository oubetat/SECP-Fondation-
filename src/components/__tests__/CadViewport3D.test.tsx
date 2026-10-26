/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { CadViewport3D, SimulationData } from '../CadViewport3D';

// Mock WebGL and 2D canvas context for Three.js & Fallback engine in JSDOM
beforeAll(() => {
  const mock2DContext = {
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    getImageData: vi.fn(),
    putImageData: vi.fn(),
    createImageData: vi.fn(),
    setTransform: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    fillText: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    strokeRect: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    scale: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 0 }),
    transform: vi.fn(),
    resetTransform: vi.fn(),
  };

  const mockWebGLContext = {
    getExtension: vi.fn(),
    getParameter: vi.fn().mockReturnValue(16),
    getShaderPrecisionFormat: vi.fn().mockReturnValue({
      precision: 23,
      rangeMin: 127,
      rangeMax: 127,
    }),
    createTexture: vi.fn(),
    bindTexture: vi.fn(),
    texParameteri: vi.fn(),
    texImage2D: vi.fn(),
    clearColor: vi.fn(),
    clearDepth: vi.fn(),
    clear: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    depthFunc: vi.fn(),
    frontFace: vi.fn(),
    cullFace: vi.fn(),
    viewport: vi.fn(),
    createShader: vi.fn(),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn().mockReturnValue(true),
    createProgram: vi.fn(),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn().mockReturnValue(true),
    useProgram: vi.fn(),
    createBuffer: vi.fn(),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
  };

  HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation((type: string) => {
    if (type === '2d') {
      return mock2DContext as any;
    }
    return mockWebGLContext as any;
  }) as any;

  window.ResizeObserver = class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  };
});

describe('CadViewport3D Simulation Data Consumption', () => {
  it('renders without ReferenceError when simulationResults is provided', () => {
    const mockSimulationData: SimulationData = {
      type: 'THERMAL',
      values: [25.0, 45.2, 78.4, 95.1],
      minValue: 25.0,
      maxValue: 100.0,
      unit: '°C',
    };

    const mockSolid = {
      id: 'TEST_SOLID',
      name: 'Heat Sink Solid',
      type: 'BOX' as const,
      dimensions: { dx: 0.1, dy: 0.1, dz: 0.05 },
      mesh: {
        vertices: [0, 0, 0, 1, 0, 0, 1, 1, 0],
        normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
        indices: [0, 1, 2],
      },
    };

    expect(() => {
      render(
        <CadViewport3D
          activeProjectType="SIMULATION"
          activeSolid={mockSolid}
          simulationResults={mockSimulationData}
        />
      );
    }).not.toThrow();
  });

  it('renders cleanly when simulationResults is null or undefined', () => {
    expect(() => {
      render(
        <CadViewport3D
          activeProjectType="BLANK"
          simulationResults={null}
        />
      );
    }).not.toThrow();

    expect(() => {
      render(
        <CadViewport3D
          activeProjectType="BLANK"
          simulationResults={undefined}
        />
      );
    }).not.toThrow();
  });

  it('correctly maps stress simulation data to vertex colors', () => {
    const stressSimulationData: SimulationData = {
      type: 'STRESS',
      values: [100e6, 250e6, 400e6],
      minValue: 0,
      maxValue: 500e6,
      unit: 'Pa',
    };

    const mockSolid = {
      id: 'BRACKET_SOLID',
      name: 'Bracket Solid',
      type: 'BOX' as const,
      dimensions: { dx: 0.2, dy: 0.1, dz: 0.05 },
      mesh: {
        vertices: [0, 0, 0, 1, 0, 0, 1, 1, 0],
        normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
        indices: [0, 1, 2],
      },
    };

    expect(() => {
      render(
        <CadViewport3D
          activeProjectType="SIMULATION"
          activeSolid={mockSolid}
          simulationResults={stressSimulationData}
        />
      );
    }).not.toThrow();
  });
});
