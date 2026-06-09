import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { containsChinese } from "../index.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(scriptDir, "..");
const casesPath = path.join(serverDir, "evals", "interview-cases.json");
const resultsDir = path.join(serverDir, "eval-results");
const runLive = process.env.RUN_LIVE_EVALS === "true";
const baseUrl = process.env.EVAL_BASE_URL || "http://127.0.0.1:8787";

function validateCase(item, ids) {
  const errors = [];
  if (!item.id || ids.has(item.id)) errors.push("id must exist and be unique");
  if (!["interview", "meeting", "intro"].includes(item.scenario)) {
    errors.push("scenario is invalid");
  }
  if (!["pm", "engineer", "operator", "sales"].includes(item.role)) {
    errors.push("role is invalid");
  }
  if (!["basic", "advanced", "strict"].includes(item.difficulty)) {
    errors.push("difficulty is invalid");
  }
  if (!String(item.answer || "").trim()) errors.push("answer is required");
  if (containsChinese(item.answer) !== item.expect?.containsChinese) {
    errors.push("containsChinese expectation does not match the input");
  }
  if (Boolean(item.expect?.normalizationNeeded) !== Boolean(item.expect?.containsChinese)) {
    errors.push("normalizationNeeded must match containsChinese for the MVP");
  }
  ids.add(item.id);
  return errors;
}

async function evaluateLive(item) {
  const normalizeResponse = await fetch(`${baseUrl}/api/normalize-answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      config: item,
      answer: item.answer,
      userTurn: 1
    })
  });
  const normalized = await normalizeResponse.json();
  const checks = {
    normalizeStatusOk: normalizeResponse.ok,
    normalizedTextPresent: Boolean(normalized.normalizedText),
    normalizedEnglishOnly:
      !item.expect.normalizationNeeded || !containsChinese(normalized.normalizedText),
    mixedLanguageFlagCorrect:
      Boolean(normalized.wasMixedLanguage) === Boolean(item.expect.normalizationNeeded)
  };

  if (!normalizeResponse.ok) {
    return {
      passed: false,
      checks,
      error: normalized.error || `HTTP ${normalizeResponse.status}`
    };
  }

  const nextResponse = await fetch(`${baseUrl}/api/interview/next`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      config: item,
      history: [],
      answer: normalized.normalizedText,
      userTurn: 1
    })
  });
  const next = await nextResponse.json();
  checks.nextStatusOk = nextResponse.ok;
  checks.feedbackPresent = Boolean(next.feedback);
  checks.nextQuestionPresent = Boolean(next.assistantText);
  checks.nextQuestionEnglishOnly = !containsChinese(next.assistantText);

  return {
    passed: Object.values(checks).every(Boolean),
    checks,
    error: nextResponse.ok ? "" : next.error || `HTTP ${nextResponse.status}`
  };
}

const raw = await fs.readFile(casesPath, "utf8");
const cases = JSON.parse(raw);
const ids = new Set();
const validationResults = cases.map((item) => ({
  id: item.id,
  errors: validateCase(item, ids)
}));
const invalidCases = validationResults.filter((item) => item.errors.length > 0);

const report = {
  generatedAt: new Date().toISOString(),
  mode: runLive ? "live" : "offline-contract",
  dataset: {
    totalCases: cases.length,
    validCases: cases.length - invalidCases.length,
    invalidCases: invalidCases.length,
    scenarios: [...new Set(cases.map((item) => item.scenario))],
    roles: [...new Set(cases.map((item) => item.role))],
    mixedLanguageCases: cases.filter((item) => item.expect.containsChinese).length
  },
  validationResults
};

if (runLive) {
  report.liveResults = [];
  for (const item of cases) {
    report.liveResults.push({
      id: item.id,
      ...(await evaluateLive(item))
    });
  }
  report.livePassRate = Number(
    (
      report.liveResults.filter((item) => item.passed).length / report.liveResults.length
    ).toFixed(4)
  );
} else {
  report.note =
    "Offline mode validates the evaluation dataset and contracts without calling a paid model. Set RUN_LIVE_EVALS=true after the API quota and local server are available.";
}

await fs.mkdir(resultsDir, { recursive: true });
await fs.writeFile(
  path.join(resultsDir, "latest.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8"
);

console.log(
  `Evaluation complete: ${report.dataset.validCases}/${report.dataset.totalCases} valid cases (${report.mode}).`
);

if (invalidCases.length > 0) {
  process.exitCode = 1;
}
