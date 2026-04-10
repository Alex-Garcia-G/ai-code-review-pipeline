/**
 * Model assignments per agent role.
 *
 * Not every agent needs the most powerful model. Matching model capability
 * to task complexity reduces cost and latency without sacrificing quality.
 *
 *  Planner     — reads file names and a description, produces a JSON plan.
 *                Simple structure extraction → Haiku is fast and sufficient.
 *
 *  Reviewer    — reads code diffs and reasons about logic, edge cases, style.
 *                Needs strong reasoning → Sonnet.
 *
 *  Security    — must catch subtle vulnerabilities; false negatives are costly.
 *                Highest stakes → Opus.
 *
 *  Synthesizer — writes the final review from structured inputs.
 *                Good writing quality matters → Sonnet.
 */
export const MODELS = {
  planner:     'claude-haiku-4-5-20251001',
  reviewer:    'claude-sonnet-4-6',
  security:    'claude-opus-4-6',
  synthesizer: 'claude-sonnet-4-6'
};
