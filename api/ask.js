// Vercel serverless function: the only place the Anthropic API key is used.
// Environment variables (Vercel → Project → Settings → Environment Variables):
//   ANTHROPIC_API_KEY  (required for smart questions)
//   APP_ACCESS_CODE    (optional: if set, the app asks for this code before using Claude)
//   CLAUDE_MODEL       (optional: defaults to claude-haiku-5-5)

const MODEL = process.env.CLAUDE_MODEL || "claude-haiku-5-5";
const MAX_INPUT = 12000; // characters of user content per request

const OPS = {
  down: "Drill down: go deeper into causes or mechanics (why / how).",
  up: "Climb up: move toward the underlying goal, purpose or need behind the answer.",
  split: "Split: break the answer into one specific part (who, what, when, where, why or how) that hasn't been asked yet.",
  join: "Join: connect the latest answer with the other answer provided, asking how they relate, cause each other, compare, or combine.",
  flip: "Flip: reverse, exaggerate, remove, re-time, or view the answer from another perspective, or test the evidence behind it."
};

const QUESTION_SYSTEM = `You are the question engine inside a problem-solving app that works only by asking questions.
Rules:
- Reply with exactly ONE question and nothing else. No preamble, no quotes, no numbering.
- Never give advice, opinions, suggestions, answers or reassurance.
- Use the person's own words and specifics from their latest answer, so the question could only be asked about their situation.
- Apply the operator you are given.
- Plain, everyday language. Under 25 words.
- Do not repeat or closely rephrase any question listed as already asked.`;

const SUMMARY_SYSTEM = `You summarise a question tree the person built while thinking through a problem.
Use only what the person said in their answers. Do not invent facts.
Write plain text under 220 words with these four headings, each on its own line followed by short lines starting with "- ":
What the problem really is
Likely root causes
Threads worth exploring further
Next steps the answers point to`;

function clip(s, n) { return String(s || "").slice(0, n); }

async function callClaude(system, user, maxTokens) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] })
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error("Claude API " + r.status + ": " + t.slice(0, 200));
  }
  const data = await r.json();
  return (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
}

module.exports = async (req, res) => {
  const hasKey = !!process.env.ANTHROPIC_API_KEY;
  const needsCode = !!process.env.APP_ACCESS_CODE;

  if (req.method === "GET") {
    return res.status(200).json({ ok: hasKey, needsCode });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
  if (!hasKey) return res.status(503).json({ error: "No API key set on the server." });
  if (needsCode && req.headers["x-access-code"] !== process.env.APP_ACCESS_CODE) {
    return res.status(401).json({ error: "Access code is missing or wrong." });
  }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  try {
    if (body.mode === "summary") {
      const tree = clip(body.tree, MAX_INPUT);
      if (!tree) return res.status(400).json({ error: "Nothing to summarise yet." });
      const text = await callClaude(SUMMARY_SYSTEM, "Question tree:\n\n" + tree, 700);
      return res.status(200).json({ text });
    }

    const op = OPS[body.op] ? body.op : "down";
    const path = Array.isArray(body.path) ? body.path.slice(-12) : [];
    const lines = [];
    path.forEach((p, i) => {
      if (i === 0 && !p.q) lines.push("Starting statement: " + clip(p.a, 600));
      else lines.push("Q: " + clip(p.q, 300) + "\nA: " + clip(p.a, 600));
    });
    let user = "The conversation path so far (oldest first):\n" + lines.join("\n") + "\n\n";
    if (op === "join" && body.join) user += "Other answer to connect with: " + clip(body.join, 600) + "\n\n";
    const avoid = Array.isArray(body.avoid) ? body.avoid.slice(0, 20).map(q => clip(q, 200)) : [];
    if (avoid.length) user += "Already asked about the latest answer (do not repeat):\n- " + avoid.join("\n- ") + "\n\n";
    user += "Operator: " + OPS[op] + "\n\nWrite the next question about the latest answer.";
    user = clip(user, MAX_INPUT);

    let q = await callClaude(QUESTION_SYSTEM, user, 120);
    q = q.split("\n").map(s => s.trim()).filter(Boolean)[0] || "";
    q = q.replace(/^["“'\s]+|["”'\s]+$/g, "");
    if (!q) throw new Error("Empty question from Claude.");
    if (!q.endsWith("?")) q += "?";
    return res.status(200).json({ question: q });
  } catch (e) {
    return res.status(502).json({ error: e.message || "Claude request failed." });
  }
};
