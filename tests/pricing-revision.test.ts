import test from 'node:test'
import assert from 'node:assert/strict'
import {calculatePricingRevision,requiredCostKinds,type PricingRevisionInput} from '../src/lib/calc/pricing-revision'
const input=():PricingRevisionInput=>({mode:'ratio',value:0.5,tax_rate:10,fx:{rate:150,reference:'Synthetic confirmed rate',as_of:'2026-10-01T00:00:00Z',confirmed:true},cost_lines:requiredCostKinds.map(kind=>({key:kind,kind,name:kind,amount:0,currency:'USD',confirmed:true}))})
test('ratio means cost divided by selling price; selling entry reverses ratio and unit/total/tax stay consistent',()=>{
 const r=calculatePricingRevision(1000,0.1,input());assert.equal(r.selling_price_jpy,30);assert.equal(r.total_billing_jpy,30000);assert.equal(r.total_billing_tax_jpy,33000)
 const i=input();i.mode='selling_price';i.value=37;const s=calculatePricingRevision(1000,0.1,i);assert.equal(s.selling_price_jpy,37);assert.equal(s.cost_ratio,15/37);assert.equal(s.total_billing_tax_jpy,40700)
 const b=input();b.value=.55;assert.equal(calculatePricingRevision(3,.1,b).selling_price_jpy,28)
 assert.equal(calculatePricingRevision(3,.1,input()).selling_price_jpy,30)
 const boundary=input();boundary.mode='selling_price';boundary.value=11;boundary.fx.rate=50;assert.equal(calculatePricingRevision(1000,.1,boundary).total_billing_tax_jpy,12100)
})
test('empty, zero, negative, unconfirmed and duplicated inputs fail; explicit confirmed zero fees remain zero',()=>{
 for(const n of [null,0,-1,NaN,Infinity]){const i=input();i.value=n;assert.throws(()=>calculatePricingRevision(1000,.1,i))}
 for(const n of [null,-1,NaN]){const i=input();i.cost_lines[0].amount=n;assert.throws(()=>calculatePricingRevision(1000,.1,i))}
 const i=input();i.cost_lines[0].confirmed=false;assert.throws(()=>calculatePricingRevision(1000,.1,i));const d=input();d.cost_lines.push({...d.cost_lines[0]});assert.throws(()=>calculatePricingRevision(1000,.1,d))
 const fx=input();fx.fx.confirmed=false;assert.throws(()=>calculatePricingRevision(1000,.1,fx));const loss=input();loss.mode='selling_price';loss.value=14;assert.throws(()=>calculatePricingRevision(1000,.1,loss))
})
test('custom currencies convert once; samples and duplicate plate costs cannot enter mass production pricing',()=>{
 const i=input();i.cost_lines.push({key:'inspection',kind:'custom',name:'Inspection',amount:1500,currency:'JPY',confirmed:true});assert.equal(calculatePricingRevision(1000,.1,i).total_cost_usd,110)
 for(const name of ['sample round 1','サンプル製作費','版代追加']){const s=input();s.cost_lines.push({key:'extra',kind:'custom',name,amount:10,currency:'USD',confirmed:true});assert.throws(()=>calculatePricingRevision(1000,.1,s))}
})
