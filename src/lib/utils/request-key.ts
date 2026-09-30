/** Keep the same request key across uncertain retries; changed input starts a new request. */
export function stableRequestId(ref: { current: { signature: string; id: string } | null }, payload: unknown): string {
  const signature = JSON.stringify(payload)
  if (!ref.current || ref.current.signature !== signature) ref.current = { signature, id: crypto.randomUUID() }
  return ref.current.id
}
