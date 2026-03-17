/**
 * DNA Sequence Analyzer - 바이오정보 분석 코어
 */

import { GENE_DATABASE } from './gene_db.js';

/**
 * FASTA/FASTQ 문자열 파싱
 */
export function parseSequences(text) {
  if (!text) return [];
  const lines = text.split('\n');
  const sequences = [];
  let currentSeq = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('>')) {
      if (currentSeq) sequences.push(currentSeq);
      currentSeq = {
        id: trimmed.slice(1).split(' ')[0],
        description: trimmed.slice(1),
        sequence: ''
      };
    } else if (trimmed.startsWith('@')) {
      if (currentSeq) sequences.push(currentSeq);
      currentSeq = {
        id: trimmed.slice(1).split(' ')[0],
        description: trimmed.slice(1),
        sequence: ''
      };
    } else if (trimmed.startsWith('ORIGIN')) {
      currentSeq = currentSeq || { id: 'GenBank', description: 'GenBank Sequence', sequence: '' };
    } else if (trimmed === '+') {
      currentSeq = null;
    } else if (currentSeq && isValidDNA(trimmed)) {
      const cleaned = trimmed.replace(/^\s*\d+\s*/g, '').replace(/\s/g, '');
      if (isValidDNA(cleaned)) currentSeq.sequence += cleaned.toUpperCase();
    } else if (!currentSeq && isValidDNA(trimmed)) {
      sequences.push({ id: 'SEQ001', description: 'Raw Sequence', sequence: trimmed.toUpperCase() });
    }
  }
  if (currentSeq && currentSeq.sequence.length > 0) sequences.push(currentSeq);
  return sequences;
}

function isValidDNA(str) {
  const cleaned = str.replace(/\s/g, '');
  return /^[ACGTNRYSWKMBDHVacgtnryswkmbdhv]+$/.test(cleaned) && cleaned.length > 5;
}

/**
 * 박테리아 지놈 종합 분석 (비동기 버전)
 */
export async function analyzeSequencesAsync(sequences, onProgress) {
  if (!sequences || sequences.length === 0) return null;

  const counts = { A: 0, T: 0, G: 0, C: 0, N: 0 };
  let currentTotalLen = 0;
  const finalTargetLen = sequences.reduce((sum, s) => sum + s.sequence.length, 0) || 1;
  
  const CHUNK_SIZE = 1000000;
  let currentChunkBases = 0;

  for (let i = 0; i < sequences.length; i++) {
    const seq = sequences[i].sequence;
    for (let j = 0; j < seq.length; j++) {
      const base = seq[j];
      if (counts[base] !== undefined) counts[base]++;
      else counts.N++;
      
      currentTotalLen++;
      currentChunkBases++;
      
      if (currentChunkBases >= CHUNK_SIZE) {
        if (onProgress) onProgress(currentTotalLen / finalTargetLen * 0.5, `염기 분석 중...`);
        await new Promise(r => setTimeout(r, 0));
        currentChunkBases = 0;
      }
    }
  }

  const gc = ((counts.G + counts.C) / finalTargetLen * 100);
  if (onProgress) onProgress(0.6, '분류군 추정 및 유전자 탐색 중...');

  const estimatedOrganism = estimateOrganism(gc);
  const estimatedORFs = Math.round(finalTargetLen / 950);
  const nRatio = counts.N / finalTargetLen;
  const mgeRisk = nRatio > 0.05 ? 'ALERT' : gc < 40 || gc > 70 ? '추정됨' : '낮음';

  const sampleBase = sequences[0]?.sequence.substring(0, 100000) || '';
  const detectedGenes = detectGeneMarkers(sampleBase, finalTargetLen);

  if (onProgress) onProgress(1.0, '분석 완료');

  const firstSeq = sequences[0] || null;

  return {
    totalLength: finalTargetLen,
    sequenceCount: sequences.length,
    baseComposition: {
      A: (counts.A / finalTargetLen * 100).toFixed(1),
      T: (counts.T / finalTargetLen * 100).toFixed(1),
      G: (counts.G / finalTargetLen * 100).toFixed(1),
      C: (counts.C / finalTargetLen * 100).toFixed(1),
    },
    gcContent: gc.toFixed(1),
    gcPercent: parseFloat(gc.toFixed(1)),
    estimatedOrganism,
    firstSeqId: firstSeq?.id || '',
    firstSeqDescription: firstSeq?.description || '',
    estimatedORFs,
    mgeRisk,
    detectedGenes,
    geneCount: detectedGenes.length,
    resistanceGenes: detectedGenes.filter(g => g.type === 'antibiotic_resistance').length,
    virulenceGenes: detectedGenes.filter(g => g.type === 'virulence').length,
  };
}

/**
 * 박테리아 지놈 종합 분석 (동기 버전)
 */
export function analyzeSequences(sequences) {
  const allBases = sequences.map(s => s.sequence).join('');
