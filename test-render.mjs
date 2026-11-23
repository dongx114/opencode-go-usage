import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const source = fs.readFileSync(new URL('./client.js', import.meta.url), 'utf8')
const states = []

const React = {
  createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
  useCallback: callback => callback,
  useEffect: () => {},
  useRef: value => ({ current: value }),
  useState: () => [states.shift(), () => {}],
  useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
}

let section
const locale = {
  register: () => () => {},
  bind: () => key => ({
    pageTitle: 'opencode go 订阅用量消耗',
    quota: '订阅额度',
    quotaSmall: 'OpenCode Go · 已用比例',
    keyLabel: 'API key',
    keyPlaceholder: '粘贴 OpenCode Go API key',
    keyHint: '仅保存在当前标签页，关闭标签页后清除',
    query: '查询',
    refresh: '刷新',
    querying: '查询中…',
    quotaIdle: '填入 API key 后查询额度',
    quotaLoading: '正在读取额度…',
    quotaUpdated: '更新于 {time}',
    quotaRolling: '5 小时',
    quotaWeekly: '周额度',
    quotaMonthly: '月额度',
    quotaReset: '重置 {time}',
    quotaUsed: '已用 {percent}',
    quotaNotReturned: '未返回',
    keyRequired: '请输入 API key',
    quotaInvalidKey: 'API key 无效，或不是 OpenCode Go 订阅 key',
    quotaForbidden: 'key 有效，但无权读取该 workspace 的额度',
    quotaNotFound: '额度接口地址已变更',
    quotaRateLimited: '查询太频繁，请稍后再试',
    quotaTimeout: '请求超时，请检查网络后重试',
    quotaNetwork: '网络错误，需要能直连 opencode.ai',
    quotaBadResponse: '额度接口返回异常',
    quotaFailed: '额度查询失败',
    quotaStatus: '状态 {status}',
    total: '总消耗',
    since: '北京时间 {time} 起累计',
    daily: '每日消耗',
    last7: '近 7 天',
    endDate: '显示终止日期',
    noUsage: '暂无消耗记录',
    emptyDay: '无消耗',
    emptyRange: '该时段无消耗记录',
    dayTotal: '当日合计',
    loading: '加载中…',
    loadFailed: '读取失败',
    retry: '重试',
  })[key] ?? key,
  getLocale: () => ({ active: 'zh', locales: [], revision: 0 }),
  subscribe: () => () => {},
}

const ctx = {
  effect: callback => callback(),
  locale,
  slots: {
    inject: (_name, callback) => callback(),
    register: (options, component) => {
      if (options.name === 'settings.section') section = component
      return () => {}
    },
  },
}

const sandbox = {
  window: { __ModuleLoader__: { load: ({ factory }) => { factory(() => React) } } },
  document: {
    getElementById: () => null,
    createElement: () => ({ id: '', textContent: '' }),
    head: { appendChild() {} },
  },
  fetch: async () => ({ ok: true, json: async () => ({}) }),
  console,
}
vm.runInNewContext(source, sandbox)
// The factory returns the plugin object; the loader in this sandbox does not
// expose it, so invoke the registration path by re-running the factory with a
// direct reference. The client wrapper's return value is needed for apply.
let plugin
vm.runInNewContext(source, {
  ...sandbox,
  window: { __ModuleLoader__: { load: ({ factory }) => { plugin = factory(() => React) } } },
})
plugin.apply(ctx)

assert.equal(typeof section, 'function')

function textOf(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join(' ')
  return (node.children ?? []).map(textOf).join(' ')
}

function render(values) {
  states.push(...values)
  return textOf(section())
}

const model = { id: 'deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash', amount: 0.2839, tokens: 123, color: '#4F7CFF' }
const ready = {
  startAt: '2026-11-22T16:01:00Z',
  today: '2026-11-23',
  endDate: '2026-11-23',
  total: { amount: 0.2839, models: [model] },
  days: [
    { date: '2026-11-17', amount: 0, models: [] },
    { date: '2026-11-18', amount: 0, models: [] },
    { date: '2026-11-19', amount: 0, models: [] },
    { date: '2026-11-20', amount: 0, models: [] },
    { date: '2026-11-21', amount: 0, models: [] },
    { date: '2026-11-22', amount: 0, models: [] },
    { date: '2026-11-23', amount: 0.2839, models: [model] },
  ],
  legend: [model],
}

const quotaReady = {
  fetchedAt: '2026-11-23T11:05:00Z',
  windows: [
    { id: 'rolling', percent: 52, resetsAt: '2026-11-23T08:34:52Z', status: 'ok' },
    { id: 'weekly', percent: 20, resetsAt: '2026-11-28T00:00:00Z', status: 'ok' },
    { id: 'monthly', percent: 61, resetsAt: '2026-11-25T06:30:41Z', status: 'ok' },
  ],
}

let text = render(['', ready, 'ready', '', false, 6, 0, '', quotaReady, 'ready', ''])
assert.ok(text.includes('opencode go 订阅用量消耗'))
assert.ok(text.includes('订阅额度'))
assert.ok(text.indexOf('总消耗') < text.indexOf('每日消耗'))
assert.ok(text.indexOf('每日消耗') < text.indexOf('订阅额度'))
assert.ok(text.includes('5 小时'))
assert.ok(text.includes('52%'))
assert.ok(text.includes('20%'))
assert.ok(text.includes('61%'))
assert.ok(text.includes('重置 11-23 16:34'))
assert.ok(text.includes('更新于 11-23 19:05'))
assert.ok(text.includes('总消耗'))
assert.ok(text.includes('北京时间 11-23 00:01 起累计'))
assert.ok(text.includes('$0.2839'))
assert.ok(text.includes('DeepSeek V4.1 Flash'))
assert.ok(text.includes('每日消耗'))
assert.ok(text.includes('近 7 天'))
assert.ok(text.includes('11-23'))
assert.ok(text.includes('当日合计'))

const empty = {
  ...ready,
  total: { amount: 0, models: [] },
  days: ready.days.map(day => ({ ...day, amount: 0, models: [] })),
  legend: [],
}
text = render(['', empty, 'ready', '', false, -1, 0, '', quotaReady, 'ready', ''])
assert.ok(text.includes('该时段无消耗记录'))
assert.ok(!text.includes('当日合计'))

text = render(['', null, 'error', 'boom', false, -1, 0, '', quotaReady, 'ready', ''])
assert.ok(text.includes('读取失败: boom'))
assert.ok(text.includes('重试'))
assert.ok(text.includes('52%'))

text = render(['', null, 'loading', '', false, -1, 0, '', null, 'idle', ''])
assert.ok(text.includes('填入 API key 后查询额度'))

text = render(['', ready, 'ready', '', false, -1, 0, 'test-key-not-real', null, 'error', 'unauthorized'])
assert.ok(text.includes('API key 无效，或不是 OpenCode Go 订阅 key'))

console.log('render smoke ok')
