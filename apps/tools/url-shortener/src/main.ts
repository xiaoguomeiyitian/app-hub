import '@app-hub/design-system/src/style.css';
import './style.css';

function getApiBase(): string {
  const path = window.location.pathname.replace(/\/url-shortener\/?$/, '').replace(/\/$/, '');
  return `${window.location.origin}${path}/api/url-shortener`;
}

interface Link { id: string; shortCode: string; originalUrl: string; clicks: number; createdAt: string; }

let longUrl = '';
let customCode = '';
let links: Link[] = [];
let loading = false;
let error = '';
let resultUrl = '';

async function loadLinks(): Promise<void> {
  try {
    const res = await fetch(`${getApiBase()}/list`);
    if (res.ok) links = await res.json();
  } catch {}
  render();
}

async function createShort(): Promise<void> {
  if (!longUrl.trim() || loading) return;
  loading = true; error = ''; resultUrl = ''; render();
  try {
    const res = await fetch(`${getApiBase()}/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: longUrl, customCode: customCode || undefined }),
    });
    const data = await res.json();
    if (data.shortCode) {
      resultUrl = `${window.location.origin}${window.location.pathname.replace(/\/url-shortener\/?$/, '')}/api/url-shortener/r/${data.shortCode}`;
      await loadLinks();
    } else { error = data.error || 'Failed'; }
  } catch { error = 'Network error'; }
  loading = false; render();
}

async function deleteLink(id: string): Promise<void> {
  try {
    await fetch(`${getApiBase()}/delete/${id}`, { method: 'DELETE' });
    await loadLinks();
  } catch {}
}

function render(): void {
  const app = document.getElementById('app')!;
  app.innerHTML = `
  <div class="app">
    <header class="header"><span class="logo">🔗</span><span class="title">URL Shortener</span></header>
    <main class="main">
      <div class="create-form">
        <input type="url" id="long-url" class="url-input" placeholder="Enter long URL..." value="${longUrl}" />
        <div class="options">
          <input type="text" id="custom-code" class="code-input" placeholder="Custom code (optional)" value="${customCode}" />
          <button class="btn-create" id="create-btn" ${loading ? 'disabled' : ''}>${loading ? '⏳' : '✂️ Shorten'}</button>
        </div>
        ${error ? `<p class="error">${error}</p>` : ''}
        ${resultUrl ? `
          <div class="result">
            <div class="result-label">Short URL:</div>
            <div class="result-row">
              <input type="text" value="${resultUrl}" readonly class="url-display" id="result-url" />
              <button class="btn-sm" id="copy-url">📋 Copy</button>
            </div>
          </div>
        ` : ''}
      </div>
      <div class="links-section">
        <h4>Your Links (${links.length})</h4>
        <div class="links-list">
          ${links.map(l => `
            <div class="link-item">
              <div class="link-info">
                <div class="link-short">${l.shortCode}</div>
                <div class="link-original">${l.originalUrl}</div>
              </div>
              <div class="link-stats">
                <span class="click-count">${l.clicks} clicks</span>
                <button class="btn-sm copy-link" data-url="${window.location.origin}${window.location.pathname.replace(/\/url-shortener\/?$/, '')}/api/url-shortener/r/${l.shortCode}">📋</button>
                <button class="btn-del" data-del="${l.id}">×</button>
              </div>
            </div>
          `).join('')}
          ${links.length === 0 ? '<p class="text-muted">No links yet</p>' : ''}
        </div>
      </div>
    </main>
  </div>`;
  bindEvents();
}

function bindEvents(): void {
  document.getElementById('long-url')?.addEventListener('input', (e) => { longUrl = (e.target as HTMLInputElement).value; });
  document.getElementById('custom-code')?.addEventListener('input', (e) => { customCode = (e.target as HTMLInputElement).value; });
  document.getElementById('create-btn')?.addEventListener('click', createShort);
  document.getElementById('copy-url')?.addEventListener('click', () => {
    navigator.clipboard.writeText((document.getElementById('result-url') as HTMLInputElement).value);
    document.getElementById('copy-url')!.textContent = '✓';
  });
  document.querySelectorAll('.copy-link').forEach(btn => {
    btn.addEventListener('click', () => { navigator.clipboard.writeText((btn as HTMLElement).dataset.url!); btn.textContent = '✓'; });
  });
  document.querySelectorAll('.btn-del').forEach(btn => {
    btn.addEventListener('click', () => deleteLink((btn as HTMLElement).dataset.del!));
  });
  document.getElementById('long-url')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') createShort(); });
}

loadLinks();
