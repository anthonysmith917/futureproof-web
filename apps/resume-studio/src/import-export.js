import {workHistoryItems} from './work-history.js';
import {nurseSectionNames} from './nurse-templates.js';
import {Document,Packer,Paragraph,TextRun,AlignmentType,BorderStyle,Table,TableRow,TableCell,WidthType,TableLayoutType,ShadingType,ImageRun} from 'docx';
import {sectionNames,resolveTemplate,sidebarKeys} from './templates.js';
export async function readResume(file){
 if(file.size>10*1024*1024)throw new Error('Choose a file under 10 MB.');
 const ext=file.name.split('.').pop().toLowerCase();let text='',warnings=[],pages=null;
 if(ext==='txt'){text=await file.text();}
 else if(ext==='docx'){
  const mammoth=await import('mammoth/mammoth.browser');const result=await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});text=result.value;warnings=result.messages.map(m=>m.message);
 }else if(ext==='pdf'){
  const pdfjs=await import('pdfjs-dist');const worker=await import('pdfjs-dist/build/pdf.worker.min.mjs?url');pdfjs.GlobalWorkerOptions.workerSrc=worker.default;
  const doc=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false}).promise;
  try{pages=doc.numPages;if(pages>15)throw new Error('Choose a resume with 15 pages or fewer.');for(let p=1;p<=pages;p++){const page=await doc.getPage(p);const content=await page.getTextContent();text+=content.items.map(i=>i.str+(i.hasEOL?'\n':' ')).join('')+'\n';}}finally{await doc.destroy();}
  warnings.push('PDF text order may differ from the visual layout. Review the extracted text.');
 }else throw new Error('Choose a PDF, DOCX, or TXT resume.');
 if(text.trim().length<30)throw new Error('Not enough text could be extracted. Image-only PDFs need OCR; paste the resume text instead.');
 if(text.length>72000)throw new Error('This file has too much text. Choose a shorter resume.');
 return {text,warnings,pages,name:file.name,type:ext};
}
export function downloadBlob(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);}
export async function createDocxBlob(r,template,design){
 const t=resolveTemplate(template,design),color=t.color.slice(1),font=t.font,split=t.layout!=='single';
 const run=(text,size,bold=false,ink)=>new TextRun({text,font,size,bold,color:ink|| (bold?color:'222222')});
 const contact=[r.email,r.phone,r.location,r.website].filter(Boolean);
 const topBorder=['contemporary','photo-editorial','executive'].includes(t.variant)?{top:{style:t.variant==='executive'?BorderStyle.DOUBLE:BorderStyle.SINGLE,color,size:t.variant==='executive'?8:16,space:14}}:undefined;
 const header=[new Paragraph({border:topBorder,children:[run(r.name||'Your name',56,true)],alignment:t.align==='center'?AlignmentType.CENTER:AlignmentType.LEFT,spacing:{after:140}})];
 if(r.headline)header.push(new Paragraph({children:[run(r.headline,24)],spacing:{after:100}}));
 const children=[];
 if(!split||t.originalId){
  if((t.variant==='photo-editorial'||t.originalId)&&r.photo&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(r.photo)){
   const noBorder={style:BorderStyle.NONE,size:0,color:'FFFFFF'},borders={top:noBorder,bottom:noBorder,left:noBorder,right:noBorder};
   children.push(new Table({width:{size:10512,type:WidthType.DXA},columnWidths:[8900,1612],borders:{...borders,insideHorizontal:noBorder,insideVertical:noBorder},rows:[new TableRow({children:[new TableCell({width:{size:8900,type:WidthType.DXA},borders,children:header}),new TableCell({width:{size:1612,type:WidthType.DXA},borders,children:[new Paragraph({children:[new ImageRun({type:'jpg',data:Uint8Array.from(atob(r.photo.split(',')[1]),c=>c.charCodeAt(0)),transformation:{width:76,height:94}})]})]})]})]}));
  }else children.push(...header);
 }
 const section=(key,ink)=>{
  if(!r[key].trim())return [];
  const heading={children:[run((t.originalId?nurseSectionNames:sectionNames)[key],22,true,ink)],keepNext:true,spacing:{before:200,after:100}};
  if(t.decoration==='rule')heading.border={bottom:{color:ink||color,size:4,style:BorderStyle.SINGLE}};
  const items=key==='experience'?workHistoryItems(r[key]):r[key].split('\n').map(text=>({type:'text',text}));
  return [new Paragraph(heading),...items.map(item=>new Paragraph({children:[run(item.text,t.size*2,item.type==='role',ink)],...(item.type==='bullet'?{bullet:{level:0}}:{}),keepNext:['role','dates'].includes(item.type),spacing:{before:item.type==='role'?160:0,after:item.type==='space'?120:80,line:Math.round(t.spacing*240)}}))];
 };
 if(t.originalId&&split&&contact.length)children.push(new Paragraph({children:[run(contact.join(' | '),18)],spacing:{after:240}}));
 if(!split){children.push(new Paragraph({children:[run(contact.join(' | '),18)],spacing:{after:240}}));children.push(...t.order.flatMap(k=>section(k)));}
 else{
  const white=t.sidebarText.slice(1),side=t.order.filter(k=>sidebarKeys(t).includes(k)),main=t.order.filter(k=>!sidebarKeys(t).includes(k));
  const sideContent=[...(contact.length&&!t.originalId?[new Paragraph({children:[run('Contact',22,true,white)],keepNext:true,spacing:{before:120,after:100}}),...contact.map(text=>new Paragraph({children:[run(text,18,false,white)],spacing:{after:100}}))]:[]),...side.flatMap(k=>section(k,white))];
  const mainContent=[...(t.originalId?[]:header),...main.flatMap(k=>section(k))];
  const width=10512,sideWidth=Math.round(width*(t.layout==='split'?.44:.32)),mainWidth=width-sideWidth;
  const none={style:BorderStyle.NONE,size:0,color:'FFFFFF'};
  const cell=(content,w,sidebar)=>new TableCell({width:{size:w,type:WidthType.DXA},children:content.length?content:[new Paragraph('')],margins:{top:180,bottom:200,left:240,right:240},shading:sidebar?{fill:t.sidebarColor.slice(1),type:ShadingType.CLEAR,color:'auto'}:undefined,borders:{top:none,bottom:none,left:none,right:none}});
  const sideCell=cell(sideContent,sideWidth,true),mainCell=cell(mainContent,mainWidth,false);
  children.push(new Table({width:{size:width,type:WidthType.DXA},layout:TableLayoutType.FIXED,columnWidths:t.layout==='sidebar-right'?[mainWidth,sideWidth]:[sideWidth,mainWidth],borders:{top:none,bottom:none,left:none,right:none,insideHorizontal:none,insideVertical:none},rows:[new TableRow({cantSplit:false,children:t.layout==='sidebar-right'?[mainCell,sideCell]:[sideCell,mainCell]})]}));
 }
 const doc=new Document({creator:'FutureProof Resume Studio',styles:{default:{document:{run:{font,size:t.size*2}}}},sections:[{properties:{page:{size:{width:12240,height:15840},margin:{top:864,right:864,bottom:864,left:864}}},children}]});
 return Packer.toBlob(doc);
}
export async function exportDocx(r,t,design){downloadBlob(await createDocxBlob(r,t,design),`${(r.name||'Resume').replace(/[^\p{L}\p{N} -]/gu,'')}-${t.id}.docx`);}
export async function prepareProfilePhoto(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)throw new Error('Choose a JPG, PNG, or WebP image under 5 MB.');
 const bitmap=await createImageBitmap(file);try{if(bitmap.width*bitmap.height>20000000)throw new Error('Use an image smaller than 20 megapixels.');const canvas=document.createElement('canvas');canvas.width=320;canvas.height=400;const context=canvas.getContext('2d');if(!context)throw new Error('Photo processing is unavailable.');const ratio=Math.max(320/bitmap.width,400/bitmap.height),w=320/ratio,h=400/ratio;context.fillStyle='#fff';context.fillRect(0,0,320,400);context.drawImage(bitmap,(bitmap.width-w)/2,(bitmap.height-h)/2,w,h,0,0,320,400);return canvas.toDataURL('image/jpeg',.82);}finally{bitmap.close();}
}
