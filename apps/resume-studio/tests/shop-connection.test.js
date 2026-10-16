import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import {createApp} from '../integrations/desygnshop-portal/server.mjs';
import worker from '../worker/index.js';
import {testDB} from './test-db.js';
import {hash,now} from '../worker/util.js';
import {signBridge,verifyBridge} from '../shared/bridge.js';
const secret='test-only-account-bridge-secret-32-characters-long',app='https://resume.example',shop='https://shop.example';
function transport(server){return async(request)=>{const url=new URL(request.url);return new Promise(async resolve=>{const data=request.method==='GET'?null:Buffer.from(await request.arrayBuffer());const input=Readable.from(data?[data]:[]);input.url=url.pathname+url.search;input.method=request.method;input.socket={remoteAddress:'127.0.0.1'};input.headers=Object.fromEntries(new Headers({...Object.fromEntries(request.headers),host:url.host}));const headers=new Headers();const output={status:200,setHeader(k,v){headers.set(k,v);},writeHead(status,values){this.status=status;for(const [k,v]of Object.entries(values||{}))headers.set(k,v);},end(value){resolve(new Response(value||null,{status:this.status,headers}));}};server.emit('request',input,output);});};}
test('Google account checkout through the portal grants the correct account once without relying on a return page',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'resume-shop-test-')),DB=testDB(),env={DB,APP_URL:app,DESYGN_PORTAL_URL:shop,DESYGN_BRIDGE_SECRET:secret,PAYMENTS_ENABLED:'true'},portalEnv={RESUME_APP_URL:app,DESYGN_PUBLIC_ORIGIN:shop,DESYGN_BRIDGE_SECRET:secret,RESUME_PAYMENTS_ENABLED:'true',STRIPE_RESTRICTED_KEY:'test-placeholder',STRIPE_RESUME_WEBHOOK_SECRET:'test-placeholder',STRIPE_PRICE_RESUME_STARTER:'price_starter',STRIPE_PRICE_RESUME_PLUS:'price_plus'};let checkoutParams,event,creates=0;
 const stripe={prices:{retrieve:async id=>({id,active:true,type:'one_time',currency:'usd',unit_amount:id==='price_starter'?499:999})},checkout:{sessions:{create:async p=>{creates++;checkoutParams=p;return {id:'cs_fixture',url:'https://checkout.stripe.com/test'};},listLineItems:async()=>({data:[{price:{id:'price_starter'},quantity:1}]})}},webhooks:{constructEventAsync:async(raw,signature)=>{if(signature!=='verified-test-signature')throw Error();return event;}}};
 const server=createApp({dataDir:directory,env:portalEnv,stripe}),send=transport(server),old=global.fetch;let portalCookie='',csrf='',resumeCookie='';
 const portal=async(path,method='GET',payload)=>{const r=await send(new Request(shop+path,{method,headers:{Cookie:portalCookie,Origin:shop,'Content-Type':'application/json','X-CSRF-Token':csrf},...(payload?{body:JSON.stringify(payload)}:{})}));if(r.headers.get('Set-Cookie'))portalCookie=r.headers.get('Set-Cookie').split(';')[0];if(r.headers.get('Content-Type')?.includes('json')){const data=await r.clone().json();if(data.csrf)csrf=data.csrf;}return r;};
 global.fetch=async(input,options)=>{const request=input instanceof Request?input:new Request(input,options);if(request.url.startsWith(shop))return send(request);if(request.url.startsWith(app))return worker.fetch(request,env);throw Error('Unexpected external call');};
 try{
  await portal('/api/session');assert.equal((await portal('/api/auth/register','POST',{name:'Alex Member',email:'alex@example.test',password:'a-long-test-password'})).status,201);assert.match(portalCookie,/desygn_session/);
  const userId=await hash('google:https://accounts.google.com:google-test-member');
  await DB.prepare('INSERT INTO users(id,provider,subject,name,created) VALUES(?,?,?,?,?)').bind(userId,'google','google-test-member','Google Member',now()).run();
  await DB.prepare('INSERT INTO sessions(token_hash,user_id,expires) VALUES(?,?,?)').bind(await hash('google-session'),userId,now()+3600).run();resumeCookie='fp_session=google-session';
  const me=await (await worker.fetch(new Request(app+'/api/me',{headers:{Cookie:resumeCookie}}),env)).json();assert.equal(me.user.name,'Google Member');assert.equal(me.user.templatesUnlocked,false);
  const buy=await worker.fetch(new Request(app+'/api/checkout',{method:'POST',headers:{Cookie:resumeCookie,Origin:app},body:JSON.stringify({pack:'starter',credits:999999})}),env);assert.equal(buy.status,200);const payURL=new URL((await buy.json()).url);const ticket=payURL.searchParams.get('ticket');assert.equal((await portal(payURL.pathname+payURL.search)).status,200);
  const forged=await portal('/api/resume/checkout','POST',{ticket:ticket.slice(0,-2)+'ab'});assert.equal(forged.status,401);
  assert.equal((await portal('/api/resume/checkout','POST',{ticket})).status,200);assert.equal(creates,1);assert.equal(checkoutParams.line_items[0].price,'price_starter');assert.equal(checkoutParams.payment_method_types,undefined);assert.equal(checkoutParams.success_url.startsWith(app),true);
  const orderId=checkoutParams.metadata.resume_order_id;assert.equal((await (await worker.fetch(new Request(app+'/api/me',{headers:{Cookie:resumeCookie}}),env)).json()).user.credits,0);
  event={type:'checkout.session.completed',data:{object:{id:'cs_fixture',payment_status:'unpaid',metadata:checkoutParams.metadata,client_reference_id:me.user.id,amount_total:499,currency:'usd'}}};
  const webhook=()=>send(new Request(shop+'/api/resume/stripe/webhook',{method:'POST',headers:{'stripe-signature':'verified-test-signature'},body:'{}'}));assert.equal((await webhook()).status,200);assert.equal((await DB.prepare('SELECT credits FROM users WHERE id=?').bind(me.user.id).first()).credits,0);
  event.data.object.payment_status='paid';assert.equal((await webhook()).status,200);assert.equal((await webhook()).status,200);const paid=await (await worker.fetch(new Request(app+'/api/me',{headers:{Cookie:resumeCookie}}),env)).json();assert.equal(paid.user.credits,10);assert.equal(paid.user.templatesUnlocked,true);
  const status=await worker.fetch(new Request(app+'/api/checkout/status',{method:'POST',headers:{Cookie:resumeCookie,Origin:app},body:JSON.stringify({order:orderId})}),env);assert.equal((await status.json()).paid,true);assert.equal((await DB.prepare('SELECT credits FROM users WHERE id=?').bind(me.user.id).first()).credits,10);
  const account=await (await portal('/api/account')).json();assert.equal(account.orders.length,1);assert.equal(account.orders[0].amountMinor,499);assert.equal(account.plan.paid,false);
  assert.equal((await send(new Request(shop+'/api/resume/stripe/webhook',{method:'POST',headers:{'stripe-signature':'forged'},body:'{}'}))).status,400);
  const wrong=await signBridge(secret,{order_id:orderId,user_id:'someone-else',pack:'starter',paid:true},'resume-fulfillment',shop);assert.equal((await worker.fetch(new Request(app+'/api/shop/webhook',{method:'POST',body:JSON.stringify({receipt:wrong})}),env)).status,409);
  assert.equal(JSON.parse(readFileSync(join(directory,'workspace.json'))).resumeOrders.length,1);
 }finally{global.fetch=old;server.emit('close');rmSync(directory,{recursive:true,force:true});}
});
test('bridge messages reject tampering, wrong audiences, expiry and unsafe service URLs',async()=>{const token=await signBridge(secret,{sub:'member'},'resume-identity',shop);assert.equal((await verifyBridge(secret,token,'resume-identity',shop)).sub,'member');await assert.rejects(()=>verifyBridge(secret,token,'resume-fulfillment',shop));await assert.rejects(()=>verifyBridge(secret,token.slice(0,-2)+'zz','resume-identity',shop));const expired=await signBridge(secret,{},'resume-identity',shop,-60);await assert.rejects(()=>verifyBridge(secret,expired,'resume-identity',shop));});
