window.__ModuleLoader__.load({
  id: 'dsh-opencode-go-usage',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useRef, useState, useSyncExternalStore } = React

    const NS = 'opencode-go-usage'
    const STYLE_ID = 'dsh-opencode-go-usage-style'
    const QUOTA_KEY_STORAGE = 'opencode-go-usage:quota-key'
    const QUOTA_KEY_ID = 'ocg-quota-key'
    const QUOTA_WINDOWS = [
      { id: 'rolling', label: 'quotaRolling' },
      { id: 'weekly', label: 'quotaWeekly' },
      { id: 'monthly', label: 'quotaMonthly' },
    ]

    const DICT = {
      zh: {
        sectionLabel: '用量消耗',
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
      },
      en: {
        sectionLabel: 'Usage spend',
        pageTitle: 'OpenCode Go subscription usage',
        quota: 'Subscription quota',
        quotaSmall: 'OpenCode Go · used',
        keyLabel: 'API key',
        keyPlaceholder: 'Paste an OpenCode Go API key',
        keyHint: 'Kept only in this tab; cleared when the tab closes',
        query: 'Check',
        refresh: 'Refresh',
        querying: 'Checking…',
        quotaIdle: 'Enter an API key to check quota',
        quotaLoading: 'Reading quota…',
        quotaUpdated: 'Updated {time}',
        quotaRolling: '5 hours',
        quotaWeekly: 'Weekly',
        quotaMonthly: 'Monthly',
        quotaReset: 'resets {time}',
        quotaUsed: '{percent} used',
        quotaNotReturned: 'Not returned',
        keyRequired: 'Enter an API key',
        quotaInvalidKey: 'API key is invalid or not an OpenCode Go subscription key',
        quotaForbidden: 'Key is valid but cannot read this workspace quota',
        quotaNotFound: 'Quota endpoint has changed',
        quotaRateLimited: 'Too many checks; try again shortly',
        quotaTimeout: 'Request timed out; check the network and retry',
        quotaNetwork: 'Network error; opencode.ai must be reachable',
        quotaBadResponse: 'Unexpected quota response',
        quotaFailed: 'Could not check quota',
        quotaStatus: 'Status {status}',
        total: 'Total spend',
        since: 'Since {time} UTC+8',
        daily: 'Daily spend',
        last7: 'Last 7 days',
        endDate: 'End date',
        noUsage: 'No usage yet',
        emptyDay: 'No usage',
        emptyRange: 'No usage in this range',
        dayTotal: 'Day total',
        loading: 'Loading…',
        loadFailed: 'Could not load usage',
        retry: 'Retry',
      },
    }

    const CSS = `
.ocg-page{box-sizing:border-box;display:flex;flex-direction:column;gap:12px;width:100%;max-width:760px;color:var(--dsw-alias-label-primary)}
.ocg-page h2{margin:0 0 2px;font-size:22px;line-height:30px;font-weight:650;letter-spacing:-.3px}
.ocg-card{box-sizing:border-box;padding:18px 20px;border:0.5px solid var(--dsw-alias-settings-card-stroke,var(--dsw-alias-border-l1));border-radius:var(--dsw-radius-xl,16px);background:var(--dsw-alias-settings-card-fill,var(--dsw-alias-bg-layer-2))}
.ocg-card-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 16px;min-height:30px}
.ocg-card-title{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 8px;font-size:14px;font-weight:600;line-height:22px}
.ocg-card-title small{font-size:11px;line-height:16px;font-weight:400;color:var(--dsw-alias-label-secondary)}
.ocg-total{margin-top:12px;font-size:36px;line-height:44px;font-weight:650;letter-spacing:-1px;font-variant-numeric:tabular-nums}
.ocg-models{display:flex;flex-direction:column;gap:10px;margin:16px 0 0;padding:14px 0 0;border-top:1px solid var(--dsw-alias-border-l1);list-style:none}
.ocg-model{display:flex;align-items:center;gap:10px;min-width:0;font-size:14px;line-height:22px}
.ocg-dot{flex:0 0 auto;width:8px;height:8px;border-radius:50%}
.ocg-model-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ocg-model-amount{flex:0 0 auto;font-variant-numeric:tabular-nums}
.ocg-empty{padding:14px 0 2px;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}
.ocg-error{display:flex;flex-wrap:wrap;align-items:center;gap:10px;box-sizing:border-box;padding:8px 12px;border:0.5px solid var(--dsw-alias-state-error-primary);border-radius:var(--dsw-radius-lg,12px);color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px}
.ocg-error button{flex:0 0 auto;padding:2px 10px;border:0.5px solid currentcolor;border-radius:var(--dsw-radius-md,8px);background:transparent;color:inherit;font:inherit;font-size:12px;cursor:pointer}
.ocg-quota-form{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.ocg-quota-input{box-sizing:border-box;flex:1 1 220px;min-width:0;padding:7px 10px;border:0.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px}
.ocg-quota-input:focus{outline:2px solid var(--dsw-alias-brand-primary,#4F7CFF);outline-offset:1px}
.ocg-quota-form button{flex:0 0 auto;padding:7px 16px;border:0;border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-brand-primary,#4F7CFF);color:#fff;font:inherit;font-size:13px;line-height:20px;cursor:pointer}
.ocg-quota-form button:disabled{opacity:.55;cursor:default}
.ocg-quota-form button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#4F7CFF);outline-offset:2px}
.ocg-quota-hint{margin-top:6px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px}
.ocg-quota-message{margin-top:10px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.ocg-quota-message[data-error='true']{color:var(--dsw-alias-state-error-primary,#d64545)}
.ocg-quota-updated{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px;white-space:nowrap}
.ocg-quota-list{display:flex;flex-direction:column;gap:14px;margin-top:16px}
.ocg-quota-row{display:grid;grid-template-columns:52px minmax(0,1fr) 48px;align-items:center;gap:10px}
.ocg-quota-label{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.ocg-quota-body{min-width:0}
.ocg-quota-track{height:8px;border:0.5px solid var(--dsw-alias-border-l1);border-radius:999px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}
.ocg-quota-fill{height:100%;border-radius:999px;background:var(--ocg-quota-color,var(--dsw-alias-brand-primary,#4F7CFF));transition:width .3s ease}
.ocg-quota-meta{display:flex;flex-wrap:wrap;gap:2px 8px;margin-top:5px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px}
.ocg-quota-pct{text-align:right;font-size:12px;line-height:18px;font-variant-numeric:tabular-nums}
.ocg-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.ocg-date{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.ocg-date input{box-sizing:border-box;min-width:120px;padding:5px 8px;border:0.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;color-scheme:inherit}
.ocg-chart{position:relative;display:grid;grid-template-columns:44px minmax(0,1fr);grid-template-rows:auto auto;column-gap:8px;margin-top:16px;transition:opacity .15s ease}
.ocg-chart[data-busy='true']{opacity:.55}
.ocg-yaxis{position:relative;grid-column:1;grid-row:1;height:200px;color:var(--dsw-alias-label-secondary);font-size:11px;font-variant-numeric:tabular-nums}
.ocg-yaxis span{position:absolute;right:0;transform:translateY(50%)}
.ocg-plot{position:relative;grid-column:2;grid-row:1;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:10px;height:200px;border-bottom:1px solid var(--dsw-alias-border-l2)}
.ocg-grid{position:absolute;right:0;left:0;border-top:1px dashed var(--dsw-alias-border-l1);pointer-events:none}
.ocg-col{position:relative;z-index:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;min-width:0;padding-top:10px}
.ocg-bar{display:flex;flex-direction:column-reverse;width:100%;max-width:42px;border-radius:6px 6px 2px 2px;overflow:hidden;transition:opacity .15s ease}
.ocg-col:hover .ocg-bar{opacity:.82}
.ocg-col:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:4px;border-radius:6px}
.ocg-col:focus-visible .ocg-bar{opacity:.82}
.ocg-seg{width:100%;flex:0 0 auto}
.ocg-xaxis{grid-column:2;grid-row:2;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:10px;margin-top:9px}
.ocg-xlabel{text-align:center;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px;white-space:nowrap}
.ocg-xlabel b{display:block;font-weight:500;color:var(--dsw-alias-label-secondary)}
.ocg-chart-empty{display:flex;align-items:center;justify-content:center;min-height:150px;margin-top:12px;border:1px dashed var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg,12px);color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}
.ocg-card.ocg-card-daily{padding-top:14px;padding-bottom:14px}
.ocg-card-daily .ocg-chart{margin-top:12px}
.ocg-card-daily .ocg-yaxis,.ocg-card-daily .ocg-plot{height:110px}
.ocg-card-daily .ocg-chart-empty{min-height:100px}
.ocg-card-daily .ocg-legend{margin-top:8px}
.ocg-tooltip{position:absolute;z-index:3;top:0;min-width:158px;max-width:220px;padding:10px 12px;border:0.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-bg-overlay);box-shadow:0 8px 28px rgba(0,0,0,.16);font-size:12px;line-height:18px;pointer-events:none}
.ocg-tooltip-date{margin-bottom:6px;font-weight:600;white-space:nowrap}
.ocg-tooltip-row{display:flex;align-items:center;gap:7px;min-width:0}
.ocg-tooltip-row .ocg-dot{width:6px;height:6px}
.ocg-tooltip-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary)}
.ocg-tooltip-amount{flex:0 0 auto;font-variant-numeric:tabular-nums}
.ocg-tooltip-total{display:flex;justify-content:space-between;gap:12px;margin-top:7px;padding-top:7px;border-top:1px solid var(--dsw-alias-border-l1);font-weight:600}
.ocg-tooltip-empty{color:var(--dsw-alias-label-secondary)}
.ocg-legend{display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:12px}
.ocg-legend-item{display:flex;align-items:center;gap:6px;min-width:0;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px}
.ocg-legend-item span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ocg-state{padding:24px;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}
.ocg-state button{margin-left:10px;padding:4px 12px;border:0.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer}
@media (max-width:520px){.ocg-page h2{font-size:20px;line-height:28px}.ocg-card{padding:16px}.ocg-plot,.ocg-xaxis{gap:6px}.ocg-xlabel{font-size:10px;line-height:15px}.ocg-total{font-size:32px;line-height:40px}.ocg-quota-row{grid-template-columns:46px minmax(0,1fr) 42px;gap:8px}.ocg-quota-label{font-size:11px}.ocg-quota-form button{flex:1 1 auto}}
@media (prefers-reduced-motion:reduce){.ocg-bar,.ocg-chart,.ocg-quota-fill{transition:none}}
`

    function injectCss() {
      if (document.getElementById(STYLE_ID) !== null) return
      const style = document.createElement('style')
      style.id = STYLE_ID
      style.textContent = CSS
      document.head.appendChild(style)
    }

    function money(amount) {
      const value = Number.isFinite(amount) ? amount : 0
      if (value === 0) return '$0.00'
      const digits = value < 1 ? 4 : 2
      return `$${value.toFixed(digits)}`
    }

    function axisMoney(amount) {
      if (amount === 0) return '$0'
      if (amount < 0.01) return `$${amount.toFixed(3)}`
      if (amount < 1) return `$${amount.toFixed(2)}`
      if (amount < 10) return `$${amount.toFixed(1)}`
      return `$${amount.toFixed(0)}`
    }

    function dayLabel(date, lang) {
      const [year, month, day] = date.split('-').map(Number)
      const value = new Date(Date.UTC(year, month - 1, day))
      const weekday = new Intl.DateTimeFormat(lang, { weekday: 'short', timeZone: 'UTC' }).format(value)
      return { date: `${month}-${day}`, weekday }
    }

    function beijingTimestamp(iso) {
      const value = new Date(iso)
      if (Number.isNaN(value.getTime())) return ''
      const shifted = new Date(value.getTime() + 8 * 60 * 60 * 1000)
      const pad = number => String(number).padStart(2, '0')
      return `${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())} ${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`
    }

    function quotaTone(percent) {
      if (!Number.isFinite(percent)) return 'var(--dsw-alias-border-l2)'
      if (percent >= 90) return 'var(--dsw-alias-state-error-primary,#d64545)'
      if (percent >= 70) return 'var(--dsw-alias-state-warning-primary,#c98500)'
      return 'var(--dsw-alias-state-success-primary,#2f9e6e)'
    }

    function quotaErrorKey(code) {
      switch (code) {
        case 'keyRequired':
        case 'bad-key':
          return 'keyRequired'
        case 'unauthorized':
          return 'quotaInvalidKey'
        case 'forbidden':
          return 'quotaForbidden'
        case 'not-found':
          return 'quotaNotFound'
        case 'rate-limited':
          return 'quotaRateLimited'
        case 'timeout':
          return 'quotaTimeout'
        case 'network':
          return 'quotaNetwork'
        case 'bad-response':
        case 'bad-request':
        case 'too-large':
        case 'upstream':
          return 'quotaBadResponse'
        default:
          return 'quotaFailed'
      }
    }

    function readStoredKey() {
      try {
        return typeof sessionStorage === 'undefined'
          ? ''
          : sessionStorage.getItem(QUOTA_KEY_STORAGE) ?? ''
      } catch {
        return ''
      }
    }

    function storeKey(key) {
      try {
        if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(QUOTA_KEY_STORAGE, key)
      } catch {
        // A browser that blocks sessionStorage only loses the convenience restore.
      }
    }

    function clearStoredKey() {
      try {
        if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(QUOTA_KEY_STORAGE)
      } catch {
        // A browser that blocks sessionStorage has nothing to clear.
      }
    }

    function UsageIcon({ size = 16 }) {
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 36 36',
        fill: 'currentColor',
        'aria-hidden': 'true',
      }, [
        h('rect', { key: 'a', x: 6, y: 21, width: 5.5, height: 9, rx: 2.75 }),
        h('rect', { key: 'b', x: 15.25, y: 15, width: 5.5, height: 15, rx: 2.75 }),
        h('rect', { key: 'c', x: 24.5, y: 9, width: 5.5, height: 21, rx: 2.75 }),
      ])
    }

    function makeSection(locale) {
      const useLocale = () => useSyncExternalStore(
        useCallback(callback => locale.subscribe(callback), []),
        useCallback(() => locale.getLocale(), []),
        () => locale.getLocale(),
      )

      function Section() {
        const snapshot = useLocale()
        const t = locale.bind(NS)
        const lang = snapshot.active.startsWith('zh') ? 'zh-CN' : 'en-US'
        const [endDate, setEndDate] = useState('')
        const [data, setData] = useState(null)
        const [status, setStatus] = useState('loading')
        const [error, setError] = useState('')
        const [busy, setBusy] = useState(false)
        const [hover, setHover] = useState(-1)
        const [attempt, setAttempt] = useState(0)
        const [key, setKey] = useState('')
        const [quota, setQuota] = useState(null)
        const [quotaStatus, setQuotaStatus] = useState('idle')
        const [quotaError, setQuotaError] = useState('')
        const restoredKey = useRef(false)
        const quotaRequest = useRef(0)

        const queryQuota = useCallback(async rawKey => {
          const requestId = quotaRequest.current + 1
          quotaRequest.current = requestId
          const candidate = rawKey.trim()
          if (candidate === '') {
            setQuota(null)
            setQuotaStatus('error')
            setQuotaError('keyRequired')
            return
          }
          setQuotaStatus('loading')
          setQuotaError('')
          try {
            const response = await fetch('/api/opencode-go-usage/quota', {
              method: 'POST',
              cache: 'no-store',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ key: candidate }),
            })
            let body = null
            try {
              body = await response.json()
            } catch {
              // A non-JSON response is treated as an unexpected upstream reply.
            }
            if (requestId !== quotaRequest.current) return
            if (!response.ok || body?.ok !== true || !Array.isArray(body.windows)) {
              const code = typeof body?.error === 'string' ? body.error : 'bad-response'
              const failure = new Error(code)
              failure.code = code
              throw failure
            }
            setQuota(body)
            setQuotaStatus('ready')
            storeKey(candidate)
          } catch (reason) {
            if (requestId !== quotaRequest.current) return
            setQuota(null)
            setQuotaStatus('error')
            setQuotaError(typeof reason?.code === 'string' ? reason.code : 'network')
          }
        }, [])

        const changeKey = useCallback(value => {
          setKey(value)
          if (value.trim() !== '') return
          clearStoredKey()
          quotaRequest.current += 1
          setQuota(null)
          setQuotaStatus('idle')
          setQuotaError('')
        }, [])

        useEffect(() => {
          if (restoredKey.current) return
          restoredKey.current = true
          const stored = readStoredKey()
          if (stored !== '') {
            setKey(stored)
            void queryQuota(stored)
          }
        }, [queryQuota])

        useEffect(() => {
          let cancelled = false
          const load = async (foreground = false) => {
            if (foreground && !cancelled) setBusy(true)
            try {
              const query = endDate ? `?end=${encodeURIComponent(endDate)}` : ''
              const response = await fetch(`/api/opencode-go-usage/summary${query}`, { cache: 'no-store' })
              if (!response.ok) throw new Error(`HTTP ${response.status}`)
              const body = await response.json()
              if (cancelled) return
              setData(body)
              setStatus('ready')
              setError('')
            } catch (reason) {
              if (cancelled) return
              setStatus('error')
              setError(reason instanceof Error ? reason.message : String(reason))
            } finally {
              if (foreground && !cancelled) setBusy(false)
            }
          }
          void load(true)
          const timer = setInterval(() => { void load() }, 30000)
          return () => {
            cancelled = true
            clearInterval(timer)
          }
        }, [endDate, attempt])

        const quotaById = new Map((quota?.windows ?? []).map(item => [item.id, item]))
        const quotaRows = QUOTA_WINDOWS.map(spec => {
          const item = quotaById.get(spec.id)
          const percent = item !== undefined && Number.isFinite(item.percent) ? item.percent : null
          const width = percent === null ? 0 : Math.max(0, Math.min(100, percent))
          const percentText = percent === null ? '--' : `${Math.round(percent)}%`
          const resetText = item?.resetsAt ? beijingTimestamp(item.resetsAt) : ''
          const reset = resetText === '' ? '' : t('quotaReset').replace('{time}', resetText)
          const state = item?.status && !/^(ok|active|normal|good|valid)$/i.test(item.status)
            ? t('quotaStatus').replace('{status}', item.status)
            : ''
          const detail = item === undefined
            ? (quotaStatus === 'ready' ? t('quotaNotReturned') : '')
            : [reset, state].filter(Boolean).join(' · ')
          return h('div', { className: 'ocg-quota-row', key: spec.id }, [
            h('span', { className: 'ocg-quota-label', key: 'label' }, t(spec.label)),
            h('div', { className: 'ocg-quota-body', key: 'body' }, [
              h('div', {
                className: 'ocg-quota-track',
                key: 'track',
                role: 'progressbar',
                'aria-label': `${t(spec.label)} ${percentText}`,
                'aria-valuemin': 0,
                'aria-valuemax': 100,
                'aria-valuenow': percent === null ? undefined : Math.min(100, Math.round(percent)),
                'aria-valuetext': percent === null ? undefined : t('quotaUsed').replace('{percent}', percentText),
              }, h('div', {
                className: 'ocg-quota-fill',
                style: { width: `${width}%`, '--ocg-quota-color': quotaTone(percent) },
              })),
              detail === '' ? null : h('div', { className: 'ocg-quota-meta', key: 'meta' }, detail),
            ]),
            h('span', { className: 'ocg-quota-pct', key: 'pct' }, percentText),
          ])
        })
        const quotaMessage = quotaStatus === 'error'
          ? h('div', { className: 'ocg-quota-message', key: 'message', role: 'alert', 'data-error': 'true' }, t(quotaErrorKey(quotaError)))
          : quotaStatus === 'loading'
            ? h('div', { className: 'ocg-quota-message', key: 'message', role: 'status' }, t('quotaLoading'))
            : quotaStatus === 'idle'
              ? h('div', { className: 'ocg-quota-message', key: 'message' }, t('quotaIdle'))
              : null
        const quotaCard = h('section', {
          className: 'ocg-card',
          key: 'quota',
          'aria-busy': quotaStatus === 'loading' ? 'true' : 'false',
        }, [
          h('div', { className: 'ocg-card-head', key: 'head' }, [
            h('span', { className: 'ocg-card-title', key: 'title' }, [
              t('quota'),
              h('small', { key: 'small' }, t('quotaSmall')),
            ]),
            quota?.fetchedAt
              ? h('span', { className: 'ocg-quota-updated', key: 'updated' }, t('quotaUpdated').replace('{time}', beijingTimestamp(quota.fetchedAt)))
              : null,
          ]),
          h('form', {
            className: 'ocg-quota-form',
            key: 'form',
            onSubmit: event => {
              event.preventDefault()
              void queryQuota(key)
            },
          }, [
            h('label', { className: 'ocg-sr-only', key: 'label', htmlFor: QUOTA_KEY_ID }, t('keyLabel')),
            h('input', {
              key: 'input',
              id: QUOTA_KEY_ID,
              className: 'ocg-quota-input',
              type: 'password',
              value: key,
              maxLength: 512,
              placeholder: t('keyPlaceholder'),
              autoComplete: 'off',
              autoCapitalize: 'off',
              autoCorrect: 'off',
              spellCheck: false,
              onChange: event => changeKey(event.target.value),
              'aria-describedby': `${QUOTA_KEY_ID}-hint`,
            }),
            h('button', {
              key: 'submit',
              type: 'submit',
              disabled: quotaStatus === 'loading' || key.trim() === '',
            }, quotaStatus === 'loading' ? t('querying') : quota === null ? t('query') : t('refresh')),
          ]),
          h('div', { className: 'ocg-quota-hint', key: 'hint', id: `${QUOTA_KEY_ID}-hint` }, t('keyHint')),
          quotaMessage,
          h('div', { className: 'ocg-quota-list', key: 'list' }, quotaRows),
        ])

        const header = h('header', { key: 'header' }, h('h2', null, t('pageTitle')))
        if (data === null) {
          return h('section', { className: 'ocg-page' }, header, h('div', { className: 'ocg-card ocg-state', key: 'state' },
            status === 'error'
              ? [
                h('span', { key: 'message' }, `${t('loadFailed')}: ${error}`),
                h('button', { key: 'retry', type: 'button', onClick: () => setAttempt(v => v + 1) }, t('retry')),
              ]
              : t('loading')), quotaCard)
        }

        const maxAmount = Math.max(0, ...data.days.map(day => day.amount))
        const windowEmpty = maxAmount === 0
        const hovered = !windowEmpty && hover >= 0 && hover < data.days.length ? data.days[hover] : null
        const tooltip = hovered === null ? null : (() => {
          const parts = hovered.models.map(entry => h('div', { className: 'ocg-tooltip-row', key: entry.id }, [
            h('i', { className: 'ocg-dot', key: 'dot', style: { background: entry.color } }),
            h('span', { className: 'ocg-tooltip-name', key: 'name' }, entry.name),
            h('span', { className: 'ocg-tooltip-amount', key: 'amount' }, money(entry.amount)),
          ]))
          const [, month, day] = hovered.date.split('-')
          const { weekday } = dayLabel(hovered.date, lang)
          return h('div', {
            className: 'ocg-tooltip',
            key: 'tooltip',
            role: 'tooltip',
            style: hover === 0
              ? { left: 0, transform: 'none' }
              : hover === data.days.length - 1
                ? { left: '100%', transform: 'translateX(-100%)' }
                : { left: `${((hover + 0.5) / data.days.length) * 100}%`, transform: 'translateX(-50%)' },
          }, [
            h('div', { className: 'ocg-tooltip-date', key: 'date' }, `${month}-${day} ${weekday}`),
            parts.length === 0
              ? h('div', { className: 'ocg-tooltip-empty', key: 'empty' }, t('emptyDay'))
              : parts,
            h('div', { className: 'ocg-tooltip-total', key: 'total' }, [
              h('span', { key: 'label' }, t('dayTotal')),
              h('span', { key: 'value' }, money(hovered.amount)),
            ]),
          ])
        })()

        const gridLines = [0, 0.5, 1].map(fraction => h('div', {
          className: 'ocg-grid',
          key: `grid-${fraction}`,
          style: { bottom: `${fraction * 100}%` },
        }))
        const columns = data.days.map((day, index) => {
          const barHeight = day.amount > 0 ? Math.max(2, (day.amount / maxAmount) * 100) : 0
          const segments = day.models.map(entry => h('div', {
            className: 'ocg-seg',
            key: entry.id,
            style: {
              height: entry.amount > 0 ? `${Math.max(1, (entry.amount / day.amount) * barHeight)}px` : '0px',
              background: entry.color,
            },
          }))
          return h('div', {
            className: 'ocg-col',
            key: day.date,
            role: 'img',
            tabIndex: 0,
            onMouseEnter: () => setHover(index),
            onMouseLeave: () => setHover(-1),
            onFocus: () => setHover(index),
            onBlur: () => setHover(-1),
            'aria-label': `${day.date} ${money(day.amount)}`,
          }, h('div', { className: 'ocg-bar', style: { height: `${barHeight}px` } }, segments))
        })
        const labels = data.days.map(day => {
          const label = dayLabel(day.date, lang)
          return h('div', { className: 'ocg-xlabel', key: day.date }, [
            h('b', { key: 'date' }, label.date),
            label.weekday,
          ])
        })

        const errorStrip = status === 'error'
          ? h('div', { className: 'ocg-error', key: 'error' }, [
            h('span', { key: 'message' }, `${t('loadFailed')}: ${error}`),
            h('button', { key: 'retry', type: 'button', onClick: () => setAttempt(v => v + 1) }, t('retry')),
          ])
          : null

        const totalCard = h('section', { className: 'ocg-card', key: 'total' }, [
          h('div', { className: 'ocg-card-head', key: 'head' }, h('span', { className: 'ocg-card-title', key: 'title' }, [
            t('total'),
            h('small', { key: 'since' }, t('since').replace('{time}', beijingTimestamp(data.startAt))),
          ])),
          h('div', { className: 'ocg-total', key: 'amount' }, money(data.total.amount)),
          data.total.models.length === 0
            ? h('div', { className: 'ocg-empty', key: 'empty' }, t('noUsage'))
            : h('ul', { className: 'ocg-models', key: 'models' }, data.total.models.map(entry => h('li', { className: 'ocg-model', key: entry.id }, [
              h('i', { className: 'ocg-dot', key: 'dot', style: { background: entry.color } }),
              h('span', { className: 'ocg-model-name', key: 'name' }, entry.name),
              h('span', { className: 'ocg-model-amount', key: 'amount' }, money(entry.amount)),
            ]))),
        ])

        const dailyCard = h('section', { className: 'ocg-card ocg-card-daily', key: 'daily', 'aria-busy': busy ? 'true' : 'false' }, [
          h('div', { className: 'ocg-card-head', key: 'head' }, [
            h('span', { className: 'ocg-card-title', key: 'title' }, [
              t('daily'),
              h('small', { key: 'last7' }, t('last7')),
            ]),
            h('label', { className: 'ocg-date', key: 'date' }, [
              h('span', { key: 'label' }, t('endDate')),
              h('input', {
                key: 'input',
                type: 'date',
                value: endDate || data.endDate,
                max: data.today,
                onChange: event => {
                  setHover(-1)
                  setEndDate(event.target.value)
                },
              }),
            ]),
          ]),
          windowEmpty
            ? h('div', { className: 'ocg-chart-empty', key: 'empty' }, t('emptyRange'))
            : h('div', { className: 'ocg-chart', key: 'chart', 'data-busy': busy ? 'true' : 'false' }, [
              h('div', { className: 'ocg-yaxis', key: 'yaxis' }, [0, 0.5, 1].map(fraction => h('span', {
                key: fraction,
                style: { bottom: `${fraction * 100}%` },
              }, axisMoney(maxAmount * fraction)))),
              h('div', { className: 'ocg-plot', key: 'plot' }, [...gridLines, ...columns, tooltip]),
              h('div', { className: 'ocg-xaxis', key: 'xaxis' }, labels),
            ]),
          data.legend.length > 1 && !windowEmpty
            ? h('div', { className: 'ocg-legend', key: 'legend' }, data.legend.map(entry => h('div', { className: 'ocg-legend-item', key: entry.id }, [
              h('i', { className: 'ocg-dot', key: 'dot', style: { background: entry.color } }),
              h('span', { key: 'name' }, entry.name),
            ])))
            : null,
        ])

        return h('section', { className: 'ocg-page' }, header, errorStrip, totalCard, dailyCard, quotaCard)
      }

      return Section
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => {
          injectCss()
          return () => document.getElementById(STYLE_ID)?.remove()
        })
        ctx.effect(() => {
          const disposeZh = ctx.locale.register(NS, 'zh', DICT.zh)
          const disposeEn = ctx.locale.register(NS, 'en', DICT.en)
          return () => {
            disposeZh()
            disposeEn()
          }
        })
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'opencode-go-usage',
          order: 25,
          label: () => ctx.locale.bind(NS)('sectionLabel'),
        }, makeSection(ctx.locale)))
        ctx.slots.inject('settings.section.icon', () => ctx.slots.register({
          name: 'settings.section.icon',
          id: 'opencode-go-usage',
          order: 25,
        }, UsageIcon))
      },
    }
  },
})
