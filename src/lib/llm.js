// Single LLM abstraction for all providers.
// callLLM(messages, systemPrompt, settings) → string

// messages: Array<{ role: 'user'|'assistant', content: string }>
// systemPrompt: string
// settings: { provider, apiKey, model, baseUrl }

export const PROVIDERS = {
  openrouter: {
    label:    'OpenRouter',
    baseUrl:  'https://openrouter.ai/api/v1',
    model:    'anthropic/claude-3.5-sonnet',
    needsKey: true,
  },
  anthropic: {
    label:    'Anthropic',
    baseUrl:  'https://api.anthropic.com',
    model:    'claude-sonnet-4-5',
    needsKey: true,
  },
  openai: {
    label:    'OpenAI',
    baseUrl:  'https://api.openai.com/v1',
    model:    'gpt-4o',
    needsKey: true,
  },
  ollama: {
    label:    'Ollama (local)',
    baseUrl:  'http://localhost:11434/v1',
    model:    'llama3.2',
    needsKey: false,
  },
  custom: {
    label:    'Custom endpoint',
    baseUrl:  '',
    model:    '',
    needsKey: false,
  },
}

export const DEFAULT_SETTINGS = {
  provider: 'openrouter',
  apiKey:   '',
  model:    '',
  baseUrl:  '',
}

// Resolve effective values: fall back to provider defaults for empty fields.
function resolve(settings) {
  const def = PROVIDERS[settings.provider] ?? PROVIDERS.openrouter
  return {
    provider: settings.provider,
    apiKey:   settings.apiKey  || '',
    model:    settings.model   || def.model,
    baseUrl:  settings.baseUrl || def.baseUrl,
  }
}

async function callOpenAICompat(messages, systemPrompt, { apiKey, model, baseUrl }, maxTokens = 4096) {
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`
  const headers = { 'Content-Type': 'application/json' }
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

  const body = {
    model,
    messages: [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      ...messages,
    ],
    max_tokens: maxTokens,
  }

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    throw new Error(`LLM error ${res.status}: ${err}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

async function callAnthropic(messages, systemPrompt, { apiKey, model, baseUrl }, maxTokens = 4096) {
  const url = `${baseUrl.replace(/\/$/, '')}/v1/messages`
  const headers = {
    'Content-Type':      'application/json',
    'x-api-key':         apiKey,
    'anthropic-version': '2023-06-01',
  }

  const body = {
    model,
    max_tokens: maxTokens,
    ...(systemPrompt ? { system: systemPrompt } : {}),
    messages,
  }

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    throw new Error(`LLM error ${res.status}: ${err}`)
  }
  const data = await res.json()
  return data.content?.[0]?.text ?? ''
}

export async function callLLM(messages, systemPrompt, settings, maxTokens = 4096) {
  const r = resolve(settings)
  if (r.provider === 'anthropic') {
    return callAnthropic(messages, systemPrompt, r, maxTokens)
  }
  return callOpenAICompat(messages, systemPrompt, r, maxTokens)
}
