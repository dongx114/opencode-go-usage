# opencode go 订阅用量消耗统计

在 **更多 → 设置 → 用量消耗** 中查看 OpenCode Go 订阅额度，以及通过第三方模型供应商 `opencode-go` 消耗的 token 和按模型价格表折算的美元费用。

GitHub：<https://github.com/dongx114/opencode-go-usage>

> GitHub 仓库地址使用 ASCII slug `opencode-go-usage`（平台限制）；项目名、插件标题和页面标题是 **opencode go 订阅用量消耗统计**。

页面包含三个模块：

- **订阅额度**：填入 OpenCode Go API key，显示 5 小时、周、月三个横向额度条；每条显示已用百分比与重置时间。
- **总消耗（估算）**：本机 DSH 对话中全部模型的基础 token 计价合计。下方模型明细默认收起，点击「模型明细」一行的「展开」查看各模型金额，再点「收起」折叠；总金额始终显示。
- **每日消耗**：固定 7 天的堆叠柱状图，只需选择「显示终止日期」；柱子按模型分色，悬停显示该日各模型金额与当日合计。

默认收起模型明细时，采用紧凑的总消耗和每日消耗布局，方便在同一屏查看三项订阅额度。

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

GitHub 地址安装需要本机有 `git`。没有 `git` 时可以下载源码 ZIP，再按下一节打成 `.tgz` 包安装。插件没有构建步骤、没有安装脚本、没有必需的 npm 运行时依赖，安装后即可使用。消耗统计会自动采集；额度需要在页面里填入 OpenCode Go API key。

直接填写**本地源码目录**可能建立目录链接，安装后仍依赖该目录。希望安装后能移走源码，请使用下面的 `.tgz` 方式。

### 独立安装（本地 .tgz 包）

插件可以打成一个包含全部运行文件的 npm 包，安装到 DSH 自己的用户目录后，不再依赖克隆或解压出来的源码目录。这里的「独立」指不依赖外部源码目录；插件仍由 DSH 加载运行。

1. 下载或克隆源码。在 PowerShell 中设置源码路径和安装包目录：

   ```powershell
   $pluginSource = 'D:\path\to\opencode-go-usage'  # 改成自己的源码目录
   $dshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
   $packageDir = Join-Path $dshHome 'plugins\local-packages'
   New-Item -ItemType Directory -Path $packageDir -Force | Out-Null
   ```

2. 打包，不运行生命周期脚本：

   ```powershell
   Push-Location $pluginSource
   try {
     npm pack --ignore-scripts --pack-destination $packageDir
     if ($LASTEXITCODE -ne 0) { throw '插件打包失败，请先解决错误。' }
   } finally {
     Pop-Location
   }
   ```

   当前版本输出 `dsh-opencode-go-usage-0.2.4.tgz`；以命令实际输出的文件名为准。打包只需要 Node.js/npm，不需要先执行 `npm install` 或构建。

3. **首次安装**：打开 DSH 的 **插件 → 添加插件**，填入刚生成的 `.tgz` 文件的绝对路径，安装并启用该插件。不要填写源码目录。例如：

   ```text
   C:\Users\你的用户名\.dsh\plugins\local-packages\dsh-opencode-go-usage-0.2.4.tgz
   ```

4. 重新加载 DSH，进入 **更多 → 设置 → 用量消耗**。确认安装正常后，外部源码目录可以移动或删除。

保留 DSH 用户目录中的 `.tgz` 包：它是本地依赖的安装来源，后续重装和依赖恢复会用到。备份 DSH 用户目录时一并保留 `plugins/local-packages`。

### 从 link 安装迁移为独立安装

已经安装同名插件时，不必先卸载或删除统计数据：

1. 在 DSH 中选择 **应用 → 退出并停止任务**。
2. 按上一节打包，把 `.tgz` 放到当前 `$DSH_HOME/plugins/local-packages` 中。
3. 在同一个 PowerShell 中进入当前 profile，替换这一个依赖。下面以默认 `web` profile 为例，需要本机能运行 `pnpm`：

   ```powershell
   $profileDir = Join-Path $dshHome 'profiles\web'
   Push-Location $profileDir
   try {
     pnpm add 'file:../../plugins/local-packages/dsh-opencode-go-usage-0.2.4.tgz' --ignore-scripts
     if ($LASTEXITCODE -ne 0) { throw '插件安装失败，请先解决错误。' }
     node -p "require('node:fs').realpathSync('node_modules/dsh-opencode-go-usage')"
   } finally {
     Pop-Location
   }
   ```

   包名中的版本应与刚生成的文件一致。`pnpm add` 同时更新 `package.json` 和 `pnpm-lock.yaml`，保留原有 bundle 启用项与其他依赖。

4. 检查 profile 的 `package.json`，该依赖应变成 `file:../../plugins/local-packages/…tgz`（Windows 上也可能使用反斜杠），不再是 `link:外部目录`。上面 `realpathSync` 的结果应位于 DSH 用户目录内。pnpm 仍可能使用内部链接，但实际插件文件不能再指向外部源码目录。
5. 重新打开 DSH，检查用量消耗页面。确认正常后可以移走原源码目录；统计账本仍保存在原有 DSH 用户目录中。

如果旧源码目录已经丢失，请先恢复它，或重新下载源码打包。备份或启动时出现 `ENOENT … dsh-opencode-go-usage`，应先检查是否还残留失效的 `link:` 引用。

### 本地开发（link，需要保留源码目录）

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

额度来自 OpenCode Go 的官方接口 `GET https://opencode.ai/inference/go/v1/usage`（Bearer 认证）。页面把 key 发送给本机插件宿主，由宿主代请求该接口，避免浏览器的跨域限制。

- key 只保存在当前标签页的 `sessionStorage`，关闭标签页后清除；不会写入账本或其它磁盘文件，也不会写入日志。查询成功后刷新页面会自动重新查询；额度变化时点「刷新」。
- 三个窗口只显示官方返回的已用百分比和重置时间；进度条按 0–100% 填充可用宽度。
- 不推算或显示美元额度。Go / Go Plus / Go Teams 的共享额度按模型折算，不能把百分比统一乘以某个固定美元数。
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

费用按基础单价折算，尚未计入峰时倍率、长上下文及单独的缓存写入价格，因此是估算值，不能作为官方实际扣费或订阅额度消耗。未知模型会按 0 单价记录；新增模型时请在 `prices.js` 补充价格。

## 数据来源与统计区间

- 统计区间：北京时间 **2026-11-23 00:01** 起至当前时刻。
- 数据来源：DeepSeek Harness 的 Session 事件。每条带 `usage` 的 `assistant/message`，以及带 usage 流的 `assistant/attempt`，在 `request/header` 的 provider 为 `opencode-go` 时记入账本。
- 插件启动及页面刷新统计时会回填会话；按持久化版本跳过未变化的会话，补入启动后新建、继续使用或由另一 DSH 进程写入的会话。
- 实时监听当前 DSH 进程的新事件；模型归属优先采用回答自身的实际模型来源。历史扫描不会覆盖更新的实时模型选择。
- 同一事件按 `sessionId:seq` 去重；发现旧记录归属错误时追加更正，汇总只采用该事件的最新记录。
- 账本保存在 `$DSH_HOME/storages/opencode-go-usage/usage.jsonl`（默认 `~/.dsh/storages/opencode-go-usage/usage.jsonl`）。
- 所有自然日按 UTC+8 切分。

统计范围是当前 DSH 用户目录中的对话，不是 OpenCode 账号的完整账单。其他软件、其他设备、直接 API 调用和未保存为 DSH 会话的模型连接测试，不会自动进入本机对话统计；官方控制台可能包含这些消耗。

## 关闭插件

关闭该 bundle 后，设置页入口消失，实时采集停止；已有账本文件保留，重新启用后会继续读取。删除该文件并重新加载插件可清空统计。

## License

[MIT](LICENSE)
