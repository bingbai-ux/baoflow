import Link from 'next/link'
import {redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import {PortalShell} from '@/components/external/portal-shell'
import {SearchableCollection} from '@/components/ui/searchable-collection'
import type {FinanceSnapshot} from '@/components/deals/client-finance-panel'
export default async function ClientDocuments(){
 const db=await createClient(),{data:{user}}=await db.auth.getUser();if(!user)redirect('/portal/login')
 const {data:profile,error:profileError}=await db.from('profiles').select('role,client_id').eq('id',user.id).single()
 if(profileError||profile?.role!=='client'||!profile.client_id)redirect('/portal')
 const {data,error}=await db.from('client_document_packets').select('id,document_type,snapshot').eq('client_id',profile.client_id).eq('status','active').order('created_at',{ascending:false})
 return <PortalShell title="見積承認・請求" loginPath="/portal/login" userLabel={null}><Link href="/portal" className="inline-flex min-h-11 items-center underline">在庫・出荷へ戻る</Link><h1 className="text-[21px] font-extrabold my-3">見積承認・請求</h1>{error?<p role="alert">帳票を読み込めません。再読込しても解消しない場合は営業担当へお問い合わせください。</p>:<SearchableCollection label="案件・帳票番号で検索" empty={<p className="rounded-card border border-[#E2E1DA] p-4">共有された帳票はありません。見積・請求の予定は営業担当へお問い合わせください。</p>} rows={(data||[]).map(p=>{const s=p.snapshot as FinanceSnapshot;return {id:p.id,text:`${s.deal_name} ${s.number}`,content:<article className="rounded-card border border-[#E2E1DA] bg-white p-4"><h2 className="font-bold">{s.deal_name}</h2><p>{p.document_type==='quotation'?'見積内容を確認・回答':'請求内容を確認・入金申告'} · {s.number}</p><p className="text-[24px] font-extrabold num">¥{Number(s.total).toLocaleString('ja-JP')}</p>{s.due_date&&<p>支払期限 {s.due_date}</p>}<Link href={`/portal/documents/${p.id}`} className="inline-flex min-h-11 items-center underline">内容・回答状況を確認する</Link></article>}})}/>}</PortalShell>
}
