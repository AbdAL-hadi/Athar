import { moderationRuleGroups, suspiciousPatterns } from './moderationRules.js';
import { normalizeText, tokenizeText } from './textNormalization.js';

const DEFAULT_MODEL_ID = 'Xenova/toxic-bert';
const TOXICITY_MODEL_ID = String(process.env.TOXICITY_MODEL_ID || DEFAULT_MODEL_ID).trim();
const AI_TIMEOUT_MS = 7000;
const REJECT_THRESHOLD = 80;
const PENDING_THRESHOLD = 40;
const TOXIC_LABEL_HINTS = ['toxic', 'insult', 'obscene', 'threat', 'hate', 'identity'];

let classifierPromise = null;

const clampScore = (score) => Math.max(0, Math.min(100, Math.round(Number(score) || 0)));

const includesTerm = (normalizedText, normalizedTokens, rawTerm) => {
  const normalizedTerm = normalizeText(rawTerm);

  if (!normalizedTerm) {
    return false;
  }

  if (normalizedTerm.includes(' ')) {
    return normalizedText.includes(normalizedTerm);
  }

  return normalizedTokens.includes(normalizedTerm);
};

const runRuleBasedModeration = (text) => {
  const normalizedText = normalizeText(text);
  const normalizedTokens = tokenizeText(text);
  const matchedRules = [];
  const labels = new Set();
  let ruleScore = 0;

  moderationRuleGroups.forEach((group) => {
    group.terms.forEach((term) => {
      if (!includesTerm(normalizedText, normalizedTokens, term)) {
        return;
      }

      ruleScore = Math.max(ruleScore, group.severity);
      labels.add(group.category);
      matchedRules.push(`${group.category}:${term}`);
    });
  });

  suspiciousPatterns.forEach((rule) => {
    let matched = false;

    if (typeof rule.test === 'function') {
      matched = rule.test(String(text ?? ''));
    } else if (rule.pattern) {
      const matches = String(text ?? '').match(rule.pattern) ?? [];
      matched = matches.length >= (rule.minimumMatches ?? 1);
    }

    if (!matched) {
      return;
    }

    ruleScore = Math.max(ruleScore, rule.score);
    labels.add(rule.label);
    matchedRules.push(rule.id);
  });

  return {
    score: clampScore(ruleScore),
    labels: Array.from(labels),
    matchedRules,
  };
};

const loadClassifier = async () => {
  if (!classifierPromise) {
    classifierPromise = import('@xenova/transformers').then(async ({ pipeline, env }) => {
      if (env?.allowLocalModels !== undefined) {
        env.allowLocalModels = true;
      }

      return pipeline('text-classification', TOXICITY_MODEL_ID);
    });
  }

  return classifierPromise;
};

const flattenModelOutput = (output) => {
  if (!Array.isArray(output)) {
    return [];
  }

  if (Array.isArray(output[0])) {
    return output.flat();
  }

  return output;
};

const runAiModeration = async (text) => {
  const classifier = await loadClassifier();
  const output = await Promise.race([
    classifier(text, { topk: null }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Toxicity model timed out.')), AI_TIMEOUT_MS),
    ),
  ]);
  const labels = flattenModelOutput(output);
  const toxicPredictions = labels.filter((item) => {
    const label = String(item?.label ?? '').toLowerCase();
    return TOXIC_LABEL_HINTS.some((hint) => label.includes(hint));
  });
  const maxToxicScore = toxicPredictions.reduce(
    (highest, item) => Math.max(highest, Number(item?.score ?? 0)),
    0,
  );

  return {
    score: clampScore(maxToxicScore * 100),
    labels: toxicPredictions
      .filter((item) => Number(item?.score ?? 0) >= 0.35)
      .map((item) => String(item.label)),
  };
};

const decideModeration = ({ score, aiFailed, ruleScore }) => {
  if (score >= REJECT_THRESHOLD) {
    return 'rejected';
  }

  if (score >= PENDING_THRESHOLD || (aiFailed && ruleScore >= 25)) {
    return 'pending';
  }

  return 'approved';
};

const buildReason = ({ decision, aiFailed, ruleResult, aiResult }) => {
  if (decision === 'rejected') {
    return ruleResult.matchedRules.length > 0
      ? 'The comment matched community safety rules.'
      : 'The comment was classified as likely toxic by local moderation.';
  }

  if (decision === 'pending') {
    return aiFailed
      ? 'The AI moderation model was unavailable, and the comment needs manual review.'
      : 'The comment may need manual review before publishing.';
  }

  if (aiResult.score > 0 || ruleResult.score > 0) {
    return 'The comment passed moderation with low risk.';
  }

  return 'No moderation concerns detected.';
};

export const moderateComment = async (text) => {
  const normalizedText = String(text ?? '').replace(/\s+/g, ' ').trim();
  const ruleResult = runRuleBasedModeration(normalizedText);
  let aiResult = { score: 0, labels: [] };
  let aiFailed = false;

  try {
    aiResult = await runAiModeration(normalizedText);
  } catch (error) {
    aiFailed = true;
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Athar moderation] AI model unavailable, using rules only:', error.message);
    }
  }

  const score = clampScore(
    Math.max(ruleResult.score, aiResult.score) +
      (ruleResult.score >= 25 && aiResult.score >= 25 ? 10 : 0),
  );
  const decision = decideModeration({
    score,
    aiFailed,
    ruleScore: ruleResult.score,
  });
  const labels = Array.from(new Set([...ruleResult.labels, ...aiResult.labels]));

  return {
    decision,
    score,
    reason: buildReason({ decision, aiFailed, ruleResult, aiResult }),
    labels,
    details: {
      aiScore: aiResult.score,
      ruleScore: ruleResult.score,
      matchedRules: ruleResult.matchedRules,
    },
  };
};
