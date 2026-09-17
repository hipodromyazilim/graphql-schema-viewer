/* ============================================================
   GraphQL Schema Explorer — app.js (v3)
   Tree-based sidebar, live query builder, compact args,
   copy/download controls, and toast notifications.
   ============================================================ */
'use strict';

// ─── Constants ───────────────────────────────────────────────
const MAX_TREE_DEPTH = 5;

const KIND_META = {
  OBJECT:       { label: 'Object',    color: '#3b82f6' },
  INPUT_OBJECT: { label: 'Input',     color: '#06b6d4' },
  ENUM:         { label: 'Enum',      color: '#a855f7' },
  SCALAR:       { label: 'Scalar',    color: '#10b981' },
  INTERFACE:    { label: 'Interface', color: '#f59e0b' },
  UNION:        { label: 'Union',     color: '#ec4899' },
};

const BUILTIN_NAMES = ['String','Boolean','Int','Float','ID'];
function isBuiltin(t) { return BUILTIN_NAMES.includes(t.name) || t.name.startsWith('__'); }

// ─── State ───────────────────────────────────────────────────
const S = {
  schema:          null,
  allTypes:        [],
  typeMap:         {},
  activeType:      null,
  history:         [],
  hideDeprecated:  true,
  searchQuery:     '',
  selectedFields:  new Set(), // elements like "TypeName.fieldName"
  lang:            localStorage.getItem('schemaExplorerLang') || 'en',
};
let eventsBound = false;

const I18N = {
  en: {
    metaDescription: 'Explore GraphQL introspection schemas visually.',
    loaderIdle: 'Drop schema.json here or choose a file.',
    dropTitle: 'Drop a JSON schema',
    dropSubtitle: 'or click to choose a file',
    treeFilterPlaceholder: 'Filter tree...',
    toggleSidebarTitle: 'Toggle sidebar',
    globalSearchPlaceholder: 'Search types or fields... (Ctrl+K)',
    changeSchemaTitle: 'Load a new schema.json',
    changeSchema: 'Change Schema',
    welcomeSubtitle: 'Choose a field from the tree or search with <kbd>Ctrl+K</kbd>.',
    queryBuilder: 'Query Builder',
    clearSelectionTitle: 'Clear selection',
    clear: 'Clear',
    copyTitle: 'Copy to clipboard',
    copy: 'Copy',
    downloadTitle: 'Download as file',
    download: 'Download',
    queryEmptyTitle: 'No fields selected yet',
    queryEmptyDesc: 'Click fields on the left to build your query',
    searchResultsTitle: 'Search Results',
    invalidSchema: 'No valid GraphQL introspection schema was found',
    readingFile: '{name} is being read...',
    parsingJson: 'Parsing JSON... (large file)',
    processingData: 'Processing data...',
    buildingTree: 'Building tree...',
    preparingUi: 'Preparing interface...',
    ready: 'Ready!',
    errorPrefix: 'Error: ',
    jsonOnly: 'Please choose a JSON schema file.',
    fileReadError: 'The file could not be read.',
    footerTypes: 'Types',
    footerFields: 'Fields',
    fieldCount: 'field',
    fieldCountPlural: 'fields',
    noFieldsForType: 'No fields defined for this type',
    enumValues: 'Enum Values',
    fields: 'Fields',
    inputFields: 'Input Fields',
    selectedCount: '{count} fields',
    searchResultCount: '{count} results',
    typesGroup: 'Types',
    fieldsGroup: 'Fields',
    noSearchResults: 'No results found for "{query}"',
    allSelectionsCleared: 'All selections cleared',
    nothingToCopy: 'No schema to copy',
    copied: 'Schema copied to clipboard!',
    copyFailed: 'Could not copy. Please copy manually.',
    nothingToDownload: 'No schema to download',
    downloaded: 'Query file downloaded',
  },
  tr: {
    metaDescription: 'GraphQL introspection şemasını görsel olarak keşfedin.',
    loaderIdle: 'schema.json dosyasını buraya bırakın veya seçin.',
    dropTitle: 'JSON şemasını sürükle bırak',
    dropSubtitle: 'veya dosya seçmek için tıkla',
    treeFilterPlaceholder: 'Ağaçta filtrele...',
    toggleSidebarTitle: 'Sidebar aç/kapat',
    globalSearchPlaceholder: 'Tür veya alan ara... (Ctrl+K)',
    changeSchemaTitle: 'Yeni schema.json yükle',
    changeSchema: 'Şema Değiştir',
    welcomeSubtitle: 'Sol ağaçtan bir alan seçin veya <kbd>Ctrl+K</kbd> ile arama yapın.',
    queryBuilder: 'Query Builder',
    clearSelectionTitle: 'Seçimi temizle',
    clear: 'Temizle',
    copyTitle: 'Panoya kopyala',
    copy: 'Kopyala',
    downloadTitle: 'Dosya olarak indir',
    download: 'İndir',
    queryEmptyTitle: 'Henüz alan seçilmedi',
    queryEmptyDesc: 'Sol taraftaki alanlara tıklayarak sorgunuzu oluşturun',
    searchResultsTitle: 'Arama Sonuçları',
    invalidSchema: 'Geçerli GraphQL introspection şeması bulunamadı',
    readingFile: '{name} okunuyor...',
    parsingJson: 'JSON ayrıştırılıyor... (büyük dosya)',
    processingData: 'Veri işleniyor...',
    buildingTree: 'Ağaç yapısı oluşturuluyor...',
    preparingUi: 'Arayüz hazırlanıyor...',
    ready: 'Hazır!',
    errorPrefix: 'Hata: ',
    jsonOnly: 'Lütfen JSON formatında bir şema dosyası seçin.',
    fileReadError: 'Dosya okunamadı.',
    footerTypes: 'Türler',
    footerFields: 'Alanlar',
    fieldCount: 'alan',
    fieldCountPlural: 'alan',
    noFieldsForType: 'Bu türde tanımlı alan yok',
    enumValues: 'Enum Değerleri',
    fields: 'Alanlar',
    inputFields: 'Giriş Alanları',
    selectedCount: '{count} alan',
    searchResultCount: '{count} sonuç',
    typesGroup: 'Türler',
    fieldsGroup: 'Alanlar',
    noSearchResults: '"{query}" için sonuç bulunamadı',
    allSelectionsCleared: 'Tüm seçimler temizlendi',
    nothingToCopy: 'Kopyalanacak şema bulunamadı',
    copied: 'Şema panoya kopyalandı!',
    copyFailed: 'Kopyalanamadı, lütfen manuel kopyalayın',
    nothingToDownload: 'İndirilecek şema bulunamadı',
    downloaded: 'Sorgu dosyası indirildi',
  },
};

// ─── Helpers ─────────────────────────────────────────────────
const $ = id => document.getElementById(id);

function t(key, vars = {}) {
  const template = I18N[S.lang]?.[key] || I18N.en[key] || key;
  return Object.entries(vars).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, value),
    template
  );
}

function applyI18n() {
  document.documentElement.lang = S.lang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.querySelectorAll('[data-i18n-content]').forEach(el => {
    el.content = t(el.dataset.i18nContent);
  });
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === S.lang);
    btn.setAttribute('aria-pressed', btn.dataset.lang === S.lang ? 'true' : 'false');
  });
}

function setLanguage(lang) {
  if (!I18N[lang] || S.lang === lang) return;
  S.lang = lang;
  localStorage.setItem('schemaExplorerLang', lang);
  applyI18n();
  if (S.schema) {
    renderFooterStats();
    renderTree();
    renderWelcomeCards();
    if (S.activeType) renderFields(S.activeType);
    if (S.searchQuery) doSearch(S.searchQuery);
    updateQueryPreview();
  } else {
    showSchemaLoader();
  }
}

function typeString(ref) {
  if (!ref) return 'Unknown';
  if (ref.kind === 'NON_NULL') return typeString(ref.ofType) + '!';
  if (ref.kind === 'LIST')     return '[' + typeString(ref.ofType) + ']';
  return ref.name || 'Unknown';
}
function baseTypeName(ref) {
  if (!ref) return null;
  if (ref.name) return ref.name;
  return baseTypeName(ref.ofType);
}
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function highlight(text, q) {
  if (!q) return esc(text);
  const e = esc(text);
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi');
  return e.replace(re, '<mark>$1</mark>');
}
function kindColor(kind) { return KIND_META[kind]?.color || '#94a3b8'; }

// ─── Loading ─────────────────────────────────────────────────
function setProgress(pct, msg) {
  $('loading-bar').style.width = pct + '%';
  if (msg) $('loading-status').textContent = msg;
}

function resetState() {
  S.schema = null;
  S.allTypes = [];
  S.typeMap = {};
  S.activeType = null;
  S.history = [];
  S.hideDeprecated = true;
  S.searchQuery = '';
  S.selectedFields.clear();
  _nodeId = 0;
  filterText = '';
  rootNodes = [];
}

function normalizeSchema(data) {
  const schema = data?.data?.__schema || data?.__schema || data;
  if (!schema?.types?.length) {
    throw new Error(t('invalidSchema'));
  }
  return schema;
}

async function loadSchemaFromText(text, sourceName) {
  try {
    resetState();
    const overlay = $('loading-overlay');
    overlay.classList.remove('hidden');
    overlay.style.transition = '';
    overlay.style.opacity = '1';
    $('app').classList.add('hidden');
    $('loading-status').style.color = '';
    setProgress(20, t('readingFile', { name: sourceName || 'schema.json' }));

    setProgress(35, t('parsingJson'));
    await tick();

    setProgress(65, t('processingData'));
    await tick();
    const data = JSON.parse(text);

    setProgress(82, t('buildingTree'));
    await tick();

    const schema = normalizeSchema(data);
    S.schema   = schema;
    S.allTypes = schema.types || [];
    S.allTypes.forEach(t => { S.typeMap[t.name] = t; });

    setProgress(96, t('preparingUi'));
    await tick();

    initUI();

    setProgress(100, t('ready'));
    await delay(280);

    overlay.style.transition = 'opacity .35s ease';
    overlay.style.opacity = '0';
    await delay(360);
    overlay.classList.add('hidden');
    $('app').classList.remove('hidden');

  } catch (err) {
    setProgress(0, t('errorPrefix') + err.message);
    $('loading-status').style.color = '#ef4444';
    $('app').classList.add('hidden');
    console.error(err);
  }
}

function loadSchemaFile(file) {
  if (!file) return;
  if (!/\.json$/i.test(file.name) && file.type !== 'application/json') {
    $('loading-status').textContent = t('jsonOnly');
    $('loading-status').style.color = '#ef4444';
    return;
  }

  const reader = new FileReader();
  reader.onload = () => loadSchemaFromText(String(reader.result || ''), file.name);
  reader.onerror = () => {
    $('loading-status').textContent = t('fileReadError');
    $('loading-status').style.color = '#ef4444';
  };
  setProgress(12, t('readingFile', { name: file.name }));
  reader.readAsText(file);
}

function showSchemaLoader() {
  const overlay = $('loading-overlay');
  overlay.classList.remove('hidden');
  overlay.style.transition = '';
  overlay.style.opacity = '1';
  $('app').classList.add('hidden');
  $('loading-status').style.color = '';
  setProgress(0, t('loaderIdle'));
}

function initSchemaLoader() {
  const dropZone = $('schema-drop-zone');
  const fileInput = $('schema-file-input');
  const reloadInput = $('schema-reload-input');

  const handleFiles = files => {
    const file = files?.[0];
    if (file) loadSchemaFile(file);
  };

  fileInput.addEventListener('change', e => {
    handleFiles(e.target.files);
    e.target.value = '';
  });

  reloadInput.addEventListener('change', e => {
    handleFiles(e.target.files);
    e.target.value = '';
  });

  document.querySelectorAll('.lang-btn[data-lang]').forEach(btn => {
    btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
  });

  ['dragenter', 'dragover'].forEach(evt => {
    dropZone.addEventListener(evt, e => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
    document.addEventListener(evt, e => {
      if (e.dataTransfer?.types?.includes('Files')) e.preventDefault();
    });
  });

  ['dragleave', 'drop'].forEach(evt => {
    dropZone.addEventListener(evt, () => dropZone.classList.remove('drag-over'));
  });

  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    e.stopPropagation();
    handleFiles(e.dataTransfer.files);
  });

  document.addEventListener('drop', e => {
    if (!e.dataTransfer?.files?.length) return;
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  });
}

function tick() { return new Promise(r => setTimeout(r, 0)); }
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Init ─────────────────────────────────────────────────────
function initUI() {
  applyI18n();
  $('global-search').value = '';
  $('tree-filter').value = '';
  $('search-clear').classList.add('hidden');
  $('search-results').classList.add('hidden');
  $('type-detail').classList.add('hidden');
  $('welcome-screen').classList.remove('hidden');
  renderFooterStats();
  renderTree();
  renderWelcomeCards();
  if (!eventsBound) bindEvents();
  updateQueryPreview();
}

// ─── Footer Stats ─────────────────────────────────────────────
function renderFooterStats() {
  const types = S.allTypes.filter(t => !isBuiltin(t));
  const kinds = {};
  types.forEach(t => { kinds[t.kind] = (kinds[t.kind] || 0) + 1; });
  const totalFields = types.reduce((s,t) =>
    s + (t.fields?.length||0) + (t.inputFields?.length||0) + (t.enumValues?.length||0), 0);

  const items = [
    { label: t('footerTypes'),  value: types.length, color: '#a855f7' },
    { label: t('footerFields'), value: totalFields,   color: '#3b82f6' },
    { label: 'Object',  value: kinds.OBJECT  || 0, color: '#3b82f6' },
    { label: 'Input',   value: kinds.INPUT_OBJECT || 0, color: '#06b6d4' },
    { label: 'Enum',    value: kinds.ENUM    || 0, color: '#a855f7' },
    { label: 'Scalar',  value: kinds.SCALAR  || 0, color: '#10b981' },
  ];

  $('footer-stats').innerHTML = items.map(item => `
    <div class="footer-stat">
      <span class="footer-stat-dot" style="background:${item.color}"></span>
      <span class="footer-stat-value">${item.value.toLocaleString()}</span>
      <span class="footer-stat-label">${item.label}</span>
    </div>
  `).join('');
}

// ─── Tree ─────────────────────────────────────────────────────
let _nodeId = 0;
function mkNodeId() { return 'n' + (++_nodeId); }

function createNode(fieldName, typeName, parentTypeName, depth, ancestorTypes) {
  const t = S.typeMap[typeName];
  const hasChildren = !!t && (t.fields?.length > 0) && depth < MAX_TREE_DEPTH
                      && !ancestorTypes.has(typeName);
  return {
    id:            mkNodeId(),
    fieldName,
    typeName,
    parentTypeName,
    kind:          t?.kind || 'SCALAR',
    depth,
    hasChildren,
    expanded:      false,
    childrenReady: false,
    childNodes:    [],
    ancestorTypes: new Set(ancestorTypes),
    el:            null,
    childrenEl:    null,
  };
}

function loadChildren(node) {
  if (node.childrenReady) return;
  const t = S.typeMap[node.typeName];
  if (!t?.fields) { node.childrenReady = true; return; }

  const newAncestors = new Set([...node.ancestorTypes, node.typeName]);
  node.childNodes = t.fields.map(f => {
    const childTypeName = baseTypeName(f.type) || 'Unknown';
    return createNode(f.name, childTypeName, node.typeName, node.depth + 1, newAncestors);
  });
  node.childrenReady = true;
}

// ── Render the full tree from root query ──
let filterText = '';
let rootNodes  = [];

function renderTree() {
  const treeRoot = $('tree-root');
  treeRoot.innerHTML = '';
  rootNodes = [];

  const queryName = S.schema.queryType?.name;
  const subName   = S.schema.subscriptionType?.name;
  const mutName   = S.schema.mutationType?.name;

  const sections = [];
  if (queryName)  sections.push({ label: 'Query',        typeName: queryName });
  if (mutName)    sections.push({ label: 'Mutation',      typeName: mutName   });
  if (subName)    sections.push({ label: 'Subscription',  typeName: subName   });

  sections.forEach(sec => {
    const t = S.typeMap[sec.typeName];
    if (!t?.fields?.length) return;

    // Section label
    const labelEl = document.createElement('div');
    labelEl.className = 'tree-section-label';
    labelEl.textContent = sec.label;
    treeRoot.appendChild(labelEl);

    // Top-level nodes = root type's fields
    t.fields.forEach(f => {
      const childTypeName = baseTypeName(f.type) || 'Unknown';
      const node = createNode(f.name, childTypeName, sec.typeName, 0, new Set([sec.typeName]));
      rootNodes.push(node);

      // Filter
      if (filterText && !node.fieldName.toLowerCase().includes(filterText) &&
          !node.typeName.toLowerCase().includes(filterText)) return;

      const { el, childrenEl } = buildNodeEl(node);
      treeRoot.appendChild(el);
      treeRoot.appendChild(childrenEl);
    });
  });
}

function buildNodeEl(node) {
  const color = kindColor(node.kind);
  const indentPx = node.depth * 16;

  const el = document.createElement('div');
  el.className = 'tree-node';
  el.dataset.nodeId = node.id;

  const hasSel = checkNodeSelection(node);
  if (hasSel) el.classList.add('has-selection');

  el.innerHTML = `
    <div class="tree-indent" style="width:${indentPx}px"></div>
    <span class="tree-toggle ${node.hasChildren ? '' : 'leaf'}">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </span>
    <span class="tree-dot" style="background:${color}"></span>
    <span class="tree-name" title="${esc(node.fieldName)} : ${esc(node.typeName)}">${esc(node.fieldName)}</span>
    <span class="tree-badge" title="${esc(node.typeName)}">${esc(node.typeName)}</span>
    <span class="tree-sel-dot"></span>
  `;

  const childrenEl = document.createElement('div');
  childrenEl.className = 'tree-children';

  node.el = el;
  node.childrenEl = childrenEl;

  // Unified click handler (item details, selection toggle and expand)
  el.addEventListener('click', e => {
    // If clicking directly on the chevron toggle, only toggle expansion
    if (e.target.closest('.tree-toggle')) {
      e.stopPropagation();
      if (node.hasChildren) toggleNode(node);
      return;
    }

    // Toggle field selection for this node
    toggleFieldSelection(node.parentTypeName, node.fieldName);

    // Navigate to its details type
    const t = S.typeMap[node.typeName];
    if (t) navigateTo(t);

    // Toggle expand if has children
    if (node.hasChildren) {
      toggleNode(node);
    }

    // Mark active in tree UI
    document.querySelectorAll('.tree-node.active').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
  });

  return { el, childrenEl };
}

function toggleNode(node) {
  if (!node.hasChildren) return;

  node.expanded = !node.expanded;
  const toggle = node.el?.querySelector('.tree-toggle');
  if (toggle) toggle.classList.toggle('expanded', node.expanded);

  if (node.expanded) {
    loadChildren(node);

    node.childrenEl.innerHTML = '';
    node.childNodes.forEach(child => {
      const { el, childrenEl } = buildNodeEl(child);
      node.childrenEl.appendChild(el);
      node.childrenEl.appendChild(childrenEl);
    });

    // Animate open
    node.childrenEl.classList.add('open');
  } else {
    node.childrenEl.classList.remove('open');
    // Collapse all descendants
    collapseDescendants(node);
    // Clear after transition
    setTimeout(() => { if (!node.expanded) node.childrenEl.innerHTML = ''; }, 300);
  }
}

function collapseDescendants(node) {
  node.childNodes.forEach(child => {
    if (child.expanded) {
      child.expanded = false;
      child.childrenEl?.classList.remove('open');
      collapseDescendants(child);
    }
  });
}

// ─── Welcome Cards ─────────────────────────────────────────────
function renderWelcomeCards() {
  const schema = S.schema;
  const roots  = [];
  if (schema.queryType?.name)        roots.push({ icon:'🔍', name: schema.queryType.name,        kind:'Query'        });
  if (schema.mutationType?.name)     roots.push({ icon:'✏️', name: schema.mutationType.name,     kind:'Mutation'     });
  if (schema.subscriptionType?.name) roots.push({ icon:'📡', name: schema.subscriptionType.name, kind:'Subscription' });

  const popular = S.allTypes
    .filter(t => !isBuiltin(t) && t.kind === 'OBJECT' && (t.fields?.length || 0) > 5)
    .sort((a,b) => (b.fields?.length||0) - (a.fields?.length||0))
    .slice(0, Math.max(0, 6 - roots.length));

  const cards = [
    ...roots,
    ...popular.map(t => ({ icon:'{}', name: t.name, kind: t.kind })),
  ];

  $('welcome-cards').innerHTML = cards.map(c => `
    <div class="welcome-card" data-type-name="${esc(c.name)}">
      <div class="welcome-card-icon">${c.icon}</div>
      <div class="welcome-card-name">${esc(c.name)}</div>
      <div class="welcome-card-kind">${c.kind}</div>
    </div>
  `).join('');

  $('welcome-cards').querySelectorAll('.welcome-card[data-type-name]').forEach(card => {
    card.addEventListener('click', () => {
      const t = S.typeMap[card.dataset.typeName];
      if (t) navigateTo(t);
    });
  });
}

// ─── Navigation ───────────────────────────────────────────────
function navigateTo(type, pushHistory = true) {
  if (pushHistory && S.activeType && S.activeType.name !== type.name) {
    S.history.push(S.activeType.name);
  }
  S.activeType = type;
  clearSearch();
  showTypeDetail(type);
}

function showTypeDetail(type) {
  $('welcome-screen').classList.add('hidden');
  $('search-results').classList.add('hidden');
  $('type-detail').classList.remove('hidden');
  renderBreadcrumb(type);
  renderTypeHeader(type);
  renderFields(type);
}

// ─── Breadcrumb ───────────────────────────────────────────────
function renderBreadcrumb(type) {
  const items = [...S.history, type.name].slice(-5);
  $('breadcrumb').innerHTML = items.map((name, i) => {
    const isLast = i === items.length - 1;
    return `
      ${i > 0 ? '<span class="breadcrumb-sep">›</span>' : ''}
      <span class="breadcrumb-item" data-bc="${esc(name)}"
            style="${isLast ? 'color:var(--text-primary);font-weight:500;' : ''}">
        ${esc(name)}
      </span>`;
  }).join('');

  $('breadcrumb').querySelectorAll('.breadcrumb-item[data-bc]').forEach(el => {
    el.addEventListener('click', () => {
      const n = el.dataset.bc;
      const idx = S.history.indexOf(n);
      if (idx >= 0) {
        S.history = S.history.slice(0, idx);
        const t = S.typeMap[n];
        if (t) navigateTo(t, false);
      }
    });
  });
}

// ─── Type Header ──────────────────────────────────────────────
function renderTypeHeader(type) {
  const meta = KIND_META[type.kind] || { label: type.kind, color: '#94a3b8' };
  const total = (type.fields?.length||0) + (type.inputFields?.length||0) + (type.enumValues?.length||0);

  const ifaceHtml = type.interfaces?.length
    ? type.interfaces.map(i =>
        `<span class="field-type" data-link="${esc(i.name)}" style="cursor:pointer">${esc(i.name)}</span>`
      ).join(' ') : '';

  const possibleHtml = type.possibleTypes?.length
    ? type.possibleTypes.map(p =>
        `<span class="field-type" data-link="${esc(p.name)}" style="cursor:pointer">${esc(p.name)}</span>`
      ).join(' ') : '';

  $('type-header').innerHTML = `
    <div class="type-header-top">
      <span class="type-kind-badge bg-kind-${type.kind} kind-${type.kind}"
            style="color:${meta.color};border-color:${meta.color}40">
        ${meta.label}
      </span>
      <div class="type-name">${esc(type.name)}</div>
    </div>
    ${type.description ? `<div class="type-description">${esc(type.description)}</div>` : ''}
    <div class="type-meta">
      ${total ? `<div class="type-meta-item"><strong>${total}</strong>&nbsp;${total === 1 ? t('fieldCount') : t('fieldCountPlural')}</div>` : ''}
      ${ifaceHtml ? `<div class="type-meta-item"><strong>Implements:</strong>&nbsp;${ifaceHtml}</div>` : ''}
      ${possibleHtml ? `<div class="type-meta-item"><strong>Possible&nbsp;Types:</strong>&nbsp;${possibleHtml}</div>` : ''}
    </div>
  `;

  $('type-header').querySelectorAll('[data-link]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      const t = S.typeMap[el.dataset.link];
      if (t) navigateTo(t);
    });
  });
}

// ─── Fields ───────────────────────────────────────────────────
function renderFields(type) {
  const c = $('fields-container');
  c.innerHTML = '';

  if (type.kind === 'ENUM')         renderEnumValues(type, c);
  else if (type.fields?.length)     renderObjectFields(type.fields, c);
  else if (type.inputFields?.length) renderInputFields(type.inputFields, c);
  else c.innerHTML = `<div class="no-results"><div class="no-results-icon">∅</div><div class="no-results-text">${t('noFieldsForType')}</div></div>`;
}

function renderEnumValues(type, c) {
  const values = type.enumValues || [];
  const show   = S.hideDeprecated ? values.filter(v => !v.isDeprecated) : values;
  const sec = document.createElement('div');
  sec.className = 'fields-section animate-in';
  sec.innerHTML = `<div class="fields-section-title">${t('enumValues')} (${show.length})</div>`;
  show.forEach(v => {
    const card = document.createElement('div');
    card.className = 'enum-value-card';
    card.innerHTML = `
      <span class="enum-value-name">${esc(v.name)}</span>
      ${v.description ? `<span class="enum-value-desc">${esc(v.description)}</span>` : ''}
      ${v.isDeprecated ? `<span class="field-deprecated-tag">deprecated</span>` : ''}
    `;
    sec.appendChild(card);
  });
  c.appendChild(sec);
}

function renderObjectFields(fields, c) {
  const show = S.hideDeprecated ? fields.filter(f => !f.isDeprecated) : fields;
  const sec  = document.createElement('div');
  sec.className = 'fields-section animate-in';
  sec.innerHTML = `<div class="fields-section-title">${t('fields')} (${show.length})</div>`;
  show.forEach(f => sec.appendChild(createFieldCard(f)));
  c.appendChild(sec);
}

function renderInputFields(inputFields, c) {
  const sec = document.createElement('div');
  sec.className = 'fields-section animate-in';
  sec.innerHTML = `<div class="fields-section-title">${t('inputFields')} (${inputFields.length})</div>`;
  inputFields.forEach(f => {
    const typeName = typeString(f.type);
    const baseName = baseTypeName(f.type);
    const card = document.createElement('div');
    card.className = 'input-field-card';
    card.innerHTML = `
      <div class="input-field-header">
        <span class="input-field-name">${esc(f.name)}</span>
        <span class="input-field-type${S.typeMap[baseName] ? ' field-type' : ''}"
              data-link="${esc(baseName||'')}">${esc(typeName)}</span>
        ${f.defaultValue ? `<span class="arg-default">default: ${esc(f.defaultValue)}</span>` : ''}
      </div>
      ${f.description ? `<div class="input-field-desc">${esc(f.description)}</div>` : ''}
    `;
    card.querySelectorAll('[data-link]').forEach(el => {
      const t = S.typeMap[el.dataset.link];
      if (t) { el.style.cursor = 'pointer'; el.addEventListener('click', () => navigateTo(t)); }
    });
    sec.appendChild(card);
  });
  c.appendChild(sec);
}

function createFieldCard(field) {
  const card = document.createElement('div');
  const key = `${S.activeType.name}.${field.name}`;
  const isSel = S.selectedFields.has(key);

  card.className = 'field-card' + 
                   (field.isDeprecated ? ' deprecated' : '') +
                   (isSel ? ' selected' : '');

  const typeName = typeString(field.type);
  const baseName = baseTypeName(field.type);
  const hasArgs  = !!field.args?.length;
  const hasDesc  = !!field.description;

  card.innerHTML = `
    <div class="field-card-header">
      <span class="field-sel-indicator"></span>
      <span class="field-name">${esc(field.name)}</span>
      <span class="field-type" data-link="${esc(baseName||'')}">${esc(typeName)}</span>
      ${field.isDeprecated ? `<span class="field-deprecated-tag">deprecated</span>` : ''}
    </div>
    ${hasDesc && isSel ? `<div class="field-desc-compact">${esc(field.description)}</div>` : ''}
    ${hasArgs && isSel ? `
      <div class="field-compact-args">
        ${field.args.map(a => `
          <div class="arg-chip" title="${esc(a.description || '')}">
            <span class="arg-chip-name">${esc(a.name)}</span>
            <span class="arg-chip-colon">:</span>
            <span class="arg-chip-type">${esc(typeString(a.type))}</span>
            ${a.defaultValue ? `<span class="arg-chip-default">= ${esc(a.defaultValue)}</span>` : ''}
          </div>
        `).join('')}
      </div>
    ` : ''}
  `;

  // Toggle selection on header/body click (excluding links)
  card.addEventListener('click', e => {
    if (e.target.closest('[data-link]')) return;
    toggleFieldSelection(S.activeType.name, field.name);
  });

  // Navigate on type click
  card.querySelectorAll('[data-link]').forEach(el => {
    const t = S.typeMap[el.dataset.link];
    if (t) el.addEventListener('click', e => { e.stopPropagation(); navigateTo(t); });
  });

  return card;
}

// ─── Selection Logic ──────────────────────────────────────────
function toggleFieldSelection(typeName, fieldName) {
  const key = `${typeName}.${fieldName}`;
  if (S.selectedFields.has(key)) {
    S.selectedFields.delete(key);
  } else {
    S.selectedFields.add(key);
  }

  // Refresh current fields view to update active card states and compact items
  if (S.activeType && S.activeType.name === typeName) {
    renderFields(S.activeType);
  }

  updateTreeSelectionStates();
  updateQueryPreview();
}

function checkNodeSelection(node) {
  const isSelfSelected = S.selectedFields.has(`${node.parentTypeName}.${node.fieldName}`);
  if (isSelfSelected) return true;

  // Check child nodes recursively if ready
  if (node.childrenReady && node.childNodes) {
    return node.childNodes.some(child => checkNodeSelection(child));
  }

  // If children not loaded, check type schema to see if fields of this type are selected
  const t = S.typeMap[node.typeName];
  if (t && t.fields) {
    return t.fields.some(f => S.selectedFields.has(`${node.typeName}.${f.name}`));
  }

  return false;
}

function updateTreeSelectionStates() {
  function walk(node) {
    if (!node.el) return;
    const hasSel = checkNodeSelection(node);
    node.el.classList.toggle('has-selection', hasSel);
    if (node.childNodes) {
      node.childNodes.forEach(walk);
    }
  }
  rootNodes.forEach(walk);
}

// ─── GraphQL Code Generator ───────────────────────────────────
function buildSelectionSets(typeName, indent, visited) {
  if (visited.has(typeName)) {
    return {
      raw: `${indent}# Circular reference to ${typeName} detected\n`,
      html: `${indent}<span class="gql-comment"># Circular reference to ${typeName} detected</span>\n`
    };
  }
  visited.add(typeName);

  const t = S.typeMap[typeName];
  if (!t) return { raw: '', html: '' };

  const selFields = (t.fields || []).filter(f => S.selectedFields.has(`${typeName}.${f.name}`));
  if (selFields.length === 0) {
    visited.delete(typeName);
    return { raw: '', html: '' };
  }

  let rawLines = [];
  let htmlLines = [];

  selFields.forEach(f => {
    const fBaseType = baseTypeName(f.type);
    const fTypeObj = S.typeMap[fBaseType];
    const isObj = fTypeObj && (fTypeObj.kind === 'OBJECT' || fTypeObj.kind === 'INTERFACE' || fTypeObj.kind === 'UNION');

    let argsRaw = '';
    let argsHtml = '';
    if (f.args && f.args.length > 0) {
      const argListRaw = f.args.map(a => `${a.name}: ...`).join(', ');
      const argListHtml = f.args.map(a => `<span class="gql-arg">${a.name}</span><span class="gql-punc">:</span> <span class="gql-val">...</span>`).join('<span class="gql-punc">,</span> ');
      argsRaw = `(${argListRaw})`;
      argsHtml = `<span class="gql-punc">(</span>${argListHtml}<span class="gql-punc">)</span>`;
    }

    if (isObj) {
      const sub = buildSelectionSets(fBaseType, indent + '  ', visited);
      if (sub.raw) {
        rawLines.push(`${indent}${f.name}${argsRaw} {\n${sub.raw}${indent}}`);
        htmlLines.push(`${indent}<span class="gql-field">${f.name}</span>${argsHtml} <span class="gql-brace">{</span>\n${sub.html}${indent}<span class="gql-brace">}</span>`);
      } else {
        rawLines.push(`${indent}${f.name}${argsRaw} {\n${indent}  # select fields\n${indent}}`);
        htmlLines.push(`${indent}<span class="gql-field">${f.name}</span>${argsHtml} <span class="gql-brace">{</span>\n${indent}  <span class="gql-comment"># select fields</span>\n${indent}<span class="gql-brace">}</span>`);
      }
    } else {
      rawLines.push(`${indent}${f.name}${argsRaw}`);
      htmlLines.push(`${indent}<span class="gql-leaf">${f.name}</span>${argsHtml}`);
    }
  });

  visited.delete(typeName);
  return {
    raw: rawLines.join('\n') + '\n',
    html: htmlLines.join('\n') + '\n'
  };
}

function generateGraphQL() {
  const visited = new Set();
  const rootVisited = new Set();

  const queryName = S.schema?.queryType?.name;
  const mutName   = S.schema?.mutationType?.name;
  const subName   = S.schema?.subscriptionType?.name;

  let partsRaw = [];
  let partsHtml = [];

  function genForRoot(opKeyword, typeName) {
    if (!typeName) return;
    const t = S.typeMap[typeName];
    if (!t) return;
    const selFields = (t.fields || []).filter(f => S.selectedFields.has(`${typeName}.${f.name}`));
    if (selFields.length === 0) return;

    const { raw, html } = buildSelectionSets(typeName, '  ', visited);
    if (raw) {
      partsRaw.push(`${opKeyword} {\n${raw}}`);
      partsHtml.push(`<span class="gql-comment"># Query root operation</span>\n<span class="gql-field">${opKeyword}</span> <span class="gql-brace">{</span>\n${html}<span class="gql-brace">}</span>`);
      visited.forEach(v => rootVisited.add(v));
      visited.clear();
    }
  }

  // Generate for operation roots
  genForRoot('query', queryName);
  genForRoot('mutation', mutName);
  genForRoot('subscription', subName);

  // Generate fragments for types that have selections but are not reachable from roots
  const allSelTypes = new Set();
  S.selectedFields.forEach(sf => {
    const typeName = sf.split('.')[0];
    allSelTypes.add(typeName);
  });

  allSelTypes.forEach(typeName => {
    if (rootVisited.has(typeName)) return;
    if (typeName === queryName || typeName === mutName || typeName === subName) return;

    const t = S.typeMap[typeName];
    if (!t) return;

    const { raw, html } = buildSelectionSets(typeName, '  ', visited);
    if (raw) {
      const fragName = `${typeName}Fields`;
      partsRaw.push(`fragment ${fragName} on ${typeName} {\n${raw}}`);
      partsHtml.push(`<span class="gql-comment"># Fragment selection</span>\n<span class="gql-field">fragment</span> <span class="gql-leaf">${fragName}</span> <span class="gql-field">on</span> <span class="gql-leaf">${typeName}</span> <span class="gql-brace">{</span>\n${html}<span class="gql-brace">}</span>`);
      visited.clear();
    }
  });

  return {
    raw: partsRaw.join('\n\n'),
    html: partsHtml.join('\n\n')
  };
}

function updateQueryPreview() {
  const { raw, html } = generateGraphQL();

  const emptyEl = $('query-empty');
  const codeEl = $('query-code');
  const contentEl = $('query-content');
  const countEl = $('sel-count');

  if (raw.trim().length === 0) {
    emptyEl.classList.remove('hidden');
    codeEl.classList.add('hidden');
    countEl.classList.add('hidden');
  } else {
    emptyEl.classList.add('hidden');
    codeEl.classList.remove('hidden');
    contentEl.innerHTML = html;

    // Update count badge
    countEl.classList.remove('hidden');
    countEl.textContent = t('selectedCount', { count: S.selectedFields.size });
  }
}

// ─── Global Search ────────────────────────────────────────────
let searchTimeout = null;

function doSearch(query) {
  S.searchQuery = query;
  if (!query) { clearSearch(); return; }

  $('search-clear').classList.remove('hidden');
  $('search-results').classList.remove('hidden');
  $('type-detail').classList.add('hidden');
  $('welcome-screen').classList.add('hidden');

  const q = query.toLowerCase();
  const types = S.allTypes.filter(t => !isBuiltin(t));

  const typeMatches = types.filter(t => t.name.toLowerCase().includes(q)).slice(0, 80);

  const fieldMatches = [];
  for (const t of types) {
    const fields = [...(t.fields||[]), ...(t.inputFields||[]), ...(t.enumValues||[])];
    for (const f of fields) {
      if (f.name.toLowerCase().includes(q)) {
        fieldMatches.push({ type: t, field: f });
        if (fieldMatches.length >= 80) break;
      }
    }
    if (fieldMatches.length >= 80) break;
  }

  const total = typeMatches.length + fieldMatches.length;
  $('search-results-count').textContent = t('searchResultCount', { count: total });

  let html = '';

  if (typeMatches.length) {
    html += `<div class="search-result-group">
      <div class="search-result-group-title">${t('typesGroup')} (${typeMatches.length})</div>
      ${typeMatches.map(t => {
        const c = kindColor(t.kind);
        const fc = (t.fields?.length||0)+(t.inputFields?.length||0)+(t.enumValues?.length||0);
        const km = KIND_META[t.kind] || { label: t.kind };
        return `<div class="search-result-item" data-type-name="${esc(t.name)}">
          <span class="search-result-kind" style="background:${c}"></span>
          <div class="search-result-content">
            <div class="search-result-name">${highlight(t.name, query)}</div>
            ${t.description ? `<div class="search-result-desc">${esc(t.description).slice(0,90)}</div>` : ''}
            <div class="search-result-parent">${km.label} · ${fc} ${fc === 1 ? t('fieldCount') : t('fieldCountPlural')}</div>
          </div>
          <svg class="search-result-arrow" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </div>`;
      }).join('')}
    </div>`;
  }

  if (fieldMatches.length) {
    html += `<div class="search-result-group">
      <div class="search-result-group-title">${t('fieldsGroup')} (${fieldMatches.length})</div>
      ${fieldMatches.map(({ type: t, field: f }) => {
        const c = kindColor(t.kind);
        const tn = f.type ? typeString(f.type) : '';
        return `<div class="search-result-item" data-type-name="${esc(t.name)}">
          <span class="search-result-kind" style="background:${c}"></span>
          <div class="search-result-content">
            <div class="search-result-name">${highlight(f.name, query)}</div>
            ${tn ? `<div class="search-result-desc">${esc(tn)}</div>` : ''}
            <div class="search-result-parent">↳ ${esc(t.name)}</div>
          </div>
          <svg class="search-result-arrow" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </div>`;
      }).join('')}
    </div>`;
  }

  if (!html) {
    html = `<div class="no-results"><div class="no-results-icon">🔍</div>
      <div class="no-results-text">${esc(t('noSearchResults', { query }))}</div></div>`;
  }

  $('search-results-list').innerHTML = html;
  $('search-results-list').querySelectorAll('.search-result-item[data-type-name]').forEach(item => {
    item.addEventListener('click', () => {
      const t = S.typeMap[item.dataset.typeName];
      if (t) { $('global-search').value = ''; clearSearch(); navigateTo(t); }
    });
  });
}

function clearSearch() {
  S.searchQuery = '';
  $('search-clear').classList.add('hidden');
  $('search-results').classList.add('hidden');
  if (!S.activeType) {
    $('welcome-screen').classList.remove('hidden');
    $('type-detail').classList.add('hidden');
  } else {
    $('type-detail').classList.remove('hidden');
  }
}

// ─── Toast helper ─────────────────────────────────────────────
let toastTimeout = null;
function showToast(msg) {
  const toast = $('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 2300);
}

// ─── Field Drawer ─────────────────────────────────────────────
function closeFieldDrawer() {
  $('field-drawer').classList.add('hidden');
  $('field-drawer-backdrop').classList.add('hidden');
}

// ─── Tree Filter ──────────────────────────────────────────────
function applyTreeFilter(q) {
  filterText = q.toLowerCase().trim();
  renderTree();
}

// ─── Events ───────────────────────────────────────────────────
function bindEvents() {
  eventsBound = true;

  // Sidebar toggle
  $('sidebar-toggle').addEventListener('click', () => {
    $('sidebar').classList.toggle('collapsed');
  });

  $('schema-change-btn').addEventListener('click', () => {
    $('schema-reload-input').click();
  });

  // Global search
  $('global-search').addEventListener('input', e => {
    clearTimeout(searchTimeout);
    const q = e.target.value.trim();
    searchTimeout = setTimeout(() => {
      q.length ? doSearch(q) : clearSearch();
    }, 160);
  });

  $('search-clear').addEventListener('click', () => {
    $('global-search').value = '';
    clearSearch();
  });

  // Tree filter
  $('tree-filter').addEventListener('input', e => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => applyTreeFilter(e.target.value), 200);
  });

  // Selection Action Buttons
  $('btn-clear-sel').addEventListener('click', () => {
    S.selectedFields.clear();
    if (S.activeType) renderFields(S.activeType);
    updateTreeSelectionStates();
    updateQueryPreview();
    showToast(t('allSelectionsCleared'));
  });

  $('btn-copy-query').addEventListener('click', () => {
    const { raw } = generateGraphQL();
    if (!raw) {
      showToast(t('nothingToCopy'));
      return;
    }
    navigator.clipboard.writeText(raw)
      .then(() => showToast(t('copied')))
      .catch(err => {
        console.error(err);
        showToast(t('copyFailed'));
      });
  });

  $('btn-download-query').addEventListener('click', () => {
    const { raw } = generateGraphQL();
    if (!raw) {
      showToast(t('nothingToDownload'));
      return;
    }
    const blob = new Blob([raw], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schema.graphql';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(t('downloaded'));
  });

  // Keyboard navigation & search focus
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      $('global-search').focus();
      $('global-search').select();
    }
    if (e.key === 'Escape') {
      if (!$('field-drawer').classList.contains('hidden')) { closeFieldDrawer(); }
      else { $('global-search').value = ''; clearSearch(); $('global-search').blur(); }
    }
  });

  // Drawer events (backward compatibility)
  $('field-drawer-close').addEventListener('click', closeFieldDrawer);
  $('field-drawer-backdrop').addEventListener('click', closeFieldDrawer);
}

// ─── Boot ────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  applyI18n();
  initSchemaLoader();
  showSchemaLoader();
});
