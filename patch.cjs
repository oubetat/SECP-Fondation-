const fs = require('fs');
const file = 'src/engine/sketch034/SketchProfileExtractor.ts';
let code = fs.readFileSync(file, 'utf8');

const target = `      } else {
        // CAD Thin-Feature Extrusion for open lines/curves
        const thinPoly = this.createThinProfileFromLines(lineEntities, this.DEFAULT_THIN_THICKNESS);
        if (thinPoly) {
          return this.buildVerifiedProfile(thinPoly, 'THIN_FEATURE_EXTRUSION');
        } else {
          return {
            points: [],
            isClosed: false,
            isValid: false,
            areaMm2: 0,
            perimeterMm: 0,
            centroid: { x: 0, y: 0 },
            error: 'Degenerate line entity: line length is zero or collinear.',
            sourceType: 'LINE_DEGENERATE'
          };
        }
      }`;

const replacement = `      } else {
        return {
          points: [],
          isClosed: false,
          isValid: false,
          areaMm2: 0,
          perimeterMm: 0,
          centroid: { x: 0, y: 0 },
          error: 'UNAVAILABLE: Open profiles cannot be implicitly converted to thin features. Refusing to fabricate synthetic geometry.',
          sourceType: 'LINE_DEGENERATE'
        };
      }`;

if (code.includes(target)) {
  fs.writeFileSync(file, code.replace(target, replacement));
  console.log('Patched');
} else {
  console.log('Target not found');
}
