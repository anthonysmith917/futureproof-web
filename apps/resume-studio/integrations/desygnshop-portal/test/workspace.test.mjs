import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { createApp } from '../server.mjs';
import { routes } from '../src/pages.mjs';

test('local customer journey preserves ownership, versions, drafts and billing boundaries',async(t)=>{
  const testRoot=dirname(fileURLToPath(import.meta.url));
  const temporary=mkdtempSync(join(testRoot,'desygn-test-'));
  let server=createApp({dataDir:temporary});
  const origin='http://127.0.0.1:4317';
  t.after(()=>{
    server.emit('close');
    const target=resolve(temporary);
    if(dirname(target)!==resolve(testRoot)||!basename(target).startsWith('desygn-test-'))throw Error('Unexpected test cleanup path.');
    rmSync(target,{recursive:true,force:true});
  });
  function client(){return {cookie:'',csrf:'',async request(path,{method='GET',body,csrf=true,headers={}}={}){
    const response=await new Promise(resolve=>{
      const input=Readable.from(body?[JSON.stringify(body)]:[]);
      input.url=path;input.method=method;input.socket={remoteAddress:'127.0.0.1'};
      input.headers=Object.fromEntries(Object.entries({Host:new URL(origin).host,Cookie:this.cookie,...(body?{'Content-Type':'application/json'}:{}),...(method!=='GET'&&csrf?{'X-CSRF-Token':this.csrf}:{}),...headers}).map(([k,v])=>[k.toLowerCase(),v]));
      const responseHeaders=new Headers();
      const output={status:200,setHeader(name,value){responseHeaders.set(name,value);},writeHead(status,values){this.status=status;for(const [k,v] of Object.entries(values))responseHeaders.set(k,v);},end(value){resolve({status:this.status,headers:responseHeaders,text:async()=>value?.toString()||''});}};
      server.emit('request',input,output);
    });
    const cookie=response.headers.get('set-cookie');if(cookie)this.cookie=cookie.split(';')[0];
    const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}
    if(data.csrf)this.csrf=data.csrf;
    return {status:response.status,data,headers:response.headers};
  }};}
  const alice=client(),bob=client();
  await t.test('all review pages render with working internal routes',async()=>{
    for(const route of routes){const r=await alice.request(route);assert.equal(r.status,200,route);assert.match(r.data,/<main id="main"/);for(const match of r.data.matchAll(/href="(\/[^"?#]*)(?:[?#][^"]*)?"/g)){assert.ok(routes.includes(match[1])||match[1].startsWith('/assets/'),'Unrecognized link '+match[1]);}}
    assert.equal((await alice.request('/assets/styles.css')).status,200);
    assert.equal((await alice.request('/assets/app.mjs')).status,200);
    assert.equal((await alice.request('/not-a-page')).status,404);
  });
  await alice.request('/api/session');
  await t.test('authentication rejects missing CSRF and cross-origin registration',async()=>{
    assert.equal((await alice.request('/api/auth/register',{method:'POST',csrf:false,body:{}})).status,403);
    assert.equal((await alice.request('/api/auth/register',{method:'POST',body:{},headers:{Origin:'https://elsewhere.invalid'}})).status,403);
  });
  let aliceId;
  await t.test('registration stores a hash, rotates session and rejects duplicates',async()=>{
    const before=alice.cookie;
    const result=await alice.request('/api/auth/register',{method:'POST',body:{name:'Alice Review',email:'alice@example.test',password:'a-long-review-password'}});
    assert.equal(result.status,201);aliceId=result.data.user.id;assert.notEqual(before,alice.cookie);
    assert.ok(!Object.hasOwn(result.data.user,'hash'));
    const stored=JSON.parse(readFileSync(join(temporary,'workspace.json'),'utf8'));
    assert.ok(stored.users[0].salt);assert.equal(stored.users[0].hash.length,128);assert.ok(!JSON.stringify(stored).includes('a-long-review-password'));
    assert.equal((await alice.request('/api/auth/register',{method:'POST',body:{name:'Duplicate',email:'ALICE@example.test',password:'a-long-review-password'}})).status,409);
  });
  await bob.request('/api/session');
  assert.equal((await bob.request('/api/auth/register',{method:'POST',body:{name:'Bob Review',email:'bob@example.test',password:'another-long-password'}})).status,201);
  let project,initialVersion;
  await t.test('create a project and download an escaped personalized website',async()=>{
    const result=await alice.request('/api/projects',{method:'POST',body:{name:'Fieldwork <script>',headline:'Good things start here.',description:'Gardens & grounds.',color:'#456b43',category:'business',services:'Design\nMaintenance',contactEmail:'hello@example.test',brief:'A welcoming business website.'}});
    assert.equal(result.status,201);project=result.data.project;initialVersion=project.versions[0].id;
    const preview=await alice.request('/api/projects/'+project.id+'/preview');assert.equal(preview.status,200);assert.match(preview.data,/Fieldwork &lt;script&gt;/);assert.doesNotMatch(preview.data,/<script>/);assert.match(preview.data,/mailto:hello@example.test/);
    const source=await alice.request('/api/projects/'+project.id+'/download');assert.equal(source.status,200);assert.match(source.headers.get('content-disposition'),/attachment/);assert.equal(source.data,preview.data);
  });
  await t.test('a second account cannot read, change, preview or restore another account project',async()=>{
    for(const suffix of ['', '/preview','/download'])assert.equal((await bob.request('/api/projects/'+project.id+suffix)).status,404);
    assert.equal((await bob.request('/api/projects/'+project.id,{method:'PATCH',body:{name:'Hijacked'}})).status,404);
    assert.equal((await bob.request('/api/projects/'+project.id+'/restore',{method:'POST',body:{versionId:initialVersion}})).status,404);
    const account=await bob.request('/api/account');assert.equal(account.data.projects.length,0);
  });
  await t.test('revisions and restoring a version preserve the history',async()=>{
    const update=await alice.request('/api/projects/'+project.id,{method:'PATCH',body:{name:'Fieldwork revised',headline:'Our new direction.',label:'Headline update'}});
    assert.equal(update.status,200);assert.equal(update.data.project.versions.length,2);assert.equal(update.data.project.name,'Fieldwork revised');
    const restore=await alice.request('/api/projects/'+project.id+'/restore',{method:'POST',body:{versionId:initialVersion}});
    assert.equal(restore.status,200);assert.equal(restore.data.project.name,'Fieldwork <script>');assert.equal(restore.data.project.versions.length,3);
    assert.match(restore.data.project.versions[0].label,/Restored/);
  });
  await t.test('brand details and package briefs persist without creating purchases',async()=>{
    assert.equal((await alice.request('/api/brand',{method:'PUT',body:{name:'Fieldwork',tagline:'Rooted in something good.',color:'#456b43',notes:'Warm and welcoming.'}})).status,200);
    const draft=await alice.request('/api/packages',{method:'POST',body:{business:'Fieldwork',package:'presence',items:['website','yard-signs','banner'],quantities:{website:1,'yard-signs':4,banner:1},notes:'Coordinate with our brand.'}});
    assert.equal(draft.status,201);assert.equal(draft.data.draft.status,'Draft — not submitted');assert.equal(draft.data.draft.paymentStatus,'No payment collected');
    const account=await alice.request('/api/account');assert.equal(account.data.user.brand.name,'Fieldwork');assert.equal(account.data.packages.length,1);assert.equal(account.data.orders.length,0);assert.equal(account.data.invoices.length,0);
    assert.equal((await bob.request('/api/account')).data.packages.length,0);
    assert.equal((await alice.request('/api/packages',{method:'POST',body:{business:'Bad quantity',package:'custom',items:['banner'],quantities:{banner:-3}}})).status,400);
  });
  await t.test('plan preference cannot grant a paid subscription',async()=>{
    assert.equal((await alice.request('/api/plan-interest',{method:'POST',body:{plan:'build',paid:true,subscription:'active'}})).status,200);
    const account=await alice.request('/api/account');assert.equal(account.data.plan.id,'free');assert.equal(account.data.plan.paid,false);assert.equal(account.data.subscriptions.length,0);assert.equal(account.data.planInterest.plan,'build');
    assert.equal((await alice.request('/api/plan-interest',{method:'POST',body:{plan:'invented-plan'}})).status,400);
  });
  await t.test('logout removes access and incorrect passwords fail',async()=>{
    assert.equal((await alice.request('/api/auth/logout',{method:'POST',body:{}})).status,200);
    assert.equal((await alice.request('/api/account')).status,401);
    await alice.request('/api/session');
    assert.equal((await alice.request('/api/auth/login',{method:'POST',body:{email:'alice@example.test',password:'wrong-password'}})).status,401);
    assert.equal((await alice.request('/api/auth/login',{method:'POST',body:{email:'alice@example.test',password:'a-long-review-password'}})).status,200);
  });
  await t.test('saved accounts, project versions and briefs survive server restart',async()=>{
    server.emit('close');server=createApp({dataDir:temporary});
    alice.cookie='';await alice.request('/api/session');
    const login=await alice.request('/api/auth/login',{method:'POST',body:{email:'alice@example.test',password:'a-long-review-password'}});assert.equal(login.status,200);assert.equal(login.data.user.id,aliceId);
    const account=await alice.request('/api/account');assert.equal(account.data.projects.length,1);assert.equal(account.data.projects[0].versionCount,3);assert.equal(account.data.packages.length,1);assert.equal(account.data.user.brand.color,'#456b43');
  });
  let linkedDraft;
  await t.test('launch package captures an owned project snapshot and ignores a forged snapshot',async()=>{
    const result=await alice.request('/api/packages',{method:'POST',body:{business:'Fieldwork launch',package:'presence',projectId:project.id,projectSnapshot:{name:'Forged',color:'#000000'},items:['website','banner'],quantities:{website:1,banner:2},notes:'Carry through the website direction.'}});
    assert.equal(result.status,201);linkedDraft=result.data.draft;
    assert.equal(linkedDraft.projectSnapshot.id,project.id);assert.equal(linkedDraft.projectSnapshot.name,'Fieldwork <script>');assert.equal(linkedDraft.projectSnapshot.color,'#456b43');
    await alice.request('/api/projects/'+project.id,{method:'PATCH',body:{name:'A later project direction',color:'#123456'}});
    const account=await alice.request('/api/account');assert.equal(account.data.packages.find(p=>p.id===linkedDraft.id).projectSnapshot.color,'#456b43');
  });
  await bob.request('/api/session');
  await bob.request('/api/auth/login',{method:'POST',body:{email:'bob@example.test',password:'another-long-password'}});
  let bobProject;
  await t.test('a package cannot reference another customer project',async()=>{
    assert.equal((await bob.request('/api/packages',{method:'POST',body:{business:'Cross-account',package:'custom',projectId:project.id,items:['banner'],quantities:{banner:1}}})).status,404);
    const result=await bob.request('/api/projects',{method:'POST',body:{name:'Bob project',category:'creator'}});assert.equal(result.status,201);bobProject=result.data.project;
  });
  await t.test('account profile updates stay within the signed-in customer',async()=>{
    assert.equal((await alice.request('/api/account/profile',{method:'PATCH',body:{name:' '}})).status,400);
    const update=await alice.request('/api/account/profile',{method:'PATCH',body:{name:'Alice Updated',userId:bobProject.userId}});assert.equal(update.status,200);assert.equal(update.data.user.name,'Alice Updated');
    assert.equal((await bob.request('/api/account')).data.user.name,'Bob Review');
  });
  await t.test('account export contains owned records and excludes authentication secrets and other accounts',async()=>{
    const result=await alice.request('/api/account/export');assert.equal(result.status,200);assert.match(result.headers.get('content-disposition'),/attachment/);
    assert.equal(result.data.user.name,'Alice Updated');assert.equal(result.data.projects.length,1);assert.equal(result.data.packages.length,2);
    const serialized=JSON.stringify(result.data);assert.ok(!serialized.includes('"hash"'));assert.ok(!serialized.includes('"salt"'));assert.ok(!serialized.includes('bob@example.test'));assert.ok(!serialized.includes('a-long-review-password'));
  });
  const secondAlice=client();await secondAlice.request('/api/session');await secondAlice.request('/api/auth/login',{method:'POST',body:{email:'alice@example.test',password:'a-long-review-password'}});
  await t.test('password changes reject invalid credentials and revoke other account sessions',async()=>{
    assert.equal((await alice.request('/api/account/password',{method:'POST',body:{currentPassword:'wrong',newPassword:'updated-long-password'}})).status,401);
    assert.equal((await alice.request('/api/account/password',{method:'POST',body:{currentPassword:'a-long-review-password',newPassword:'short'}})).status,400);
    assert.equal((await alice.request('/api/account/password',{method:'POST',body:{currentPassword:'a-long-review-password',newPassword:'updated-long-password'}})).status,200);
    assert.equal((await alice.request('/api/account')).status,200);assert.equal((await secondAlice.request('/api/account')).status,401);assert.equal((await bob.request('/api/account')).status,200);
    await secondAlice.request('/api/session');assert.equal((await secondAlice.request('/api/auth/login',{method:'POST',body:{email:'alice@example.test',password:'a-long-review-password'}})).status,401);
    assert.equal((await secondAlice.request('/api/auth/login',{method:'POST',body:{email:'alice@example.test',password:'updated-long-password'}})).status,200);
  });
  await t.test('account deletion requires confirmation and the current password',async()=>{
    assert.equal((await alice.request('/api/account',{method:'DELETE',body:{confirmation:'',currentPassword:'updated-long-password'}})).status,400);
    assert.equal((await alice.request('/api/account',{method:'DELETE',body:{confirmation:'DELETE',currentPassword:'wrong'}})).status,401);
    assert.equal((await alice.request('/api/account')).data.projects.length,1);
  });
  await t.test('deletion removes only the customer records and revokes all of their sessions',async()=>{
    assert.equal((await alice.request('/api/account',{method:'DELETE',body:{confirmation:'DELETE',currentPassword:'updated-long-password'}})).status,200);
    assert.equal((await alice.request('/api/account')).status,401);assert.equal((await secondAlice.request('/api/account')).status,401);
    const bobAccount=await bob.request('/api/account');assert.equal(bobAccount.status,200);assert.equal(bobAccount.data.projects.length,1);assert.equal(bobAccount.data.projects[0].id,bobProject.id);
    const stored=JSON.parse(readFileSync(join(temporary,'workspace.json'),'utf8'));assert.ok(!stored.users.some(u=>u.id===aliceId));
    for(const table of ['projects','packages','planInterests','subscriptions','orders','invoices','billingEvents'])assert.ok(!stored[table].some(r=>r.userId===aliceId),table);
  });
});
