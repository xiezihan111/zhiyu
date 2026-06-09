import assert from "node:assert/strict";
import { after, before, test } from "node:test";

process.env.DISABLE_OPENAI = "true";

const { app, containsChinese, parseJson } = await import("../index.js");

let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

async function request(path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();
  return { response, body };
}

test("health endpoint exposes service configuration without secrets", async () => {
  const { response, body } = await request("/api/health");

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.hasOpenAIKey, false);
  assert.equal(body.openaiDisabled, true);
  assert.equal(typeof body.model, "string");
  assert.ok(response.headers.get("x-request-id"));
  assert.equal("apiKey" in body, false);
});

test("speech endpoint validates missing text before model access", async () => {
  const { response, body } = await request("/api/speech");

  assert.equal(response.status, 400);
  assert.equal(body.error, "Missing text.");
});

test("transcription endpoint validates missing audio", async () => {
  const { response, body } = await request("/api/transcribe", {
    method: "POST"
  });

  assert.equal(response.status, 400);
  assert.equal(body.error, "No audio file uploaded.");
});

test("normalization returns a stable empty-answer contract", async () => {
  const { response, body } = await request("/api/normalize-answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answer: "" })
  });

  assert.equal(response.status, 200);
  assert.deepEqual(body, {
    normalizedText: "",
    wasMixedLanguage: false,
    note: ""
  });
});

test("English-only normalization is a no-cost pass-through", async () => {
  const answer = "I led user research and prioritized the roadmap.";
  const { response, body } = await request("/api/normalize-answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answer })
  });

  assert.equal(response.status, 200);
  assert.equal(body.normalizedText, answer);
  assert.equal(body.wasMixedLanguage, false);
});

test("AI interview endpoint rejects an empty answer", async () => {
  const { response, body } = await request("/api/interview/next", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answer: "" })
  });

  assert.equal(response.status, 400);
  assert.equal(body.error, "Missing answer.");
});

test("report endpoint requires conversation history", async () => {
  const { response, body } = await request("/api/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ history: [] })
  });

  assert.equal(response.status, 400);
  assert.equal(body.error, "History is required.");
});

test("product event endpoint accepts only the measurement whitelist", async () => {
  const accepted = await request("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: "practice_started",
      properties: {
        scenario: "interview",
        answer: "This content must never be retained."
      }
    })
  });
  const rejected = await request("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event: "raw_answer_saved" })
  });

  assert.equal(accepted.response.status, 202);
  assert.deepEqual(accepted.body, { accepted: true });
  assert.equal(rejected.response.status, 400);
  assert.equal(rejected.body.error, "Unsupported event.");
});

test("metrics endpoint reports anonymous route-level reliability data", async () => {
  const { response, body } = await request("/api/metrics");

  assert.equal(response.status, 200);
  assert.ok(body.totalRequests >= 9);
  assert.ok(body.totalErrors >= 5);
  assert.equal(typeof body.averageDurationMs, "number");
  assert.ok(body.routes["GET /api/health"]);
  assert.equal(body.productEvents.practice_started, 1);
  assert.equal(JSON.stringify(body).includes("I led user research"), false);
  assert.equal(JSON.stringify(body).includes("This content must never be retained"), false);
});

test("evaluation helpers handle Chinese text and fenced JSON", () => {
  assert.equal(containsChinese("I负责 roadmap planning"), true);
  assert.equal(containsChinese("I own roadmap planning"), false);
  assert.deepEqual(parseJson("```json\n{\"ok\":true}\n```", {}), { ok: true });
});
