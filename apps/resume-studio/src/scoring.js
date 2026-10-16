import {plainText,fields} from './model.js';
import {contrast} from './templates.js';
export function scoreFormatting(resume,template,source=null){
 const hasContent=fields.some(k=>resume[k]?.trim());
 if(!hasContent)return {score:0,checks:[],coverage:'Add content to run the checks.',source:source?.name||null};
 const rules=[
  ['Simple reading order',25,!template.layout||template.layout==='single',template.layout&&template.layout!=='single'?'Split columns and Word tables can change parser reading order. Use Single column for a simpler application copy.':'The selected layout uses a single text flow. Imported source layout is not included in this score.'],
  ['Text-based content',20,!!(resume.experience.trim()||resume.education.trim()||resume.projects.trim()),'Use editable text for your experience, education, and projects.'],
  ['Recognizable section headings',20,!!(resume.experience.trim()||resume.education.trim()),'Include Professional Experience or Education. Standard headings are generated for you.'],
  ['Readable type and spacing',15,template.size>=10&&template.spacing>=1.4&&contrast(template.color,'#ffffff')>=3,'Use at least 10-point body text, open line spacing, and an accent with sufficient contrast against white.'],
  ['Contact information in body',10,!!resume.name.trim()&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resume.email.trim()),'Add your name and a valid email address; both export as normal body text.'],
  ['Visible employment or education years',10,/\b(?:19|20)\d{2}\b/.test(resume.experience+' '+resume.education),'Include clear years and date ranges where applicable.']
 ];
 // Structural checks only contribute after substantive content exists.
 const substantive=!!(resume.experience.trim()||resume.education.trim()||resume.projects.trim());
 const checks=rules.map(([name,points,pass,help],i)=>({name,points,pass:substantive?pass:(i===4&&pass),help}));
 return {score:checks.reduce((n,c)=>n+(c.pass?c.points:0),0),checks,coverage:'Checks the generated resume template and entered content. It does not test an employer’s ATS or predict hiring outcomes.',source:source?.name||null};
}
const stop=new Set('a about above across after all also an and any are as at be been being both but by can candidate candidates company could day demonstrate duties each employer employment ensure equal excellent experience experiences for from full have having help high highly how if in including is it job knowledge looking management may more most must new of on one opportunity or organization our other out over position preferred qualified qualifications required requirements responsibilities role skills so some strong such support team teams than that the their them then there these they this those through time to under up us use using was we well were what when where which who will with work working would year years you your'.split(' '));
export function jobMatch(resume,job,template){
 if(!job.trim())return null;
 const counts=new Map();for(const word of job.toLowerCase().match(/[a-z][a-z0-9+#.-]{1,}/g)||[]){const w=word.replace(/[.-]+$/,'');if(!stop.has(w)&&w.length>=2)counts.set(w,(counts.get(w)||0)+1);}
 const phrases=['power bi','sql server','machine learning','project management','customer service','data analysis','registered nurse','process improvement','business intelligence','problem solving'];
 const terms=[...phrases.filter(x=>job.toLowerCase().includes(x)),...[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,25).map(x=>x[0])].slice(0,30);
 const words=plainText(resume,template).toLowerCase();const boundary=t=>new RegExp('(^|[^a-z0-9])'+t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?=$|[^a-z0-9])','i').test(words);
 const matched=terms.filter(boundary),missing=terms.filter(x=>!boundary(x));return {score:terms.length?Math.round(matched.length/terms.length*100):null,terms,matched,missing};
}
export function contentSuggestions(r){const out=[];if(!r.summary.trim())out.push('Add a short summary tailored to the kind of work you want.');if(r.experience.trim()&&!/\d+\s*(?:%|hours?|teams?|projects?|people|clients?|per|departments?)/i.test(r.experience))out.push('Describe scope or results where you can substantiate them. Never invent numbers.');if(/responsible for|duties included/i.test(r.experience))out.push('Replace duty phrases with an action and the result you actually achieved.');if(!r.skills.trim())out.push('Add the skills you can demonstrate.');if(plainText(r,{order:['summary','experience','education','skills','certifications','projects']}).split(/\s+/).length>1000)out.push('Review length and remove repetition; check the exported pages.');return out;}
