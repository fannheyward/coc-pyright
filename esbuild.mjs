import * as esbuild from 'esbuild';

const options = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  sourcemap: false,
  mainFields: ['module', 'main'],
  external: ['coc.nvim'],
  platform: 'node',
  target: 'node16',
  outfile: 'lib/index.js',
};

if (process.argv.length > 2 && process.argv[2] === '--watch') {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('watching...');
} else {
  const result = await esbuild.build(options);
  if (result.errors.length) {
    console.error(result.errors);
  }
}
