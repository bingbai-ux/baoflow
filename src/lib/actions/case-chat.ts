'use server'
import {createClient} from '@/lib/supabase/server'
import {canCorrectRejectedWorkflowRequest} from './workflow-recovery'
export interface ChatRoom {id:string;deal_id:string;label:string;unread:number}
export interface ChatTarget {role:'client'|'factory'|'logistics';id:string;label:string}
export interface ChatMessage {id:string;sequence:number;content:string;mine:boolean;sender:string;created_at:string}
export async function listCaseChats(dealId?:string){const db=await createClient(),{data,error}=await db.rpc('list_case_chats',{p_deal:dealId||null});return {rooms:(error?[]:data||[]) as ChatRoom[],error:error?'会話一覧を読み込めません':null}}
export async function caseChatTargets(dealId:string){const db=await createClient(),{data,error}=await db.rpc('case_chat_targets',{p_deal:dealId});return {targets:(error?[]:data||[]) as ChatTarget[],error:error?'会話相手を確認できません':null}}
export async function openCaseChat(dealId:string,target:ChatTarget){const db=await createClient(),{data,error}=await db.rpc('open_case_chat',{p_deal:dealId,p_role:target.role,p_peer:target.id});return {roomId:error?null:data as string|null,error:error?'現在の案件の相手を確認してください。会話を作成できません':null}}
export async function readCaseChat(roomId:string,before?:number){const db=await createClient(),{data,error}=await db.rpc('read_case_chat',{p_room:roomId,p_before:before||null});return {messages:(error?[]:data?.messages||[]) as ChatMessage[],hasMore:!!data?.has_more,error:error?'会話を読み込めません。更新して再確認してください':null}}
export async function markCaseChatRead(roomId:string,sequence:number){const db=await createClient(),{error}=await db.rpc('mark_case_chat_read',{p_room:roomId,p_sequence:sequence});return {error:error?'未読状態を保存できません':null}}
export async function sendCaseChat(requestId:string,roomId:string,content:string){const db=await createClient(),{data,error}=await db.rpc('send_case_chat',{p_request_id:requestId,p_room:roomId,p_content:content});if(error||!data)return {error:'送信を確認できません。相手・内容を変えず履歴を更新してください。未送信なら同じ内容で再試行できます',canCorrect:await canCorrectRejectedWorkflowRequest('case_chat',requestId,roomId,error?.code)};return {result:data as {id:string;sequence:number}}}
