// Isolated localhost Auth fixture. No production credentials or invitations.
import http from 'node:http'
const id = '11111111-1111-4111-8111-111111111111'
const user = { id, aud: 'authenticated', role: 'authenticated', email: 'local+invite@example.test', email_confirmed_at: '2026-01-01T00:00:00Z', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
const token = [ { alg: 'HS256', typ: 'JWT' }, { sub: id, exp: 4102444800, iat: 1700000000, role: 'authenticated' }, 'fixture' ].map(x => typeof x === 'string' ? x : Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')
let verified = 0, updates = 0, used = false
http.createServer(async (req, res) => {
  res.setHeader('access-control-allow-origin', '*')
  res.setHeader('access-control-allow-headers', '*')
  res.setHeader('access-control-allow-methods', 'GET,POST,PUT,OPTIONS')
  res.setHeader('content-type', 'application/json')
  if (req.method === 'OPTIONS') { res.end(); return }
  let raw = ''; for await (const chunk of req) raw += chunk
  const input = raw ? JSON.parse(raw) : {}
  const path = new URL(req.url, 'http://127.0.0.1:55442').pathname
  const send = (data, status = 200) => { res.statusCode = status; res.end(JSON.stringify(data)) }
  if (path === '/__reset') { verified = updates = 0; used = false; send({ ok: true }); return }
  if (path === '/__state') { send({ verified, updates, used }); return }
  if (path === '/auth/v1/verify') {
    verified++
    if (input.type !== 'invite' || input.token_hash !== 'a'.repeat(64) || used) { send({ error_code: 'otp_expired', msg: 'Synthetic expired link' }, 403); return }
    used = true
    send({ access_token: token, refresh_token: 'synthetic-refresh-only', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user }); return
  }
  if (path === '/auth/v1/user') {
    if (req.headers.authorization !== 'Bearer ' + token) { send({ msg: 'Synthetic session missing' }, 401); return }
    if (req.method === 'PUT') {
      if (input.password !== 'synthetic-password-only') { send({ msg: 'Unexpected synthetic password' }, 400); return }
      updates++
    }
    send(user); return
  }
  if (path === '/rest/v1/profiles') {
    const profile = { ...user, display_name: 'Synthetic invite user', role: 'client', client_id: null }
    send(req.headers.accept?.includes('object') ? profile : [profile]); return
  }
  send([])
}).listen(55442, '127.0.0.1', () => console.log('Synthetic invitation Auth on 127.0.0.1:55442'))
