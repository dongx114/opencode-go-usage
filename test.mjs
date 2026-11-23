import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { apply, normalizeQuota, START_AT } from './index.js'

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ocg-usage-test-'))
process.env.DSH_HOME = home

const NOON = Date.parse('2026-11-23T12:00:00+08:00')
const header = (provider, model) => ({
  type: 'request/header',
  seq: 0,
  time: NOON,
  data: { header: { config: { provider, model } } },
})
const assistant = (seq, usage, time = NOON) => ({
  type: 'assistant/message',
  seq,
  time,
  data: { usage },
})
const attempt = (seq, usage, time = NOON) => ({
  type: 'assistant/attempt',
  seq,
  time,
  data: { stream: [{ type: 'chunk', time, chunk: { type: 'usage', usage } }] },
})

const mainEvents = [
  header('opencode-go', 'deepseek-v4.1-flash'),
  assistant(1, { inputTokens: 1_000_000, cacheReadTokens: 1_000_000, outputTokens: 1_000_000 }),
  attempt(2, { inputTokens: 1_000_000, outputTokens: 0 }),
  header('deepseek-official', 'deepseek-flash'),
  assistant(3, { inputTokens: 9_000_000, outputTokens: 9_000_000 }),
]

const childEvents = [
  header('opencode-go', 'deepseek-v4.1-flash'),
  assistant(1, { inputTokens: 5_000_000, outputTokens: 5_000_000 }),
  assistant(2, { inputTokens: 1_000_000, outputTokens: 0 }),
  assistant(3, { inputTokens: 1_000_000, outputTokens: 0 }),
]

const persistence = {
  async list() {
    return [
      { header: { id: 'main', createdAt: NOON }, location: undefined },
      { header: { id: 'child', createdAt: NOON, isSeeded: true }, location: undefined },
    ]
  },
  async open(id) {
    const events = id === 'child' ? childEvents : mainEvents
    return {
      inheritedEventCount: id === 'child' ? 2 : 0,
      async read(offset = 0, length = events.length) {
        return { events: events.slice(offset, offset + length) }
      },
      async close() {},
    }
  },
}

let route
const listeners = new Map()
const ctx = {
  logger: { warn() {} },
  on(event, listener) {
    listeners.set(event, listener)
  },
  effect(callback) {
    return callback()
  },
  webServer: {
    register(definition) {
      route = definition.handler
      return () => {}
    },
  },
  sessionPersistence: persistence,
  sessions: { list: () => [] },
}

apply(ctx)
await new Promise(resolve => setTimeout(resolve, 100))

const call = async end => {
  let status = 0
  let body
  const res = {
    writeHead(value) {
      status = value
    },
    end(text) {
      body = JSON.parse(text)
    },
  }
  await route({
    method: 'GET',
    url: `/api/opencode-go-usage/summary${end === undefined ? '' : `?end=${end}`}`,
    headers: { host: '127.0.0.1:3080' },
  }, res)
  assert.equal(status, 200)
  return body
}

let summary = await call()
assert.equal(summary.recordCount, 4)
assert.equal(summary.total.models.length, 1)
assert.equal(summary.total.models[0].id, 'deepseek-v4.1-flash')
// main: 1M each bucket = 0.753, plus 1M input = 0.15.
// child: only the two child-owned events count, 1M input each = 0.30.
assert.ok(Math.abs(summary.total.amount - 1.203) < 1e-9, `main total ${summary.total.amount}`)
assert.equal(summary.days.length, 7)
assert.equal(summary.days.at(-1).date, '2026-11-23')
assert.ok(Math.abs(summary.days.at(-1).amount - 1.203) < 1e-9)
assert.equal(summary.legend.length, 1)

// Live event after activation is appended to the same ledger.
listeners.get('session/event')({ id: 'live' }, header('opencode-go', 'deepseek-v4.1-flash'))
listeners.get('session/event')({ id: 'live' }, assistant(1, { inputTokens: 1_000_000, outputTokens: 0 }))
summary = await call()
assert.equal(summary.recordCount, 5)
assert.ok(Math.abs(summary.total.amount - 1.353) < 1e-9, `live total ${summary.total.amount}`)

// The total module ignores the selected chart window.
const past = await call('2026-11-17')
assert.ok(Math.abs(past.total.amount - 1.353) < 1e-9)
assert.equal(past.days.reduce((sum, day) => sum + day.amount, 0), 0)

// A fork child counts only its own events, never the inherited prefix.
const childRows = fs.readFileSync(path.join(home, 'storages', 'opencode-go-usage', 'usage.jsonl'), 'utf8')
  .split('\n').filter(Boolean).map(JSON.parse).filter(row => row.session === 'child')
assert.equal(childRows.length, 2)
assert.ok(childRows.every(row => row.tokens.cacheMiss === 1_000_000))

// The fixed interval start is exactly 2026-11-23 00:01 Beijing time.
assert.equal(new Date(START_AT).toISOString(), '2026-11-22T16:01:00.000Z')

const normalized = normalizeQuota({
  usage: {
    rolling: { status: 'ok', percent: 52 },
    weekly: { used: 5, limit: 10 },
    monthly: { percent: '61%' },
  },
})
assert.deepEqual(normalized, [
  { id: 'rolling', percent: 52, resetsAt: null, status: 'ok', limit: 12, amount: 6.24, currency: 'USD' },
  { id: 'weekly', percent: 50, resetsAt: null, status: '', limit: 10, amount: 5, currency: 'USD' },
  { id: 'monthly', percent: 61, resetsAt: null, status: '', limit: 60, amount: 36.6, currency: 'USD' },
])

const quotaCall = async (body, options = {}) => {
  let status = 0
  let payload
  const text = body === null ? '' : typeof body === 'string' ? body : JSON.stringify(body)
  const req = {
    method: options.method ?? 'POST',
    url: '/api/opencode-go-usage/quota',
    headers: { host: options.host ?? '127.0.0.1:3080' },
    async *[Symbol.asyncIterator]() {
      if (text !== '') yield Buffer.from(text)
    },
    resume() {},
  }
  const res = {
    writeHead(value) {
      status = value
    },
    end(value) {
      payload = JSON.parse(value)
    },
  }
  await route(req, res)
  return { status, body: payload }
}

const realFetch = globalThis.fetch
let upstreamRequest
globalThis.fetch = async (url, init) => {
  upstreamRequest = { url: String(url), init }
  return new Response(JSON.stringify({
    usage: {
      rolling: { status: 'ok', percent: 52, resetsAt: '2026-11-23T08:34:52.704Z' },
      weekly: { status: 'ok', percent: 20, resetsAt: '2026-11-28T00:00:00.000Z' },
      monthly: { status: 'ok', percent: 61, resetsAt: '2026-11-25T06:30:41.000Z' },
    },
  }), { status: 200, headers: { 'content-type': 'application/json' } })
}
const quota = await quotaCall({ key: 'test-key-not-real' })
assert.equal(quota.status, 200)
assert.equal(quota.body.ok, true)
assert.equal(quota.body.windows.length, 3)
assert.equal(quota.body.windows[0].percent, 52)
assert.equal(quota.body.windows[0].limit, 12)
assert.equal(quota.body.windows[0].amount, 6.24)
assert.equal(quota.body.windows[0].currency, 'USD')
assert.equal(quota.body.windows[0].resetsAt, '2026-11-23T08:34:52.704Z')
assert.equal(upstreamRequest.url, 'https://opencode.ai/zen/go/v1/usage')
assert.equal(upstreamRequest.init.method, 'GET')
assert.equal(upstreamRequest.init.headers.authorization, 'Bearer test-key-not-real')

globalThis.fetch = async () => new Response('{"error":"unauthorized"}', { status: 401 })
const unauthorized = await quotaCall({ key: 'test-key-not-real' })
assert.equal(unauthorized.status, 401)
assert.equal(unauthorized.body.error, 'unauthorized')

let upstreamCalls = 0
globalThis.fetch = async () => {
  upstreamCalls += 1
  return new Response('{}', { status: 200 })
}
const badKey = await quotaCall({ key: 'bad key' })
assert.equal(badKey.status, 400)
assert.equal(badKey.body.error, 'bad-key')
assert.equal(upstreamCalls, 0)

const noBody = await quotaCall(null)
assert.equal(noBody.status, 400)
assert.equal(noBody.body.error, 'bad-request')

const wrongMethod = await quotaCall(null, { method: 'GET' })
assert.equal(wrongMethod.status, 405)
assert.equal(wrongMethod.body.error, 'method-not-allowed')

const oversized = await quotaCall('x'.repeat(17 * 1024))
assert.equal(oversized.status, 413)
assert.equal(oversized.body.error, 'too-large')

const foreignHost = await quotaCall({ key: 'test-key-not-real' }, { host: 'evil.example:3080' })
assert.equal(foreignHost.status, 403)
assert.equal(foreignHost.body.error, 'forbidden')

globalThis.fetch = realFetch

console.log('ok: total=' + summary.total.amount, 'rows=' + summary.recordCount, 'quota=ok')
