import '@app-hub/design-system/src/style.css';
import './style.css';

function getApiBase(): string {
  const path = window.location.pathname.replace(/\/pastebin\/?$/, '').replace(/\/$/, '');
  return `${window.location.origin}${path}/api/pastebin`;
}

let content = '';
let expiresIn = '1h';
let resultUrl = '';
let loading = false;
let error = '';
let viewId = '';

function getViewId(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

async function loadPaste(id: string): Promise<void> {
  loading = true; error = ''; render();
  try {
    const res = await fetch(`${getApiBase()}/get/${id}`);
    if (!res.ok) throw new Error('Not found');
    const data = await res.json();
    content = data.content;
  } catch { error = 'Paste not found or expired'; }
  loading = false; render();
}

async function createPaste(): Promise<void> {
  if (!content.trim() || loading) return;
  loading = true; error = ''; resultUrl = ''; render();
  try {
    const res = await fetch(`${getApiBase()}/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, expiresIn }),
    });
    const data = await res.json();
    if (data.id) {
      resultUrl = `${window.location.origin}${window.location.pathname}?id=${data.id}`;
    } else { error = data.error || 'Failed to create paste'; }
  } catch { error = 'Network error'; }
  loading = false; render();
}

function render(): void {
  const app = document.getElementById('app')!;
  const isView = !!viewId;

  app.innerHTML = `
  <div class="app">
    <header class="header">
      <span class="logo">📋</span>
      <span class="title">Pastebin</span>
      ${isView ? `<a href="${window.location.pathname}" class="btn-sm">+ New Paste</a>` : ''}
    </header>
    <main class="main">
      ${isView ? `
        ${loading ? '<p class="text-muted">Loading...</p>' : ''}
        ${error ? `<p class="error">${error}</p>` : ''}
        ${content ? `
          <div class="paste-view">
            <div class="paste-header">
              <span>Paste</span>
              <button class="btn-sm" id="copy-content">📋 Copy</button>
            </div>
            <pre class="paste-content">${content}</pre>
          </div>
        ` : ''}
      ` : `
        <div class="editor">
          <textarea id="content" class="content-input" placeholder="Paste your text here..." spellcheck="false">${content}</textarea>
          <div class="options">
            <label>Expires:
              <select id="expires" class="expires-select">
                <option value="10m" ${expiresIn==='10m'?'selected':''}>10 minutes</option>
                <option value="1h" ${expiresIn==='1h'?'selected':''}>1 hour</option>
                <option value="1d" ${expiresIn==='1d'?'selected':''}>1 day</option>
                <option value="never" ${expiresIn==='never'?'selected':''}>Never</option>
              </select>
            </label>
            <button class="btn-create" id="create-btn" ${loading ? 'disabled' : ''}>${loading ? '⏳' : '📤 Create Paste'}</button>
          </div>
          ${error ? `<p class="error">${error}</p>` : ''}
          ${resultUrl ? `
            <div class="result">
              <div class="result-label">Share URL:</div>
              <div class="result-url">
                <input type="text" value="${resultUrl}" readonly class="url-input" id="result-url" />
                <button class="btn-sm" id="copy-url">📋 Copy</button>
              </div>
            </div>
          ` : ''}
        </div>
      `}
    </main>
  </div>`;
  bindEvents();
}

function bindEvents(): void {
  document.getElementById('content')?.addEventListener('input', (e) => { content = (e.target as HTMLTextAreaElement).value; });
  document.getElementById('expires')?.addEventListener('change', (e) => { expiresIn = (e.target as HTMLSelectElement).value; });
  document.getElementById('create-btn')?.addEventListener('click', createPaste);
  document.getElementById('copy-url')?.addEventListener('click', () => {
    navigator.clipboard.writeText((document.getElementById('result-url') as HTMLInputElement).value);
    document.getElementById('copy-url')!.textContent = '✓';
  });
  document.getElementById('copy-content')?.addEventListener('click', () => {
    navigator.clipboard.writeText(content);
    document.getElementById('copy-content')!.textContent = '✓ Copied';
  });
}

// Check if viewing a paste
const id = getViewId();
if (id) { viewId = id; loadPaste(id); } else { render(); }
