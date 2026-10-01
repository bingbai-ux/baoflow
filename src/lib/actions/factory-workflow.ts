'use server'
import {createClient} from '@/lib/supabase/server'
import {revalidatePath} from 'next/cache'
import type {FactoryWorkflowContext} from '@/lib/factory-workflow/types'
export async function getFactoryWorkflow(orderId:string):Promise<FactoryWorkflowContext|null>{
 const db=await createClient(),{data,error}=await db.rpc('factory_order_context',{p_order_id:orderId});return error||!data?null:data as FactoryWorkflowContext
}
export async function factoryWorkflowCommand(requestId:string,orderId:string,operation:string,input:Record<string,unknown>){
 const db=await createClient(),{data:{user},error:authError}=await db.auth.getUser();if(authError||!user)return {error:'ログインしてください'}
 const {data,error}=await db.rpc('factory_workflow_command',{p_request_id:requestId,p_order_id:orderId,p_operation:operation,p_input:input})
 if(error||!data)return {error:error?.message.includes('bank changed')?'登録銀行情報が変わりました。送金指示を止め、登録元と条件を再確認してください':error?.message.includes('upfront receipt')?'工場の前払着金確認が必要です。営業の送金記録だけでは製造を開始できません':error?.message.includes('differs from PO')?'確定額が発注書と異なります。採用見積・発注の改訂へ戻ってください':'保存を確認できません。同じ内容で再試行し、条件版・銀行照合・権限を確認してください'}
 revalidatePath('/factory');revalidatePath(`/factory/orders/${orderId}`);revalidatePath('/deals');return {result:data as Record<string,unknown>}
}
