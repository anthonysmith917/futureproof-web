import Stripe from 'stripe';
import {HttpError,requireEnv,json,body,now} from './util.js';
import {fulfill} from './credits.js';
export function stripeClient(env){requireEnv(env,'STRIPE_RESTRICTED_KEY');return new Stripe(env.STRIPE_RESTRICTED_KEY,{apiVersion:'2026-08-26.dahlia',httpClient:Stripe.createFetchHttpClient(),maxNetworkRetries:1,timeout:15000});}
export async function checkout(request,env,user){
 if(env.PAYMENTS_ENABLED!=='true')throw new HttpError('Purchases are not enabled yet.',503);
 requireEnv(env,'STRIPE_RESTRICTED_KEY','STRIPE_WEBHOOK_SECRET','STRIPE_PRICE_STARTER','STRIPE_PRICE_PLUS','APP_URL');
 const {pack}=await body(request,1000);const packs={starter:{credits:10,price:env.STRIPE_PRICE_STARTER,amount:499},plus:{credits:30,price:env.STRIPE_PRICE_PLUS,amount:999}};if(!packs[pack])throw new HttpError('Unknown credit pack.');
 const client=stripeClient(env),price=await client.prices.retrieve(packs[pack].price);if(!price.active||price.currency!=='usd'||price.unit_amount!==packs[pack].amount||price.type!=='one_time')throw new HttpError('The credit pack price is not configured correctly.',503);
 const id=crypto.randomUUID();await env.DB.prepare('INSERT INTO orders(id,user_id,pack,credits,created) VALUES(?,?,?,?,?)').bind(id,user.id,pack,packs[pack].credits,now()).run();
 const session=await client.checkout.sessions.create({mode:'payment',line_items:[{price:packs[pack].price,quantity:1}],metadata:{order_id:id},client_reference_id:user.id,success_url:new URL('/?checkout=success',env.APP_URL).href,cancel_url:new URL('/?checkout=cancelled',env.APP_URL).href,integration_identifier:'futureproof-resume-'+Array.from(crypto.getRandomValues(new Uint8Array(8))).map(x=>String.fromCharCode(97+x%26)).join('')},{idempotencyKey:id});
 await env.DB.prepare('UPDATE orders SET session_id=? WHERE id=?').bind(session.id,id).run();return json({url:session.url});
}
export async function webhook(request,env){
 requireEnv(env,'DB','STRIPE_WEBHOOK_SECRET','STRIPE_RESTRICTED_KEY');
 if(Number(request.headers.get('Content-Length')||0)>256000)throw new HttpError('Payload is too large.',413);
 const raw=await request.text();if(raw.length>256000)throw new HttpError('Payload is too large.',413);
 const client=stripeClient(env);let event;try{event=await client.webhooks.constructEventAsync(raw,request.headers.get('Stripe-Signature')||'',env.STRIPE_WEBHOOK_SECRET,300,Stripe.createSubtleCryptoProvider());}catch{throw new HttpError('Invalid webhook signature.',400);}
 if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)){
  const session=event.data.object;
  if(session.payment_status!=='paid')return json({received:true});
  const order=await env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(session.metadata?.order_id||'').first();
  if(!order||order.user_id!==session.client_reference_id)throw new HttpError('Checkout order does not match.',409);
  // A webhook can race the response that stores the session ID; retry instead of granting twice.
  if(order.session_id!==session.id)throw new HttpError('Checkout is still being recorded. Retry delivery.',409);
  const lines=await client.checkout.sessions.listLineItems(session.id,{limit:2});const price=order.pack==='starter'?env.STRIPE_PRICE_STARTER:env.STRIPE_PRICE_PLUS;
  if(lines.data.length!==1||lines.data[0].price?.id!==price||lines.data[0].quantity!==1)throw new HttpError('Checkout price does not match.',409);
  await fulfill(env.DB,order.id,session.id);
 }
 return json({received:true});
}
