import { ParametricDependencyGraphVerifier } from './src/engine/validation/ParametricDependencyGraphVerifier';
import fs from 'fs';

const evidence = ParametricDependencyGraphVerifier.verify();
fs.writeFileSync('parametric-cad-patch-023-evidence.json', JSON.stringify(evidence, null, 2), 'utf8');
console.log('Evidence generated at parametric-cad-patch-023-evidence.json');
