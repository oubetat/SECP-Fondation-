const wabt = require("wabt")();
const fs = require("fs");
async function run() {
  const w = await wabt;
  const wat = fs.readFileSync("nurbs_basis.wat", "utf8");
  const module = w.parseWat('nurbs_basis.wat', wat);
  const binary = module.toBinary({}).buffer;
  const arr = Array.from(binary);
  
  // the pattern for local variables in our code: we have 9 f64 locals.
  // 0x01, 0x09, 0x7c -> 1 local group, 9, f64
  const pattern = [0x01, 0x09, 0x7c];
  let startIdx = -1;
  for (let i = 0; i < arr.length; i++) {
    let match = true;
    for (let j = 0; j < pattern.length; j++) {
      if (arr[i+j] !== pattern[j]) { match = false; break; }
    }
    if (match) { startIdx = i; break; }
  }
  
  if (startIdx !== -1) {
    const body = arr.slice(startIdx);
    console.log("const code5Body = [");
    let out = "";
    for(let i=0; i<body.length; i+=10) {
      out += "  " + body.slice(i, i+10).map(b => '0x' + b.toString(16).padStart(2, '0')).join(', ') + ",\n";
    }
    console.log(out.trim().slice(0, -1) + "\n];");
  }
}
run();
