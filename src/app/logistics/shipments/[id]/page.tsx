import Link from 'next/link'
import {getShipmentWorkflow} from '@/lib/actions/shipment-workflow'
import {ShipmentPanel} from '@/components/shipping/shipment-panel'
import {PortalShell} from '@/components/external/portal-shell'
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params,c=await getShipmentWorkflow(id);return <PortalShell title="輸送・食品検査" loginPath="/logistics/login" userLabel={null}><Link href="/logistics" className="min-h-11 inline-flex items-center underline">一覧へ戻る</Link><h1 className="text-[21px] font-extrabold my-3">輸送・食品検査</h1>{c?.actor==='logistics'?<ShipmentPanel context={c}/>:<p role="alert">この配送を確認できません。自社・担当のアカウントと発送計画を営業へ確認してください。</p>}</PortalShell>}
