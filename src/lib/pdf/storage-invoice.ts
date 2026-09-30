import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { storageInvoiceAmounts, type StorageInvoiceSnapshot } from '@/lib/utils/storage-invoice'

let fontBytes: Promise<Uint8Array> | undefined
export async function storageInvoicePDF(number: string, s: StorageInvoiceSnapshot): Promise<Uint8Array> {
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit)
 fontBytes ??= readFile(join(process.cwd(),'public/fonts/NotoSansJP-Regular.ttf'))
 // Full static font avoids fontkit subset glyph corruption in Japanese PDF readers.
 const font=await pdf.embedFont(await fontBytes,{subset:false})
 pdf.setTitle(`保管料請求書 ${number}`);pdf.setCreationDate(new Date(s.created_at));pdf.setModificationDate(new Date(s.created_at))
 let page=pdf.addPage([595.28,841.89]),y=787
 const ink=rgb(0.208,0.118,0.157), muted=rgb(0.52,0.47,0.49)
 const ensureSpace=(height:number)=>{if(y-height<60){page=pdf.addPage([595.28,841.89]);y=787}}
 function line(raw: string,size=11,color=ink){
  const text=raw.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g,' ')
  for(const paragraph of text.split('\n')){
   let part=''
   const draw=()=>{ensureSpace(size);page.drawText(part,{x:48,y,size,font,color});y-=size+9;part=''}
   for(const char of paragraph){if(font.widthOfTextAtSize(part+char,size)>499&&part)draw();part+=char}
   draw()
  }
 }
 const money=(n:number)=>`¥${Number(n).toLocaleString('ja-JP')}`
 const i=s.input,a=storageInvoiceAmounts(i)
 line('保管料請求書',22);line(`No. ${number}`,10,muted);line(`発行日 ${i.issue_date}    支払期限 ${i.due_date}`,10)
 y-=15;line(`${s.client.name} 御中`,15);if(s.client.address)line(s.client.address,10)
 y-=12;ensureSpace(50);page.drawRectangle({x:44,y:y-12,width:507,height:42,color:rgb(0.843,0.937,1)})
 line(`ご請求金額（税込） ${money(s.total)}`,18);y-=20
 line(`対象月 ${i.month}    算定方式 ${i.method==='end_of_month'?'月末確定量':'月中平均確定量'}`)
 line(`保管料  ${i.cartons.toLocaleString('ja-JP')} CTN × ${money(i.monthly_rate)} /月 = ${money(a.storage)}`)
 line(`入庫手数料  ${i.in_count} 回 × ${money(i.in_rate)} = ${money(a.inbound)}`)
 line(`出庫手数料  ${i.out_count} 回 × ${money(i.out_rate)} = ${money(a.outbound)}`)
 line(`小計 ${money(s.subtotal)}    消費税 ${i.tax_rate}% ${money(s.tax)}    合計 ${money(s.total)}`)
 line('各項目・税の円未満は切り捨て。',9,muted)
 y-=16;line('算定根拠',12);line(i.basis,10)
 y-=14;line('お振込先',12);line(i.payment_details,10)
 y-=16;line(s.issuer.name,13);if(s.issuer.address)line(s.issuer.address,10)
 if(s.issuer.phone)line(`TEL ${s.issuer.phone}`,10)
 if(s.issuer.registration_number)line(`登録番号 ${s.issuer.registration_number}`,10)
 for(const [n,p]of pdf.getPages().entries())p.drawText(`${n+1} / ${pdf.getPageCount()}`,{x:510,y:30,size:9,font,color:muted})
 return pdf.save()
}
