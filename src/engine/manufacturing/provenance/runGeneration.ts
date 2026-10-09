/**
 * SECP Industrial OS v2 — PATCH-111 Report Generation Runner
 */

import { generateReports111 } from "./generateReports111";

try {
  console.log("Starting PATCH-111 CAM Provenance report generation...");
  generateReports111();
  console.log("PATCH-111 report generation complete.");
} catch (error) {
  console.error("Error generating PATCH-111 reports:", error);
  process.exit(1);
}
