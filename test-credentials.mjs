import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { apply } from './index.js'

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ocg-credentials-test-'))
process.env.DSH_HOME = home
const address = 'dsh-opencode-go-usage/quota'
const records = new Map([['another-plugin/key', { kind: 'api-key', key: 'unrelated-test-value' }]])
let writes = 0
const provider = () => ({
  async readRecord(id) { return records.get(id) },
  async modifyRecord(id, mutate) { writes++; records.set(id, await mutate(records.get(id))) },
  async deleteRecord(id) { writes++; records.delete(id) },
})
function host(store) {
  let handler
  apply({
    get: () => store,
    on() {},
    effect: effect => effect(),
    webServer: { register: definition => { handler = definition.handler; return () => {} } },
  })
  return async (pathname, method = 'GET', body, headers = {}) => {
    let status, payload, responseHeaders
    const text = body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body)
    await handler({
      url: '/api/opencode-go-usage/' + pathname,
      method,
      headers: { host: '127.0.0.1:3080', ...headers },
      async *[Symbol.asyncIterator]() { if (text !== '') yield Buffer.from(text) },
      resume() {},
    }, {
      writeHead(code, headers) { status = code; responseHeaders = headers },
      end(value) { payload = JSON.parse(value) },
    })
    return { status, body: payload, headers: responseHeaders }
  }
}
const realFetch = globalThis.fetch
try {
  let api = host(provider())
  assert.deepEqual((await api('quota-key')).body, { ok: true, configured: false })
  const saved = await api('quota-key', 'POST', { key: ' Bearer saved-test-key-not-real ' })
  assert.equal(saved.status, 200)
  assert.equal(saved.body.configured, true)
  assert.equal(saved.headers['cache-control'], 'no-store')
  assert.equal(records.get(address).key, 'saved-test-key-not-real')
  assert.ok(!JSON.stringify(saved).includes('saved-test-key-not-real'))

  // A fresh plugin instance uses the host's durable record, with no client key.
  api = host(provider())
  assert.equal((await api('quota-key')).body.configured, true)
  let authorization
  globalThis.fetch = async (_url, options) => {
    authorization = options.headers.authorization
    return new Response(JSON.stringify({ usage: { monthly: { percent: 5 } } }))
  }
  assert.equal((await api('quota', 'POST', {})).status, 200)
  assert.equal(authorization, 'Bearer saved-test-key-not-real')
  assert.ok(!JSON.stringify((await api('summary')).body).includes('saved-test-key-not-real'))

  await api('quota-key', 'POST', { key: 'replacement-test-key-not-real' })
  await api('quota', 'POST', {})
  assert.equal(authorization, 'Bearer replacement-test-key-not-real')
  assert.equal((await api('quota-key', 'POST', { key: 'bad key' })).status, 400)
  assert.equal(records.get(address).key, 'replacement-test-key-not-real')
  const before = writes
  for (const headers of [{ origin: 'https://other.example' }, { host: 'other.example' }, { 'sec-fetch-site': 'cross-site' }]) {
    assert.equal((await api('quota-key', 'DELETE', undefined, headers)).status, 403)
  }
  assert.equal(writes, before)
  assert.equal((await api('quota-key', 'POST', 'x'.repeat(17 * 1024))).status, 413)
  assert.equal((await api('quota-key', 'POST', '{')).status, 400)
  assert.equal((await api('quota-key', 'PUT')).status, 405)

  const cleared = await api('quota-key', 'DELETE')
  assert.equal(cleared.body.configured, false)
  assert.equal((await host(provider())('quota-key')).body.configured, false)
  assert.equal((await api('quota', 'POST', {})).body.error, 'bad-key')
  assert.equal(records.get('another-plugin/key').key, 'unrelated-test-value')

  // Save and clear are serialized: a delayed save cannot resurrect a cleared key.
  let release, started
  const gate = new Promise(resolve => { release = resolve })
  const entered = new Promise(resolve => { started = resolve })
  const store = provider()
  const modify = store.modifyRecord
  store.modifyRecord = async (...args) => { started(); await gate; return modify(...args) }
  api = host(store)
  const pendingSave = api('quota-key', 'POST', { key: 'delayed-test-key-not-real' })
  await entered
  const pendingClear = api('quota-key', 'DELETE')
  release()
  await Promise.all([pendingSave, pendingClear])
  assert.equal(records.has(address), false)

  const broken = host({ ...provider(), async readRecord() { throw new Error('secret-error-not-to-echo') } })
  const failure = await broken('quota-key')
  assert.equal(failure.status, 503)
  assert.deepEqual(failure.body, { error: 'credential-storage' })
  assert.equal((await host(undefined)('quota-key')).status, 503)
  assert.equal((await host(undefined)('summary')).status, 200)
  const ledger = path.join(home, 'storages/opencode-go-usage/usage.jsonl')
  assert.ok(!fs.existsSync(ledger) || !fs.readFileSync(ledger, 'utf8').includes('test-key'))
  console.log('credentials ok: restart, replace, clear, isolation, guards, race and secret redaction')
} finally {
  globalThis.fetch = realFetch
  fs.rmSync(home, { recursive: true, force: true })
}
