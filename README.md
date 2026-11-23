# opencode go 订阅用量消耗统计

在 **更多 → 设置 → 用量消耗** 中查看 OpenCode Go 订阅额度，以及通过第三方模型供应商 `opencode-go` 消耗的 token 和按模型价格表折算的美元费用。

GitHub：<https://github.com/dongx114/opencode-go-usage>

> GitHub 仓库地址使用 ASCII slug `opencode-go-usage`（平台限制）；项目名、插件标题和页面标题是 **opencode go 订阅用量消耗统计**。

页面包含三个模块：

- **订阅额度**：填入 OpenCode Go API key，显示 5 小时、周、月三个横向额度条；每条显示已用百分比与重置时间。
- **总消耗**：全部模型合计金额，以及产生过消耗的模型明细（模型名 + 金额）。
- **每日消耗**：固定 7 天的堆叠柱状图，只需选择「显示终止日期」；柱子按模型分色，悬停显示该日各模型金额与当日合计。

## 安装

### 在 DSH 里直接安装（推荐）

DSH 的插件安装器支持 GitHub 仓库地址，不需要先 clone、构建或手动修改 profile：

1. 打开 **插件 → 添加插件**。
2. 在「包名或地址」中填入：

   ```text
   https://github.com/dongx114/opencode-go-usage
   ```

   或：

   ```text
   github:dongx114/opencode-go-usage
   ```

3. 点「安装」，完成后启用 **opencode go 订阅用量消耗统计**。
4. 刷新页面，从 **更多 → 设置 → 用量消耗** 进入。

也可以下载 ZIP 或克隆到本地，在「添加插件」里填**绝对目录路径**安装。插件没有构建步骤、没有安装脚本、没有必需的 npm 运行时依赖，安装后即可使用。消耗统计会自动采集；额度需要在页面里填入 OpenCode Go API key。

### 本地开发（link）

也可以把源码放在任意目录，通过 profile 的 `link:` 依赖安装。源码不需要放进 DSH 安装目录，也不要修改 DSH 自身源码。

1. 克隆仓库（路径可自定）：

   ```powershell
   git clone https://github.com/dongx114/opencode-go-usage.git D:\deepseek\opencode-go-usage
   ```

2. 编辑当前 profile 的 `package.json`，例如 `C:\Users\<你>\.dsh\profiles\web\package.json`：

   ```json
   {
     "dependencies": {
       "dsh-opencode-go-usage": "link:D:/deepseek/opencode-go-usage"
     },
     "dsh": {
       "profile": {
         "bundles": [
           "dsh-opencode-go-usage"
         ]
       }
     }
   }
   ```

   把这两处合并进原有内容，不要覆盖已有依赖和 bundle。

3. 在 profile 目录安装链接：

   ```powershell
   cd $env:USERPROFILE\.dsh\profiles\web
   pnpm install
   ```

4. 重新加载 DSH（或在插件页停用再启用该 bundle），刷新页面后从 **更多 → 设置 → 用量消耗** 进入。

移动插件目录后，需要同步修改上面的 `link:` 路径并重新执行 `pnpm install`。删除源码目录前先移除 profile 中的依赖/bundle，否则该入口会失效。

## 文件结构

| 文件 | 作用 |
|---|---|
| `package.json` | 包入口、`dsh.bundle.patch`、client 平台声明 |
| `cordis.patch.yml` | 把 `opencode-go-usage` 插件插入 DSH 组合 |
| `index.js` | Host 侧：Session 采集、JSONL 账本、汇总/额度 HTTP 路由 |
| `prices.js` | 模型 → 三类单价表、显示名、颜色 |
| `client.js` | 设置页 React UI、额度卡、总消耗与 7 天图 |
| `locale/*.json` | 插件管理页的中英文元信息 |
| `icon.svg` | 设置页导航图标 |
| `test*.mjs` | Host、client 注册、渲染 smoke 测试 |

## 订阅额度

额度来自 OpenCode Go 的官方接口 `GET https://opencode.ai/zen/go/v1/usage`（Bearer 认证）。页面把 key 发送给本机插件宿主，由宿主代请求该接口，避免浏览器的跨域限制。

- key 只保存在当前标签页的 `sessionStorage`，关闭标签页后清除；不会写入账本或其它磁盘文件，也不会写入日志。查询成功后刷新页面会自动重新查询；额度变化时点「刷新」。
- 三个窗口的百分比直接使用接口返回值，不按公开套餐金额折算，避免 Go / Go Plus / Teams 套餐金额不同造成误导。
- 重置时间按北京时间（UTC+8）显示。
- 额度查询是只读的，不写入用量账本；消耗统计仍只来自 Session 事件。
- 401 表示 key 无效或不是 Go 订阅 key；403 表示 key 有效但无权读取该 workspace；429 表示查询过于频繁。

## 计价方式

单价表在 `prices.js`，单位为 **美元 / 百万 token**，每个模型维护三类单价：

| 类别 | 使用的 token 字段 | 单价字段 |
|---|---|---|
| 缓存命中 | `cacheReadTokens` | `cacheRead` |
| 缓存未命中 / 输入 | `inputTokens` + `cacheWriteTokens` | `input` |
| 输出 | `outputTokens` | `output` |

单条记录费用 = 命中 token × 命中单价 + 未命中 token × 未命中单价 + 输出 token × 输出单价。折算时使用 `prices.js` 中当前的价格表；每条记录同时保留写入时的单价快照，便于审计。调整价格表会重新折算历史记录。展示层只读取宿主机算好的金额，不含单价或计算公式。

费用按基础单价折算，不叠加 OpenCode Go 的峰谷时段倍率。未知模型会按 0 单价记录；新增模型时请在 `prices.js` 补充价格。

## 数据来源与统计区间

- 统计区间：北京时间 **2026-11-23 00:01** 起至当前时刻。
- 数据来源：DeepSeek Harness 的 Session 事件。每条带 `usage` 的 `assistant/message`，以及带 usage 流的 `assistant/attempt`，在 `request/header` 的 provider 为 `opencode-go` 时记入账本。
- 插件启动时会回填当天已有的 Session，随后实时监听新事件；同一事件按 `sessionId:seq` 去重。
- 账本保存在 `$DSH_HOME/storages/opencode-go-usage/usage.jsonl`（默认 `~/.dsh/storages/opencode-go-usage/usage.jsonl`）。
- 所有自然日按 UTC+8 切分。

## 关闭插件

关闭该 bundle 后，设置页入口消失，实时采集停止；已有账本文件保留，重新启用后会继续读取。删除该文件并重新加载插件可清空统计。

## License

[MIT](LICENSE)
