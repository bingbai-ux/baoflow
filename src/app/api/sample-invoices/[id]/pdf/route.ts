import {getSampleInvoice} from '@/lib/actions/sample-ledger'
import {sampleInvoicePDF} from '@/lib/pdf/sample-invoice'
export const runtime='nodejs'
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params,bill=await getSampleInvoice(id);if(!bill)return new Response('Not found',{status:404})
 const bytes=await sampleInvoicePDF(bill.document_number,bill.snapshot)
 return new Response(new Uint8Array(bytes),{headers:{'Content-Type':'application/pdf','Content-Disposition':`inline; filename="${bill.document_number}.pdf"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})
}
