import Link from 'next/link'
import {notFound} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import {requireSalesAccess} from '@/lib/actions/deal-access'
import {listFactoryOrders} from '@/lib/actions/factory-orders'
import {getShipmentWorkflow} from '@/lib/actions/shipment-workflow'
import {ShipmentPanel} from '@/components/shipping/shipment-panel'
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{order?:string}>}){
 const {id}=await params,{order}=await searchParams,db=await createClient();if(await requireSalesAccess(db))notFound()
 const {orders,error}=await listFactoryOrders(id),selected=order?orders.find(o=>o.id===order):orders[0],c=selected?await getShipmentWorkflow(selected.id):null
 return <><Link className="inline-flex min-h-11 items-center underline" href={`/deals/${id}`}>案件へ戻る</Link><h1 className="text-[21px] font-extrabold my-3">発送・物流・顧客受領</h1><nav className="flex flex-wrap gap-2 mb-4" aria-label="発注を選択">{orders.map(o=><Link key={o.id} className="min-h-11 inline-flex items-center rounded-full border border-[#E2E1DA] px-3" href={`/deals/${id}/shipping?order=${o.id}`}>{o.order_no}</Link>)}</nav>{error?<p role="alert">発注を取得できません。再読込してください。</p>:order&&!selected?<p role="alert">指定の発注はこの案件に属していません。</p>:!selected?<p>正式発注がありません。採用見積から発注し、製造・QCを確認してください。</p>:c?.actor==='staff'?<ShipmentPanel context={c}/>:<p role="alert">配送履歴を確認できません。再読込してください。</p>}</>
}
