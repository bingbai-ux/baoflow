import { getStorageBill } from '@/lib/actions/storage-billing'
import { storageInvoicePDF } from '@/lib/pdf/storage-invoice'
export const runtime='nodejs'
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params,bill=await getStorageBill(id)
 if(!bill?.snapshot)return new Response('Not found',{status:404})
 const pdf=await storageInvoicePDF(bill.snapshot.document_number,bill.snapshot)
 return new Response(new Uint8Array(pdf),{headers:{'Content-Type':'application/pdf','Content-Disposition':`inline; filename="${bill.snapshot.document_number}.pdf"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})
}
