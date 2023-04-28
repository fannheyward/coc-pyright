import * as esbuild from 'esbuild';

const options = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: process.env.NODE_ENV === 'production',
  sourcemap: process.env.NODE_ENV === 'development',
  mainFields: ['module', 'main'],
  external: ['coc.nvim'],
  platform: 'node',
  target: 'node14.14',
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
