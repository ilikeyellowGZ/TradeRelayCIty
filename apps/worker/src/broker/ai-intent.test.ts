import { describe, expect, it } from 'vitest'
import { answerBrokerQuestion } from './assistant'
import { brokerAiConfig, intentQuestion, requestBrokerIntent, type BrokerAiConfig } from './ai-intent'

const intent = (value: unknown) => ({
  id: 'provider-request-1', status: 'completed',
  output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(value) }] }],
  usage: { input_tokens: 31, output_tokens: 9 },
})
const providerResponse = (value: unknown) => new Response(JSON.stringify(intent(value)), { status: 200, headers: { 'content-type': 'application/json' } })

describe('broker AI intent boundary', () => {
  it('requires explicit server-side provider, model, and matching key', () => {
    expect(brokerAiConfig({ BROKER_AI_PROVIDER: 'openai', BROKER_AI_MODEL: 'gpt-test' })).toBeNull()
    expect(brokerAiConfig({ BROKER_AI_PROVIDER: 'openai', BROKER_AI_MODEL: '../bad', OPENAI_API_KEY: 'secret' })).toBeNull()
    expect(brokerAiConfig({ BROKER_AI_PROVIDER: 'openai', BROKER_AI_MODEL: 'gpt-test', OPENAI_API_KEY: 'secret' })).toMatchObject({ provider: 'openai', model: 'gpt-test' })
  })

  it('recognizes the existing Groq configuration and Gemini fallback without exposing a key', () => {
    expect(brokerAiConfig({ AI_PROVIDER: 'groq', AI_MODEL: 'openai/gpt-oss-20b', GROQ_API_KEY: 'groq-key', AI_FALLBACK_PROVIDER: 'gemini', AI_FALLBACK_MODEL: 'gemini-3.8-flash', GEMINI_API_KEY: 'gemini-key' })).toMatchObject({
      provider: 'groq', model: 'openai/gpt-oss-20b', fallback: { provider: 'gemini', model: 'gemini-3.8-flash' },
    })
    expect(brokerAiConfig({ BROKER_AI_PROVIDER: 'openai', BROKER_AI_MODEL: 'gpt-test', AI_PROVIDER: 'groq', AI_MODEL: 'openai/gpt-oss-20b', GROQ_API_KEY: 'groq-key' })).toBeNull()
  })

  it('classifies with Groq chat completions and validates token usage', async () => {
    const config = brokerAiConfig({ AI_PROVIDER: 'groq', AI_MODEL: 'openai/gpt-oss-20b', GROQ_API_KEY: 'test-secret' })!
    let body: Record<string, unknown> | undefined
    const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe('https://api.groq.com/openai/v1/chat/completions')
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer test-secret')
      body = JSON.parse(String(init?.body))
      return Response.json({ id: 'groq-1', choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: '{"intent":"BALANCE","symbol":null}' } }], usage: { prompt_tokens: 12, completion_tokens: 9 } })
    }) as typeof fetch
    expect(await requestBrokerIntent(config, 'How much cash do I have?', ['EURUSD'], fetcher)).toMatchObject({ intent: 'BALANCE', provider: 'groq', model: 'openai/gpt-oss-20b', inputTokens: 12, outputTokens: 9 })
    expect(body).toMatchObject({ max_completion_tokens: 1024, response_format: { type: 'json_schema', json_schema: { strict: true } } })
    expect(JSON.stringify(body)).not.toContain('test-secret')
  })

  it('falls back once to Gemini on a Groq outage', async () => {
    const config = brokerAiConfig({ AI_PROVIDER: 'groq', AI_MODEL: 'openai/gpt-oss-20b', GROQ_API_KEY: 'groq-key', AI_FALLBACK_PROVIDER: 'gemini', AI_FALLBACK_MODEL: 'gemini-3.8-flash', GEMINI_API_KEY: 'gemini-key' })!
    const urls: string[] = []
    const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
      urls.push(String(url))
      if (urls.length === 1) return Response.json({ error: 'Unavailable' }, { status: 503 })
      expect(new Headers(init?.headers).get('x-goog-api-key')).toBe('gemini-key')
      const body = JSON.parse(String(init?.body))
      expect(body.generationConfig).toMatchObject({ responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: { type: 'object' } } } })
      return Response.json({ responseId: 'gemini-1', candidates: [{ finishReason: 'STOP', content: { role: 'model', parts: [{ text: '{"intent":"EQUITY","symbol":null}' }] } }], usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 8 } })
    }) as typeof fetch
    expect(await requestBrokerIntent(config, 'What is the account worth?', [], fetcher)).toMatchObject({ intent: 'EQUITY', provider: 'gemini', inputTokens: 20, outputTokens: 8 })
    expect(urls).toEqual(['https://api.groq.com/openai/v1/chat/completions', 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent'])
  })

  it('does not use a fallback to bypass a provider refusal or invalid symbol', async () => {
    const config = brokerAiConfig({ AI_PROVIDER: 'groq', AI_MODEL: 'openai/gpt-oss-20b', GROQ_API_KEY: 'groq-key', AI_FALLBACK_PROVIDER: 'gemini', AI_FALLBACK_MODEL: 'gemini-3.8-flash', GEMINI_API_KEY: 'gemini-key' })!
    for (const message of [{ refusal: 'No' }, { content: '{"intent":"POSITIONS","symbol":"GBPUSD"}' }]) {
      let calls = 0
      const fetcher = (async () => { calls++; return Response.json({ choices: [{ finish_reason: 'stop', message }] }) }) as typeof fetch
      await expect(requestBrokerIntent(config, 'Show my positions', ['EURUSD'], fetcher)).rejects.toThrow(/BROKER_AI_(REFUSAL|INVALID_RESPONSE)/)
      expect(calls).toBe(1)
    }
  })

  it('uses OpenAI Responses with no stored response and validates the intent', async () => {
    const config: BrokerAiConfig = { provider: 'openai', model: 'gpt-test', key: 'test-secret' }
    let request: { url: string; init: RequestInit } | undefined
    const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
      request = { url: String(url), init: init! }
      return providerResponse({ intent: 'BALANCE', symbol: null })
    }) as typeof fetch
    const result = await requestBrokerIntent(config, 'How much money is in my account?', ['EURUSD'], fetcher)
    expect(result).toMatchObject({ intent: 'BALANCE', symbol: null, provider: 'openai', inputTokens: 31, outputTokens: 9 })
    expect(request?.url).toBe('https://api.openai.com/v1/responses')
    const body = JSON.parse(String(request?.init.body)) as Record<string, unknown>
    expect(body).toMatchObject({ store: false, max_output_tokens: 256, text: { format: { type: 'json_schema' } } })
    expect(String(request?.init.body)).not.toContain('test-secret')
    expect(request?.init.headers).toMatchObject({ authorization: 'Bearer test-secret' })
  })

  it('uses Anthropic Messages with structured output and validates a position symbol', async () => {
    const config: BrokerAiConfig = { provider: 'anthropic', model: 'claude-test', key: 'test-secret' }
    let request: { url: string; init: RequestInit } | undefined
    const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
      request = { url: String(url), init: init! }
      return new Response(JSON.stringify({ id: 'msg-1', stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ intent: 'POSITIONS', symbol: 'EURUSD' }) }], usage: { input_tokens: 20, output_tokens: 5 } }), { status: 200 })
    }) as typeof fetch
    expect(await requestBrokerIntent(config, 'Show my EURUSD exposure', ['EURUSD'], fetcher)).toMatchObject({ intent: 'POSITIONS', symbol: 'EURUSD', provider: 'anthropic' })
    expect(request?.url).toBe('https://api.anthropic.com/v1/messages')
    expect(request?.init.headers).toMatchObject({ 'anthropic-version': '2026-10-21' })
    expect(JSON.parse(String(request?.init.body))).toMatchObject({ output_config: { format: { type: 'json_schema' } } })
  })

  it('uses xAI Responses and rejects invented symbols, refusals, and incomplete output', async () => {
    const config: BrokerAiConfig = { provider: 'xai', model: 'grok-test', key: 'test-secret' }
    const fetcher = (async (url: string | URL | Request) => {
      expect(String(url)).toBe('https://api.x.ai/v1/responses')
      return providerResponse({ intent: 'MARGIN_FREE', symbol: null })
    }) as typeof fetch
    expect((await requestBrokerIntent(config, 'What funds are available?', [], fetcher)).intent).toBe('MARGIN_FREE')
    const invented = (async () => providerResponse({ intent: 'POSITIONS', symbol: 'GBPUSD' })) as typeof fetch
    await expect(requestBrokerIntent(config, 'Show my positions', ['EURUSD'], invented)).rejects.toThrow('BROKER_AI_INVALID_RESPONSE')
    const refused = (async () => new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'refusal', refusal: 'No' }] }] }), { status: 200 })) as typeof fetch
    await expect(requestBrokerIntent(config, 'Show my positions', [], refused)).rejects.toThrow('BROKER_AI_REFUSAL')
    const incomplete = (async () => new Response(JSON.stringify({ ...intent({ intent: 'BALANCE', symbol: null }), status: 'incomplete' }), { status: 200 })) as typeof fetch
    await expect(requestBrokerIntent(config, 'Balance', [], incomplete)).rejects.toThrow('BROKER_AI_INCOMPLETE')
  })

  it('maps an unsupported classification to a deterministic unavailable answer', () => {
    const question = intentQuestion('UNSUPPORTED', null)
    const snapshot = {
      observedAt: '2026-11-18T08:00:00.000Z',
      account: { broker: 'FxPro', server: 'Demo', login: '123', environment: 'DEMO' as const, currency: 'USD', balance: 100, equity: 100, marginUsed: 0, marginFree: 100, floatingProfit: 0 },
      positions: [],
    }
    expect(answerBrokerQuestion(question, snapshot).supported).toBe(false)
  })
})
