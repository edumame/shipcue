import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
for (const entry of ['text', 'browser']) {
  const paths = pkg.exports[`./${entry}`];
  assert(existsSync(new URL(`../${paths.types}`, import.meta.url)));
  const esm = await import(`shipcue/${entry}`);
  const cjs = require(`shipcue/${entry}`);
  assert.deepEqual(Object.keys(cjs), Object.keys(esm));
  const result = await build({ entryPoints: [paths.import], bundle: true, write: false, platform: 'browser', metafile: true });
  assert(!Object.keys(result.metafile.inputs).some((input) => /node_modules\/react|dist\/react\//.test(input)));
}
const browser = await import('shipcue/browser');
const react = await import('shipcue/react');
for (const name of ['tabCapture', 'indexedDbDraftStore', 'openReport']) assert.equal(browser[name], react[name]);
assert.equal((await import('shipcue/text')).DEFAULT_TEXT, react.DEFAULT_TEXT);
console.log('Built public entries load, stay React-free and share the panel implementations.');
