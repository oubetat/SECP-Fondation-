const ts = require('typescript');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CONFIG_PATH = './tsconfig.json';
const OUTPUT_DIR = './';

function getSha256(filePath) {
    if (!fs.existsSync(filePath)) return null;
    const buffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

function analyze() {
    console.log('--- Phase 2 Forensic Analysis Starting ---');

    const configPath = ts.findConfigFile("./", ts.sys.fileExists, "tsconfig.json");
    if (!configPath) {
        console.error("Could not find tsconfig.json");
        process.exit(1);
    }

    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, "./");

    console.log('Creating TypeScript Program...');
    const program = ts.createProgram(parsedConfig.fileNames, parsedConfig.options);
    console.log('Program created. Extracting diagnostics...');

    const allDiagnostics = ts.getPreEmitDiagnostics(program);
    console.log(`Total diagnostics found: ${allDiagnostics.length}`);

    const geometryDirs = ['/geometry/', '/topology/', '/nurbs-geometry/', '/cad/', '/sketch/', '/kernels/', '/gcs3d/', '/cam/'];
    const simulationDirs = ['/simulation/', '/fem/', '/cfd/', '/engineeringCore/', '/hpc/', '/linear_algebra/', '/engineering_gpu/', '/engineering_webgpu/'];

    const geometryDiagnostics = [];
    const simulationDiagnostics = [];
    const clusterMap = {};
    const dependencyImpact = {};
    const engineeringTruthImpact = [];

    // Production Reachability Logic
    const entryPoints = ['server.ts', 'src/main.tsx'];
    const reachableFiles = new Set();
    const typeChecker = program.getTypeChecker();

    function trace(sourceFile) {
        if (!sourceFile || reachableFiles.has(sourceFile.fileName)) return;
        reachableFiles.add(sourceFile.fileName);
        
        ts.forEachChild(sourceFile, node => {
            if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
                if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
                    const symbol = typeChecker.getSymbolAtLocation(node.moduleSpecifier);
                    if (symbol && symbol.declarations && symbol.declarations[0]) {
                        const decl = symbol.declarations[0];
                        if (ts.isSourceFile(decl)) {
                            trace(decl);
                        }
                    }
                }
            }
        });
    }

    entryPoints.forEach(ep => {
        const sf = program.getSourceFile(path.resolve(ep));
        if (sf) trace(sf);
    });

    console.log(`Reachable production files: ${reachableFiles.size}`);

    allDiagnostics.forEach(diag => {
        if (!diag.file) return;
        
        const fileName = diag.file.fileName;
        const isGeometry = geometryDirs.some(d => fileName.includes(d));
        const isSimulation = simulationDirs.some(d => fileName.includes(d));
        
        if (!isGeometry && !isSimulation) return;

        const pos = diag.file.getLineAndCharacterOfPosition(diag.start);
        const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
        const isProduction = reachableFiles.has(fileName);

        const entry = {
            file: fileName,
            line: pos.line + 1,
            code: diag.code,
            message: message,
            isProduction: isProduction
        };

        if (isGeometry) geometryDiagnostics.push(entry);
        if (isSimulation) simulationDiagnostics.push(entry);

        // Clustering
        const clusterKey = message.split(' ')[0] + ' ' + (message.split(' ')[1] || '');
        if (!clusterMap[clusterKey]) clusterMap[clusterKey] = { count: 0, examples: [] };
        clusterMap[clusterKey].count++;
        if (clusterMap[clusterKey].examples.length < 3) clusterMap[clusterKey].examples.push(message);

        // Engineering Truth Impact (Production + specific types)
        if (isProduction && (message.includes('type') || message.includes('property') || message.includes('assignable'))) {
            engineeringTruthImpact.push({
                file: fileName,
                severity: 'HIGH',
                reason: 'Type contract violation in production path',
                diagnostic: message
            });
        }
    });

    // Write deliverables
    fs.writeFileSync('GEOMETRY_KERNEL_DIAGNOSTICS.json', JSON.stringify(geometryDiagnostics, null, 2));
    fs.writeFileSync('SIMULATION_SOLVER_DIAGNOSTICS.json', JSON.stringify(simulationDiagnostics, null, 2));
    fs.writeFileSync('ROOT_CAUSE_CLUSTER_MAP.json', JSON.stringify(clusterMap, null, 2));
    fs.writeFileSync('ENGINE_DEPENDENCY_IMPACT.json', JSON.stringify({ reachableFilesCount: reachableFiles.size }, null, 2));
    fs.writeFileSync('ENGINEERING_TRUTH_IMPACT.json', JSON.stringify(engineeringTruthImpact, null, 2));
    
    // Backlog generation logic
    const backlog = [...geometryDiagnostics, ...simulationDiagnostics]
        .filter(d => d.isProduction)
        .slice(0, 100); // Sample for brevity in this run
    fs.writeFileSync('PHASE_2_REPAIR_BACKLOG.json', JSON.stringify(backlog, null, 2));

    console.log('Generating SHA256SUMS.txt...');
    const filesToHash = [
        'GEOMETRY_KERNEL_DIAGNOSTICS.json',
        'SIMULATION_SOLVER_DIAGNOSTICS.json',
        'ROOT_CAUSE_CLUSTER_MAP.json',
        'ENGINE_DEPENDENCY_IMPACT.json',
        'ENGINEERING_TRUTH_IMPACT.json',
        'PHASE_2_REPAIR_BACKLOG.json'
    ];
    let shaManifest = '';
    filesToHash.forEach(f => {
        const hash = getSha256(f);
        if (hash) shaManifest += `${hash}  ${f}\n`;
    });
    fs.writeFileSync('SHA256SUMS.txt', shaManifest);

    console.log('--- Phase 2 Forensic Analysis Complete ---');
}

analyze();
