export type MarketplaceCategory =
  | 'COMPONENTS'
  | 'MOTORS'
  | 'SENSORS'
  | 'BEARINGS'
  | 'MATERIALS'
  | 'CAD_MODELS'
  | 'SUPPLIERS'
  | 'MANUFACTURING'
  | 'ENGINEERING_SERVICES';

export interface MarketplaceItem {
  id: string;
  name: string;
  category: MarketplaceCategory;
  supplierName: string;
  partNumber: string;
  priceUSD: number;
  unit: string;
  leadTimeDays: number;
  rating: number; // e.g. 4.9
  reviewCount: number;
  description: string;
  cadFormat: string; // e.g. 'STEP / IGES / SECP B-Rep'
  specifications: Record<string, string | number>;
  verifiedBadge: boolean;
  imageIcon: string;
}

export class MarketplaceEngine {
  /**
   * Returns preloaded engineering marketplace catalog items
   */
  public static getCatalogItems(): MarketplaceItem[] {
    return [
      {
        id: 'MKT-001',
        name: 'High-Torque Brushless Servo Motor 48V (3.5 kW)',
        category: 'MOTORS',
        supplierName: 'Maxon Drive Systems',
        partNumber: 'MX-48V-3500W-A',
        priceUSD: 850,
        unit: 'unit',
        leadTimeDays: 3,
        rating: 4.9,
        reviewCount: 42,
        description: 'Industrial 48V BLDC Servo Motor with integrated optical encoder and IP67 sealed housing.',
        cadFormat: 'STEP / SECP B-Rep',
        specifications: {
          'Rated Power': '3.5 kW',
          'Peak Torque': '18.5 Nm',
          'Max Speed': '6500 RPM',
          Weight: '2.8 kg',
        },
        verifiedBadge: true,
        imageIcon: 'Cpu',
      },
      {
        id: 'MKT-002',
        name: 'Triaxial Piezoelectric Vibration Sensor (0-10 kHz)',
        category: 'SENSORS',
        supplierName: 'PCB Piezotronics',
        partNumber: 'PCB-356A15',
        priceUSD: 420,
        unit: 'unit',
        leadTimeDays: 2,
        rating: 4.8,
        reviewCount: 28,
        description: 'High-frequency miniature 3-axis accelerometer for industrial telemetry and digital twin health monitoring.',
        cadFormat: 'STEP / IGES',
        specifications: {
          Sensitivity: '100 mV/g',
          Frequency: '0.5 Hz - 10 kHz',
          Connector: '10-32 4-Pin',
        },
        verifiedBadge: true,
        imageIcon: 'Activity',
      },
      {
        id: 'MKT-003',
        name: 'Precision Ceramic Hybrid Ball Bearing (6204-2RS)',
        category: 'BEARINGS',
        supplierName: 'SKF Industrial Bearings',
        partNumber: 'SKF-6204-HC',
        priceUSD: 165,
        unit: 'unit',
        leadTimeDays: 1,
        rating: 5.0,
        reviewCount: 94,
        description: 'Silicon Nitride (Si3N4) ceramic balls with high-temperature PEEK cage for ultra-high speed turbine shafts.',
        cadFormat: 'STEP / Parasolid',
        specifications: {
          Bore: '20 mm',
          OuterDiameter: '47 mm',
          Width: '14 mm',
          MaxRPM: '45,000 RPM',
        },
        verifiedBadge: true,
        imageIcon: 'CircleDot',
      },
      {
        id: 'MKT-004',
        name: 'Titanium Ti-6Al-4V Grade 5 Aerospace Billet Rod',
        category: 'MATERIALS',
        supplierName: 'Carpenter Technology',
        partNumber: 'TI64-BILLET-D100',
        priceUSD: 95,
        unit: 'kg',
        leadTimeDays: 4,
        rating: 4.9,
        reviewCount: 61,
        description: 'AMS 4928 certified aerospace grade titanium alloy billet bar stock with full material test report (MTR).',
        cadFormat: 'SECP Material Matrix',
        specifications: {
          YieldStrength: '880 MPa',
          Density: '4430 kg/m³',
          ElasticModulus: '114 GPa',
        },
        verifiedBadge: true,
        imageIcon: 'Database',
      },
      {
        id: 'MKT-005',
        name: '5-Axis CNC Precision Machining Hub (Sub-10 micron)',
        category: 'MANUFACTURING',
        supplierName: 'Protolabs Precision Fab',
        partNumber: 'MFG-5AXIS-PROTO',
        priceUSD: 1200,
        unit: 'batch',
        leadTimeDays: 5,
        rating: 4.9,
        reviewCount: 110,
        description: 'High-precision 5-axis DMG MORI CNC milling service for aerospace impellers and titanium brackets.',
        cadFormat: 'Direct SECP G-Code Pipeline',
        specifications: {
          Tolerance: '± 0.005 mm',
          MaxEnvelope: '500x500x400 mm',
          Finishes: 'Anodized, Passivated, Bead-blasted',
        },
        verifiedBadge: true,
        imageIcon: 'Wrench',
      },
      {
        id: 'MKT-006',
        name: 'High Pressure Hydraulic Valve Manifold CAD Model',
        category: 'CAD_MODELS',
        supplierName: 'Bosch Rexroth Hydraulics',
        partNumber: 'CAD-HYD-VALVE-350',
        priceUSD: 0, // Free 3D Model
        unit: 'download',
        leadTimeDays: 0,
        rating: 4.8,
        reviewCount: 205,
        description: 'Parametric 350 bar rated directional spool valve manifold STEP 3D CAD geometry ready for SECP simulation.',
        cadFormat: 'SECP B-Rep Native',
        specifications: {
          MaxPressure: '350 bar',
          FlowRate: '120 L/min',
          Ports: 'SAE-12 O-Ring Boss',
        },
        verifiedBadge: true,
        imageIcon: 'Box',
      },
    ];
  }

  /**
   * Filters marketplace catalog by query & category
   */
  public static filterCatalog(
    items: MarketplaceItem[],
    query: string,
    category: MarketplaceCategory | 'ALL'
  ): MarketplaceItem[] {
    return items.filter(item => {
      const matchesCategory = category === 'ALL' || item.category === category;
      const q = query.toLowerCase();
      const matchesQuery =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.supplierName.toLowerCase().includes(q) ||
        item.partNumber.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }
}
