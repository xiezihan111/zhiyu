# 职语 Coach：接口联调与测试手册

## 1. 目前产品到底做到哪一步

当前版本不是纯前端页面，已经包含一套 Node.js 后端，并设计了完整链路：

`小程序 -> 录音/文字 -> 后端接口 -> OpenAI -> 反馈/追问/报告 -> 小程序展示`

后端共有 8 个接口：

| 接口 | 作用 |
| --- | --- |
| `GET /api/health` | 检查服务、模型和 Key 配置状态 |
| `GET /api/metrics` | 查看匿名接口性能和产品事件 |
| `POST /api/events` | 接收白名单产品事件，不保存回答内容 |
| `POST /api/transcribe` | 录音转文字 |
| `GET /api/speech` | AI 考官文字转语音 |
| `POST /api/normalize-answer` | 将中文或中英混说整理成英文 |
| `POST /api/interview/next` | 生成反馈和下一轮问题 |
| `POST /api/report` | 生成练习总结报告 |

其中 5 个接口需要 OpenAI 额度才能完成真实模型调用；没有额度时，演示模式仍可走完页面闭环。

## 2. 每次开发后先运行自动检查

打开 PowerShell，执行：

```powershell
cd C:\Users\36107\Documents\Codex\2026-06-08\https-www-xiaohongshu-com-collection-item\outputs\ai-english-coach-miniapp-fresh\server
npm run check
```

它会依次完成：

1. 运行接口自动测试。
2. 检查错误输入、空回答、无录音、无历史记录等边界情况。
3. 验证评测集格式和覆盖范围。
4. 默认不调用付费模型，不消耗 API 额度。

看到 `fail 0` 和 `12/12 valid cases` 才说明本次修改通过基础回归。

## 3. 本地接口联调

### 第一步：启动后端

```powershell
cd C:\Users\36107\Documents\Codex\2026-06-08\https-www-xiaohongshu-com-collection-item\outputs\ai-english-coach-miniapp-fresh\server
npm start
```

成功后会显示：

```text
ZhiYu Coach server is running at http://127.0.0.1:8787
```

这个窗口不要关闭。

### 第二步：检查健康状态

另开一个 PowerShell：

```powershell
Invoke-RestMethod http://127.0.0.1:8787/api/health
```

重点看：

- `ok: true`：后端正常运行。
- `hasOpenAIKey: true`：已经识别到 Key。
- `openaiDisabled: false`：当前不是测试禁用模式。

健康接口不会返回 API Key 原文。

### 第三步：测试不收费的英文直通逻辑

```powershell
$body = @{
  answer = "I led user research and prioritized the roadmap."
  config = @{
    scenario = "interview"
    role = "pm"
    difficulty = "strict"
  }
  userTurn = 1
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri http://127.0.0.1:8787/api/normalize-answer `
  -Method Post `
  -ContentType "application/json" `
  -Body $body
```

英文回答应原样返回，且 `wasMixedLanguage` 为 `false`。

### 第四步：在微信开发者工具联调

1. 保持后端 PowerShell 窗口运行。
2. 打开微信开发者工具并导入 `miniprogram` 文件夹。
3. 在首页关闭“演示模式”。
4. 开启“不校验合法域名”仅用于本地开发。
5. 输入一段英文并提交。
6. 在开发者工具的 Network 面板检查请求状态。

请求顺序应为：

```text
normalize-answer -> interview/next -> speech（打开语音时）-> report
```

录音回答会先增加：

```text
transcribe -> normalize-answer
```

## 4. 错误怎么定位

每个接口响应都会带 `X-Request-Id`。出现问题时记录：

- 请求接口。
- HTTP 状态码。
- `X-Request-Id`。
- 错误发生时间。
- 是否演示模式。
- 是否语音输入。

常见状态：

| 状态 | 含义 | 处理 |
| --- | --- | --- |
| `400` | 参数缺失、未上传录音或未配置 Key | 检查请求内容和 `.env` |
| `401` | API Key 无效 | 重新创建 Key |
| `429` | OpenAI 额度不足或限流 | 充值、检查额度或稍后重试 |
| `500+` | 后端或上游服务异常 | 查看服务日志和 Request ID |
| 请求失败 | 小程序无法连接后端 | 检查后端、HTTPS、合法域名 |

## 5. AI 质量测试

评测集位于：

`server/evals/interview-cases.json`

目前包含 12 条代表性回答，覆盖：

- 纯英文。
- 纯中文。
- 中英混说。
- 回答过短。
- 回答空泛。
- STAR 结构。
- 产品、技术、运营、销售岗位。
- 面试、会议、自我介绍场景。

有 API 额度且本地服务已经启动后，运行真实模型评测：

```powershell
$env:RUN_LIVE_EVALS="true"
npm run eval
Remove-Item Env:RUN_LIVE_EVALS
```

结果保存到 `server/eval-results/latest.json`，该文件不会上传 GitHub。

真实模型评测至少检查：

- 中文是否被识别。
- 整理后是否只包含英文。
- 是否保留原意，不能编造经历。
- 反馈是否具体、可执行。
- 下一问是否与回答相关。
- 下一问是否为自然英文。

## 6. 上线前还必须完成

1. 恢复可用的 OpenAI API 额度。
2. 将 Node.js 后端部署到中国大陆可访问的 HTTPS 服务。
3. 把 `miniprogram/app.js` 的 `apiBase` 改成正式 HTTPS 地址。
4. 在微信公众平台配置 request、uploadFile、downloadFile 合法域名。
5. 完成真机录音、语音播放、弱网和拒绝权限测试。
6. 用 5 至 10 名目标用户完成第一轮可用性测试。
7. 将内存指标改为数据库或正式分析平台，避免服务重启后数据丢失。

