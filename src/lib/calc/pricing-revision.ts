export type CostKind = 'plate' | 'color' | 'domestic_freight' | 'international_freight' | 'other' | 'custom'
export interface PricingCostLine { key: string; kind: CostKind; name: string; amount: number | null; currency: 'USD' | 'JPY'; confirmed: boolean }
export interface ManualFx { rate: number | null; reference: string; as_of: string; confirmed: boolean }
export interface PricingRevisionInput { mode: 'ratio' | 'selling_price'; value: number | null; tax_rate: number | null; fx: ManualFx; cost_lines: PricingCostLine[] }
export const requiredCostKinds: CostKind[] = ['plate','color','domestic_freight','international_freight','other']
export const costKindNames: Record<CostKind,string> = {plate:'版代',color:'色指定費',domestic_freight:'中国国内送料',international_freight:'国際送料',other:'その他費用',custom:'追加費目'}
type Fraction = [bigint,bigint]
function fraction(n:number):Fraction {
  const [mantissa,exponent='0']=String(n).toLowerCase().split('e'),[whole,tail='']=mantissa.split('.')
  const scale=Number(exponent)-tail.length,digits=BigInt(whole+tail)
  return scale>=0?[digits*BigInt(10)**BigInt(scale),BigInt(1)]:[digits,BigInt(10)**BigInt(-scale)]
}
function reduced(n:bigint,d:bigint):Fraction {let a=n<BigInt(0)?-n:n,b=d;while(b){const r=a%b;a=b;b=r}return [n/a,d/a]}
const add=(a:Fraction,b:Fraction):Fraction=>reduced(a[0]*b[1]+b[0]*a[1],a[1]*b[1])
const multiply=(a:Fraction,b:Fraction):Fraction=>reduced(a[0]*b[0],a[1]*b[1])
const divide=(a:Fraction,b:Fraction):Fraction=>reduced(a[0]*b[1],a[1]*b[0])
const ceiling=(a:Fraction)=>((a[0]+a[1]-BigInt(1))/a[1])
const approximate=(a:Fraction)=>Number(a[0])/Number(a[1])
/** Draft only. PostgreSQL numeric is authoritative at preview/save; never silently writes. */
export function calculatePricingRevision(quantity:number|null,factoryPrice:number|null,input:PricingRevisionInput) {
  const positive=(n:number|null):n is number=>n!=null&&Number.isFinite(n)&&n>0
  if(!positive(quantity)||!Number.isSafeInteger(quantity)||quantity>2147483647||!positive(factoryPrice))throw Error('数量と工場単価を確認してください')
  if(!positive(input.fx.rate)||!input.fx.confirmed||!input.fx.reference.trim()||!/(Z|[+-]\d{2}:\d{2})$/i.test(input.fx.as_of)||!Number.isFinite(Date.parse(input.fx.as_of)))throw Error('手入力レートの値・根拠・タイムゾーン付日時を確認してください')
  if(input.tax_rate==null||!Number.isFinite(input.tax_rate)||input.tax_rate<0||input.tax_rate>100)throw Error('税率を0〜100で入力してください')
  if(!positive(input.value)||(input.mode==='ratio'&&input.value>1)||(input.mode==='selling_price'&&!Number.isSafeInteger(input.value)))throw Error('掛率は0より大きく1以下、税抜売単価は正の整数で入力してください')
  if(input.cost_lines.length>100)throw Error('費目が多すぎます')
  const keys=new Set<string>(),names=new Set<string>()
  for(const kind of requiredCostKinds)if(input.cost_lines.filter(l=>l.kind===kind).length!==1)throw Error('版代・色指定費・国内送料・国際送料・その他費用を各1件確認してください')
  let total=multiply(fraction(quantity),fraction(factoryPrice))
  for(const l of input.cost_lines){
    const name=l.name.trim().toLowerCase()
    if(!l.key||keys.has(l.key)||!name||names.has(name)||!l.confirmed||l.amount==null||!Number.isFinite(l.amount)||l.amount<0||!['USD','JPY'].includes(l.currency)||!(l.kind in costKindNames))throw Error('追加費目の欠損・重複・金額・確認状態を修正してください')
    if(l.kind==='custom'&&/(版代|プレート|plate|sample|サンプル)/i.test(name))throw Error('版代は専用行、サンプル費は独立手配・後日請求へ記録してください')
    keys.add(l.key);names.add(name);total=add(total,l.currency==='USD'?fraction(l.amount):divide(fraction(l.amount),fraction(input.fx.rate)))
  }
  const unit=divide(total,fraction(quantity)),unitYen=multiply(unit,fraction(input.fx.rate)),unitJpy=approximate(unitYen)
  if(!Number.isFinite(unitJpy)||unitJpy<=0)throw Error('原価を確認してください')
  const sell=input.mode==='selling_price'?input.value:Number(ceiling(divide(unitYen,fraction(input.value))))
  if(sell<unitJpy)throw Error('売値が原価を下回ります。掛率は1以下で設定してください')
  const ratio=input.mode==='ratio'?input.value:unitJpy/sell
  const net=sell*quantity,tax=Number(ceiling(multiply(fraction(net),add([BigInt(1),BigInt(1)],divide(fraction(input.tax_rate),[BigInt(100),BigInt(1)])))))
  if(!Number.isSafeInteger(net)||!Number.isSafeInteger(tax))throw Error('金額が保存可能な範囲を超えています')
  return {total_cost_usd:approximate(total),unit_cost_usd:approximate(unit),cost_ratio:ratio,selling_price_jpy:sell,total_billing_jpy:net,total_billing_tax_jpy:tax,rounding:'JPY_UNIT_CEIL_TAX_TOTAL_CEIL' as const}
}
