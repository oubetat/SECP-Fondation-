
import { EngineeringHashChain } from './src/engine/evidence/EngineeringHashChain';
import { BRepKernel } from './src/engine/cad-kernel/brep/BRepKernel';
import { AssemblyPartExtractor } from './src/engine/assembly/AssemblyPartExtractor';
import { PersistentTopologyNaming } from './src/engine/cad-kernel/topology/PersistentTopologyNaming';
import { CanonicalSerializer } from './src/engine/serialization/CanonicalSerializer';

async function debug() {
  const kernel = BRepKernel.getCanonical();
  
  const testBox = (dx: number, dy: number, dz: number, ox: number, oy: number, oz: number, label: string) => {
    const solid = kernel.createBox(dx as any, dy as any, dz as any, 'chassis', { x: ox as any, y: oy as any, z: oz as any });
    const extraction = AssemblyPartExtractor.extractPart({
      id: 'DOC_DRONE_001',
      assembly: { instances: [{ instanceId: 'DRONE-CHASSIS-001', partId: 'CHASSIS', geometryStatus: 'MODELED', geometryReference: 'FEAT_EXTRUDE_001' }] },
      evaluatedShape: solid
    } as any, 'DRONE-CHASSIS-001');

    if (extraction.status === 'SUCCESS') {
      const verticesAsObjects = [];
      for (let i = 0; i < extraction.mesh.vertices.length; i += 3) {
        verticesAsObjects.push({
          x: Number(extraction.mesh.vertices[i].toFixed(6)),
          y: Number(extraction.mesh.vertices[i+1].toFixed(6)),
          z: Number(extraction.mesh.vertices[i+2].toFixed(6))
        });
      }
      const payloadObj = {
        vertices: verticesAsObjects,
        indices: extraction.mesh.indices,
        topologicalFaces: extraction.solid.facesCount,
        topologicalEdges: extraction.solid.edgesCount,
        topologicalVertices: extraction.solid.verticesCount
      };
      const hashObj = EngineeringHashChain.computeCanonicalHash(payloadObj).canonicalHash;
      console.log(`--- ${label} (Object Vertices) ---`);
      console.log(hashObj);
    } else {
      console.log(`--- ${label} FAIL ---`);
      console.log(extraction.status);
    }
  };

  testBox(0.1, 0.06, 0.01, 0, 0, 0, 'Standard (0,0,0)');
  testBox(0.1, 0.06, 0.01, -0.05, -0.03, -0.005, 'Centered');
}

debug();
