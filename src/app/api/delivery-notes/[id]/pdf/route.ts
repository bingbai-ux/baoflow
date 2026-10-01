import {createClient} from '@/lib/supabase/server'
import {deliveryNotePDF} from '@/lib/pdf/delivery-note'
import type {DeliverySnapshot} from '@/lib/shipping/types'
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params,db=await createClient(),{data,error}=await db.rpc('shipment_delivery_context',{p_document_id:id});if(error||!data)return new Response('Not found',{status:404});return new Response(Buffer.from(await deliveryNotePDF(data as DeliverySnapshot)),{headers:{'Content-Type':'application/pdf','Content-Disposition':'inline; filename="delivery-note.pdf"','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex'}})}
