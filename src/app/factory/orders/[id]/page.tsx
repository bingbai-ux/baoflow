import Link from 'next/link'
import {redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import {getFactoryWorkflow} from '@/lib/actions/factory-workflow'
import {FactoryWorkflowPanel} from '@/components/deals/factory-workflow-panel'
import {PortalShell} from '@/components/external/portal-shell'
import {getFactoryQc} from '@/lib/actions/factory-qc'
import {FactoryQcPanel} from '@/components/deals/factory-qc-panel'
export default async function FactoryOrderPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params,db=await createClient(),{data:{user}}=await db.auth.getUser();if(!user)redirect('/factory/login')
 const context=await getFactoryWorkflow(id)
 const qc=context?.actor_role==='factory'&&context.production?await getFactoryQc(id):null
 return <PortalShell title="工場発注・製造・QC" loginPath="/factory/login" userLabel={null}><Link href="/factory" className="inline-flex min-h-11 items-center underline">工場の依頼・注文一覧へ戻る</Link><h1 className="text-[21px] font-extrabold my-3">工場発注・製造・QC</h1>{context?.actor_role==='factory'?context.production?<><p className="font-bold mb-3">{context.order.order_no} · {context.order.snapshot.item_name||'発注商品'}</p>{qc?<FactoryQcPanel workflow={context} qc={qc}/>:<p role="alert">QC履歴を確認できません。再読込してください。条件・支払履歴は下で確認できます。</p>}<details id="factory-finance" className="rounded-card border border-[#E2E1DA] p-4 mt-4"><summary className="min-h-11 font-bold cursor-pointer">工場条件・支払・製造開始の記録</summary><FactoryWorkflowPanel context={context}/></details></>:<FactoryWorkflowPanel context={context}/>:<p role="alert" className="rounded-card border border-[#FF5C34] p-4">この注文を確認できません。自社に紐付いた工場アカウントでログインし、営業へお問い合わせください。</p>}</PortalShell>
}
