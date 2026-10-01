'use server'
import {createClient} from '@/lib/supabase/server'
import {requireSalesAccess} from './deal-access'
import {createHash} from 'node:crypto'
import {revalidatePath} from 'next/cache'
import {validQcBytes,type QcAsset,type QcContext,type QcKind} from '@/lib/factory-workflow/qc-types'
export async function getFactoryQc(orderId:string):Promise<QcContext|null>{const db=await createClient(),{data,error}=await db.rpc('factory_qc_context',{p_order_id:orderId});return error||!data?null:data as QcContext}
export async function registerFactoryQcUpload(requestId:string,orderId:string,kind:QcKind,path:string,sha256:string){
 const db=await createClient(),workflow=await db.rpc('factory_order_context',{p_order_id:orderId})
 if(workflow.error||workflow.data?.actor_role!=='factory'||!workflow.data.production)return {error:'自社の製造開始済み注文のみ証跡を登録できます'}
 if(!/^[0-9a-f-]{36}$/i.test(requestId)||!['overall_photo','packing_photo','video'].includes(kind)||!new RegExp(`^${orderId}/${requestId}[.](png|jpg|mp4)$`).test(path)||!/^[0-9a-f]{64}$/.test(sha256))return {error:'証跡要求が一致しません'}
 const {data:file,error}=await db.storage.from('factory-qc').download(path);if(error||!file||file.size===0||file.size>52428800)return {error:'アップロードを確認できません。同じファイルで再試行してください'}
 const bytes=new Uint8Array(await file.arrayBuffer()),mime=file.type
 if((kind==='video'&&mime!=='video/mp4')||(kind!=='video'&&!['image/png','image/jpeg'].includes(mime))||!validQcBytes(bytes,mime)||createHash('sha256').update(bytes).digest('hex')!==sha256)return {error:'保存ファイルの形式・内容が一致しません。PNG/JPEG写真・MP4動画を確認してください'}
 const {data,error:saveError}=await db.rpc('factory_qc_command',{p_request_id:requestId,p_order_id:orderId,p_operation:'register_asset',p_input:{kind,object_path:path,sha256}})
 if(saveError||!data)return {error:'証跡の台帳保存を確認できません。同じファイル・要求で再試行してください'}
 revalidatePath(`/factory/orders/${orderId}`);return {result:data as Record<string,unknown>}
}
export async function factoryQcCommand(requestId:string,orderId:string,operation:'submit_qc'|'review_qc',input:Record<string,unknown>){
 const db=await createClient()
 if(operation==='review_qc'){
 const denied=await requireSalesAccess(db);if(denied)return {error:denied}
 if(input.decision==='approved'){
 const qc=await getFactoryQc(orderId),latest=qc?.submissions[0];if(!latest||latest.id!==input.submission_id)return {error:'最新の提出版を確認してください'}
 for(const id of latest.asset_ids){const a=qc!.assets.find(a=>a.id===id);if(!a)return {error:'必要証跡がありません'};const proof=await verifiedQcAsset(a);if(!proof)return {error:'証跡を取得・照合できません。欠損や変更を確認するまでQC承認できません'}}
 }
 }
 const {data,error}=await db.rpc('factory_qc_command',{p_request_id:requestId,p_order_id:orderId,p_operation:operation,p_input:input})
 if(error||!data)return {error:error?.message.includes('revised evidence')?'不承認後は修正した写真・動画を追加して、新しい提出版を確認してください':'保存を確認できません。全体写真・梱包写真・動画、完了数量・日付、最新提出版と権限を確認し、同じ要求で再試行してください'}
 revalidatePath(`/factory/orders/${orderId}`);revalidatePath('/deals');return {result:data as Record<string,unknown>}
}
async function verifiedQcAsset(a:QcAsset){const db=await createClient(),{data,error}=await db.storage.from('factory-qc').download(a.object_path);if(error||!data||data.size!==a.byte_size)return null;const bytes=new Uint8Array(await data.arrayBuffer());return validQcBytes(bytes,a.mime)&&createHash('sha256').update(bytes).digest('hex')===a.sha256?data:null}
export async function getQcAssetUrl(id:string){
 const db=await createClient(),{data:{user},error:authError}=await db.auth.getUser();if(authError||!user)return null
 const {data,error}=await db.from('factory_qc_assets').select('*').eq('id',id).maybeSingle();if(error||!data||!await verifiedQcAsset(data as QcAsset))return null
 const signed=await db.storage.from('factory-qc').createSignedUrl(data.object_path,60);return signed.error?null:signed.data.signedUrl
}
