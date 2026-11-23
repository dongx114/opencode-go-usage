import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { apply, START_AT } from './index.js'

const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ocg-tracking-'))
const at = START_AT + 60_000
const header = (seq, model) => ({ type: 'request/header', seq, time: at, data: { header: { config: { provider: 'opencode-go', model } } } })
const answer = (seq, model, usage = { inputTokens: 188, outputTokens: 5 }) => ({
  type: 'assistant/message', seq, time: at,
  data: { usage, ...(model ? { message: { source: { kind: 'model', provider: 'opencode-go', model } } } : {}) },
})

function harness(name, sessions, { seed = [], readHook } = {}) {
  const home = path.join(testRoot, name)
  const ledger = path.join(home, 'storages/opencode-go-usage/usage.jsonl')
  fs.mkdirSync(path.dirname(ledger), { recursive: true })
  if (seed.length) fs.writeFileSync(ledger, seed.map(row => JSON.stringify(row) + '\n').join(''))
  process.env.DSH_HOME = home
  const listeners = new Map()
  let route, opens = 0
  const warnings = []
  apply({
    logger: { warn: s => warnings.push(s) },
    on: (event, listener) => listeners.set(event, listener),
    effect: callback => callback(),
    sessions: { list: () => [] },
    sessionPersistence: {
      list: async () => [...sessions].map(([id, entry]) => ({ header: { id, createdAt: at }, revision: String(entry.revision) })),
      open: async id => {
        opens += 1
        const entry = sessions.get(id)
        const events = entry.events.slice()
        return {
          inheritedEventCount: entry.inheritedEventCount ?? 0,
          read: async (offset = 0, length = 400) => {
            if (readHook) await readHook(id, offset)
            return { events: events.slice(offset, offset + length) }
          },
          close: async () => {},
        }
      },
    },
    webServer: { register: definition => { route = definition.handler; return () => {} } },
  })
  return {
    ledger,
    get opens() { return opens },
    emit: (id, event) => listeners.get('session/event')({ id }, event),
    summary: async () => {
      let body
      await route({ method: 'GET', url: '/api/opencode-go-usage/summary', headers: { host: '127.0.0.1:3080' } }, {
        writeHead: status => assert.equal(status, 200), end: text => { body = JSON.parse(text) },
      })
      assert.deepEqual(warnings, [])
      return body
    },
  }
}

try {
  // A new session from another host process appears after initial backfill.
  const sessions = new Map([['flash', { revision: 1, events: [header(0, 'deepseek-v4.1-flash'), answer(1)] }]])
  const live = harness('refresh', sessions)
  assert.equal((await live.summary()).recordCount, 1)
  const initialOpens = live.opens
  await live.summary()
  assert.equal(live.opens, initialOpens, 'unchanged revisions should not be reread')
  sessions.set('luna', { revision: 1, events: [header(0, 'gpt-6-luna'), answer(1, 'gpt-6-luna')] })
  let summary = await live.summary()
  assert.equal(summary.recordCount, 2)
  assert.ok(summary.total.models.some(row => row.id === 'gpt-6-luna' && row.tokens === 193 && row.amount > 0))
  sessions.get('luna').events.push(header(2, 'claude-haiku-5-5'), answer(3, 'claude-haiku-5-5'))
  sessions.get('luna').revision += 1
  summary = await live.summary()
  assert.equal(summary.recordCount, 3)
  assert.ok(summary.total.models.some(row => row.id === 'claude-haiku-5-5'))
  const beforeConcurrent = live.opens
  await Promise.all([live.summary(), live.summary()])
  assert.equal(live.opens, beforeConcurrent)

  // The model on the settled response takes priority over a stale request header.
  const modelIds = ['gpt-6-luna', 'claude-haiku-5-5', 'kimi-k3.1-pro', 'gemini-4-argon', 'kimi-k3', 'qwen4-max']
  const modelEvents = [header(0, 'deepseek-v4.1-flash'), ...modelIds.map((id, i) => answer(i + 1, id))]
  const multi = harness('sources', new Map([['models', { revision: 1, events: modelEvents }]]))
  summary = await multi.summary()
  assert.equal(summary.recordCount, modelIds.length)
  assert.deepEqual(summary.total.models.map(row => row.id).sort(), modelIds.slice().sort())
  assert.ok(summary.total.models.every(row => row.amount > 0))

  // Correct old attribution for an existing record id without counting twice.
  const old = { v: 1, id: 'repair:1', at, session: 'repair', seq: 1, kind: 'message', provider: 'opencode-go', model: 'deepseek-v4.1-flash', tokens: { cacheHit: 0, cacheMiss: 188, output: 5 } }
  const repair = harness('repair', new Map([['repair', { revision: 1, events: [header(0, 'deepseek-v4.1-flash'), answer(1, 'gpt-6-luna')] }]]), { seed: [old] })
  summary = await repair.summary()
  assert.equal(summary.recordCount, 1)
  assert.deepEqual(summary.total.models.map(row => row.id), ['gpt-6-luna'])
  assert.equal(fs.readFileSync(repair.ledger, 'utf8').trim().split('\n').length, 2)
  await repair.summary()
  assert.equal(fs.readFileSync(repair.ledger, 'utf8').trim().split('\n').length, 2)

  // A history scan must not roll back a newer model selection received live.
  let enterRead, finishRead
  const entered = new Promise(resolve => { enterRead = resolve })
  const gate = new Promise(resolve => { finishRead = resolve })
  let blocked = false
  const race = harness('race', new Map([['race', { revision: 1, events: [header(0, 'deepseek-v4.1-flash')] }]]), {
    readHook: async () => { if (!blocked) { blocked = true; enterRead(); await gate } },
  })
  await entered
  race.emit('race', header(10, 'gpt-6-luna'))
  finishRead()
  await race.summary()
  race.emit('race', answer(11))
  summary = await race.summary()
  assert.deepEqual(summary.total.models.map(row => row.id), ['gpt-6-luna'])
  console.log('tracking ok: new sessions, revisions, model sources, repairs and live/backfill race')
} finally {
  fs.rmSync(testRoot, { recursive: true, force: true })
}
