import Link from 'next/link'
import {redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import {getClientFinanceContext} from '@/lib/actions/client-finance'
import {PortalShell} from '@/components/external/portal-shell'
import {ClientFinanceResponse,FinanceSummary,type FinanceSnapshot} from '@/components/deals/client-finance-panel'
export const metadata={robots:{index:false,follow:false},referrer:'no-referrer' as const}
export default async function ClientDocument({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{token?:string}>}){
 const {id}=await params,{token}=await searchParams,db=await createClient(),{data:{user}}=await db.auth.getUser()
 // Do not put a financial link token into the login redirect or third-party referrer.
 if(!user)redirect('/portal/login')
 const context=await getClientFinanceContext(id,token??null)
 const history=!context&&!token?await db.from('client_document_packets').select('status,snapshot').eq('id',id).in('status',['superseded','cancelled']).maybeSingle():null
 return <PortalShell title="見積・請求の確認" loginPath="/portal/login" userLabel={null}><Link href="/portal/documents" className="inline-flex min-h-11 items-center underline">自社の帳票一覧へ戻る</Link><h1 className="text-[21px] font-extrabold my-3">見積・請求の確認</h1>{!context&&history?.data?<><p role="status" className="my-3">{history.data.status==='cancelled'?'取消済み':'旧版'}・支払や承認には使用しないでください。有効な版は帳票一覧で確認してください。</p><FinanceSummary snapshot={history.data.snapshot as FinanceSnapshot}/><a className="inline-flex min-h-11 items-center underline" href={`/api/client-documents/${id}/pdf`} target="_blank" rel="noreferrer">履歴PDFを確認</a></>:!context?<p role="alert" className="rounded-card border border-[#FF5C34] p-4">この帳票は確認できません。自社の顧客アカウントでログインしてください。期限切れ・取消・旧版の場合は帳票一覧から有効な版を確認し、営業担当へお問い合わせください。</p>:<ClientFinanceResponse packetId={id} token={token??null} snapshot={context.snapshot as FinanceSnapshot} decision={context.decision as string|null} confirmed={context.confirmed_jpy as string} reports={context.reports as {id:string;amount_jpy:string;paid_on:string;status:string}[]}/>}</PortalShell>
}
