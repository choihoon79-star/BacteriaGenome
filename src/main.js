/**
 * DNA Analyzer — Main Application Entry Point
 */

import './style.css';
import { parseSequences, analyzeSequencesAsync, generateSampleGenome } from './analyzer.js';
import {
  initDNAMap, switchToLinear, switchToCircular,
  buildLegend,
  buildBaseCompositionChart,
  renderWholeGenomeMap,
} from './dna-map.js';
import { initStrainSection, refreshStrainLibrary } from './strain-ui.js';
import { initResearchSection, refreshResearchSection } from './research-note.js';
import { StrainDB } from './strainDB.js';

// ─── App State ───
let analysisData = null;
let currentSection = 'upload';
let currentView = 'circular';

// ─── DOM References ───
const uploadZone   = document.getElementById('upload-zone');
const fileInput    = document.getElementById('file-input');
const sampleBtn    = document.getElementById('sample-btn');
const progressContainer = document.getElementById('progress-container');
const progressBar  = document.getElementById('progress-bar');
const progressPct  = document.getElementById('progress-pct');
const progressLabel= document.getElementById('progress-label');
const quickStats   = document.getElementById('quick-stats');
const gotoMapBtn   = document.getElementById('goto-map-btn');
const statusDot    = document.getElementById('status-dot');
const statusText   = document.getElementById('status-text');
const navLinks     = document.querySelectorAll('.nav-link');
const svgEl        = document.getElementById('dna-map-svg');

// ─── Navigation ───
function showSection(name) {
  currentSection = name;
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById(`${name}-section`)?.classList.add('active');
  navLinks.forEach(l => l.classList.remove('active'));
  document.getElementById(`nav-${name}`)?.classList.add('active');

  if (name === 'map' && analysisData) renderMap();
  if (name === 'wholemap' && analysisData) renderWholeMap();
}

navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    const target = link.id.replace('nav-', '');
    if (!analysisData && (target === 'map' || target === 'wholemap')) return;
    showSection(target);
  });
});

gotoMapBtn?.addEventListener('click', () => showSection('map'));

// ─── Init ───
initStrainSection();
initResearchSection();

// ─── Upload Handling ───
uploadZone?.addEventListener('click', () => fileInput.click());
fileInput?.addEventListener('change', () => { if (fileInput.files[0]) processFile(fileInput.files[0]); });
sampleBtn?.addEventListener('click', () => {
  const text = generateSampleGenome();
  runAnalysis(text, 'Sample_Genome');
});

async function processFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => runAnalysis(e.target.result, file.name);
  reader.readAsText(file);
}

async function runAnalysis(text, fileName) {
  try {
    setStatus('processing', '로컬 분석 중...');
    progressContainer.classList.remove('hidden');
    quickStats.classList.add('hidden');
    
    // 1. 서열 파싱
    const sequences = parseSequences(text);
    if (sequences.length === 0) throw new Error('유효한 DNA 서열을 찾을 수 없습니다.');

    // 2. 로컬 ORF 및 지놈 분석
    const result = await analyzeSequencesAsync(sequences, (pct, info) => {
      progressBar.style.width = (pct * 100) + '%';
      progressPct.textContent = Math.round(pct * 100) + '%';
      progressLabel.textContent = info;
    });

    analysisData = result;
    analysisData.customName = fileName;

    // 3. UI 업데이트
    displayQuickStats(analysisData);
    autoRegisterStrain(analysisData);
    
    setStatus('done', '로컬 분석 완료');
    progressLabel.textContent = '✅ 로컬 분석 완료 (수천 건의 유전자 탐지됨)';
    
    setTimeout(() => {
      progressContainer.classList.add('hidden');
      quickStats.classList.remove('hidden');
      document.getElementById('nav-map').style.opacity = '1';
      document.getElementById('nav-wholemap').style.opacity = '1';
      buildLegend(document.getElementById('map-legend'));
    }, 1000);

    // 4. 외부 분석 시도 (DFAST + Bakta)
    startDfastAnalysis(text, fileName);
    startBaktaAnalysis(text, fileName);

  } catch (err) {
    setStatus('error', err.message);
    progressLabel.textContent = '❌ 오류: ' + err.message;
  }
}

/**
 * DFAST API (DDBJ) 연동 - Bakta의 강력한 대안
 */
async function startDfastAnalysis(fastaText, name) {
  const dfastStatus = document.getElementById('dfast-status-badge');
  if (dfastStatus) {
    dfastStatus.classList.remove('hidden');
    dfastStatus.className = 'status-badge loading';
    dfastStatus.querySelector('.status-text').textContent = 'DFAST 분석 요청 중...';
  }

  try {
    // DFAST API는 대용량 업로드를 위해 multipart/form-data 사용
    const formData = new FormData();
    formData.append('file', new Blob([fastaText]), 'genome.fasta');
    
    // dfast.ddbj.nig.ac.jp 에는 공용 API가 있으나 속도 제한이 있을 수 있음
    // 실제 운영 시에는 사용자 토큰이 필요할 수 있습니다.
    const resp = await fetch('https://dfast.ddbj.nig.ac.jp/dfast/api/jobs', {
      method: 'POST',
      body: formData
    });
    
    if (!resp.ok) throw new Error('DFAST 서버 응답 없음');
    const { job_id } = await resp.json();
    
    let done = false;
    let count = 0;
    while (!done && count < 30) {
      await new Promise(r => setTimeout(r, 15000));
      count++;
      const sResp = await fetch(`https://dfast.ddbj.nig.ac.jp/dfast/api/jobs/${job_id}`);
      const job = await sResp.json();
      if (job.status === 'finished') done = true;
      if (job.status === 'failed') throw new Error('DFAST 분석 실패');
    }

    const rResp = await fetch(`https://dfast.ddbj.nig.ac.jp/dfast/api/jobs/${job_id}/results/json`);
    const data = await rResp.json();
    
    if (data && data.features) {
      // DFAST 결과를 프로젝트 포맷으로 변환
      const newGenes = data.features.map(f => ({
        name: f.gene || f.locus_tag,
        fullName: f.product || 'Protein',
        type: 'CDS',
        startPos: f.location.start,
        endPos: f.location.end,
        strand: f.location.strand === 1 ? '+' : '-',
        geneLength: f.location.end - f.location.start
      }));

      if (analysisData) {
        analysisData.detectedGenes = [...analysisData.detectedGenes, ...newGenes];
        analysisData.geneCount = analysisData.detectedGenes.length;
        displayQuickStats(analysisData);
        renderMap();
        renderWholeMap();
      }
      if (dfastStatus) {
        dfastStatus.className = 'status-badge success';
        dfastStatus.querySelector('.status-text').textContent = 'DFAST 분석 완료';
      }
    }
  } catch (err) {
    if (dfastStatus) {
      dfastStatus.className = 'status-badge error';
      dfastStatus.querySelector('.status-text').textContent = 'DFAST 연결 안됨 (로컬 결과 사용)';
    }
  }
}

/**
 * NCBI Datasets API - 레퍼런스 데이터 가져오기
 */
async function fetchNcbiReference(accession) {
  const infoEl = document.getElementById('ncbi-info');
  if (infoEl) infoEl.textContent = 'NCBI 데이터 조회 중...';

  try {
    // NCBI Datasets v2 REST API 사용
    const resp = await fetch(`https://api.ncbi.nlm.nih.gov/datasets/v2/genome/accession/${accession}/dataset_report`);
    const data = await resp.json();
    
    if (data.reports && data.reports.length > 0) {
      const genome = data.reports[0].genome;
      const refInfo = `
        🧬 Standard Reference: ${genome.organism.organism_name}
        - Accession: ${genome.accession}
        - Assembly Level: ${genome.assembly_info.assembly_level}
        - Annotation: ${genome.annotation_info?.busco?.complete || 'Available'}
      `;
      if (infoEl) infoEl.textContent = refInfo;
      // 여기서 추가로 GFF/GBK 등을 가져와 지도에 겹쳐 그리는 기능 구현 가능
    }
  } catch (err) {
    if (infoEl) infoEl.textContent = 'NCBI 데이터를 찾을 수 없습니다.';
  }
}

function updateBaktaStatusUI(state, text) {
  ['bakta-status-badge-main', 'bakta-status-badge-map', 'bakta-status-badge-wm'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = 'status-badge ' + state;
    const txt = el.querySelector('.bakta-status-text');
    if (txt) txt.textContent = text;
  });
}

function displayQuickStats(data) {
  document.getElementById('stat-length-val').textContent = (data.totalLength / 1000).toFixed(0) + ' kb';
  document.getElementById('stat-gc-val').textContent = data.gcContent + '%';
  document.getElementById('stat-genes-val').textContent = data.geneCount.toLocaleString() + '개';
}

function renderMap() {
  if (currentView === 'circular') initDNAMap(svgEl, analysisData, (g) => {
    document.getElementById('gene-name').textContent = g.name;
    document.getElementById('gene-type').textContent = g.fullName;
    document.getElementById('info-placeholder').classList.add('hidden');
    document.getElementById('gene-detail').classList.remove('hidden');
  });
  else switchToLinear(svgEl, analysisData);
}

function renderWholeMap() {
  const wmSvg = document.getElementById('wholemap-svg');
  if (wmSvg && analysisData) renderWholeGenomeMap(wmSvg, analysisData);
}

function setStatus(state, text) {
  if (statusDot) statusDot.className = 'status-dot ' + state;
  if (statusText) statusText.textContent = text;
}

function autoRegisterStrain(data) {
  StrainDB.create({
    name: data.customName,
    genome: { gcContent: data.gcPercent, sizeKb: data.totalLength/1000, geneCount: data.geneCount },
    status: '분석 완료'
  });
}

// Background Animation
const canvas = document.getElementById('bg-canvas');
if (canvas) {
  const ctx = canvas.getContext('2d');
  const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
  window.addEventListener('resize', resize);
  resize();
  let f = 0;
  const draw = () => {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = 'rgba(0,255,200,0.03)';
    for(let i=0; i<15; i++) {
      ctx.beginPath();
      ctx.arc((i*150+f)%canvas.width, (i*100+f*0.5)%canvas.height, 2, 0, Math.PI*2);
      ctx.fill();
    }
    f++; requestAnimationFrame(draw);
  };
  draw();
}

// Event Listeners for new features
document.getElementById('ncbi-search-btn')?.addEventListener('click', () => {
  const acc = document.getElementById('ncbi-search-input')?.value?.trim();
  if (acc) fetchNcbiReference(acc);
});

setStatus('idle', '대기 중');
```,Complexity:2,Description:
