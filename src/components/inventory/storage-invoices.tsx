'use client'
import {useEffect,useState,useTransition} from 'react'
import {listStorageBills,issueStorageInvoice,emailStorageInvoice,type StorageBill} from '@/lib/actions/storage-billing'
import {storageInvoiceAmounts,validateStorageInvoice,type StorageInvoiceInput} from '@/lib/utils/storage-invoice'
import {useWorkflowRequest} from '@/lib/hooks/use-workflow-request'
import {useUi} from '@/components/ui/ui-store'

const fields=[['cartons','請求対象カートン数'],['monthly_rate','保管単価（円/CTN・月）'],['in_count','入庫回数'],['in_rate','入庫単価（円/回）'],['out_count','出庫回数'],['out_rate','出庫単価（円/回）'],['tax_rate','消費税率（%）']] as const
const control='w-full rounded-[10px] border border-[#E2E1DA] bg-white p-2 text-[12px] min-h-[44px]'
const button='rounded-full min-h-[44px] px-4 text-[12px] font-bold border border-[#E2E1DA] disabled:opacity-40'
export function StorageInvoices({clients}:{clients:{id:string;company_name:string;email?:string|null}[]}){
 const {toast}=useUi(),recovery=useWorkflowRequest('storage-invoice','storage_invoice')
 const [pending,start]=useTransition(),[bills,setBills]=useState<StorageBill[]>([]),[error,setError]=useState<string|null>(null)
 const [clientId,setClient]=useState(''),[sendBill,setSendBill]=useState<StorageBill|null>(null)
 const [text,setText]=useState({month:'',issue_date:'',due_date:'',cartons:'',monthly_rate:'',in_count:'0',in_rate:'0',out_count:'0',out_rate:'0',tax_rate:'',recipient:'',payment_details:'',basis:''})
 const [method,setMethod]=useState<'end_of_month'|'mid_month_avg'>('end_of_month'),[confirmed,setConfirmed]=useState(false)
 useEffect(()=>{let active=true;void listStorageBills().then(r=>{if(active){setBills(r.data);setError(r.error)}}).catch(()=>{if(active)setError('請求履歴を確認できません')});return()=>{active=false}},[])
 const input:StorageInvoiceInput={...text,cartons:Number(text.cartons),monthly_rate:Number(text.monthly_rate),in_count:Number(text.in_count),in_rate:Number(text.in_rate),out_count:Number(text.out_count),out_rate:Number(text.out_rate),tax_rate:Number(text.tax_rate),method,confirmed}
 let total='—';try{if(fields.every(([k])=>text[k]!==''&&Number(text[k])>=0))total=storageInvoiceAmounts(input).total.toLocaleString('ja-JP')}catch{/* incomplete input remains uncalculated */}
 const refresh=async()=>{const r=await listStorageBills();setBills(r.data);setError(r.error)}
 const issue=()=>start(async()=>{
  const invalid=validateStorageInvoice(input)
  if(!clientId||fields.some(([k])=>text[k]==='')||invalid){toast(invalid||'クライアント・数量・単価を入力してください','warn');return}
  try{const request=await recovery.requestId({clientId,input}),r=await issueStorageInvoice(request,clientId,input)
   if(r.error||!r.data){toast(r.error||'発行結果を確認できません','warn');await refresh();return}
   recovery.complete();setConfirmed(false);toast('保管請求書を発行しました');await refresh()
  }catch{toast('発行結果を確認できません。再読込して履歴を確認してください','warn')}
 })
 return <section className="space-y-3 mt-6">
  <h2 className="text-[16px] font-bold text-[#351E28]">保管料請求書</h2>
  <p className="text-[12px] text-[#84787D]">倉庫台帳で確定した月末量または月中平均量・契約料金を入力してください。上の現在庫概算から過去の請求量は復元しません。クライアント・月につき1回発行し、保存後の内容は変更しません。</p>
  {(error||recovery.error)&&<p role="alert" className="text-[#B03616] text-[12px]">{error||recovery.error}</p>}
  {recovery.recovered&&<p role="status" className="text-[12px]">前回の請求書は保存済みです。<a className="underline ml-2" target="_blank" rel="noreferrer" href={`/api/storage-invoices/${recovery.recovered.id}/pdf`}>PDFを確認</a><button className={`${button} ml-2`} onClick={recovery.complete}>新しい発行を始める</button></p>}
  <div className="bg-white border border-[#E2E1DA] rounded-[16px] p-4 space-y-3">
   <label className="block text-[12px]">クライアント<select className={control} value={clientId} onChange={e=>{setClient(e.target.value);setConfirmed(false);setText(t=>({...t,recipient:clients.find(c=>c.id===e.target.value)?.email||''}))}} disabled={pending}><option value="">選択してください</option>{clients.map(c=><option key={c.id} value={c.id}>{c.company_name}</option>)}</select></label>
   <div className="grid gap-3 sm:grid-cols-3">{(['month','issue_date','due_date'] as const).map((key,n)=><label key={key} className="text-[12px]">{['請求対象月','発行日','支払期限'][n]}<input className={control} type={key==='month'?'month':'date'} value={text[key]} onChange={e=>{setConfirmed(false);setText(t=>({...t,[key]:e.target.value}))}} disabled={pending}/></label>)}</div>
   <label className="block text-[12px]">算定方式<select className={control} value={method} onChange={e=>{setMethod(e.target.value as typeof method);setConfirmed(false)}} disabled={pending}><option value="end_of_month">月末確定量</option><option value="mid_month_avg">月中平均確定量</option></select></label>
   <div className="grid gap-3 sm:grid-cols-3">{fields.map(([key,label])=><label key={key} className="text-[12px]">{label}<input className={control} type="number" min="0" step="0.0001" value={text[key]} onChange={e=>{setConfirmed(false);setText(t=>({...t,[key]:e.target.value}))}} disabled={pending}/></label>)}</div>
   {(['basis','payment_details','recipient'] as const).map((key,n)=><label className="block text-[12px]" key={key}>{['算定根拠（倉庫台帳・契約の確認内容）','振込先','送付先メール'][n]}<input className={control} maxLength={key==='recipient'?254:500} type={key==='recipient'?'email':'text'} value={text[key]} onChange={e=>{setConfirmed(false);setText(t=>({...t,[key]:e.target.value}))}} disabled={pending}/></label>)}
   <p className="text-[15px] font-bold">合計（税込） ¥{total}</p><p className="text-[11px] text-[#84787D]">各項目・消費税の円未満を切り捨て。未登録の振込先や料金を自動補完しません。</p>
   <label className="flex gap-2 text-[12px] items-center min-h-[44px]"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} disabled={pending}/>対象量・料金・期間・宛先・振込先を確認しました</label>
   <button type="button" className={`${button} bg-[#E9F056]`} onClick={issue} disabled={!recovery.ready||!!recovery.recovered||pending||!confirmed}>確認した内容で請求書を発行</button>
  </div>
  <div role="list" aria-label="保管請求履歴" className="space-y-2">{bills.map(b=><div role="listitem" aria-label={b.snapshot?.document_number||`${b.billing_month}の旧請求`} key={b.id} className="rounded-[16px] border border-[#E2E1DA] bg-white p-3 flex flex-wrap items-center gap-3 text-[12px]">
   <span>{b.snapshot?.client.name||clients.find(c=>c.id===b.client_id)?.company_name||'旧請求'} / {b.billing_month} / ¥{Number(b.total_amount).toLocaleString('ja-JP')}</span>
   <span>{b.email_status?({accepted:'メールサービス受理済み',attempting:'送信処理中または結果未確認・再送停止',unknown:'送信結果不明・再送停止',rejected:'送信拒否・再送停止'}[b.email_status]):'未送信'}</span>
   {b.snapshot?<><a className={`${button} inline-flex items-center`} target="_blank" rel="noreferrer" href={`/api/storage-invoices/${b.id}/pdf`}>PDFを確認</a><button className={button} disabled={pending} onClick={()=>setSendBill(b)}>送付先を確認</button></>:<span>旧請求のsnapshotなし・元資料を確認</span>}
  </div>)}</div>
  {sendBill&&<div role="dialog" aria-label="請求書メールの確認" className="rounded-[16px] border border-[#351E28] bg-[#FBFAF6] p-4 space-y-2 text-[12px]">
   <p>{sendBill.snapshot.document_number} / 宛先 {sendBill.snapshot.input.recipient}</p><p>¥{sendBill.snapshot.total.toLocaleString('ja-JP')} / 支払期限 {sendBill.snapshot.input.due_date} / PDF添付</p>
   <button className={`${button} bg-[#E9F056]`} disabled={pending} onClick={()=>start(async()=>{try{const r=await emailStorageInvoice(sendBill.id);toast(r.error||'メールサービスで受理されました。到達は履歴で確認してください',r.error?'warn':undefined);if(!r.error)setSendBill(null);await refresh()}catch{toast('送信結果を確認できません。メール履歴を確認してください','warn')}})}>この宛先へPDFを送信</button>
   <button className={`${button} ml-2`} disabled={pending} onClick={()=>setSendBill(null)}>閉じる</button>
  </div>}
 </section>
}
