import Link from 'next/link'
import {notFound,redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import {requireSalesAccess} from '@/lib/actions/deal-access'
import {getSampleLedger} from '@/lib/actions/sample-ledger'
import {SampleWorkbench} from '@/components/deals/sample-workbench'
export default async function SamplePage({params}:{params:Promise<{id:string}>}){
 const {id}=await params,db=await createClient(),{data:{user}}=await db.auth.getUser();if(!user)redirect('/login')
 if(await requireSalesAccess(db))notFound()
 const {data:deal}=await db.from('deals').select('id,deal_code,deal_name').eq('id',id).single();if(!deal)notFound()
 const ledger=await getSampleLedger(id)
 return <><Link href={`/deals/${id}`} className="inline-flex min-h-11 items-center underline">案件へ戻る</Link><p className="text-[11px] text-[#84787D]">{deal.deal_code} · {deal.deal_name}</p><h1 className="text-[21px] font-extrabold my-3">サンプル手配・費用請求</h1><SampleWorkbench dealId={id} ledger={ledger}/></>
}
