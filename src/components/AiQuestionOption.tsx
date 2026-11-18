import { useEffect, useState } from 'react'

type AiCapability = { available: boolean; provider: string | null; dailyLimit: number }

export function useAiCapability(source: 'broker' | 'simulation') {
  const [capability, setCapability] = useState<AiCapability | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    void fetch(`/api/${source}/ai-capabilities`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => response.ok ? response.json() as Promise<AiCapability> : null)
      .then((result) => { if (!controller.signal.aborted) setCapability(result) })
      .catch(() => { if (!controller.signal.aborted) setCapability(null) })
    return () => controller.abort()
  }, [source])
  return capability
}

export function AiQuestionOption({ capability, checked, busy, onChange }: { capability: AiCapability | null; checked: boolean; busy: boolean; onChange: (value: boolean) => void }) {
  return <label className="broker-ai-option"><input type="checkbox" checked={checked} disabled={!capability?.available || busy} onChange={(event) => onChange(event.target.checked)} /><span>Use AI to interpret my question<small>{capability?.available ? `Sends the text you type and symbol names to ${capability.provider}. Stored account values stay on TradeRelayCity. Limit ${capability.dailyLimit} replies per UTC day.` : 'AI is unavailable until a server-side provider is configured. Stored-record answers remain available.'}</small></span></label>
}
