export interface StandardCatalogSpringItem {
  id: string;
  partNumber: string;
  type: 'COMPRESSION' | 'EXTENSION';
  wireDiameterMm: number;
  outerDiameterMm: number;
  freeLengthMm: number;
  springRate_K_N_mm: number;
  material: string;
}

export class SpringStandardRegistry {
  public static findNearestStandardWire(targetDiameter: number): { diameterMm: number; toleranceGrade2Um: number } {
    const standardGauges = [
      0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.5, 2.8, 3.0, 3.2, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 7.0, 8.0, 9.0, 10.0
    ];
    
    let nearest = standardGauges[0];
    let minDiff = Math.abs(targetDiameter - nearest);
    
    for (const d of standardGauges) {
      const diff = Math.abs(targetDiameter - d);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = d;
      }
    }
    
    return {
      diameterMm: nearest,
      toleranceGrade2Um: nearest < 1.0 ? 10 : nearest < 3.0 ? 20 : 35
    };
  }

  public static getCatalogItems(): StandardCatalogSpringItem[] {
    return [
      { id: 'C-01', partNumber: '6010-01', type: 'COMPRESSION', wireDiameterMm: 1.0, outerDiameterMm: 8.0, freeLengthMm: 30.0, springRate_K_N_mm: 1.25, material: 'MUSIC_WIRE' },
      { id: 'C-02', partNumber: '6010-02', type: 'COMPRESSION', wireDiameterMm: 1.2, outerDiameterMm: 10.0, freeLengthMm: 40.0, springRate_K_N_mm: 1.85, material: 'MUSIC_WIRE' },
      { id: 'C-03', partNumber: '6010-03', type: 'COMPRESSION', wireDiameterMm: 2.0, outerDiameterMm: 14.0, freeLengthMm: 50.0, springRate_K_N_mm: 4.50, material: 'STAINLESS_STEEL' },
      { id: 'E-01', partNumber: '7010-01', type: 'EXTENSION', wireDiameterMm: 0.8, outerDiameterMm: 6.0, freeLengthMm: 25.0, springRate_K_N_mm: 0.95, material: 'MUSIC_WIRE' }
    ];
  }
}
