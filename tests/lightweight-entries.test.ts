import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

describe('lightweight public entries', () => {
  it.each(['text', 'browser'])('%s has typed ESM and CommonJS-compatible exports without React', async (entry) => {
    const paths = pkg.exports[`./${entry}`];
    expect(paths).toBeDefined();
    expect(paths.default).toBe(paths.import);
    expect(paths.types).toBe(`./dist/${entry}/index.d.ts`);
    const result = await build({
      entryPoints: [`src/${entry}/index.ts`], bundle: true, write: false,
      platform: 'browser', format: 'esm', metafile: true,
    });
    const inputs = Object.keys(result.metafile!.inputs);
    expect(inputs.some((input) => /node_modules\/react|\.tsx$/.test(input))).toBe(false);
    if (entry === 'text') expect(inputs).toEqual(['src/react/text.ts', 'src/text/index.ts']);
  });
});
