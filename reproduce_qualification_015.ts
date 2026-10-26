import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { TwoWayFSICouplingEngine } from './src/engine/cfd3d/coupling/TwoWayFSICouplingEngine';
import { StructuralAnalysisEngine } from './src/engine/structural-physics/StructuralAnalysisEngine';
import { DynamicMeshManager } from './src/engine/cfd3d/solvers/fsi/DynamicMeshManager';
import { Fvm3DMeshGenerator } from './src/engine/cfd3d/Fvm3DMeshGenerator';

const ARTIFACT_DIR = 'qualification-002/final-comprehensive-closure-015';

function computeHash(filePath: string): string {
    try {
        const content = fs.readFileSync(path.join(process.cwd(), filePath));
        return crypto.createHash('sha256').update(content).digest('hex');
    } catch {
        return 'FILE_NOT_FOUND';
    }
}

async function runReproduction() {
    console.log('--- SECP-FSI-QUALIFICATION-015 REQUALIFICATION ---');
    
    if (!fs.existsSync(ARTIFACT_DIR)) {
        fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
    }

    // 2. Structural Requalification (Multi-Resolution)
    console.log('Executing Structural Requalification Study...');
    const resolutions = [10, 20, 40];
    const structuralResults = [];
    
    const L = 1.0, b = 0.1, h = 0.1, E = 70e9;
    const I = (b * Math.pow(h, 3)) / 12;
    const q = 101325.0 * b;
    const theoreticalDelta = (q * Math.pow(L, 4)) / (8 * E * I);
    
    const fluidMesh = Fvm3DMeshGenerator.generateBoxMesh(L, b, h, 5, 5, 2);
    const pressures = new Array(fluidMesh.cells.length).fill(101325.0);

    for (const stations of resolutions) {
        const res = TwoWayFSICouplingEngine.solveTwoWayFSI(fluidMesh, pressures, E, 1e-4, 15, stations);
        const error = (Math.abs(res.maxDisplacementM - theoreticalDelta) / theoreticalDelta) * 100;
        
        // Root Reaction Audit
        const r1 = res.structuralReactions?.find(r => r.nodeId === 1);
        const r2 = res.structuralReactions?.find(r => r.nodeId === 2);
        const analyticalMoment = (q * Math.pow(L, 2)) / 2;
        const numericalMoment = Math.abs((r1?.fx || 0) - (r2?.fx || 0)) * (h / 2);
        
        structuralResults.push({
            stations,
            maxDisplacementMm: res.maxDisplacementM * 1000,
            theoreticalDeltaMm: theoreticalDelta * 1000,
            errorPercent: error,
            converged: res.isConverged,
            totalAppliedFy: res.totalAppliedLoad?.fy,
            totalReactionFy: res.totalReaction?.fy,
            analyticalMomentNm: analyticalMoment,
            reactionMomentNm: numericalMoment,
            momentErrorPercent: (Math.abs(numericalMoment - analyticalMoment) / analyticalMoment) * 100
        });
    }
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'mesh-convergence-results.json'), JSON.stringify(structuralResults, null, 2));

    console.log('Requalification Study Complete.');
}

runReproduction();
