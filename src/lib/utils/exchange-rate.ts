/** Public daily reference values; existing no-key provider. Never a bank settlement rate. */
const API_URL='https://open.er-api.com/v6/latest/USD'
export interface ExchangeRateResult {rate:number;source:string;timestamp:string;success:boolean;error?:string}
export function parseReferenceRate(data:unknown,from:string,to:string,now=Date.now()):ExchangeRateResult{
 const fail=(error:string):ExchangeRateResult=>({rate:0,source:'ExchangeRate-API',timestamp:'',success:false,error})
 if(!['USD','JPY','CNY'].includes(from)||!['USD','JPY','CNY'].includes(to))return fail('Unsupported conversion')
 const d=data as {result?:string;base_code?:string;rates?:Record<string,number>;time_last_update_unix?:number;time_next_update_unix?:number}
 const stamp=Number(d?.time_last_update_unix)*1000,next=Number(d?.time_next_update_unix)*1000
 if(d?.result!=='success'||d.base_code!=='USD'||d.rates?.USD!==1||!Number.isFinite(stamp)||stamp<=0||stamp>now+300000||now-stamp>30*3600000||!Number.isFinite(next)||next<=stamp||now>next+6*3600000)return fail('日次参考レートの基準日時・鮮度を確認できません')
 const base=from==='USD'?1:d.rates?.[from],target=to==='USD'?1:d.rates?.[to]
 if(typeof base!=='number'||typeof target!=='number'||!Number.isFinite(base)||!Number.isFinite(target)||base<=0||target<=0)return fail('Invalid conversion values')
 const rate=target/base;if(!Number.isFinite(rate)||rate<=0)return fail('Invalid cross rate')
 return {rate,source:'ExchangeRate-API (daily reference; USD base cross rate)',timestamp:new Date(stamp).toISOString(),success:true}
}
async function referenceData(fresh=false){const res=await fetch(API_URL,{...(fresh?{cache:'no-store' as const}:{next:{revalidate:3600}}),signal:AbortSignal.timeout(8000)});if(!res.ok)throw Error('Reference rate unavailable');return res.json()}
const unavailable=():ExchangeRateResult=>({rate:0,source:'ExchangeRate-API',timestamp:'',success:false,error:'参考レートを取得できません。確認済みの手入力レートを使用してください'})
export async function getExchangeRate(from='USD',to='JPY'):Promise<ExchangeRateResult>{try{return parseReferenceRate(await referenceData(),from,to)}catch{return unavailable()}}
export async function pricingReferenceRates(fresh=false){try{const data=await referenceData(fresh);return {usd:parseReferenceRate(data,'USD','JPY'),cny:parseReferenceRate(data,'CNY','JPY')}}catch{return {usd:unavailable(),cny:unavailable()}}}
export async function getExchangeRateWithFallback(fallbackRate=150):Promise<ExchangeRateResult>{const result=await getExchangeRate();return result.success?result:{...result,rate:fallbackRate,source:'system_settings (manual fallback; not latest)',timestamp:'',success:false}}
