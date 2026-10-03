'use server'
import {createClient} from '@/lib/supabase/server'
import {requireSalesAccess} from './deal-access'
import type {PricingRevisionInput} from '@/lib/calc/pricing-revision'
import {pricingReferenceRates} from '@/lib/utils/exchange-rate'
import {revalidatePath} from 'next/cache'
export async function previewPricingRevision(quoteId:string,input:PricingRevisionInput){
 const db=await createClient(),denied=await requireSalesAccess(db)
 if(denied)return {error:denied,preview:null}
 const {data,error}=await db.rpc('preview_quote_pricing_v2',{p_quote_id:quoteId,p_input:input})
 return error?{error:'入力・費目・手入力FXの根拠を確認してください',preview:null}:{error:null,preview:data as Record<string,unknown>}
}
export async function savePricingRevision(requestId:string,quoteId:string,input:PricingRevisionInput,expected:Record<string,unknown>){
 const db=await createClient(),denied=await requireSalesAccess(db)
 if(denied)return {error:denied,data:null}
 const {data,error}=await db.rpc('save_quote_pricing_v2',{p_request_id:requestId,p_quote_id:quoteId,p_input:input,p_expected:expected})
 if(error)return {error:error.message.includes('Preview changed')?'元の見積が変わりました。最新の内容を再確認してください':'保存結果を確認できません。同じ入力のまま再試行するか、見積履歴を確認してください',data:null}
 const result=data as {quote_id:string,deal_id:string};revalidatePath(`/deals/${result.deal_id}`);revalidatePath(`/deals/${result.deal_id}/quote-builder`)
 return {error:null,data:result}
}

export async function fetchPricingReferenceFx(){
 const db=await createClient(),denied=await requireSalesAccess(db);if(denied)return {error:denied,fx:null}
 const {usd,cny}=await pricingReferenceRates()
 if(!usd.success||!cny.success||usd.timestamp!==cny.timestamp)return {error:'同じ基準日時の新しい日次参考値を取得できません。確認済みの手入力レートを使用してください',fx:null}
 return {error:null,fx:{rate:usd.rate,cny_jpy_rate:cny.rate,reference:usd.source,as_of:usd.timestamp,confirmed:false}}
}
