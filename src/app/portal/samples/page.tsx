import Link from 'next/link'
import {PortalShell} from '@/components/external/portal-shell'
import {SearchableCollection} from '@/components/ui/searchable-collection'
import {listOwnSampleInvoices} from '@/lib/actions/sample-ledger'
export default async function SampleInvoices(){
 const {data,error}=await listOwnSampleInvoices()
 return <PortalShell title="サンプル費用請求書" loginPath="/portal/login" userLabel={null}>
 <Link href="/portal" className="underline inline-flex min-h-11 items-center">お客様ページへ戻る</Link>
 <h1 className="text-xl font-bold my-3">サンプル費用請求書</h1>
 <p className="text-xs text-[#84787D] mb-3">自社宛の請求額・数量・支払期限を確認し、PDFを取得してください。量産代金とは別の請求です。</p>
 {error?<p role="alert">{error}。再読込しても解消しない場合は営業担当者にお問い合わせください。</p>:<SearchableCollection label="案件番号・請求番号で検索" empty={<p className="border border-[#E2E1DA] rounded-card bg-white p-4">閲覧できるサンプル請求書はありません。発行状況は営業担当者にお問い合わせください。</p>} rows={[...data].sort((a,b)=>Number(b.status==='issued')-Number(a.status==='issued')).map(b=>({id:b.id,text:[b.document_number,b.snapshot.deal_code,b.snapshot.deal_name].join(' '),content:<article className="border border-[#E2E1DA] rounded-card bg-white p-4 text-sm">
 <div className="flex flex-wrap justify-between gap-2"><h2 className="font-bold">{b.snapshot.deal_code} / {b.document_number}</h2><span>{b.status==='issued'?'発行済み':'取消済み・履歴用'}</span></div>
 <p className="text-xl font-bold fc-num my-2">¥{Number(b.snapshot.total).toLocaleString('ja-JP')}</p><p>発行日 {b.snapshot.issue_date} / 支払期限 {b.snapshot.due_date}</p>
 {b.status!=='issued'&&<p className="text-xs mt-2">お支払いには使用せず、現在の有効な請求書を確認してください。</p>}
 <a href={`/api/sample-invoices/${b.id}/pdf`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center border rounded-full border-[#E2E1DA] px-4 mt-3">{b.status==='issued'?'請求書PDFを確認':'取消済みPDFを閲覧'}</a>
 </article>}))}/>}
 </PortalShell>
}
