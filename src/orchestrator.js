import { planReview } from './agents/planner.js';
import { reviewFile } from './agents/reviewer.js';
import { securityScan } from './agents/security.js';
import { synthesizeReview } from './agents/synthesizer.js';
import { withRetry } from './utils.js';

/**
 * Runs the full multi-agent code review pipeline.
 *
 * Pipeline stages:
 *   1. Planner  — analyzes the PR and produces a review plan
 *   2. Reviewer + Security — run in parallel per file
 *   3. Synthesizer — merges all findings into one final review
 *
 * @param {object} prData  - { title, description, files: [{name, language, diff}] }
 * @param {function} onProgress - called with progress events as each stage completes
 */
export async function runPipeline(prData, onProgress = () => {}, settings = {}) {

  // ── Stage 1: Plan ──────────────────────────────────────────────────────────
  onProgress({ step: 'planning', status: 'running', message: 'Analyzing PR structure...' });

  const plan = await withRetry(() => planReview(prData, settings));

  onProgress({ step: 'planning', status: 'done', data: plan });

  // ── Stage 2: Per-file analysis (parallel) ──────────────────────────────────
  const filesToReview = prData.files.filter(f => {
    const skipList = plan.skip_files || [];
    return !skipList.some(skip => f.name.includes(skip));
  });

  const shouldScanSecurity = plan.concerns.includes('security');
  const fileCount = filesToReview.length;

  onProgress({
    step: 'analyzing',
    status: 'running',
    message: `Running ${shouldScanSecurity ? 'reviewer + security' : 'reviewer'} on ${fileCount} file${fileCount !== 1 ? 's' : ''}...`
  });

  const fileAnalyses = await Promise.all(
    filesToReview.map(async (file) => {
      try {
        const [reviewResult, securityResult] = await Promise.all([
          withRetry(() => reviewFile({ file, concerns: plan.concerns, context: plan.context })),
          shouldScanSecurity
            ? withRetry(() => securityScan({ file }))
            : Promise.resolve({ file: file.name, has_issues: false, findings: [] })
        ]);
        return { file: file.name, reviewResult, securityResult };
      } catch (err) {
        console.error(`Agent failed for ${file.name} after retries:`, err.message);
        return {
          file: file.name,
          reviewResult: { file: file.name, verdict: 'error', issues: [], summary: `Analysis failed: ${err.message}` },
          securityResult: { file: file.name, has_issues: false, findings: [] }
        };
      }
    })
  );

  onProgress({ step: 'analyzing', status: 'done', data: fileAnalyses });

  // ── Stage 3: Synthesize ────────────────────────────────────────────────────
  onProgress({ step: 'synthesizing', status: 'running', message: 'Writing final review...' });

  const securityFindings = fileAnalyses
    .map(a => a.securityResult)
    .filter(s => s.has_issues);

  const finalReview = await withRetry(() => synthesizeReview({
    pr_info: {
      title: prData.title,
      description: prData.description,
      summary: plan.summary
    },
    reviewer_outputs: fileAnalyses.map(a => a.reviewResult),
    security_outputs: securityFindings
  }));

  onProgress({ step: 'synthesizing', status: 'done', data: finalReview });

  return { plan, file_analyses: fileAnalyses, final_review: finalReview };
}
