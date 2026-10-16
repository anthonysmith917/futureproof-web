import {normalizeDesign,validDesign} from './templates.js';
export const FREE_TEMPLATE='nr-classic';
export const hasPaidTemplates=account=>account?.templatesUnlocked===true;
export const canUseTemplate=(account,template)=>hasPaidTemplates(account)||template===FREE_TEMPLATE;
export function canUseResumeDesign(account,template,design){if(!validDesign(design))return false;if(hasPaidTemplates(account))return true;const d=normalizeDesign(design);return template===FREE_TEMPLATE&&['template','single'].includes(d.layout)&&!d.accent&&!d.sidebar&&(!d.preset||d.preset==='classic')&&!Object.keys(d.sectionColumns||{}).length;}
