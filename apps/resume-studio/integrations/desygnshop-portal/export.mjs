import { mkdirSync, writeFileSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { routes, renderPage } from './src/pages.mjs';
const root=dirname(fileURLToPath(import.meta.url));
for(const route of routes){const folder=join(root,'dist',route);mkdirSync(folder,{recursive:true});writeFileSync(join(folder,'index.html'),renderPage(route).html);}
cpSync(join(root,'public','assets'),join(root,'dist','assets'),{recursive:true});
console.log('Static page snapshot created in dist/. Account features require the local server. Nothing was deployed.');
