// Provider-neutral integration boundary. No public webhook is enabled by this build.
// The supplied adapter MUST verify the provider's signature and return a normalized event.
const planIds=new Set(['studio-build']);
const subscriptionStates=new Set(['active','trialing','past_due','canceled','unpaid','incomplete']);
const orderStates=new Set(['paid','in_production','shipped','delivered','refunded']);
const invoiceStates=new Set(['draft','open','paid','void','uncollectible']);
function requireString(value,label){if(typeof value!=='string'||!value.trim())throw Error('Missing '+label);return value;}
export function ensureBillingTables(db){for(const key of ['subscriptions','orders','invoices','billingEvents'])if(!Array.isArray(db[key]))db[key]=[];return db;}
export function accountBilling(db,userId) {
  ensureBillingTables(db);
  const subscriptions=db.subscriptions.filter(x=>x.userId===userId);
  const active=subscriptions.find(x=>planIds.has(x.planId)&&['active','trialing'].includes(x.status)&&(!x.currentPeriodEnd||Date.parse(x.currentPeriodEnd)>Date.now()));
  return {subscriptions,orders:db.orders.filter(x=>x.userId===userId),invoices:db.invoices.filter(x=>x.userId===userId),plan:active?{id:active.planId,name:'Studio Build',status:active.status,paid:true}:{id:'free',name:'Free workspace',status:'Local review',paid:false}};
}
export function createBillingReceiver({db,persist,verify}) {
  ensureBillingTables(db);
  return async function receive(rawBody,signature) {
    if(typeof verify!=='function')throw Error('A verified billing adapter is not configured.');
    const event=await verify(rawBody,signature);
    if(!event||typeof event!=='object')throw Error('The billing event could not be verified.');
    requireString(event.id,'event ID');requireString(event.userId,'customer account');
    const occurredAt=Date.parse(event.occurredAt);
    if(!Number.isFinite(occurredAt))throw Error('Invalid billing event timestamp.');
    if(!db.users.some(u=>u.id===event.userId))throw Error('Customer account not found.');
    if(db.billingEvents.some(e=>e.id===event.id))return {duplicate:true};
    const value=event.record;
    if(!value||typeof value!=='object')throw Error('Missing billing record.');
    requireString(value.providerId,'provider record ID');
    let table,record;
    if(event.type==='subscription.updated') {
      if(!planIds.has(value.planId)||!subscriptionStates.has(value.status))throw Error('Unsupported plan or subscription state.');
      if(value.currentPeriodEnd&&!Number.isFinite(Date.parse(value.currentPeriodEnd)))throw Error('Invalid subscription period.');
      table='subscriptions';record={providerId:value.providerId,userId:event.userId,planId:value.planId,status:value.status,currentPeriodEnd:value.currentPeriodEnd||null,cancelAtPeriodEnd:Boolean(value.cancelAtPeriodEnd)};
    } else if(event.type==='order.updated') {
      if(!orderStates.has(value.status))throw Error('Unsupported order state.');
      if(!Number.isSafeInteger(value.amountMinor)||value.amountMinor<0||!/^[A-Z]{3}$/.test(value.currency||''))throw Error('Invalid order amount.');
      table='orders';record={providerId:value.providerId,userId:event.userId,status:value.status,amountMinor:value.amountMinor,currency:value.currency,description:String(value.description||'').slice(0,300),trackingReference:String(value.trackingReference||'').slice(0,100)};
    } else if(event.type==='invoice.updated') {
      if(!invoiceStates.has(value.status))throw Error('Unsupported invoice state.');
      if(!Number.isSafeInteger(value.amountMinor)||value.amountMinor<0||!/^[A-Z]{3}$/.test(value.currency||''))throw Error('Invalid invoice amount.');
      table='invoices';record={providerId:value.providerId,userId:event.userId,status:value.status,amountMinor:value.amountMinor,currency:value.currency,number:String(value.number||'').slice(0,100)};
    } else throw Error('Unsupported billing event.');
    const previous=db[table].find(r=>r.providerId===record.providerId);
    if(previous&&previous.userId!==event.userId)throw Error('Billing record belongs to a different account.');
    const stale=previous&&Date.parse(previous.eventAt)>=occurredAt;
    const backup=structuredClone({records:db[table],events:db.billingEvents});
    if(!stale){record.eventAt=event.occurredAt;db[table]=db[table].filter(r=>r.providerId!==record.providerId);db[table].push(record);}
    db.billingEvents.push({id:event.id,userId:event.userId,type:event.type,occurredAt:event.occurredAt,ignoredAsStale:Boolean(stale)});
    try{await persist();}catch(error){db[table]=backup.records;db.billingEvents=backup.events;throw error;}
    return {duplicate:false,ignoredAsStale:Boolean(stale)};
  };
}
