import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const source = fs.readFileSync(new URL('./client.js', import.meta.url), 'utf8')
let loaded
const registrations = []
const dictionaries = new Map()
const effects = []

const locale = {
  register(namespace, language, dictionary) {
    dictionaries.set(`${namespace}:${language}`, dictionary)
    return () => {}
  },
  bind(namespace) {
    return key => dictionaries.get(`${namespace}:zh`)?.[key] ?? key
  },
  getLocale() {
    return { active: 'zh', locales: [], revision: 0 }
  },
  subscribe() {
    return () => {}
  },
}

const ctx = {
  effect(callback) {
    effects.push(callback())
  },
  locale,
  slots: {
    inject(name, callback) {
      assert.ok(name === 'settings.section' || name === 'settings.section.icon')
      callback()
    },
    register(options, component) {
      registrations.push({ options, component })
      return () => {}
    },
  },
}

const react = {
  createElement: () => null,
  useCallback: callback => callback,
  useEffect: () => {},
  useRef: value => ({ current: value }),
  useState: value => [value, () => {}],
  useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
}

const sandbox = {
  window: {
    __ModuleLoader__: {
      load({ id, factory }) {
        assert.equal(id, 'dsh-opencode-go-usage')
        loaded = factory(name => {
          assert.equal(name, 'react')
          return react
        })
      },
    },
  },
  document: {
    getElementById: () => null,
    createElement: () => ({ id: '', textContent: '' }),
    head: { appendChild() {} },
  },
  fetch: async () => ({ ok: true, json: async () => ({}) }),
  console,
}
vm.runInNewContext(source, sandbox)

assert.ok(loaded)
assert.deepEqual([...loaded.inject].sort(), ['locale', 'slots'])
loaded.apply(ctx)

assert.equal(registrations.length, 2)
const section = registrations.find(entry => entry.options.name === 'settings.section')
const icon = registrations.find(entry => entry.options.name === 'settings.section.icon')
assert.ok(section)
assert.ok(icon)
assert.equal(section.options.id, 'opencode-go-usage')
assert.equal(section.options.order, 25)
assert.equal(section.options.label(), '用量消耗')
assert.equal(typeof section.component, 'function')
assert.equal(icon.options.id, 'opencode-go-usage')
assert.equal(typeof icon.component, 'function')
assert.equal(dictionaries.get('opencode-go-usage:zh').pageTitle, 'opencode go 订阅用量消耗')
assert.equal(dictionaries.get('opencode-go-usage:en').pageTitle, 'OpenCode Go subscription usage')
assert.equal(dictionaries.get('opencode-go-usage:zh').quota, '订阅额度')
assert.equal(dictionaries.get('opencode-go-usage:en').quota, 'Subscription quota')
console.log('client module ok; dictionaries=', [...dictionaries.keys()].join(','))
