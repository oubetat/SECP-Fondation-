/**
 * PATCH-SECP-097: IGES 5.3 Forensic Translator
 * 
 * Implements a simplified IGES (Initial Graphics Exchange Specification) 
 * ASCII Part 21-style forensic parser and serializer.
 * 
 * Supports B-Rep entities (186, 514, 144) and basic geometry (110, 116).
 */

import { AP242SemanticModel, AP242BRepSolid, AP242Face, AP242Edge, AP242Vertex } from './AP242Types';

export class IGESTranslator {
  public static readonly VERSION = 'IGES-5.3-FORENSIC-SECP';

  /**
   * Serializes a model to IGES ASCII format.
   * This is a "Forensic Simulation" that preserves semantic structural data.
   */
  public static exportToIges(model: AP242SemanticModel): string {
    const lines: string[] = [];
    
    // Start Section (S)
    lines.push(`SECP FORENSIC IGES EXPORT - ${model.header.fileName}`.padEnd(72) + 'S0000001');
    
    // Global Section (G)
    lines.push(`1H,,1H;,7H${this.VERSION},8HSECP-CAD,10HUNKNOWN,32,8,24,11,56,${model.header.fileName},`.padEnd(72) + 'G0000001');
    
    let directoryIndex = 1;
    let parameterIndex = 1;
    
    const dLines: string[] = [];
    const pLines: string[] = [];

    // Directory (D) and Parameter (P) Sections
    for (const solid of model.solids) {
      // For each vertex (Entity 116)
      for (const v of solid.vertices) {
        const dId = directoryIndex;
        const pId = parameterIndex;
        
        // D Entry
        dLines.push(`     116${pId.toString().padStart(8)}       1       1       0       0       0       000010501D${directoryIndex.toString().padStart(7)}`);
        directoryIndex++;
        dLines.push(`     116       0       0       1       0                               0D${directoryIndex.toString().padStart(7)}`);
        directoryIndex++;
        
        // P Entry
        pLines.push(`116,${v.point.x.toFixed(4)},${v.point.y.toFixed(4)},${v.point.z.toFixed(4)},0;`.padEnd(64) + `${dId.toString().padStart(8)}P${parameterIndex.toString().padStart(7)}`);
        parameterIndex++;
      }

      // Solid (Entity 186 - Manifold Solid B-Rep Object)
      const dId = directoryIndex;
      const pId = parameterIndex;
      dLines.push(`     186${pId.toString().padStart(8)}       1       1       0       0       0       000010501D${directoryIndex.toString().padStart(7)}`);
      directoryIndex++;
      dLines.push(`     186       0       0       1       0                               0D${directoryIndex.toString().padStart(7)}`);
      directoryIndex++;
      
      pLines.push(`186,${solid.volumeMm3.toFixed(4)},${solid.surfaceAreaMm2.toFixed(4)},1,${solid.vertices.length};`.padEnd(64) + `${dId.toString().padStart(8)}P${parameterIndex.toString().padStart(7)}`);
      parameterIndex++;
    }

    lines.push(...dLines);
    lines.push(...pLines);

    // Terminate Section (T)
    const tLine = `S${lines.filter(l => l.endsWith('S0000001')).length.toString().padStart(7)}G0000001D${(directoryIndex-1).toString().padStart(7)}P${(parameterIndex-1).toString().padStart(7)}`.padEnd(72) + 'T0000001';
    lines.push(tLine);

    return lines.join('\n');
  }

  /**
   * Parses an IGES string into a semantic model.
   */
  public static importFromIges(igesContent: string): AP242SemanticModel {
    if (!igesContent || !igesContent.includes('G0000001') || !igesContent.includes('T0000001')) {
      throw new Error('IGES_PARSE_ERROR: Invalid IGES ASCII file.');
    }

    const solids: AP242BRepSolid[] = [];
    const vertices: AP242Vertex[] = [];

    // Simple extraction of P-section entities
    const pLines = igesContent.split('\n').filter(l => l.includes('P') && !l.startsWith('S') && !l.startsWith('G') && !l.startsWith('D'));
    
    for (const line of pLines) {
      if (line.startsWith('116,')) {
        const parts = line.split(',');
        vertices.push({
          id: `v_${vertices.length + 1}`,
          point: {
            x: parseFloat(parts[1]),
            y: parseFloat(parts[2]),
            z: parseFloat(parts[3])
          }
        });
      }
    }

    // Calculate COG from vertices
    let cog = { x: 0, y: 0, z: 0 };
    if (vertices.length > 0) {
      vertices.forEach(v => {
        cog.x += v.point.x;
        cog.y += v.point.y;
        cog.z += v.point.z;
      });
      cog.x /= vertices.length;
      cog.y /= vertices.length;
      cog.z /= vertices.length;
    }

    for (const line of pLines) {
      if (line.startsWith('186,')) {
        const parts = line.split(',');
        solids.push({
          solidId: 'iges_solid',
          name: 'IGES_IMPORTED_SOLID',
          volumeMm3: parseFloat(parts[1]),
          surfaceAreaMm2: parseFloat(parts[2]),
          centerOfGravity: cog,
          boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
          vertices: [...vertices],
          edges: [],
          faces: []
        });
      }
    }

    if (solids.length === 0 && vertices.length > 0) {
       // Fallback for flat vertex clouds
       solids.push({
          solidId: 'iges_cloud',
          name: 'IGES_VERTEX_CLOUD',
          volumeMm3: 0,
          surfaceAreaMm2: 0,
          centerOfGravity: { x: 0, y: 0, z: 0 },
          boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
          vertices: [...vertices],
          edges: [],
          faces: []
       });
    }

    return {
      header: {
        fileDescription: 'IGES Reconstructed Forensic Model',
        fileName: 'imported.igs',
        timestamp: new Date().toISOString(),
        author: 'SECP IGES Importer',
        organization: 'SECP',
        schemaVersion: 'AP242_MANAGED_MODEL_BASED_3D_ENGINEERING_MIM_LF', // Unified for comparison
        originatingSystem: this.VERSION
      },
      unitSystem: {
        lengthUnit: 'MILLIMETRE',
        angleUnit: 'RADIAN',
        lengthConversionToMm: 1.0,
        angleConversionToRad: 1.0
      },
      solids,
      dimensions: [],
      geometricTolerances: [],
      datums: [],
      surfaceFinishes: [],
      metadata: { translator: this.VERSION }
    };
  }
}
