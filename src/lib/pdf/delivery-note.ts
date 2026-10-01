import {PDFDocument,rgb} from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import {readFile} from 'node:fs/promises'
import {join} from 'node:path'
import type {DeliverySnapshot} from '@/lib/shipping/types'
let bytes:Promise<Uint8Array>|undefined
export async function deliveryNotePDF(s:DeliverySnapshot){
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);bytes??=readFile(join(process.cwd(),'public/fonts/NotoSansJP-Regular.ttf'))
 const font=await pdf.embedFont(await bytes,{subset:false,features:{locl:false,liga:false,clig:false,calt:false,kern:false,frac:false,numr:false,dnom:false}})
 pdf.setTitle(`納品書 ${s.number}`);pdf.setCreationDate(new Date(s.issued_at));pdf.setModificationDate(new Date(s.issued_at))
 let page=pdf.addPage([595.28,841.89]),y=787
 function line(raw:string,size=11){let part='';const draw=()=>{if(y-size<60){page=pdf.addPage([595.28,841.89]);y=787}page.drawText(part,{x:48,y,size,font,color:rgb(.208,.118,.157)});y-=size+9;part=''};for(const c of raw.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g,' ')){if(part&&font.widthOfTextAtSize(part+c,size)>499)draw();part+=c}draw()}
 line('納品書',21);line(`No. ${s.number}`);line(`発行日 ${s.issued_at.slice(0,10)}`);line(`${s.customer_name} 御中`,15);line(`工場発注 ${s.order_no}`);line(s.item_name);line(`納品数量 ${s.quantity}個 / 顧客受領日 ${s.received_on}`,15);line(`納品先 ${s.destination_address}`);line(`受取人 ${s.recipient}`);line('顧客本人の受領確認に基づく発行版。配送会社の配達報告とは別記録です。',10);line(s.issuer.name,13);if(s.issuer.address)line(s.issuer.address)
 for(const [i,p] of pdf.getPages().entries())p.drawText(`${i+1} / ${pdf.getPageCount()}`,{x:510,y:30,size:9,font})
 return pdf.save()
}
