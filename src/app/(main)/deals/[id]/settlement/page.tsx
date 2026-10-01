import Link from 'next/link'
import {notFound,redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import {requireSalesAccess} from '@/lib/actions/deal-access'
import {StaffFinancePanel,type FinancePacket,type FinanceReport,type FinanceReceipt} from '@/components/deals/client-finance-panel'
export default async function SettlementPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params,db=await createClient(),{data:{user}}=await db.auth.getUser();if(!user)redirect('/login')
 if(await requireSalesAccess(db))notFound()
 const {data:deal}=await db.from('deals').select('id,deal_code,deal_name').eq('id',id).single();if(!deal)notFound()
 const [docs,packets]=await Promise.all([db.from('documents').select('id,document_type,document_number').eq('deal_id',id).in('document_type',['quotation','invoice']).order('issued_at',{ascending:false}),db.from('client_document_packets').select('id,document_type,status,snapshot').eq('deal_id',id).order('created_at',{ascending:false})])
 const ids=(packets.data||[]).map(p=>p.id),reports=ids.length?await db.from('client_payment_reports').select('id,packet_id,amount_jpy,paid_on,reference,status').in('packet_id',ids).order('created_at'):{data:[],error:null}
 const receipts=ids.length?await db.from('client_payment_receipts').select('packet_id,amount_jpy').in('packet_id',ids):{data:[],error:null}
 return <><Link href={`/deals/${id}`} className="inline-flex min-h-11 items-center underline">案件へ戻る</Link><p className="text-[12px]">{deal.deal_code} · {deal.deal_name}</p><h1 className="text-[21px] font-extrabold my-3">顧客承認・請求・実着金確認</h1><Link href={`/deals/${id}/documents`} className="inline-flex min-h-11 items-center underline mb-3">帳票を発行・確認する</Link>{docs.error||packets.error||reports.error||receipts.error?<div role="alert" className="border border-[#FF5C34] rounded-card p-4">承認・入金履歴を読み込めません。再読込してください。既存帳票は上の帳票画面で確認できます。</div>:<StaffFinancePanel dealId={id} documents={docs.data||[]} packets={(packets.data||[]) as FinancePacket[]} reports={(reports.data||[]) as FinanceReport[]} receipts={(receipts.data||[]) as FinanceReceipt[]}/>}</>
}
