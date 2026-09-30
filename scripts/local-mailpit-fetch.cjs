// Test-process preload only. Never configured in production or committed as a sender fallback.
const original=globalThis.fetch
if(process.env.NEXT_PUBLIC_SUPABASE_URL!=='http://127.0.0.1:55321'||process.env.RESEND_API_KEY!=='local-capture-only-no-provider-key')throw Error('Refusing mail adapter outside authorized synthetic localhost environment')
globalThis.fetch=async(input,options={})=>{
 const url=typeof input==='string'?input:input instanceof URL?input.href:input.url
 if(url==='https://api.resend.com/emails'){
  const body=JSON.parse(options.body)
  if(!body.to?.every(a=>a.endsWith('@example.test')))throw Error('Synthetic recipients only')
  const captured=await original('http://127.0.0.1:55324/api/v1/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({From:{Email:'sender@example.test',Name:'Synthetic BAO'},To:body.to.map(Email=>({Email})),Subject:body.subject,Text:body.text,HTML:body.html,Tags:['baoflow-synthetic-e2e'],Attachments:(body.attachments||[]).map(a=>({Filename:a.filename,Content:a.content,ContentType:'application/pdf'}))})})
  if(!captured.ok)throw Error('Local Mailpit rejected synthetic capture')
  const result=await captured.json()
  return new Response(JSON.stringify({id:result.ID}),{status:200,headers:{'Content-Type':'application/json'}})
 }
 if(!['127.0.0.1','localhost'].includes(new URL(url).hostname))throw Error('Local test refuses remote network request')
 return original(input,options)
}
