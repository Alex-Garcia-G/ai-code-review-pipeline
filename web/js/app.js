// ── State ─────────────────────────────────────────────────────────────────

let fileCount = 0;
let reviewText = '';
let userSettings = { strictness: 'balanced', focus: 'balanced' };

// ── Init ──────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  document.getElementById('addFileBtn').addEventListener('click', addFileBlock);
  document.getElementById('prForm').addEventListener('submit', handleSubmit);
  document.getElementById('copyBtn').addEventListener('click', copyReview);
  document.getElementById('clearBtn').addEventListener('click', clearReview);
  document.getElementById('fetchBtn').addEventListener('click', handleFetchPR);
  document.getElementById('settingsBtn').addEventListener('click', openSettings);
  document.getElementById('settingsClose').addEventListener('click', closeSettings);
  document.getElementById('settingsCancel').addEventListener('click', closeSettings);
  document.getElementById('settingsSave').addEventListener('click', saveSettings);
  document.getElementById('clearHistoryBtn').addEventListener('click', showClearHistoryConfirm);
  document.getElementById('clearHistoryConfirmBtn').addEventListener('click', clearHistoryConfirmed);
  document.getElementById('clearHistoryCancelBtn').addEventListener('click', hideClearHistoryConfirm);
  document.getElementById('settingsOverlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeSettings();
  });
  document.getElementById('settingsOverlay').addEventListener('keydown', handleSettingsFocusTrap);
  setupToggleGroups();

  // Restore last PR URL
  const lastUrl = localStorage.getItem('lastPrUrl');
  if (lastUrl) document.getElementById('prUrl').value = lastUrl;

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSettings();
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      document.getElementById('prForm').requestSubmit();
    }
  });
});

// ── Auth ──────────────────────────────────────────────────────────────────

async function initAuth() {
  // Disable sign-in button while navigating to GitHub
  document.getElementById('loginBtn').addEventListener('click', function () {
    this.textContent = 'Signing in…';
    this.style.pointerEvents = 'none';
    this.style.opacity = '0.6';
  });

  try {
    const user = await fetch('/api/me').then(r => r.ok ? r.json() : null);
    if (user) {
      document.getElementById('loginBtn').style.display = 'none';
      const userInfo = document.getElementById('userInfo');
      userInfo.style.display = 'flex';
      document.getElementById('userAvatar').src = user.avatar_url;
      document.getElementById('userAvatar').alt = `${user.name || user.username}'s avatar`;
      document.getElementById('userName').textContent = user.name || user.username;

      // Populate settings modal profile
      document.getElementById('settingsAvatar').src = user.avatar_url;
      document.getElementById('settingsAvatar').alt = `${user.name || user.username}'s avatar`;
      document.getElementById('settingsName').textContent = user.name || user.username;
      document.getElementById('settingsUsername').textContent = `@${user.username}`;

      // Update empty state for logged-in users
      document.getElementById('emptyStateMsg').innerHTML = 'Load a sample PR and click <strong>Run Review</strong>';

      await loadSettings();
      loadSamples();
      loadHistory();
      addFileBlock();
    }
  } catch {
    // auth check failed silently — login button stays visible
  }
}

// ── Settings ──────────────────────────────────────────────────────────────

async function loadSettings() {
  try {
    const s = await fetch('/api/settings').then(r => r.ok ? r.json() : null);
    if (s) {
      userSettings = s;
      applyToggleSelection('strictnessGroup', s.strictness);
      applyToggleSelection('focusGroup', s.focus);
    }
  } catch {
    // settings load failed — defaults stay
  }
}

function openSettings() {
  document.getElementById('settingsOverlay').classList.add('open');
  // Focus first element in modal and trap focus inside
  setTimeout(() => document.getElementById('settingsClose').focus(), 50);
}

function closeSettings() {
  document.getElementById('settingsOverlay').classList.remove('open');
  document.getElementById('settingsBtn').focus();
  // Reset transient state
  hideClearHistoryConfirm();
  document.getElementById('settingsError').hidden = true;
}

function handleSettingsFocusTrap(e) {
  if (e.key !== 'Tab') return;
  const modal = document.querySelector('.settings-modal');
  const focusable = modal.querySelectorAll('button, input, [tabindex]:not([tabindex="-1"])');
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey) {
    if (document.activeElement === first) { e.preventDefault(); last.focus(); }
  } else {
    if (document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
}

async function saveSettings() {
  const strictness = getToggleValue('strictnessGroup');
  const focus = getToggleValue('focusGroup');
  const errorEl = document.getElementById('settingsError');

  try {
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strictness, focus })
    });
    userSettings = { strictness, focus };
    errorEl.hidden = true;
    closeSettings();
  } catch {
    errorEl.textContent = 'Could not save settings. Please try again.';
    errorEl.hidden = false;
  }
}

function showClearHistoryConfirm() {
  document.getElementById('clearHistoryDefault').hidden = true;
  document.getElementById('clearHistoryConfirm').hidden = false;
  document.getElementById('clearHistoryConfirmBtn').focus();
}

function hideClearHistoryConfirm() {
  document.getElementById('clearHistoryConfirm').hidden = true;
  document.getElementById('clearHistoryDefault').hidden = false;
}

async function clearHistoryConfirmed() {
  const errorEl = document.getElementById('settingsError');
  try {
    await fetch('/api/history', { method: 'DELETE' });
    hideClearHistoryConfirm();
    closeSettings();
    document.getElementById('historyList').innerHTML = '<p class="empty-history">No reviews yet</p>';
    document.getElementById('historyCount').textContent = '';
  } catch {
    errorEl.textContent = 'Could not clear history. Please try again.';
    errorEl.hidden = false;
  }
}

function setupToggleGroups() {
  ['strictnessGroup', 'focusGroup'].forEach(groupId => {
    const group = document.getElementById(groupId);
    group.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        group.querySelectorAll('.toggle-btn').forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      });
    });
  });
}

function applyToggleSelection(groupId, value) {
  const group = document.getElementById(groupId);
  group.querySelectorAll('.toggle-btn').forEach(btn => {
    const active = btn.dataset.value === value;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function getToggleValue(groupId) {
  const active = document.getElementById(groupId).querySelector('.toggle-btn.active');
  return active ? active.dataset.value : 'balanced';
}

// ── Sample PRs ────────────────────────────────────────────────────────────

async function loadSamples() {
  const container = document.getElementById('sampleButtons');
  try {
    const samples = await fetch('/api/samples').then(r => r.json());
    container.innerHTML = '';
    samples.forEach(sample => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sample-btn';
      btn.innerHTML = `<strong>${sample.title}</strong><span>${sample.description}</span>`;
      btn.addEventListener('click', () => loadSample(sample.id));
      li.appendChild(btn);
      container.appendChild(li);
    });
  } catch {
    container.innerHTML = '<li><span class="loading-text">Could not load samples (is the server running?)</span></li>';
  }
}

async function loadSample(id) {
  const data = await fetch(`/api/samples/${id}`).then(r => r.json());

  document.getElementById('prTitle').value = data.title;
  document.getElementById('prDescription').value = data.description;

  // Clear and rebuild file blocks
  document.getElementById('filesContainer').innerHTML = '';
  fileCount = 0;
  data.files.forEach(file => {
    addFileBlock(file.name, file.diff);
  });
}

// ── History sidebar ───────────────────────────────────────────────────────

async function loadHistory() {
  const list = document.getElementById('historyList');
  const count = document.getElementById('historyCount');

  // Show skeleton while loading
  list.innerHTML = '<div class="skeleton-item"></div><div class="skeleton-item"></div><div class="skeleton-item"></div>';

  try {
    const entries = await fetch('/api/history').then(r => r.json());
    if (!entries.length) return;

    count.textContent = entries.length;
    list.innerHTML = entries.map(e => `
      <div class="history-item" data-id="${e.id}">
        <div class="history-item-title">${escHtml(e.title)}</div>
        <div class="history-item-meta">
          <span class="history-verdict ${e.verdict}">${e.verdict === 'APPROVE' ? '✓' : e.verdict === 'REQUEST_CHANGES' ? '✗' : '◌'}</span>
          <span class="history-date">${formatDate(e.timestamp)}</span>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.history-item').forEach(item => {
      item.addEventListener('click', () => loadHistoryEntry(item.dataset.id));
    });
  } catch {
    // history panel fails silently — it's non-critical
  }
}

async function loadHistoryEntry(id) {
  try {
    const entry = await fetch(`/api/history/${id}`).then(r => r.json());
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('pipeline').style.display = 'none';
    document.getElementById('prTitle').value = entry.title;
    renderFinalReview(entry.result.final_review);
  } catch {
    showError('Could not load this review.');
  }
}

function formatDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHrs / 24);
  if (diffMins < 1)  return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHrs < 24)  return `${diffHrs}h ago`;
  return `${diffDays}d ago`;
}

// ── GitHub PR fetch ───────────────────────────────────────────────────────

async function handleFetchPR() {
  const url = document.getElementById('prUrl').value.trim();
  if (!url) return;

  const btn = document.getElementById('fetchBtn');
  const status = document.getElementById('fetchStatus');

  btn.disabled = true;
  btn.querySelector('.btn-text').style.display = 'none';
  btn.querySelector('.btn-spinner').style.display = 'block';
  status.textContent = 'Fetching PR from GitHub...';
  status.className = 'github-hint';

  try {
    const data = await fetch(`/api/fetch-pr?url=${encodeURIComponent(url)}`).then(async r => {
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error);
      }
      return r.json();
    });

    document.getElementById('prTitle').value = data.title;
    document.getElementById('prDescription').value = data.description;
    document.getElementById('filesContainer').innerHTML = '';
    fileCount = 0;
    data.files.forEach(file => addFileBlock(file.name, file.diff));

    status.textContent = `Loaded ${data.files.length} file${data.files.length !== 1 ? 's' : ''} from GitHub`;
    status.className = 'github-hint success';
    localStorage.setItem('lastPrUrl', url);
  } catch (err) {
    status.textContent = err.message;
    status.className = 'github-hint error';
  } finally {
    btn.disabled = false;
    btn.querySelector('.btn-text').style.display = 'block';
    btn.querySelector('.btn-spinner').style.display = 'none';
  }
}

// ── File blocks ───────────────────────────────────────────────────────────

function addFileBlock(name = '', diff = '') {
  fileCount++;
  const container = document.getElementById('filesContainer');
  const div = document.createElement('div');
  div.className = 'file-block';
  div.dataset.index = fileCount;
  div.innerHTML = `
    <div class="file-block-header">
      <label>File ${fileCount}</label>
      <button type="button" class="btn-remove" onclick="removeFileBlock(this)">Remove</button>
    </div>
    <input type="text" class="file-name" placeholder="src/auth.js" value="${escHtml(name)}">
    <textarea class="file-diff" rows="8" placeholder="Paste the file diff here...">${escHtml(diff)}</textarea>
    <div class="file-size-warning" style="display:none">Large diff — analysis may take longer</div>
  `;
  container.appendChild(div);

  div.querySelector('.file-diff').addEventListener('input', function () {
    const warning = div.querySelector('.file-size-warning');
    warning.style.display = this.value.length > 30000 ? 'block' : 'none';
  });
}

function removeFileBlock(btn) {
  const block = btn.closest('.file-block');
  const container = document.getElementById('filesContainer');
  if (container.children.length > 1) {
    block.remove();
  }
}

// ── Form submission ───────────────────────────────────────────────────────

async function handleSubmit(e) {
  e.preventDefault();

  const title = document.getElementById('prTitle').value.trim();
  const description = document.getElementById('prDescription').value.trim();

  const titleError = document.getElementById('prTitleError');
  if (!title) {
    titleError.hidden = false;
    document.getElementById('prTitle').focus();
    return;
  }
  titleError.hidden = true;

  const files = [];
  document.querySelectorAll('.file-block').forEach(block => {
    const name = block.querySelector('.file-name').value.trim();
    const diff = block.querySelector('.file-diff').value.trim();
    if (name && diff) {
      files.push({ name, diff });
    }
  });

  if (files.length === 0) {
    document.getElementById('addFileBtn').focus();
    return;
  }

  setRunning(true);
  resetOutput();
  showPipeline();

  try {
    await streamReview({ title, description, files, settings: userSettings });
  } catch (err) {
    showError(err.message);
  } finally {
    setRunning(false);
  }
}

// ── Streaming pipeline ────────────────────────────────────────────────────

async function streamReview(prData) {
  const response = await fetch('/api/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prData)
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Request failed');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();           // keep any incomplete line

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const event = JSON.parse(line.slice(6));
        handleEvent(event);
      } catch {
        // skip malformed lines
      }
    }
  }
}

function handleEvent(event) {
  if (event.type === 'progress') {
    updateStep(event.step, event.status, event.message, event.data);
  } else if (event.type === 'complete') {
    renderFinalReview(event.result.final_review);
    loadHistory();
  } else if (event.type === 'error') {
    showError(event.message);
  }
}

// ── Pipeline UI ───────────────────────────────────────────────────────────

function updateStep(stepName, status, message, data) {
  const stepEl = document.getElementById(`step-${stepName}`);
  if (!stepEl) return;

  stepEl.className = `pipeline-step ${status}`;
  if (status === 'running') stepEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  // Announce step status to screen readers
  const statusEl = stepEl.querySelector('.step-status');
  if (statusEl) {
    statusEl.textContent = status === 'running' ? 'In progress' : status === 'done' ? 'Complete' : 'Pending';
  }

  const msgEl = stepEl.querySelector('.step-message');
  if (message) msgEl.textContent = message;

  if (status === 'done' && data) {
    const dataEl = stepEl.querySelector('.step-data');
    if (dataEl) {
      dataEl.style.display = 'block';
      dataEl.innerHTML = renderStepData(stepName, data);
    }
  }
}

function renderStepData(stepName, data) {
  if (stepName === 'planning') {
    const concerns = (data.concerns || []).map(c =>
      `<span class="concern-tag">${c}</span>`
    ).join('');
    const fileCount = (data.files || []).length;
    return `
      <div>${data.summary}</div>
      <div style="margin-top:8px">Concerns: ${concerns}</div>
      <div style="margin-top:4px;color:var(--text-faint)">${fileCount} file${fileCount !== 1 ? 's' : ''} to review</div>
    `;
  }

  if (stepName === 'analyzing') {
    return data.map(a => {
      const verdict = a.reviewResult?.verdict || '?';
      const secIssues = a.securityResult?.findings?.length || 0;
      const color = verdict === 'approve' ? 'var(--green)' : 'var(--yellow)';
      return `
        <div style="margin-bottom:6px">
          <span style="color:var(--text-faint)">${a.file}</span>
          <span style="color:${color};margin-left:8px">${verdict}</span>
          ${secIssues > 0 ? `<span style="color:var(--red);margin-left:8px">${secIssues} security finding${secIssues !== 1 ? 's' : ''}</span>` : ''}
        </div>
      `;
    }).join('');
  }

  return '';
}

// ── Final review renderer ─────────────────────────────────────────────────

function renderFinalReview(review) {
  const container = document.getElementById('finalReview');

  const verdictLabels = {
    APPROVE: '✓ Approved',
    REQUEST_CHANGES: '✗ Changes Requested',
    COMMENT: '◌ Comment'
  };

  const criticalHtml = (review.critical_issues || []).map(issue => `
    <div class="issue-card critical">
      <div class="issue-title">${escHtml(issue.title)}</div>
      <div class="issue-desc">${escHtml(issue.description)}</div>
      <div class="issue-rec">→ ${escHtml(issue.recommendation)}</div>
    </div>
  `).join('');

  const suggestionsHtml = (review.suggestions || []).map(s => `
    <div class="issue-card suggestion">
      <div class="issue-title">${escHtml(s.title)}</div>
      <div class="issue-desc">${escHtml(s.description)}</div>
      <div class="issue-rec">→ ${escHtml(s.recommendation)}</div>
    </div>
  `).join('');

  const positivesHtml = (review.positives || []).map(p =>
    `<li>${escHtml(p)}</li>`
  ).join('');

  container.innerHTML = `
    <div class="verdict-badge verdict-${review.verdict}">
      ${verdictLabels[review.verdict] || review.verdict}
    </div>

    <div class="review-summary">${escHtml(review.summary)}</div>

    ${criticalHtml ? `
      <div class="review-section">
        <div class="review-section-title">Critical Issues</div>
        ${criticalHtml}
      </div>
    ` : ''}

    ${suggestionsHtml ? `
      <div class="review-section">
        <div class="review-section-title">Suggestions</div>
        ${suggestionsHtml}
      </div>
    ` : ''}

    ${positivesHtml ? `
      <div class="review-section">
        <div class="review-section-title">Positives</div>
        <ul class="positives-list">${positivesHtml}</ul>
      </div>
    ` : ''}

    <div class="final-comment">${escHtml(review.final_comment)}</div>
  `;

  container.style.display = 'block';
  document.getElementById('copyBtn').style.display = 'block';
  document.getElementById('clearBtn').style.display = 'block';

  // Build plain text version for clipboard
  reviewText = buildPlainText(review);
}

function buildPlainText(review) {
  const lines = [];
  lines.push(`VERDICT: ${review.verdict}`);
  lines.push('');
  lines.push(review.summary);
  if (review.critical_issues?.length) {
    lines.push('');
    lines.push('CRITICAL ISSUES');
    review.critical_issues.forEach(i => {
      lines.push(`  • ${i.title}: ${i.description}`);
      lines.push(`    Fix: ${i.recommendation}`);
    });
  }
  if (review.suggestions?.length) {
    lines.push('');
    lines.push('SUGGESTIONS');
    review.suggestions.forEach(s => {
      lines.push(`  • ${s.title}: ${s.description}`);
    });
  }
  if (review.positives?.length) {
    lines.push('');
    lines.push('POSITIVES');
    review.positives.forEach(p => lines.push(`  ✓ ${p}`));
  }
  lines.push('');
  lines.push(review.final_comment);
  return lines.join('\n');
}

function copyReview() {
  navigator.clipboard.writeText(reviewText).then(() => {
    const btn = document.getElementById('copyBtn');
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
  });
}

function clearReview() {
  resetOutput();
  document.getElementById('emptyState').style.display = 'block';
  document.getElementById('copyBtn').style.display = 'none';
  document.getElementById('clearBtn').style.display = 'none';
  reviewText = '';
}

// ── UI helpers ────────────────────────────────────────────────────────────

function setRunning(running) {
  const btn = document.getElementById('runBtn');
  const text = btn.querySelector('.btn-text');
  const spinner = btn.querySelector('.btn-spinner');
  btn.disabled = running;
  text.style.display = running ? 'none' : 'block';
  spinner.style.display = running ? 'block' : 'none';
}

function resetOutput() {
  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('pipeline').style.display = 'none';
  document.getElementById('finalReview').style.display = 'none';
  document.getElementById('finalReview').innerHTML = '';
  document.getElementById('copyBtn').style.display = 'none';

  // Reset step states
  ['planning', 'analyzing', 'synthesizing'].forEach(name => {
    const el = document.getElementById(`step-${name}`);
    if (el) {
      el.className = 'pipeline-step';
      el.querySelector('.step-message').textContent = '';
      const dataEl = el.querySelector('.step-data');
      if (dataEl) { dataEl.style.display = 'none'; dataEl.innerHTML = ''; }
    }
  });
}

function showPipeline() {
  document.getElementById('pipeline').style.display = 'block';
}

function showError(message) {
  const container = document.getElementById('finalReview');
  container.innerHTML = `<div class="error-banner">Error: ${escHtml(message)}</div>`;
  container.style.display = 'block';
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
