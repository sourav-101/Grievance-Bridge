import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Reply = { status: number; body: unknown };
const ok = (content: string): Reply => ({ status: 200, body: { choices: [{ message: { content } }] } });

/** Fake Groq: answers per model from a queue and records which models were asked. */
function fakeGroq(replies: Record<string, Reply[]>) {
  const asked: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      const model = JSON.parse(String(init.body)).model as string;
      asked.push(model);
      const r = replies[model]?.shift() ?? ok("{}");
      return new Response(typeof r.body === "string" ? r.body : JSON.stringify(r.body), { status: r.status });
    }),
  );
  return asked;
}

const loadGroq = async () => {
  vi.resetModules(); // fresh "paused until" state per test
  return import("@/lib/ai/groq");
};

describe("Groq fallback model", () => {
  beforeEach(() => {
    process.env.GROQ_API_KEY = "test-key";
    process.env.GROQ_MODEL = "openai/gpt-oss-120b";
    delete process.env.GROQ_FALLBACK_MODEL;
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses only the main model when it answers", async () => {
    const asked = fakeGroq({ "openai/gpt-oss-120b": [ok('{"a":1}')] });
    const { groqJson } = await loadGroq();
    expect(await groqJson("Return JSON", "x")).toEqual({ a: 1 });
    expect(asked).toEqual(["openai/gpt-oss-120b"]);
  });

  it("switches to the backup on a daily limit, and keeps using it while the limit lasts", async () => {
    const limit: Reply = {
      status: 429,
      body: { error: { message: "Rate limit reached on tokens per day (TPD): Limit 200000. Please try again in 12m30s." } },
    };
    const asked = fakeGroq({ "openai/gpt-oss-120b": [limit], "qwen/qwen3.8-27b": [ok("first"), ok("second")] });
    const { groqText } = await loadGroq();
    expect(await groqText("s", "u")).toBe("first");
    expect(await groqText("s", "u")).toBe("second");
    expect(asked).toEqual(["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "qwen/qwen3.8-27b"]);
  });

  it("retries a broken-JSON answer on the backup", async () => {
    const broken: Reply = { status: 400, body: { error: { code: "json_validate_failed", message: "Failed to validate JSON." } } };
    const asked = fakeGroq({ "openai/gpt-oss-120b": [broken], "qwen/qwen3.8-27b": [ok('{"rating":"Satisfied"}')] });
    const { groqJson } = await loadGroq();
    expect(await groqJson("Return JSON", "x")).toEqual({ rating: "Satisfied" });
    expect(asked).toEqual(["openai/gpt-oss-120b", "qwen/qwen3.8-27b"]);
  });

  it("strips leaked <think> blocks", async () => {
    fakeGroq({ "openai/gpt-oss-120b": [ok("<think>hmm</think> Hello")] });
    const { groqText } = await loadGroq();
    expect(await groqText("s", "u")).toBe("Hello");
  });

  it("reports the error when the fallback is switched off", async () => {
    process.env.GROQ_FALLBACK_MODEL = "none";
    const asked = fakeGroq({ "openai/gpt-oss-120b": [{ status: 429, body: { error: { message: "Please try again in 5s." } } }] });
    const { groqText } = await loadGroq();
    await expect(groqText("s", "u")).rejects.toThrow(/Groq 429/);
    expect(asked).toEqual(["openai/gpt-oss-120b"]);
  });
});
