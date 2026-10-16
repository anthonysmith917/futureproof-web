import {signBridge,verifyBridge,serviceOrigin} from '../shared/bridge.js';
import {HttpError,now,json,body} from './util.js';
import {fulfill} from './credits.js';
export function shopReady(env){try{return !!(env.DB&&env.APP_URL&&env.DESYGN_PORTAL_URL&&env.DESYGN_BRIDGE_SECRET?.length>=32&&serviceOrigin(env.DESYGN_PORTAL_URL)&&serviceOrigin(env.APP_URL));}catch{return false;}}
async function shopCall(env,path,payload,audience){const origin=serviceOrigin(env.DESYGN_PORTAL_URL);const token=await signBridge(env.DESYGN_BRIDGE_SECRET,payload,audience,serviceOrigin(env.APP_URL));const res=await fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token}),signal:AbortSignal.timeout(15000),redirect:'error'});if(!res.ok)throw new HttpError('The Desygn Shop connection is temporarily unavailable. Please retry.',502);return res.json();}
export async function shopCheckout(request,env,u){
 if(!shopReady(env)||env.PAYMENTS_ENABLED!=='true')throw new HttpError('Portal purchases have not been enabled yet.',503);
 const {pack}=await body(request,1000);if(!['starter','plus'].includes(pack))throw new HttpError('Unknown credit pack.');
 const id=crypto.randomUUID();await env.DB.prepare('INSERT INTO orders(id,user_id,pack,credits,session_id,created) VALUES(?,?,?,?,?,?)').bind(id,u.id,pack,pack==='starter'?10:30,'shop:'+id,now()).run();
 const ticket=await signBridge(env.DESYGN_BRIDGE_SECRET,{order_id:id,user_id:u.id,pack},'desygn-checkout',serviceOrigin(env.APP_URL));const target=new URL('/connect/resume/checkout',env.DESYGN_PORTAL_URL);target.searchParams.set('ticket',ticket);return json({url:target.href});
}
export async function syncShopOrder(env,u,id){
 if(!shopReady(env))return {paid:false};if(!/^[a-f0-9-]{36}$/i.test(id||''))throw new HttpError('Invalid order.');
 const order=await env.DB.prepare('SELECT * FROM orders WHERE id=? AND user_id=?').bind(id,u.id).first();if(!order||order.session_id!=='shop:'+id)throw new HttpError('Order not found.',404);if(order.paid)return {paid:true};
 const response=await shopCall(env,'/api/resume/order-status',{order_id:id,user_id:u.id},'desygn-order-status');if(!response.receipt)return {paid:false};let receipt;try{receipt=await verifyBridge(env.DESYGN_BRIDGE_SECRET,response.receipt,'resume-fulfillment',serviceOrigin(env.DESYGN_PORTAL_URL));}catch{throw new HttpError('Payment confirmation could not be verified.',502);}
 if(receipt.order_id!==id||receipt.user_id!==u.id||receipt.pack!==order.pack||receipt.paid!==true)throw new HttpError('Payment confirmation did not match.',409);await fulfill(env.DB,id,'shop:'+id);return {paid:true};
}
export async function receiveShopPayment(request,env){
 if(!shopReady(env))throw new HttpError('Portal payment connection is not configured.',503);
 const {receipt}=await body(request,16000);let p;try{p=await verifyBridge(env.DESYGN_BRIDGE_SECRET,receipt,'resume-fulfillment',serviceOrigin(env.DESYGN_PORTAL_URL));}catch{throw new HttpError('Invalid portal payment signature.',401);}
 if(p.paid!==true||typeof p.order_id!=='string'||typeof p.user_id!=='string')throw new HttpError('Invalid payment confirmation.');const order=await env.DB.prepare('SELECT * FROM orders WHERE id=? AND user_id=?').bind(p.order_id,p.user_id).first();if(!order||order.pack!==p.pack||order.session_id!=='shop:'+order.id)throw new HttpError('Payment order does not match.',409);await fulfill(env.DB,order.id,order.session_id);return json({received:true});
}
