import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'

const origin = 'http://127.0.0.1:5173'
const username = `smoke${Date.now().toString(36)}`
const otherUsername = `${username}b`
const password = `LocalOnly-${randomBytes(16).toString('hex')}`
const newPassword = `Changed-${randomBytes(16).toString('hex')}`
const testIp = `203.0.113.${(Date.now() % 200) + 1}`

async function post(path, body, cookie) {
  return fetch(origin + path, {
    method: 'POST', redirect: 'manual',
    headers: { origin, 'content-type': 'application/json', 'cf-connecting-ip': testIp, ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  })
}

function assertStatus(response, expected, label) {
  assert.equal(response.status, expected, `${label}: expected ${expected}, got ${response.status}`)
}

const unsigned = await fetch(origin + '/app', { redirect: 'manual' })
assertStatus(unsigned, 302, 'Unsigned workspace')

const registered = await post('/api/account/register', { name: 'Local Smoke User', username, password })
assertStatus(registered, 201, 'Registration')
const { recoveryCodes: originalCodes } = await registered.json()
assert.equal(originalCodes.length, 8)

const signedIn = await post('/api/auth/sign-in/username', { username, password })
assertStatus(signedIn, 200, 'Username sign in')
const cookie = signedIn.headers.get('set-cookie')?.split(';', 1)[0]
assert.ok(cookie, 'Sign in did not set a session cookie')
assertStatus(await fetch(origin + '/app', { headers: { cookie }, redirect: 'manual' }), 200, 'Signed-in workspace')
assertStatus(await fetch(origin + '/api/broker/devices', { headers: { cookie } }), 200, 'Own broker devices')

const otherRegistration = await post('/api/account/register', { name: 'Second Local User', username: otherUsername, password })
assertStatus(otherRegistration, 201, 'Second registration')
const otherSignIn = await post('/api/auth/sign-in/username', { username: otherUsername, password })
assertStatus(otherSignIn, 200, 'Second username sign in')
const otherCookie = otherSignIn.headers.get('set-cookie')?.split(';', 1)[0]
assert.ok(otherCookie, 'Second sign in did not set a session cookie')
const pairingCodeResponse = await post('/api/broker/pairing-codes', {}, cookie)
assertStatus(pairingCodeResponse, 201, 'Pairing code')
const { code: pairingCode } = await pairingCodeResponse.json()
const pairResponse = await post('/api/connector/pair', { code: pairingCode, name: 'Local smoke connector' })
assertStatus(pairResponse, 201, 'Connector pairing')
const { deviceId, token } = await pairResponse.json()
const ownDevices = await fetch(origin + '/api/broker/devices', { headers: { cookie } }).then((response) => response.json())
const otherDevices = await fetch(origin + '/api/broker/devices', { headers: { cookie: otherCookie } }).then((response) => response.json())
assert.equal(ownDevices.devices.length, 1)
assert.equal(otherDevices.devices.length, 0)
const foreignRevoke = await fetch(origin + `/api/broker/devices/${deviceId}`, { method: 'DELETE', headers: { origin, cookie: otherCookie } })
assertStatus(foreignRevoke, 404, 'Foreign device revoke')
const ownRevoke = await fetch(origin + `/api/broker/devices/${deviceId}`, { method: 'DELETE', headers: { origin, cookie } })
assertStatus(ownRevoke, 200, 'Own device revoke')
assertStatus(await fetch(origin + '/api/connector/status', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ state: 'PAUSED' }) }), 401, 'Revoked connector token')

const rotated = await post('/api/account/recovery-codes/rotate', { password }, cookie)
assertStatus(rotated, 200, 'Code rotation')
const { recoveryCodes: replacementCodes } = await rotated.json()
assert.equal(replacementCodes.length, 8)
assertStatus(await post('/api/account/recover', { username, recoveryCode: originalCodes[0], newPassword }), 400, 'Old code rejected')

const recovered = await post('/api/account/recover', { username, recoveryCode: replacementCodes[0], newPassword })
assertStatus(recovered, 200, 'Recovery')
assertStatus(await fetch(origin + '/app', { headers: { cookie }, redirect: 'manual' }), 302, 'Old session revoked')
assertStatus(await post('/api/auth/sign-in/username', { username, password }), 401, 'Old password rejected')
assertStatus(await post('/api/auth/sign-in/username', { username, password: newPassword }), 200, 'New password accepted')
assertStatus(await post('/api/auth/sign-up/email', { username, password }), 404, 'Email signup closed')

console.log('Local D1 onboarding smoke passed: two users, pairing isolation, device revocation, recovery rotation/reset, session revocation, and email route closure.')
