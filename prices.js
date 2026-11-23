/**
 * OpenCode Go model rate table.
 *
 * Rates are US dollars per one million tokens and come from OpenCode's Go
 * model catalog. The display layer never contains rates: every amount is
 * derived from this table (and from the per-record rate snapshot written when
 * the usage row is recorded).
 */
export const CURRENCY = 'USD'
export const PRICE_UNIT = 'USD per 1M tokens'

const model = (id, name, input, cacheRead, output) => ({ id, name, input, cacheRead, output })

export const MODELS = [
  model('deepseek-v4.1-flash', 'DeepSeek V4.1 Flash', 0.15, 0.003, 0.6),
  model('deepseek-v4-pro', 'DeepSeek V4 Pro', 0.66, 0.022, 1.98),
  model('glm-5.3', 'GLM-5.3', 1.4, 0.26, 4.4),
  model('glm-5.3-flash', 'GLM-5.3-Flash', 0.15, 0.03, 0.5),
  model('kimi-k3.1-pro', 'Kimi K3.1 Pro', 2, 0.2, 10),
  model('kimi-k3', 'Kimi K3', 3, 0.3, 15),
  model('kimi-k2.7-code', 'Kimi K2.7 Code', 0.95, 0.19, 4),
  model('qwen4-max', 'Qwen4 Max', 1.5, 0.075, 4.5),
  model('qwen3.8-max', 'Qwen3.8 Max', 2, 0.25, 6),
  model('qwen3.8-flash', 'Qwen3.8 Flash', 0.15, 0.016, 0.47),
  model('qwen3.7-plus', 'Qwen3.7 Plus', 0.4, 0.04, 1.6),
  model('minimax-m3.1-flash', 'MiniMax M3.1 Flash', 0.15, 0.015, 0.6),
  model('minimax-m3', 'MiniMax-M3', 0.3, 0.06, 1.2),
  model('mimo-v2.6-pro', 'MiMo-V2.6-Pro', 0.435, 0.003625, 0.87),
  model('mimo-v2.6-flash', 'MiMo-V2.6-Flash', 0.14, 0.0028, 0.28),
  model('gpt-6-luna', 'GPT-6 Luna', 0.1, 0.01, 0.5),
  model('gpt-5.6-luna', 'GPT-5.6 Luna', 0.2, 0.02, 1.2),
  model('claude-haiku-5-5', 'Claude Haiku 5.5', 0.1, 0.01, 0.5),
  model('gemini-4-argon', 'Gemini 4 Argon', 2, 0.1, 10),
  model('grok-4.7', 'Grok 4.7', 2, 0.5, 6),
  model('hy4', 'Hy4', 0.834, 0.042, 2.501),
  model('hy4-preview', 'Hy4 preview', 0.834, 0.042, 2.501),
  model('hy3', 'Hy3', 0.14, 0.035, 0.58),
  model('step-5-preview', 'Step 5 Preview', 1, 0.1, 2.7),
  model('longcat-2.5', 'LongCat-2.5', 0.3, 0.006, 1.2),
  model('muse-spark-1.3-contributor', 'Muse Spark 1.3 Contributor', 0.1, 0.002, 0.2),
  model('muse-spark-1.2-contributor', 'Muse Spark 1.2 Contributor', 0.1, 0.002, 0.2),
  model('beam-free', 'Beam Free', 0, 0, 0),
  model('iceman-contributor-free', 'Iceman Contributor Free', 0, 0, 0),
  model('hy4-flash-free', 'Hy4 flash Free', 0, 0, 0),
]

export const MODEL_BY_ID = new Map(MODELS.map((entry, index) => [entry.id, { ...entry, index }]))

const PALETTE = [
  '#4F7CFF', '#22B8A7', '#F59E0B', '#EF6A6A', '#8B5CF6',
  '#2DB55D', '#E0679A', '#0EA5E9', '#D97706', '#14B8A6',
]

/** Stable, distinct color per catalog model. */
export function colorFor(modelId) {
  const entry = MODEL_BY_ID.get(modelId)
  const index = entry?.index ?? MODELS.length
  if (index < PALETTE.length) return PALETTE[index]
  return `hsl(${Math.round((index * 137.508) % 360)} 60% 52%)`
}

/** The rate snapshot persisted beside one usage row. */
export function ratesFor(modelId) {
  const entry = MODEL_BY_ID.get(modelId)
  return {
    cacheHit: entry?.cacheRead ?? 0,
    cacheMiss: entry?.input ?? 0,
    output: entry?.output ?? 0,
    currency: CURRENCY,
    unit: PRICE_UNIT,
  }
}

/** Human display name for a model id, falling back to the id. */
export function displayNameFor(modelId) {
  return MODEL_BY_ID.get(modelId)?.name ?? modelId
}
