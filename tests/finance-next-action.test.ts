import test from 'node:test'
import assert from 'node:assert/strict'
import {financeNextAction,type FinanceEvidence} from '../src/lib/deals/finance-next-action'
const quote:FinanceEvidence={document_type:'quotation',status:'active',current_price:true,decision:'approved',upfront_jpy:'550',payment_totals:{net_jpy:'0'}}
const invoice:FinanceEvidence={...quote,document_type:'invoice',decision:null,payment_totals:{net_jpy:'550'}}
test('historical paid status cannot conceal current reapproval or old-price invoice',()=>{
 assert.match(financeNextAction([{...quote,decision:null},invoice])!.label,/見積承認/)
 assert.match(financeNextAction([quote,{...invoice,current_price:false}])!.label,/請求差替/)
 assert.match(financeNextAction([{...quote,decision:'revision_requested'}])!.label,/修正依頼/)
})
test('net refund shortfall blocks next work, while agreed half/postpaid are not falsely held for full payment',()=>{
 assert.match(financeNextAction([quote,{...invoice,payment_totals:{net_jpy:'450'}}])!.label,/実着金/)
 assert.equal(financeNextAction([quote,invoice]),undefined)
 assert.equal(financeNextAction([quote,{...invoice,upfront_jpy:'0',payment_totals:{net_jpy:'0'}}]),undefined)
 assert.match(financeNextAction([quote])!.label,/請求書/)
 assert.equal(financeNextAction([{...quote,status:'superseded'}]),undefined)
})
