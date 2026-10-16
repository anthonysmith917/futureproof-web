import {accountSettingsView} from './views.mjs';
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const escape=(value='')=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const params=new URLSearchParams(location.search);
const templates={
  business:{brief:'I’m starting a local business. I need a welcoming website that explains my services, tells my story, and makes it easy for customers to get in touch.',color:'#df734b',label:'Local business'},
  school:{brief:'I want a school or team website with our story, upcoming events, team information, and a coordinated direction for spirit shirts and signage.',color:'#7558bc',label:'School & team'},
  creator:{brief:'I want a creative portfolio that introduces my work, shares my story, and gives people a clear way to work with me.',color:'#457567',label:'Creator & portfolio'},
  event:{brief:'I’m planning an event. I need a website with the experience, dates, important details, and a clear contact or booking direction.',color:'#b36a35',label:'Event & booking'}
};
const itemLabels={website:'Website',logo:'Logo & branding',cards:'Business cards',flyers:'Promotional flyers','yard-signs':'Yard signs',banner:'Banner',apparel:'Branded apparel'};
const packageLabels={essentials:'The Essentials',presence:'The Presence',complete:'The Full Picture',custom:'Your custom package'};
let session=null;
let category='business';
let toastTimer;
function toast(message) {const el=$('#toast');if(!el)return;el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),6500);}
function date(value){return new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));}
function money(record){return new Intl.NumberFormat(undefined,{style:'currency',currency:record.currency}).format(record.amountMinor/100);}
function safeNext(value,fallback='/portal') {try {const url=new URL(value,location.origin);if(url.origin===location.origin&&!url.pathname.startsWith('/api/')&&['/','/studio','/packages','/plans','/portal','/workspace','/connect/resume/checkout'].includes(url.pathname))return url.pathname+url.search+url.hash;}catch{}return fallback;}
function savePending(key,value){try{sessionStorage.setItem(key,JSON.stringify(value));}catch{toast('Your browser could not retain this draft. You can sign in and enter it again.');}}
function loadPending(key){try{return JSON.parse(sessionStorage.getItem(key)||'null');}catch{return null;}}
function removePending(key){try{sessionStorage.removeItem(key);}catch{}}
function signIn(next=location.pathname+location.search+location.hash){location.href='/signin?next='+encodeURIComponent(safeNext(next));}
async function api(path,{method='GET',body}={}) {
  const response=await fetch('/api'+path,{method,credentials:'same-origin',headers:{...(method!=='GET'?{'Content-Type':'application/json','X-CSRF-Token':session?.csrf||''}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json();
  if(!response.ok){const error=new Error(data.error||'This action could not be completed.');error.status=response.status;throw error;}
  if(data.csrf)session={...session,csrf:data.csrf};
  return data;
}
async function busy(form,action) {
  const button=$('button[type=submit]',form),error=$('.form-error',form);
  if(error)error.textContent='';
  if(button)button.disabled=true;
  try{return await action();}catch(e){if(error)error.textContent=e.message;else toast(e.message);}
  finally{if(button)button.disabled=false;}
}
function download(name,content,type='application/json') {const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function empty(title,text,link='',label='') {return `<div class="empty-state"><span class="empty-icon" aria-hidden="true">✳</span><h3>${title}</h3><p>${text}</p>${link?`<a class="button dark" href="${link}">${label} ↗</a>`:''}</div>`;}

$('.menu-toggle')?.addEventListener('click',event=>{const button=event.currentTarget;const expanded=button.getAttribute('aria-expanded')==='true';button.setAttribute('aria-expanded',String(!expanded));button.setAttribute('aria-label',expanded?'Open navigation':'Close navigation');$('#main-nav').classList.toggle('open',!expanded);});
$$('[data-close-dialog]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
$$('[data-publish-info]').forEach(button=>button.addEventListener('click',()=>toast('Publishing is disabled in this local review. You can download your starter website.')));

async function init() {
  try {session=await api('/session');}
  catch {const target=$('#portal-content')||$('.auth-form-inner')||$('#studio-error');if(target){const p=document.createElement('p');p.className='form-error';p.textContent='The local account service is unavailable. Run Start-Desygn-Shop.cmd and open http://127.0.0.1:4317.';target.append(p);}return;}
  $$('[data-account-link]').forEach(a=>{if(!session.user){a.href='/signin?next=%2Fportal';a.innerHTML='Sign in <span aria-hidden="true">↗</span>';}});
  $$('[data-logout]').forEach(button=>button.addEventListener('click',async()=>{try{await api('/auth/logout',{method:'POST',body:{}});location.href='/signin';}catch(e){toast(e.message);}}));
  if($('#auth-form'))initAuth();
  if($('#studio-start'))initStudio();
  if($('#package-form'))await initPackages();
  if($('#portal-content'))await initPortal();
  if($('#project-edit'))await initWorkspace();
  $$('[data-plan]').forEach(button=>button.addEventListener('click',async()=>{if(!session.user){savePending('desygn-plan',button.dataset.plan);signIn('/plans');return;}button.disabled=true;try{const data=await api('/plan-interest',{method:'POST',body:{plan:button.dataset.plan}});toast(data.message);}catch(e){toast(e.message);}finally{button.disabled=false;}}));
  const pendingPlan=loadPending('desygn-plan');
  if(session.user&&pendingPlan&&location.pathname==='/plans'){try{await api('/plan-interest',{method:'POST',body:{plan:pendingPlan}});removePending('desygn-plan');toast('Your plan interest was saved. No subscription or charge was created.');}catch(e){toast(e.message);}}
}

function initAuth() {
  const form=$('#auth-form');
  if(params.get('deleted')){const note=document.createElement('p');note.className='fine-print';note.textContent='Your local review account and its saved records were deleted.';form.before(note);}
  let mode=params.get('mode')==='register'?'register':'login';
  function setMode(value) {
    mode=value;const register=mode==='register';
    $$('[data-auth-mode]').forEach(button=>{const active=button.dataset.authMode===mode;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
    $('#name-field').classList.toggle('hidden',!register);form.elements.name.disabled=!register;form.elements.name.required=register;
    $('#password-hint').classList.toggle('hidden',!register);form.elements.password.minLength=register?12:1;
    form.elements.password.autocomplete=register?'new-password':'current-password';
    $('#auth-title').textContent=register?'Make room for your ideas.':'Welcome back.';
    $('#auth-description').textContent=register?'Create a local workspace and start bringing it together.':'Pick up where your vision left off.';
    $('#auth-submit').innerHTML=(register?'Create my workspace':'Sign in')+' <span aria-hidden="true">↗</span>';
    $('.form-error',form).textContent='';
  }
  $$('[data-auth-mode]').forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.authMode)));
  setMode(mode);
  if(session.user) {
    const note=document.createElement('p');note.className='fine-print';note.innerHTML=`You are signed in as ${escape(session.user.name)}. <a href="${escape(safeNext(params.get('next')))}">Continue to your workspace →</a>`;form.before(note);
  }
  form.addEventListener('submit',event=>{event.preventDefault();busy(form,async()=>{const data=Object.fromEntries(new FormData(form));await api('/auth/'+mode,{method:'POST',body:data});location.href=safeNext(params.get('next'));});});
}

function initStudio() {
  const form=$('#studio-start'),dialog=$('#project-dialog'),create=$('#project-create');
  function chooseStarter(key) {if(!templates[key])return;category=key;form.elements.brief.value=templates[key].brief;form.scrollIntoView({behavior:'smooth',block:'center'});form.elements.brief.focus();}
  $$('[data-starter]').forEach(button=>button.addEventListener('click',()=>chooseStarter(button.dataset.starter)));
  function openProjectDialog(){create.elements.category.value=category;dialog.showModal();setTimeout(()=>create.elements.name.focus(),20);}
  const pending=loadPending('desygn-studio-brief');
  if(pending){form.elements.brief.value=pending.brief||'';category=Object.hasOwn(templates,pending.category)?pending.category:'business';if(session.user){openProjectDialog();}}
  form.addEventListener('submit',event=>{event.preventDefault();const brief=form.elements.brief.value.trim();if(!brief)return;savePending('desygn-studio-brief',{brief,category});if(!session.user){signIn('/studio');return;}openProjectDialog();});
  create.addEventListener('submit',event=>{event.preventDefault();busy(create,async()=>{
    const input=Object.fromEntries(new FormData(create));
    const {project}=await api('/projects',{method:'POST',body:{...input,brief:form.elements.brief.value,color:templates[input.category].color,description:'',headline:'',services:''}});
    removePending('desygn-studio-brief');location.href='/workspace?id='+project.id;
  });});
}

async function initPackages() {
  const form=$('#package-form');
  let linkedProject=null;
  function showLinkedProject(project){
    linkedProject=project;
    form.elements.projectId.value=project?.id||'';
    $('#linked-project').classList.toggle('hidden',!project);
    if(project){$('#linked-project-name').textContent=project.name;$('#linked-project-description').textContent=project.headline||project.description||'Your saved project direction will be attached to this brief.';$('#linked-color').style.backgroundColor=project.color;$('#linked-project-open').href='/workspace?id='+project.id;}
  }
  $('#unlink-project').addEventListener('click',()=>{showLinkedProject(null);toast('This package will be saved as a standalone brief.');});
  const presets={essentials:['website','logo','cards'],presence:['website','logo','cards','yard-signs','banner'],complete:Object.keys(itemLabels),custom:[]};
  function updateSummary() {
    const checked=$$('input[name=items]:checked',form);
    $('#summary-title').textContent=packageLabels[form.elements.package.value]||'Your package';
    $('#package-summary-items').innerHTML=checked.length?checked.map(box=>`<li><span>${itemLabels[box.value]}</span><strong>× ${escape(form.elements['qty-'+box.value].value)}</strong></li>`).join(''):'<li>Select the pieces you have in mind.</li>';
    $$('input[name=items]',form).forEach(box=>form.elements['qty-'+box.value].disabled=!box.checked);
  }
  function setPackage(key) {if(!presets[key])return;form.elements.package.value=key;$$('input[name=items]',form).forEach(box=>{box.checked=presets[key].includes(box.value);});updateSummary();}
  $$('[data-package-select]').forEach(a=>a.addEventListener('click',()=>setPackage(a.dataset.packageSelect)));
  form.elements.package.addEventListener('change',()=>setPackage(form.elements.package.value));
  form.addEventListener('input',updateSummary);
  setPackage('presence');
  const pending=loadPending('desygn-package');
  if(pending){form.elements.business.value=pending.business||'';form.elements.package.value=pending.package||'custom';form.elements.notes.value=pending.notes||'';$$('input[name=items]',form).forEach(box=>{box.checked=pending.items?.includes(box.value)||false;form.elements['qty-'+box.value].value=pending.quantities?.[box.value]||1;});updateSummary();}
  else if(session.user?.brand?.name)form.elements.business.value=session.user.brand.name;
  if(params.get('item')&&Object.hasOwn(itemLabels,params.get('item'))){setPackage('custom');const item=$$('input[name=items]',form).find(box=>box.value===params.get('item'));item.checked=true;updateSummary();}
  const sourceId=params.get('project')||pending?.projectId||pending?.projectSnapshot?.id;
  if(sourceId){
    if(!session.user){signIn('/packages?project='+encodeURIComponent(sourceId)+'#configure');return;}
    if(!/^[a-f0-9]{32}$/.test(sourceId)){ $('.form-error',form).textContent='This project link is not valid. You can still create a standalone package.'; }
    else try {
      const {project}=await api('/projects/'+sourceId);
      showLinkedProject(project);
      if(!pending){form.elements.business.value=project.name;form.elements.notes.value=['Use the brand direction from '+project.name+'.',project.headline,project.description,project.color?'Primary brand color: '+project.color:''].filter(Boolean).join('\n');}
    } catch(e){$('.form-error',form).textContent='The linked project could not be opened. '+e.message;}
  }
  form.addEventListener('submit',event=>{event.preventDefault();const items=$$('input[name=items]:checked',form).map(box=>box.value);if(!items.length){$('.form-error',form).textContent='Select at least one item for your package.';return;}
    const body={business:form.elements.business.value,package:form.elements.package.value,items,quantities:Object.fromEntries(items.map(item=>[item,Number(form.elements['qty-'+item].value)])),notes:form.elements.notes.value,projectId:linkedProject?.id||null};
    if(!session.user){savePending('desygn-package',body);signIn('/packages#configure');return;}
    busy(form,async()=>{await api('/packages',{method:'POST',body});removePending('desygn-package');location.href='/portal?tab=packages&saved=1';});
  });
}

function projectCard(project) {
  const color=/^#[a-f0-9]{6}$/i.test(project.color)?project.color:'#3d523d';
  return `<article class="project-card"><div class="project-card-art" style="--project-color:${color};--project-tint:${color}18"><span>${escape(project.name.charAt(0).toUpperCase())}</span><strong>${escape(templates[project.category]?.label||'Website project').toUpperCase()}</strong></div><div class="project-card-content"><h3>${escape(project.name)}</h3><p>Updated ${escape(date(project.updatedAt))}</p><div class="project-card-bottom"><a class="text-link" href="/workspace?id=${project.id}">Open project ↗</a><small>${project.versionCount} saved ${project.versionCount===1?'version':'versions'}</small></div></div></article>`;
}

function packageRecord(p) {
  const snapshot=p.projectSnapshot;
  const color=/^#[a-f0-9]{6}$/i.test(snapshot?.color||'')?snapshot.color:'#617654';
  const linked=snapshot?`<div class="record-linked"><span class="color-dot" style="background-color:${color}"></span><div><strong>${escape(snapshot.name)}</strong><small>Brand direction saved with this brief</small>${snapshot.headline?`<p>${escape(snapshot.headline)}</p>`:''}</div><a class="text-link" href="/workspace?id=${escape(snapshot.id)}">Open project ↗</a></div>`:'';
  return `<article class="record"><div><span class="eyebrow">${escape(p.status)}</span><h3>${escape(p.business)} / ${packageLabels[p.package]}</h3><p>Saved ${escape(date(p.createdAt))}</p>${linked}<ul>${p.items.map(item=>`<li>${itemLabels[item]} × ${p.quantities[item]}</li>`).join('')}</ul>${p.notes?`<p class="saved-notes">${escape(p.notes)}</p>`:''}<p class="fine-print">${escape(p.paymentStatus)}</p></div><div class="record-actions"><button type="button" class="button outline small-button" data-export-package="${p.id}">Download brief ↓</button><button type="button" class="text-link" data-copy-package="${p.id}">Revise a copy ↗</button></div></article>`;
}

async function initPortal() {
  if(!session.user){signIn(location.pathname+location.search);return;}
  const content=$('#portal-content');
  try {
    const data=await api('/account');
    const allowed=['overview','projects','brand','packages','plan','orders','billing','settings'];
    const tab=allowed.includes(params.get('tab'))?params.get('tab'):'overview';
    $$('[data-portal-tab]').forEach(a=>{const active=a.dataset.portalTab===tab;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');});
    const greeting=(title,description,action='')=>`<div class="portal-greeting"><div><span class="eyebrow">YOUR DESYGN SHOP WORKSPACE</span><h1>${title}</h1><p>${description}</p></div>${action}</div>`;
    const projects=[...data.projects].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
    if(tab==='settings'){
      content.innerHTML=accountSettingsView(data.user);
      const profile=$('#profile-form');profile.addEventListener('submit',e=>{e.preventDefault();busy(profile,async()=>{const result=await api('/account/profile',{method:'PATCH',body:{name:profile.elements.name.value}});session.user=result.user;toast('Your profile name has been updated.');});});
      const password=$('#password-form');password.addEventListener('submit',e=>{e.preventDefault();busy(password,async()=>{if(password.elements.newPassword.value!==password.elements.confirmPassword.value)throw Error('Your new passwords do not match.');const result=await api('/account/password',{method:'POST',body:{currentPassword:password.elements.currentPassword.value,newPassword:password.elements.newPassword.value}});password.reset();toast(result.message);});});
      const dialog=$('#delete-account-dialog');$('#open-delete-account').addEventListener('click',()=>dialog.showModal());$('#cancel-delete-account').addEventListener('click',()=>dialog.close());
      const deletion=$('#delete-account-form');deletion.addEventListener('submit',e=>{e.preventDefault();busy(deletion,async()=>{await api('/account',{method:'DELETE',body:Object.fromEntries(new FormData(deletion))});removePending('desygn-studio-brief');removePending('desygn-package');removePending('desygn-plan');location.href='/signin?deleted=1';});});
    }
    if(tab==='overview') {
      content.innerHTML=greeting(`Welcome, ${escape(data.user.name.split(' ')[0])}.`,'Your ideas, your brand, and what comes next.','<a class="button primary" href="/studio">New project +</a>')+`<div class="dashboard-stats"><div class="stat-card"><span>Projects</span><strong>${projects.length}</strong><small>Saved in your workspace</small></div><div class="stat-card"><span>Package briefs</span><strong>${data.packages.length}</strong><small>Drafts, not purchases</small></div><div class="stat-card"><span>Your plan</span><strong>${data.plan.paid?'Build':'Free'}</strong><small>${escape(data.plan.status)}</small></div></div><div class="portal-section-title"><h2>Keep shaping your vision.</h2><a class="text-link" href="/portal?tab=projects">All projects →</a></div>`+(projects.length?`<div class="project-list">${projects.slice(0,4).map(projectCard).join('')}</div>`:empty('Your next idea starts here.','Describe your project, create a starter preview, and keep it somewhere you can return to.','/studio','Start your first project'))+`<div class="dashboard-banner"><div><h3>Your brand. A bigger picture.</h3><p>Bring your website, signage, print, and apparel into one package.</p></div><a class="button dark" href="/packages">Explore packages ↗</a></div>`;
    }
    if(tab==='projects')content.innerHTML=greeting('Your projects.','A place for every idea you’re bringing to life.','<a class="button primary" href="/studio">New project +</a>')+(projects.length?`<div class="project-list">${projects.map(projectCard).join('')}</div>`:empty('An open space for your vision.','Your saved projects will appear here with their latest preview and version history.','/studio','Start a project'));
    if(tab==='brand') {
      const brand=data.user.brand||{};
      content.innerHTML=greeting('Your brand, together.','Keep the details consistent across your website and your next package.')+`<div class="brand-preview" style="--brand-color:${/^#[a-f0-9]{6}$/i.test(brand.color)?brand.color:'#ad562f'}"><span aria-hidden="true">✳</span><strong>${escape(brand.name||'Your brand name')}</strong><p>${escape(brand.tagline||'A line that feels like you.')}</p></div><form id="brand-form" class="form-panel account-form"><label>Business or brand name<input name="name" maxlength="100" value="${escape(brand.name||'')}"></label><label>Tagline<input name="tagline" maxlength="160" value="${escape(brand.tagline||'')}"></label><label>Primary brand color<input name="color" type="color" value="${/^#[a-f0-9]{6}$/i.test(brand.color)?brand.color:'#df734b'}"></label><label>Brand notes<textarea name="notes" rows="5" maxlength="2000" placeholder="Your audience, tone, visual preferences, and details to carry across products…">${escape(brand.notes||'')}</textarea></label><div class="form-error" role="alert"></div><button type="submit" class="button primary">Save my brand ↗</button></form>`;
      const form=$('#brand-form');
      form.addEventListener('submit',event=>{event.preventDefault();busy(form,async()=>{await api('/brand',{method:'PUT',body:Object.fromEntries(new FormData(form))});toast('Brand details saved. You can apply them inside a project.');$('.brand-preview').style.setProperty('--brand-color',form.elements.color.value);$('.brand-preview strong').textContent=form.elements.name.value||'Your brand name';$('.brand-preview p').textContent=form.elements.tagline.value||'A line that feels like you.';});});
    }
    if(tab==='packages') {
      content.innerHTML=greeting('Your launch, taking shape.','Saved package briefs are drafts. They have not been submitted, ordered, or paid for.','<a class="button primary" href="/packages#configure">New package +</a>')+(data.packages.length?`<div class="record-list">${[...data.packages].reverse().map(packageRecord).join('')}</div>`:empty('Bring the pieces together.','Save a package brief for your website, brand, print, signage, or apparel.','/packages','Shape a package'));
      $$('[data-export-package]').forEach(button=>button.addEventListener('click',()=>{const p=data.packages.find(p=>p.id===button.dataset.exportPackage);const {userId,...brief}=p;download('Desygn-Launch-Package-Brief.json',JSON.stringify(brief,null,2));}));
      $$('[data-copy-package]').forEach(button=>button.addEventListener('click',()=>{const p=data.packages.find(p=>p.id===button.dataset.copyPackage);savePending('desygn-package',p);location.href='/packages#configure';}));
      if(params.get('saved'))toast('Package brief saved. No order or payment was created.');
    }
    if(tab==='plan') {
      const subscription=[...data.subscriptions].sort((a,b)=>b.eventAt.localeCompare(a.eventAt))[0];
      content.innerHTML=greeting('A plan for your next step.','Your subscription view stays separate from one-time launch packages.')+`<div class="plan-banner"><span class="eyebrow">CURRENT ACCESS · ${escape(data.plan.status).toUpperCase()}</span><h2>${escape(data.plan.name)}.</h2><p>${data.plan.paid?'Your access is based on a verified subscription record.':'Use project briefs, starter previews, saved versions, brand details, downloads, and package planning. There is no active paid subscription.'}</p><a class="button cream" href="/plans">Explore the plan direction ↗</a></div><div class="note-panel"><div class="billing-row"><span>Subscription</span><strong>${subscription?escape(subscription.status):'None'}</strong></div><div class="billing-row"><span>Current period ends</span><strong>${subscription?.currentPeriodEnd?escape(date(subscription.currentPeriodEnd)):'Not applicable'}</strong></div><div class="billing-row"><span>Cancels at period end</span><strong>${subscription?subscription.cancelAtPeriodEnd?'Yes':'No':'Not applicable'}</strong></div><div class="billing-row"><span>Saved plan interest</span><strong>${data.planInterest?escape(data.planInterest.plan==='assist'?'Desygn Assist':'Studio Build'):'No preference yet'}</strong></div><p class="fine-print">Plan interest does not change access or activate billing. This local build has no connected checkout or billing-management portal.</p></div>`;
    }
    if(tab==='orders')content.innerHTML=greeting('Your orders.','A dedicated place for confirmed purchases and fulfillment updates.')+(data.orders.length?`<div class="record-list">${[...data.orders].sort((a,b)=>b.eventAt.localeCompare(a.eventAt)).map(order=>`<article class="record"><div><span class="eyebrow">${escape(order.status)}</span><h3>${escape(order.description||'Your order')}</h3><p>${escape(order.providerId)} · ${escape(date(order.eventAt))}</p>${order.trackingReference?`<p>Tracking reference: ${escape(order.trackingReference)}</p>`:''}</div><strong>${escape(money(order))}</strong></article>`).join('')}</div>`:empty('No purchases yet.','This local build does not accept payments or create production orders. Your saved package briefs live in their own section.','/portal?tab=packages','View package briefs'));
    if(tab==='billing')content.innerHTML=greeting('Billing, clearly organized.','Subscriptions, invoices, and one-time purchases are kept distinct.')+`<div class="note-panel"><div class="billing-row"><span>Account</span><strong>${escape(data.user.email)}</strong></div><div class="billing-row"><span>Access</span><strong>${escape(data.plan.name)}</strong></div><div class="billing-row"><span>Payment method</span><strong>No payment details collected here</strong></div><div class="billing-row"><span>Invoices</span><strong>${data.invoices.length}</strong></div><p>The local build does not connect to a checkout or billing-management portal. Records can be populated only through a verified server-side billing adapter.</p></div><div class="portal-section-title"><h2>Invoice history</h2></div>`+(data.invoices.length?`<div class="record-list">${[...data.invoices].sort((a,b)=>b.eventAt.localeCompare(a.eventAt)).map(invoice=>`<article class="record"><div><span class="eyebrow">${escape(invoice.status)}</span><h3>${escape(invoice.number||invoice.providerId)}</h3><p>${escape(date(invoice.eventAt))}</p></div><strong>${escape(money(invoice))}</strong></article>`).join('')}</div>`:empty('Nothing to bill.','Once live billing is connected, verified invoice and payment records will appear here.'));
  } catch(e) {content.innerHTML=empty('We couldn’t open your workspace.',escape(e.message),'/portal','Try again');}
}

async function initWorkspace() {
  if(!session.user){signIn(location.pathname+location.search);return;}
  const projectId=params.get('id');
  if(!/^[a-f0-9]{32}$/.test(projectId||'')){location.href='/portal?tab=projects';return;}
  const form=$('#project-edit');
  let project;
  function populate(p) {
    project=p;document.title=p.name+' · AI Studio';$('#project-title').textContent=p.name;
    for(const field of ['name','headline','description','category','services','color','contactEmail','brief'])form.elements[field].value=p[field]||'';
    form.elements.label.value='';
    $('#website-preview').src='/api/projects/'+p.id+'/preview?v='+p.versions[0].id;
    $('#download-project').href='/api/projects/'+p.id+'/download';
    $('#package-from-project').href='/packages?project='+p.id+'#configure';
    $('#version-list').innerHTML=p.versions.map((v,i)=>`<div class="version-row"><div><strong>${escape(v.label)}${i===0?' · Current':''}</strong><small>${escape(date(v.createdAt))}</small></div>${i===0?'<span class="pill">CURRENT</span>':`<button type="button" class="button outline small-button" data-restore-version="${v.id}">Restore ↶</button>`}</div>`).join('');
    $$('[data-restore-version]').forEach(button=>button.addEventListener('click',async()=>{button.disabled=true;try{const data=await api('/projects/'+p.id+'/restore',{method:'POST',body:{versionId:button.dataset.restoreVersion}});populate(data.project);toast('Version restored and saved as a new snapshot.');}catch(e){toast(e.message);}finally{button.disabled=false;}}));
  }
  try {const data=await api('/projects/'+projectId);populate(data.project);}
  catch(e){$('#project-title').textContent='Project unavailable';$('.editor-layout').innerHTML=empty('This project could not be opened.',escape(e.message),'/portal?tab=projects','Back to my projects');return;}
  form.addEventListener('submit',event=>{event.preventDefault();busy(form,async()=>{const data=await api('/projects/'+projectId,{method:'PATCH',body:Object.fromEntries(new FormData(form))});populate(data.project);toast('Project saved. Your starter preview and source download are updated.');});});
  $$('[data-device]').forEach(button=>button.addEventListener('click',()=>{$('#website-preview').classList.toggle('mobile',button.dataset.device==='mobile');$$('[data-device]').forEach(b=>{const active=b===button;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});}));
  $('#versions-toggle').addEventListener('click',event=>{const expanded=event.currentTarget.getAttribute('aria-expanded')==='true';event.currentTarget.setAttribute('aria-expanded',String(!expanded));$('#versions-panel').classList.toggle('hidden',expanded);if(!expanded)$('#versions-panel').scrollIntoView({behavior:'smooth',block:'nearest'});});
  $('#apply-brand').addEventListener('click',async()=>{try{const data=await api('/account');const brand=data.user.brand;if(!brand?.name&&!brand?.tagline&&!brand?.color){toast('Save your brand details in My Workspace → My Brand first.');return;}if(brand.name)form.elements.name.value=brand.name;if(brand.tagline)form.elements.headline.value=brand.tagline;if(brand.color)form.elements.color.value=brand.color;toast('Brand applied to the brief. Save to update the preview.');}catch(e){toast(e.message);}});
}

init();
