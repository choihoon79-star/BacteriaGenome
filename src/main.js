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

    // 4. Bakta 정밀 분석 시도 (비동기)
    startBaktaAnalysis(text, fileName);

  } catch (err) {
    setStatus('error', err.message);
    progressLabel.textContent = '❌ 오류: ' + err.message;
  }
}

async function startBaktaAnalysis(fastaText, name) {
  let URL = (import.meta.env.VITE_API_URL || '').trim();
  if (URL.endsWith('/')) URL = URL.slice(0, -1);

  if (!URL) {
     updateBaktaStatusUI('error', 'API 주소 미설정 (로컬 모드)');
     return;
  }

  updateBaktaStatusUI('loading', 'AI 정밀 분석(Bakta) 요청 중...');

  try {
    const formData = new FormData();
    formData.append('file', new Blob([fastaText]), 'genome.fasta');
    
    const resp = await fetch(`${URL}/upload`, { method: 'POST', body: formData });
    if (!resp.ok) throw new Error('서버 응답 없음');
    
    const { job_id } = await resp.json();
    let done = false; 
    let count = 0;
    
    while (!done && count < 60) {
      await new Promise(r => setTimeout(r, 20000));
      count++;
      const sResp = await fetch(`${URL}/status/${job_id}`);
      const { status } = await sResp.json();
      updateBaktaStatusUI('loading', `Bakta 정밀 분석 중... (${Math.floor(count/3)}분)`);
      if (status === 'SUCCESSFUL') done = true;
      if (status === 'ERROR') throw new Error('Bakta 에러');
    }

    const rResp = await fetch(`${URL}/result/${job_id}`);
    const data = await rResp.json();
    
    // 결과 반영
    analysisData.detectedGenes = data.detectedGenes;
    analysisData.geneCount = data.geneCount;
    updateBaktaStatusUI('success', 'Bakta 정밀 분석 완료!');
    renderMap();
    renderWholeMap();

  } catch (err) {
    console.error(err);
    updateBaktaStatusUI('error', '서버 연결 차단 (로컬 분석 결과 사용 중)');
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

setStatus('idle', '대기 중');
```,Complexity:2,Description:
