// crypto.randomUUID() is only available in secure contexts (https:// or localhost).
// Plain http:// over a real network IP (used for cross-device testing) doesn't
// qualify, so fall back to a manual UUIDv4 generator in that case.
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  // Manual UUIDv4 fallback — not cryptographically secure, but sufficient
  // for generating unique local identifiers (layer IDs), not security tokens
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}