import Link from 'next/link'
import {redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import {getFactoryWorkflow} from '@/lib/actions/factory-workflow'
import {FactoryWorkflowPanel} from '@/components/deals/factory-workflow-panel'
import {PortalShell} from '@/components/external/portal-shell'
export default async function FactoryOrderPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params,db=await createClient(),{data:{user}}=await db.auth.getUser();if(!user)redirect('/factory/login')
 const context=await getFactoryWorkflow(id)
 return <PortalShell title="工場発注・製造開始" loginPath="/factory/login" userLabel={null}><Link href="/factory" className="inline-flex min-h-11 items-center underline">工場の依頼・注文一覧へ戻る</Link><h1 className="text-[21px] font-extrabold my-3">工場発注・製造開始</h1>{context?.actor_role==='factory'?<FactoryWorkflowPanel context={context}/>:<p role="alert" className="rounded-card border border-[#FF5C34] p-4">この注文を確認できません。自社に紐付いた工場アカウントでログインし、営業へお問い合わせください。</p>}</PortalShell>
}
