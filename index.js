import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { CURRENCY, MODEL_BY_ID, PRICE_UNIT, colorFor, displayNameFor, ratesFor } from './prices.js'

/** The requested statistics window begins at 2026-11-23 00:01 Beijing time. */
export const START_AT = Date.parse('2026-11-23T00:01:00+08:00')
export const BEIJING_OFFSET = 8 * 60 * 60 * 1000
const DAY = 24 * 60 * 60 * 1000
const PROVIDER = 'opencode-go'
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_READ_BATCH = 400
const LOOPBACK_HOST = /^(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/i
const QUOTA_URL = 'https://opencode.ai/inference/go/v1/usage'
const QUOTA_TIMEOUT_MS = 30_000
const QUOTA_BODY_LIMIT = 16 * 1024
const QUOTA_CREDENTIAL = 'dsh-opencode-go-usage/quota'
const QUOTA_WINDOWS = [
  { id: 'rolling', aliases: ['rolling', 'rolling5h', 'fivehour', 'five_hour', '5h', 'session'] },
  { id: 'weekly', aliases: ['weekly', 'week', 'weeklywindow'] },
  { id: 'monthly', aliases: ['monthly', 'month', 'monthlywindow'] },
]
const QUOTA_PERCENT_KEYS = ['percent', 'percentage', 'usedPercent', 'used_percent', 'percentUsed', 'usedPercentage', 'usagePercent', 'usage_percentage', 'usage_percent', 'utilization', 'pct']
const QUOTA_RESET_KEYS = ['resetsAt', 'resetAt', 'reset_at', 'resets_at', 'resets', 'reset']
const QUOTA_STATUS_KEYS = ['status', 'state']

function json(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(JSON.stringify(body))
}

function guard(req) {
  const host = String(req.headers?.host ?? '')
  if (!LOOPBACK_HOST.test(host)) return false
  const origin = req.headers?.origin
  if (origin !== undefined) {
    const scheme = req.socket?.encrypted === true ? 'https' : 'http'
    if (origin !== `${scheme}://${host}`) return false
  }
  const site = req.headers?.['sec-fetch-site']
  return site === undefined || site === 'same-origin' || site === 'none'
}

function quotaObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function findQuotaWindow(root, aliases, depth = 0) {
  if (depth > 6 || root === null || typeof root !== 'object') return undefined
  if (Array.isArray(root)) {
    for (const item of root) {
      const found = findQuotaWindow(item, aliases, depth + 1)
      if (found !== undefined) return found
    }
    return undefined
  }
  if (!quotaObject(root)) return undefined
  for (const [key, value] of Object.entries(root)) {
    if (aliases.includes(key.toLowerCase()) && quotaObject(value)) return value
  }
  for (const value of Object.values(root)) {
    const found = findQuotaWindow(value, aliases, depth + 1)
    if (found !== undefined) return found
  }
  return undefined
}

function quotaField(node, keys) {
  for (const key of keys) {
    for (const [name, value] of Object.entries(node)) {
      if (name.toLowerCase() === key.toLowerCase() && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')) return value
    }
  }
  return undefined
}

function quotaNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const match = value.trim().match(/^-?\d+(?:\.\d+)?/)
  if (match === null) return null
  const parsed = Number(match[0])
  return Number.isFinite(parsed) ? parsed : null
}

function quotaStatus(value) {
  return typeof value === 'string' && value.length <= 80 ? value : ''
}

function quotaTime(value) {
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const millis = value < 1e12 ? value * 1000 : value
    const date = new Date(millis)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }
  return null
}

/**
 * Normalize the OpenCode Zen/Go usage payload into the three windows the page
 * renders. The API's canonical shape is { usage: { rolling, weekly, monthly } },
 * but older and compatible payloads are accepted too.
 */
export function normalizeQuota(payload) {
  const windows = []
  for (const spec of QUOTA_WINDOWS) {
    const node = findQuotaWindow(payload, spec.aliases)
    if (node === undefined) continue
    const percent = quotaNumber(quotaField(node, QUOTA_PERCENT_KEYS))
    if (percent === null) continue
    windows.push({
      id: spec.id,
      percent: Math.max(0, Math.min(100, percent)),
      resetsAt: quotaTime(quotaField(node, QUOTA_RESET_KEYS)),
      status: quotaStatus(quotaField(node, QUOTA_STATUS_KEYS)),
    })
  }
  return windows
}

function normalizeApiKey(value) {
  if (typeof value !== 'string') return ''
  const key = value.trim().replace(/^Bearer\s+/i, '').trim()
  if (key.length < 8 || key.length > 512) return ''
  if (!/^[\x21-\x7e]+$/.test(key)) return ''
  return key
}

async function readBoundedBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
    size += buffer.length
    if (size > QUOTA_BODY_LIMIT) {
      req.resume?.()
      return null
    }
    chunks.push(buffer)
  }
  return Buffer.concat(chunks, size).toString('utf8')
}

async function fetchQuota(key) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), QUOTA_TIMEOUT_MS)
  let response
  let text
  try {
    response = await fetch(QUOTA_URL, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${key}`,
        accept: 'application/json',
        'user-agent': 'dsh-opencode-go-usage/0.2.5',
      },
      signal: controller.signal,
      redirect: 'follow',
      cache: 'no-store',
    })
    text = await response.text()
  } catch (error) {
    const timeout = error?.name === 'AbortError'
    return {
      status: timeout ? 504 : 502,
      body: { error: timeout ? 'timeout' : 'network' },
    }
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    const known = response.status === 401
      ? 'unauthorized'
      : response.status === 403
        ? 'forbidden'
        : response.status === 404
          ? 'not-found'
          : response.status === 429
            ? 'rate-limited'
            : 'upstream'
    return {
      status: response.status >= 400 && response.status < 500 ? response.status : 502,
      body: { error: known, upstreamStatus: response.status },
    }
  }

  let payload
  try {
    payload = JSON.parse(text)
  } catch {
    return { status: 502, body: { error: 'bad-response' } }
  }
  const windows = normalizeQuota(payload)
  if (windows.length === 0) return { status: 502, body: { error: 'bad-response' } }
  return {
    status: 200,
    body: {
      ok: true,
      fetchedAt: new Date().toISOString(),
      windows,
    },
  }
}

function resolveHome() {
  const configured = process.env.DSH_HOME?.trim()
  if (configured) return path.resolve(configured)
  return path.join(os.homedir(), '.dsh')
}

function dayStart(date) {
  const [year, month, day] = date.split('-').map(Number)
  return Date.UTC(year, month - 1, day) - BEIJING_OFFSET
}

function beijingDay(time) {
  return new Date(time + BEIJING_OFFSET).toISOString().slice(0, 10)
}

function validDate(date) {
  if (typeof date !== 'string' || !DATE_RE.test(date)) return false
  return beijingDay(dayStart(date)) === date
}

function addDays(date, delta) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + delta)).toISOString().slice(0, 10)
}

function nonNegative(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

function usageOf(event) {
  const direct = event.data?.usage
  if (direct !== undefined) return direct
  if (event.type !== 'assistant/message' && event.type !== 'assistant/attempt') return undefined
  const stream = event.data?.stream
  if (!Array.isArray(stream)) return undefined
  for (let index = stream.length - 1; index >= 0; index -= 1) {
    const record = stream[index]
    if (record?.type === 'chunk' && record.chunk?.type === 'usage') return record.chunk.usage
  }
  return undefined
}

function costOf(row) {
  const { cacheHit = 0, cacheMiss = 0, output = 0 } = row.tokens ?? {}
  const current = MODEL_BY_ID.get(row.model)
  const rates = current === undefined
    ? row.rates ?? {}
    : { cacheHit: current.cacheRead, cacheMiss: current.input, output: current.output }
  return (
    cacheHit * (rates.cacheHit ?? 0) / 1_000_000
    + cacheMiss * (rates.cacheMiss ?? 0) / 1_000_000
    + output * (rates.output ?? 0) / 1_000_000
  )
}

function nameOf(row) {
  return MODEL_BY_ID.get(row.model)?.name ?? row.name ?? row.model
}

function tokenTotal(row) {
  const { cacheHit = 0, cacheMiss = 0, output = 0 } = row.tokens ?? {}
  return cacheHit + cacheMiss + output
}

function buildRecord(sessionId, event, state, usage) {
  // A settled answer owns its actual model identity. A request header is only
  // the fallback for attempts (or older messages) without a source envelope.
  const source = event.data?.message?.source
  const provider = typeof source?.provider === 'string' ? source.provider : state.provider
  const model = typeof source?.model === 'string' ? source.model : state.model
  if (provider !== PROVIDER || typeof model !== 'string' || model.length === 0) return undefined
  if (typeof event.time !== 'number' || event.time < START_AT) return undefined
  const cacheHit = nonNegative(usage?.cacheReadTokens)
  const cacheMiss = nonNegative(usage?.inputTokens) + nonNegative(usage?.cacheWriteTokens)
  const output = nonNegative(usage?.outputTokens)
  if (cacheHit + cacheMiss + output === 0) return undefined
  const rates = ratesFor(model)
  return {
    v: 1,
    id: `${sessionId}:${event.seq}`,
    at: event.time,
    session: sessionId,
    seq: event.seq,
    kind: event.type === 'assistant/message' ? 'message' : 'attempt',
    provider: PROVIDER,
    model,
    name: displayNameFor(model),
    rates,
    tokens: { cacheHit, cacheMiss, output },
  }
}

function rememberHeader(state, event) {
  if (event?.type !== 'request/header') return
  const config = event.data?.header?.config
  if (typeof config?.provider === 'string') state.provider = config.provider
  if (typeof config?.model === 'string') state.model = config.model
  if (typeof event.seq === 'number') state.headerSeq = event.seq
}

/**
 * OpenCode Go usage store. Reads model-call settlements from the durable
 * Session event feed, writes a compact JSONL ledger, and serves a small
 * read-only summary route to the Settings page.
 * @param ctx - Host plugin context.
 */
export function apply(ctx) {
  // Keep this plugin's saved key separate from model-provider credentials.
  // The host owns locking, atomic writes, and the credentials document format.
  const credentialStore = () => {
    const store = typeof ctx.get === 'function' ? ctx.get('credentials') : ctx.credentials
    if (!store?.readRecord || !store?.modifyRecord || !store?.deleteRecord) throw new Error('credential-storage')
    return store
  }
  const savedQuotaKey = async () => {
    const record = await credentialStore().readRecord(QUOTA_CREDENTIAL)
    return record?.kind === 'api-key' ? normalizeApiKey(record.key) : ''
  }
  let keyMutation = Promise.resolve()
  const mutateKey = operation => {
    const pending = keyMutation.then(operation)
    keyMutation = pending.catch(() => {})
    return pending
  }
  const dataDir = path.join(resolveHome(), 'storages', 'opencode-go-usage')
  const ledger = path.join(dataDir, 'usage.jsonl')
  const rows = new Map()
  const headers = new Map()
  const scannedRevisions = new Map()

  try {
    fs.mkdirSync(dataDir, { recursive: true })
  } catch (error) {
    ctx.logger?.warn?.(`opencode-go-usage: cannot create ${dataDir}: ${String(error)}`)
  }

  try {
    let text = fs.readFileSync(ledger, 'utf8')
    const lastNewline = text.lastIndexOf('\n')
    if (lastNewline !== text.length - 1) {
      // A crash can leave a torn final line. Drop it before appending so the
      // next record cannot join the partial JSON.
      const keep = lastNewline + 1
      try {
        fs.truncateSync(ledger, Buffer.byteLength(text.slice(0, keep), 'utf8'))
        text = text.slice(0, keep)
      } catch {
        // If truncation is not possible, keep the readable prefix in memory.
        text = text.slice(0, keep)
      }
    }
    for (const line of text.split('\n')) {
      if (!line.trim()) continue
      try {
        const row = JSON.parse(line)
        if (row?.id && row?.tokens && typeof row.at === 'number') rows.set(row.id, row)
      } catch {
        // A malformed middle line is skipped; later records remain readable.
      }
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      ctx.logger?.warn?.(`opencode-go-usage: cannot read ${ledger}: ${String(error)}`)
    }
  }

  const append = row => {
    const old = rows.get(row.id)
    if (old !== undefined && old.provider === row.provider && old.model === row.model
      && old.at === row.at && old.kind === row.kind
      && old.tokens?.cacheHit === row.tokens.cacheHit
      && old.tokens?.cacheMiss === row.tokens.cacheMiss
      && old.tokens?.output === row.tokens.output) return
    // Corrections are append-only; loading the ledger already keeps the last
    // record for an id, so repairing attribution never double-counts a call.
    rows.set(row.id, row)
    try {
      fs.appendFileSync(ledger, `${JSON.stringify(row)}\n`, 'utf8')
    } catch (error) {
      ctx.logger?.warn?.(`opencode-go-usage: cannot append ${ledger}: ${String(error)}`)
    }
  }

  ctx.on('session/event', (session, event) => {
    let state = headers.get(session.id)
    if (state === undefined) {
      state = {}
      headers.set(session.id, state)
    }
    if (event.type === 'request/header') {
      rememberHeader(state, event)
      return
    }
    const usage = usageOf(event)
    if (usage === undefined) return
    const row = buildRecord(session.id, event, state, usage)
    if (row !== undefined) append(row)
  })

  const backfill = async () => {
    const persistence = ctx.sessionPersistence
    if (persistence === undefined) return
    let snapshots
    try {
      snapshots = await persistence.list()
    } catch (error) {
      ctx.logger?.warn?.(`opencode-go-usage: cannot list sessions: ${String(error)}`)
      return
    }
    let live = new Set()
    try {
      live = new Set(ctx.sessions.list().map(session => session.id))
    } catch {
      // A missing live registry only narrows the backfill; new events still arrive live.
    }
    for (const snapshot of snapshots) {
      const createdAt = snapshot.header?.createdAt ?? 0
      let fileTime = 0
      let fileRevision
      const location = snapshot.location
      if (location?.kind === 'jsonl' && typeof location.path === 'string') {
        try {
          const stat = fs.statSync(location.path)
          fileTime = stat.mtimeMs
          fileRevision = `${stat.mtimeMs}:${stat.size}`
        } catch {
          // A session removed between list and stat simply has no new usage.
        }
      }
      if (createdAt < START_AT && fileTime < START_AT && !live.has(snapshot.header.id)) continue
      const revision = snapshot.revision ?? fileRevision
      if (revision !== undefined && scannedRevisions.get(snapshot.header.id) === revision) continue
      let handle
      try {
        handle = await persistence.open(snapshot.header.id, 'read')
        const inheritedCut = Number(handle.inheritedEventCount ?? 0)
        const state = {}
        let offset = 0
        for (;;) {
          const { events } = await handle.read(offset, MAX_READ_BATCH)
          if (events.length === 0) break
          offset += events.length
          for (const event of events) {
            rememberHeader(state, event)
            if (event.seq < inheritedCut) continue
            const usage = usageOf(event)
            if (usage === undefined) continue
            const row = buildRecord(snapshot.header.id, event, state, usage)
            if (row !== undefined) append(row)
          }
        }
        const current = headers.get(snapshot.header.id)
        if ((state.provider !== undefined || state.model !== undefined)
          && (current === undefined || (state.headerSeq ?? -1) > (current.headerSeq ?? -1))) {
          headers.set(snapshot.header.id, state)
        }
        if (revision !== undefined) scannedRevisions.set(snapshot.header.id, revision)
      } catch (error) {
        ctx.logger?.warn?.(`opencode-go-usage: cannot read session ${snapshot.header?.id}: ${String(error)}`)
      } finally {
        try {
          await handle?.close()
        } catch {
          // Closing a read handle is best-effort cleanup.
        }
      }
    }
  }

  const summarize = endDate => {
    const now = Date.now()
    const today = beijingDay(now)
    const end = validDate(endDate) ? endDate : today
    const windowStart = dayStart(addDays(end, -6))
    const windowEnd = dayStart(addDays(end, 1))
    const totalModels = new Map()
    const windowModels = new Map()
    const days = []
    for (let index = 0; index < 7; index += 1) {
      days.push({ date: addDays(end, index - 6), amount: 0, models: new Map() })
    }
    let totalAmount = 0
    let recordCount = 0

    for (const row of rows.values()) {
      if (row.at < START_AT || row.at > now) continue
      const tokens = tokenTotal(row)
      if (tokens === 0) continue
      const amount = costOf(row)
      recordCount += 1

      const totalEntry = totalModels.get(row.model) ?? {
        id: row.model,
        name: nameOf(row),
        amount: 0,
        tokens: 0,
        color: colorFor(row.model),
      }
      totalEntry.amount += amount
      totalEntry.tokens += tokens
      totalModels.set(row.model, totalEntry)
      totalAmount += amount

      if (row.at >= windowStart && row.at < windowEnd) {
        const dayIndex = Math.floor((row.at - windowStart) / DAY)
        const day = days[dayIndex]
        if (day !== undefined) {
          const dayEntry = day.models.get(row.model) ?? {
            id: row.model,
            name: nameOf(row),
            amount: 0,
            tokens: 0,
            color: colorFor(row.model),
          }
          dayEntry.amount += amount
          dayEntry.tokens += tokens
          day.models.set(row.model, dayEntry)
          day.amount += amount
          windowModels.set(row.model, dayEntry.color)
        }
      }
    }

    const sortModels = models => [...models].sort((left, right) => (
      right.amount - left.amount || left.name.localeCompare(right.name)
    ))
    const totalList = sortModels(totalModels.values()).map(entry => ({
      id: entry.id,
      name: entry.name,
      amount: entry.amount,
      tokens: entry.tokens,
      color: entry.color,
    }))
    const dayList = days.map(day => ({
      date: day.date,
      amount: day.amount,
      models: sortModels(day.models.values()).map(entry => ({
        id: entry.id,
        name: entry.name,
        amount: entry.amount,
        tokens: entry.tokens,
        color: entry.color,
      })),
    }))

    return {
      updatedAt: now,
      today,
      endDate: end,
      startAt: new Date(START_AT).toISOString(),
      currency: CURRENCY,
      unit: PRICE_UNIT,
      recordCount,
      total: { amount: totalAmount, models: totalList },
      days: dayList,
      legend: [...windowModels.entries()]
        .map(([id, color]) => ({ id, name: displayNameFor(id), color }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    }
  }

  let refreshInFlight
  const refresh = () => {
    if (refreshInFlight !== undefined) return refreshInFlight
    refreshInFlight = backfill().catch(error => {
      ctx.logger?.warn?.(`opencode-go-usage: backfill failed: ${String(error)}`)
    }).finally(() => { refreshInFlight = undefined })
    return refreshInFlight
  }
  void refresh()

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/api/opencode-go-usage',
    handler: async (req, res) => {
      if (!guard(req)) return json(res, 403, { error: 'forbidden' })
      let url
      try {
        url = new URL(req.url ?? '/', 'http://localhost')
      } catch {
        return json(res, 400, { error: 'bad-request' })
      }

      if (url.pathname === '/api/opencode-go-usage/quota-key') {
        if (!['GET', 'POST', 'DELETE'].includes(req.method)) return json(res, 405, { error: 'method-not-allowed' })
        try {
          if (req.method === 'POST') {
            const text = await readBoundedBody(req)
            if (text === null) return json(res, 413, { error: 'too-large' })
            let body
            try { body = JSON.parse(text) } catch { return json(res, 400, { error: 'bad-request' }) }
            const key = normalizeApiKey(body?.key)
            if (key === '') return json(res, 400, { error: 'bad-key' })
            await mutateKey(() => credentialStore().modifyRecord(QUOTA_CREDENTIAL, async () => ({ kind: 'api-key', key })))
          } else if (req.method === 'DELETE') {
            await mutateKey(() => credentialStore().deleteRecord(QUOTA_CREDENTIAL))
          }
          await keyMutation
          return json(res, 200, { ok: true, configured: (await savedQuotaKey()) !== '' })
        } catch {
          // Provider errors may contain secret material; never echo or log them.
          return json(res, 503, { error: 'credential-storage' })
        }
      }

      if (url.pathname === '/api/opencode-go-usage/quota') {
        if (req.method !== 'POST') return json(res, 405, { error: 'method-not-allowed' })
        let text
        try {
          text = await readBoundedBody(req)
        } catch {
          return json(res, 400, { error: 'bad-request' })
        }
        if (text === null) return json(res, 413, { error: 'too-large' })
        let body
        try {
          body = JSON.parse(text)
        } catch {
          return json(res, 400, { error: 'bad-request' })
        }
        let key = normalizeApiKey(body?.key)
        if (body?.key === undefined) {
          try {
            await keyMutation
            key = await savedQuotaKey()
          } catch {
            return json(res, 503, { error: 'credential-storage' })
          }
        }
        if (key === '') return json(res, 400, { error: 'bad-key' })
        const result = await fetchQuota(key)
        return json(res, result.status, result.body)
      }

      if (url.pathname !== '/api/opencode-go-usage/summary') return json(res, 404, { error: 'not-found' })
      if (req.method !== 'GET') return json(res, 405, { error: 'method-not-allowed' })
      await refresh()
      json(res, 200, summarize(url.searchParams.get('end') ?? undefined))
    },
  }))
}

export const name = 'dsh-opencode-go-usage'
export const inject = ['webServer', 'sessionPersistence', 'sessions']

export default { name, inject, apply }
