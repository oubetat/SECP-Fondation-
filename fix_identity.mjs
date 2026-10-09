import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const files = execSync('find src -type f -name "*.ts"').toString().trim().split('\n');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  if (content.includes('CanonicalEngineeringIdentity')) {
    content = content.replace(/\bCanonicalEngineeringIdentity\b/g, 'EngineeringIdentity');
    changed = true;
  }
  
  if (content.includes('EngineeringArtifactType')) {
    content = content.replace(/\bEngineeringArtifactType\b/g, 'EngineeringObjectType');
    changed = true;
  }

  // Find all EngineeringIdentityFactory.createIdentity({ ... }) calls and map artifactType->objectType, artifactId->projectId, etc.
  const regex = /EngineeringIdentityFactory\.createIdentity\(\{\s*([\s\S]*?)\s*\}\)/g;
  content = content.replace(regex, (match, body) => {
    let newBody = body;
    newBody = newBody.replace(/artifactType\s*:/g, 'objectType:');
    newBody = newBody.replace(/artifactId\s*:/g, 'projectId:');
    // If it's missing revisionId, createdBy, seed, add them?
    if (!newBody.includes('revisionId:')) {
      newBody += ',\n        revisionId: "rev-01"';
    }
    if (!newBody.includes('createdBy:')) {
      newBody += ',\n        createdBy: "system"';
    }
    if (!newBody.includes('seed:')) {
      newBody += ',\n        seed: "seed"';
    }
    return `EngineeringIdentityFactory.createIdentity({ ${newBody} }, {})`;
  });
  
  // also fix createIdentity with 1 arg if it didn't get caught
  // well, let's see.

  if (content !== fs.readFileSync(file, 'utf8')) {
    fs.writeFileSync(file, content);
    console.log('Fixed', file);
  }
}
