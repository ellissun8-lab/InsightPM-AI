import { runHardValidation } from "./lib/hard-validation";

const args = process.argv.slice(2);
let dataset = "mixed-feedback";
let baseDir: string | undefined;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--base-dir" && args[i + 1]) {
    baseDir = args[++i];
  } else if (!args[i].startsWith("--")) {
    dataset = args[i];
  }
}

(async () => {
  const result = await runHardValidation(dataset, baseDir);
  console.log(JSON.stringify(result, null, 2));
})();
