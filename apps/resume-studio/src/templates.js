import {nurseTemplates,nurseLayoutChoices} from './nurse-templates.js';
// 20 editorial families × 5 structural editions = 100 distinct template configurations.
// Families include single-column, left/right sidebar, and balanced split layouts.
const families = [
 ['Foundation','Classic','Georgia','#24364a','rule', 'left'],
 ['Meridian','Modern','Arial','#176b60','caps','left'],
 ['Summit','Executive','Georgia','#343a40','double','center'],
 ['Signal','Technical','Arial','#243b70','bar','left'],
 ['Canvas','Creative','Trebuchet MS','#783f54','marker','left'],
 ['Clarity','Minimal','Arial','#343a40','none','left'],
 ['Ledger','Classic','Times New Roman','#363636','rule','center'],
 ['Horizon','Modern','Verdana','#255b77','caps','left'],
 ['Pinnacle','Executive','Georgia','#5b4932','double','left'],
 ['Circuit','Technical','Courier New','#274e4b','rule','left'],
 ['Atelier','Creative','Georgia','#7e4434','marker','center'],
 ['Essential','Minimal','Helvetica','#222222','none','left'],
 ['Heritage','Classic','Cambria','#3a465b','double','left'],
 ['Momentum','Modern','Arial','#334f87','bar','center'],
 ['Steward','Executive','Cambria','#4f463d','caps','left'],
 ['Vector','Technical','Verdana','#3e4969','marker','left'],
 ['Contour','Creative','Trebuchet MS','#635584','rule','left'],
 ['Focus','Minimal','Arial','#24443f','caps','center'],
 ['Keystone','Classic','Palatino Linotype','#4b3c43','bar','left'],
 ['Waypoint','Modern','Tahoma','#386153','double','center']
];
const editions=[
 {name:'Professional',focus:'Experienced',order:['summary','experience','skills','education','certifications','projects'],size:10.5,spacing:1.45,heading:'standard',pad:54},
 {name:'Graduate',focus:'Early career',order:['summary','education','projects','experience','skills','certifications'],size:11,spacing:1.5,heading:'wide',pad:58},
 {name:'Specialist',focus:'Specialist',order:['summary','skills','certifications','experience','projects','education'],size:10.5,spacing:1.5,heading:'compact',pad:52},
 {name:'Leadership',focus:'Leadership',order:['summary','experience','projects','certifications','education','skills'],size:11,spacing:1.45,heading:'large',pad:60},
 {name:'Transition',focus:'Career change',order:['summary','skills','projects','experience','education','certifications'],size:11,spacing:1.55,heading:'small',pad:56}
];
const familyLayouts=['single','sidebar-left','single','sidebar-left','sidebar-right','single','single','sidebar-right','sidebar-left','split','sidebar-right','single','sidebar-left','sidebar-right','single','split','sidebar-left','single','sidebar-left','sidebar-right'];
const familyVariants=['traditional','contemporary','executive','split-column','photo-editorial','minimal','traditional','clinical','split-column','split-column','photo-editorial','minimal','executive','contemporary','executive','clinical','photo-editorial','academic','split-column','contemporary'];
export const templates=families.flatMap((f,i)=>editions.map((e,j)=>({...e,id:`fp-${String(i*5+j+1).padStart(3,'0')}`,name:`${f[0]} ${e.name}`,category:f[1],font:f[2],color:f[3],sidebarColor:f[3],layout:familyLayouts[i],variant:familyVariants[i],decoration:f[4],align:f[5],family:i})));
export const getTemplate=id=>[...nurseTemplates,...templates].find(t=>t.id===id)||templates[0];
export const categories=['All styles',...new Set(templates.map(t=>t.category))];
export const sectionNames={summary:'Professional Summary',experience:'Professional Experience',education:'Education',skills:'Skills',certifications:'Certifications',projects:'Selected Projects'};
export const templateCSS=t=>`font-family:"${t.font}",serif;font-size:${t.size}pt;line-height:${t.spacing};--ink:${t.color};--pad:${t.pad}px`;
export const layouts=[['template','Use template layout'],['single','Single column'],['sidebar-left','Left sidebar'],['sidebar-right','Right sidebar'],['split','Balanced split']];
export const palettes=[['Navy','#24364a','#24364a'],['Forest','#235647','#235647'],['Teal','#116b70','#154e55'],['Burgundy','#783946','#542b36'],['Plum','#665080','#48395b'],['Charcoal','#353b43','#353b43'],['Rust','#974d32','#663e30'],['Slate & mist','#38516a','#e3e9ef']];
export const defaultDesign=()=>({layout:'template',accent:'',sidebar:''});
const legacyLayoutChoices=[
 {id:'traditional',name:'Traditional',description:'Timeless serif · centered heading',template:'fp-001',layout:'single',font:'Georgia',align:'center',color:'#353b43',decoration:'rule'},
 {id:'contemporary',name:'Contemporary',description:'Clean typography · bold top rule',template:'fp-006',layout:'single',font:'Arial',align:'left',color:'#1b6b6b',decoration:'rule'},
 {id:'split-column',name:'Split column',description:'Full-height color · essentials sidebar',template:'fp-016',layout:'sidebar-left',font:'Arial',align:'left',color:'#243b53',decoration:'rule'},
 {id:'photo-editorial',name:'Photo editorial',description:'Warm editorial · optional portrait',template:'fp-021',layout:'single',font:'Georgia',align:'left',color:'#815a47',decoration:'rule'},
 {id:'executive',name:'Executive',description:'Serif masthead · formal double rules',template:'fp-011',layout:'single',font:'Georgia',align:'left',color:'#344e6b',decoration:'none'},
 {id:'minimal',name:'Minimal',description:'Airy sans serif · quiet section labels',template:'fp-026',layout:'single',font:'Arial',align:'left',color:'#49646a',decoration:'none'},
 {id:'clinical',name:'Clinical',description:'Structured labels · crisp left border',template:'fp-036',layout:'single',font:'Arial',align:'left',color:'#167088',decoration:'rule'},
 {id:'academic',name:'Academic',description:'Traditional CV · education first',template:'fp-087',layout:'single',font:'Georgia',align:'left',color:'#675274',decoration:'rule'}
];
export const layoutChoices=nurseLayoutChoices;
export function validDesign(value){return value===undefined||!!(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>['layout','accent','sidebar','preset','sectionColumns'].includes(k))&&(value.layout===undefined||layouts.some(([id])=>id===value.layout))&&(value.preset===undefined||value.preset===''||[...layoutChoices,...legacyLayoutChoices].some(x=>x.id===value.preset))&&(value.sectionColumns===undefined||!!(value.sectionColumns&&typeof value.sectionColumns==='object'&&!Array.isArray(value.sectionColumns)&&Object.entries(value.sectionColumns).every(([key,column])=>Object.hasOwn(sectionNames,key)&&['left','right'].includes(column))))&&['accent','sidebar'].every(k=>value[k]===undefined||value[k]===''||/^#[a-f0-9]{6}$/i.test(value[k])));}
export function normalizeDesign(value){return validDesign(value)?{...defaultDesign(),...value,...(value?.sectionColumns?{sectionColumns:{...value.sectionColumns}}:{})}:defaultDesign();}
export function luminance(hex){const rgb=hex.slice(1).match(/.{2}/g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
export const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
export function resolveTemplate(template,design){const d=normalizeDesign(design),preset=template.originalId?null:legacyLayoutChoices.find(x=>x.id===d.preset),t={...template,...(preset?{font:preset.font,align:preset.align,decoration:preset.decoration,variant:preset.id}:{}),layout:d.layout==='template'?(preset?.layout||template.layout||'single'):d.layout,color:d.accent||preset?.color||template.color,sidebarColor:d.sidebar||preset?.color||template.sidebarColor||template.color};t.customSidebar=d.sidebar||template.customSidebar||'';t.sectionColumns={...(d.sectionColumns||template.sectionColumns||{})};if(t.variant==='academic')t.order=['summary','education','certifications','experience','projects','skills'];t.sidebarText=contrast(t.sidebarColor,'#ffffff')>=contrast(t.sidebarColor,'#000000')?'#ffffff':'#000000';return t;}
export const sectionColumn=(t,key)=>t.sectionColumns?.[key]||((t.layout==='split'&&!t.originalId?['summary','skills','certifications']:['skills','education','certifications']).includes(key)?(t.layout==='sidebar-right'?'right':'left'):(t.layout==='sidebar-right'?'left':'right'));
export const sidebarKeys=t=>t.order.filter(key=>sectionColumn(t,key)===(t.layout==='sidebar-right'?'right':'left'));
export const mainKeys=t=>t.order.filter(k=>!sidebarKeys(t).includes(k));
export function selectTemplate(id,design){const d={...normalizeDesign(design),layout:'template'};delete d.preset;return {template:getTemplate(id).id,design:d};}
export function selectLayoutPreset(id,design){const aliases={'traditional':'classic','contemporary':'modern','split-column':'split','photo-editorial':'portrait'},choice=layoutChoices.find(x=>x.id===(aliases[id]||id))||layoutChoices[2];return {template:choice.template,design:{...normalizeDesign(design),layout:'template',preset:choice.id}};}
export function galleryTemplates({style='All styles',focus='All paths',format='Split layouts',search=''}={}){
 const filtered=templates.filter(t=>(style==='All styles'||t.category===style)&&(focus==='All paths'||t.focus===focus)&&(format==='All layouts'||(format==='Split layouts'?t.layout!=='single':t.layout===format))&&t.name.toLowerCase().includes(search.toLowerCase()));
 // Show one edition from each family before the next edition, rather than five near-identical cards in a row.
 return filtered.sort((a,b)=>(Number(a.id.slice(3))-1)%5-(Number(b.id.slice(3))-1)%5||a.family-b.family);
}
