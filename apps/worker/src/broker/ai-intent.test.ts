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
