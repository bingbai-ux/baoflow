import Link from 'next/link'
import {notFound,redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import {requireSalesAccess} from '@/lib/actions/deal-access'
import {listFactoryOrders} from '@/lib/actions/factory-orders'
import {getFactoryWorkflow} from '@/lib/actions/factory-workflow'
import {FactoryWorkflowPanel} from '@/components/deals/factory-workflow-panel'
import {getFactoryQc} from '@/lib/actions/factory-qc'
import {FactoryQcPanel} from '@/components/deals/factory-qc-panel'
export default async function ProductionPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{order?:string}>}){
 const {id}=await params,{order}=await searchParams,db=await createClient(),{data:{user}}=await db.auth.getUser();if(!user)redirect('/login');if(await requireSalesAccess(db))notFound()
 const {data:deal}=await db.from('deals').select('id,deal_name,deal_code').eq('id',id).single();if(!deal)notFound()
 const {orders,error}=await listFactoryOrders(id),selected=order?orders.find(o=>o.id===order):orders[0],context=selected?await getFactoryWorkflow(selected.id):null
 const qc=context?.production?await getFactoryQc(context.order.id):null
 return <><Link href={`/deals/${id}`} className="inline-flex min-h-11 items-center underline">案件へ戻る</Link><p className="text-[12px]">{deal.deal_code} · {deal.deal_name}</p><h1 className="text-[21px] font-extrabold my-3">工場条件・支払記録・製造開始</h1><nav aria-label="発注を選択" className="flex flex-wrap gap-2 mb-4">{orders.map(o=><Link className={`min-h-11 inline-flex items-center rounded-full border border-[#E2E1DA] px-3 ${selected?.id===o.id?'bg-[#D7EFFF] text-[#33566F]':'bg-white'}`} href={`/deals/${id}/production?order=${o.id}`} key={o.id}>{o.order_no}</Link>)}</nav>{error?<p role="alert">発注履歴を確認できません。再読込してください。</p>:order&&!selected?<p role="alert">指定の発注はこの案件に属していません。上の発注一覧から選択してください。</p>:!selected?<p className="rounded-card border border-[#E2E1DA] p-4">正式な工場発注がありません。案件へ戻り、顧客承認・実着金・採用見積を確認して発注してください。</p>:!context?<p role="alert">条件・支払履歴を確認できません。再読込してください。旧発注の閲覧は案件画面で維持しています。</p>:context.production?<>{qc?<FactoryQcPanel workflow={context} qc={qc}/>:<p role="alert">QC履歴を確認できません。再読込してください。</p>}<details id="factory-finance" className="rounded-card border border-[#E2E1DA] p-4 mt-4"><summary className="min-h-11 font-bold cursor-pointer">工場条件・支払・製造開始の記録</summary><FactoryWorkflowPanel context={context}/></details></>:<FactoryWorkflowPanel context={context}/>}</>
}
