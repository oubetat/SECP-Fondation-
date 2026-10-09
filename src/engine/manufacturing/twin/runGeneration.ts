import { generateReports110 } from "./generateReports110";

console.log("Generating 55 PATCH-110 Machine Digital Twin Evidence Reports...");
try {
  generateReports110();
  console.log("Reports generated successfully in reports/manufacturing/patch-110/");
} catch (error) {
  console.error("Report generation failed:", error);
  process.exit(1);
}
