// Local-only PostgREST/Auth fixture. Contains synthetic data and accepts no external URLs.
import http from 'node:http'
import { randomUUID } from 'node:crypto'
import {tsImport} from 'tsx/esm/api'
const {calculatePricingRevision}=await tsImport('../../src/lib/calc/pricing-revision.ts',import.meta.url)
export const IDs={user:'11111111-1111-4111-8111-111111111111',client:'22222222-2222-4222-8222-222222222222',deal:'33333333-3333-4333-8333-333333333333',product:'44444444-4444-4444-8444-444444444444',variant:'55555555-5555-4555-8555-555555555555',quote:'66666666-6666-4666-8666-666666666666'}
const now='2026-09-30T00:00:00Z'
const user={id:IDs.user,aud:'authenticated',role:'authenticated',email:'local@example.test',app_metadata:{},user_metadata:{},created_at:now}
const client={id:IDs.client,company_name:'検証用カフェ',short_name:'検証用カフェ',brand_name:'TEST',storage_rate_config:null}
const deal={id:IDs.deal,deal_code:'LOCAL-001',deal_name:'検証用パウチ',client_id:IDs.client,client_name_text:client.company_name,desired_delivery_date:'2026-10-15',simple_status:'quoting',master_status:'M01',waiting_on:'us',visibility:'internal',memo:'',archived_at:null,created_at:now,updated_at:now,last_activity_at:now,sales_user_id:IDs.user,sales_user:{display_name:'検証担当'},client, tags:[]}
const product={id:IDs.product,deal_id:IDs.deal,product_no:1,description:'パウチ',is_selected:false}
const variant={id:IDs.variant,product_id:IDs.product,variant_label:'100g',material:'PET',width_mm:100,height_mm:150,depth_mm:30,pcs_per_carton:100,carton_width_cm:30,carton_height_cm:40,carton_depth_cm:30,gross_weight_kg:10,variant_order:1,deal_products:{deal_id:IDs.deal}}
const quote={id:IDs.quote,deal_id:IDs.deal,variant_id:IDs.variant,spec_id:null,quantity:1000,moq:1000,version:1,status:'draft',factory_unit_price_usd:0.1,exchange_rate:150,cost_ratio:0.5,unit_cost_usd:0.12,total_cost_usd:120,selling_price_jpy:36,total_billing_jpy:36000,total_billing_tax_jpy:39600,factory_calculated_freight_usd:20,china_freight_usd:20}
let db;let failure=null;let number=1
function reset(){ db={profiles:[{...user,display_name:'検証担当',role:'sales'}],clients:[client],deals:[structuredClone(deal)],deal_products:[product],deal_product_variants:[variant],deal_quotes:[structuredClone(quote)],product_catalog:[{id:'pouch',name:'パウチ',level:1,parent_id:null,sort:1}],system_settings:[{id:1,default_exchange_rate:150,default_tax_rate:10,default_cost_ratio:0.5,company_info:{company_name:'ローカル検証',address:'テスト住所'},bank_accounts:[]}],documents:[],rfq_requests:[],factories:[],inventory_items:[],inventory_transactions:[],inbound_shipments:[],shipment_requests:[],deal_status_history:[],deal_design_files:[],deal_communications:[]};failure=null;number=1}
reset()
const server=http.createServer(async(req,res)=>{
 res.setHeader('access-control-allow-origin','*');res.setHeader('access-control-allow-headers','*');res.setHeader('access-control-allow-methods','GET,POST,PATCH,DELETE,HEAD,OPTIONS');res.setHeader('content-type','application/json')
 if(req.method==='OPTIONS'){res.end();return}
 let body='';for await(const chunk of req)body+=chunk;let input={};try{input=body?JSON.parse(body):{}}catch{}
 const url=new URL(req.url,'http://127.0.0.1:55440')
 const send=(data,status=200)=>{res.statusCode=status;res.end(JSON.stringify(data))}
 if(url.pathname==='/__reset'){reset();send({ok:true});return}
 if(url.pathname==='/__role'){if(!['sales','client','factory','logistics'].includes(input.role)){send({error:'invalid local role'},400);return}Object.assign(db.profiles[0],{role:input.role,client_id:input.role==='client'?IDs.client:null,factory_id:input.role==='factory'?'77777777-7777-4777-8777-777777777777':null});send({ok:true});return}
 if(url.pathname==='/__fail'){failure=input.table;send({ok:true});return}
 if(url.pathname==='/__state'){send(db);return}
 if(url.pathname==='/auth/v1/user'){send(user);return}
 if(url.pathname.startsWith('/auth/v1/')){send({user,access_token:'fixture',expires_in:3600,token_type:'bearer'});return}
 const table=url.pathname.split('/').pop()
 if(failure===table){failure=null;send({code:'XX000',message:'Local simulated database failure'},500);return}
 if(url.pathname.includes('/rpc/')){
  if(table==='preview_quote_pricing_v2'||table==='save_quote_pricing_v2'){
   try{
    if(!['sales','admin'].includes(db.profiles[0].role))throw Error('Sales or administrator access required')
    const q=db.deal_quotes.find(q=>q.id===input.p_quote_id);if(!q?.variant_id)throw Error('Specification binding required')
    const snapshot={schema_version:1,source_quote_id:q.id,deal_id:q.deal_id,variant_id:q.variant_id,factory_id:q.factory_id||null,quantity:q.quantity,factory_unit_price_usd:String(q.factory_unit_price_usd),factory_response:q.factory_response||null,mode:input.p_input.mode,input_value:String(input.p_input.value),fx:{kind:'manual_confirmed',rate:String(input.p_input.fx.rate),reference:input.p_input.fx.reference,as_of:input.p_input.fx.as_of},tax_rate:String(input.p_input.tax_rate),cost_lines:input.p_input.cost_lines,...calculatePricingRevision(q.quantity,q.factory_unit_price_usd,input.p_input),sample_costs_included:false}
    if(table==='preview_quote_pricing_v2'){send(snapshot);return}
    db.quote_pricing_requests||=[];const payload=JSON.stringify(input),saved=db.quote_pricing_requests.find(r=>r.request_id===input.p_request_id)
    if(saved){if(saved.payload!==payload)throw Error('different input');send({quote_id:saved.quote_id,deal_id:q.deal_id});return}
    if(JSON.stringify(snapshot)!==JSON.stringify(input.p_expected))throw Error('Preview changed')
    const id=randomUUID(),next={...q,id,version:Math.max(...db.deal_quotes.filter(x=>x.deal_id===q.deal_id).map(x=>x.version||0))+1,status:'drafting',source_type:'pricing_revision',pricing_snapshot:snapshot,...calculatePricingRevision(q.quantity,q.factory_unit_price_usd,input.p_input),exchange_rate:input.p_input.fx.rate,sample_cost_usd:0,sample_shipping_usd:0};db.deal_quotes.push(next);db.quote_pricing_requests.push({request_id:input.p_request_id,created_by:IDs.user,deal_id:q.deal_id,payload,quote_id:id});send({quote_id:id,deal_id:q.deal_id});return
   }catch(e){send({code:'P0001',message:e.message},400);return}
  }
  // Synthetic contract for browser wiring only. Transaction/RLS correctness is
  // separately tested against in-memory Postgres in verify-wizard-atomic.mjs.
  if(table==='wizard_atomic') {
   if(!['sales','admin'].includes(db.profiles[0]?.role)){send({code:'42501',message:'この操作は営業・管理者のみ利用できます'},403);return}
   db.wizard_requests ||= []
   const {p_request_id:key,p_operation:operation,p_payload:p}=input
   const prior=db.wizard_requests.find(r=>r.request_id===key)
   if(prior){if(prior.operation!==operation||JSON.stringify(prior.payload)!==JSON.stringify(p)){send({code:'22023',message:'同じ保存要求で内容が変わっています'},400);return}send(prior.result);return}
   let result
   if(operation==='deal'){
    const id=randomUUID(),code=`PF-202609-${String(number++).padStart(3,'0')}`
    db.deals.push({...structuredClone(deal),id,deal_code:code,deal_name:`${p.client_name_text} ${p.items.join('・')} 9/30`,...p})
    p.items.forEach((name,i)=>db.deal_products.push({id:randomUUID(),deal_id:id,product_no:i+1,description:name,category_l1:name,is_selected:false}))
    db.deal_status_history.push({id:randomUUID(),deal_id:id,to_status:'M01',to_simple_status:'quoting',changed_by:IDs.user,kind:'status',note:'案件作成',changed_at:now})
    result={success:true,dealId:id,dealCode:code}
   }else{
    const d=db.deals.find(d=>d.id===p.deal_id)
    if(!d||d.archived_at){send({code:'22023',message:'案件を変更できません'},400);return}
    if(operation==='spec'){
     let product=db.deal_products.find(x=>x.id===p.product_id&&x.deal_id===p.deal_id)
     if(p.product_id&&!product){send({code:'22023',message:'商品がこの案件に属していません'},400);return}
     if(!product){product={id:randomUUID(),deal_id:p.deal_id,product_no:db.deal_products.filter(x=>x.deal_id===p.deal_id).length+1,is_selected:false};db.deal_products.push(product)}
     Object.assign(product,{description:[p.category_l1,p.category_l2,p.category_l3].filter(Boolean).join(' / '),category_l1:p.category_l1,category_l2:p.category_l2,category_l3:p.category_l3})
     const nextOrder=Math.max(-1,...db.deal_product_variants.filter(v=>v.product_id===product.id).map(v=>v.variant_order||0))+1
     const variant={id:randomUUID(),product_id:product.id,deal_products:{deal_id:p.deal_id},variant_label:nextOrder<26?String.fromCharCode(65+nextOrder):`仕様 ${nextOrder+1}`,variant_order:nextOrder,is_selected:false,...Object.fromEntries(Object.entries(p).filter(([k])=>!['product_id','deal_id','quantities'].includes(k)))}
     db.deal_product_variants.push(variant)
     p.quantities.forEach((q,i)=>db.deal_quotes.push({id:randomUUID(),deal_id:p.deal_id,variant_id:variant.id,quantity:q,version:i+1,status:'drafting',created_at:now}))
     result={success:true,productId:product.id,variantId:variant.id}
    }else if(operation==='quantity'){
     const variant=db.deal_product_variants.find(v=>v.id===p.variant_id)
     if(!variant||!db.deal_products.some(x=>x.id===variant.product_id&&x.deal_id===p.deal_id)){send({code:'22023',message:'仕様がこの案件に属していません'},400);return}
     const quotes=db.deal_quotes.filter(q=>q.variant_id===p.variant_id)
     if(quotes.some(q=>q.quantity===p.quantity)){send({code:'22023',message:'この数量の見積はすでにあります'},400);return}
     db.deal_quotes.push({id:randomUUID(),deal_id:p.deal_id,variant_id:p.variant_id,quantity:p.quantity,version:Math.max(0,...quotes.map(q=>q.version||0))+1,status:'drafting',created_at:now})
     result={success:true}
    }else{send({code:'22023',message:'保存要求が不正です'},400);return}
    db.deal_status_history.push({id:randomUUID(),deal_id:p.deal_id,to_status:'M01',changed_by:IDs.user,kind:'variant',note:'仕様・数量追加',changed_at:now})
   }
   db.wizard_requests.push({request_id:key,user_id:IDs.user,operation,payload:p,result});send(result);return
  }
 
  if(table==='import_pending_rfq_answer'){
   if(!['sales','admin'].includes(db.profiles[0]?.role)){send({message:'Staff only'},403);return}
   const inv=db.rfq_factory_invitations?.find(i=>i.id===input.p_invitation_id),r=db.rfq_requests.find(r=>r.id===inv?.rfq_id),f=db.external_forms?.find(f=>f.id===inv?.external_form_id)
   if(!inv||r?.deal_id!==input.p_deal_id||f?.status!=='submitted'||!db.factories.some(f=>f.id===input.p_factory_id&&f.basic_info_completed)){send({message:'Invalid import'},400);return}
   db.rfq_answer_imports ||= [];const saved=db.rfq_answer_imports.find(i=>i.invitation_id===inv.id)
   if(saved){send({success:true,replayed:true});return}
   for(const line of f.submission_data.products)for(const quantity of f.context.schema_version===2?[line.quantity]:f.context.requested_lines.find(l=>l.variant_id===line.variant_id).quantities)db.deal_quotes.push({id:randomUUID(),deal_id:r.deal_id,variant_id:line.variant_id,factory_id:input.p_factory_id,quantity,moq:line.moq,factory_unit_price_usd:line.unit_price_usd,status:'drafting',source_type:'rfq_response',factory_response:{line,invitation_id:inv.id}})
   inv.factory_id=input.p_factory_id;db.rfq_answer_imports.push({invitation_id:inv.id,factory_id:input.p_factory_id});send({success:true,replayed:false});return
  }
  if(table==='create_rfq_atomic'){try{send(rfqAtomic(input))}catch(error){send({code:'P0001',message:error.message},400)}return}
  if(table==='preview_rfq_v2'){try{send(rfqPreview(input))}catch(error){send({code:'P0001',message:error.message},400)}return}
  if(table==='create_rfq_v2'){try{send(rfqAtomic({...input,p_product_ids:[...new Set(input.p_selection.map(l=>l.product_id))]}))}catch(error){send({code:'P0001',message:error.message},400)}return}
  if(table==='select_quote_atomic') {const q=db.deal_quotes.find(q=>q.id===input.p_quote_id);if(q){db.deal_quotes.filter(x=>x.variant_id===q.variant_id).forEach(x=>x.status='draft');q.status='approved'}send({success:true,deal_id:q?.deal_id});return}
  if(table==='issue_document_atomic'){try{send(issueDocumentAtomic(input))}catch(error){send({code:'P0001',message:error.message},400)}return}
  if(table==='reserve_document_number'){send(`${({quotation:'QUO',invoice:'INV',delivery_note:'DLV',rfq:'RFQ',inventory_cert:'CRT'})[input.p_type]||'QUO'}-202609-${String(number++).padStart(3,'0')}`);return}
  if(table==='set_deal_simple_status'){const d=db.deals.find(d=>d.id===input.p_deal_id);d.simple_status=input.p_to;db.deal_status_history.push({id:randomUUID(),deal_id:d.id,to_simple_status:input.p_to,changed_at:now,kind:'status'});send(null);return}
  if(['ext_form_by_token','ext_rfq_context','ext_submit_rfq','portal_factory_rfqs','portal_my_deals','create_factory_order_atomic','create_inbound_shipment_atomic','receive_inbound_shipment_atomic','create_shipment_request_atomic','ship_shipment_request_atomic'].includes(table)){try{send(workflowRpc(table,input))}catch(error){send({code:'P0001',message:error.message},400)}return}
  send(null);return
 }
 if(!db[table])db[table]=[]
 let rows=db[table].filter(row=>{for(const [key,value]of url.searchParams){if(['select','order','limit','offset','on_conflict'].includes(key))continue;let actual=key.split('.').reduce((obj,k)=>obj?.[k],row);if(value.startsWith('eq.')&&String(actual)!==value.slice(3))return false;if(value==='is.null'&&actual!=null)return false;if(value==='not.is.null'&&actual==null)return false;if(value.startsWith('in.(')&&!value.slice(4,-1).split(',').includes(String(actual)))return false;if(value.startsWith('like.')&&!String(actual??'').startsWith(value.slice(5).replace('%','')))return false}return true})
 if(['GET','HEAD'].includes(req.method)){rows=rows.map(row=>{
  if(table==='inbound_shipments')return {...row,client:db.clients.find(c=>c.id===row.client_id),deal:db.deals.find(d=>d.id===row.deal_id),lines:(db.inbound_shipment_items||[]).filter(l=>l.shipment_id===row.id)}
  if(table==='shipment_requests')return {...row,client:db.clients.find(c=>c.id===row.client_id),items:(db.shipment_request_items||[]).filter(l=>l.request_id===row.id).map(l=>({...l,item:db.inventory_items.find(i=>i.id===l.item_id)}))}
  if(table==='deal_quotes')return {...row,factory:db.factories.find(f=>f.id===row.factory_id)}
  if(table==='inventory_items')return {...row,client:db.clients.find(c=>c.id===row.client_id),deal:db.deals.find(d=>d.id===row.deal_id)}
  if(table==='inventory_transactions')return {...row,item:db.inventory_items.find(i=>i.id===row.item_id)}
  return row
 })}
 if(req.method==='POST'){rows=(Array.isArray(input)?input:[input]).map(v=>({id:randomUUID(),created_at:now,updated_at:now,archived_at:null,master_status:'M01',...v}));db[table].push(...rows)}
 if(req.method==='PATCH')rows.forEach(r=>Object.assign(r,input))
 if(req.method==='DELETE'){db[table]=db[table].filter(r=>!rows.includes(r))}
 if(url.searchParams.has('limit'))rows=rows.slice(0,Number(url.searchParams.get('limit')))
 res.setHeader('content-range',`0-${Math.max(rows.length-1,0)}/${rows.length}`)
 if(req.method==='HEAD'){res.end();return}
 const single=req.headers.accept?.includes('vnd.pgrst.object')
 if(single&&!rows.length){send({code:'PGRST116',message:'no rows'},406);return}
 send(single?rows[0]:rows)
})
server.listen(55440,'127.0.0.1',()=>console.log('Local synthetic Supabase fixture listening on 127.0.0.1:55440'))

// Browser-only synthetic implementation. SQL rollback/authorization is separately exercised in PGlite.
function rfqPreview(input){
 if(!['sales','admin'].includes(db.profiles[0]?.role))throw new Error('Staff only')
 if(!input.p_selection?.length)throw new Error('Select specifications and quantities')
 const requested_lines=input.p_selection.map(line=>{
  const p=db.deal_products.find(p=>p.id===line.product_id&&p.deal_id===input.p_deal_id),v=db.deal_product_variants.find(v=>v.id===line.variant_id&&v.product_id===line.product_id)
  if(!p||!v||!line.quantities.length||line.quantities.some(q=>!db.deal_quotes.some(row=>row.deal_id===input.p_deal_id&&row.variant_id===v.id&&row.quantity===q)))throw new Error('Invalid specification or quantity')
  return {product_id:p.id,product_description:p.description,product_no:p.product_no,variant_id:v.id,variant_label:v.variant_label,width_mm:v.width_mm??null,height_mm:v.height_mm??null,depth_mm:v.depth_mm??null,material:v.material??null,print_color_count:v.print_color_count??null,print_method:v.print_method??null,color_description:v.color_description??null,pantone_colors:v.pantone_colors??null,processing:v.processing??null,quantities:[...line.quantities].sort((a,b)=>a-b)}
 })
 const recipients=[...(input.p_factory_ids||[]).slice().sort().map(id=>{const f=db.factories.find(f=>f.id===id&&f.basic_info_completed);if(!f)throw new Error('Incomplete factory');return {factory_id:id,name:f.factory_name,email:f.contact_email||''}}),...(input.p_pending_factories||[]).map(f=>({factory_id:null,name:f.name,email:f.email||''}))]
 if(!recipients.length)throw new Error('Select products and factories')
 return {schema_version:2,deal_id:input.p_deal_id,requested_lines,recipients,response_deadline:input.p_deadline??null,request_message:input.p_message?.trim()||null}
}
function rfqAtomic(input) {
 if(!['admin','sales'].includes(db.profiles[0]?.role))throw new Error('Sales or administrator access required')
 const snapshot=structuredClone(db)
 snapshot.rfq_creation_requests ||= [];snapshot.rfq_factory_invitations ||= [];snapshot.external_forms ||= []
 const payload={deal:input.p_deal_id,products:[...input.p_product_ids].sort(),factories:[...input.p_factory_ids].sort(),pending:input.p_pending_factories||[],deadline:input.p_deadline,message:input.p_message?.trim()||null,...(input.p_selection?{selection:input.p_selection,expected:input.p_expected}:{})}
 const saved=snapshot.rfq_creation_requests.find(r=>r.request_id===input.p_request_id)
 if(saved){if(JSON.stringify(saved.payload)!==JSON.stringify(payload))throw new Error('Request ID was already used with different input');return saved.result}
 if(input.p_selection&&JSON.stringify(rfqPreview(input))!==JSON.stringify(input.p_expected))throw new Error('Preview changed. Review again')
 if(!input.p_product_ids?.length||(!input.p_factory_ids?.length&&!input.p_pending_factories?.length))throw new Error('Select products and factories')
 if(new Set(input.p_product_ids).size!==input.p_product_ids.length||new Set(input.p_factory_ids).size!==input.p_factory_ids.length)throw new Error('Duplicate selections')
 if(input.p_product_ids.some(id=>!snapshot.deal_products.some(p=>p.id===id&&p.deal_id===input.p_deal_id)))throw new Error('Products do not belong to this deal')
 if(input.p_factory_ids.some(id=>!snapshot.factories.some(f=>f.id===id&&f.basic_info_completed)))throw new Error('Factories missing or basic information incomplete')
 const rfq={id:randomUUID(),deal_id:input.p_deal_id,product_ids:input.p_product_ids,rfq_number:`RFQ-202609-${String(snapshot.rfq_requests.length+1).padStart(3,'0')}`,request_message:input.p_message,response_deadline:input.p_deadline,status:'open',created_by:IDs.user,created_at:now}
 snapshot.rfq_requests.push(rfq)
 const recipients=[...input.p_factory_ids.map(id=>({factoryId:id,factory:snapshot.factories.find(f=>f.id===id)})),...(input.p_pending_factories||[]).map(f=>({factoryId:null,factory:{factory_name:f.name,contact_email:f.email}}))]
 const invitations=recipients.map(({factoryId,factory},index)=>{
  const inv={id:randomUUID(),rfq_id:rfq.id,factory_id:factoryId,factory_name_pending:factoryId?null:factory.factory_name,factory_email_pending:factoryId?null:factory.contact_email,invitation_sent_at:null,created_at:now}
  snapshot.rfq_factory_invitations.push(inv)
  if(failure==='rfq_form'&&index===1){failure=null;throw new Error('Local forced second form failure')}
  const requested_lines=snapshot.deal_product_variants.filter(v=>snapshot.deal_products.some(p=>input.p_product_ids.includes(p.id)&&p.id===v.product_id)).map(v=>({...v,variant_id:v.id,product_description:snapshot.deal_products.find(p=>p.id===v.product_id).description,quantities:[...new Set(snapshot.deal_quotes.filter(q=>q.variant_id===v.id&&q.quantity>0).map(q=>q.quantity))]}))
  const context=input.p_selection?{schema_version:2,requested_lines:input.p_expected.requested_lines,request_message:input.p_expected.request_message,response_deadline:input.p_expected.response_deadline,recipient:{name:factory.factory_name,email:factory.contact_email||''}}:{requested_lines}
  const form={context,id:randomUUID(),form_type:'rfq_response',token:randomUUID().replaceAll('-','')+randomUUID().replaceAll('-',''),related_id:inv.id,status:'pending',created_by:IDs.user,expires_at:new Date(Date.now()+7*86400000).toISOString()}
  snapshot.external_forms.push(form);inv.external_form_id=form.id
  return {invitationId:inv.id,factoryId,factoryName:factory.factory_name,formToken:form.token}
 })
 const result={rfqId:rfq.id,rfqNumber:rfq.rfq_number,invitations}
 snapshot.rfq_creation_requests.push({request_id:input.p_request_id,created_by:IDs.user,payload,result})
 db=snapshot
 return result
}

function workflowRpc(name,input) {
 const staff=['sales','admin'].includes(db.profiles[0].role), logistics=db.profiles[0].role==='logistics'
 if(name==='ext_form_by_token')return db.external_forms?.find(f=>f.token===input.p_token)||null
 if(name==='ext_rfq_context'){
  const f=db.external_forms?.find(f=>f.token===input.p_token),inv=db.rfq_factory_invitations?.find(i=>i.id===f?.related_id),rfq=db.rfq_requests.find(r=>r.id===inv?.rfq_id)
  if(!f||f.status!=='pending'||!rfq)return {error:'Unavailable form'}
  return {schema_version:f.context?.schema_version||1,rfq:f.context?.schema_version===2?{...rfq,request_message:f.context.request_message,response_deadline:f.context.response_deadline}:rfq,products:db.deal_products.filter(p=>rfq.product_ids.includes(p.id)).map(p=>({...p,variants:(f.context?.requested_lines||[]).filter(l=>l.product_id===p.id).map(l=>({...l,id:l.variant_id,label:l.variant_label,requested_quantities:l.quantities}))}))}
 }
 if(name==='ext_submit_rfq'){
  const f=db.external_forms?.find(f=>f.token===input.p_token),inv=db.rfq_factory_invitations?.find(i=>i.id===f?.related_id),rfq=db.rfq_requests.find(r=>r.id===inv?.rfq_id)
  if(!f||!inv||!rfq)throw new Error('Unavailable form')
  if(f.status==='submitted'){if(JSON.stringify(f.submission_data)===JSON.stringify(input.p_payload))return {success:true};throw new Error('Already submitted')}
  if(inv.factory_id)for(const line of input.p_payload.products){
   const quantities=f.context.schema_version===2?[line.quantity]:f.context.requested_lines.find(l=>l.variant_id===line.variant_id).quantities
   for(const quantity of quantities)db.deal_quotes.push({id:randomUUID(),deal_id:rfq.deal_id,variant_id:line.variant_id,factory_id:inv.factory_id,quantity,moq:line.moq,factory_unit_price_usd:line.unit_price_usd,status:'drafting',source_type:'rfq_response',version:db.deal_quotes.length+1,factory_response:{line,invitation_id:inv.id}})
  }
  inv.responded_at=now;f.submitted_at=now;f.status='submitted';f.submission_data=input.p_payload;rfq.status='fully_responded';return {success:true,deal_id:rfq.deal_id}
 }
 if(name==='portal_factory_rfqs')return (db.rfq_factory_invitations||[]).filter(i=>i.factory_id===db.profiles[0].factory_id).map(inv=>{const r=db.rfq_requests.find(r=>r.id===inv.rfq_id),f=db.external_forms.find(f=>f.id===inv.external_form_id);return {invitation_id:inv.id,rfq_number:r.rfq_number,response_deadline:r.response_deadline,request_message:r.request_message,responded_at:inv.responded_at,form_token:f.token,form_status:f.status,product_count:r.product_ids.length}})
 if(name==='portal_my_deals')return db.deals.filter(d=>d.client_id===db.profiles[0].client_id)
 if(name==='create_factory_order_atomic'){
  if(!staff)throw new Error('Staff only');db.factory_purchase_orders ||= []
  const old=db.factory_purchase_orders.find(o=>o.source_quote_id===input.p_quote_id);if(old)return {success:true,orderId:old.id,dealId:old.deal_id}
  const q=db.deal_quotes.find(q=>q.id===input.p_quote_id),d=db.deals.find(d=>d.id===q?.deal_id),v=db.deal_product_variants.find(v=>v.id===q?.variant_id),p=db.deal_products.find(p=>p.id===v?.product_id)
  if(q?.status!=='approved')throw new Error('Adopt quote first')
  const order={id:randomUUID(),order_no:input.p_order_no,source_quote_id:q.id,deal_id:q.deal_id,factory_id:input.p_factory_id,quantity:q.quantity,unit_price_usd:q.factory_unit_price_usd,expected_delivery_date:d.desired_delivery_date,status:'ordered',created_at:now,snapshot:{item_name:p.description,pcs_per_carton:q.factory_response?.line?.pcs_per_carton||v.pcs_per_carton},factory:db.factories.find(f=>f.id===input.p_factory_id)};db.factory_purchase_orders.push(order);return {success:true,orderId:order.id,dealId:d.id}
 }
 if(name==='create_inbound_shipment_atomic'){
  if(!staff&&!logistics)throw new Error('Warehouse or staff only');const p=input.p_input
  const prior=db.inbound_shipments.find(s=>p.request_key&&s.request_key===p.request_key);if(prior)return {success:true,shipmentId:prior.id}
  const deal=db.deals.find(d=>d.id===p.deal_id);db.inbound_shipment_items ||= []
  const shipment={id:randomUUID(),shipment_no:input.p_shipment_no,client_id:p.client_id||deal?.client_id,deal_id:p.deal_id,status:'in_transit',created_at:now,...p};delete shipment.lines
  db.inbound_shipments.push(shipment);p.lines.forEach(line=>db.inbound_shipment_items.push({id:randomUUID(),shipment_id:shipment.id,received_quantity:null,...line}));return {success:true,shipmentId:shipment.id}
 }
 if(name==='receive_inbound_shipment_atomic'){
  if(!staff&&!logistics)throw new Error('Warehouse or staff only');const s=db.inbound_shipments.find(s=>s.id===input.p_shipment_id);if(s.status==='received')return {success:true}
  for(const r of input.p_received){const line=db.inbound_shipment_items.find(l=>l.id===r.line_id);const item={id:randomUUID(),client_id:s.client_id,deal_id:s.deal_id,item_name:line.item_name,unit:'個',quantity_on_hand:r.received_quantity,cartons_on_hand:line.expected_cartons,created_at:now,updated_at:now};db.inventory_items.push(item);line.item_id=item.id;line.received_quantity=r.received_quantity;db.inventory_transactions.push({id:randomUUID(),item_id:item.id,tx_type:'inbound',quantity_delta:r.received_quantity,created_at:now})}s.status='received';return {success:true}
 }
 if(name==='create_shipment_request_atomic'){
  const p=input.p_input;const clientId=staff?p.client_id:db.profiles[0].client_id;db.shipment_request_items ||= []
  const request={id:randomUUID(),request_no:input.p_request_no,client_id:clientId,status:'requested',created_at:now,...p};delete request.items;db.shipment_requests.push(request);p.items.forEach(i=>db.shipment_request_items.push({id:randomUUID(),request_id:request.id,...i}));return {success:true}
 }
 if(name==='ship_shipment_request_atomic'){
  if(!staff&&!logistics)throw new Error('Warehouse or staff only');const r=db.shipment_requests.find(r=>r.id===input.p_request_id);if(r.status==='shipped')return {success:true};if(r.status!=='confirmed')throw new Error('Confirmation required')
  db.shipment_request_items.filter(i=>i.request_id===r.id).forEach(line=>{const item=db.inventory_items.find(i=>i.id===line.item_id);if(item.quantity_on_hand<line.quantity)throw new Error('Insufficient inventory');item.quantity_on_hand-=line.quantity;db.inventory_transactions.push({id:randomUUID(),item_id:item.id,tx_type:'outbound',quantity_delta:-line.quantity,destination:r.destination_name,created_at:now})});r.status='shipped';r.shipped_at=now;return {success:true}
 }
 throw new Error('Unhandled local RPC')
}

function issueDocumentAtomic(input){
 if(!['admin','sales'].includes(db.profiles[0]?.role))throw new Error('Sales or administrator access required')
 const snapshot=structuredClone(db);snapshot.document_issue_requests ||= []
 const payload={deal_id:input.p_deal_id,type:input.p_type,metadata:input.p_metadata,snapshot:input.p_snapshot}
 const saved=snapshot.document_issue_requests.find(r=>r.request_id===input.p_request_id)
 if(saved){if(saved.created_by!==IDs.user||JSON.stringify(saved.payload)!==JSON.stringify(payload))throw new Error('Request ID was already used with different input or snapshot');return snapshot.documents.find(d=>d.id===saved.document_id)}
 if(input.p_deal_id&&!snapshot.deals.some(d=>d.id===input.p_deal_id&&!d.archived_at))throw new Error('Deal not found or archived')
 if(input.p_deal_id&&input.p_type!=='rfq'&&!input.p_snapshot.quotes.some(q=>q.status==='approved'&&q.quantity>0))throw new Error('Valid approved quotations are required')
 const row={id:randomUUID(),deal_id:input.p_deal_id,document_type:input.p_type,document_number:`${({quotation:'QUO',invoice:'INV',delivery_note:'DLV',rfq:'RFQ',inventory_cert:'CRT'})[input.p_type]}-202609-${String(number).padStart(3,'0')}`,version:1,metadata:{...input.p_metadata,snapshot_version:1,snapshot:input.p_snapshot},issued_at:now,issued_by_user_id:IDs.user,created_at:now}
 snapshot.documents.push(row)
 if(failure==='docissue'){failure=null;throw new Error('Local forced document ledger failure')}
 snapshot.document_issue_requests.push({request_id:input.p_request_id,created_by:IDs.user,payload,document_id:row.id})
 number++;db=snapshot
 return row
}
