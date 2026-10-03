export interface FinanceEvidence {document_type:string;status:string;current_price:boolean;decision:string|null;upfront_jpy:string;payment_totals:{net_jpy:string}}
/** Real approval and net bank facts override a historical display status. */
export function financeNextAction(rows:FinanceEvidence[]):{label:string;reason:string;step:number}|undefined{
 const quote=rows.find(p=>p.status==='active'&&p.document_type==='quotation'),invoice=rows.find(p=>p.status==='active'&&p.document_type==='invoice')
 if(quote&&(!quote.current_price||quote.decision!=='approved'))return {step:6,label:quote.decision==='revision_requested'?'顧客の修正依頼を確認する':'顧客の現行見積承認を確認する',reason:'顧客の新価格承認待ちです。送付状況を確認し、旧版の承認で発注を進めないでください。'}
 if(invoice&&!invoice.current_price)return {step:7,label:'再承認後の請求差替を確認する',reason:'旧請求の価格は現行採用版と異なります。営業担当が新価格承認と着金引継ぎを確認します。'}
 if(quote?.decision==='approved'&&!invoice)return {step:7,label:'承認済み見積から請求書を共有する',reason:'営業担当が請求版と支払期限を確認します。顧客の見積承認は実着金ではありません。'}
 if(invoice&&Number(invoice.payment_totals.net_jpy)<Number(invoice.upfront_jpy))return {step:7,label:'必要前払額の実着金を確認する',reason:'差引着金が合意した前払額に達していません。銀行確認・返金履歴と未収を確認してください。'}
}
