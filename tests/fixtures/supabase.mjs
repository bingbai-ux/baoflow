// Local-only PostgREST/Auth fixture. Contains synthetic data and accepts no external URLs.
import http from 'node:http'
import { randomUUID } from 'node:crypto'
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
 if(url.pathname==='/__fail'){failure=input.table;send({ok:true});return}
 if(url.pathname==='/__state'){send(db);return}
 if(url.pathname==='/auth/v1/user'){send(user);return}
 if(url.pathname.startsWith('/auth/v1/')){send({user,access_token:'fixture',expires_in:3600,token_type:'bearer'});return}
 const table=url.pathname.split('/').pop()
 if(failure===table){failure=null;send({code:'XX000',message:'Local simulated database failure'},500);return}
 if(url.pathname.includes('/rpc/')){
 
  if(table==='select_quote_atomic') {const q=db.deal_quotes.find(q=>q.id===input.p_quote_id);if(q){db.deal_quotes.filter(x=>x.variant_id===q.variant_id).forEach(x=>x.status='draft');q.status='approved'}send({success:true,deal_id:q?.deal_id});return}
  if(table==='reserve_document_number'){send(`${({quotation:'QUO',invoice:'INV',delivery_note:'DLV',rfq:'RFQ',inventory_cert:'CRT'})[input.p_type]||'QUO'}-202609-${String(number++).padStart(3,'0')}`);return}
  if(table==='set_deal_simple_status'){const d=db.deals.find(d=>d.id===input.p_deal_id);d.simple_status=input.p_to;db.deal_status_history.push({id:randomUUID(),deal_id:d.id,to_simple_status:input.p_to,changed_at:now,kind:'status'});send(null);return}
  send(null);return
 }
 if(!db[table])db[table]=[]
 let rows=db[table].filter(row=>{for(const [key,value]of url.searchParams){if(['select','order','limit','offset','on_conflict'].includes(key))continue;let actual=key.split('.').reduce((obj,k)=>obj?.[k],row);if(value.startsWith('eq.')&&String(actual)!==value.slice(3))return false;if(value==='is.null'&&actual!=null)return false;if(value==='not.is.null'&&actual==null)return false;if(value.startsWith('in.(')&&!value.slice(4,-1).split(',').includes(String(actual)))return false;if(value.startsWith('like.')&&!String(actual??'').startsWith(value.slice(5).replace('%','')))return false}return true})
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
