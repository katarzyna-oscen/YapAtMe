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
    model:    'claude-3-5-sonnet-20240620',
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

const ANTHROPIC_MODEL_ALIASES = {
  'claude-sonnet-4-7': 'claude-3-5-sonnet-20240620',
  'claude-sonnet-4-6': 'claude-3-5-sonnet-20241022',
  'claude-sonnet-4-5': 'claude-3-5-sonnet-20241022',
  'claude-3-5-sonnet-latest': 'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-latest': 'claude-haiku-4-5-20251001',
  'claude-3-5-haiku-20241022': 'claude-haiku-4-5-20251001',
  'claude-3-haiku-latest': 'claude-haiku-4-5-20251001',
  'claude-3-haiku-20240307': 'claude-haiku-4-5-20251001',
  'claude-3-opus-latest': 'claude-3-opus-20240229',
}

function normalizeModelForProvider(provider, model) {
  let normalized = String(model || '').trim()
  if (!normalized) return normalized

  // If a model ID copied from OpenRouter is used with Anthropic directly,
  // convert `anthropic/...` to Anthropic-native model names.
  if (provider === 'anthropic') {
    if (normalized.startsWith('anthropic/')) {
      normalized = normalized.slice('anthropic/'.length)
    }
    normalized = ANTHROPIC_MODEL_ALIASES[normalized] || normalized
  }

  return normalized
}

function anthropicModelCandidates(model) {
  const initial = normalizeModelForProvider('anthropic', model)
  const out = []
  const add = (m) => {
    const value = String(m || '').trim()
    if (!value) return
    if (!out.includes(value)) out.push(value)
  }

  add(initial)

  // Generic alias softening.
  if (initial.endsWith('-latest')) {
    add(initial.replace(/-latest$/, ''))
  }

  // Family fallback safety net in case upstream aliasing changes.
  const lower = initial.toLowerCase()
  if (lower.includes('haiku')) {
    // Some Anthropic accounts expose only a subset of model snapshots.
    // Try the requested generation first, then progressively older/wider ones.
    add('claude-haiku-4-5-20251001')
    add('claude-3-5-haiku-20241022')
    add('claude-3-haiku-20240307')
    add('claude-3-5-sonnet-20241022')
    add('claude-3-5-sonnet-20240620')
  } else if (lower.includes('opus')) {
    add('claude-3-opus-20240229')
    add('claude-3-5-sonnet-20241022')
    add('claude-3-5-sonnet-20240620')
  } else {
    add('claude-3-5-sonnet-20241022')
    add('claude-3-5-sonnet-20240620')
    add('claude-3-haiku-20240307')
  }

  // Absolute final safety net if family detection misses edge-case naming.
  if (!lower.includes('haiku') && !lower.includes('opus')) {
    add('claude-3-5-sonnet-20241022')
    add('claude-3-5-sonnet-20240620')
  }

  return out
}

// Resolve effective values: fall back to provider defaults for empty fields.
function resolve(settings) {
  const def = PROVIDERS[settings.provider] ?? PROVIDERS.openrouter
  const provider = settings.provider
  const resolvedModel = normalizeModelForProvider(provider, settings.model || def.model)
  return {
    provider,
    apiKey:   settings.apiKey  || '',
    model:    resolvedModel,
    baseUrl:  settings.baseUrl || def.baseUrl,
  }
}

function isAuthErrorMessage(message = '') {
  const m = String(message || '').toLowerCase()
  return m.includes('401') || m.includes('403') || m.includes('unauthorized') || m.includes('invalid api key') || m.includes('api key')
}

function isRetryableLLMError(message = '') {
  const m = String(message || '').toLowerCase()
  return m.includes('unexpected end of json input')
    || m.includes('networkerror')
    || m.includes('failed to fetch')
    || m.includes('timed out')
    || m.includes('502')
    || m.includes('503')
    || m.includes('504')
}

async function requestText(url, options) {
  if (typeof window !== 'undefined' && window.electronAPI?.httpRequest) {
    const response = await window.electronAPI.httpRequest({
      url,
      method: options?.method,
      headers: options?.headers,
      body: options?.body,
    })

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      text: async () => response.body,
    }
  }

  // Standalone launcher (tools/yapatme.cjs) injects this marker. Route provider
  // calls through the local same-origin proxy so there are no CORS issues and
  // we don't need Chrome's unstable --disable-web-security flag.
  if (typeof window !== 'undefined' && window.__YAPATME_PROXY__) {
    const response = await fetch(window.__YAPATME_PROXY__, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        method: options?.method,
        headers: options?.headers,
        body: options?.body,
      }),
    })
    const data = await response.json()
    if (data.error) throw new Error(data.error)
    return {
      ok: data.ok,
      status: data.status,
      statusText: data.statusText,
      text: async () => data.body,
    }
  }

  return fetch(url, options)
}

async function parseJsonResponse(res) {
  const raw = await res.text()
  if (!raw || !raw.trim()) {
    throw new Error('LLM returned an empty response body')
  }

  try {
    return JSON.parse(raw)
  } catch (err) {
    const snippet = raw.slice(0, 180).replace(/\s+/g, ' ')
    throw new Error(`Unexpected end of JSON input (provider response parse failed): ${snippet}`)
  }
}

async function withRetry(task, attempts = 2) {
  let lastErr
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await task()
    } catch (err) {
      lastErr = err
      const canRetry = i < attempts - 1 && isRetryableLLMError(err?.message || '')
      if (!canRetry) break
    }
  }
  throw lastErr
}

async function callOpenAICompat(messages, systemPrompt, { apiKey, model, baseUrl }, maxTokens = 4096) {
  return withRetry(async () => {
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

    const res = await requestText(url, { method: 'POST', headers, body: JSON.stringify(body) })
    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText)
      throw new Error(`LLM error ${res.status}: ${err}`)
    }
    const data = await parseJsonResponse(res)
    return data.choices?.[0]?.message?.content ?? ''
  })
}

async function callAnthropic(messages, systemPrompt, { apiKey, model, baseUrl }, maxTokens = 4096) {
  return withRetry(async () => {
    const url = `${baseUrl.replace(/\/$/, '')}/v1/messages`
    const headers = {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
      // Anthropic requires this explicit opt-in for direct browser usage.
      // Without it, requests from the app can fail with a generic "Failed to fetch".
      'anthropic-dangerous-direct-browser-access': 'true',
    }

    const candidates = anthropicModelCandidates(model)
    let lastModelErr = ''

    for (const candidateModel of candidates) {
      const body = {
        model: candidateModel,
        max_tokens: maxTokens,
        ...(systemPrompt ? { system: systemPrompt } : {}),
        messages,
      }

      const res = await requestText(url, { method: 'POST', headers, body: JSON.stringify(body) })
      if (!res.ok) {
        const err = await res.text().catch(() => res.statusText)
        const modelNotFound = res.status === 404 && /not_found_error|model/i.test(String(err || ''))
        if (modelNotFound) {
          lastModelErr = String(err || '')
          continue
        }
        throw new Error(`LLM error ${res.status}: ${err}`)
      }

      const data = await parseJsonResponse(res)
      return data.content?.[0]?.text ?? ''
    }

    throw new Error(
      `LLM error 404: model not found. Tried: ${candidates.join(', ')}${lastModelErr ? ` | ${lastModelErr}` : ''}`
    )
  })
}

export async function callLLM(messages, systemPrompt, settings, maxTokens = 4096) {
  const r = resolve(settings)
  if (!r.apiKey && PROVIDERS[r.provider]?.needsKey) {
    throw new Error('Missing API key for selected provider')
  }
  if (r.provider === 'anthropic') {
    return callAnthropic(messages, systemPrompt, r, maxTokens)
  }
  return callOpenAICompat(messages, systemPrompt, r, maxTokens)
}

export { isAuthErrorMessage, normalizeModelForProvider }
