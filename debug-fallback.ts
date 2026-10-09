
import { BRepTessellator } from './src/engine/cad-kernel/tessellation/BRepTessellator';
import { buildIndustrialQuadcopterDrone } from './src/components/CadIndustrialModels';
import { AssemblyPartExtractor } from './src/engine/assembly/AssemblyPartExtractor';

async function debug() {
  const droneModel = buildIndustrialQuadcopterDrone({
        valveType: 'INDUSTRIAL_DRONE' as any,
        openAngleDeg: 75,
        explodedFactor: 0,
        material: 'CARBON_FIBER',
        handleColor: '#38bdf8',
        showWaterFlow: false
  }, false);

  const fallbackExtraction = AssemblyPartExtractor.extractPart({
      id: 'DOC_DRONE_001',
      assembly: {
          instances: [
              {
                  instanceId: 'DRONE-CHASSIS-001',
                  partId: 'CHASSIS_PART',
                  name: 'Drone Chassis',
                  geometryReference: 'FEAT_EXTRUDE_001',
                  geometryStatus: 'MODELED',
                  position: { x: 0, y: 0, z: 0 },
                  rotation: { x: 0, y: 0, z: 0 }
              }
          ]
      }
  }, 'DRONE-CHASSIS-001');

  if (fallbackExtraction.status === 'SUCCESS') {
      console.log('--- FALLBACK GEOMETRY HASH ---');
      console.log(fallbackExtraction.hashes.geometryHash);
      console.log('--- FALLBACK COUNTS ---');
      console.log('Faces:', fallbackExtraction.solid.facesCount);
      console.log('Edges:', fallbackExtraction.solid.edgesCount);
      console.log('Vertices:', fallbackExtraction.solid.verticesCount);
      console.log('Mesh Vertices:', fallbackExtraction.mesh.vertices.length / 3);
      console.log('Mesh Indices:', fallbackExtraction.mesh.indices.length);
  }
}

debug();
