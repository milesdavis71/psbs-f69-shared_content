const { spawnSync } = require('node:child_process');
const path = require('node:path');

if (!process.env.npm_execpath) {
  console.error('Run this script with npm run browserslist:update.');
  process.exit(1);
}

const env = { ...process.env };
// npm can export .npmrc policy as an env override that nested installs reject.
// Let the child npm read the original policy from .npmrc/package.json instead.
for (const key of Object.keys(env)) {
  if (key.toLowerCase() === 'npm_config_allow_scripts') delete env[key];
}

const result = spawnSync(process.execPath, [
  process.env.npm_execpath,
  'update',
  'caniuse-lite',
  'baseline-browser-mapping',
  '--ignore-scripts',
  '--no-audit',
  '--no-fund',
], {
  cwd: path.resolve(__dirname, '..'),
  env,
  stdio: 'inherit',
});

if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
