import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const source = fs.readFileSync(new URL('./client.js', import.meta.url), 'utf8')
let serverKey = ''
let quotaOffline = false
let metadataOffline = false
const requests = []
const legacy = new Map()
const summary = { startAt: '2026-11-22T16:01:00Z', endDate: '2026-11-24', total: { amount: 0, models: [] }, days: [], legend: [] }
const response = (body, ok = true) => ({ ok, json: async () => body })
async function fetchMock(url, options = {}) {
  const body = options.body ? JSON.parse(options.body) : undefined
  requests.push({ url, method: options.method ?? 'GET', body })
  if (url.includes('/summary')) return response(summary)
  if (url.endsWith('/quota-key')) {
    if (metadataOffline) return response({ error: 'credential-storage' }, false)
    if (options.method === 'POST') serverKey = body.key
    if (options.method === 'DELETE') serverKey = ''
    return response({ ok: true, configured: serverKey !== '' })
  }
  assert.ok(url.endsWith('/quota'))
  assert.deepEqual(body, {}, 'quota requests must reuse the host key without returning it to the browser')
  return quotaOffline ? response({ error: 'network' }, false) : response({ ok: true, windows: [{ id: 'monthly', percent: 5 }] })
}
function client() {
  let component, root, cursor = 0
  const hooks = [], effects = [], dictionaries = new Map()
  const memo = (make, deps) => {
    const index = cursor++
    const old = hooks[index]
    if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) hooks[index] = { value: make(), deps }
    return hooks[index].value
  }
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    useState(value) {
      const index = cursor++
      if (!(index in hooks)) hooks[index] = typeof value === 'function' ? value() : value
      return [hooks[index], next => { hooks[index] = typeof next === 'function' ? next(hooks[index]) : next }]
    },
    useRef(value) { const index = cursor++; return hooks[index] ??= { current: value } },
    useCallback: (callback, deps) => memo(() => callback, deps),
    useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
    useEffect(callback, deps) {
      const index = cursor++
      const old = hooks[index]
      if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) {
        effects.push(() => { old?.cleanup?.(); hooks[index] = { deps, cleanup: callback() } })
      }
    },
  }
  let plugin
  vm.runInNewContext(source, {
    window: { __ModuleLoader__: { load: ({ factory }) => { plugin = factory(() => React) } } },
    document: { getElementById: () => null, createElement: () => ({}), head: { appendChild() {} } },
    sessionStorage: { getItem: key => legacy.get(key), removeItem: key => legacy.delete(key), setItem() { throw new Error('must not store keys in the browser') } },
    fetch: fetchMock,
    setInterval: () => 0,
    clearInterval() {},
  })
  plugin.apply({
    effect: callback => callback(),
    locale: {
      register: (_ns, language, dict) => { dictionaries.set(language, dict); return () => {} },
      bind: () => key => dictionaries.get('zh')[key] ?? key,
      getLocale: () => ({ active: 'zh' }),
      subscribe: () => () => {},
    },
    slots: { inject: (_name, callback) => callback(), register: (options, value) => { if (options.name === 'settings.section') component = value; return () => {} } },
  })
  const render = () => { cursor = 0; root = component(); effects.splice(0).forEach(effect => effect()) }
  const nodes = (node = root) => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(item => nodes(item)) : [node, ...nodes(node.children)]
  const find = predicate => nodes().find(predicate)
  const settle = async () => { for (let i = 0; i < 4; i++) { await new Promise(setImmediate); render() } }
  render()
  return { settle, find, input: () => find(node => node.type === 'input' && node.props.type === 'password'), submit: () => find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }) }
}

let page = client()
await page.settle()
assert.equal(page.input().props.placeholder, '粘贴 OpenCode Go API key')
page.input().props.onChange({ target: { value: 'client-test-key-not-real' } })
await page.settle()
page.submit()
await page.settle()
assert.equal(serverKey, 'client-test-key-not-real')
assert.equal(page.input().props.value, '')
assert.ok(page.input().props.placeholder.includes('已保存 API key'))

// A new page has no old state or session storage, just like a DSH restart.
requests.length = 0
page = client()
await page.settle()
assert.ok(page.input().props.placeholder.includes('已保存 API key'))
assert.equal(page.input().props.value, '')
assert.equal(requests.some(item => item.url.endsWith('/quota') && item.method === 'POST'), true)
assert.equal(requests.some(item => item.body?.key), false)

// A network failure must not discard the durable replacement.
quotaOffline = true
page.input().props.onChange({ target: { value: 'replacement-client-test-key' } })
await page.settle()
page.submit()
await page.settle()
assert.equal(serverKey, 'replacement-client-test-key')
assert.ok(page.input().props.placeholder.includes('已保存'))
assert.ok(page.find(node => node.props.role === 'alert'))
quotaOffline = false

page.find(node => node.props.className === 'ocg-quota-clear').props.onClick()
await page.settle()
assert.equal(serverKey, '')
assert.equal(page.find(node => node.props.className === 'ocg-quota-clear'), undefined)
page = client()
await page.settle()
assert.equal(page.input().props.placeholder, '粘贴 OpenCode Go API key')

legacy.set('opencode-go-usage:quota-key', 'legacy-client-test-key')
page = client()
await page.settle()
assert.equal(serverKey, 'legacy-client-test-key')
assert.equal(legacy.size, 0)
metadataOffline = true
page = client()
await page.settle()
assert.ok(page.find(node => node.props.role === 'alert').children.join('').includes('无法读写本机凭据'))
console.log('key client ok: save, restart reuse, replacement, offline retention, clear and legacy migration')
