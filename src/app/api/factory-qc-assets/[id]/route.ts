import {getQcAssetUrl} from '@/lib/actions/factory-qc'
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params,url=await getQcAssetUrl(id);return url?new Response(null,{status:302,headers:{Location:url,'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex'}}):new Response('Not found',{status:404})}
