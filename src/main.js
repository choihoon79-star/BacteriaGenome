/**
 * DNA Analyzer — Main Application Entry Point
 * 앱 전체 상태 관리 및 섹션 네비게이션
 */

import './style.css';
import { parseDNAFile, analyzeSequences, analyzeSequencesAsync, generateSampleGenome } from './analyzer.js';
import { Inflate } from 'pako';
import { StrainDB } from './strainDB.js';
import {
  initDNAMap, switchToLinear, switchToCircular,
  buildLegend,
  buildBaseCompositionChart, buildGeneTypeChart,
  buildExpressionChart, buildDensityChart,
  renderWholeGenomeMap,
} from './dna-map.js';
import { initStrainSection, refreshStrainLibrary } from './strain-ui.js';
import { initResearchSection, refreshResearchSection } from './research-note.js';

// ─── App State ───
let analysisData = null;
let currentSection = 'upload';
let currentView = 'circular';

// ─── DOM References ───
const uploadZone   = document.getElementById('upload-zone');
const fileInput    = document.getElementById('file-input');
const uploadBtn    = document.getElementById('upload-btn');
const sampleBtn    = document.getElementById('sample-btn');
const progressContainer = document.getElementById('progress-container');
const progressBar  = document.getElementById('progress-bar');
const progressPct  = document.getElementById('progress-pct');
const progressLabel= document.getElementById('progress-label');
const quickStats   = document.getElementById('quick-stats');
const gotoMapContainer = document.getElementById('goto-map-container');
const gotoMapBtn   = document.getElementById('goto-map-btn');

const statusDot  = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');

const navLinks = document.querySelectorAll('.nav-link');
const sections = document.querySelectorAll('.section');

const svgEl     = document.getElementById('dna-map-svg');
const mapLegend  = document.getElementById('map-legend');

const viewModeSelect = document.getElementById('view-mode-select');
const zoomInBtn  = document.getElementById('zoom-in-btn');
const zoomOutBtn = document.getElementById('zoom-out-btn');
const resetBtn   = document.getElementById('reset-btn');

const modalOverlay = document.getElementById('modal-overlay');
const modalClose   = document.getElementById('modal-close');
const modalContent = document.getElementById('modal-content');
const detailPageBtn = document.getElementById('detail-page-btn');

// ─── Navigation ───
function showSection(name) {
  currentSection = name;

  const strainSection = document.getElementById('strains-section');
  const appEl         = document.getElementById('app');

  if (name === 'strains') {
    strainSection?.classList.add('active');
    if (appEl) appEl.style.display = 'none';
    refreshStrainLibrary();
  } else if (name === 'notes') {
    const notesSection = document.getElementById('notes-section');
    notesSection?.classList.add('active');
    if (appEl) appEl.style.display = 'none';
    strainSection?.classList.remove('active');
    refreshResearchSection();
  } else {
    strainSection?.classList.remove('active');
    document.getElementById('notes-section')?.classList.remove('active');
    if (appEl) appEl.style.display = 'block';
    sections.forEach(s => s.classList.remove('active'));
    const targetSection = document.getElementById(`${name}-section`);
    if (targetSection) targetSection.classList.add('active');
  }

  navLinks.forEach(l => l.classList.remove('active'));
  const targetNav = document.getElementById(`nav-${name}`);
  if (targetNav) targetNav.classList.add('active');

  if (name === 'map'      && analysisData) setTimeout(() => renderMap(), 100);
  if (name === 'wholemap' && analysisData) setTimeout(() => renderWholeMap(), 100);
  if (name === 'stats'    && analysisData) renderStats();
}

navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const target = link.id.replace('nav-', '');
    if (target === 'map'      && !analysisData) return;
    if (target === 'wholemap' && !analysisData) return;
    if (target === 'stats'    && !analysisData) return;
    showSection(target);
  });
});

gotoMapBtn?.addEventListener('click', () => showSection('map'));

// ─── 균주 섹션 초기화 ───
initStrainSection();
// ─── 연구노트 섹션 초기화 ───
initResearchSection();
document.getElementById('reg-cancel-btn2')?.addEventListener('click', () => {
  document.getElementById('strain-register-modal')?.classList.add('hidden');
});

// app 영역 초기화 (기존 #app display:none 해제 대신 section 방식으로)
document.getElementById('app').removeAttribute('style');
document.getElementById('app').style.display = 'block';

// ─── Upload Handling ───
uploadZone.addEventListener('click', () => fileInput.click());
uploadBtn.addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });

uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.classList.add('drag-over');
});
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) processFile(file);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) processFile(fileInput.files[0]);
});

sampleBtn.addEventListener('click', () => {
  const sampleText = generateSampleGenome();
  const blob = new Blob([sampleText], { type: 'text/plain' });
  processFile(new File([blob], 'sample_genome.fasta', { type: 'text/plain' }));
});

async function processFile(file) {
  setStatus('processing', '파일 확인 중...');
  progressContainer.classList.remove('hidden');
  quickStats.classList.add('hidden');
  gotoMapContainer.classList.add('hidden');

  const name = file.name.toLowerCase();

  // ── .tar ──
  if (name.endsWith('.tar') || name.endsWith('.tar.gz') || name.endsWith('.tgz')) {
    progressLabel.textContent = '⚠️ tar 아카이브는 직접 업로드가 어렵습니다';
    alert(
      [
        '📦 tar 아카이브 처리 방법',
        '',
        'tar 파일은 여러 파일의 묶음입니다.',
        '다음 명령어로 파일을 먼저 푸세요:',
        '',
        '  tar -xf ' + file.name,
        '',
        '풀네 나온 .fastq 또는 .fasta 파일을 업로드하세요.',
      ].join('\n')
    );
    setStatus('idle', '대기 중');
    progressContainer.classList.add('hidden');
    return;
  }

  // ── .fastq.gz 또는 .fasta.gz ──
  if (name.endsWith('.gz')) {
    try {
      setStatus('processing', '압축 해제 중');
      const text = await decompressGzip(file);
      await runAnalysis(text);
    } catch (err) {
      alert('❌ gzip 압축 해제 실패:\n' + err.message + '\n\n(파일이 손상되었거나 gzip 형식이 아닙니다)');
      setStatus('idle', '대기 중');
      progressContainer.classList.add('hidden');
    }
    return;
  }

  // ── .ab1 (ABI Sanger 크로마토그램) ──
  if (name.endsWith('.ab1') || name.endsWith('.abi')) {
    try {
      progressLabel.textContent = 'ABI Sanger 파일 파싱 중...';
      setStatus('processing', 'Sanger 파싱 중');
      const text = await parseAb1File(file);
      await runAnalysis(text);
    } catch (err) {
      alert('❌ .ab1 파일 파싱 실패:\n' + err.message);
      setStatus('idle', '대기 중');
    }
    return;
  }

  // ── 일반 텍스트 파일 (fasta, fastq, txt 등) ──
  const reader = new FileReader();
  reader.onload = async (e) => {
    await runAnalysis(e.target.result);
  };
  reader.readAsText(file);
}

/**
 * gzip / BGZF 압축 해제
 *
 * BGZF(Block GZIP): Illumina FASTQ.gz, SAM/BAM 등이 사용하는 포맷.
 * 여러 개의 독립적인 gzip 블록이 연결된 구조.
 * 각 블록은 헤더의 BC 서브필드에 블록 크기가 명시됨.
 *
 * 전략:
 *  · BGZF → BC 서브필드로 정확한 블록 경계 파싱 → 블록 단위 inflate
 *  · 일반 gzip → 브라우저 DecompressionStream 스트리밍
 */
async function decompressGzip(file) {
  const fileMB = (file.size / 1048576).toFixed(1);

  // 매직 바이트 + BGZF 여부 확인 (첫 28바이트)
  const sampleBuf = await file.slice(0, 28).arrayBuffer();
  const sample    = new Uint8Array(sampleBuf);

  if (sample[0] !== 0x1f || sample[1] !== 0x8b) {
    throw new Error(`gzip 파일이 아닙니다.\n파일명: ${file.name}`);
  }

  // BC 서브필드 탐색 → BGZF 판별
  function isBGZFHeader(b) {
    if (!(b[3] & 0x04)) return false; // FEXTRA 플래그 없음
    const xlen = b[10] | (b[11] << 8);
    for (let x = 12; x + 4 <= 12 + xlen; ) {
      if (b[x] === 0x42 && b[x + 1] === 0x43) return true; // BC
      x += 4 + (b[x + 2] | (b[x + 3] << 8));
    }
    return false;
  }

  const isBGZF = isBGZFHeader(sample);
  console.log(`[OBJETBIO] 파일 포맷: ${isBGZF ? 'BGZF' : '표준 gzip'}`);

  // ── 경과 시간 타이머 ──
  let elapsedSec = 0;
  const elapsedTimer = setInterval(() => {
    elapsedSec++;
    const base = progressLabel.textContent.replace(/\s*│\s*⏱️.*$/, '');
    progressLabel.textContent = `${base}  │  ⏱️ ${elapsedSec}초 경과`;
  }, 1000);

  try {
    setStep('step-read', 'active');
    setStep('step-decompress', 'active');
    progressBar.style.width = '5%';
    progressPct.textContent = '5%';
    progressLabel.textContent = `📦 ${isBGZF ? 'BGZF' : 'gzip'} 압축 해제 중... (${fileMB} MB)`;

    const MAX_TEXT  = 80 * 1024 * 1024; // 80MB 텍스트 제한
    const decoder   = new TextDecoder();
    let textResult  = '';
    let truncated   = false;

    // ════════════════════════════════════════════════════
    // BGZF: 블록 헤더에서 정확한 블록 크기 파싱 후 inflate
    // ════════════════════════════════════════════════════
    if (isBGZF) {
      const { inflate } = await import('pako');
      const READ_SIZE   = 8 * 1024 * 1024; // 8MB 씩 읽기
      let filePos       = 0;
      let carry         = new Uint8Array(0); // 블록 걸쳐 남은 바이트

      while (filePos < file.size && !truncated) {
        // 파일에서 8MB 청크 읽기
        const toRead  = Math.min(READ_SIZE, file.size - filePos);
        const newData = new Uint8Array(await file.slice(filePos, filePos + toRead).arrayBuffer());
        filePos += newData.length;

        // 이전 carry와 합치기
        let buf;
        if (carry.length > 0) {
          buf = new Uint8Array(carry.length + newData.length);
          buf.set(carry);
          buf.set(newData, carry.length);
        } else {
          buf = newData;
        }

        let bPos = 0;
        while (bPos < buf.length && !truncated) {
          // gzip 매직 확인
          if (bPos + 18 > buf.length) { carry = buf.slice(bPos); bPos = buf.length; break; }
          if (buf[bPos] !== 0x1f || buf[bPos + 1] !== 0x8b) { carry = new Uint8Array(0); break; }

          // BC 서브필드에서 블록 크기 읽기
          let blockSize = null;
          if (buf[bPos + 3] & 0x04) {
            const xlen = buf[bPos + 10] | (buf[bPos + 11] << 8);
            for (let x = bPos + 12; x + 5 < bPos + 12 + xlen; ) {
              if (buf[x] === 0x42 && buf[x + 1] === 0x43) {
                blockSize = (buf[x + 4] | (buf[x + 5] << 8)) + 1;
                break;
              }
              x += 4 + (buf[x + 2] | (buf[x + 3] << 8));
            }
          }

          if (blockSize === null) { carry = new Uint8Array(0); break; } // BGZF 아님
          if (bPos + blockSize > buf.length) { carry = buf.slice(bPos); bPos = buf.length; break; }

          // 블록 inflate
          try {
            const block  = buf.slice(bPos, bPos + blockSize);
            const result = inflate(block);
            if (result.length > 0) textResult += decoder.decode(result);
          } catch (e) {
            console.warn('[BGZF] 블록 오류 (건너뜀):', e.message);
          }

          bPos += blockSize;
          if (textResult.length >= MAX_TEXT) { truncated = true; textResult = textResult.slice(0, MAX_TEXT); }
        }

        if (bPos >= buf.length) carry = new Uint8Array(0);

        // UI 업데이트
        const pct = Math.min(5 + Math.round((filePos / file.size) * 55), 60);
        progressBar.style.width = pct + '%';
        progressPct.textContent = pct + '%';
        progressLabel.textContent = `📦 BGZF 해제 중 — ${(filePos/1048576).toFixed(0)} / ${fileMB} MB`;
        await new Promise(r => requestAnimationFrame(r));
      }

    // ════════════════════════════════════════════════════
    // 표준 gzip: DecompressionStream 스트리밍
    // ════════════════════════════════════════════════════
    } else {
      const decompStream = file.stream().pipeThrough(new DecompressionStream('gzip'));
      const reader       = decompStream.getReader();
      let   chunkCount   = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textResult += decoder.decode(value, { stream: !done });
        chunkCount++;
        if (textResult.length >= MAX_TEXT) {
          truncated = true;
          try { await reader.cancel(); } catch (_) {}
          break;
        }
        if (chunkCount % 20 === 0) {
          const pct = Math.min(5 + Math.round((textResult.length / MAX_TEXT) * 55), 60);
          progressBar.style.width = pct + '%';
          progressPct.textContent = pct + '%';
          progressLabel.textContent = `📦 gzip 해제 중 — ${(textResult.length/1048576).toFixed(0)} MB`;
          await new Promise(r => requestAnimationFrame(r));
        }
      }
      if (!truncated) textResult += decoder.decode();
    }

    if (textResult.length === 0) {
      throw new Error('압축 해제된 텍스트가 비어 있습니다.\n파일이 손상되었거나 FASTQ/FASTA 형식이 아닐 수 있습니다.');
    }

    setStep('step-read', 'complete');
    setStep('step-decompress', 'complete');

    const decompMB = (textResult.length / 1048576).toFixed(1);
    progressLabel.textContent = truncated
      ? `⚠️ 대용량 — 앞부분 80MB 텍스트만 분석합니다 (원본: ${fileMB} MB gz)`
      : `✅ 압축 해제 완료 — ${decompMB} MB`;

    console.log(`[OBJETBIO] 압축 해제 완료 | ${decompMB}MB | truncated: ${truncated}`);
    return textResult;

  } finally {
    clearInterval(elapsedTimer);
  }
}




/** 초를 \"Xm Ys\" 또는 \"Xs\" 형식으로 변환 */
function formatETA(sec) {
  if (!isFinite(sec) || sec <= 0) return '계산 중...';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}

/** ABI .ab1 바이너리 파싱 — PBAS 태그에서 염기서열 추출 */
async function parseAb1File(file) {
  const buf  = await file.arrayBuffer();
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);

  // 매직 수 'ABIF' 확인
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (magic !== 'ABIF') throw new Error('유효한 .ab1 파일이 아닙니다 (ABIF magic 불일치)');

  // 디렉토리 위치와 항목 수
  const dirOffset = view.getInt32(26, false);
  const numEntries = view.getInt32(18, false);

  let baseCalls  = '';
  let seqId      = file.name.replace('.ab1', '').replace('.abi', '');

  for (let i = 0; i < numEntries; i++) {
    const entryOffset = dirOffset + i * 28;
    if (entryOffset + 28 > buf.byteLength) break;

    const tag  = String.fromCharCode(
      bytes[entryOffset], bytes[entryOffset+1],
      bytes[entryOffset+2], bytes[entryOffset+3]
    );
    const tagNum    = view.getInt32(entryOffset + 4,  false);
    const type      = view.getInt16(entryOffset + 8,  false);
    const elemSize  = view.getInt16(entryOffset + 10, false);
    const numElems  = view.getInt32(entryOffset + 12, false);
    const dataSize  = view.getInt32(entryOffset + 16, false);
    const dataOffset= view.getInt32(entryOffset + 20, false);

    // PBAS 1 = 염기호 (base calls)
    if (tag === 'PBAS' && tagNum === 1) {
      const start = dataSize <= 4 ? entryOffset + 20 : dataOffset;
      baseCalls = String.fromCharCode(...bytes.slice(start, start + numElems))
        .toUpperCase().replace(/[^ACGTN]/g, 'N');
    }

    // SMPL 1 = 샘플 ID
    if (tag === 'SMPL' && tagNum === 1 && dataSize > 4) {
      try {
        const len = bytes[dataOffset];
        seqId = String.fromCharCode(...bytes.slice(dataOffset + 1, dataOffset + 1 + len));
      } catch {}
    }
  }

  if (baseCalls.length === 0) throw new Error('.ab1 파일에서 염기서열을 찾지 못했습니다.');

  // FASTA 형식으로 변환하여 분석 엔진에 전달
  const fasta = `>${seqId} [format=ABI-Sanger] [len=${baseCalls.length}]\n${baseCalls}`;
  return fasta;
}

/** 텍스트 로드 이후 공통 분석 로직 */
async function runAnalysis(text) {
  try {
    console.log('[OBJETBIO] runAnalysis 시작 | 텍스트 길이:', text.length);
    setStatus('processing', '분석 중');
    resetSteps();

    // 컨테이너 초기화 (gz 이후에도 항상 보이도록)
    progressContainer.classList.remove('hidden');
    quickStats.classList.add('hidden');
    gotoMapContainer.classList.add('hidden');
    progressBar.style.width = '2%';
    progressPct.textContent = '2%';
    progressLabel.style.color = '';
    progressLabel.textContent = '🔬 서열 파싱 준비 중...';
    setStep('step-parse', 'active');

    // 렌더링 보장 (requestAnimationFrame 2회)
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    // ─ 1단계: 서열 파싱 ─
    const sequences = await parseDNAFileAsync(text, (pct, info) => {
      progressBar.style.width = Math.round(2 + pct * 43) + '%';
      progressPct.textContent = Math.round(2 + pct * 43) + '%';
      progressLabel.textContent = `🔬 ${info}`;
    });

    console.log('[OBJETBIO] 파싱 완료 | 서열 수:', sequences.length);

    if (sequences.length === 0) {
      throw new Error(
        'DNA 서열을 찾지 못했습니다.\n\n' +
        '• FASTA: ">" 로 시작하는 헤더가 있는지 확인\n' +
        '• FASTQ: "@" 로 시작하는 헤더가 있는지 확인\n' +
        '• .ab1 파일은 직접 업로드 지원'
      );
    }

    setStep('step-parse', 'complete');
    setStep('step-analyze', 'active');
    progressBar.style.width = '50%';
    progressPct.textContent = '50%';
    progressLabel.textContent = `🧬 유전자 분석 중... (서열 ${sequences.length.toLocaleString()}개)`;
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    // ─ 2단계: 유전자 분석 ─
    const result = await analyzeSequencesAsync(sequences, (pct, info) => {
      progressBar.style.width = Math.round(50 + pct * 25) + '%';
      progressPct.textContent = Math.round(50 + pct * 25) + '%';
      progressLabel.textContent = `🧬 ${info}`;
    });

    if (!result) {
      throw new Error('분석 결과가 없습니다. 서열 길이가 너무 짧을 수 있습니다.');
    }

    console.log('[OBJETBIO] 분석 완료 | 유전자:', result.geneCount, '| GC:', result.gcContent + '%');
    setStep('step-analyze', 'complete');
    setStep('step-map', 'active');

    progressBar.style.width = '80%';
    progressPct.textContent = '80%';
    progressLabel.textContent = '🗺️ DNA 지도 생성 중...';
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    // ─ 3단계: UI 표시 ─
    const uploadMeta = getUploadMeta();
    analysisData = {
      ...result,
      customName:       uploadMeta.customName  || result.estimatedOrganism || result.firstSeqId || '',
      researcherName:   uploadMeta.researcher  || '',
      collectionPlace:  uploadMeta.location    || '',
    };
    displayQuickStats(analysisData);

    // ── 균주 DB 자동 등록 ──
    autoRegisterStrain(analysisData);

    progressBar.style.width = '100%';
    progressPct.textContent = '100%';
    progressLabel.textContent = '✅ 분석 완료!';
    setStep('step-map', 'complete');
    setStatus('done', '분석 완료');

    // ─── [Bakta API] 실제 정밀 분석 시작 (비동기) ───
    if (sequences.length > 0) {
      startBaktaAnalysis(text, uploadMeta.customName);
    }

    setTimeout(() => {
      progressContainer.classList.add('hidden');
      resetSteps();
      quickStats.classList.remove('hidden');
      gotoMapContainer.classList.remove('hidden');
      document.getElementById('nav-map').style.opacity = '1';
      document.getElementById('nav-stats').style.opacity = '1';
      buildLegend(mapLegend);
      console.log('[OBJETBIO] UI 표시 완료');
    }, 1200);

  } catch (err) {
    console.error('[OBJETBIO] 오류:', err);
    setStatus('idle', '오류');
    progressBar.style.width = '100%';
    progressBar.style.background = '#ef4444';
    progressLabel.style.color = '#ef4444';
    progressLabel.textContent = `❌ ${err.message.split('\n')[0]}`;
  }
}

/**
 * Bakta API 백엔드 연동 및 정밀 분석 실행 (비동기 폴링)
 */
async function startBaktaAnalysis(fastaText, strainName) {
  const BACKEND_URL = 'http://localhost:8000';
  const statusEl = document.getElementById('status-text');
  
  // UI 상태 초기화: 분석 중
  updateBaktaStatusUI('loading', 'Bakta 정밀 분석 중...');
  
  try {
    console.log('[BAKTA] 정밀 분석 요청 시작...');
    if (statusEl) statusEl.textContent = 'Bakta 분석 제출 중...';

    // 1. FASTA 업로드
    const formData = new FormData();
    const blob = new Blob([fastaText], { type: 'text/plain' });
    formData.append('file', blob, 'genome.fasta');
    if (strainName) formData.append('strain_name', strainName);

    const upResp = await fetch(`${BACKEND_URL}/upload`, {
      method: 'POST',
      body: formData
    });

    if (!upResp.ok) throw new Error('백엔드 서버 미응답');
    const { job_id } = await upResp.json();
    console.log('[BAKTA] Job ID:', job_id);

    // 2. 폴링 (30초 간격)
    let isDone = false;
    let pollCount = 0;
    
    while (!isDone && pollCount < 60) { // 최대 30분
      await new Promise(r => setTimeout(r, 30000));
      pollCount++;
      
      const stResp = await fetch(`${BACKEND_URL}/status/${job_id}`);
      if (!stResp.ok) continue;
      
      const { status } = await stResp.json();
      console.log(`[BAKTA] 상태 체크 (${pollCount}):`, status);
      
      const timeStr = `${Math.floor(pollCount * 0.5)}분 ${pollCount % 2 === 0 ? '00' : '30'}초`;
      updateBaktaStatusUI('loading', `Bakta 분석 중 (${timeStr})`);
      if (statusEl) statusEl.textContent = `Bakta 정밀 분석 중... (${timeStr})`;

      if (status === 'SUCCESSFUL') {
        isDone = true;
      } else if (status === 'ERROR') {
        throw new Error('Bakta 분석 오류 발생');
      }
    }

    if (!isDone) throw new Error('Bakta 분석 시간 초과');

    // 3. 결과 수신
    updateBaktaStatusUI('loading', '결과 반영 중...');
    if (statusEl) statusEl.textContent = 'Bakta 결과 반영 중...';
    const resResp = await fetch(`${BACKEND_URL}/result/${job_id}`);
    const baktaData = await resResp.json();

    console.log('[BAKTA] 분석 완료! 실제 유전자 데이터 반영');
    
    // 4. 데이터 교체 및 UI 갱신
    if (analysisData) {
      analysisData.detectedGenes = baktaData.detectedGenes;
      analysisData.geneCount = baktaData.geneCount;
      analysisData.resistanceGenes = baktaData.resistanceGenes;
      analysisData.virulenceGenes = baktaData.virulenceGenes;
      
      // 퀵 스탯 갱신
      displayQuickStats(analysisData);
      
      // UI 상태: 성공
      updateBaktaStatusUI('success', 'BAKTA 정밀 분석 완료');
      
      // 실행 중인 맵 리프레시
      if (currentSection === 'map' || currentSection === 'wholemap') {
        renderMap();
        renderWholeMap();
      }
      
      if (statusEl) {
        statusEl.textContent = 'Bakta 정밀 분석 완료';
        setTimeout(() => { if (statusEl.textContent === 'Bakta 정밀 분석 완료') statusEl.textContent = '분석 완료'; }, 3000);
      }
    }

  } catch (err) {
    console.warn('[BAKTA] 정밀 분석 실패 (로컬 데이터 유지):', err.message);
    updateBaktaStatusUI('error', 'Bakta 서버 연결 실패');
    if (statusEl && statusEl.textContent.includes('Bakta')) {
      statusEl.textContent = '분석 완료 (로컬)';
    }
  }
}

/**
 * 전역 Bakta 상태 UI 업데이트 함수
 * @param {string} state - 'loading' | 'success' | 'error' | 'idle'
 * @param {string} text - 표시할 문구
 */
function updateBaktaStatusUI(state, text) {
  const ids = ['bakta-status-badge-main', 'bakta-status-badge-map', 'bakta-status-badge-wm'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    
    // 클래스 초기화
    el.classList.remove('loading', 'success', 'error');
    if (state !== 'idle') el.classList.add(state);
    
    const textEl = el.querySelector('.bakta-status-text');
    if (textEl) textEl.textContent = text;
  });
}

/**
 * parseDNAFile 비동기 버전 — split() 없이 직접 스캔
 * 1,000줄마다 렌더링 양보 (소파일도 진행 확인 가능)
 */
async function parseDNAFileAsync(text, onProgress) {
  const MAX_READS = 50000;
  const MAX_LINES = 400000;
  const sequences = [];
  let currentSeq  = null;
  let lineCount   = 0;
  let pos         = 0;
  const totalLen  = text.length;
  const YIELD_EVERY = 1000; // 1000줄마다 렌더링 양보

  while (pos < totalLen && lineCount < MAX_LINES && sequences.length < MAX_READS) {
    let nextPos = text.indexOf('\n', pos);
    if (nextPos === -1) nextPos = totalLen;

    const line = text.substring(pos, nextPos).trim();
    pos = nextPos + 1;
    lineCount++;

    if (lineCount % YIELD_EVERY === 0) {
      onProgress(Math.min(pos / totalLen, 0.99),
        `${lineCount.toLocaleString()}줄 처리 중 — 서열 ${sequences.length}개 발견`);
      await new Promise(r => setTimeout(r, 0));
    }

    if (!line) continue;

    if (line.startsWith('>')) {
      if (currentSeq && currentSeq.sequence.length > 0) sequences.push(currentSeq);
      currentSeq = { id: line.slice(1).split(' ')[0], description: line.slice(1), sequence: '' };
    } else if (line.startsWith('@')) {
      if (currentSeq && currentSeq.sequence.length > 0) sequences.push(currentSeq);
      currentSeq = { id: line.slice(1), description: line.slice(1), sequence: '' };
    } else if (line.startsWith('ORIGIN')) {
      currentSeq = currentSeq || { id: 'GenBank', description: 'GenBank Sequence', sequence: '' };
    } else if (line === '+') {
      // FASTQ 품질 구분선 → 다음 줄(품질 데이터) 건너뜀
      if (currentSeq && currentSeq.sequence.length > 0) sequences.push(currentSeq);
      currentSeq = null;
      const qNext = text.indexOf('\n', pos);
      pos = (qNext === -1) ? totalLen : qNext + 1;
      lineCount++;
    } else if (currentSeq && /^[ACGTNRYSWKMBDHVacgtnryswkmbdhv\s\d]+$/i.test(line)) {
      const cleaned = line.replace(/[\s\d]/g, '').toUpperCase();
      if (cleaned.length > 0) currentSeq.sequence += cleaned;
    }
  }

  if (currentSeq && currentSeq.sequence.length > 0) sequences.push(currentSeq);
  onProgress(1, `파싱 완료 — ${sequences.length.toLocaleString()}개 서열`);
  return sequences;
}


/** 이벤트 루프에 한 번 양보 */
function tick() { return new Promise(r => setTimeout(r, 0)); }

/** 단계 상태 변경 */
function setStep(id, state) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('active', 'complete', 'error');
  if (state) el.classList.add(state);
}

/** 모든 단계 초기화 */
function resetSteps() {
  ['step-read','step-decompress','step-parse','step-analyze','step-map']
    .forEach(id => setStep(id, ''));
}


function displayQuickStats(data) {
  document.getElementById('stat-length-val').textContent = (data.totalLength / 1000).toFixed(0) + ' kb';
  document.getElementById('stat-gc-val').textContent     = data.gcContent + '%';
  document.getElementById('stat-genes-val').textContent  = data.estimatedORFs.toLocaleString();
  const riskEl = document.getElementById('stat-risk-val');
  riskEl.textContent = data.resistanceGenes + '개';
  riskEl.style.color = data.resistanceGenes > 2 ? '#ff4b6e' : data.resistanceGenes > 0 ? '#ffe066' : '#39ff8f';

  // 추정 종(species) 배지 표시 (있을 경우)
  const subtitle = document.querySelector('.section-subtitle');
  if (subtitle && data.estimatedOrganism) {
    subtitle.innerHTML = `FASTA, FASTQ, GenBank 형식의 박테리아 로우데이터를 업로드하여<br/>인터랙티브 DNA 지도와 항생제 내성·독성 인자 정보를 확인하세요.\n<span style="color:#00ffc8;font-size:0.8rem;font-family:monospace">추정 분류군: ${data.estimatedOrganism}</span>`;
  }
}

/**
 * 분석 완료 후 균주 DB에 자동 등록
 * 구쇀 FASTA ID가 이미 등록된 균주와 같으면 게놈 정보만 업데이트습니다.
 */
function autoRegisterStrain(result) {
  try {
    const meta     = getUploadMeta();          // 업로드 폼 입력값
    const organism = result.estimatedOrganism || 'Unknown Organism';
    const seqId    = result.firstSeqId || '';

    // seqId가 같은 기존 균주 → 게놈 정보만 업데이트
    const all      = StrainDB.getAll();
    const existing = all.find(s => s.genome?.seqId === seqId && seqId);

    const genomeData = {
      gcContent: parseFloat(result.gcContent),
      sizeKb:    Math.round(result.totalLength / 1000),
      seqId,
      geneCount:       result.geneCount || 0,
      resistanceGenes: result.resistanceGenes || 0,
      virulenceGenes:  result.virulenceGenes  || 0,
      analyzedAt: new Date().toISOString(),
    };

    if (existing) {
      const upd = { genome: { ...existing.genome, ...genomeData } };
      if (meta.researcher) upd.discovery = { ...existing.discovery, researcher: meta.researcher };
      if (meta.location)   upd.discovery = { ...(upd.discovery || existing.discovery), location: meta.location };
      StrainDB.update(existing.id, upd);
      console.log(`[OBJETBIO] 기존 균주 게놈 업데이트: ${existing.id}`);
      return;
    }

    // 사용자 입력명 우선, 없으면 auto 감지명
    const displayName = meta.customName || (seqId ? `${seqId} (${organism.split(' (')[0]})` : organism.split(' (')[0]);
    const parts       = organism.replace(/ \(.*\)/, '').split(' ');
    const genus       = parts[0] || 'Unknown';
    const species     = parts.slice(1).join(' ') || 'sp.';

    const newStrain = StrainDB.create({
      name:     displayName,
      taxonomy: { genus, species, strain: seqId || 'AUTO' },
      discovery: {
        date:       new Date().toISOString().slice(0, 10),
        researcher: meta.researcher || 'DNA Analyzer',
        location:   meta.location   || '',
      },
      culture:  {},
      genome:   genomeData,
      status:   '분석 완료',
      notes:    `파일 분석 자동 등록\nGC: ${result.gcContent}% | 게놈: ${(result.totalLength/1000).toFixed(0)} kb | 내성유전자: ${result.resistanceGenes}`,
    });

    console.log(`[OBJETBIO] 균주 DB 자동 등록 | id: ${newStrain.id} | ${displayName}`);

    // 균주 관리 섹션이 현재 보이면 목록 새로고침
    const strainSection = document.getElementById('strains-section');
    if (strainSection?.classList.contains('active')) {
      import('./strain-ui.js').then(m => m.refreshStrainLibrary?.());
    }
  } catch (err) {
    console.warn('[OBJETBIO] 균주 자동 등록 실패 (무시):', err.message);
  }
}

// ─── DNA Map ───
function renderMap() {
  if (!analysisData) return;
  const infoPlaceholder = document.getElementById('info-placeholder');
  const geneDetail      = document.getElementById('gene-detail');
  if (infoPlaceholder) infoPlaceholder.classList.remove('hidden');
  if (geneDetail)      geneDetail.classList.add('hidden');

  if (currentView === 'circular') {
    initDNAMap(svgEl, analysisData, onGeneSelect);
  } else {
    switchToLinear(svgEl, analysisData);
    setTimeout(() => initLinearClickHandlers(), 100);
  }
}

function initLinearClickHandlers() {
  // Linear mode uses same SVG event delegation via dna-map.js
  import('./dna-map.js').then(m => {
    m.switchToLinear(svgEl, analysisData);
  });
}

viewModeSelect?.addEventListener('change', () => {
  currentView = viewModeSelect.value;
  renderMap();
});

// ─── Whole Genome Map ───

/** 업로드 폼에서 균주 메타정보를 읽어옴 */
function getUploadMeta() {
  return {
    customName:  document.getElementById('meta-strain-name')?.value?.trim() || '',
    researcher:  document.getElementById('meta-researcher')?.value?.trim() || '',
    location:    document.getElementById('meta-location')?.value?.trim()    || '',
  };
}

function renderWholeMap() {
  if (!analysisData) return;
  const wmSvg = document.getElementById('wholemap-svg');
  if (!wmSvg) return;

  // 오른쪽 통계 패널 업데이트
  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('wm-size',   (analysisData.totalLength / 1000).toFixed(0) + ' kb');
  setEl('wm-gc',     analysisData.gcContent + '%');
  setEl('wm-cds',    analysisData.geneCount || analysisData.detectedGenes?.length || '-');
  setEl('wm-resist', analysisData.resistanceGenes ?? '-');
  const orgLabel = document.getElementById('wm-organism-label');
  if (orgLabel) orgLabel.textContent = analysisData.estimatedOrganism || analysisData.firstSeqId || '';

  renderWholeGenomeMap(wmSvg, analysisData);

  // ── 버튼 이벤트는 한 번만 등록 ──
  if (wmSvg.__wmBound) return;
  wmSvg.__wmBound = true;

  document.getElementById('wm-zoom-in')?.addEventListener('click', () => {
    wmSvg.dispatchEvent(new WheelEvent('wheel', { deltaY: -300, bubbles: true }));
  });
  document.getElementById('wm-zoom-out')?.addEventListener('click', () => {
    wmSvg.dispatchEvent(new WheelEvent('wheel', { deltaY: 300, bubbles: true }));
  });
  document.getElementById('wm-reset')?.addEventListener('click', () => {
    if (wmSvg.__wmReset) wmSvg.__wmReset();
  });

  // ── SVG 다운로드 ──
  document.getElementById('wm-export-svg')?.addEventListener('click', () => {
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(wmSvg);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'wholemap.svg';
    a.click();
  });

  // ── PNG / JPG 다운로드 공통 함수 ──
  function exportSvgAsImage(format) {
    const serializer = new XMLSerializer();
    const svgStr     = serializer.serializeToString(wmSvg);
    const w = wmSvg.clientWidth  || 800;
    const h = wmSvg.clientHeight || 700;

    const canvas  = document.createElement('canvas');
    canvas.width  = w * 2;   // 2× 해상도
    canvas.height = h * 2;
    const ctx = canvas.getContext('2d');

    // 흰 배경 (JPG는 배경이 필요)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(2, 2);

    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const img  = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
      canvas.toBlob(b => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = `wholemap.${format}`;
        a.click();
      }, mimeType, 0.95);
    };
    img.src = url;
  }

  document.getElementById('wm-export-png')?.addEventListener('click', () => exportSvgAsImage('png'));
  document.getElementById('wm-export-jpg')?.addEventListener('click', () => exportSvgAsImage('jpg'));
}


zoomInBtn?.addEventListener('click', () => {
  const transform = new DOMMatrix(svgEl.getAttribute('transform') || '');
  svgEl.style.transform = '';
  // Implemented via D3 zoom — proxy events
  const event = new WheelEvent('wheel', { deltaY: -300, bubbles: true });
  svgEl.dispatchEvent(event);
});

resetBtn?.addEventListener('click', () => {
  const svg = document.getElementById('dna-map-svg');
  if (svg.__resetZoom) svg.__resetZoom();
});

// ─── Gene Info Panel ───
const expressionColors = {
  HIGH: '#39ff8f',
  MED:  '#ffe066',
  LOW:  '#ff4b6e',
};

const typeEmojis = {
  essential:             '🟢',  // 필수 유전자
  antibiotic_resistance: '🚨',  // 항생제 내성
  virulence:             '⚠️',  // 독성 인자
  metabolism:            '⚙️',  // 대사 유전자
  rrna:                  '🔬',  // rRNA 오페론
  mobile_element:        '🧬',  // 이동성 인자
};

function onGeneSelect(gene) {
  // 메인 DNA 지도 섹션의 패널 요소 (live 참조)
  const infoPlaceholder = document.getElementById('info-placeholder');
  const geneDetail      = document.getElementById('gene-detail');
  if (!infoPlaceholder || !geneDetail) {
    console.warn('[OBJETBIO] gene panel elements not found in DOM');
    return;
  }
  infoPlaceholder.classList.add('hidden');
  geneDetail.classList.remove('hidden');

  const color = gene.color || '#00ffc8';

  const badge = document.getElementById('gene-badge');
  if (badge) {
    badge.style.background = color + '22';
    badge.style.border = `2px solid ${color}`;
    badge.textContent = typeEmojis[gene.type] || '🧬';
  }

  const nameEl = document.getElementById('gene-name');
  if (nameEl) { nameEl.textContent = gene.name; nameEl.style.color = color; }

  const typeTag = document.getElementById('gene-type');
  if (typeTag) {
    typeTag.textContent = gene.fullName || gene.type;
    typeTag.style.background = color + '22';
    typeTag.style.color = color;
  }

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('gene-desc',       gene.description || '-');
  setEl('gene-start',      gene.startPos?.toLocaleString() || '-');
  setEl('gene-end',        gene.endPos?.toLocaleString()   || '-');
  setEl('gene-length',     gene.geneLength?.toLocaleString() + ' bp' || '-');
  setEl('rna-info',        gene.rna || '-');

  const exprEl = document.getElementById('gene-expression');
  if (exprEl) {
    exprEl.textContent  = gene.expressionLabel || '-';
    exprEl.style.color  = expressionColors[gene.expressionLabel] || '#fff';
  }

  const exprPct = Math.round((gene.expressionLevel || 0) * 100);
  setEl('expr-pct', exprPct + '%');
  const fill = document.getElementById('expr-bar-fill');
  if (fill) {
    fill.style.width = '0%';
    fill.style.background = `linear-gradient(90deg, ${color}, ${color}88)`;
    setTimeout(() => fill.style.width = exprPct + '%', 50);
  }

  const orgInfoEl = document.getElementById('organism-info');
  if (orgInfoEl) orgInfoEl.textContent = gene.organism || '-';

  const detailPageBtn = document.getElementById('detail-page-btn');
  if (detailPageBtn) detailPageBtn.onclick = () => openGeneModal(gene);

  console.log(`[OBJETBIO] 유전자 클릭: ${gene.name} | 발현: ${gene.expressionLabel}`);
}

// ─── Gene Modal ───
function openGeneModal(gene) {
  const color = gene.color || '#00ffc8';
  modalContent.innerHTML = `
    <div class="modal-gene-title" style="color:${color}">${gene.name}</div>
    <div class="modal-gene-subtitle">${gene.fullName} | ${typeEmojis[gene.type]} ${gene.type.replace('_', ' ')}</div>

    <div class="modal-section">
      <h4>기본 정보</h4>
      <div class="modal-grid">
        <div class="modal-stat">
          <div class="modal-stat-label">염색체</div>
          <div class="modal-stat-value" style="color:${color}">Chr ${gene.chromosome}</div>
        </div>
        <div class="modal-stat">
          <div class="modal-stat-label">방향</div>
          <div class="modal-stat-value">${gene.strand === '+' ? '정방향 (5′→3′)' : '역방향 (3′→5′)'}</div>
        </div>
        <div class="modal-stat">
          <div class="modal-stat-label">시작 위치</div>
          <div class="modal-stat-value">${gene.startPos.toLocaleString()} bp</div>
        </div>
        <div class="modal-stat">
          <div class="modal-stat-label">유전자 길이</div>
          <div class="modal-stat-value">${gene.geneLength.toLocaleString()} bp</div>
        </div>
        <div class="modal-stat">
          <div class="modal-stat-label">발현 수준</div>
          <div class="modal-stat-value" style="color:${expressionColors[gene.expressionLabel]}">${Math.round(gene.expressionLevel * 100)}% (${gene.expressionLabel})</div>
        </div>
        <div class="modal-stat">
          <div class="modal-stat-label">유전자 유형</div>
          <div class="modal-stat-value">${gene.type.replace(/_/g,' ')}</div>
        </div>
      </div>
    </div>

    <div class="modal-section">
      <h4>유전자 기능</h4>
      <ul class="function-list">
        ${gene.functions.map(f => `<li>${f}</li>`).join('')}
      </ul>
    </div>

    <div class="modal-section">
      <h4>RNA 전사 과정</h4>
      <div class="rna-info">${gene.rna}</div>
    </div>

    <div class="modal-section">
      <h4>유전자 상세 설명</h4>
      <p style="font-size:0.875rem;color:#7a87a8;line-height:1.8">${gene.description}</p>
    </div>

    <div class="modal-section">
      <h4>샘플 서열 (5′ 말단)</h4>
      <div class="sequence-display" id="modal-seq-display">서열 생성 중...</div>
    </div>
  `;

  modalOverlay.classList.remove('hidden');

  // Generate synthetic sequence snippet
  setTimeout(() => {
    const bases = 'ATGCATGCNNATGCGCATTAGCGATCGCGATCGATCGATCGCGATCGATCGATCGATCG';
    let seq = '';
    for (let i = 0; i < 180; i++) {
      if (i > 0 && i % 10 === 0) seq += ' ';
      seq += bases[Math.floor(Math.random() * bases.length)];
    }
    const display = document.getElementById('modal-seq-display');
    if (display) display.textContent = seq;
  }, 100);
}

modalClose?.addEventListener('click', () => modalOverlay.classList.add('hidden'));
modalOverlay?.addEventListener('click', (e) => {
  if (e.target === modalOverlay) modalOverlay.classList.add('hidden');
});

// ─── Stats ───
function renderStats() {
  if (!analysisData) return;
  buildBaseCompositionChart(document.getElementById('base-composition-chart'), analysisData.baseComposition);
  buildGeneTypeChart(document.getElementById('gene-type-chart'), analysisData.detectedGenes);
  buildExpressionChart(document.getElementById('expression-chart'), analysisData.detectedGenes);
  buildDensityChart(document.getElementById('density-chart'), analysisData.detectedGenes);
}

// ─── Status Helper ───
function setStatus(state, text) {
  statusDot.className = 'status-dot ' + state;
  statusText.textContent = text;
}

// ─── Background DNA Helix Animation ───
const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

let frame = 0;
function drawBackground() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const cols = Math.ceil(canvas.width / 120) + 1;

  for (let col = 0; col < cols; col++) {
    const x = col * 120;
    const offset = (frame * 0.5 + col * 40) % (canvas.height + 80);

    for (let i = 0; i < 14; i++) {
      const yBase = (-offset + i * 60) % (canvas.height + 80) - 40;
      const t = (yBase + frame * 0.5) / 60;

      // Strand 1
      const x1 = x + Math.cos(t) * 22;
      const x2 = x + Math.cos(t + Math.PI) * 22;

      ctx.beginPath();
      ctx.arc(x1, yBase, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(27,138,90,0.6)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x2, yBase, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,137,123,0.5)';
      ctx.fill();

      // Rung
      ctx.beginPath();
      ctx.moveTo(x1, yBase);
      ctx.lineTo(x2, yBase);
      ctx.strokeStyle = 'rgba(27,138,90,0.1)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  frame++;
  requestAnimationFrame(drawBackground);
}
drawBackground();

// ─── Init ───
setStatus('idle', '대기 중');
document.getElementById('nav-map').style.opacity = '0.4';
document.getElementById('nav-stats').style.opacity = '0.4';
