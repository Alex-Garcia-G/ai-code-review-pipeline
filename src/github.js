const LANGUAGE_MAP = {
  js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
  py: 'python', rb: 'ruby', go: 'go', java: 'java', cs: 'csharp',
  php: 'php', rs: 'rust', cpp: 'cpp', c: 'c', h: 'c',
  css: 'css', scss: 'css', html: 'html', json: 'json',
  md: 'markdown', yml: 'yaml', yaml: 'yaml', sh: 'bash'
};

/**
 * Parses a GitHub PR URL into its owner, repo, and PR number.
 * Accepts: https://github.com/owner/repo/pull/123
 */
export function parsePRUrl(url) {
  const match = url.trim().match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) {
    throw new Error('Invalid GitHub PR URL. Expected: https://github.com/owner/repo/pull/123');
  }
  return { owner: match[1], repo: match[2], number: match[3] };
}

/**
 * Fetches PR metadata and file diffs from the GitHub API.
 * Uses GITHUB_TOKEN env var if set (raises rate limit from 60 to 5000 req/hr).
 */
export async function fetchPRData(prUrl) {
  const { owner, repo, number } = parsePRUrl(prUrl);

  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'ai-code-review-pipeline'
  };

  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const [pr, files] = await Promise.all([
    githubFetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${number}`, headers),
    githubFetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${number}/files?per_page=100`, headers)
  ]);

  return {
    title: pr.title,
    description: pr.body || '',
    url: prUrl,
    files: files
      .filter(f => f.patch)           // skip binary files and files too large for the API
      .map(f => ({
        name: f.filename,
        language: detectLanguage(f.filename),
        diff: f.patch
      }))
  };
}

async function githubFetch(url, headers) {
  const res = await fetch(url, { headers });

  if (res.status === 404) throw new Error('PR not found. Check the URL and make sure the repo is public.');
  if (res.status === 403) throw new Error('GitHub rate limit exceeded. Add a GITHUB_TOKEN to your .env to raise the limit.');
  if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);

  return res.json();
}

function detectLanguage(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  return LANGUAGE_MAP[ext] || 'unknown';
}
