/** Keep the same request key across uncertain retries; changed input starts a new request. */
export function stableRequestId(ref: { current: { signature: string; id: string } | null }, payload: unknown): string {
  const signature = JSON.stringify(payload)
  if (!ref.current || ref.current.signature !== signature) ref.current = { signature, id: crypto.randomUUID() }
  return ref.current.id
}

export interface PendingRequest { id: string; signature: string }
export interface RequestStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export const workflowRequestKey = (actorId: string, scope: string) => `baoflow-request:v1:${actorId}:${scope}`
export function readPendingRequest(storage: RequestStorage, key: string): PendingRequest | null {
  const value = storage.getItem(key)
  if (!value) return null
  const entry = JSON.parse(value) as PendingRequest
  if (!/^[0-9a-f-]{36}$/i.test(entry.id) || !/^[0-9a-f]{64}$/.test(entry.signature)) throw new Error('前回の保存要求を読み取れません。保存済み一覧を確認してください')
  return entry
}
/** Persist only a random ID and SHA-256 digest, never form data, tokens or saved URLs. */
export async function persistentRequestId(storage: RequestStorage, key: string, payload: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const signature = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
  const previous = readPendingRequest(storage, key)
  if (previous) {
    if (previous.signature !== signature) throw new Error('前回の保存結果が未確認です。同じ内容で再試行するか、作成済み一覧を確認して新しい入力を始めてください')
    return previous.id
  }
  const id = crypto.randomUUID()
  storage.setItem(key, JSON.stringify({ id, signature }))
  return id
}
