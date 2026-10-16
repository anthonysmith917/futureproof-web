import {createRemoteJWKSet,jwtVerify} from 'jose';
import {HttpError,requireEnv,cookie,sessionCookie,random,hash,now,limit} from './util.js';
const keys=new Map();
function provider(env,id){
 if(id==='google'){requireEnv(env,'GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET');return {id,clientId:env.GOOGLE_CLIENT_ID,secret:env.GOOGLE_CLIENT_SECRET,discovery:'https://accounts.google.com/.well-known/openid-configuration'};}
 throw new HttpError('Unknown sign-in provider.',404);
}
export async function user(request,env){requireEnv(env,'DB');const token=cookie(request,'fp_session');if(!token)return null;const row=await env.DB.prepare('SELECT users.id,users.name,users.credits,EXISTS(SELECT 1 FROM orders WHERE orders.user_id=users.id AND orders.paid=1) AS templates_unlocked FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires>?').bind(await hash(token),now()).first();if(!row)return null;const {templates_unlocked,...account}=row;return {...account,templatesUnlocked:templates_unlocked===1};}
export async function requireUser(request,env){const u=await user(request,env);if(!u)throw new HttpError('Sign in before using this feature.',401);return u;}
export async function authRoute(request,env,url){
 const parts=url.pathname.split('/').filter(Boolean),p=provider(env,parts[1]);requireEnv(env,'DB','APP_URL');
 await limit(env,'auth:'+request.headers.get('CF-Connecting-IP'),30,600);
 const res=await fetch(p.discovery,{signal:AbortSignal.timeout(8000)});if(!res.ok)throw new HttpError('Sign-in provider is unavailable.',503);const config=await res.json();
 const callback=new URL(`/auth/${p.id}/callback`,env.APP_URL).href;
 if(parts.length===2){
  const state=random(),verifier=random(),nonce=random();await env.DB.prepare('INSERT INTO oauth_states(id,verifier,nonce,provider,expires) VALUES(?,?,?,?,?)').bind(await hash(state),verifier,nonce,p.id,now()+600).run();
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));const challenge=btoa(String.fromCharCode(...digest)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
  const target=new URL(config.authorization_endpoint);target.search=new URLSearchParams({client_id:p.clientId,redirect_uri:callback,response_type:'code',scope:'openid profile email',state,nonce,code_challenge:challenge,code_challenge_method:'S256'});
  return new Response(null,{status:302,headers:{Location:target.href,'Set-Cookie':sessionCookie('fp_oauth',state,600,env),'Cache-Control':'no-store'}});
 }
 if(parts.length!==3||parts[2]!=='callback')throw new HttpError('Not found.',404);
 const state=url.searchParams.get('state'),code=url.searchParams.get('code');if(!state||!code||cookie(request,'fp_oauth')!==state)throw new HttpError('Sign-in state did not match. Please try again.',403);
 const flow=await env.DB.prepare('DELETE FROM oauth_states WHERE id=? AND provider=? AND expires>? RETURNING *').bind(await hash(state),p.id,now()).first();if(!flow)throw new HttpError('Sign-in expired. Please try again.',403);
 const tokenResponse=await fetch(config.token_endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:p.clientId,client_secret:p.secret,code,code_verifier:flow.verifier,redirect_uri:callback,grant_type:'authorization_code'}),signal:AbortSignal.timeout(15000)});
 if(!tokenResponse.ok)throw new HttpError('Sign-in could not be completed.',401);const tokens=await tokenResponse.json();
 if(!keys.has(config.jwks_uri))keys.set(config.jwks_uri,createRemoteJWKSet(new URL(config.jwks_uri)));
 let payload;try{({payload}=await jwtVerify(tokens.id_token,keys.get(config.jwks_uri),{issuer:config.issuer,audience:p.clientId,algorithms:['RS256'],requiredClaims:['exp','iat','sub','nonce']}));}catch{throw new HttpError('Google sign-in could not be verified. Please try again.',401);}
 if(payload.nonce!==flow.nonce)throw new HttpError('Sign-in nonce did not match.',401);
 const id=await hash(p.id+':'+payload.iss+':'+payload.sub),name=String(payload.name||'FutureProof member').slice(0,150);
 await env.DB.prepare('INSERT INTO users(id,provider,subject,name,created) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name').bind(id,p.id,payload.sub,name,now()).run();
 const session=random();await env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires) VALUES(?,?,?)').bind(await hash(session),id,now()+30*86400).run();
 const headers=new Headers({Location:env.APP_URL,'Cache-Control':'no-store'});headers.append('Set-Cookie',sessionCookie('fp_session',session,30*86400,env));headers.append('Set-Cookie',sessionCookie('fp_oauth','',0,env));return new Response(null,{status:302,headers});
}
