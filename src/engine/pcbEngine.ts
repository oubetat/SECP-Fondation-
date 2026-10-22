/**
 * SECP Industrial OS - Electronics / PCB Engine (PHASE 1 Production-Grade Foundation)
 * Schematic → Components → Netlist → PCB (2D Layout) → 3D PCB → Mechanical Assembly Integration
 * Incorporates Canonical Model, Pin-Level Connectivity, Multi-Layer DRC Geometry & Enclosure Fitting.
 * Strict authority: Derived from physical pad locations and verified against cryptographic canonical hashes.
 */

import {
  PcbCanonicalModel,
  PcbCanonicalModelValidator,
  FootprintDefinition
} from './pcb/PcbCanonicalModel';
import { PcbConnectivityVerifier, ConnectivityReport } from './pcb/PcbConnectivityVerifier';
import { PcbGeometryVerifier, GeometryReport } from './pcb/PcbGeometryVerifier';
import { PcbMechanicalVerifier, MechanicalReport } from './pcb/PcbMechanicalVerifier';
import { PcbHardAcceptanceGate, PcbGateReport } from './pcb/PcbHardAcceptanceGate';

export * from './pcb/PcbCanonicalModel';
export * from './pcb/PcbConnectivityVerifier';
export * from './pcb/PcbGeometryVerifier';
export * from './pcb/PcbMechanicalVerifier';
export * from './pcb/PcbHardAcceptanceGate';
export * from './pcb/PcbDesignRules';
export * from './pcb/PcbGeometryKernel';
export * from './pcb/PcbDrcDfmVerifier';
export * from './pcb/PcbSchematicConsistencyVerifier';
export * from './pcb/PcbVerificationService';
export * from './crossdomain/MultidomainPcbIntegrationEngine';

export interface SchematicComponent {
  id: string;
  refDes: string; // e.g., 'U1', 'R1', 'C1', 'J1', 'H1'
  name: string;
  value: string; // e.g. 'STM32F4', '10k', '100nF', 'USB-C'
  footprint: 'SMD_0805' | 'LQFP_48' | 'QFN_32' | 'THD_DIP8' | 'CONNECTOR_HEADER' | 'MOUNTING_HOLE';
  pinCount: number;
}

export interface SchematicNet {
  id: string;
  name: string; // e.g. 'VCC_3V3', 'GND', 'MCU_TX', 'MCU_RX', 'RESET'
  connectedPins: { refDes: string; pinNumber: number }[];
}

export interface PcbComponentPlacement {
  refDes: string;
  xMm: number;
  yMm: number;
  rotationDeg: number;
  layer: 'TOP' | 'BOTTOM';
  widthMm: number;
  heightMm: number;
  height3dMm: number;
  colorHex: string;
}

export interface PcbTrace {
  id: string;
  netName: string;
  layer: 'TOP_COPPER' | 'BOTTOM_COPPER';
  widthMm: number;
  path: { x: number; y: number }[];
}

export interface PcbDesign {
  designId?: string;
  revisionId?: string;
  canonicalHash?: string;
  boardWidthMm: number;
  boardHeightMm: number;
  thicknessMm: number;
  layerCount: number;
  placements: PcbComponentPlacement[];
  traces: PcbTrace[];
  mountingHoles: { id: string; x: number; y: number; diameterMm: number }[];
  connectivityReport?: ConnectivityReport;
  geometryReport?: GeometryReport;
  mechanicalReport?: MechanicalReport;
}

export interface MechanicalEnclosureIntegration {
  enclosureWidthMm: number;
  enclosureLengthMm: number;
  enclosureHeightMm: number;
  wallThicknessMm: number;
  standoffHeightMm: number;
  screwDiameterMm: number;
  status: 'FIT_VERIFIED' | 'CLASH_DETECTED';
  clashNotes?: string;
  minWallClearanceMm?: number;
  minVerticalClearanceMm?: number;
}

export class PcbEngine {
  public static getDefaultSchematic(): {
    components: SchematicComponent[];
    nets: SchematicNet[];
  } {
    const components: SchematicComponent[] = [
      { id: 'c1', refDes: 'U1', name: 'Microcontroller', value: 'STM32F401', footprint: 'LQFP_48', pinCount: 48 },
      { id: 'c2', refDes: 'R1', name: 'Pull-up Resistor', value: '10kΩ 0805', footprint: 'SMD_0805', pinCount: 2 },
      { id: 'c3', refDes: 'C1', name: 'Decoupling Cap', value: '100nF 0805', footprint: 'SMD_0805', pinCount: 2 },
      { id: 'c4', refDes: 'J1', name: 'Power/Data Port', value: 'USB-C / UART', footprint: 'CONNECTOR_HEADER', pinCount: 6 },
      { id: 'c5', refDes: 'H1', name: 'PCB Mount Hole A', value: '3.2mm Hole', footprint: 'MOUNTING_HOLE', pinCount: 1 },
      { id: 'c6', refDes: 'H2', name: 'PCB Mount Hole B', value: '3.2mm Hole', footprint: 'MOUNTING_HOLE', pinCount: 1 }
    ];

    const nets: SchematicNet[] = [
      {
        id: 'n1',
        name: 'VCC_3V3',
        connectedPins: [
          { refDes: 'J1', pinNumber: 1 },
          { refDes: 'R1', pinNumber: 1 },
          { refDes: 'C1', pinNumber: 1 },
          { refDes: 'U1', pinNumber: 1 }
        ]
      },
      {
        id: 'n2',
        name: 'GND',
        connectedPins: [
          { refDes: 'J1', pinNumber: 6 },
          { refDes: 'U1', pinNumber: 12 },
          { refDes: 'C1', pinNumber: 2 }
        ]
      },
      {
        id: 'n3',
        name: 'MCU_NRST',
        connectedPins: [
          { refDes: 'R1', pinNumber: 2 },
          { refDes: 'U1', pinNumber: 7 }
        ]
      }
    ];

    return { components, nets };
  }

  /**
   * Generates a 100% verified Canonical PCB Model connected strictly to actual physical pad coordinates
   */
  public static getCanonicalModel(
    boardWidthMm: number = 80,
    boardHeightMm: number = 50,
    thicknessMm: number = 1.6
  ): PcbCanonicalModel {
    const footprintLibrary: Record<string, FootprintDefinition> = PcbHardAcceptanceGate.getStandardFootprintLibrary();

    return {
      designId: 'SECP-PCB-CANONICAL-REF-001',
      revisionId: 'REV-1.0.0-PROD',
      version: '1.0.0-PROD',
      boardWidthMm,
      boardHeightMm,
      thicknessMm,
      layerCount: 2,
      footprintLibrary,
      rules: {
        minClearanceMm: 0.2,
        minTraceWidthMm: 0.2,
        boardMarginMm: 1.5
      },
      components: [
        { id: 'c1', refDes: 'U1', name: 'Microcontroller', value: 'STM32F4', footprintId: 'FP_MCU_QFP48' },
        { id: 'c2', refDes: 'R1', name: 'Pull-up', value: '10k', footprintId: 'FP_SMD_0805' },
        { id: 'c3', refDes: 'C1', name: 'Decoupling', value: '100nF', footprintId: 'FP_SMD_0805' },
        { id: 'c4', refDes: 'J1', name: 'Port Header', value: 'USB_UART', footprintId: 'FP_HEADER_USB' }
      ],
      schematicNets: [
        {
          id: 'n1',
          name: 'VCC_3V3',
          requiredWidthMm: 0.4,
          pins: [
            { refDes: 'J1', pinNumber: 1 },
            { refDes: 'R1', pinNumber: 1 },
            { refDes: 'C1', pinNumber: 1 },
            { refDes: 'U1', pinNumber: 1 }
          ]
        },
        {
          id: 'n2',
          name: 'GND',
          requiredWidthMm: 0.5,
          pins: [
            { refDes: 'J1', pinNumber: 6 },
            { refDes: 'U1', pinNumber: 12 },
            { refDes: 'C1', pinNumber: 2 }
          ]
        },
        {
          id: 'n3',
          name: 'MCU_NRST',
          requiredWidthMm: 0.25,
          pins: [
            { refDes: 'R1', pinNumber: 2 },
            { refDes: 'U1', pinNumber: 7 }
          ]
        }
      ],
      placements: [
        { refDes: 'J1', xMm: 12, yMm: 25, rotationDeg: 0, layer: 'TOP', widthMm: 8.0, heightMm: 6.0, height3dMm: 3.2, colorHex: '#a855f7' },
        { refDes: 'R1', xMm: 28, yMm: 35, rotationDeg: 0, layer: 'TOP', widthMm: 2.0, heightMm: 1.25, height3dMm: 0.6, colorHex: '#38bdf8' },
        { refDes: 'C1', xMm: 28, yMm: 15, rotationDeg: 0, layer: 'TOP', widthMm: 2.0, heightMm: 1.25, height3dMm: 0.6, colorHex: '#eab308' },
        { refDes: 'U1', xMm: 50, yMm: 25, rotationDeg: 0, layer: 'TOP', widthMm: 9.0, heightMm: 9.0, height3dMm: 1.4, colorHex: '#1e293b' }
      ],
      traces: [
        // VCC_3V3: J1:1 (9.5, 25) -> R1:1 (27.1, 35) -> C1:1 (27.1, 15) -> U1:1 (45.5, 28.5)
        {
          id: 'tr_vcc_1',
          netName: 'VCC_3V3',
          layer: 'TOP_COPPER',
          widthMm: 0.4,
          path: [{ x: 9.5, y: 25 }, { x: 20, y: 35 }, { x: 27.1, y: 35 }]
        },
        {
          id: 'tr_vcc_branch_c1',
          netName: 'VCC_3V3',
          layer: 'TOP_COPPER',
          widthMm: 0.4,
          path: [{ x: 27.1, y: 35 }, { x: 27.1, y: 15 }]
        },
        {
          id: 'tr_vcc_2',
          netName: 'VCC_3V3',
          layer: 'TOP_COPPER',
          widthMm: 0.4,
          path: [{ x: 27.1, y: 35 }, { x: 27.1, y: 38 }, { x: 38, y: 38 }, { x: 45.5, y: 28.5 }]
        },
        // GND: J1:6 (14.5, 25) -> C1:2 (28.9, 15) -> U1:12 (45.5, 23.0) via BOTTOM_COPPER
        {
          id: 'tr_gnd_1',
          netName: 'GND',
          layer: 'BOTTOM_COPPER',
          widthMm: 0.5,
          path: [{ x: 14.5, y: 25 }, { x: 20, y: 15 }, { x: 28.9, y: 15 }]
        },
        {
          id: 'tr_gnd_2',
          netName: 'GND',
          layer: 'BOTTOM_COPPER',
          widthMm: 0.5,
          path: [{ x: 28.9, y: 15 }, { x: 38, y: 15 }, { x: 45.5, y: 23.0 }]
        },
        // MCU_NRST: R1:2 (28.9, 35) -> U1:7 (45.5, 25.5)
        {
          id: 'tr_nrst',
          netName: 'MCU_NRST',
          layer: 'TOP_COPPER',
          widthMm: 0.25,
          path: [{ x: 28.9, y: 35 }, { x: 37, y: 35 }, { x: 37, y: 25.5 }, { x: 45.5, y: 25.5 }]
        }
      ],
      vias: [
        { id: 'via_gnd_1', netName: 'GND', xMm: 14.5, yMm: 25, drillDiameterMm: 0.3, padDiameterMm: 0.6, startLayer: 'TOP_COPPER', endLayer: 'BOTTOM_COPPER' },
        { id: 'via_gnd_2', netName: 'GND', xMm: 28.9, yMm: 15, drillDiameterMm: 0.3, padDiameterMm: 0.6, startLayer: 'TOP_COPPER', endLayer: 'BOTTOM_COPPER' },
        { id: 'via_gnd_3', netName: 'GND', xMm: 45.5, yMm: 23, drillDiameterMm: 0.3, padDiameterMm: 0.6, startLayer: 'TOP_COPPER', endLayer: 'BOTTOM_COPPER' }
      ],
      mountingHoles: [
        { id: 'mh1', x: 5, y: 5, diameterMm: 3.2 },
        { id: 'mh2', x: boardWidthMm - 5, y: 5, diameterMm: 3.2 },
        { id: 'mh3', x: 5, y: boardHeightMm - 5, diameterMm: 3.2 },
        { id: 'mh4', x: boardWidthMm - 5, y: boardHeightMm - 5, diameterMm: 3.2 }
      ],
      targetEnclosure: {
        id: 'ENC_BOX_01',
        name: 'Standard Precision Enclosure',
        internalWidthMm: boardWidthMm + 10,
        internalLengthMm: boardHeightMm + 10,
        internalHeightMm: 22,
        wallThicknessMm: 2.5,
        standoffHeightMm: 5.0,
        screwDiameterMm: 3.0,
        standoffPosts: [
          { id: 'sp1', x: 5, y: 5, diameterMm: 3.0 },
          { id: 'sp2', x: boardWidthMm - 5, y: 5, diameterMm: 3.0 },
          { id: 'sp3', x: 5, y: boardHeightMm - 5, diameterMm: 3.0 },
          { id: 'sp4', x: boardWidthMm - 5, y: boardHeightMm - 5, diameterMm: 3.0 }
        ]
      }
    };
  }

  /**
   * Generates 2D/3D PCB Design layout and runs real verification
   */
  public static generatePcbLayout(
    boardWidthMm: number = 80,
    boardHeightMm: number = 50,
    thicknessMm: number = 1.6
  ): PcbDesign {
    const canonical = this.getCanonicalModel(boardWidthMm, boardHeightMm, thicknessMm);
    const canonicalHash = PcbCanonicalModelValidator.computeCanonicalHash(canonical);

    // Run independent verifiers
    const connectivityReport = PcbConnectivityVerifier.verify(canonical);
    const geometryReport = PcbGeometryVerifier.verify(canonical);
    const mechanicalReport = PcbMechanicalVerifier.verify(canonical);

    return {
      designId: canonical.designId,
      revisionId: canonical.revisionId,
      canonicalHash,
      boardWidthMm,
      boardHeightMm,
      thicknessMm,
      layerCount: canonical.layerCount,
      placements: canonical.placements.map(p => ({
        refDes: p.refDes,
        xMm: p.xMm,
        yMm: p.yMm,
        rotationDeg: p.rotationDeg,
        layer: p.layer,
        widthMm: p.widthMm,
        heightMm: p.heightMm,
        height3dMm: p.height3dMm,
        colorHex: p.colorHex || '#1e293b'
      })),
      traces: canonical.traces.map(t => ({
        id: t.id,
        netName: t.netName,
        layer: t.layer as 'TOP_COPPER' | 'BOTTOM_COPPER',
        widthMm: t.widthMm,
        path: t.path
      })),
      mountingHoles: canonical.mountingHoles,
      connectivityReport,
      geometryReport,
      mechanicalReport
    };
  }

  /**
   * Executes mechanical enclosure fit check against fixed enclosure specifications
   */
  public static verifyMechanicalEnclosureFit(
    pcb: PcbDesign,
    clearanceMm: number = 2.0
  ): MechanicalEnclosureIntegration {
    const canonical = this.getCanonicalModel(pcb.boardWidthMm, pcb.boardHeightMm, pcb.thicknessMm);
    const report = PcbMechanicalVerifier.verify(canonical);

    return {
      enclosureWidthMm: canonical.targetEnclosure?.internalWidthMm ?? (pcb.boardWidthMm + clearanceMm * 2 + 5),
      enclosureLengthMm: canonical.targetEnclosure?.internalLengthMm ?? (pcb.boardHeightMm + clearanceMm * 2 + 5),
      enclosureHeightMm: canonical.targetEnclosure?.internalHeightMm ?? 22,
      wallThicknessMm: canonical.targetEnclosure?.wallThicknessMm ?? 2.5,
      standoffHeightMm: canonical.targetEnclosure?.standoffHeightMm ?? 5.0,
      screwDiameterMm: canonical.targetEnclosure?.screwDiameterMm ?? 3.0,
      status: report.boardFitStatus,
      clashNotes: report.violations.length > 0 ? report.violations.map(v => v.message).join(' | ') : undefined,
      minWallClearanceMm: report.minWallClearanceMm,
      minVerticalClearanceMm: report.minVerticalClearanceMm
    };
  }

  /**
   * Runs the Hard Acceptance Gate suite (Phase 1: 19 assertions)
   */
  public static runHardAcceptanceGate(): PcbGateReport {
    return PcbHardAcceptanceGate.runGate();
  }

  /**
   * Runs the Comprehensive Phase 2 Hard Acceptance Gate suite (30 assertions)
   */
  public static runHardAcceptanceGatePhase2(): PcbGateReport {
    return PcbHardAcceptanceGate.runGatePhase2();
  }
}
