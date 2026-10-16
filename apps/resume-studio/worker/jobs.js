import {descriptionText,jobURL,validJobs} from '../src/jobs.js';
import {HttpError,body,json,now,limit,requireEnv} from './util.js';
export async function searchJobs(request,env){
 requireEnv(env,'DB');const q=new URL(request.url).searchParams;
 for(const [key,max] of [['q',120],['location',100],['category',150],['type',80]])if((q.get(key)||'').length>max)throw new HttpError('Search filters are too long.');
 const page=Number(q.get('page')||1);if(!Number.isInteger(page)||page<1||page>1000)throw new HttpError('Invalid search page.');
 const t=now();let row=await env.DB.prepare("SELECT * FROM job_feed WHERE name='remotive'").first();
 if(!row||row.fetched<t-21600){
  const lock=await env.DB.prepare("INSERT INTO job_feed(name,lease) VALUES('remotive',?) ON CONFLICT(name) DO UPDATE SET lease=excluded.lease WHERE job_feed.lease<? AND job_feed.fetched<? RETURNING name").bind(t+21600,t,t-21600).first();
  if(lock){try{
   const res=await fetch('https://remotive.com/api/remote-jobs',{signal:AbortSignal.timeout(15000),headers:{Accept:'application/json'}});if(!res.ok)throw Error();const raw=await res.json();if(!Array.isArray(raw.jobs))throw Error();
   const jobs=raw.jobs.slice(0,10000).map(j=>({id:'remotive:'+j.id,title:descriptionText(j.title).slice(0,200),company:descriptionText(j.company_name).slice(0,200),location:descriptionText(j.candidate_required_location||'Remote').slice(0,300),url:jobURL(j.url),description:descriptionText(j.description),source:'Remotive',category:descriptionText(j.category).slice(0,150),type:String(j.job_type||'').slice(0,80),salary:descriptionText(j.salary).slice(0,300),published:String(j.publication_date||'').slice(0,60)})).filter(j=>j.title&&j.url&&new URL(j.url).hostname==='remotive.com');
   await env.DB.prepare("UPDATE job_feed SET data=?,fetched=?,lease=0 WHERE name='remotive'").bind(JSON.stringify(jobs),t).run();row={data:JSON.stringify(jobs),fetched:t};
  }catch{if(!row?.fetched)throw new HttpError('Job listings are temporarily unavailable. You can still save a job link manually.',502);}}
 }
 if(!row?.fetched)throw new HttpError('The job feed is temporarily unavailable. Save a job link manually or try again later.',503);
 if(row.fetched<t-7*86400)throw new HttpError('The job feed is unavailable. Save a job link manually or try again later.',502);
 const all=JSON.parse(row.data),terms=(q.get('q')||'').toLowerCase().split(/\s+/).filter(Boolean),location=(q.get('location')||'').toLowerCase();
 const jobs=all.filter(j=>terms.every(word=>(j.title+' '+j.company+' '+j.description).toLowerCase().includes(word))&&(!location||j.location.toLowerCase().includes(location))&&(!q.get('category')||j.category===q.get('category'))&&(!q.get('type')||j.type===q.get('type'))).sort((a,b)=>b.published.localeCompare(a.published));
 return json({jobs:jobs.slice((page-1)*20,page*20),total:jobs.length,page,pages:Math.max(1,Math.ceil(jobs.length/20)),categories:[...new Set(all.map(j=>j.category))].filter(Boolean).sort(),fetched:row.fetched,stale:row.fetched<t-21600,source:'Remotive',coverage:'Remote roles only. Listings are delayed by 24 hours; check location eligibility and current availability on Remotive.'});
}
export async function storedJobs(request,env,u){
 if(request.method==='GET'){const row=await env.DB.prepare('SELECT data,revision FROM saved_jobs WHERE user_id=?').bind(u.id).first();return json({jobs:row?JSON.parse(row.data):[],revision:row?.revision||0});}
 if(request.method==='PUT'){await limit(env,'jobs-save:'+u.id,20,60);const {jobs,revision}=await body(request,1800000);if(!validJobs(jobs)||!Number.isSafeInteger(revision)||revision<0)throw new HttpError('Invalid saved jobs.');const row=await env.DB.prepare('INSERT INTO saved_jobs(user_id,data,revision,updated) SELECT ?,?,1,? WHERE ?=0 OR EXISTS(SELECT 1 FROM saved_jobs WHERE user_id=?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,revision=saved_jobs.revision+1,updated=excluded.updated WHERE saved_jobs.revision=? RETURNING revision').bind(u.id,JSON.stringify(jobs),now(),revision,u.id,revision).first();if(!row)throw new HttpError('Saved jobs changed in another tab. Load and merge cloud jobs before saving again.',409);return json({revision:row.revision});}
 throw new HttpError('Method not allowed.',405);
}
