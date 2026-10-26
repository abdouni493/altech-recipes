// Verifies that fr and ar message files define exactly the same keys.
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve("messages");
const flatten = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([k, v]) => (v && typeof v === "object" ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`]));

let problems = 0;
for (const file of fs.readdirSync(path.join(dir, "fr"))) {
  const fr = new Set(flatten(JSON.parse(fs.readFileSync(path.join(dir, "fr", file), "utf8"))));
  const arPath = path.join(dir, "ar", file);
  if (!fs.existsSync(arPath)) { console.log(`missing ar/${file}`); problems++; continue; }
  const ar = new Set(flatten(JSON.parse(fs.readFileSync(arPath, "utf8"))));
  for (const k of fr) if (!ar.has(k)) { console.log(`ar/${file} missing ${k}`); problems++; }
  for (const k of ar) if (!fr.has(k)) { console.log(`fr/${file} missing ${k}`); problems++; }
}
console.log(problems ? `${problems} problem(s)` : "i18n OK: fr and ar keys match");
process.exit(problems ? 1 : 0);
