import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type OwnerStage = 'signed-out' | 'enroll' | 'verify' | 'ready'

let clientPromise: Promise<SupabaseClient> | null = null

export function getOwnerClient(): Promise<SupabaseClient> {
  clientPromise ??= (async () => {
    const response = await fetch('/api/owner/config')
    if (!response.ok) throw new Error('Owner access is not configured yet.')
    const { url, publishableKey } = await response.json() as { url: string; publishableKey: string }
    return createClient(url, publishableKey, {
      auth: {
        storage: window.sessionStorage,
        storageKey: 'trc-owner-session',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  })().catch((error: unknown) => { clientPromise = null; throw error })
  return clientPromise
}

export async function ownerRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const client = await getOwnerClient()
  const { data: { session }, error } = await client.auth.getSession()
  if (error || !session) throw new Error('Sign in to continue.')
  const response = await fetch(`/api/owner${path}`, {
    ...init,
    headers: { ...init.headers, authorization: `Bearer ${session.access_token}` },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? 'Owner request failed.')
  }
  return response.json() as Promise<T>
}

export async function ownerStage(): Promise<OwnerStage> {
  const client = await getOwnerClient()
  const { data: { session } } = await client.auth.getSession()
  if (!session) return 'signed-out'
  await ownerRequest('/session')
  const { data: level, error: levelError } = await client.auth.mfa.getAuthenticatorAssuranceLevel()
  if (levelError) throw levelError
  if (level.currentLevel === 'aal2') return 'ready'
  const { data: factors, error: factorError } = await client.auth.mfa.listFactors()
  if (factorError) throw factorError
  return factors.totp.length > 0 ? 'verify' : 'enroll'
}

export async function signInOwner(email: string, password: string): Promise<OwnerStage> {
  const client = await getOwnerClient()
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error('Sign-in failed. Check your email and password.')
  try { return await ownerStage() }
  catch (cause) { await client.auth.signOut(); throw cause }
}

export async function beginOwnerEnrollment() {
  const client = await getOwnerClient()
  const { data, error } = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'TradeRelayCity owner' })
  if (error) throw error
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret }
}

export async function verifyOwnerCode(code: string, factorId?: string): Promise<void> {
  const client = await getOwnerClient()
  let id = factorId
  if (!id) {
    const { data, error } = await client.auth.mfa.listFactors()
    if (error) throw error
    id = data.totp[0]?.id
  }
  if (!id) throw new Error('No authenticator is available.')
  const { error } = await client.auth.mfa.challengeAndVerify({ factorId: id, code })
  if (error) throw new Error('The authenticator code was not accepted.')
  if (await ownerStage() !== 'ready') throw new Error('Authenticator verification did not complete.')
}

export async function signOutOwner() {
  const client = await getOwnerClient()
  await client.auth.signOut()
}
