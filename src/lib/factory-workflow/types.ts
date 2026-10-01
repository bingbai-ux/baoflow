import type {FactoryOrderRow} from '@/lib/actions/factory-orders'
export interface FactoryTerms {id:string;version:number;total_usd:string;upfront_usd:string;payment_mode:'full_prepaid'|'partial_prepaid'|'postpaid';balance_due:'before_shipment'|'after_delivery';lead_days:number;bank_snapshot:{data:{raw?:string}|null};note:string}
export interface FactoryTransfer {id:string;amount_usd:string;sent_on:string;reference:string}
export interface FactoryAck {id:string;report_id:string;amount_usd:string;received_on:string;bank_reference:string}
export interface FactoryWorkflowContext {
 order:FactoryOrderRow&{factory_total_usd:string};factory_name:string;actor_role:'staff'|'factory';deal_status:string;
 registered_bank:{factory_id:string;source:string;updated_at:string;data:{raw?:string}|null};
 terms:FactoryTerms[];agreement:{terms_id:string;approved_at:string}|null;transfers:FactoryTransfer[];acknowledgments:FactoryAck[];
 production:{started_on:string;expected_completion_on:string;note:string}|null;
}
export const factoryPaymentNames={full_prepaid:'全額前払',partial_prepaid:'一部前払',postpaid:'納品後払'}
/** USD ledger uses four fixed decimal places; keep comparisons out of binary floats. */
export function usdUnits(value:string){
 if(!/^[0-9]+([.][0-9]{1,4})?$/.test(value))throw Error('保存金額の形式を確認できません')
 const [whole,fraction='']=value.split('.');return BigInt(whole)*BigInt(10000)+BigInt(fraction.padEnd(4,'0'))
}
export function formatUsdUnits(value:bigint){const sign=value<BigInt(0)?'-':'',abs=value<BigInt(0)?-value:value;return `${sign}${abs/BigInt(10000)}.${(abs%BigInt(10000)).toString().padStart(4,'0')}`}
