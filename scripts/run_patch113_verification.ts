/**
 * PATCH-113: Execution & Verification Script
 * Runs all hard acceptance gate evaluations, adversarial tests, scale benchmarks, and generates 18 JSON reports
 */

import { generateAllReports113 } from "../src/engine/assembly/graph/generateReports113";
import { HardAcceptanceGate113 } from "../src/engine/assembly/graph/HardAcceptanceGate113";
import { AssemblyGraphAdversarialSuite } from "../src/engine/assembly/graph/AssemblyGraphAdversarialSuite";
import { AssemblyGraphScaleBenchmark } from "../src/engine/assembly/graph/AssemblyGraphScaleBenchmark";

console.log("================================================================================");
console.log("SECP INDUSTRIAL OS v2 — PATCH-113: ASSEMBLY GRAPH ENGINE VERIFICATION");
console.log("================================================================================\n");

// 1. Generate Reports
console.log(">>> STEP 1: Generating 18 Comprehensive Engineering Reports...");
const genResult = generateAllReports113();
console.log(`>>> Reports generated: ${genResult.reportsGenerated} reports in ${genResult.outputDirectory}\n`);

// 2. Run Hard Acceptance Gate
console.log(">>> STEP 2: Evaluating Hard Acceptance Gate 113...");
const gateReport = HardAcceptanceGate113.evaluate();
console.log(`>>> Total Gate Checks: ${gateReport.totalChecks}`);
console.log(`>>> Passed Gate Checks: ${gateReport.passedChecks}`);
console.log(`>>> Overall Gate Score: ${gateReport.overallScorePercent}%`);
console.log(`>>> Gate Verdict: ${gateReport.verdict}\n`);

for (const check of gateReport.checks) {
  console.log(`  [${check.passed ? "PASS" : "FAIL"}] ${check.checkId}: ${check.name}`);
  console.log(`         ${check.message}`);
}

// 3. Run Adversarial Suite
console.log("\n>>> STEP 3: Evaluating Adversarial & Security Negative Attacks...");
const advReport = AssemblyGraphAdversarialSuite.runAllTests();
console.log(`>>> Total Attacks Tested: ${advReport.totalTests}`);
console.log(`>>> Attacks Successfully Thwarted: ${advReport.passedTests}`);
console.log(`>>> Adversarial Verdict: ${advReport.verdict}\n`);

for (const res of advReport.results) {
  console.log(`  [${res.passed ? "PASS" : "FAIL"}] ${res.testId}: ${res.name} -> ${res.actualResult}`);
}

// 4. Run Multi-Tier Scale Benchmark
console.log("\n>>> STEP 4: Running Scale & Performance Benchmark...");
const scaleReport = AssemblyGraphScaleBenchmark.runBenchmark([10, 100, 1000, 5000]);
for (const m of scaleReport.metrics) {
  console.log(`  [TIER ${m.scaleTier} OCCURRENCES] Create: ${m.creationTimeMs}ms | Validate: ${m.validationTimeMs}ms | Hash: ${m.hashTimeMs}ms | Hash: ${m.graphHash.slice(0, 16)}...`);
}

console.log("\n================================================================================");
console.log(`FINAL ENGINE STATUS: ${gateReport.verdict === "PASS" && advReport.verdict === "PASS" ? "ALL PASS (100% TRUTH VERIFIED)" : "FAILED"}`);
console.log("================================================================================");
