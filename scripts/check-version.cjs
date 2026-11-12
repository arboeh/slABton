const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));

const source = fs.readFileSync(path.join(root, 'src', 'version.js'), 'utf-8');
const sourceVersion = source.match(/VERSION\s*=\s*['"]([^'"]+)['"]/)?.at(1) ?? '';
if (pkg.version !== sourceVersion) {
  console.error(`Version mismatch: ${pkg.version} (package.json) !== ${sourceVersion} (src/version.js)`);
  process.exit(1);
}

// The bundle is optional locally, but when present it must carry the same version.
const distPath = path.join(root, 'dist', 'slabton.js');
if (fs.existsSync(distPath)) {
  const banner = `slabton-card v${pkg.version}`;
  if (!fs.readFileSync(distPath, 'utf-8').includes(banner)) {
    console.error(`Bundle dist/slabton.js is stale: banner "${banner}" not found. Run "npm run build".`);
    process.exit(1);
  }
}

console.log(`Versions match: ${pkg.version}`);
