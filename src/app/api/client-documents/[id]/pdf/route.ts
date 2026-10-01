import {createClient} from '@/lib/supabase/server'
import {clientDocumentPDF,type PublicDocumentSnapshot} from '@/lib/pdf/client-document'
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params,db=await createClient(),{data:{user},error:authError}=await db.auth.getUser()
 if(authError||!user)return new Response('Not found',{status:404})
 const {data:profile,error:profileError}=await db.from('profiles').select('role').eq('id',user.id).single();if(profileError||!profile)return new Response('Not found',{status:404})
 let snapshot:PublicDocumentSnapshot|null=null
 if(['sales','admin'].includes(profile.role)){const {data,error}=await db.from('client_document_packets').select('snapshot').eq('id',id).maybeSingle();if(!error&&data)snapshot=data.snapshot as PublicDocumentSnapshot}
 else if(profile.role==='client'){const {data,error}=await db.rpc('client_finance_context',{p_packet_id:id,p_token:new URL(request.url).searchParams.get('token')});if(!error&&data)snapshot=data.snapshot as PublicDocumentSnapshot}
 if(!snapshot)return new Response('Not found',{status:404})
 return new Response(Buffer.from(await clientDocumentPDF(snapshot)),{headers:{'Content-Type':'application/pdf','Content-Disposition':'inline; filename="client-document.pdf"','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex'}})
}
