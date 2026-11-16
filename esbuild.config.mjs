import { build } from "esbuild";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

await build({
  entryPoints: ["src/ui/slabton-card.js"],
  outfile: "dist/slabton.js",
  bundle: true,
  format: "iife",
  target: "es2020",
  minify: true,
  legalComments: "none",
  banner: { js: `/* slabton-card v${pkg.version} - MPL-2.0 - https://github.com/arboeh/slABton */` },
});

console.log(`Built dist/slabton.js (v${pkg.version})`);
