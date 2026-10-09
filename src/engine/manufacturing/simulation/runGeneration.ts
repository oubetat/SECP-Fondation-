import { generateReports109 } from "./generateReports109";

console.log("Generating 61 PATCH-109 Toolpath Simulation Evidence Reports...");
generateReports109().then(() => {
  console.log("Reports generated successfully in reports/manufacturing/patch-109/");
}).catch(err => {
  console.error("Report generation failed:", err);
  process.exit(1);
});
