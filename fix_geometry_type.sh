#!/bin/bash

FILES=(
  "src/engine/sketch/__tests__/SketchAdversarial.test.ts"
  "src/engine/sketch/__tests__/SketchCanonicalization.test.ts"
  "src/engine/sketch/__tests__/SketchEntityRegistry.test.ts"
  "src/engine/sketch/__tests__/SketchGeometryValidation.test.ts"
  "src/engine/sketch/gcs/__tests__/ConstraintSolver.test.ts"
  "src/engine/validation/GCSModelVerifier.ts"
  "src/engine/validation/SketchModelVerifier.ts"
)

for FILE in "${FILES[@]}"; do
  if [ -f "$FILE" ]; then
    # Determine import path
    if [[ "$FILE" == *"__tests__"* ]]; then
      IMPORT_PATH="../../identity/CanonicalEngineeringIdentity"
    else
      IMPORT_PATH="../identity/CanonicalEngineeringIdentity"
    fi

    # Add import if missing
    if ! grep -q "EngineeringObjectType" "$FILE"; then
      sed -i "/import { EngineeringIdentityFactory }/a import { EngineeringObjectType } from '$IMPORT_PATH';" "$FILE"
    fi
    # Replace 'GEOMETRY' with enum
    sed -i "s/objectType: 'GEOMETRY'/objectType: EngineeringObjectType.GEOMETRY/g" "$FILE"
  fi
done
