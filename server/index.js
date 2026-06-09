import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import cors from "cors";
import express from "express";
import multer from "multer";
import OpenAI from "openai";
import { fetch as undiciFetch, ProxyAgent, setGlobalDispatcher } from "undici";

const app = express();
const port = Number(process.env.PORT || 8787);
const upload = multer({ dest: path.join(process.cwd(), "uploads") });

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY || "";
const proxyDispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : null;
if (proxyUrl) {
  setGlobalDispatcher(proxyDispatcher);
}

const openaiApiKey = String(process.env.OPENAI_API_KEY || "").trim();
const hasOpenAIKey = Boolean(openaiApiKey && openaiApiKey !== "sk-your-key-here");
const proxiedFetch = proxyDispatcher
  ? (url, init = {}) => undiciFetch(url, { ...init, dispatcher: proxyDispatcher })
  : undefined;
const client = hasOpenAIKey ? new OpenAI({ apiKey: openaiApiKey, fetch: proxiedFetch }) : null;

const model = process.env.OPENAI_MODEL || "gpt-5.4-mini";
const transcribeModel = process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-transcribe";
const speechModel = process.env.OPENAI_SPEECH_MODEL || "gpt-4o-mini-tts";
const speechVoice = process.env.OPENAI_SPEECH_VOICE || "cedar";
const speechInstructions =
  process.env.OPENAI_SPEECH_INSTRUCTIONS ||
  [
    "Speak like a professional narrator for a standardized senior high school English listening test.",
    "Use neutral General American English.",
    "Speak at about ninety percent of normal conversational speed.",
    "Pronounce every word clearly with crisp consonants and natural sentence stress.",
    "Use short, deliberate pauses between clauses and a slightly longer pause before each question.",
    "Keep the tone calm, neutral, focused, and non-theatrical.",
    "Avoid exaggerated emotion, sales energy, breathiness, or casual podcast delivery."
  ].join(" ");

function parseJson(raw, fallback) {
  try {
    const cleaned = String(raw || "")
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    return JSON.parse(cleaned);
  } catch (error) {
    return fallback;
  }
}

function apiErrorStatus(error, fallback = 500) {
  const status = Number(error.status || error.statusCode || error.response?.status || 0);
  return status >= 400 && status < 600 ? status : fallback;
}

function apiErrorDetail(error) {
  return String(error.message || "Unknown error").replace(/sk-[A-Za-z0-9_-]+/g, "sk-...");
}

function roleName(role) {
  return {
    pm: "product manager",
    engineer: "software engineer",
    operator: "operations specialist",
    sales: "sales representative"
  }[role] || "product manager";
}

function scenarioName(scenario) {
  return {
    interview: "English job interview",
    meeting: "business meeting update",
    intro: "professional self-introduction"
  }[scenario] || "English job interview";
}

function containsChinese(text) {
  return /[\u4e00-\u9fff]/.test(String(text || ""));
}

function systemPrompt(config) {
  return `
You are an AI English speaking coach for Chinese professionals.
The current scenario is: ${scenarioName(config.scenario)}.
The user's target role is: ${roleName(config.role)}.
Your style is: ${config.difficulty || "strict"}.

You must act like an interviewer or meeting coach.
Give concise but useful feedback in Chinese.
Ask the next question in natural English.
Do not be overly friendly. Be practical, specific, and interview-oriented.
Return JSON only.
`.trim();
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    hasOpenAIKey: Boolean(client),
    model,
    transcribeModel,
    speechModel,
    speechVoice,
    speechStyle: "standardized-listening-test"
  });
});

app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  if (!client) {
    res.status(400).json({
      error: "OPENAI_API_KEY is missing. Please create server/.env first."
    });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: "No audio file uploaded." });
    return;
  }

  try {
    const audio = fs.createReadStream(req.file.path);
    const result = await client.audio.transcriptions.create({
      file: audio,
      model: transcribeModel
    });
    res.json({ text: result.text || "" });
  } catch (error) {
    res.status(apiErrorStatus(error)).json({
      error: "Transcription failed.",
      detail: apiErrorDetail(error)
    });
  } finally {
    fs.unlink(req.file.path, () => {});
  }
});

app.get("/api/speech", async (req, res) => {
  if (!client) {
    res.status(400).json({
      error: "OPENAI_API_KEY is missing. Demo mode uses built-in local audio."
    });
    return;
  }

  const text = String(req.query.text || "").trim();
  if (!text) {
    res.status(400).json({ error: "Missing text." });
    return;
  }

  try {
    const speech = await client.audio.speech.create({
      model: speechModel,
      voice: speechVoice,
      input: text.slice(0, 900),
      instructions: speechInstructions,
      response_format: "mp3"
    });
    const buffer = Buffer.from(await speech.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.send(buffer);
  } catch (error) {
    res.status(apiErrorStatus(error)).json({
      error: "Speech generation failed.",
      detail: apiErrorDetail(error)
    });
  }
});

app.post("/api/normalize-answer", async (req, res) => {
  const { config = {}, answer = "", userTurn = 1 } = req.body;
  const raw = String(answer || "").trim();

  if (!raw) {
    res.json({
      normalizedText: "",
      wasMixedLanguage: false,
      note: ""
    });
    return;
  }

  if (!containsChinese(raw)) {
    res.json({
      normalizedText: raw,
      wasMixedLanguage: false,
      note: ""
    });
    return;
  }

  if (!client) {
    res.status(400).json({
      error: "OPENAI_API_KEY is missing. Demo mode can normalize mixed language locally."
    });
    return;
  }

  const fallback = {
    normalizedText:
      "I want to express my ideas clearly in English. I can describe my experience, share concrete examples, and keep improving my communication in professional situations.",
    wasMixedLanguage: true,
    note: "检测到中文或中英混说，已先整理成自然英文，再交给 AI 考官评估。"
  };

  try {
    const response = await client.responses.create({
      model,
      input: [
        {
          role: "system",
          content:
            "You help Chinese professionals practice spoken English. Convert Chinese or mixed Chinese-English answers into natural, concise spoken English for interviews or workplace meetings. Preserve the user's intent. Do not add fake achievements. Return JSON only."
        },
        {
          role: "user",
          content: JSON.stringify({
            task:
              "Normalize the answer. Return keys: normalizedText, wasMixedLanguage, note. The note must be short Chinese. normalizedText must be English only.",
            answer: raw,
            scenario: scenarioName(config.scenario),
            targetRole: roleName(config.role),
            userTurn
          })
        }
      ]
    });

    const parsed = parseJson(response.output_text, fallback);
    res.json({
      normalizedText: parsed.normalizedText || fallback.normalizedText,
      wasMixedLanguage: true,
      note:
        parsed.note ||
        "检测到中文或中英混说，已先整理成自然英文，再交给 AI 考官评估。"
    });
  } catch (error) {
    res.status(apiErrorStatus(error)).json({
      error: "Normalize answer failed.",
      detail: apiErrorDetail(error)
    });
  }
});

app.post("/api/interview/next", async (req, res) => {
  if (!client) {
    res.status(400).json({
      error: "OPENAI_API_KEY is missing. Turn on demo mode or configure server/.env."
    });
    return;
  }

  const { config = {}, history = [], answer = "", userTurn = 1 } = req.body;
  const done = Number(userTurn) >= 3;
  const fallback = {
    feedback: "回答能表达基本意思。建议补充更具体的例子、量化结果和更自然的连接词。",
    assistantText: done
      ? "Thanks. That is enough for this round. I will now prepare your report."
      : "Can you give me a more specific example with your action and result?",
    done
  };

  try {
    const response = await client.responses.create({
      model,
      input: [
        {
          role: "system",
          content: systemPrompt(config)
        },
        {
          role: "user",
          content: JSON.stringify({
            task:
              "Review the latest answer and return next interview step as JSON with keys: feedback, assistantText, done.",
            latestAnswer: answer,
            userTurn,
            done,
            conversation: history.slice(-8)
          })
        }
      ]
    });

    const parsed = parseJson(response.output_text, fallback);
    res.json({
      feedback: parsed.feedback || fallback.feedback,
      assistantText: parsed.assistantText || fallback.assistantText,
      done: Boolean(parsed.done ?? fallback.done)
    });
  } catch (error) {
    res.status(apiErrorStatus(error)).json({
      error: "AI next question failed.",
      detail: apiErrorDetail(error)
    });
  }
});

app.post("/api/report", async (req, res) => {
  if (!client) {
    res.status(400).json({
      error: "OPENAI_API_KEY is missing. Turn on demo mode or configure server/.env."
    });
    return;
  }

  const { config = {}, history = [] } = req.body;
  const fallback = {
    title: "英文面试陪练报告",
    summary: "你完成了一轮英语陪练。整体可以开口表达，但需要加强结构、例子和自然度。",
    scores: [
      { name: "流利度", value: 72 },
      { name: "结构感", value: 68 },
      { name: "自然度", value: 70 },
      { name: "职场匹配", value: 74 }
    ],
    strengths: ["能围绕问题作答。", "具备基础职场表达能力。"],
    improvements: ["补充具体项目例子。", "减少中式直译。", "使用 STAR 结构。"],
    upgradedSentences: [
      {
        before: "I do product work.",
        after: "I manage the product workflow from user research to launch."
      }
    ],
    portfolioNote:
      "该 MVP 覆盖场景选择、AI 角色扮演、语音/文字回答、即时反馈和总结评估。"
  };

  try {
    const response = await client.responses.create({
      model,
      input: [
        {
          role: "system",
          content:
            "You are an AI product evaluator and English coach. Return JSON only. The report must be in Chinese, except upgraded English sentences."
        },
        {
          role: "user",
          content: JSON.stringify({
            task:
              "Generate a coaching report with keys: title, summary, scores, strengths, improvements, upgradedSentences, portfolioNote. Scores must be 0-100.",
            config,
            history
          })
        }
      ]
    });

    const parsed = parseJson(response.output_text, fallback);
    res.json({
      ...fallback,
      ...parsed,
      scores: Array.isArray(parsed.scores) ? parsed.scores : fallback.scores,
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : fallback.strengths,
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements : fallback.improvements,
      upgradedSentences: Array.isArray(parsed.upgradedSentences)
        ? parsed.upgradedSentences
        : fallback.upgradedSentences
    });
  } catch (error) {
    res.status(apiErrorStatus(error)).json({
      error: "AI report failed.",
      detail: apiErrorDetail(error)
    });
  }
});

app.listen(port, () => {
  console.log(`ZhiYu Coach server is running at http://127.0.0.1:${port}`);
});
