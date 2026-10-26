import { FEMG1BVerificationCampaign } from "./FEMG1BVerificationCampaign";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("Starting FEM G1-B Verification Campaign...");
  const campaign = new FEMG1BVerificationCampaign();
  const results = await campaign.runCampaign();

  const summary = {
    campaignId: "SECP-FEM-QUALIFICATION-001-G1-B",
    timestamp: new Date().toISOString(),
    totalTests: results.length,
    passed: results.filter(r => r.status === "PASS").length,
    failed: results.filter(r => r.status === "FAIL").length,
    results: results
  };

  console.log(`Campaign Finished: ${summary.passed}/${summary.totalTests} Passed`);

  // Output as a JSON artifact
  const artifactPath = path.join(process.cwd(), ".aistudio", "artifacts", "brain", "9f1187ef-79ca-4cd8-9909-157bcf9db814", "G1_B_VERIFICATION_RESULTS.json");
  fs.writeFileSync(artifactPath, JSON.stringify(summary, null, 2));
  
  // Also output a markdown report
  const reportPath = path.join(process.cwd(), ".aistudio", "artifacts", "brain", "9f1187ef-79ca-4cd8-9909-157bcf9db814", "G1_B_VERIFICATION_REPORT.md");
  let md = `# SECP-FEM-QUALIFICATION-001 — G1-B Report\n\n`;
  md += `**Status:** ${summary.failed === 0 ? "✅ QUALIFIED" : "❌ FAILED"}\n`;
  md += `**Timestamp:** ${summary.timestamp}\n\n`;
  md += `## Summary\n- Total Tests: ${summary.totalTests}\n- Passed: ${summary.passed}\n- Failed: ${summary.failed}\n\n`;
  md += `## Detailed Results\n\n`;
  
  for (const r of results) {
    md += `### ${r.testId}: ${r.name}\n`;
    md += `- Status: ${r.status === "PASS" ? "✅ PASS" : "❌ FAIL"}\n`;
    md += `- Analytical: ${JSON.stringify(r.analytical)}\n`;
    md += `- Numerical: ${JSON.stringify(r.numerical)}\n`;
    md += `- Error: ${r.error.toExponential(4)}\n`;
    md += `- Tolerance: ${r.tolerance.toExponential(4)}\n\n`;
  }
  
  fs.writeFileSync(reportPath, md);
  console.log("Artifacts generated.");
}

main().catch(err => {
  console.error("Campaign execution failed:", err);
  process.exit(1);
});
