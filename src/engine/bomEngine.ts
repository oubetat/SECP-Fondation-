/**
 * PATCH-SECP-019 — Bill of Materials (BOM) Engine
 * Generates hierarchical & flat multi-level structured BOMs for CAD Assemblies.
 * Tracks: Part Number, Description, Quantity, Material, Revision, Supplier, Manufacturing Method, Cost ($), Weight (kg), Lead Time (Days).
 */

export interface BomItem {
  id: string;
  partNumber: string;
  description: string;
  quantity: number;
  material: string;
  revision: string;
  supplier: string;
  manufacturingMethod: 'CNC_MILLING' | '3D_PRINTING_SLA' | 'LASER_CUTTING' | 'INJECTION_MOLDING' | 'COMMERCIAL_OFF_THE_SHELF';
  unitCostUSD: number;
  totalCostUSD: number;
  unitWeightKg: number;
  totalWeightKg: number;
  leadTimeDays: number;
  subItems?: BomItem[];
}

export interface AssemblyBomRollup {
  assemblyName: string;
  totalItemCount: number;
  totalUniqueParts: number;
  totalCostUSD: number;
  totalWeightKg: number;
  criticalPathLeadTimeDays: number;
  items: BomItem[];
}

export class BomEngine {
  /**
   * Generates a realistic engineering BOM for an automated CAD Robotic Actuator Assembly
   */
  public static generateAssemblyBom(assemblyName: string = 'SECP Robotic Actuator Assembly v2.1'): AssemblyBomRollup {
    const items: BomItem[] = [
      {
        id: 'bom-001',
        partNumber: 'SECP-PRT-101',
        description: 'Main Structural Chassis Bracket',
        quantity: 1,
        material: 'Aluminum 6061-T6',
        revision: 'REV-B',
        supplier: 'SECP Precision Machining Co.',
        manufacturingMethod: 'CNC_MILLING',
        unitCostUSD: 145.0,
        totalCostUSD: 145.0,
        unitWeightKg: 0.850,
        totalWeightKg: 0.850,
        leadTimeDays: 7
      },
      {
        id: 'bom-002',
        partNumber: 'SECP-PRT-102',
        description: 'High-Torque Planetary Gear Box Housing',
        quantity: 1,
        material: 'Stainless Steel 316L',
        revision: 'REV-A',
        supplier: 'Additive Metal Solutions',
        manufacturingMethod: '3D_PRINTING_SLA',
        unitCostUSD: 210.0,
        totalCostUSD: 210.0,
        unitWeightKg: 1.200,
        totalWeightKg: 1.200,
        leadTimeDays: 10
      },
      {
        id: 'bom-003',
        partNumber: 'SECP-PRT-103',
        description: 'Precision Hardened Shaft Pinion',
        quantity: 2,
        material: 'Structural Alloy Steel A36',
        revision: 'REV-C',
        supplier: 'Global Shaft & Motion Inc.',
        manufacturingMethod: 'CNC_MILLING',
        unitCostUSD: 42.50,
        totalCostUSD: 85.0,
        unitWeightKg: 0.320,
        totalWeightKg: 0.640,
        leadTimeDays: 5
      },
      {
        id: 'bom-004',
        partNumber: 'SECP-COTS-201',
        description: 'BLDC Servo Motor NEMA 23 (48V, 500W)',
        quantity: 1,
        material: 'Copper / Neodymium Assembly',
        revision: 'REV-1.0',
        supplier: 'Maxon Motion Systems',
        manufacturingMethod: 'COMMERCIAL_OFF_THE_SHELF',
        unitCostUSD: 380.0,
        totalCostUSD: 380.0,
        unitWeightKg: 1.450,
        totalWeightKg: 1.450,
        leadTimeDays: 14
      },
      {
        id: 'bom-005',
        partNumber: 'SECP-PCB-301',
        description: 'Custom Quad-FET Motor Controller PCB',
        quantity: 1,
        material: 'FR4 High-TG Laminate',
        revision: 'REV-2.1',
        supplier: 'JLCPCB Express',
        manufacturingMethod: 'COMMERCIAL_OFF_THE_SHELF',
        unitCostUSD: 65.0,
        totalCostUSD: 65.0,
        unitWeightKg: 0.085,
        totalWeightKg: 0.085,
        leadTimeDays: 4
      },
      {
        id: 'bom-006',
        partNumber: 'SECP-SHT-401',
        description: 'Enclosure Protection Face Cover Plate',
        quantity: 1,
        material: 'Polycarbonate / Acrylic',
        revision: 'REV-A',
        supplier: 'SECP Laser Cut Tech',
        manufacturingMethod: 'LASER_CUTTING',
        unitCostUSD: 18.0,
        totalCostUSD: 18.0,
        unitWeightKg: 0.110,
        totalWeightKg: 0.110,
        leadTimeDays: 2
      },
      {
        id: 'bom-007',
        partNumber: 'SECP-FAST-001',
        description: 'M4x12mm Hex Socket Head Cap Screw DIN 912',
        quantity: 16,
        material: 'Stainless Steel A2-70',
        revision: 'REV-0',
        supplier: 'McMaster-Carr',
        manufacturingMethod: 'COMMERCIAL_OFF_THE_SHELF',
        unitCostUSD: 0.35,
        totalCostUSD: 5.60,
        unitWeightKg: 0.003,
        totalWeightKg: 0.048,
        leadTimeDays: 1
      }
    ];

    const totalItemCount = items.reduce((acc, i) => acc + i.quantity, 0);
    const totalUniqueParts = items.length;
    const totalCostUSD = items.reduce((acc, i) => acc + i.totalCostUSD, 0);
    const totalWeightKg = items.reduce((acc, i) => acc + i.totalWeightKg, 0);
    const criticalPathLeadTimeDays = Math.max(...items.map(i => i.leadTimeDays));

    return {
      assemblyName,
      totalItemCount,
      totalUniqueParts,
      totalCostUSD,
      totalWeightKg,
      criticalPathLeadTimeDays,
      items
    };
  }
}
