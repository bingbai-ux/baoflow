import {listStorageBills} from '@/lib/actions/storage-billing'
import {PortalShell} from '@/components/external/portal-shell'
import Link from 'next/link'
export default async function PortalInvoices(){
 const {data,error}=await listStorageBills()
 return <PortalShell title="保管料請求書" loginPath="/portal/login" userLabel={null}>
  <Link href="/portal" className="underline text-[12px]">在庫・出荷依頼へ戻る</Link>
  <h1 className="text-[20px] font-bold mt-4 mb-3">保管料請求書</h1>
  {error?<p role="alert">{error}</p>:data.length===0?<p>発行済みの保管料請求書はありません。</p>:data.map(b=><div key={b.id} className="bg-white border border-[#E2E1DA] rounded-[16px] p-4 mb-3 text-[13px]">
   <p>{b.billing_month} / ¥{Number(b.total_amount).toLocaleString('ja-JP')} / {b.snapshot?.document_number||'旧請求'}</p>
   {b.snapshot?<><p>支払期限 {b.snapshot.input.due_date}</p><a href={`/api/storage-invoices/${b.id}/pdf`} target="_blank" rel="noreferrer" className="underline inline-flex items-center min-h-[44px]">請求書PDFを確認</a></>:<p>元の請求書は担当者へお問い合わせください。</p>}
  </div>)}
 </PortalShell>
}
