/* ═══════════════════════════════════════════════════
   research-note.js  ·  연구노트 모듈
   ─────────────────────────────────────────────────
   ResearchNoteDB : LocalStorage CRUD
   initResearchSection : 전체 UI 초기화
   ═══════════════════════════════════════════════════ */

import { StrainDB } from './strainDB.js';

/* ══════════════════════════════════════
   1. DB 레이어
   ══════════════════════════════════════ */
const STORAGE_KEY = 'objetbio_research_notes';

export const ResearchNoteDB = {
  getAll() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch { return []; }
  },
  save(notes) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  },
  create(data) {
    const notes = this.getAll();
    const note = {
      id:         'NOTE-' + Date.now(),
      createdAt:  new Date().toISOString(),
      updatedAt:  new Date().toISOString(),
      title:      data.title      || '새 연구노트',
      researcher: data.researcher || '',
      strainId:   data.strainId   || '',   // 균주 DB 연동
      purpose:    data.purpose    || '',
      method:     data.method     || '',
      location:   data.location   || '',
      sampleDate: data.sampleDate || '',
      sample:     data.sample     || '',
      content:    data.content    || '',   // 본문 (사진 포함 마크다운)
      conclusion: data.conclusion || '',
      photos:     data.photos     || [],   // [{name, dataUrl}]
      attachments:data.attachments|| [],   // [{name, size, dataUrl}]
      tags:       data.tags       || [],
    };
    notes.unshift(note);
    this.save(notes);
    return note;
  },
  update(id, patch) {
    const notes = this.getAll().map(n =>
      n.id === id ? { ...n, ...patch, updatedAt: new Date().toISOString() } : n
    );
    this.save(notes);
    return notes.find(n => n.id === id);
  },
  delete(id) {
    this.save(this.getAll().filter(n => n.id !== id));
  },
  find(id) {
    return this.getAll().find(n => n.id === id);
  },
};

/* ══════════════════════════════════════
   2. UI 상태
   ══════════════════════════════════════ */
let currentNoteId   = null;   // 열려있는 노트 ID
let editMode        = false;  // 편집 모드 여부
let editPhotos      = [];     // 편집 중 사진 배열
let editAttachments = [];     // 편집 중 첨부파일 배열

/* ══════════════════════════════════════
   3. 진입점
   ══════════════════════════════════════ */
export function initResearchSection() {
  renderNoteList();
  bindResearchEvents();
}

export function refreshResearchSection() {
  renderNoteList();
}

/* ══════════════════════════════════════
   4. 노트 목록
   ══════════════════════════════════════ */
function renderNoteList(filter = '') {
  const listEl = document.getElementById('note-list');
  const emptyEl = document.getElementById('note-list-empty');
  if (!listEl) return;

  let notes = ResearchNoteDB.getAll();
  if (filter) {
    const q = filter.toLowerCase();
    notes = notes.filter(n =>
      n.title.toLowerCase().includes(q)     ||
      n.researcher.toLowerCase().includes(q)||
      n.purpose.toLowerCase().includes(q)   ||
      (n.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }

  if (notes.length === 0) {
    listEl.innerHTML = '';
    emptyEl?.classList.remove('hidden');
    return;
  }
  emptyEl?.classList.add('hidden');

  const strains = StrainDB.getAll();
  const strainMap = Object.fromEntries(strains.map(s => [s.id, s.name]));

  listEl.innerHTML = notes.map(n => {
    const sName = n.strainId ? (strainMap[n.strainId] || '') : '';
    const dateStr = n.sampleDate ? n.sampleDate.slice(0, 10) : n.createdAt.slice(0, 10);
    const photoCount = (n.photos || []).length;
    const fileCount  = (n.attachments || []).length;
    return `
    <div class="note-card" data-id="${n.id}">
      <div class="note-card-header">
        <div class="note-card-title">${esc(n.title)}</div>
        <div class="note-card-badges">
          ${photoCount ? `<span class="note-badge">📷 ${photoCount}</span>` : ''}
          ${fileCount  ? `<span class="note-badge">📎 ${fileCount}</span>` : ''}
        </div>
      </div>
      <div class="note-card-meta">
        <span>👤 ${esc(n.researcher) || '—'}</span>
        ${sName ? `<span>🧫 ${esc(sName)}</span>` : ''}
        <span>📅 ${dateStr}</span>
        <span>📍 ${esc(n.location) || '—'}</span>
      </div>
      <div class="note-card-purpose">${esc(n.purpose || '').slice(0, 80)}${(n.purpose || '').length > 80 ? '…' : ''}</div>
    </div>`;
  }).join('');

  // 카드 클릭
  listEl.querySelectorAll('.note-card').forEach(card => {
    card.addEventListener('click', () => openNote(card.dataset.id));
  });
}

/* ══════════════════════════════════════
   5. 노트 열기 (상세 뷰)
   ══════════════════════════════════════ */
function openNote(id) {
  const n = ResearchNoteDB.find(id);
  if (!n) return;
  currentNoteId = id;
  editMode = false;
  showPanel('detail');
  renderDetail(n);
}

function renderDetail(n) {
  const panel = document.getElementById('note-detail-panel');
  if (!panel) return;

  const strains   = StrainDB.getAll();
  const strainMap = Object.fromEntries(strains.map(s => [s.id, s.name]));
  const strainName = n.strainId ? (strainMap[n.strainId] || '—') : '—';

  const photosHtml = (n.photos || []).map((p, i) => `
    <figure class="note-photo-fig">
      <img src="${p.dataUrl}" alt="${esc(p.name)}" loading="lazy" />
      <figcaption>${esc(p.name)}</figcaption>
    </figure>`).join('');

  const attachHtml = (n.attachments || []).map(f => `
    <a class="note-attach-chip" href="${f.dataUrl}" download="${esc(f.name)}">
      📎 ${esc(f.name)} <span class="attach-size">${formatBytes(f.size)}</span>
    </a>`).join('');

  panel.innerHTML = `
    <div class="note-detail-toolbar">
      <button class="btn-icon" id="note-back-btn">← 목록</button>
      <div style="flex:1"></div>
      <button class="btn-secondary sm" id="note-edit-btn">✏️ 편집</button>
      <button class="btn-danger sm"    id="note-delete-btn">🗑️ 삭제</button>
    </div>

    <div class="note-detail-title">${esc(n.title)}</div>
    <div class="note-detail-meta">
      <span>👤 ${esc(n.researcher) || '—'}</span>
      <span>🧫 ${strainName}</span>
      <span>📅 ${n.sampleDate || n.createdAt.slice(0,10)}</span>
      <span>📍 ${esc(n.location) || '—'}</span>
      <span class="note-updated">수정: ${n.updatedAt.slice(0,16).replace('T',' ')}</span>
    </div>

    <section class="note-section">
      <h4>🎯 연구 목적</h4>
      <p>${nl2br(esc(n.purpose))}</p>
    </section>
    <section class="note-section">
      <h4>🧪 연구 방법 / 시료</h4>
      <p>${nl2br(esc(n.method))}</p>
      ${n.sample ? `<div class="note-chip">시료: ${esc(n.sample)}</div>` : ''}
    </section>
    <section class="note-section">
      <h4>📝 연구 내용</h4>
      <div class="note-content-body">${nl2br(esc(n.content))}</div>
    </section>
    ${photosHtml ? `<section class="note-section"><h4>📷 사진</h4><div class="note-photos-grid">${photosHtml}</div></section>` : ''}
    ${n.conclusion ? `<section class="note-section"><h4>📋 결론</h4><p>${nl2br(esc(n.conclusion))}</p></section>` : ''}
    ${attachHtml  ? `<section class="note-section"><h4>📎 첨부파일</h4><div class="note-attach-list">${attachHtml}</div></section>` : ''}
  `;

  document.getElementById('note-back-btn')?.addEventListener('click', () => showPanel('list'));
  document.getElementById('note-edit-btn')?.addEventListener('click', () => openEditForm(n));
  document.getElementById('note-delete-btn')?.addEventListener('click', () => {
    if (confirm(`"${n.title}"을(를) 삭제하시겠습니까?`)) {
      ResearchNoteDB.delete(n.id);
      currentNoteId = null;
      showPanel('list');
      renderNoteList();
    }
  });
}

/* ══════════════════════════════════════
   6. 편집 폼
   ══════════════════════════════════════ */
function openEditForm(n = null) {
  editMode      = true;
  editPhotos    = n ? [...(n.photos || [])] : [];
  editAttachments = n ? [...(n.attachments || [])] : [];

  showPanel('edit');
  const strains = StrainDB.getAll();
  const strainOpts = strains.map(s => `<option value="${s.id}" ${n?.strainId === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('');

  const form = document.getElementById('note-edit-panel');
  if (!form) return;

  form.innerHTML = `
    <div class="note-detail-toolbar">
      <button class="btn-icon" id="note-edit-back">← 취소</button>
      <div style="flex:1"></div>
      <button class="btn-primary sm" id="note-save-btn">💾 저장</button>
    </div>

    <div class="note-form-grid">
      <div class="note-form-field full">
        <label>📌 연구 제목</label>
        <input id="nf-title" type="text" value="${esc(n?.title || '')}" placeholder="예: B. cepacia JK6 항생제 내성 분석" />
      </div>
      <div class="note-form-field">
        <label>👤 담당 연구자</label>
        <input id="nf-researcher" type="text" value="${esc(n?.researcher || '')}" placeholder="홍길동" />
      </div>
      <div class="note-form-field">
        <label>🧫 연관 균주</label>
        <select id="nf-strain">
          <option value="">— 선택 안 함 —</option>
          ${strainOpts}
        </select>
      </div>
      <div class="note-form-field">
        <label>📅 채집/실험 날짜</label>
        <input id="nf-date" type="date" value="${n?.sampleDate || ''}" />
      </div>
      <div class="note-form-field">
        <label>📍 채집 장소</label>
        <input id="nf-location" type="text" value="${esc(n?.location || '')}" placeholder="예: 낙동강 하류 토양" />
      </div>
      <div class="note-form-field">
        <label>🧬 시료</label>
        <input id="nf-sample" type="text" value="${esc(n?.sample || '')}" placeholder="예: 토양, 해수, 온천수" />
      </div>

      <div class="note-form-field full">
        <label>🎯 연구 목적</label>
        <textarea id="nf-purpose" rows="3" placeholder="이 연구의 목적을 기술하세요.">${esc(n?.purpose || '')}</textarea>
      </div>
      <div class="note-form-field full">
        <label>🧪 연구 방법</label>
        <textarea id="nf-method" rows="4" placeholder="사용된 방법, 시약, 장비 등을 기술하세요.">${esc(n?.method || '')}</textarea>
      </div>
      <div class="note-form-field full">
        <label>📝 연구 내용 (본문)</label>
        <textarea id="nf-content" rows="8" placeholder="실험 과정, 관찰 결과, 중간 데이터 등을 기록하세요.">${esc(n?.content || '')}</textarea>
      </div>

      <div class="note-form-field full">
        <label>📷 사진 추가</label>
        <div class="note-photo-upload-zone" id="photo-drop-zone">
          <span>📷 클릭하거나 사진을 여기에 끌어다 놓으세요</span>
          <input type="file" id="nf-photos" accept="image/*" multiple hidden />
        </div>
        <div class="note-photos-grid" id="edit-photos-preview"></div>
      </div>

      <div class="note-form-field full">
        <label>📋 결론</label>
        <textarea id="nf-conclusion" rows="4" placeholder="실험 결론, 향후 과제 등을 기록하세요.">${esc(n?.conclusion || '')}</textarea>
      </div>

      <div class="note-form-field full">
        <label>📎 첨부파일 (시험성적서, 리포트 등)</label>
        <div class="note-attach-upload-zone" id="attach-drop-zone">
          <span>📎 파일을 클릭하거나 여기에 끌어다 놓으세요</span>
          <input type="file" id="nf-attachments" multiple hidden />
        </div>
        <div class="note-attach-list" id="edit-attachments-preview"></div>
      </div>
    </div>
  `;

  renderEditPhotos();
  renderEditAttachments();
  bindEditFormEvents(n?.id);
}

function renderEditPhotos() {
  const el = document.getElementById('edit-photos-preview');
  if (!el) return;
  el.innerHTML = editPhotos.map((p, i) => `
    <figure class="note-photo-fig editable">
      <img src="${p.dataUrl}" alt="${esc(p.name)}" loading="lazy" />
      <figcaption>${esc(p.name)}</figcaption>
      <button class="photo-remove-btn" data-i="${i}">✕</button>
    </figure>`).join('');
  el.querySelectorAll('.photo-remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      editPhotos.splice(+btn.dataset.i, 1);
      renderEditPhotos();
    });
  });
}

function renderEditAttachments() {
  const el = document.getElementById('edit-attachments-preview');
  if (!el) return;
  el.innerHTML = editAttachments.map((f, i) => `
    <div class="note-attach-chip editable">
      📎 ${esc(f.name)} <span class="attach-size">${formatBytes(f.size)}</span>
      <button class="attach-remove-btn" data-i="${i}">✕</button>
    </div>`).join('');
  el.querySelectorAll('.attach-remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      editAttachments.splice(+btn.dataset.i, 1);
      renderEditAttachments();
    });
  });
}

function bindEditFormEvents(existingId) {
  // 취소
  document.getElementById('note-edit-back')?.addEventListener('click', () => {
    if (existingId) { openNote(existingId); }
    else { showPanel('list'); }
  });

  // 저장
  document.getElementById('note-save-btn')?.addEventListener('click', () => saveNote(existingId));

  // 사진 업로드
  const photoZone = document.getElementById('photo-drop-zone');
  const photoInput = document.getElementById('nf-photos');
  photoZone?.addEventListener('click', () => photoInput?.click());
  photoZone?.addEventListener('dragover', e => { e.preventDefault(); photoZone.classList.add('drag-over'); });
  photoZone?.addEventListener('dragleave', () => photoZone.classList.remove('drag-over'));
  photoZone?.addEventListener('drop', e => {
    e.preventDefault(); photoZone.classList.remove('drag-over');
    handlePhotoFiles([...e.dataTransfer.files]);
  });
  photoInput?.addEventListener('change', () => handlePhotoFiles([...photoInput.files]));

  // 첨부파일 업로드
  const attachZone = document.getElementById('attach-drop-zone');
  const attachInput = document.getElementById('nf-attachments');
  attachZone?.addEventListener('click', () => attachInput?.click());
  attachZone?.addEventListener('dragover', e => { e.preventDefault(); attachZone.classList.add('drag-over'); });
  attachZone?.addEventListener('dragleave', () => attachZone.classList.remove('drag-over'));
  attachZone?.addEventListener('drop', e => {
    e.preventDefault(); attachZone.classList.remove('drag-over');
    handleAttachFiles([...e.dataTransfer.files]);
  });
  attachInput?.addEventListener('change', () => handleAttachFiles([...attachInput.files]));
}

function handlePhotoFiles(files) {
  const imgFiles = files.filter(f => f.type.startsWith('image/'));
  Promise.all(imgFiles.map(fileToDataUrl)).then(results => {
    results.forEach((dataUrl, i) => editPhotos.push({ name: imgFiles[i].name, dataUrl }));
    renderEditPhotos();
  });
}

function handleAttachFiles(files) {
  Promise.all(files.map(f => fileToDataUrl(f).then(dataUrl => ({
    name: f.name, size: f.size, dataUrl
  })))).then(results => {
    editAttachments.push(...results);
    renderEditAttachments();
  });
}

function saveNote(existingId) {
  const get = id => document.getElementById(id)?.value?.trim() || '';
  const data = {
    title:      get('nf-title')      || '제목 없음',
    researcher: get('nf-researcher'),
    strainId:   get('nf-strain'),
    sampleDate: get('nf-date'),
    location:   get('nf-location'),
    sample:     get('nf-sample'),
    purpose:    get('nf-purpose'),
    method:     get('nf-method'),
    content:    get('nf-content'),
    conclusion: get('nf-conclusion'),
    photos:     editPhotos,
    attachments:editAttachments,
  };

  let savedNote;
  if (existingId) {
    savedNote = ResearchNoteDB.update(existingId, data);
    currentNoteId = existingId;
  } else {
    savedNote = ResearchNoteDB.create(data);
    currentNoteId = savedNote.id;
  }

  renderNoteList();
  openNote(currentNoteId);
}

/* ══════════════════════════════════════
   7. 패널 전환
   ══════════════════════════════════════ */
function showPanel(panel) {
  const listPanel   = document.getElementById('note-list-panel');
  const detailPanel = document.getElementById('note-detail-panel');
  const editPanel   = document.getElementById('note-edit-panel');
  listPanel?.classList.toggle('hidden',   panel !== 'list');
  detailPanel?.classList.toggle('hidden', panel !== 'detail');
  editPanel?.classList.toggle('hidden',   panel !== 'edit');
}

/* ══════════════════════════════════════
   8. 이벤트 바인딩 (목록 헤더)
   ══════════════════════════════════════ */
function bindResearchEvents() {
  // 새 노트
  document.getElementById('new-note-btn')?.addEventListener('click', () => {
    currentNoteId = null;
    openEditForm(null);
  });
  document.getElementById('new-note-btn-2')?.addEventListener('click', () => {
    currentNoteId = null;
    openEditForm(null);
  });

  // 검색
  document.getElementById('note-search')?.addEventListener('input', e => {
    renderNoteList(e.target.value);
  });
}

/* ══════════════════════════════════════
   9. 유틸
   ══════════════════════════════════════ */
function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function nl2br(str) { return str.replace(/\n/g, '<br>'); }
function formatBytes(b) {
  if (!b) return '';
  if (b < 1024) return b + ' B';
  if (b < 1024**2) return (b/1024).toFixed(1) + ' KB';
  return (b/1024**2).toFixed(1) + ' MB';
}
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
