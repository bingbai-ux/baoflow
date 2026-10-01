import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import ts from 'typescript'
import React from 'react'
import * as jsx from 'react/jsx-runtime'
import {renderToStaticMarkup} from 'react-dom/server'
import {milestoneNames,nextMilestone,type ShipmentContext,type ShipmentPlan} from '../src/lib/shipping/types'
const exports:any={};runInNewContext(ts.transpileModule(readFileSync('src/components/shipping/shipment-panel.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:(name:string)=>name==='react'?React:name==='react/jsx-runtime'?jsx:name==='next/navigation'?{useRouter:()=>({refresh(){}})}:name.includes('use-workflow-request')?{useWorkflowRequest:()=>({ready:true,recovered:null,error:null})}:name.includes('shipping/types')?{milestoneNames,nextMilestone}:{}})
const base:ShipmentContext={actor:'staff',deal_status:'in_production',order:{id:'order',deal_id:'deal',number:'Synthetic PO',quantity:100,item_name:'Synthetic package'},ship_ready:true,plans:[],options:{partners:[],actors:[],customer_default:null},saved_destination:null,tracking_integration:false,today:'2026-10-01'}
const plan:ShipmentPlan={id:'plan',quantity:100,created_at:'2026-10-01',snapshot:{method:'sea',food_required:false,food_basis:'Synthetic verified non-food',china_address:'Synthetic China address',china_source:'Synthetic verified',partner_name:'Synthetic logistics',destination_address:'Synthetic destination',destination_source:'manual',recipient:'Synthetic recipient',phone:'000000000',item_name:'Synthetic package'},events:[],received_quantity:0,receipts:[],document:null}
const render=(c:ShipmentContext)=>renderToStaticMarkup(React.createElement(exports.ShipmentPanel,{context:c}))
const primary=(html:string)=>[...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].filter(m=>m[1].includes('bg-[#E9F056]')).map(m=>m[2])
test('staff priority follows prepare → actual dispatch reflection → received document → PDF/mail → completed; one main action even when global status lags',()=>{
 const shipped={...plan,events:[{id:'event',kind:'factory_dispatched' as const,occurred_at:'2026-10-01',tracking_number:'Synthetic'}]},document={id:'doc',number:'Synthetic DLV',mail_status:null}
 for(const [context,label] of [[base,'この固定版で発送計画を保存する'],[{...base,plans:[shipped]},'全便の実発送を案件へ反映'],[{...base,deal_status:'shipped',plans:[{...shipped,received_quantity:100}]},'顧客受領版の納品書を発行する'],[{...base,deal_status:'shipped',plans:[{...shipped,received_quantity:100,document}]},'納品書メールの送付内容を確認する'],[{...base,plans:[{...shipped,received_quantity:100,document}]},'全便の実発送を案件へ反映'],[{...base,deal_status:'shipped',plans:[{...shipped,received_quantity:100,document:{...document,mail_status:'accepted'}}]},'全受領・納品書を確認して案件完了']] as [ShipmentContext,string][]){assert.deepEqual(primary(render(context)),[label])}
 const completed=render({...base,deal_status:'delivered',plans:[{...shipped,received_quantity:100,document:{...document,mail_status:'accepted'}}]});assert.deepEqual(primary(completed),[]);assert.match(completed,/次の対応：完了/)
})
test('customer awaits real carrier delivery; factory and logistics see only their next fact input; arrival removes obsolete ETA prompt',()=>{
 const dispatched={...plan,events:[{id:'event',kind:'factory_dispatched' as const,occurred_at:'2026-10-01',tracking_number:'Synthetic'}]}
 assert.deepEqual(primary(render({...base,actor:'factory',plans:[plan]})),['この実輸送状態を記録する']);assert.deepEqual(primary(render({...base,actor:'logistics',plans:[dispatched]})),['この実輸送状態を記録する']);assert.deepEqual(primary(render({...base,actor:'client',plans:[dispatched]})),[])
 const delivered={...dispatched,events:[...dispatched.events,{id:'arrived',kind:'japan_arrived' as const,occurred_at:'2026-10-01',tracking_number:'Synthetic'},{id:'delivered',kind:'carrier_delivered' as const,occurred_at:'2026-10-01',tracking_number:'Synthetic'}]};const html=render({...base,actor:'client',plans:[delivered]});assert.deepEqual(primary(html),['今回の実受領を記録する']);assert.doesNotMatch(html,/到着予定日は未確認/)
})
