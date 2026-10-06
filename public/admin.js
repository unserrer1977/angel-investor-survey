/**
 * Admin page — fetches and displays survey responses.
 */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const state = {
  surveys: [],
  pagination: { page: 1, limit: 50, total: 0, pages: 0 },
  filters: {
    trafficSource: '',
    q1: '',
    q2: '',
    q3: '',
    q4: '',
    yesno: '',
  },
};

const dom = {
  tableBody: $('#surveyTableBody'),
  totalCount: $('#totalCount'),
  lastUpdated: $('#lastUpdated'),
  stats: {
    total: $('#statTotal'),
    demo: $('#statDemo'),
    demoNo: $('#statDemoNo'),
    completion: $('#statCompletion'),
  },
  pagination: $('#pagination'),
  trafficSourceFilter: $('#trafficSourceFilter'),
  q1Filter: $('#q1Filter'),
  q2Filter: $('#q2Filter'),
  q3Filter: $('#q3Filter'),
  q4Filter: $('#q4Filter'),
  yesnoFilter: $('#yesnoFilter'),
  clearFilters: $('#clearFilters'),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(str) {
  if (str === null || str === undefined) return '<span class="cell-text">—</span>';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatTime(seconds) {
  if (seconds === null || seconds === undefined) return '—';
  if (seconds < 1) return '<1s';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function makeTag(value, opts = {}) {
  const { type = 'default', cls = '' } = opts;
  const map = {
    default: 'tag',
    no: 'tag tag--no',
    other: 'tag tag--other',
    none: 'tag tag--none',
    yes: 'tag tag--yes',
    no: 'tag tag--no',
  };
  const classes = map[type] || 'tag';
  const combined = cls ? `${classes} ${cls}`.trim() : classes;
  return `<span class="${combined}">${escapeHtml(value)}</span>`;
}

function makeBadge(value) {
  if (value === 'Yes') return '<span class="badge badge--yes">Yes</span>';
  if (value === 'No') return '<span class="badge badge--no">No</span>';
  return escapeHtml(value);
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

async function fetchSurveys(page = 1, { reset = false } = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(state.pagination.limit) });
  const headers = {};
  if (state.filters.trafficSource) headers['x-traffic-source'] = state.filters.trafficSource;
  if (state.filters.q1) headers['x-q1'] = state.filters.q1;
  if (state.filters.q2) headers['x-q2'] = state.filters.q2;
  if (state.filters.q3) headers['x-q3'] = state.filters.q3;
  if (state.filters.q4) headers['x-q4'] = state.filters.q4;
  if (state.filters.yesno) headers['x-yesno'] = state.filters.yesno;

  const res = await fetch(`/api/admin/surveys?${params}`, { headers });
  if (!res.ok) {
    throw new Error(`Server responded ${res.status}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function getOptionsHash(surveys) {
  const set = new Set();
  surveys.forEach((s) => {
    if (s.q1) set.add(s.q1);
    if (s.q2) set.add(s.q2);
    if (s.q3) s.q3.forEach((v) => set.add(v));
    if (s.q4) s.q4.forEach((v) => set.add(v));
    if (s.yesno) set.add(s.yesno);
  });
  return set;
}

function populateFilters(options) {
  const filters = [
    { el: dom.q1Filter, key: 'q1' },
    { el: dom.q2Filter, key: 'q2' },
    { el: dom.q3Filter, key: 'q3' },
    { el: dom.q4Filter, key: 'q4' },
  ];
  filters.forEach(({ el, key }) => {
    el.innerHTML = '<option value="">All</option>';
    Array.from(options).sort().forEach((val) => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = val;
      el.appendChild(opt);
    });
  });
}

function renderStats(surveys) {
  const total = surveys.length;
  const demoYes = surveys.filter((s) => s.yesno === 'Yes').length;
  const demoNo = surveys.filter((s) => s.yesno === 'No').length;
  const times = surveys.map((s) => s.completion_time_seconds).filter((t) => t != null);
  const avgTime = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

  dom.stats.total.textContent = total;
  dom.stats.demo.textContent = demoYes;
  dom.stats.demoNo.textContent = demoNo;
  dom.stats.completion.textContent = avgTime > 0 ? `${avgTime}s` : '—';
}

function renderTable(surveys) {
  const tbody = dom.tableBody;
  if (!surveys.length) {
    tbody.innerHTML = '<tr><td colspan="11" class="admin-table__empty">No survey responses yet.</td></tr>';
    return;
  }

  tbody.innerHTML = surveys.map((s) => {
    const q3 = s.q3 || [];
    const q4 = s.q4 || [];
    const q5 = s.q5 || [];

    return `
      <tr>
        <td class="cell-text">${escapeHtml(s.id)}</td>
        <td>${makeTag(s.q1 || '', { cls: 'cell-text--strong' })}</td>
        <td>${makeTag(s.q2 || '', { cls: 'cell-text--strong' })}</td>
        <td>
          ${q3.map((v) => makeTag(v)).join('') || '<span class="cell-text">—</span>'}
        </td>
        <td>
          ${q4.map((v) => {
            if (v === 'Other (free text)') {
              const otherText = s.q4_other || '';
              return makeTag(v, { type: 'other', cls: otherText ? '' : '' }) + `<span class="cell-text">${escapeHtml(otherText)}</span>`;
            }
            return makeTag(v);
          }).join('') || '<span class="cell-text">—</span>'}
        </td>
        <td>
          ${s.q6 ? `<span class="cell-text">${escapeHtml(s.q6)}</span>` : '<span class="cell-text">—</span>'}
        </td>
        <td>${makeBadge(s.yesno)}</td>
        <td>
          ${s.yesno === 'Yes' ? `<span class="cell-text">${escapeHtml(s.traffic_source || '')}</span>` : '<span class="cell-text">—</span>'}
        </td>
        <td>${formatTime(s.completion_time_seconds)}</td>
        <td>${escapeHtml(s.traffic_source || '')}</td>
        <td class="cell-text">${formatDate(s.created_at)}</td>
      </tr>
    `;
  }).join('');
}

function renderPagination(total, page, limit, pages) {
  const container = dom.pagination;
  const totalPages = Math.max(1, pages || 1);

  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  const start = total + 1;
  const end = Math.min(total, start + limit - 1);

  container.innerHTML = `
    <div class="admin-pagination__info">
      Showing <strong>${start}</strong>–<strong>${end}</strong> of <strong>${total}</strong>
    </div>
    <div class="admin-pagination__controls">
      <button class="admin-pagination__page admin-pagination__page--prev ${prevDisabled ? 'admin-pagination__page--disabled' : ''}" data-action="prev" ${prevDisabled ? 'disabled' : ''}>← Prev</button>
      <button class="admin-pagination__page admin-pagination__page--next ${nextDisabled ? 'admin-pagination__page--disabled' : ''}" data-action="next" ${nextDisabled ? 'disabled' : ''}>Next →</button>
    </div>
  `;

  // Wire up pagination buttons.
  const prevBtn = container.querySelector('[data-action="prev"]');
  const nextBtn = container.querySelector('[data-action="next"]');
  prevBtn.addEventListener('click', () => {
    const p = Math.max(1, page - 1);
    fetchSurveys(p).then(renderPage);
  });
  nextBtn.addEventListener('click', () => {
    const p = Math.min(totalPages, page + 1);
    fetchSurveys(p).then(renderPage);
  });
}

function renderPage(data) {
  state.surveys = data.surveys;
  state.pagination = data.pagination || state.pagination;

  renderStats(state.surveys);
  renderTable(state.surveys);
  renderPagination(state.pagination.total, state.pagination.page, state.pagination.limit, state.pagination.pages);
  dom.totalCount.textContent = `${state.pagination.total} response${state.pagination.total !== 1 ? 's' : ''}`;
  dom.lastUpdated.textContent = 'Just now';
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

function applyFilters() {
  const filters = {
    trafficSource: dom.trafficSourceFilter.value,
    q1: dom.q1Filter.value,
    q2: dom.q2Filter.value,
    q3: dom.q3Filter.value,
    q4: dom.q4Filter.value,
    yesno: dom.yesnoFilter.value,
  };

  // Update filter state and re-fetch.
  state.filters = filters;

  // Build query params.
  const params = new URLSearchParams({ page: '1', limit: String(state.pagination.limit) });
  if (filters.trafficSource) params.append('x-traffic-source', filters.trafficSource);
  if (filters.q1) params.append('x-q1', filters.q1);
  if (filters.q2) params.append('x-q2', filters.q2);
  if (filters.q3) params.append('x-q3', filters.q3);
  if (filters.q4) params.append('x-q4', filters.q4);
  if (filters.yesno) params.append('x-yesno', filters.yesno);

  fetch(`/api/admin/surveys?${params}`, { headers: {} })
    .then((res) => res.json())
    .then(renderPage)
    .catch((err) => console.error('[admin] fetch error:', err));
}

function clearFilters() {
  dom.trafficSourceFilter.value = '';
  dom.q1Filter.value = '';
  dom.q2Filter.value = '';
  dom.q3Filter.value = '';
  dom.q4Filter.value = '';
  dom.yesnoFilter.value = '';
  applyFilters();
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

async function init() {
  // Populate filter dropdowns with option values from existing data.
  try {
    // First fetch to get data for filtering.
    const res = await fetch('/api/admin/surveys?page=1&limit=100');
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    const data = await res.json();
    state.surveys = data.surveys;
    state.pagination = data.pagination || state.pagination;

    // Populate filter dropdowns.
    const allOptions = getOptionsHash(state.surveys);
    populateFilters(allOptions);

    // Auto-apply filters.
    applyFilters();
  } catch (err) {
    console.error('[admin] init error:', err);
    dom.tableBody.innerHTML = '<tr><td colspan="11" class="admin-table__empty">Failed to load survey data.</td></tr>';
  }
}

document.addEventListener('DOMContentLoaded', init);
