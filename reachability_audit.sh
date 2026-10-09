#!/bin/bash

# SECP — REACHABILITY AUDIT SCRIPT
# PRODUCES JSON ON STDOUT

DIRS=("cad" "cad-kernel" "nurbs-geometry" "geometry" "topology" "assembly" "assembly-intelligence" "kinematics" "fem" "cfd3d" "structural-physics" "thermal" "materials" "cam" "postprocessor" "manufacturing" "manufacturing-execution" "manufacturing-release" "quality-metrology" "trust" "certification" "release" "revision" "features" "sketch" "sketch034" "evidence" "provenance" "plm" "plm_evidence" "interop" "epdm" "gcs3d" "classa5axis" "engineering_ai" "engineering_gpu" "engineering_hpc" "engineering_wasm" "engineering_webgpu" "benchmark" "validation" "spc" "digital_thread" "digital_twin" "physics")

# Files list to analyze
ALL_FILES=$(find src -name "*.ts" -o -name "*.tsx" | grep -v "__tests__" | grep -v ".test.ts" | grep -v ".spec.ts")

# Pre-calculate imports for all files
IMPORTS_DB=$(mktemp)
for f in $ALL_FILES; do
    # Direct imports from engine
    grep -E "from '.*engine/" "$f" | sed "s|.*engine/\([^/']*\).*|$f:\1|" >> "$IMPORTS_DB"
    # Relative imports within engine
    if [[ "$f" == src/engine/* ]]; then
        grep -E "from '\.\./" "$f" | sed "s|.*from '\.\./\([^/']*\).*|$f:\1|" >> "$IMPORTS_DB"
    fi
done

# Entry Point Definitions
EP_APP="src/App.tsx"
EP_SERVER="server.ts"
EP_COMP=$(find src/components -name "*.tsx" 2>/dev/null)
EP_IRE="src/engine/release/IndustrialReadinessEngine.ts"
EP_QG="src/engine/verification/QualityGate.ts"

REACH_APP=$(mktemp)
REACH_SERVER=$(mktemp)
REACH_COMP=$(mktemp)
REACH_IRE=$(mktemp)
REACH_QG=$(mktemp)

seed_reachability() {
    local ep_files=$1
    local reach_file=$2
    for f in $ep_files; do
        if [ -f "$f" ]; then
            grep "$f:" "$IMPORTS_DB" | cut -d: -f2 >> "$reach_file"
        fi
    done
    sort -u "$reach_file" -o "$reach_file"
}

seed_reachability "$EP_APP" "$REACH_APP"
seed_reachability "$EP_SERVER" "$REACH_SERVER"
seed_reachability "$EP_COMP" "$REACH_COMP"
seed_reachability "$EP_IRE" "$REACH_IRE"
seed_reachability "$EP_QG" "$REACH_QG"

propagate() {
    local reach_file=$1
    local changed=1
    while [ $changed -eq 1 ]; do
        changed=0
        local current_dirs=$(cat "$reach_file")
        for d in $current_dirs; do
            local d_files=$(find "src/engine/$d" -name "*.ts" -o -name "*.tsx" 2>/dev/null)
            for df in $d_files; do
                local new_dirs=$(grep "$df:" "$IMPORTS_DB" | cut -d: -f2)
                for nd in $new_dirs; do
                    if ! grep -q "^$nd$" "$reach_file"; then
                        echo "$nd" >> "$reach_file"
                        changed=1
                    fi
                done
            done
        done
        sort -u "$reach_file" -o "$reach_file"
    done
}

propagate "$REACH_APP"
propagate "$REACH_SERVER"
propagate "$REACH_COMP"
propagate "$REACH_IRE"
propagate "$REACH_QG"

# JSON construction
echo "{"
echo "  \"entry_points\": [\"App.tsx\", \"server.ts\", \"components/\", \"IndustrialReadinessEngine\", \"QualityGate\"],"
echo "  \"directories\": ["

FIRST_DIR=1
R_UI_COUNT=0
R_BE_COUNT=0
R_BOTH_COUNT=0
U_ANY_COUNT=0
UNREACHABLE_DIRS=()

for d in "${DIRS[@]}"; do
    if [ $FIRST_DIR -eq 0 ]; then echo "    ,"; fi
    FIRST_DIR=0
    
    FILES_COUNT=$(find "src/engine/$d" -type f \( -name "*.ts" -o -name "*.tsx" \) ! -name "*.test.ts" ! -name "*.spec.ts" 2>/dev/null | wc -l)
    
    REACHABLE_FROM=()
    UI_REACH=0
    BE_REACH=0
    
    if grep -q "^$d$" "$REACH_APP"; then REACHABLE_FROM+=("\"App.tsx\""); UI_REACH=1; fi
    if grep -q "^$d$" "$REACH_COMP"; then REACHABLE_FROM+=("\"components/\""); UI_REACH=1; fi
    if grep -q "^$d$" "$REACH_SERVER"; then REACHABLE_FROM+=("\"server.ts\""); BE_REACH=1; fi
    if grep -q "^$d$" "$REACH_IRE"; then REACHABLE_FROM+=("\"IndustrialReadinessEngine\""); BE_REACH=1; fi
    if grep -q "^$d$" "$REACH_QG"; then REACHABLE_FROM+=("\"QualityGate\""); BE_REACH=1; fi
    
    EVIDENCE=()
    if [ ${#REACHABLE_FROM[@]} -gt 0 ]; then
        # Find direct evidence first for the requested grep rule
        EV_FOUND=0
        for f in $EP_APP $EP_SERVER $EP_IRE $EP_QG $EP_COMP; do
            if [ -f "$f" ]; then
                MATCH=$(grep -n "from '.*engine/$d" "$f" | head -n 1)
                if [ ! -z "$MATCH" ]; then
                    EVIDENCE+=("\"$f:$MATCH\"")
                    EV_FOUND=1
                    break
                fi
            fi
        done
        # If not direct, find one transitive importer
        if [ $EV_FOUND -eq 0 ]; then
            IMPORTER=$(grep ":$d" "$IMPORTS_DB" | head -n 1 | cut -d: -f1)
            if [ ! -z "$IMPORTER" ]; then
                LINE=$(grep -n "from '.*$d" "$IMPORTER" | head -n 1)
                EVIDENCE+=("\"$IMPORTER:$LINE\"")
            fi
        fi
    fi

    UNREACHABLE="false"
    if [ ${#REACHABLE_FROM[@]} -eq 0 ]; then
        UNREACHABLE="true"
        U_ANY_COUNT=$((U_ANY_COUNT+1))
        UNREACHABLE_DIRS+=("\"src/engine/$d\"")
    fi
    
    if [ $UI_REACH -eq 1 ] && [ $BE_REACH -eq 1 ]; then R_BOTH_COUNT=$((R_BOTH_COUNT+1)); R_UI_COUNT=$((R_UI_COUNT+1)); R_BE_COUNT=$((R_BE_COUNT+1))
    elif [ $UI_REACH -eq 1 ]; then R_UI_COUNT=$((R_UI_COUNT+1))
    elif [ $BE_REACH -eq 1 ]; then R_BE_COUNT=$((R_BE_COUNT+1))
    fi

    echo "    {"
    echo "      \"directory\": \"src/engine/$d\","
    echo "      \"files_count\": $FILES_COUNT,"
    echo "      \"reachable_from\": [$(IFS=,; echo "${REACHABLE_FROM[*]}")],"
    echo "      \"unreachable\": $UNREACHABLE,"
    echo "      \"evidence\": [$(IFS=,; echo "${EVIDENCE[*]}")]"
    echo "    }"
done

echo "  ],"
echo "  \"final_summary\": {"
echo "    \"total_directories\": ${#DIRS[@]},"
echo "    \"reachable_from_ui\": $R_UI_COUNT,"
echo "    \"reachable_from_backend\": $R_BE_COUNT,"
echo "    \"reachable_from_both\": $R_BOTH_COUNT,"
echo "    \"unreachable_from_any_entry\": $U_ANY_COUNT,"
echo "    \"unreachable_directories\": [$(IFS=,; echo "${UNREACHABLE_DIRS[*]}")]"
echo "  }"
echo "}"
