import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const run=(args,{capture=false}={})=>{const r=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js',...args],{stdio:capture?['inherit','pipe','inherit']:'inherit',encoding:'utf8'});if(r.status!==0)throw Error('Cloudflare command failed. Sign in with npm run cloudflare:login, then retry.');return r.stdout;};
try{
 const path='wrangler.jsonc',config=JSON.parse(readFileSync(path,'utf8'));
 if(config.vars.APP_URL!=='https://resume.askfutureproof.com'||!config.routes?.some(r=>r.pattern==='resume.askfutureproof.com'&&r.custom_domain))throw Error('The production domain configuration does not match resume.askfutureproof.com.');
 let databases=JSON.parse(run(['d1','list','--json'],{capture:true}));const binding=config.d1_databases.find(d=>d.binding==='DB');let database=databases.find(d=>d.name===binding.database_name);
 if(!database){run(['d1','create',binding.database_name,'--update-config=false']);databases=JSON.parse(run(['d1','list','--json'],{capture:true}));database=databases.find(d=>d.name===binding.database_name);}
 if(!database?.uuid)throw Error('Cloudflare did not return the Resume Studio database ID.');
 binding.database_id=database.uuid;writeFileSync(path,JSON.stringify(config,null,2)+'\n');
 run(['d1','migrations','apply',binding.database_name,'--remote']);
 const build=spawnSync('npm',['run','build'],{stdio:'inherit'});if(build.status!==0)throw Error('The app build failed.');
 run(['deploy']);console.log('Deployed Resume Studio with its custom domain. Set account/payment secrets separately before enabling purchases.');
}catch(err){console.error(err.message);process.exitCode=1;}
