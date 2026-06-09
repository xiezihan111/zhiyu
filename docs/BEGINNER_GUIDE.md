# 小白操作教程：从 0 打开这个小程序

这份教程会带你完成第一版。你不要急，按顺序做就行。

## 你今天要完成什么

你今天要得到一个能展示的作品：

1. 打开微信开发者工具。
2. 导入小程序项目。
3. 先用演示模式跑完整流程。
4. 再启动本地后端。
5. 如果你有 OpenAI API Key，就接入真实 AI。
6. 最后学会怎么把它讲成 AI 产品经理作品集。

## 第 1 步：确认你电脑需要安装什么

你需要 2 个软件：

1. 微信开发者工具。
2. Node.js。

### 1.1 安装微信开发者工具

打开微信官方页面下载：

https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html

安装完成后，打开它。

### 1.2 安装 Node.js

打开 Node.js 官网：

https://nodejs.org/

下载 LTS 版本并安装。

安装后，打开 PowerShell，输入：

```powershell
node -v
```

如果你看到类似 `v22.16.0` 的版本号，说明成功。

再输入：

```powershell
npm -v
```

如果你看到版本号，说明 npm 也成功。

## 第 2 步：先不用 AI，打开小程序演示版

你的项目目录是：

```text
C:\Users\36107\Documents\Codex\2026-06-08\https-www-xiaohongshu-com-collection-item\outputs\ai-english-coach-miniapp\miniprogram
```

### 2.1 打开微信开发者工具

打开微信开发者工具后，选择：

```text
小程序 -> 导入项目
```

### 2.2 填项目目录

项目目录选择：

```text
C:\Users\36107\Documents\Codex\2026-06-08\https-www-xiaohongshu-com-collection-item\outputs\ai-english-coach-miniapp\miniprogram
```

AppID 可以选：

```text
测试号 / touristappid
```

然后点“导入”。

### 2.3 关闭域名校验

在微信开发者工具右上角找到：

```text
详情 -> 本地设置
```

勾选：

```text
不校验合法域名、web-view、TLS 版本以及 HTTPS 证书
```

这一步很重要。因为第一版后端跑在你电脑本地，不是正式 HTTPS 域名。

### 2.4 运行演示模式

打开后你会看到首页。

先保持“演示模式”开着。

然后按这个顺序点：

1. 选择“英文面试”。
2. 选择“产品经理”。
3. 选择“严厉考官”。
4. 点“开始陪练”。
5. 在输入框里随便输入一段英文，例如：

```text
I am a product manager candidate. I have experience in user research and product planning.
```

你也可以测试中英混说，例如：

```text
我是产品经理候选人，I did user research and roadmap planning，希望加入 international team。
```

系统会先显示你的原始表达，再自动整理成自然英文。

6. 点“提交”。
7. 连续提交 3 次。
8. 看总结报告。

如果能看到报告，说明小程序前端已经成功。

## 第 3 步：启动本地 AI 后端

现在打开 PowerShell。

进入后端目录：

```powershell
cd "C:\Users\36107\Documents\Codex\2026-06-08\https-www-xiaohongshu-com-collection-item\outputs\ai-english-coach-miniapp\server"
```

安装依赖：

```powershell
npm install
```

启动后端：

```powershell
npm run dev
```

如果你看到：

```text
AI English Coach server is running at http://127.0.0.1:8787
```

说明后端启动成功。

## 第 4 步：配置 OpenAI API Key

如果你暂时没有 API Key，可以先跳过这一步，继续用演示模式。

如果你有 API Key：

### 4.1 复制环境变量文件

在 `server` 文件夹里有一个文件：

```text
.env.example
```

复制一份，改名为：

```text
.env
```

### 4.2 填入你的 Key

打开 `.env`，把这一行：

```text
OPENAI_API_KEY=sk-your-key-here
```

改成你的真实 Key：

```text
OPENAI_API_KEY=你的真实key
```

保存。

### 4.3 重新启动后端

如果后端正在运行，先按：

```text
Ctrl + C
```

然后重新启动：

```powershell
npm run dev
```

## 第 5 步：让小程序请求真实 AI

回到微信开发者工具。

回到首页。

把“演示模式”关掉。

然后开始陪练。

现在流程会请求本地后端：

```text
小程序 -> 本地后端 -> OpenAI -> 本地后端 -> 小程序
```

## 第 6 步：测试录音

在陪练页点“录音”。

说一段英文。

再点“停止”。

如果你关掉了演示模式，并且后端有 OpenAI API Key，录音会上传到本地后端转文字。

如果录音失败，常见原因是：

1. 微信开发者工具没有麦克风权限。
2. 电脑系统没有给微信开发者工具麦克风权限。
3. 后端没有启动。
4. 没有关掉演示模式。

新版里如果没有麦克风权限，小程序会弹出“需要麦克风权限”。

你可以这样处理：

1. 点“去设置”。
2. 在设置里打开录音权限。
3. 回到页面再点“录音”。

如果你现在只是演示作品，不一定非要录音。你可以：

1. 点“填入示范回答”。
2. 点“提交”。
3. 用文字方式跑完整个流程。

微信开发者工具的游客模式有时会限制录音，这是工具环境问题，不代表真机一定失败。真正测试录音时，建议后面用“真机调试”。

## 第 6.5 步：测试 AI 考官语音

首页可以打开“AI 考官语音”。

陪练页也可以打开或关闭这个开关。

演示模式下，系统会播放内置的考官提问音频。真实 AI 模式下，如果后端配置了 OpenAI API Key，会通过 `/api/speech` 动态生成语音。

## 第 6.6 步：测试中英混说辅助

陪练页默认打开“中英混说辅助”。

你可以输入：

```text
这个项目里我负责用户调研 and product roadmap，跟设计和工程一起推进上线。
```

正常效果：

1. 用户气泡显示你的原始表达。
2. 下面出现“已整理英文”。
3. AI 考官基于整理后的英文继续追问。

这个功能是为了降低开口压力。真实用户卡壳时可以先用中文表达意思，系统再帮他过渡到英文。

## 第 7 步：你向面试官展示时怎么操作

展示顺序建议这样：

1. 打开首页。
2. 说：“我第一版聚焦英文面试、会议发言和自我介绍三个高频场景。”
3. 选择“英文面试 + 产品经理 + 严厉考官”。
4. 开始陪练。
5. 输入或录音回答。
6. 展示即时反馈。
7. 连续三轮后展示报告。
8. 打开 `docs/PRD.md`，讲产品设计。
9. 打开 `docs/INTERVIEW_STORY.md`，讲你的产品经理思考。

## 第 8 步：如果你报错了怎么办

你只需要把下面 3 个信息发给我：

1. 你做到第几步。
2. 屏幕上的红字报错。
3. 你刚刚点了什么或输入了什么。

我会继续一步一步带你修。
