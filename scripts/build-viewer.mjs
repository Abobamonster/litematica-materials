import {build} from 'esbuild';
await build({entryPoints:['viewer.js'],bundle:true,minify:true,format:'iife',globalName:'Schematic3D',outfile:'viewer.bundle.js'});
