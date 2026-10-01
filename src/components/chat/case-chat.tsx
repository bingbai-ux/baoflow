'use client'
import {useCallback,useEffect,useRef,useState} from 'react'
import {caseChatTargets,listCaseChats,openCaseChat,readCaseChat,markCaseChatRead,sendCaseChat,type ChatMessage,type ChatRoom,type ChatTarget} from '@/lib/actions/case-chat'
import {useWorkflowRequest} from '@/lib/hooks/use-workflow-request'
const control='min-h-11 rounded-full border border-[#E2E1DA] px-3 text-xs disabled:opacity-50'
export function CaseChat({dealId}:{dealId?:string}){
 const [rooms,setRooms]=useState<ChatRoom[]>([]),[targets,setTargets]=useState<ChatTarget[]>([]),[selected,setSelected]=useState(''),[target,setTarget]=useState(''),[error,setError]=useState<string|null>(null),[loading,setLoading]=useState(true),[creating,setCreating]=useState(false),[draftActive,setDraftActive]=useState(false)
 const active=useRef(true)
 const refresh=useCallback(async()=>{try{const r=await listCaseChats(dealId);if(!active.current)return;setRooms(r.rooms);setError(r.error)}catch{if(active.current)setError('会話一覧を読み込めません。更新してください')}finally{if(active.current)setLoading(false)}},[dealId])
 useEffect(()=>{active.current=true;void refresh();if(dealId)void caseChatTargets(dealId).then(r=>{if(active.current)setTargets(r.targets)}).catch(()=>{});const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh()},15000);return()=>{active.current=false;clearInterval(timer)}},[dealId,refresh])
 return <section aria-label="案件の会話" className="min-w-0">
 <div className="flex items-center justify-between gap-2"><h2 className="font-bold text-base">案件の会話</h2><button className={control} onClick={()=>void refresh()}>更新</button></div>
 <p className="text-[11px] text-[#84787D] my-2">営業と選択した相手だけの会話。15秒ごとに確認します。外部メッセンジャー・メール通知・自動翻訳は未接続です。</p>
 {loading&&<p role="status">会話を読み込んでいます…</p>}{error&&<p role="alert" className="text-xs">{error}</p>}
 <label className="block text-xs">会話相手<select aria-label="会話相手" className="block w-full min-h-11 border border-[#E2E1DA] rounded-xl my-1 bg-white text-xs" value={selected} onChange={e=>{if(!draftActive||window.confirm('未送信の本文は保存されません。会話相手を切り替えますか？')){setDraftActive(false);setSelected(e.target.value)}}}><option value="">相手を選択してください</option>{rooms.map(r=><option key={r.id} value={r.id}>{r.label}{r.unread?`（未読${r.unread}件）`:''}</option>)}</select></label>
 {!loading&&!error&&!rooms.length&&<p className="text-xs my-2">会話はまだありません。営業担当者が案件の相手を指定すると、ここから連絡できます。</p>}
 {targets.length>0&&<details className="text-xs my-2"><summary className="min-h-11 cursor-pointer flex items-center">別の相手との会話を開く</summary><label>案件の相手<select aria-label="案件の相手" className="w-full min-h-11 bg-white border rounded-xl border-[#E2E1DA] my-1" value={target} onChange={e=>setTarget(e.target.value)}><option value="">選択してください</option>{targets.map(t=><option key={`${t.role}:${t.id}`} value={`${t.role}:${t.id}`}>{t.label}</option>)}</select></label><button disabled={!target||creating||draftActive} className={control} onClick={async()=>{const t=targets.find(t=>`${t.role}:${t.id}`===target);if(!dealId||!t)return;setCreating(true);try{const r=await openCaseChat(dealId,t);if(r.error)setError(r.error);else if(r.roomId){await refresh();setSelected(r.roomId)}}catch{setError('作成結果を確認できません。更新して会話一覧を確認してください')}finally{setCreating(false)}}}>この相手との会話を開く</button>{draftActive&&<p className="mt-1">入力中の本文を送信するか空にしてから、別の会話を開いてください。</p>}</details>}
 {selected&&rooms.some(r=>r.id===selected)&&<ChatThread key={selected} room={rooms.find(r=>r.id===selected)!} onRead={refresh} onDraft={setDraftActive}/>}
 </section>
}
function ChatThread({room,onRead,onDraft}:{room:ChatRoom;onRead:()=>Promise<void>;onDraft:(active:boolean)=>void}){
 const [messages,setMessages]=useState<ChatMessage[]>([]),[hasMore,setHasMore]=useState(false),[content,setContent]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[notice,setNotice]=useState(''),[loaded,setLoaded]=useState(false)
 const pending=useWorkflowRequest(`case-chat:${room.id}`,'case_chat',room.id),active=useRef(true),fetching=useRef(false),recovered=useRef(false),lastRead=useRef(0)
 useEffect(()=>{onDraft(Boolean(content.trim())||pending.unfinished)},[content,pending.unfinished,onDraft])
 const load=useCallback(async(before?:number)=>{if(fetching.current)return;fetching.current=true;try{const r=await readCaseChat(room.id,before);if(!active.current)return;if(r.error){setError(r.error);return}setMessages(old=>Array.from(new Map([...old,...r.messages].map(m=>[m.id,m])).values()).sort((a,b)=>a.sequence-b.sequence));if(before||!loaded)setHasMore(r.hasMore);setLoaded(true);setError(null);if(!before&&r.messages.length&&document.visibilityState==='visible'&&r.messages.at(-1)!.sequence>lastRead.current){const sequence=r.messages.at(-1)!.sequence,ack=await markCaseChatRead(room.id,sequence);if(ack.error&&active.current)setError(ack.error);else lastRead.current=sequence;await onRead()}}catch{if(active.current)setError('会話を読み込めません。更新してください')}finally{fetching.current=false}},[room.id,onRead,loaded])
 useEffect(()=>{active.current=true;void load();const timer=setInterval(()=>{if(document.visibilityState==='visible')void load()},15000);return()=>{active.current=false;clearInterval(timer)}},[load])
 useEffect(()=>{if(pending.recovered&&!recovered.current){recovered.current=true;setNotice('前回の送信を確認しました。履歴を更新します');pending.complete();void load()}},[pending,load])
 async function send(){if(busy||!content.trim())return;setBusy(true);setError(null);try{const text=content.trim(),id=await pending.requestId({room_id:room.id,content:text}),r=await sendCaseChat(id,room.id,text);if(r.error){setError(r.error);if(r.canCorrect)pending.complete()}else{pending.complete();setContent('');setNotice('送信しました。次は相手からの返信を確認してください');await load()}}catch(e){setError(e instanceof Error?e.message:'送信を確認できません。履歴を更新してください')}finally{setBusy(false)}}
 return <div className="border-t border-[#E2E1DA] mt-3 pt-3">
 <h3 className="font-bold text-xs break-words">{room.label}</h3><button onClick={()=>void load()} className={`${control} my-2`}>最新の履歴を確認</button>
 {hasMore&&<button className={control} onClick={()=>void load(messages[0]?.sequence)}>以前のメッセージを読む</button>}
 <ol aria-label="会話履歴" className="max-h-[360px] overflow-y-auto space-y-2 my-2">{messages.map(m=><li key={m.id} className={`p-3 rounded-xl text-xs ${m.mine?'bg-[#EFEFEA]':'bg-[#D7EFFF] text-[#33566F]'}`}><div className="flex flex-wrap justify-between gap-1 text-[10px]"><span>{m.mine?'自分':m.sender}</span><time dateTime={m.created_at}>{new Date(m.created_at).toLocaleString('ja-JP')}</time></div><p className="whitespace-pre-wrap break-words mt-1">{m.content}</p></li>)}</ol>
 {loaded&&!messages.length&&<p className="text-xs my-2">まだメッセージはありません。相手を確認して、最初の連絡を入力してください。</p>}
 {(error||pending.error)&&<p role="alert" className="text-xs my-2">{error||pending.error}</p>}{notice&&<p role="status" className="text-xs my-2">{notice}</p>}
 {pending.unfinished&&!pending.recovered&&<p className="text-xs my-2">前回要求が未確認です。本文は保存していません。履歴にない場合は前回と同じ本文で再試行してください。</p>}
 <label className="text-xs block">{room.label}へのメッセージ<textarea value={content} maxLength={2000} onChange={e=>setContent(e.target.value)} className="w-full border border-[#E2E1DA] rounded-xl p-3 mt-1 min-h-24 bg-white"/></label><p className="text-[10px] text-[#84787D]">{content.length}/2000文字。原価・他工場の回答・口座情報を自動添付しません。</p>
 <button className={`${control} bg-[#E9F056] text-[#666C14] my-2 font-bold`} onClick={()=>void send()} disabled={!loaded||!pending.ready||busy||!content.trim()}>{busy?'送信結果を確認中…':'この相手に送信'}</button>
 {(!loaded||!pending.ready)&&<p className="text-xs">履歴と前回の送信結果を確認してから送信できます。</p>}
 </div>
}
