import Stripe from 'stripe';
import {randomBytes} from 'node:crypto';
import {signBridge,verifyBridge,serviceOrigin} from '../shared/bridge.js';
const fail=(status,message)=>Object.assign(Error(message),{status});
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const packs={starter:{credits:10,amount:499,label:'Resume Plus + AI',price:'STRIPE_PRICE_RESUME_STARTER'},plus:{credits:30,amount:999,label:'Opportunity pack',price:'STRIPE_PRICE_RESUME_PLUS'}};
export function createResumeConnection({db,save,sessionFor,env=process.env,stripe:injectedStripe}){
 db.resumeOrders??=[];const checkouts=new Map();
 const settings=()=>{if(!env.RESUME_APP_URL||!env.DESYGN_PUBLIC_ORIGIN||!env.DESYGN_BRIDGE_SECRET||env.DESYGN_BRIDGE_SECRET.length<32)throw fail(503,'Resume Studio connection is not configured.');return {app:serviceOrigin(env.RESUME_APP_URL),portal:serviceOrigin(env.DESYGN_PUBLIC_ORIGIN)};};
 const verify=async(token,aud)=>{const c=settings();try{return await verifyBridge(env.DESYGN_BRIDGE_SECRET,token,aud,c.app);}catch{throw fail(401,'The Resume Studio link is invalid or has expired. Return to Resume Studio and try again.');}};
 const sign=(payload,aud)=>signBridge(env.DESYGN_BRIDGE_SECRET,payload,aud,settings().portal);
 const stripe=()=>injectedStripe||new Stripe(env.STRIPE_RESTRICTED_KEY,{apiVersion:'2026-08-26.dahlia',maxNetworkRetries:1,timeout:15000});
 const paymentReady=()=>{if(env.RESUME_PAYMENTS_ENABLED!=='true'||!env.STRIPE_RESTRICTED_KEY||!env.STRIPE_RESUME_WEBHOOK_SECRET)throw fail(503,'Resume Studio payments are not enabled.');};
 async function read(req,max=16000){let size=0;const pieces=[];for await(const part of req){size+=Buffer.byteLength(part);if(size>max)throw fail(413,'Request is too large.');pieces.push(Buffer.from(part));}return Buffer.concat(pieces).toString();}
 const reply=(res,data)=>{res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 const redirect=(res,url)=>{res.writeHead(303,{Location:url,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});res.end();};
 async function checkedJSON(req){try{return JSON.parse(await read(req));}catch(e){if(e.status)throw e;throw fail(400,'Invalid request.');}}
 async function page(req,res,url){const ticket=url.searchParams.get('ticket');const payload=await verify(ticket,'desygn-checkout');const c=settings();const session=sessionFor(req,res),user=db.users.find(u=>u.id===session.userId);
  if(!user){redirect(res,'/signin?next='+encodeURIComponent(url.pathname+url.search));return;}
  const pack=packs[payload.pack];if(!pack||!/^[a-f0-9-]{36}$/i.test(payload.order_id||'')||!/^[a-f0-9]{64}$/i.test(payload.user_id||''))throw fail(400,'Invalid checkout request.');
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Resume Studio checkout · The Desygn Shop</title><link rel="stylesheet" href="/assets/styles.css"></head><body><main style="max-width:700px;margin:60px auto;padding:24px"><a href="/portal">The Desygn Shop · Account portal</a><p>ASKFUTUREPROOF RESUME STUDIO</p><h1>${pack.label}</h1><h2>$${(pack.amount/100).toFixed(2)} · one-time purchase</h2><p>All 115 resume templates, split layouts, colors and section placement, plus ${pack.credits} AI rewrite credits. No recurring subscription.</p><p>Paying as ${esc(user.name)} (${esc(user.email)}). This purchase unlocks the Resume Studio account that opened this checkout. Your resume and saved jobs are not shared with the shop.</p><form id="resume-checkout"><input type="hidden" name="ticket" value="${esc(ticket)}"><input type="hidden" name="csrf" value="${esc(session.csrf)}"><button class="button primary" ${env.RESUME_PAYMENTS_ENABLED==='true'?'':'disabled'}>Continue to secure payment</button></form><p id="payment-message" role="status">${env.RESUME_PAYMENTS_ENABLED==='true'?'Card details are collected by Stripe.':'Payments are not enabled yet.'}</p><a href="${c.app}/?checkout=cancelled">Return to Resume Studio</a></main><script type="module" src="/assets/resume-checkout.mjs"></script></body></html>`;
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer'});res.end(html);
 }
 async function checkout(req,res){paymentReady();const input=await checkedJSON(req),p=await verify(input.ticket,'desygn-checkout'),c=settings();const session=sessionFor(req,res),user=db.users.find(u=>u.id===session.userId);if(!user)throw fail(401,'Sign in to your shop account.');if(req.headers.origin!==c.portal||req.headers['x-csrf-token']!==session.csrf)throw fail(403,'Refresh checkout and try again.');const pack=packs[p.pack];if(!pack||!/^[a-f0-9-]{36}$/i.test(p.order_id||'')||!/^[a-f0-9]{64}$/i.test(p.user_id||''))throw fail(400,'Invalid checkout.');
  let order=db.resumeOrders.find(o=>o.id===p.order_id);if(order&&(order.userId!==user.id||order.resumeUserId!==p.user_id||order.pack!==p.pack))throw fail(409,'Checkout belongs to another account.');if(order?.paid){reply(res,{url:c.app+'/?checkout=success&order='+order.id});return;}
  if(!env[pack.price])throw fail(503,'This pack price has not been configured.');const client=stripe(),price=await client.prices.retrieve(env[pack.price]);if(!price.active||price.type!=='one_time'||price.currency!=='usd'||price.unit_amount!==pack.amount)throw fail(503,'This pack price does not match.');
  if(!order){if(db.resumeOrders.filter(o=>o.userId===user.id&&!o.paid).length>=50)throw fail(429,'Too many pending checkouts.');order={id:p.order_id,userId:user.id,resumeUserId:p.user_id,pack:p.pack,price:env[pack.price],createdAt:new Date().toISOString(),paid:false};db.resumeOrders.push(order);save();}
  const checkout=await client.checkout.sessions.create({mode:'payment',line_items:[{price:order.price,quantity:1}],client_reference_id:order.resumeUserId,metadata:{resume_order_id:order.id,portal_user_id:user.id},success_url:c.app+'/?checkout=success&order='+order.id,cancel_url:c.app+'/?checkout=cancelled&order='+order.id,integration_identifier:'desygn-resume-'+randomBytes(8).toString('hex').replace(/\d/g,'a').slice(0,8)},{idempotencyKey:'resume-'+order.id});order.sessionId=checkout.id;save();reply(res,{url:checkout.url});
 }
 async function webhook(req,res){paymentReady();let event;const client=stripe();try{event=await client.webhooks.constructEventAsync(await read(req,256000),req.headers['stripe-signature']||'',env.STRIPE_RESUME_WEBHOOK_SECRET);}catch(e){if(e.status)throw e;throw fail(400,'Invalid webhook signature.');}
  if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)){
   const s=event.data.object;if(s.payment_status==='paid'){
    const order=db.resumeOrders.find(o=>o.id===s.metadata?.resume_order_id);if(!order||order.sessionId!==s.id||order.resumeUserId!==s.client_reference_id||order.userId!==s.metadata?.portal_user_id)throw fail(409,'Checkout does not match a recorded order. Retry delivery.');const pack=packs[order.pack];const lines=await client.checkout.sessions.listLineItems(s.id,{limit:2});if(lines.data.length!==1||lines.data[0].price?.id!==order.price||lines.data[0].quantity!==1||s.amount_total!==pack.amount||s.currency!=='usd')throw fail(409,'Checkout price does not match.');
    if(!order.paid){order.paid=true;order.paidAt=new Date().toISOString();if(!db.orders.some(o=>o.providerId===s.id))db.orders.push({providerId:s.id,userId:order.userId,status:'paid',amountMinor:pack.amount,currency:'USD',description:'AskFutureProof '+pack.label,eventAt:order.paidAt});save();}
    const receipt=await sign({order_id:order.id,user_id:order.resumeUserId,pack:order.pack,paid:true},'resume-fulfillment');const notification=await fetch(settings().app+'/api/shop/webhook',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({receipt}),signal:AbortSignal.timeout(15000),redirect:'error'});if(!notification.ok)throw fail(502,'Resume Studio could not receive the payment confirmation. Retry delivery.');
   }
  }reply(res,{received:true});
 }
 return async(req,res,url)=>{
  if(url.pathname==='/connect/resume/checkout'){if(req.method!=='GET')throw fail(405,'Method not allowed.');await page(req,res,url);return true;}
  if(url.pathname==='/api/resume/stripe/webhook'){if(req.method!=='POST')throw fail(405,'Method not allowed.');await webhook(req,res);return true;}
  if(url.pathname==='/api/resume/checkout'){if(req.method!=='POST')throw fail(405,'Method not allowed.');const previous=checkouts.get(req.headers['x-csrf-token'])||Promise.resolve();const task=previous.catch(()=>{}).then(()=>checkout(req,res));checkouts.set(req.headers['x-csrf-token'],task);try{await task;}finally{if(checkouts.get(req.headers['x-csrf-token'])===task)checkouts.delete(req.headers['x-csrf-token']);}return true;}
  if(url.pathname==='/api/resume/order-status'){
   if(req.method!=='POST')throw fail(405,'Method not allowed.');const input=await checkedJSON(req);const p=await verify(input.token,'desygn-order-status');const order=db.resumeOrders.find(o=>o.id===p.order_id&&o.resumeUserId===p.user_id);reply(res,{receipt:order?.paid?await sign({order_id:order.id,user_id:order.resumeUserId,pack:order.pack,paid:true},'resume-fulfillment'):null});return true;
  }return false;
 };
}
