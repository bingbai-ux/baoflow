export interface StorageInvoiceInput {
 month: string; issue_date: string; due_date: string; method: 'end_of_month' | 'mid_month_avg'
 cartons: number; monthly_rate: number; in_count: number; in_rate: number; out_count: number; out_rate: number
 tax_rate: number; recipient: string; payment_details: string; basis: string; confirmed: boolean
}
export interface StorageInvoiceSnapshot {
 version: number; input: StorageInvoiceInput; client: { id: string; name: string; address?: string }
 issuer: { name: string; address?: string; phone?: string; registration_number?: string }
 subtotal: number; tax: number; total: number; currency: string; created_at: string
}
export function storageInvoiceAmounts(i: StorageInvoiceInput) {
 const scaled=(n:number)=>{const [a,b='']=String(n).split('.');return BigInt(a)*BigInt(10000)+BigInt(b.padEnd(4,'0'))}
 const fee=(a:number,b:number)=>Number(scaled(a)*scaled(b)/BigInt(100000000))
 const storage=fee(i.cartons,i.monthly_rate), inbound=fee(i.in_count,i.in_rate), outbound=fee(i.out_count,i.out_rate)
 const subtotal=storage+inbound+outbound, tax=Number(BigInt(subtotal)*scaled(i.tax_rate)/BigInt(1000000))
 return {storage,inbound,outbound,subtotal,tax,total:subtotal+tax}
}
export function validateStorageInvoice(i: StorageInvoiceInput): string | null {
 if(!i||typeof i!=='object'||['month','issue_date','due_date','basis','recipient','payment_details'].some(key=>typeof i[key as keyof StorageInvoiceInput]!=='string'))return '請求内容を確認してください'
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(i.month))return '請求対象月を確認してください'
 for(const date of [i.issue_date,i.due_date])if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)return '日付を確認してください'
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
 if(i.issue_date>today||i.due_date<i.issue_date||i.month>i.issue_date.slice(0,7))return '発行日・請求対象月・支払期限を確認してください'
 if(!['end_of_month','mid_month_avg'].includes(i.method)||i.confirmed!==true||!i.basis.trim()||i.basis.length>500)return '倉庫台帳の請求対象量・料金・根拠を確認してください'
 for(const value of [i.cartons,i.monthly_rate,i.in_count,i.in_rate,i.out_count,i.out_rate,i.tax_rate])if(!Number.isFinite(value)||value<0||value>1e9||!/^\d+(\.\d{1,4})?$/.test(String(value)))return '数量・料金は0以上、小数4桁以内で入力してください'
 if(!Number.isInteger(i.in_count)||!Number.isInteger(i.out_count)||(i.method==='end_of_month'&&!Number.isInteger(i.cartons))||i.tax_rate>100||storageInvoiceAmounts(i).total>9e12)return '数量・税率・合計を確認してください'
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.recipient)||i.recipient.length>254||!i.payment_details.trim()||i.payment_details.length>500)return '宛先メールと振込先を確認してください'
 return null
}
