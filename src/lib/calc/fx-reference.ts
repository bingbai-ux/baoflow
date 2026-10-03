/** Public quotation references only. Never publish free-text internal rate evidence. */
export interface FxQuote {status:string|null;pricing_snapshot?:Record<string,unknown>|null}
interface FrozenFx {rate?:string|number;reference?:string;as_of?:string;cny_jpy_rate?:string|number|null}
export const FX_NOTE_PREFIX='参考FX（価格版に固定・銀行決済用ではありません）'
export function quoteReferenceFx(quotes:FxQuote[]){return quotes.filter(q=>q.status==='approved'&&q.pricing_snapshot?.fx).map(q=>({fx:q.pricing_snapshot!.fx as FrozenFx,cnyUsed:((q.pricing_snapshot!.cost_lines||[]) as {currency?:string}[]).some(l=>l.currency==='CNY')}))}
export function usesDailyReference(quotes:FxQuote[]){return quoteReferenceFx(quotes).some(({fx})=>fx.reference?.startsWith('ExchangeRate-API'))}
export function frozenFxNote(quotes:FxQuote[]){const lines=quoteReferenceFx(quotes).map(({fx,cnyUsed})=>`${fx.reference?.startsWith('ExchangeRate-API')?'日次参考値 ExchangeRate-API https://www.exchangerate-api.com':'担当者確認済み手入力参考値'} / ${fx.rate} JPY/USD${cnyUsed?` / ${fx.cny_jpy_rate} JPY/CNY`:''} / 取得元基準日時 ${fx.as_of}`);return lines.length?FX_NOTE_PREFIX+'\n'+[...new Set(lines)].join('\n'):''}
export function currentDailyFxMatches(quotes:FxQuote[],live:{rate:number;cny_jpy_rate:number;as_of:string}){return quoteReferenceFx(quotes).filter(({fx})=>fx.reference?.startsWith('ExchangeRate-API')).every(({fx,cnyUsed})=>Number(fx.rate)===live.rate&&Date.parse(fx.as_of||'')===Date.parse(live.as_of)&&(!cnyUsed||Number(fx.cny_jpy_rate)===live.cny_jpy_rate))}
