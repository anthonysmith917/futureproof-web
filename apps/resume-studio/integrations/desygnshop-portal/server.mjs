import {createResumeConnection} from './src/resume-connect.mjs';
import {serviceOrigin} from './shared/bridge.js';
import http from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { dirname, join, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { renderPage } from './src/pages.mjs';
import { previewHTML, starters } from './src/preview.mjs';
import { ensureBillingTables, accountBilling } from './src/billing.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const scrypt = promisify(scryptCallback);
const jsonHeaders = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
const id = () => randomBytes(16).toString('hex');
const now = () => new Date().toISOString();
const fail = (status, message) => Object.assign(new Error(message), {status});
const clean = (v, max = 500) => typeof v === 'string' ? v.trim().slice(0,max) : '';
const normalizeEmail = value => clean(value,254).toLowerCase();
const emailValid = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const publicUser = user => ({id:user.id,name:user.name,email:user.email,createdAt:user.createdAt,brand:user.brand || {}});

export function createApp({dataDir = join(root,'data'), sessionDurationMs = 12*60*60*1000, env=process.env, stripe} = {}) {
  mkdirSync(dataDir,{recursive:true});
  const dbPath = join(dataDir,'workspace.json');
  const db = ensureBillingTables(existsSync(dbPath) ? JSON.parse(readFileSync(dbPath,'utf8')) : {users:[],projects:[],packages:[],planInterests:[]});
  let lastPersisted=structuredClone(db);
  const sessions = new Map();
  const attempts = new Map();
  function save() {
    const tmp = dbPath + '.tmp';
    try {
      writeFileSync(tmp,JSON.stringify(db,null,2),{mode:0o600});
      renameSync(tmp,dbPath);
      lastPersisted=structuredClone(db);
    } catch(error) {
      for(const key of Object.keys(db))delete db[key];
      Object.assign(db,structuredClone(lastPersisted));
      throw error;
    }
  }
  function sessionFor(req,res) {
    const cookie = (req.headers.cookie || '').split(';').map(c=>c.trim()).find(c=>c.startsWith('desygn_session='));
    const token = cookie?.slice('desygn_session='.length);
    let session = token && sessions.get(token);
    if (session && session.expires <= Date.now()) { sessions.delete(token); session = null; }
    if (!session) {
      const newToken = id()+id();
      session = {token:newToken,userId:null,csrf:id(),expires:Date.now()+sessionDurationMs};
      sessions.set(newToken,session);
      res.setHeader('Set-Cookie',`desygn_session=${newToken}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(sessionDurationMs/1000)}${env.DESYGN_PUBLIC_ORIGIN?.startsWith('https:')?'; Secure':''}`);
    }
    return session;
  }
  function login(session,user,res) {
    sessions.delete(session.token);
    const token=id()+id();
    const next={token,userId:user.id,csrf:id(),expires:Date.now()+sessionDurationMs};
    sessions.set(token,next);
    res.setHeader('Set-Cookie',`desygn_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(sessionDurationMs/1000)}${env.DESYGN_PUBLIC_ORIGIN?.startsWith('https:')?'; Secure':''}`);
    return next;
  }
  function requireUser(session) {
    const user=db.users.find(u=>u.id===session.userId);
    if (!user) throw fail(401,'Sign in to save and manage your work.');
    return user;
  }
  async function requirePassword(req,user,password) {
    rateLimit(req);
    if(typeof password!=='string'||password.length>256)throw fail(400,'Enter your current password.');
    const candidate=await scrypt(password,user.salt,64);
    if(!timingSafeEqual(candidate,Buffer.from(user.hash,'hex')))throw fail(401,'Your current password is incorrect.');
  }
  function revokeUserSessions(userId) {
    for(const [token,value] of sessions)if(value.userId===userId)sessions.delete(token);
  }
  async function body(req) {
    if (!(req.headers['content-type'] || '').startsWith('application/json')) throw fail(415,'Send JSON content.');
    let text='';
    for await (const chunk of req) {
      text+=chunk;
      if (Buffer.byteLength(text)>1024*1024) throw fail(413,'This request is too large.');
    }
    try {const parsed=JSON.parse(text || '{}');if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error();return parsed;}
    catch {throw fail(400,'The request could not be read.');}
  }
  function rateLimit(req) {
    const key=req.socket.remoteAddress || 'local';
    const count=attempts.get(key) || {n:0,expires:Date.now()+15*60*1000};
    if(count.expires<Date.now()){count.n=0;count.expires=Date.now()+15*60*1000;}
    count.n++;attempts.set(key,count);
    if(count.n>25)throw fail(429,'Too many sign-in attempts. Try again in 15 minutes.');
  }
  function projectInput(input,old={}) {
    const val={...old};
    for(const [key,max] of Object.entries({name:100,headline:160,description:3000,services:1000,contactEmail:254,brief:6000,color:7,category:24})) {
      if(Object.hasOwn(input,key)) val[key]=clean(input[key],max);
    }
    if(!val.name)throw fail(400,'Give your project a name.');
    if(!Object.hasOwn(starters,val.category))val.category='business';
    if(!/^#[a-f0-9]{6}$/i.test(val.color || ''))val.color=starters[val.category].color;
    if(val.contactEmail&&!emailValid(val.contactEmail))throw fail(400,'Enter a valid public contact email.');
    return val;
  }
  function ownedProject(user,projectId) {
    const project=db.projects.find(p=>p.id===projectId&&p.userId===user.id);
    if(!project)throw fail(404,'Project not found.');
    return project;
  }
  function snapshot(project,label) {
    const {versions,...content}=project;
    project.versions.unshift({id:id(),label:clean(label,140)||'Saved revision',createdAt:now(),content});
    project.versions=project.versions.slice(0,20);
  }
  function reply(res,status,data,headers={}) {res.writeHead(status,{...jsonHeaders,...headers});res.end(JSON.stringify(data));}
  const resumeConnection=createResumeConnection({db,save,sessionFor,env,stripe});
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','same-origin');
    res.setHeader('X-Frame-Options','SAMEORIGIN');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'");
    try {
      const host=req.headers.host || '';
      if(!env.DESYGN_PUBLIC_ORIGIN&&!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host))throw fail(403,'This review server accepts local connections only.');
      const publicOrigin=env.DESYGN_PUBLIC_ORIGIN?serviceOrigin(env.DESYGN_PUBLIC_ORIGIN):null;
      if(publicOrigin&&host!==new URL(publicOrigin).host)throw fail(403,'Unexpected request host.');
      const url=new URL(req.url,publicOrigin||`http://${host}`);
      const path=url.pathname;
      const mutating=!['GET','HEAD','OPTIONS'].includes(req.method);
      if(await resumeConnection(req,res,url))return;
      if(mutating&&req.headers.origin&&req.headers.origin!==url.origin)throw fail(403,'Cross-site requests are not accepted.');
      if(mutating&&req.headers['sec-fetch-site']==='cross-site')throw fail(403,'Cross-site requests are not accepted.');
      if(path.startsWith('/assets/')) {
        if(req.method!=='GET'&&req.method!=='HEAD')throw fail(405,'Method not supported.');
        const assetsRoot=resolve(root,'public','assets');
        const file=resolve(root,'public','.'+decodeURIComponent(path));
        if(!file.startsWith(assetsRoot+sep))throw fail(404,'File not found.');
        if(!existsSync(file))throw fail(404,'File not found.');
        const mime={'.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.svg':'image/svg+xml'}[extname(file)]||'application/octet-stream';
        res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:readFileSync(file));return;
      }
      if(!path.startsWith('/api/')) {
        if(req.method!=='GET'&&req.method!=='HEAD')throw fail(405,'Method not supported.');
        const page=renderPage(path);
        res.writeHead(page.status || 200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
        res.end(req.method==='HEAD'?undefined:page.html);return;
      }
      const session=sessionFor(req,res);
      if(mutating&&req.headers['x-csrf-token']!==session.csrf)throw fail(403,'Your session changed. Refresh and try again.');
      if(path==='/api/session'&&req.method==='GET') {
        const user=db.users.find(u=>u.id===session.userId);
        reply(res,200,{user:user?publicUser(user):null,csrf:session.csrf,mode:'local-review',aiConnected:false,billingConnected:false});return;
      }
      if(path==='/api/auth/register'&&req.method==='POST') {
        rateLimit(req);const input=await body(req);
        const email=normalizeEmail(input.email),name=clean(input.name,100),password=input.password;
        if(!name||!emailValid(email))throw fail(400,'Enter your name and a valid email.');
        if(typeof password!=='string'||password.length<12||password.length>256)throw fail(400,'Use a password between 12 and 256 characters.');
        if(db.users.some(u=>u.email===email))throw fail(409,'An account already exists for this email. Sign in instead.');
        const salt=randomBytes(16).toString('hex');
        const hash=(await scrypt(password,salt,64)).toString('hex');
        if(db.users.some(u=>u.email===email))throw fail(409,'An account already exists for this email.');
        const user={id:id(),email,name,salt,hash,createdAt:now(),brand:{}};
        db.users.push(user);save();const next=login(session,user,res);
        reply(res,201,{user:publicUser(user),csrf:next.csrf});return;
      }
      if(path==='/api/auth/login'&&req.method==='POST') {
        rateLimit(req);const input=await body(req);const email=normalizeEmail(input.email);
        const password=typeof input.password==='string'?input.password:'';
        if(password.length>256)throw fail(400,'Password is too long.');
        const user=db.users.find(u=>u.email===email);
        const hash=await scrypt(password,user?.salt||'local-dummy-salt',64);
        if(!user||!timingSafeEqual(hash,Buffer.from(user.hash,'hex')))throw fail(401,'Email or password is incorrect.');
        const next=login(session,user,res);reply(res,200,{user:publicUser(user),csrf:next.csrf});return;
      }
      if(path==='/api/auth/logout'&&req.method==='POST') {
        sessions.delete(session.token);res.setHeader('Set-Cookie','desygn_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');reply(res,200,{ok:true});return;
      }
      const user=requireUser(session);
      if(path==='/api/account/export'&&req.method==='GET') {
        const {plan,...billing}=accountBilling(db,user.id);
        reply(res,200,{exportedAt:now(),mode:'local-review',user:publicUser(user),resumeOrders:db.resumeOrders.filter(o=>o.userId===user.id),...billing,projects:db.projects.filter(p=>p.userId===user.id),packages:db.packages.filter(p=>p.userId===user.id),planInterest:db.planInterests.find(p=>p.userId===user.id)||null},{'Content-Disposition':'attachment; filename="desygn-workspace-export.json"'});return;
      }
      if(path==='/api/account/profile'&&req.method==='PATCH') {
        const input=await body(req);const name=clean(input.name,100);
        if(!name)throw fail(400,'Enter your name.');
        user.name=name;save();reply(res,200,{user:publicUser(user)});return;
      }
      if(path==='/api/account/password'&&req.method==='POST') {
        const input=await body(req);
        if(typeof input.newPassword!=='string'||input.newPassword.length<12||input.newPassword.length>256)throw fail(400,'Use a new password between 12 and 256 characters.');
        await requirePassword(req,user,input.currentPassword);
        if(input.newPassword===input.currentPassword)throw fail(400,'Choose a different password.');
        const salt=randomBytes(16).toString('hex');
        const hash=(await scrypt(input.newPassword,salt,64)).toString('hex');
        user.salt=salt;user.hash=hash;save();revokeUserSessions(user.id);
        const next=login(session,user,res);reply(res,200,{ok:true,csrf:next.csrf,message:'Password updated. Other sessions have been signed out.'});return;
      }
      if(path==='/api/account'&&req.method==='DELETE') {
        const input=await body(req);
        if(input.confirmation!=='DELETE')throw fail(400,'Type DELETE to confirm removal of this local account.');
        await requirePassword(req,user,input.currentPassword);
        for(const table of ['projects','packages','planInterests','subscriptions','orders','invoices','billingEvents','resumeOrders'])db[table]=db[table].filter(value=>value.userId!==user.id);
        db.users=db.users.filter(value=>value.id!==user.id);save();revokeUserSessions(user.id);
        res.setHeader('Set-Cookie','desygn_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');reply(res,200,{ok:true});return;
      }
      if(path==='/api/account'&&req.method==='GET') {
        reply(res,200,{user:publicUser(user),...accountBilling(db,user.id),projects:db.projects.filter(p=>p.userId===user.id).map(({versions,...p})=>({...p,versionCount:versions.length})),packages:db.packages.filter(p=>p.userId===user.id),planInterest:db.planInterests.find(p=>p.userId===user.id)||null});return;
      }
      if(path==='/api/brand'&&req.method==='PUT') {
        const input=await body(req);const color=clean(input.color,7);
        if(!/^#[a-f0-9]{6}$/i.test(color))throw fail(400,'Choose a valid brand color.');
        user.brand={name:clean(input.name,100),tagline:clean(input.tagline,160),color,notes:clean(input.notes,2000)};save();reply(res,200,{brand:user.brand});return;
      }
      if(path==='/api/plan-interest'&&req.method==='POST') {
        const input=await body(req);if(!['build','assist'].includes(input.plan))throw fail(400,'Choose a plan.');
        db.planInterests=db.planInterests.filter(p=>p.userId!==user.id);
        db.planInterests.push({userId:user.id,plan:input.plan,createdAt:now()});save();reply(res,200,{ok:true,message:'Preference saved. No subscription or charge was created.'});return;
      }
      if(path==='/api/projects'&&req.method==='POST') {
        if(db.projects.filter(p=>p.userId===user.id).length>=50)throw fail(400,'This local workspace supports up to 50 projects.');
        const input=await body(req);const p=projectInput(input);
        const project={...p,id:id(),userId:user.id,createdAt:now(),updatedAt:now(),versions:[],state:'Starter preview'};
        snapshot(project,'Initial brief');db.projects.push(project);save();reply(res,201,{project});return;
      }
      const match=path.match(/^\/api\/projects\/([a-f0-9]{32})(?:\/(preview|download|restore))?$/);
      if(match) {
        const project=ownedProject(user,match[1]);const action=match[2];
        if((action==='preview'||action==='download')&&req.method==='GET') {
          res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store',...(action==='download'?{'Content-Disposition':'attachment; filename="desygn-website.html"'}:{})});res.end(previewHTML(project));return;
        }
        if(action==='restore'&&req.method==='POST') {
          const input=await body(req),version=project.versions.find(v=>v.id===input.versionId);
          if(!version)throw fail(404,'Version not found.');
          Object.assign(project,version.content,{updatedAt:now()});snapshot(project,'Restored: '+version.label);save();reply(res,200,{project});return;
        }
        if(!action&&req.method==='GET'){reply(res,200,{project});return;}
        if(!action&&req.method==='PATCH') {
          const input=await body(req);Object.assign(project,projectInput(input,project),{updatedAt:now()});snapshot(project,input.label||'Updated project brief');save();reply(res,200,{project});return;
        }
      }
      if(path==='/api/packages'&&req.method==='POST') {
        const input=await body(req);
        const linked=input.projectId?ownedProject(user,input.projectId):null;
        if(!clean(input.business,100))throw fail(400,'Enter your business name.');
        if(!['essentials','presence','complete','custom'].includes(input.package))throw fail(400,'Choose a package.');
        const allowed=['website','logo','cards','flyers','yard-signs','banner','apparel'];
        const items=Array.isArray(input.items)?[...new Set(input.items.filter(i=>allowed.includes(i)))]:[];
        if(!items.length)throw fail(400,'Select at least one item.');
        const quantities={};for(const item of items){const n=Number(input.quantities?.[item]??1);if(!Number.isInteger(n)||n<1||n>10000)throw fail(400,'Quantities must be between 1 and 10,000.');quantities[item]=n;}
        if(db.packages.filter(p=>p.userId===user.id).length>=100)throw fail(400,'This local workspace supports up to 100 package briefs.');
        const projectSnapshot=linked?{id:linked.id,name:linked.name,headline:linked.headline||'',color:linked.color,description:linked.description||'',brief:linked.brief||'',versionId:linked.versions[0].id}:null;
        const draft={id:id(),userId:user.id,business:clean(input.business,100),package:input.package,items,quantities,notes:clean(input.notes,3000),projectSnapshot,createdAt:now(),status:'Draft — not submitted',paymentStatus:'No payment collected'};
        db.packages.push(draft);save();reply(res,201,{draft});return;
      }
      throw fail(404,'This action was not found.');
    } catch(error) {
      const status=error.status||500;
      if(status===500)console.error('Local request failed:',error.message);
      reply(res,status,{error:status===500?'Something went wrong. Your last saved work is still available.':error.message});
    }
  });
  server.on('close',()=>{sessions.clear();attempts.clear();});
  return server;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const port=Number(process.env.DESYGN_PORT||4317);
  const app=createApp();
  app.listen(port,'127.0.0.1',()=>console.log(`The Desygn Shop local review: http://127.0.0.1:${port}\nResume Studio account bridge and payments require explicit server configuration.`));
  app.on('error',error=>{console.error(error.code==='EADDRINUSE'?`Port ${port} is already in use. Set DESYGN_PORT to another port.`:error.message);process.exitCode=1;});
}
