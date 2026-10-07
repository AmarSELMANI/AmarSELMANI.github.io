/* ============================================================
   Forward-chaining inference engine.

   A direct port of engine/inference_engine.py from
   github.com/AmarSELMANI/Car_Diagnosis_Expert_System — same rule
   semantics, same firing order, same reasoning trace. The Python
   version used pandas only to hold the rule table, so nothing is
   lost by iterating a plain array here.
   ============================================================ */

export class ExpertSystem {
  constructor(rules, questions) {
    this.rules = rules;
    this.questions = questions;
    this.facts = {};
    this.firedRules = [];      // rules that fired, in order
    this.reasoningChain = {};  // fact -> how it came to be known
    this.askedQuestions = new Set();
  }

  addInitialFacts(userInputs) {
    for (const key of Object.keys(userInputs)) {
      this.facts[key] = userInputs[key];
      this.reasoningChain[key] = { source: "user_input", rule: null };
    }
  }

  /* A condition value that is an array means "any of these" (OR). */
  ruleConditionsMet(conditions) {
    for (const [condition, value] of Object.entries(conditions || {})) {
      if (Array.isArray(value)) {
        if (!value.includes(this.facts[condition])) return false;
      } else if (this.facts[condition] !== value) {
        return false;
      }
    }
    return true;
  }

  /* Keep firing rules until no new fact is inferred. Each rule fires once. */
  runInference() {
    let newFactAdded = true;
    while (newFactAdded) {
      newFactAdded = false;

      for (const rule of this.rules) {
        const ruleId = rule.id;
        if (this.firedRules.some((fr) => fr.rule_id === ruleId)) continue;
        if (!this.ruleConditionsMet(rule.conditions)) continue;

        for (const [key, value] of Object.entries(rule.conclusion)) {
          if (!(key in this.facts)) {
            this.facts[key] = value;
            this.reasoningChain[key] = {
              source: "inferred",
              rule: ruleId,
              description: rule.description || "",
            };
            newFactAdded = true;
          }
        }

        this.firedRules.push({
          rule_id: ruleId,
          description: rule.description || "",
          inferred_facts: Object.keys(rule.conclusion),
        });
      }
    }
  }

  /* First unasked question whose prerequisite is satisfied. */
  getNextQuestion() {
    for (const question of this.questions) {
      if (this.askedQuestions.has(question.id)) continue;
      if (this.ruleConditionsMet(question.prerequisite || {})) return question;
    }
    return null;
  }

  markQuestionAsked(questionId) {
    this.askedQuestions.add(questionId);
  }

  getDiagnoses() {
    return "problem" in this.facts ? [this.facts.problem] : [];
  }

  /* Symptoms the user affirmed, in the order they were given. */
  symptoms() {
    return Object.keys(this.reasoningChain).filter(
      (key) =>
        this.reasoningChain[key].source === "user_input" &&
        this.facts[key] === true
    );
  }

  /* Facts the engine inferred that another rule then consumed. */
  intermediateFacts() {
    const out = [];
    for (const [key, info] of Object.entries(this.reasoningChain)) {
      if (info.source !== "inferred") continue;
      if (key === "problem" || this.facts[key] !== true) continue;

      const usedDownstream = this.firedRules.some((fr) => {
        if (fr.rule_id === info.rule) return false;
        const rule = this.rules.find((r) => r.id === fr.rule_id);
        return rule ? key in (rule.conditions || {}) : false;
      });
      if (usedDownstream) out.push(key);
    }
    return out;
  }

  /* symptom + symptom -> intermediate fault -> diagnosis */
  diagnosisChain() {
    const diagnoses = this.getDiagnoses();
    if (!diagnoses.length) return [];
    const parts = [];
    const symptoms = this.symptoms();
    if (symptoms.length) parts.push(symptoms.join(" + "));
    parts.push(...this.intermediateFacts());
    parts.push(diagnoses[0]);
    return parts;
  }

  getResults() {
    const diagnoses = this.getDiagnoses();

    if (!diagnoses.length) {
      return {
        diagnosis: null,
        rulesFired: this.firedRules.map((fr) => fr.rule_id),
        trace: this.firedRules,
        chain: [],
      };
    }

    return {
      diagnosis: diagnoses[0],
      rulesFired: this.firedRules.map((fr) => fr.rule_id),
      trace: this.firedRules,
      chain: this.diagnosisChain(),
    };
  }
}

/* snake_case fact name -> readable label */
export function humanise(fact) {
  return String(fact).replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}
