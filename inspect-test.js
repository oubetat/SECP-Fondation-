import { readFileSync, writeFileSync } from 'fs';

const path = 'src/verification/patch034/__tests__/KernelIntegration-001.test.ts';
let code = readFileSync(path, 'utf8');

code = code.replace('const vol20 = BooleanValidator.computeSolidVolume(solid20 as any);', `const vol20 = BooleanValidator.computeSolidVolume(solid20 as any);
    console.log(JSON.stringify(solid20, null, 2));`);

writeFileSync(path, code);
