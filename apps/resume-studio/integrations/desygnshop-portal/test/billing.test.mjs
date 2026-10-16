import test from 'node:test';
import assert from 'node:assert/strict';
import {createBillingReceiver,accountBilling} from '../src/billing.mjs';

test('billing adapter refuses unverified events and keeps paid access server-owned',async()=>{
  const db={users:[{id:'alice'},{id:'bob'}]};
  await assert.rejects(createBillingReceiver({db,persist:async()=>{}})('anything','anything'),/not configured/);
  const receive=createBillingReceiver({db,persist:async()=>{},verify:async(raw,signature)=>{if(signature!=='verified-test-signature')throw Error('Invalid signature');return raw;}});
  const base={id:'event-1',userId:'alice',occurredAt:'2026-10-15T16:00:00Z',type:'subscription.updated',record:{providerId:'sub-1',planId:'studio-build',status:'active',currentPeriodEnd:'2099-01-01T00:00:00Z'}};
  await assert.rejects(receive(base,'bad'),/Invalid signature/);
  assert.equal(accountBilling(db,'alice').plan.paid,false);
  assert.equal((await receive(base,'verified-test-signature')).duplicate,false);
  assert.equal(accountBilling(db,'alice').plan.paid,true);assert.equal(accountBilling(db,'bob').plan.paid,false);
  assert.equal((await receive(base,'verified-test-signature')).duplicate,true);
  await receive({...base,id:'event-2',occurredAt:'2026-10-15T17:00:00Z',record:{...base.record,status:'past_due'}},'verified-test-signature');
  assert.equal(accountBilling(db,'alice').plan.paid,false);
  assert.equal((await receive({...base,id:'event-delayed'},'verified-test-signature')).ignoredAsStale,true);
  assert.equal(accountBilling(db,'alice').plan.paid,false);
  await assert.rejects(receive({...base,id:'event-cross',userId:'bob'},'verified-test-signature'),/different account/);
  const order={id:'order-evt',userId:'alice',occurredAt:'2026-10-15T18:00:00Z',type:'order.updated',record:{providerId:'order-1',status:'paid',amountMinor:45000,currency:'USD',description:'Launch package'}};
  await receive(order,'verified-test-signature');
  assert.equal(accountBilling(db,'alice').orders.length,1);assert.equal(accountBilling(db,'alice').plan.paid,false);
  const invoice={...order,id:'invoice-evt',type:'invoice.updated',record:{providerId:'invoice-1',status:'paid',amountMinor:45000,currency:'USD',number:'DS-TEST-1'}};
  await receive(invoice,'verified-test-signature');assert.equal(accountBilling(db,'alice').invoices.length,1);
  assert.equal(accountBilling(db,'bob').orders.length,0);
});

test('billing write failure rolls back records and permits a safe retry',async()=>{
  const db={users:[{id:'alice'}]};let shouldFail=true;
  const receive=createBillingReceiver({db,verify:async(raw)=>raw,persist:async()=>{if(shouldFail)throw Error('Disk unavailable');}});
  const event={id:'evt',userId:'alice',occurredAt:'2026-10-15T17:00:00Z',type:'order.updated',record:{providerId:'order',status:'paid',amountMinor:1000,currency:'USD'}};
  await assert.rejects(receive(event,'signature'),/Disk unavailable/);assert.equal(db.orders.length,0);assert.equal(db.billingEvents.length,0);
  shouldFail=false;await receive(event,'signature');assert.equal(db.orders.length,1);assert.equal(db.billingEvents.length,1);
});
