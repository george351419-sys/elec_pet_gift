import * as esbuild from 'esbuild'

await esbuild.build({
  entryPoints: ['api/_handler.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'api/index.js',
  external: [
    '@volcengine/rtc',
  ],
})

console.log('✅ api/index.js built')
