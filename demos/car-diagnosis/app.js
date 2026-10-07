import { ExpertSystem, humanise } from "./engine.js";

const el = (id) => document.getElementById(id);

let rules = [];
let questions = [];
let system = null;
let history = []; // [{ questionId, factKeys }] so Back can undo cleanly

/* ---------- boot ---------- */

async function boot() {
  try {
    const [r, q] = await Promise.all([
      fetch("data/rules.json").then((res) => {
        if (!res.ok) throw new Error("rules " + res.status);
        return res.json();
      }),
      fetch("data/questions.json").then((res) => {
        if (!res.ok) throw new Error("questions " + res.status);
        return res.json();
      }),
    ]);
    rules = r;
    questions = q;
    el("loading").hidden = true;
    el("question-view").hidden = false;
    start();
  } catch (err) {
    el("loading").hidden = true;
    el("error-view").hidden = false;
    console.error(err);
  }
}

function start() {
  system = new ExpertSystem(rules, questions);
  history = [];
  el("result").hidden = true;
  el("quiz").hidden = false;
  el("question-view").hidden = false;
  render();
}

/* ---------- question flow ---------- */

function render() {
  const question = system.getNextQuestion();

  if (!question) {
    showResult();
    return;
  }

  el("progress-label").textContent =
    "Question " + (history.length + 1);
  el("back-btn").hidden = history.length === 0;
  el("question-text").textContent = question.text;

  const box = el("options");
  box.replaceChildren();

  for (const option of question.options) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "option";
    btn.textContent = option.text;
    btn.addEventListener("click", () => answer(question, option));
    box.appendChild(btn);
  }
}

function answer(question, option) {
  const factKeys = Object.keys(option.fact);
  history.push({ questionId: question.id, factKeys });

  system.addInitialFacts(option.fact);
  system.markQuestionAsked(question.id);
  system.runInference();

  render();
}

/* Rebuild from scratch minus the last answer — simpler than unwinding
   inferred facts, and the knowledge base is small enough that it is instant. */
function goBack() {
  if (!history.length) return;
  const replay = history.slice(0, -1);

  system = new ExpertSystem(rules, questions);
  history = [];

  for (const step of replay) {
    const question = questions.find((q) => q.id === step.questionId);
    if (!question) continue;
    const fact = {};
    for (const key of step.factKeys) {
      const match = question.options.find((o) => key in o.fact);
      if (match) Object.assign(fact, match.fact);
    }
    history.push(step);
    system.addInitialFacts(fact);
    system.markQuestionAsked(question.id);
    system.runInference();
  }

  el("result").hidden = true;
  el("quiz").hidden = false;
  render();
}

/* ---------- result ---------- */

function showResult() {
  const res = system.getResults();

  el("quiz").hidden = true;
  el("result").hidden = false;

  const verdict = el("verdict");
  verdict.replaceChildren();

  if (!res.diagnosis) {
    verdict.classList.add("verdict-none");
    verdict.classList.remove("verdict-found");
    verdict.appendChild(tag("p", "verdict-label", "No match"));
    verdict.appendChild(
      tag("h2", "verdict-title", "No specific problem could be identified")
    );
    verdict.appendChild(
      tag(
        "p",
        "verdict-note",
        "This combination of symptoms matches no rule in the knowledge base. " +
          "That is the honest answer rather than a guess — the base covers 14 faults, " +
          "and yours is not one of them."
      )
    );
  } else {
    verdict.classList.add("verdict-found");
    verdict.classList.remove("verdict-none");
    verdict.appendChild(tag("p", "verdict-label", "Likely fault"));
    verdict.appendChild(tag("h2", "verdict-title", res.diagnosis));

    if (res.chain.length) {
      const chain = document.createElement("p");
      chain.className = "verdict-chain mono";
      chain.textContent = res.chain.map(humanise).join("  →  ");
      verdict.appendChild(chain);
    }
  }

  renderTrace(res);
}

function renderTrace(res) {
  const body = el("trace-body");
  body.replaceChildren();

  if (!res.trace.length) {
    body.appendChild(
      tag("p", "muted", "No rules fired, so there is nothing to trace.")
    );
    return;
  }

  const seq = document.createElement("p");
  seq.className = "rule-sequence mono";
  seq.textContent = res.rulesFired.join("  →  ");
  body.appendChild(seq);

  const list = document.createElement("ol");
  list.className = "rule-list";

  for (const fired of res.trace) {
    const li = document.createElement("li");

    const id = document.createElement("span");
    id.className = "rule-id mono";
    id.textContent = fired.rule_id;
    li.appendChild(id);

    const desc = document.createElement("span");
    desc.className = "rule-desc";
    desc.textContent = fired.description || "(no description)";
    li.appendChild(desc);

    const out = document.createElement("span");
    out.className = "rule-out mono";
    out.textContent = "→ " + fired.inferred_facts.map(humanise).join(", ");
    li.appendChild(out);

    list.appendChild(li);
  }
  body.appendChild(list);

  const answered = document.createElement("div");
  answered.className = "facts-given";
  answered.appendChild(tag("h3", null, "What you told it"));
  const ul = document.createElement("ul");
  for (const key of Object.keys(system.facts)) {
    if (system.reasoningChain[key]?.source !== "user_input") continue;
    const li = document.createElement("li");
    li.textContent = humanise(key) + ": " + formatValue(system.facts[key]);
    ul.appendChild(li);
  }
  answered.appendChild(ul);
  body.appendChild(answered);
}

function formatValue(value) {
  if (value === true) return "yes";
  if (value === false) return "no";
  return humanise(value);
}

function tag(name, className, text) {
  const node = document.createElement(name);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/* ---------- wiring ---------- */

el("back-btn").addEventListener("click", goBack);
el("restart-btn").addEventListener("click", start);
el("restart-top").addEventListener("click", start);

boot();
