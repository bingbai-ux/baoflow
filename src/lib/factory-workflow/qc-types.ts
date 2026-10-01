export const qcKindNames={overall_photo:'製品全体写真',packing_photo:'梱包写真',video:'製品・梱包動画'}
export type QcKind=keyof typeof qcKindNames
export interface QcAsset {id:string;order_id:string;kind:QcKind;object_path:string;mime:string;byte_size:number;sha256:string}
export interface QcSubmission {id:string;version:number;completed_on:string;quantity:number;asset_ids:string[];note:string}
export interface QcReview {submission_id:string;decision:'approved'|'rejected';note:string}
export interface QcContext {assets:QcAsset[];submissions:QcSubmission[];reviews:QcReview[];ship_ready:boolean;today:string;days_remaining:number|null}
export function validQcBytes(bytes:Uint8Array,mime:string){
 if(mime==='image/png')return bytes.length>=24&&[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b)
 if(mime==='image/jpeg')return bytes.length>=4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255&&bytes[bytes.length-2]===255&&bytes[bytes.length-1]===217
 if(mime==='video/mp4')return bytes.length>=24&&[102,116,121,112].every((b,i)=>bytes[i+4]===b)
 return false
}
