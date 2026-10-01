import {listStorageBills} from '@/lib/actions/storage-billing'
import {PortalShell} from '@/components/external/portal-shell'
import Link from 'next/link'
import {SearchableCollection} from '@/components/ui/searchable-collection'
export default async function PortalInvoices(){
 const {data,error}=await listStorageBills()
 return <PortalShell title="保管料請求書" loginPath="/portal/login" userLabel={null}>
  <Link href="/portal" className="underline text-[12px]">在庫・出荷依頼へ戻る</Link>
  <h1 className="text-[20px] font-bold mt-4 mb-3">保管料請求書</h1>
  <p className="text-[12px] text-[#84787D] mb-3">自社宛の発行済み請求書です。対象月・金額・支払期限を確認し、PDFを取得してください。入金状況は担当者へお問い合わせください。</p>
  {error?<p role="alert">履歴を読み込めません。再読込しても解消しない場合は担当者へお問い合わせください。</p>:<SearchableCollection label="請求月・帳票番号で検索" empty={<p className="rounded-card border border-[#E2E1DA] bg-white p-4 text-[13px]">発行済みの保管料請求書はありません。請求時期や内容は担当者へお問い合わせください。</p>}
    rows={data.map(b=>({id:b.id,text:[b.billing_month,b.snapshot?.document_number].join(' '),content:<article className="bg-white border border-[#E2E1DA] rounded-card p-4 text-[13px]">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold">{b.billing_month}の保管料</p><p className="text-[20px] fc-num font-bold mt-1">¥{Number(b.total_amount).toLocaleString('ja-JP')}</p></div><span className="fc-num text-[12px] text-[#84787D] break-all">{b.snapshot?.document_number||'旧請求'}</span></div>
      {b.snapshot?<><p className="mt-2">支払期限 {b.snapshot.input.due_date}</p><a href={`/api/storage-invoices/${b.id}/pdf`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center min-h-[44px] rounded-full border border-[#E2E1DA] px-4 font-bold">請求書PDFを確認</a></>:<p>元の請求書は担当者へお問い合わせください。</p>}
    </article>}))}/>}
 </PortalShell>
}
