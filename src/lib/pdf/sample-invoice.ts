import {PDFDocument,rgb} from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import {readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {sampleKindNames,type SampleInvoiceSnapshot} from '@/lib/samples/types'
let fontBytes:Promise<Uint8Array>|undefined
export async function sampleInvoicePDF(number:string,s:SampleInvoiceSnapshot,status='issued'){
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);fontBytes??=readFile(join(process.cwd(),'public/fonts/NotoSansJP-Regular.ttf'))
 const font=await pdf.embedFont(await fontBytes,{subset:false,features:{locl:false,liga:false,clig:false,calt:false,kern:false,frac:false,numr:false,dnom:false}})
 pdf.setTitle(`サンプル費用請求書 ${number}`);pdf.setCreationDate(new Date(s.created_at!));pdf.setModificationDate(new Date(s.created_at!))
 let page=pdf.addPage([595.28,841.89]),y=787
 const line=(raw:string,size=11)=>{let part='';const draw=()=>{if(y-size<60){page=pdf.addPage([595.28,841.89]);y=787}page.drawText(part,{x:48,y,size,font,color:rgb(.208,.118,.157)});y-=size+9;part=''};for(const char of raw.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g,' ')){if(font.widthOfTextAtSize(part+char,size)>499&&part)draw();part+=char}draw()}
 const money=(n:string)=>`¥${Number(n).toLocaleString('ja-JP')}`
 line('サンプル費用請求書',21);if(status!=='issued')line('取消済み・履歴確認用（お支払いに使用しないでください）',11);line(`No. ${number}`,10);line(`発行日 ${s.issue_date} / 支払期限 ${s.due_date}`);line(`${s.customer_name} 御中`,15);line(`案件 ${s.deal_code} / ${s.deal_name}`)
 line(`ご請求金額（税込） ${money(s.total)}`,18)
 for(const l of s.lines)line(`${l.round_number}回目 / ${l.product_description} ${l.variant_label} / ${l.quantity}個 / ${sampleKindNames[l.kind]||l.kind} ${l.carrier||''} / ご負担額 ${money(l.customer_charge_jpy)}`)
 line(`税抜小計 ${money(s.subtotal)} / 消費税 ${s.tax_rate}% ${money(s.tax)} / 合計 ${money(s.total)}`);line('税の円未満は切上げ。量産製品代とは別の請求です。',9)
 line('お振込案内',13);for(const p of s.payment_details.split('\n'))line(p)
 line(s.issuer.name,13);if(s.issuer.address)line(s.issuer.address);if(s.issuer.registration_number)line(`登録番号 ${s.issuer.registration_number}`)
 for(const [i,p] of pdf.getPages().entries())p.drawText(`${i+1} / ${pdf.getPageCount()}`,{x:510,y:30,size:9,font})
 return pdf.save()
}
