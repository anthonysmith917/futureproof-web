import {readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Script} from 'node:vm';
import {renderPage,routes} from './src/pages.mjs';
const root=dirname(fileURLToPath(import.meta.url));
const preview=readFileSync(join(root,'Design-Preview.html'),'utf8');
const script=preview.match(/<script>([\s\S]*)<\/script>/)?.[1];
if(!script)throw Error('Design preview script is missing.');
new Script(script,{filename:'Design-Preview.html'});
for(const route of routes){
  const {html}=renderPage(route);
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  if(new Set(ids).size!==ids.length)throw Error('Duplicate HTML IDs on '+route);
  for(const match of html.matchAll(/(?:href|aria-controls)="(?:#)?([\w-]+)"/g)){
    if(match[0].startsWith('aria-controls')&&!ids.includes(match[1]))throw Error('Missing controlled element '+match[1]+' on '+route);
  }
}
if(/https?:\/\/[^"'\s]*\.(?:css|js|woff|png|jpg)/i.test(preview))throw Error('Unexpected remote design dependency.');
console.log('Standalone preview script parses; 13 page structures pass ID checks; no remote design assets are required.');
