import {HttpError,now} from './util.js';
export const costs={summary:1,experience:2,projects:1};
export async function reserve(db,id,userId,inputHash,cost){
 const existing=await db.prepare('SELECT * FROM ai_requests WHERE id=?').bind(id).first();
 if(existing){if(existing.user_id!==userId||existing.input_hash!==inputHash)throw new HttpError('Request ID is already in use.',409);return existing;}
 try{const results=await db.batch([
  db.prepare("INSERT INTO ai_requests(id,user_id,input_hash,cost,status,created) SELECT ?,?,?,?,'reserved',? WHERE (SELECT credits FROM users WHERE id=?)>=?").bind(id,userId,inputHash,cost,now(),userId,cost),
  db.prepare("UPDATE users SET credits=credits-? WHERE id=? AND EXISTS(SELECT 1 FROM ai_requests WHERE id=? AND status='reserved')").bind(cost,userId,id)
 ]);if(results[0].meta.changes!==1)throw new HttpError('You do not have enough AI credits.',402);}catch(err){if(err instanceof HttpError)throw err;const duplicate=await db.prepare('SELECT * FROM ai_requests WHERE id=?').bind(id).first();if(duplicate&&duplicate.user_id===userId&&duplicate.input_hash===inputHash)return duplicate;throw err;}
 return null;
}
export async function refund(db,id,userId){await db.batch([
 db.prepare("UPDATE users SET credits=credits+(SELECT cost FROM ai_requests WHERE id=?) WHERE id=? AND EXISTS(SELECT 1 FROM ai_requests WHERE id=? AND user_id=? AND status='reserved')").bind(id,userId,id,userId),
 db.prepare("UPDATE ai_requests SET status='failed',result=NULL WHERE id=? AND user_id=? AND status='reserved'").bind(id,userId)
]);}
export async function fulfill(db,orderId,sessionId){await db.batch([
 db.prepare('UPDATE users SET credits=credits+(SELECT credits FROM orders WHERE id=?) WHERE id=(SELECT user_id FROM orders WHERE id=?) AND EXISTS(SELECT 1 FROM orders WHERE id=? AND session_id=? AND paid=0)').bind(orderId,orderId,orderId,sessionId),
 db.prepare('UPDATE orders SET paid=1 WHERE id=? AND session_id=? AND paid=0').bind(orderId,sessionId)
]);}
export async function maintenance(db){const t=now();await db.batch([
 db.prepare("UPDATE users SET credits=credits+COALESCE((SELECT SUM(cost) FROM ai_requests WHERE user_id=users.id AND status='reserved' AND created<?),0)").bind(t-3600),
 db.prepare("UPDATE ai_requests SET status='failed' WHERE status='reserved' AND created<?").bind(t-3600),
 db.prepare('DELETE FROM ai_requests WHERE created<?').bind(t-7*86400),
 db.prepare('DELETE FROM sessions WHERE expires<?').bind(t),db.prepare('DELETE FROM oauth_states WHERE expires<?').bind(t),db.prepare('DELETE FROM rate_limits WHERE expires<?').bind(t)
]);}
