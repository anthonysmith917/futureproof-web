import {hasWorkHistoryBullets,workHistoryMarkup,workHistoryStyles} from './work-history.js';
import {nurseTemplateCatalogue,nurseResumeHtml,nurseEscape} from './vendor/nurseready/original-templates.js';
export {nurseTemplateCatalogue};
const sectionOrder=['summary','certifications','experience','education','skills','projects'];
export const nurseTemplates=nurseTemplateCatalogue.map((source,index)=>({id:'nr-'+source.id,originalId:source.id,originalLayout:source.layout,originalColor:source.color,name:source.name,category:'NurseReady originals',focus:'All careers',font:source.id==='academic'?'Georgia':'Arial',color:source.color,sidebarColor:source.color,layout:source.layout==='right'?'sidebar-right':source.layout==='split'?'sidebar-left':'single',variant:'nurse-'+source.id,decoration:'rule',align:['classic','academic','graduate'].includes(source.id)?'center':'left',family:'nr-'+index,heading:'standard',size:source.id==='compact'?9:10,spacing:source.id==='compact'?1.4:source.id==='minimal'?1.8:1.6,pad:54,order:source.layout==='single'?[...sectionOrder]:['certifications','skills','education','summary','experience','projects']}));
export const nurseLayoutChoices=nurseTemplateCatalogue.map(source=>({...source,description:source.detail,template:'nr-'+source.id,layout:source.layout==='right'?'sidebar-right':source.layout==='split'?'sidebar-left':'single'}));
export function nurseProfile(resume,t){return {name:resume.name,headline:resume.headline,email:resume.email,phone:[resume.phone,resume.website].filter(Boolean).join(' | '),location:resume.location,summary:resume.summary,experience:resume.experience,education:resume.education,skills:resume.skills,additionalCredentials:resume.certifications,credentialIds:[],template:t.originalId,photo:resume.photo||'',includePhoto:!!resume.photo,accentColor:t.color||''};}
const originalSectionNames={summary:'Professional Summary',certifications:'Licenses and Certifications',experience:'Professional Experience',education:'Education',skills:'Clinical Skills',projects:'Selected Projects'};
export function originalResumeDocument(resume,t,toolbar=false){
 let html=nurseResumeHtml(nurseProfile(resume,t),[],toolbar);
 // Preserve the source output exactly by default. User-requested customizations are applied separately.
 const source=nurseTemplates.find(x=>x.originalId===t.originalId),columns=t.layout!=='single',customPositions=Object.keys(t.sectionColumns||{}).length>0,changedLayout=t.layout!==source.layout;
 let extraStyle='';
 if(customPositions||changedLayout||resume.projects?.trim()){
  const blocks={};for(const match of html.matchAll(/<section class="[^"]*"><h2>([^<]+)<\/h2>[\s\S]*?<\/section>/g)){const key=Object.keys(originalSectionNames).find(key=>originalSectionNames[key]===match[1]);if(key)blocks[key]=match[0];}
  if(resume.projects?.trim())blocks.projects=`<section class=""><h2>Selected Projects</h2>${resume.projects.split('\n').filter(line=>line.trim()).map(line=>`<p>${nurseEscape(line)}</p>`).join('')}</section>`;
  const physicalSide=t.layout==='sidebar-right'?'right':'left';
  const sideDefault=['certifications','skills','education'];
  const column=key=>t.sectionColumns?.[key]||(sideDefault.includes(key)?physicalSide:(physicalSide==='left'?'right':'left'));
  const order=['certifications','skills','education','summary','experience','projects'];
  const body=columns?`<div class="resume-columns"><aside>${order.filter(key=>column(key)===physicalSide).map(key=>blocks[key]||'').join('')}</aside><main>${order.filter(key=>column(key)!==physicalSide).map(key=>blocks[key]||'').join('')}</main></div>`:sectionOrder.map(key=>blocks[key]||'').join('');
  html=html.replace(/(<article class="[^"]*">[\s\S]*?<\/header>)[\s\S]*?<\/article>/,(_,header)=>header+body+'</article>');
  if(changedLayout){const left=t.layout==='sidebar-right'?'minmax(0,1fr) 220px':t.layout==='split'?'44% minmax(0,1fr)':'220px minmax(0,1fr)';extraStyle+=`.page .resume-columns{display:grid;grid-template-columns:${left}}.page .resume-columns>aside{grid-column:${t.layout==='sidebar-right'?2:1};grid-row:1}.page .resume-columns>main{grid-column:${t.layout==='sidebar-right'?1:2};grid-row:1}`;if(!columns)extraStyle+='.page>section{margin:25px 30px}.page{display:block}';}
 }
 if(t.customSidebar&&columns){const hex=t.customSidebar,channels=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4),lum=.2126*channels[0]+.7152*channels[1]+.0722*channels[2],ink=lum>.179?'#17231f':'#ffffff';extraStyle+=`.page .resume-columns>aside{background:${hex};color:${ink}}.page .resume-columns>aside h2{color:${ink}}`;}
 if(hasWorkHistoryBullets(resume.experience)){
  html=html.replace(/(<section class="[^"]*"><h2>Professional Experience<\/h2>)[\s\S]*?<\/section>/,(_,heading)=>heading+workHistoryMarkup(resume.experience,nurseEscape)+'</section>');
  extraStyle+=workHistoryStyles;
 }
 if(extraStyle)html=html.replace('</style>',extraStyle+'</style>');
 return html;
}
export const originalPreviewMarkup=(resume,t)=>`<div class="nurse-original-viewport" data-page-height="1180"><iframe class="nurse-original-frame" title="${nurseEscape(t.name)} resume preview" sandbox="allow-same-origin" srcdoc="${nurseEscape(originalResumeDocument(resume,t))}" width="816" height="1180"></iframe></div>`;
export const nurseSectionNames=originalSectionNames;
