/**
 * Strain UI — 균주 관리 UI 렌더링 엔진
 * 균주 목록 / 상세 (탭) / 등록 폼 / 실험 기록 폼
 */

import { StrainDB, EXPERIMENT_TYPES, DEPOSIT_INSTITUTES, STATUS_CONFIG } from './strainDB.js';
import { initDNAMap } from './dna-map.js';
import { parseDNAFile, analyzeSequences } from './analyzer.js';

// ── 상태 ──
let currentStrainId = null;
let currentTab = 'info';
let strainAnalysisData = null;

// ── 진입점 ──
export function initStrainSection() {
  StrainDB.initSampleData();
  renderStrainLibrary();
  bindStrainEvents();
}

/** 균주 목록을 외부에서 새로고침 요청할 수 있도록 export */
export function refreshStrainLibrary() {
  renderStrainLibrary();
}

// ═══════════════════════════════════════════════════
//  균주 라이브러리 (목록 뷰)
// ═══════════════════════════════════════════════════
function renderStrainLibrary(query = '') {
  const strains = query ? StrainDB.search(query) : StrainDB.getAll();
  const grid = document.getElementById('strain-grid');
  const empty = document.getElementById('strain-empty');
  if (!grid) return;

  if (strains.length === 0) {
    grid.innerHTML = '';
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');

  grid.innerHTML = strains.map(s => {
    const st = STATUS_CONFIG[s.status] || STATUS_CONFIG['보류'];
    const expCount = s.experiments?.length || 0;
    const depCount = s.deposit?.length || 0;
    const lastExp = s.experiments?.[s.experiments.length - 1];
    return `
    <div class="strain-card" data-id="${s.id}" role="button" tabindex="0">
      <div class="strain-card-header">
        <div class="strain-id-badge">${s.id}</div>
        <div class="strain-status-badge" style="color:${st.color};background:${st.bg}">
          ${st.icon} ${s.status}
        </div>
      </div>
      <h3 class="strain-name"><em>${s.taxonomy.genus}</em> ${s.taxonomy.species} ${s.taxonomy.strain}</h3>
      <p class="strain-name-common">${s.name}</p>
      <div class="strain-meta-row">
        <span class="strain-meta-item">📍 ${s.discovery.location || '미지정'}</span>
        <span class="strain-meta-item">📅 ${s.discovery.date || '-'}</span>
      </div>
      <div class="strain-meta-row">
        <span class="strain-meta-item">🧫 ${s.culture.gram || '-'}</span>
        <span class="strain-meta-item">🌡️ ${s.culture.temperature || '-'}</span>
      </div>
      <div class="strain-card-footer">
        <div class="strain-stats">
          <div class="strain-stat"><span class="s-val">${expCount}</span><span class="s-lbl">실험 기록</span></div>
          <div class="strain-stat"><span class="s-val">${depCount}</span><span class="s-lbl">기탁</span></div>
          <div class="strain-stat"><span class="s-val">${s.genome?.gcContent ? s.genome.gcContent + '%' : '-'}</span><span class="s-lbl">GC%</span></div>
        </div>
        ${depCount > 0 ? `<div class="deposit-chip">🏛️ ${s.deposit[0].institute} ${s.deposit[0].accession}</div>` : ''}
      </div>
    </div>`;
  }).join('');

  // 카드 클릭 이벤트
  grid.querySelectorAll('.strain-card').forEach(card => {
    card.addEventListener('click', () => openStrainDetail(card.dataset.id));
    card.addEventListener('keydown', e => { if (e.key === 'Enter') openStrainDetail(card.dataset.id); });
  });
}

// ═══════════════════════════════════════════════════
//  균주 상세 페이지
// ═══════════════════════════════════════════════════
function openStrainDetail(id) {
  const strain = StrainDB.getById(id);
  if (!strain) return;
  currentStrainId = id;
  currentTab = 'info';

  const libEl = document.getElementById('strain-library');
  const detailEl = document.getElementById('strain-detail');
  libEl?.classList.add('hidden');
  detailEl?.classList.remove('hidden');

  renderDetailHeader(strain);
  renderDetailTabs(strain);
  switchDetailTab('info', strain);
}

function renderDetailHeader(strain) {
  const st = STATUS_CONFIG[strain.status] || STATUS_CONFIG['보류'];
  const header = document.getElementById('detail-header');
  if (!header) return;
  header.innerHTML = `
    <div class="detail-header-left">
      <button class="btn-back" id="detail-back-btn">← 목록으로</button>
      <div>
        <div class="detail-id">${strain.id}</div>
        <h2 class="detail-strain-name"><em>${strain.taxonomy.genus}</em> ${strain.taxonomy.species} <strong>${strain.taxonomy.strain}</strong></h2>
        <div class="detail-strain-full">${strain.name}</div>
      </div>
    </div>
    <div class="detail-header-right">
      <div class="strain-status-badge large" style="color:${st.color};background:${st.bg}">${st.icon} ${strain.status}</div>
      <button class="btn-secondary sm" id="edit-status-btn">상태 변경</button>
      <button class="btn-danger sm" id="delete-strain-btn">♻️ 삭제</button>
    </div>
  `;
  document.getElementById('detail-back-btn')?.addEventListener('click', closeStrainDetail);
  document.getElementById('delete-strain-btn')?.addEventListener('click', () => {
    if (confirm(`[${strain.id}] ${strain.name} 을 삭제하시겠습니까?`)) {
      StrainDB.delete(strain.id);
      closeStrainDetail();
      renderStrainLibrary();
    }
  });
  document.getElementById('edit-status-btn')?.addEventListener('click', () => openStatusModal(strain));
}

function renderDetailTabs(strain) {
  const tabBar = document.getElementById('detail-tab-bar');
  if (!tabBar) return;
  const tabs = [
    { id: 'info',    label: '🧬 기본 정보' },
    { id: 'dnamap',  label: '🗺️ DNA 지도' },
    { id: 'deposit', label: '🏛️ 기탁 정보' },
    { id: 'exp',     label: `⚗️ 실험 기록 (${strain.experiments?.length || 0})` },
  ];
  tabBar.innerHTML = tabs.map(t =>
    `<button class="detail-tab ${t.id === currentTab ? 'active' : ''}" data-tab="${t.id}">${t.label}</button>`
  ).join('');
  tabBar.querySelectorAll('.detail-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      tabBar.querySelectorAll('.detail-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      switchDetailTab(btn.dataset.tab, StrainDB.getById(currentStrainId));
    });
  });
}

function switchDetailTab(tab, strain) {
  currentTab = tab;
  const content = document.getElementById('detail-content');
  if (!content || !strain) return;

  if (tab === 'info')    content.innerHTML = renderInfoTab(strain);
  if (tab === 'dnamap')  renderDnaMapTab(content, strain);
  if (tab === 'deposit') content.innerHTML = renderDepositTab(strain);
  if (tab === 'exp')     content.innerHTML = renderExpTab(strain);

  if (tab === 'deposit') bindDepositEvents(strain);
  if (tab === 'exp')     bindExpEvents(strain);
}

// ─ 기본 정보 탭 ─
function renderInfoTab(s) {
  const gc = s.genome?.gcContent ? `${s.genome.gcContent}%` : '-';
  const kb = s.genome?.sizeKb ? `${s.genome.sizeKb.toLocaleString()} kb` : '-';
  return `
  <div class="info-grid">
    <div class="info-section">
      <h4>📌 분류학 정보</h4>
      <div class="info-rows">
        <div class="info-row"><span>계통</span><span><em>${s.taxonomy.genus}</em> ${s.taxonomy.species}</span></div>
        <div class="info-row"><span>균주 번호</span><span>${s.taxonomy.strain}</span></div>
        <div class="info-row"><span>Gram 染色</span><span>${s.culture.gram || '-'}</span></div>
        <div class="info-row"><span>형태</span><span>${s.culture.shape || '-'}</span></div>
        <div class="info-row"><span>산소 요구성</span><span>${s.culture.oxygen || '-'}</span></div>
        <div class="info-row"><span>내생포자</span><span>${s.culture.sporulation || '-'}</span></div>
      </div>
    </div>
    <div class="info-section">
      <h4>📍 발견 정보</h4>
      <div class="info-rows">
        <div class="info-row"><span>발견일</span><span>${s.discovery.date || '-'}</span></div>
        <div class="info-row"><span>발견 장소</span><span>${s.discovery.location || '-'}</span></div>
        <div class="info-row"><span>발견자</span><span>${s.discovery.researcher || '-'}</span></div>
        <div class="info-row"><span>등록일</span><span>${s.createdAt?.slice(0,10) || '-'}</span></div>
        <div class="info-row"><span>최종 수정</span><span>${s.updatedAt?.slice(0,10) || '-'}</span></div>
      </div>
    </div>
    <div class="info-section">
      <h4>🌡️ 배양 조건</h4>
      <div class="info-rows">
        <div class="info-row"><span>최적 온도</span><span>${s.culture.temperature || '-'}</span></div>
        <div class="info-row"><span>배지</span><span>${s.culture.medium || '-'}</span></div>
      </div>
    </div>
    <div class="info-section">
      <h4>🧬 게놈 정보</h4>
      <div class="info-rows">
        <div class="info-row"><span>GC 함량</span><span style="color:#00ffc8;font-family:monospace">${gc}</span></div>
        <div class="info-row"><span>게놈 크기</span><span style="color:#00ffc8;font-family:monospace">${kb}</span></div>
      </div>
    </div>
  </div>
  <div class="info-section notes-section">
    <h4>📝 메모 / 특이 사항</h4>
    <div class="notes-box">${s.notes || '<span style="color:#7a87a8">기록된 메모가 없습니다.</span>'}</div>
    <button class="btn-secondary sm mt-1" id="edit-notes-btn">메모 편집</button>
  </div>`;
}

// ─ DNA 지도 탭 ─
function renderDnaMapTab(container, strain) {
  const gc = strain.genome?.gcContent || 50.8;
  const sizeKb = strain.genome?.sizeKb || 4000;

  container.innerHTML = `
  <div class="dna-tab-layout">
    <div class="dna-tab-map">
      <div class="panel-header" style="padding:0.75rem 1rem;border-bottom:1px solid var(--color-border)">
        <span style="font-size:0.875rem;font-weight:600">원형 게놈 지도</span>
        <div style="display:flex;gap:0.5rem">
          <select class="ctrl-select" id="strain-view-select">
            <option value="circular">원형 보기</option>
            <option value="linear">선형 보기</option>
          </select>
          <label class="btn-secondary sm" style="cursor:pointer">
            FASTA 업로드
            <input type="file" id="strain-fasta-input" accept=".fasta,.fastq,.txt" hidden />
          </label>
        </div>
      </div>
      <div class="map-canvas-wrapper" style="height:420px">
        <svg id="strain-dna-svg" style="width:100%;height:100%"></svg>
        <div class="map-tooltip hidden" id="strain-tooltip"></div>
      </div>
      <div id="strain-map-legend" class="map-legend"></div>
    </div>
    <div class="dna-tab-info">
      <div class="genome-stat-cards">
        <div class="genome-stat"><div class="genome-stat-val" style="color:#00ffc8">${gc}%</div><div class="genome-stat-lbl">GC 함량</div></div>
        <div class="genome-stat"><div class="genome-stat-val" style="color:#00ffc8">${(sizeKb/1000).toFixed(1)} Mb</div><div class="genome-stat-lbl">게놈 크기</div></div>
      </div>
      <div class="info-placeholder" id="strain-gene-placeholder">
        <div class="placeholder-icon">👆</div>
        <p>지도의 유전자 블록을<br/>클릭하면 상세 정보가 표시됩니다.</p>
      </div>
      <div class="gene-detail hidden" id="strain-gene-detail"></div>
    </div>
  </div>`;

  // FASTA 업로드 처리
  const fastaInput = document.getElementById('strain-fasta-input');
  fastaInput?.addEventListener('change', async () => {
    const file = fastaInput.files[0];
    if (!file) return;
    const text = await file.text();
    const seqs = parseDNAFile(text);
    const result = analyzeSequences(seqs);
    if (result) {
      strainAnalysisData = result;
      StrainDB.update(currentStrainId, {
        genome: { ...strain.genome, gcContent: parseFloat(result.gcContent), sizeKb: Math.round(result.totalLength / 1000), fastaData: text.slice(0, 10000) }
      });
      drawStrainMap(result);
    }
  });

  // 시뮬레이션 데이터로 지도 그리기
  const simulatedData = buildSimulatedGenome(strain);
  strainAnalysisData = simulatedData;
  setTimeout(() => drawStrainMap(simulatedData), 100);

  document.getElementById('strain-view-select')?.addEventListener('change', (e) => {
    if (strainAnalysisData) drawStrainMap(strainAnalysisData, e.target.value);
  });
}

function buildSimulatedGenome(strain) {
  const sizeKb = strain.genome?.sizeKb || 4000;
  const gc = strain.genome?.gcContent || 50.8;
  const totalLength = sizeKb * 1000;
  const seed = strain.id + strain.name;
  const genes = buildSimulatedGenes(totalLength, seed);
  return {
    totalLength,
    gcContent: gc,
    baseComposition: { A: ((100-gc)/2).toFixed(1), T: ((100-gc)/2).toFixed(1), G: (gc/2).toFixed(1), C: (gc/2).toFixed(1) },
    detectedGenes: genes,
    geneCount: genes.length,
    resistanceGenes: genes.filter(g => g.type === 'antibiotic_resistance').length,
    virulenceGenes: genes.filter(g => g.type === 'virulence').length,
  };
}

function buildSimulatedGenes(totalLen, seed) {
  const { GENE_DATABASE } = window.__bacteriaGeneDB || {};
  if (!GENE_DATABASE) return [];
  const genes = Object.values(GENE_DATABASE);
  const result = [];
  const h = simHash(seed);
  genes.forEach((gene, i) => {
    const nh = simHash(seed + gene.name + i);
    const pos = Math.floor((nh % 1000 / 1000) * totalLen * 0.9) + Math.floor(totalLen * 0.02);
    const gLen = gene.type === 'rrna' ? 4566 : 800 + (nh % 2400);
    const expr = Math.max(0.1, Math.min(0.99, gene.expressionBase + (nh % 20 - 10) / 100));
    result.push({ ...gene, startPos: pos, endPos: Math.min(pos + gLen, totalLen), geneLength: gLen, expressionLevel: expr, expressionLabel: expr > 0.7 ? 'HIGH' : expr > 0.4 ? 'MED' : 'LOW', strand: nh % 2 === 0 ? '+' : '-' });
  });
  return result.sort((a, b) => a.startPos - b.startPos);
}

function simHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h = h & h; }
  return Math.abs(h);
}

function drawStrainMap(data, viewMode = 'circular') {
  const svgEl = document.getElementById('strain-dna-svg');
  const legendEl = document.getElementById('strain-map-legend');
  if (!svgEl) return;

  // gene-select 콜백
  const onGeneSelect = (gene) => {
    const placeholder = document.getElementById('strain-gene-placeholder');
    const detailEl = document.getElementById('strain-gene-detail');
    if (!placeholder || !detailEl) return;
    placeholder.classList.add('hidden');
    detailEl.classList.remove('hidden');
    const color = gene.color || '#00ffc8';
    detailEl.innerHTML = `
      <div class="gene-header">
        <div class="gene-badge" style="background:${color}22;border:2px solid ${color}">🧬</div>
        <div><h3 style="color:${color};font-family:monospace">${gene.name}</h3><span class="gene-type-tag" style="background:${color}22;color:${color}">${gene.fullName}</span></div>
      </div>
      <p class="gene-desc">${gene.description}</p>
      <div class="gene-stats-grid">
        <div class="g-stat"><div class="g-stat-label">시작</div><div class="g-stat-value">${gene.startPos.toLocaleString()}</div></div>
        <div class="g-stat"><div class="g-stat-label">종료</div><div class="g-stat-value">${gene.endPos.toLocaleString()}</div></div>
        <div class="g-stat"><div class="g-stat-label">길이</div><div class="g-stat-value">${gene.geneLength.toLocaleString()} bp</div></div>
        <div class="g-stat"><div class="g-stat-label">발현</div><div class="g-stat-value" style="color:${gene.expressionLevel>0.7?'#39ff8f':gene.expressionLevel>0.4?'#ffe066':'#ff4b6e'}">${gene.expressionLabel}</div></div>
      </div>
      <div class="rna-section" style="margin-top:0.75rem"><h4>RNA 전사</h4><div class="rna-info">${gene.rna}</div></div>`;
  };

  if (viewMode === 'circular') {
    initDNAMap(svgEl, data, onGeneSelect);
  } else {
    import('./dna-map.js').then(m => m.switchToLinear(svgEl, data));
  }

  if (legendEl) {
    import('./dna-map.js').then(m => m.buildLegend(legendEl));
  }
}

// ─ 기탁 정보 탭 ─
function renderDepositTab(strain) {
  const deps = strain.deposit || [];
  return `
  <div class="tab-section">
    <div class="tab-section-header">
      <h4>기탁 기관 현황</h4>
      <button class="btn-primary sm" id="add-deposit-btn">+ 기탁 추가</button>
    </div>
    ${deps.length === 0 ? '<p class="empty-msg">등록된 기탁 정보가 없습니다.</p>' : `
    <div class="deposit-list">
      ${deps.map(d => `
        <div class="deposit-card">
          <div class="deposit-badge">${d.institute}</div>
          <div class="deposit-info">
            <div class="deposit-accession">${d.accession || '-'}</div>
            <div class="deposit-meta">기탁일 ${d.date || '-'} · ${d.type || '기탁'}</div>
            ${d.notes ? `<div class="deposit-notes">${d.notes}</div>` : ''}
          </div>
          <button class="btn-danger tiny" data-dep="${d.id}">삭제</button>
        </div>
      `).join('')}
    </div>`}
  </div>

  <div class="slide-form hidden" id="deposit-form">
    <h4>기탁 정보 추가</h4>
    <div class="form-grid">
      <div class="form-group">
        <label>기탁 기관 *</label>
        <select id="dep-institute">
          ${DEPOSIT_INSTITUTES.map(i => `<option value="${i.key}" ${i.key === 'KCTC' ? 'selected' : ''}>${i.label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>기탁 번호 (수탁번호)</label>
        <input type="text" id="dep-accession" placeholder="예: KCTC 14890BP" />
      </div>
      <div class="form-group">
        <label>기탁일</label>
        <input type="date" id="dep-date" value="${new Date().toISOString().slice(0,10)}" />
      </div>
      <div class="form-group">
        <label>기탁 유형</label>
        <select id="dep-type">
          <option>기탁</option><option>특허 기탁</option><option>보존 기탁</option>
        </select>
      </div>
      <div class="form-group full">
        <label>메모</label>
        <input type="text" id="dep-notes" placeholder="특이 사항 (선택)" />
      </div>
    </div>
    <div class="form-actions">
      <button class="btn-primary" id="dep-save-btn">저장</button>
      <button class="btn-secondary" id="dep-cancel-btn">취소</button>
    </div>
  </div>`;
}

function bindDepositEvents(strain) {
  document.getElementById('add-deposit-btn')?.addEventListener('click', () => {
    document.getElementById('deposit-form')?.classList.remove('hidden');
    document.getElementById('add-deposit-btn').classList.add('hidden');
  });
  document.getElementById('dep-cancel-btn')?.addEventListener('click', () => {
    document.getElementById('deposit-form')?.classList.add('hidden');
    document.getElementById('add-deposit-btn')?.classList.remove('hidden');
  });
  document.getElementById('dep-save-btn')?.addEventListener('click', () => {
    const dep = {
      institute: document.getElementById('dep-institute')?.value,
      accession: document.getElementById('dep-accession')?.value,
      date: document.getElementById('dep-date')?.value,
      type: document.getElementById('dep-type')?.value,
      notes: document.getElementById('dep-notes')?.value,
    };
    const updated = StrainDB.addDeposit(currentStrainId, dep);
    if (updated) {
      switchDetailTab('deposit', updated);
      renderDetailTabs(updated);
      renderDetailHeader(updated);
    }
  });

  document.querySelectorAll('[data-dep]').forEach(btn => {
    btn.addEventListener('click', () => {
      const s = StrainDB.getById(currentStrainId);
      if (!s) return;
      const deposit = s.deposit.filter(d => d.id !== btn.dataset.dep);
      const updated = StrainDB.update(currentStrainId, { deposit });
      if (updated) switchDetailTab('deposit', updated);
    });
  });
}

// ─ 실험 기록 탭 ─
function renderExpTab(strain) {
  const exps = [...(strain.experiments || [])].sort((a, b) => b.date.localeCompare(a.date));
  return `
  <div class="tab-section">
    <div class="tab-section-header">
      <h4>실험 기록 타임라인</h4>
      <button class="btn-primary sm" id="add-exp-btn">+ 실험 기록 추가</button>
    </div>
    ${exps.length === 0 ? '<p class="empty-msg">등록된 실험 기록이 없습니다.</p>' : `
    <div class="exp-timeline">
      ${exps.map(e => {
        const et = EXPERIMENT_TYPES.find(t => t.key === e.type) || EXPERIMENT_TYPES[3];
        const isPositive = e.result?.includes('양성') || e.result?.includes('+');
        const isNegative = e.result?.includes('음성') || e.result?.includes('-');
        const resultColor = isPositive ? '#39ff8f' : isNegative ? '#ff4b6e' : '#ffe066';
        return `
        <div class="exp-item">
          <div class="exp-dot" style="background:${et.color}"></div>
          <div class="exp-card">
            <div class="exp-card-header">
              <div class="exp-type-badge" style="color:${et.color};background:${et.color}22">${et.icon} ${e.type}</div>
              <span class="exp-date">${e.date}</span>
            </div>
            <div class="exp-method" style="color:#7a87a8;font-size:0.78rem">방법: ${e.method || '-'}</div>
            <div class="exp-result">
              <span style="color:${resultColor};font-weight:600">${e.result || '-'}</span>
              ${e.value ? `<span class="exp-value">&nbsp;|&nbsp; ${e.value} ${e.unit || ''}</span>` : ''}
            </div>
            ${e.notes ? `<div class="exp-notes">${e.notes}</div>` : ''}
            <div class="exp-researcher">👤 ${e.researcher || '-'}</div>
          </div>
        </div>`;
      }).join('')}
    </div>`}
  </div>

  <div class="slide-form hidden" id="exp-form">
    <h4>실험 기록 추가</h4>
    <div class="form-grid">
      <div class="form-group">
        <label>실험 유형 *</label>
        <select id="exp-type-select">
          ${EXPERIMENT_TYPES.map(t => `<option value="${t.key}">${t.label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>실험 방법</label>
        <select id="exp-method-select">
          ${EXPERIMENT_TYPES[0].methods.map(m => `<option>${m}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>실험 날짜</label>
        <input type="date" id="exp-date" value="${new Date().toISOString().slice(0,10)}" />
      </div>
      <div class="form-group">
        <label>담당자</label>
        <input type="text" id="exp-researcher" placeholder="담당 연구자명" />
      </div>
      <div class="form-group">
        <label>결과</label>
        <select id="exp-result">
          <option>양성 (+)</option><option>음성 (-)</option><option>약양성 (+/-)</option>
        </select>
      </div>
      <div class="form-group">
        <label>수치 데이터</label>
        <input type="text" id="exp-value" placeholder="예: 18" />
      </div>
      <div class="form-group">
        <label>단위</label>
        <input type="text" id="exp-unit" placeholder="예: mm (억제환)" />
      </div>
      <div class="form-group full">
        <label>메모</label>
        <textarea id="exp-notes" rows="2" placeholder="특이 사항, 비교 설명 등"></textarea>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn-primary" id="exp-save-btn">저장</button>
      <button class="btn-secondary" id="exp-cancel-btn">취소</button>
    </div>
  </div>`;
}

function bindExpEvents(strain) {
  const addBtn = document.getElementById('add-exp-btn');
  const form   = document.getElementById('exp-form');
  const typeSelect   = document.getElementById('exp-type-select');
  const methodSelect = document.getElementById('exp-method-select');

  addBtn?.addEventListener('click', () => { form?.classList.remove('hidden'); addBtn.classList.add('hidden'); });
  document.getElementById('exp-cancel-btn')?.addEventListener('click', () => { form?.classList.add('hidden'); addBtn?.classList.remove('hidden'); });

  typeSelect?.addEventListener('change', () => {
    const et = EXPERIMENT_TYPES.find(t => t.key === typeSelect.value);
    if (et && methodSelect) {
      methodSelect.innerHTML = et.methods.length > 0
        ? et.methods.map(m => `<option>${m}</option>`).join('')
        : '<option>직접 입력</option>';
    }
  });

  document.getElementById('exp-save-btn')?.addEventListener('click', () => {
    const exp = {
      type: document.getElementById('exp-type-select')?.value,
      method: document.getElementById('exp-method-select')?.value,
      date: document.getElementById('exp-date')?.value,
      researcher: document.getElementById('exp-researcher')?.value,
      result: document.getElementById('exp-result')?.value,
      value: document.getElementById('exp-value')?.value,
      unit: document.getElementById('exp-unit')?.value,
      notes: document.getElementById('exp-notes')?.value,
    };
    const updated = StrainDB.addExperiment(currentStrainId, exp);
    if (updated) {
      switchDetailTab('exp', updated);
      renderDetailTabs(updated);
    }
  });
}

// ═══════════════════════════════════════════════════
//  균주 등록 폼
// ═══════════════════════════════════════════════════
function openRegisterForm() {
  const modal = document.getElementById('strain-register-modal');
  modal?.classList.remove('hidden');
}

function closeRegisterForm() {
  const modal = document.getElementById('strain-register-modal');
  modal?.classList.add('hidden');
}

function submitRegisterForm() {
  const data = {
    name: document.getElementById('reg-name')?.value,
    taxonomy: {
      genus:   document.getElementById('reg-genus')?.value,
      species: document.getElementById('reg-species')?.value,
      strain:  document.getElementById('reg-strain-no')?.value,
    },
    discovery: {
      date:       document.getElementById('reg-date')?.value,
      location:   document.getElementById('reg-location')?.value,
      researcher: document.getElementById('reg-researcher')?.value,
    },
    culture: {
      temperature: document.getElementById('reg-temp')?.value,
      medium:      document.getElementById('reg-medium')?.value,
      gram:        document.getElementById('reg-gram')?.value,
      shape:       document.getElementById('reg-shape')?.value,
      oxygen:      document.getElementById('reg-oxygen')?.value,
    },
    genome: { gcContent: parseFloat(document.getElementById('reg-gc')?.value) || null, sizeKb: parseFloat(document.getElementById('reg-size')?.value) || null },
    status: document.getElementById('reg-status')?.value || '분석 중',
    notes: document.getElementById('reg-notes')?.value,
  };
  if (!data.name) { alert('균주명을 입력하세요.'); return; }
  const created = StrainDB.create(data);
  closeRegisterForm();
  renderStrainLibrary();
  // 새 균주 바로 상세 열기
  openStrainDetail(created.id);
}

// ── 상세 닫기 ──
function closeStrainDetail() {
  currentStrainId = null;
  strainAnalysisData = null;
  document.getElementById('strain-library')?.classList.remove('hidden');
  document.getElementById('strain-detail')?.classList.add('hidden');
}

// ── 상태 변경 모달 ──
function openStatusModal(strain) {
  const opts = Object.keys(STATUS_CONFIG);
  const html = `
  <div class="modal-overlay" id="status-modal-overlay" style="z-index:300">
    <div class="modal" style="max-width:360px">
      <h3 style="margin-bottom:1rem;font-size:1rem">상태 변경</h3>
      ${opts.map(s => {
        const st = STATUS_CONFIG[s];
        return `<button class="status-option-btn" data-status="${s}" style="border-color:${s === strain.status ? st.color : 'var(--color-border)'};color:${s === strain.status ? st.color : 'var(--text-secondary)'}">
          ${st.icon} ${s}
        </button>`;
      }).join('')}
      <button class="btn-secondary" id="status-cancel" style="margin-top:1rem;width:100%">취소</button>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  document.getElementById('status-cancel')?.addEventListener('click', () => document.getElementById('status-modal-overlay')?.remove());
  document.querySelectorAll('.status-option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const updated = StrainDB.update(currentStrainId, { status: btn.dataset.status });
      if (updated) renderDetailHeader(updated);
      document.getElementById('status-modal-overlay')?.remove();
    });
  });
}

// ── 이벤트 바인딩 (라이브러리 레벨) ──
function bindStrainEvents() {
  // 검색
  document.getElementById('strain-search')?.addEventListener('input', e => renderStrainLibrary(e.target.value));

  // 새 균주 등록 버튼
  document.getElementById('new-strain-btn')?.addEventListener('click', openRegisterForm);

  // 등록 폼 닫기
  document.getElementById('reg-cancel-btn')?.addEventListener('click', closeRegisterForm);
  document.getElementById('strain-register-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeRegisterForm();
  });

  // 등록 폼 제출
  document.getElementById('reg-submit-btn')?.addEventListener('click', submitRegisterForm);
}

// GENE_DATABASE 글로벌 주입 (dna-map.js가 window에서 참조할 수 있도록)
import { GENE_DATABASE } from './analyzer.js';
window.__bacteriaGeneDB = { GENE_DATABASE };
