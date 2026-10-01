import {PDFDocument,rgb} from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import {readFile} from 'node:fs/promises'
import {join} from 'node:path'
import type {FinanceSnapshot} from '@/components/deals/client-finance-panel'
export interface PublicDocumentSnapshot extends FinanceSnapshot {issued_at:string;company:{name:string;address:string|null;registration_number:string|null};banks:{bank_name:string|null;branch_name:string|null;account_type:string|null;account_number:string|null;account_holder:string|null;swift_code:string|null}[];notes:string|null}
let bytes:Promise<Uint8Array>|undefined
export async function clientDocumentPDF(s:PublicDocumentSnapshot){
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);bytes??=readFile(join(process.cwd(),'public/fonts/NotoSansJP-Regular.ttf'))
 const font=await pdf.embedFont(await bytes,{subset:false,features:{locl:false,liga:false,clig:false,calt:false,kern:false,frac:false,numr:false,dnom:false}})
 pdf.setTitle(`${s.type==='quotation'?'見積書':'請求書'} ${s.number}`);pdf.setCreationDate(new Date(s.issued_at));pdf.setModificationDate(new Date(s.issued_at))
 let page=pdf.addPage([595.28,841.89]),y=787
 function line(raw:string,size=11){let part='';const draw=()=>{if(y-size<60){page=pdf.addPage([595.28,841.89]);y=787}page.drawText(part,{x:48,y,size,font,color:rgb(.208,.118,.157)});y-=size+9;part=''};for(const c of raw.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g,' ')){if(part&&font.widthOfTextAtSize(part+c,size)>499)draw();part+=c}draw()}
 const money=(v:string)=>`¥${Number(v).toLocaleString('ja-JP')}`
 line(s.type==='quotation'?'見積書':'請求書',21);line(`No. ${s.number}`);line(`発行日 ${s.issued_at.slice(0,10)}`);line(`${s.customer_name} 御中`,15);line(s.deal_name)
 line(`税込金額 ${money(s.total)}`,18);if(s.payment_conditions){const t=s.payment_conditions;line(`支払条件 ${t.mode==='full_prepaid'?'全額前払い':t.mode==='half_prepaid'?'半金前払い':'後払い'}`);line(`発注前 ${money(t.upfront_jpy)} / 発送前累計 ${money(t.shipment_required_jpy)}`);line(`残金は${t.balance_due==='before_shipment'?'発送前':'納品後・請求書の支払期限まで'}（半金の円端数は前払側）`)}if(s.due_date)line(`支払期限 ${s.due_date}`)
 for(const l of s.lines){line(`${l.name} / ${l.variant}`);line(`${l.quantity}個 × ${money(l.unit_jpy)}（税抜単価） / 税込 ${money(l.gross)}`)}
 line(`保存済み税抜小計 ${money(s.subtotal)} / 消費税 ${money(s.tax)} / 合計 ${money(s.total)}`)
 if(s.notes)line(s.notes)
 if(s.type==='invoice'){line('お振込案内',13);for(const b of s.banks)line([b.bank_name,b.branch_name,b.account_type,b.account_number,b.account_holder,b.swift_code].filter(Boolean).join(' / '))}
 line(s.company.name,13);if(s.company.address)line(s.company.address);if(s.company.registration_number)line(`登録番号 ${s.company.registration_number}`)
 for(const [i,p] of pdf.getPages().entries())p.drawText(`${i+1} / ${pdf.getPageCount()}`,{x:510,y:30,size:9,font})
 return pdf.save()
}
