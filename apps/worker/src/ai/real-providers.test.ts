import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestRealProvider } from './real-providers'

const holdOpinion = {
  decision: 'HOLD', symbol: null, entry: null, stop: null, target: null,
  rationale: 'No valid setup.', invalidation: 'None.', modelScore: null,
}
const input = { snapshotId: 'snapshot-1', candidate: null, marketSnapshot: { closedBars: [] }, historicalSummary: null }

afterEach(() => vi.unstubAllGlobals())

describe('Groq provider adapter', () => {
  it('sends a bounded structured request to Groq using GPT OSS 20B by default', async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => Response.json({
      id: 'chatcmpl-test',
      choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(holdOpinion) } }],
      usage: { prompt_tokens: 12, completion_tokens: 6, total_tokens: 18 },
    }))
    vi.stubGlobal('fetch', fetcher)

    const result = await requestRealProvider({ AI_PROVIDER: 'groq', AI_MODEL: '', GROQ_API_KEY: 'test-only-key' }, input)

    expect(result).toMatchObject({ provider: 'groq', model: 'openai/gpt-oss-20b', requestId: 'chatcmpl-test', inputTokens: 12, outputTokens: 6, opinion: { decision: 'HOLD' } })
    expect(fetcher).toHaveBeenCalledTimes(1)
    const [url, init] = fetcher.mock.calls[0]
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions')
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer test-only-key')
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>
    expect(body.model).toBe('openai/gpt-oss-20b')
    expect(body.response_format).toMatchObject({ type: 'json_schema', json_schema: { strict: true } })
    expect(body.max_completion_tokens).toBe(700)
  })

  it('uses the selected Qwen model on the Groq endpoint', async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => Response.json({
      choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(holdOpinion) } }],
    }))
    vi.stubGlobal('fetch', fetcher)

    const result = await requestRealProvider({ AI_PROVIDER: 'groq', AI_MODEL: 'qwen/qwen3.8-27b', GROQ_API_KEY: 'test-only-key' }, input)

    expect(result.model).toBe('qwen/qwen3.8-27b')
    expect(fetcher.mock.calls[0][0]).toBe('https://api.groq.com/openai/v1/chat/completions')
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toMatchObject({ model: 'qwen/qwen3.8-27b' })
  })

  it('rejects an unsupported model before sending a request', async () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)

    await expect(requestRealProvider({ AI_PROVIDER: 'groq', AI_MODEL: 'qwen-2.8-27b', GROQ_API_KEY: 'test-only-key' }, input)).rejects.toThrow('AI_MODEL_NOT_SUPPORTED')
    expect(fetcher).not.toHaveBeenCalled()
  })
})

describe('Gemini provider and fallback', () => {
  const geminiResponse = () => Response.json({
    responseId: 'gemini-test',
    candidates: [{ finishReason: 'STOP', content: { role: 'model', parts: [{ text: JSON.stringify(holdOpinion) }] } }],
    usageMetadata: { promptTokenCount: 14, candidatesTokenCount: 8, totalTokenCount: 22 },
  })

  it('uses Gemini directly with a structured response when selected', async () => {
    const fetcher = vi.fn(async () => geminiResponse())
    vi.stubGlobal('fetch', fetcher)

    const result = await requestRealProvider({ AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'gemini-test-key' }, input)

    expect(result).toMatchObject({ provider: 'gemini', model: 'gemini-3.8-flash', requestId: 'gemini-test', inputTokens: 14, outputTokens: 8, opinion: holdOpinion })
    expect(fetcher).toHaveBeenCalledTimes(1)
    const [url, init] = fetcher.mock.calls[0]
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent')
    expect(new Headers(init?.headers).get('x-goog-api-key')).toBe('gemini-test-key')
    const body = JSON.parse(String(init?.body))
    expect(body.contents).toEqual([{ role: 'user', parts: [{ text: JSON.stringify({ snapshotId: input.snapshotId, candidate: input.candidate, marketSnapshot: input.marketSnapshot, historicalSummary: input.historicalSummary }) }] }])
    expect(body.systemInstruction.parts[0].text).toContain('Return HOLD unless')
    expect(body.generationConfig).toMatchObject({ maxOutputTokens: 2048, thinkingConfig: { thinkingLevel: 'LOW' }, responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: { type: 'object', additionalProperties: false } } } })
  })

  it('falls back once to Gemini when Groq fails', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json({ error: { message: 'unavailable' } }, { status: 503 }))
      .mockResolvedValueOnce(geminiResponse())
    vi.stubGlobal('fetch', fetcher)

    const result = await requestRealProvider({ AI_PROVIDER: 'groq', GROQ_API_KEY: 'groq-test-key', AI_FALLBACK_PROVIDER: 'gemini', GEMINI_API_KEY: 'gemini-test-key' }, input)

    expect(result.provider).toBe('gemini')
    expect(result.opinion.decision).toBe('HOLD')
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher.mock.calls[0][0]).toBe('https://api.groq.com/openai/v1/chat/completions')
    expect(fetcher.mock.calls[1][0]).toContain('/models/gemini-3.8-flash:generateContent')
  })

  it('does not call Gemini when Groq succeeds', async () => {
    const fetcher = vi.fn(async () => Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(holdOpinion) } }] }))
    vi.stubGlobal('fetch', fetcher)

    const result = await requestRealProvider({ AI_PROVIDER: 'groq', GROQ_API_KEY: 'groq-test-key', AI_FALLBACK_PROVIDER: 'gemini', GEMINI_API_KEY: 'gemini-test-key' }, input)

    expect(result.provider).toBe('groq')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('does not use Gemini to bypass an explicit Groq refusal', async () => {
    const fetcher = vi.fn(async () => Response.json({ choices: [{ finish_reason: 'stop', message: { refusal: 'cannot answer' } }] }))
    vi.stubGlobal('fetch', fetcher)

    await expect(requestRealProvider({ AI_PROVIDER: 'groq', GROQ_API_KEY: 'groq-test-key', AI_FALLBACK_PROVIDER: 'gemini', GEMINI_API_KEY: 'gemini-test-key' }, input)).rejects.toThrow('AI_PROVIDER_REFUSAL')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('fails closed when both providers fail', async () => {
    const fetcher = vi.fn(async () => Response.json({ error: 'unavailable' }, { status: 503 }))
    vi.stubGlobal('fetch', fetcher)

    await expect(requestRealProvider({ AI_PROVIDER: 'groq', GROQ_API_KEY: 'groq-test-key', AI_FALLBACK_PROVIDER: 'gemini', GEMINI_API_KEY: 'gemini-test-key' }, input)).rejects.toThrow('AI_ALL_PROVIDERS_FAILED')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
