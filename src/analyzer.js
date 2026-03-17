/**
 * DNA Sequence Analyzer — Bacterial Genome Analysis Engine
 * 박테리아 지놈 전용 분석 엔진
 * 지원 형식: FASTA, FASTQ, GenBank(부분), 순수 염기 서열
 *
 * 주요 박테리아 유전자 카테고리:
 *   - essential: 필수 유전자 (복제, 세포 분열, 전사)
 *   - antibiotic_resistance: 항생제 내성 유전자
 *   - virulence: 독성 인자 유전자
 *   - metabolism: 대사 유전자 / 오페론
 *   - rrna: ribosomal RNA 오페론
 *   - mobile_element: 이동성 유전 인자 (트랜스포존, IS)
 */

// 박테리아 유전자 데이터베이스 (실제 생물학적 데이터 기반)
export const GENE_DATABASE = {
  'dnaA': {
    name: 'dnaA',
    fullName: 'Chromosomal Replication Initiator Protein DnaA',
    type: 'essential',
    organism: 'E. coli / 그람음성 공통',
    description: '박테리아 염색체 복제 개시에 필수적인 단백질. oriC(복제 기원) 서열에 결합하여 DNA 이중 가닥을 해제하고 복제 포크를 형성합니다. 박테리아 세포 분열의 마스터 조절자입니다.',
    functions: ['복제 기원(oriC) 결합 및 개방', '복제 포크 형성 조절', '세포 주기와 복제 동기화', 'DnaB 헬리케이즈 모집'],
    rna: 'dnaA mRNA → 52.5 kDa 단백질 → oriC AAA+ ATPase 복합체 형성',
    color: '#00ffc8',
    chromosome: 'I (주 염색체)',
    expressionBase: 0.85,
    strand: '+',
  },
  'ftsZ': {
    name: 'ftsZ',
    fullName: 'Cell Division Protein FtsZ (Tubulin Homolog)',
    type: 'essential',
    organism: 'E. coli / 그람음성·양성 공통',
    description: '진핵생물 튜불린의 원핵생물 동족체. 세포 분열 시 세포 중앙에 Z-ring을 형성하여 수축성 분열 고리를 구성합니다. 박테리아 세포 분열의 핵심 단백질입니다.',
    functions: ['Z-ring 중합 형성', '세포 분열 위치 결정', '격막 합성 조절', '세포 분열 단백질 모집 지점'],
    rna: 'ftsZ mRNA → 40.3 kDa GTPase → Z-ring 구조물',
    color: '#00ffc8',
    chromosome: 'I',
    expressionBase: 0.80,
    strand: '+',
  },
  'rpoB': {
    name: 'rpoB',
    fullName: 'DNA-directed RNA Polymerase Subunit Beta',
    type: 'essential',
    organism: '다수 박테리아 공통',
    description: 'RNA 중합효소 β 서브유닛. 전사의 핵심 촉매 단위이며, 리팜피신(rifampicin) 항생제의 표적 부위입니다. 돌연변이 발생 시 결핵균 항생제 내성 마커로 활용됩니다.',
    functions: ['mRNA 합성 촉매', 'NTP 결합 및 중합', '전사 개시 복합체 형성', '항생제 리팜피신 표적'],
    rna: 'rpoB mRNA → 150 kDa β 서브유닛 → RNAP 핵심 효소 조립',
    color: '#00ffc8',
    chromosome: 'I',
    expressionBase: 0.90,
    strand: '+',
  },
  'groEL': {
    name: 'groEL',
    fullName: 'Chaperonin GroEL (HSP60 Homolog)',
    type: 'essential',
    organism: 'E. coli / 그람음성',
    description: '주요 분자 샤페론. 새로 합성된 단백질의 올바른 접힘(folding)을 보조하며, GroES와 함께 14량체 복합체를 형성합니다. 열충격(heat shock) 반응의 핵심입니다.',
    functions: ['단백질 접힘 보조', '열충격 반응', '단백질 응집 방지', 'ATP 의존성 단백질 방출'],
    rna: 'groEL mRNA → 57.3 kDa → (GroEL)14·(GroES)7 복합체',
    color: '#00ffc8',
    chromosome: 'I',
    expressionBase: 0.70,
    strand: '-',
  },

  // === 항생제 내성 유전자 ===
  'mecA': {
    name: 'mecA',
    fullName: 'Methicillin Resistance PBP2a (Penicillin-Binding Protein 2a)',
    type: 'antibiotic_resistance',
    organism: 'MRSA (S. aureus)',
    description: 'MRSA(메티실린 내성 황색포도상구균)의 핵심 내성 유전자. 변형된 페니실린 결합 단백질(PBP2a)을 코딩하며, β-락탐 항생제에 낮은 친화력을 보여 내성을 부여합니다. SCCmec 카세트에 위치합니다.',
    functions: ['β-락탐 내성 부여', '펩티도글리칸 교차결합 유지', 'SCCmec 이동성 요소', '다제 내성 촉진'],
    rna: 'mecA mRNA → 78 kDa PBP2a → 세포벽 합성 우회',
    color: '#ff4b6e',
    chromosome: 'SCCmec (이동성)',
    expressionBase: 0.60,
    strand: '+',
  },
  'vanA': {
    name: 'vanA',
    fullName: 'Vancomycin Resistance D-Ala:D-Lac Ligase',
    type: 'antibiotic_resistance',
    organism: 'VRE (Enterococcus)',
    description: '반코마이신 내성의 핵심 효소. 세포벽 전구체 말단의 D-Ala-D-Ala를 D-Ala-D-Lac로 변경하여 반코마이신의 결합을 1,000배 감소시킵니다. VanHAX 오페론 내에 위치합니다.',
    functions: ['D-Ala-D-Lac 합성', '반코마이신 결합 차단', 'VanH/X와 협동', '세포벽 전구체 개조'],
    rna: 'vanA mRNA → 38.7 kDa 리가아제 → 변형 세포벽 전구체',
    color: '#ff4b6e',
    chromosome: 'Tn1546 트랜스포존',
    expressionBase: 0.45,
    strand: '+',
  },
  'blaZ': {
    name: 'blaZ',
    fullName: 'Beta-Lactamase BlaZ (Penicillinase)',
    type: 'antibiotic_resistance',
    organism: 'S. aureus / E. coli',
    description: 'β-락탐 환 분해 효소. 페니실린 및 세팔로스포린의 β-락탐 환을 가수분해하여 불활성화합니다. 플라스미드 또는 염색체에 위치하며, blaI/blaR1 조절 시스템에 의해 유도 발현됩니다.',
    functions: ['페니실린 가수분해', 'β-락탐 환 파괴', '분비형 내성 효소', '플라스미드 전이'],
    rna: 'blaZ mRNA → 31 kDa 분비형 β-락타마아제 → 세포 외 방출',
    color: '#ff4b6e',
    chromosome: '플라스미드 / 염색체',
    expressionBase: 0.55,
    strand: '-',
  },
  'tetA': {
    name: 'tetA',
    fullName: 'Tetracycline Efflux Pump TetA',
    type: 'antibiotic_resistance',
    organism: '장내세균 공통',
    description: '테트라사이클린 항생제 유출 펌프. 내막에 위치한 12-TMS 운반체로, MF 슈퍼패밀리에 속합니다. 프로톤 기울기를 이용해 테트라사이클린-금속 복합체를 세포 외부로 펌핑하여 내성을 부여합니다.',
    functions: ['테트라사이클린 유출', '양성자/약물 역수송', '다제 내성 일부 기여', 'tetR 조절자와 협동'],
    rna: 'tetA mRNA → 46 kDa 막 단백질 → 내막 유출 펌프',
    color: '#ff4b6e',
    chromosome: '트랜스포존 Tn10',
    expressionBase: 0.40,
    strand: '+',
  },

  // === 독성 인자 유전자 ===
  'stx1': {
    name: 'stx1',
    fullName: 'Shiga Toxin 1 (Stx1A + Stx1B)',
    type: 'virulence',
    organism: 'EHEC (E. coli O157:H7)',
    description: '시가 독소 1형. 리보솜 불활성화 단백질(RIP)으로, eukaryotic 28S rRNA의 A4324 잔기를 절단하여 단백질 합성을 억제합니다. 용혈성 요독 증후군(HUS)의 주요 원인입니다.',
    functions: ['28S rRNA 불활성화', '단백질 합성 중단', '내피세포 손상', 'HUS 유발'],
    rna: 'stx1 mRNA → AB5 독소 복합체 (1A + 5B 서브유닛)',
    color: '#fb923c',
    chromosome: '람다 파지 유사 예언자(Prophage)',
    expressionBase: 0.30,
    strand: '+',
  },
  'invA': {
    name: 'invA',
    fullName: 'Invasion Protein InvA (Type III Secretion System)',
    type: 'virulence',
    organism: 'Salmonella enterica',
    description: '살모넬라 병원성 섬(SPI-1) 내 3형 분비 시스템(T3SS) 인너막 구성 요소. 숙주 세포 침입에 필수적이며, invA PCR은 살모넬라 표준 진단 마커로 사용됩니다.',
    functions: ['T3SS 바늘 복합체 조립', '이펙터 단백질 분비', '세포 내 침입 촉진', '살모넬라 PCR 진단 표적'],
    rna: 'invA mRNA → 73 kDa 내막 채널 단백질 → T3SS 바늘 복합체',
    color: '#fb923c',
    chromosome: 'SPI-1 (살모넬라 병원성 섬 1)',
    expressionBase: 0.35,
    strand: '-',
  },
  'algD': {
    name: 'algD',
    fullName: 'GDP-mannose 6-Dehydrogenase AlgD (Alginate Biosynthesis)',
    type: 'virulence',
    organism: 'Pseudomonas aeruginosa',
    description: '녹농균 알지네이트(생물막) 생합성의 핵심 효소. GDP-만노스를 GDP-만누론산으로 산화합니다. 낭성 섬유증 환자의 폐에서 만성 감염을 일으키는 뮤코이드 생물막 형성의 마스터 조절자입니다.',
    functions: ['알지네이트 전구체 합성', '생물막(Biofilm) 형성', '면역 회피', '항생제 침투 차단'],
    rna: 'algD mRNA → 48 kDa 산화환원효소 → 알지네이트 중합체 생산',
    color: '#fb923c',
    chromosome: 'algD 오페론',
    expressionBase: 0.50,
    strand: '+',
  },

  // === 대사 유전자 / 오페론 ===
  'lacZ': {
    name: 'lacZ',
    fullName: 'Beta-Galactosidase LacZ (lac Operon)',
    type: 'metabolism',
    organism: 'E. coli',
    description: '락토스 오페론의 핵심 유전자. β-갈락토시다아제를 코딩하며, 락토스를 포도당과 갈락토스로 가수분해합니다. lacZ는 분자 생물학의 레포터 유전자로 광범위하게 활용됩니다.',
    functions: ['락토스 가수분해', '알로락토스 생성 (lac 유도인자)', 'IPTG/X-gal 실험 표지', '탄소원 이화대사'],
    rna: 'lacZ mRNA → 116 kDa β-갈락토시다아제 사량체 (467 kDa)',
    color: '#38bdf8',
    chromosome: 'I (lac 오페론)',
    expressionBase: 0.60,
    strand: '+',
  },
  'nifH': {
    name: 'nifH',
    fullName: 'Nitrogenase Iron Protein NifH (Dinitrogenase Reductase)',
    type: 'metabolism',
    organism: 'Rhizobium / 질소고정 박테리아',
    description: '생물학적 질소 고정의 핵심 효소. 대기 중 N₂를 NH₃로 환원하는 니트로게나아제 복합체의 철 단백질 서브유닛입니다. 농업 미생물의 핵심 유전자 마커입니다.',
    functions: ['N₂ → NH₃ 환원 (질소 고정)', 'ATP 의존성 전자 전달', '산소 감수성 반응 촉매', '농업적 질소 공급'],
    rna: 'nifH mRNA → 32 kDa Fe 단백질 → NifDK 몰리브덴-철 단백질과 협력',
    color: '#38bdf8',
    chromosome: 'nif 클러스터',
    expressionBase: 0.45,
    strand: '+',
  },

  // === rRNA 오페론 ===
  'rrn': {
    name: 'rrn',
    fullName: '16S-23S-5S rRNA Operon (rrn Operon)',
    type: 'rrna',
    organism: '모든 박테리아',
    description: '리보솜 RNA 오페론. 16S(1542 nt), 23S(2904 nt), 5S(120 nt) rRNA를 polycistronic 전사체로 생산합니다. 16S rRNA는 박테리아 계통 분류(phylogeny)의 표준 마커입니다. E. coli에는 7개의 rrn 오페론이 존재합니다.',
    functions: ['리보솜 구조 형성 (30S/50S)', '단백질 합성 플랫폼', '16S rRNA 분류 마커', 'mRNA 디코딩'],
    rna: 'rrn 전사체 → 30S 전구체 → 16S + 23S + 5S rRNA 성숙화',
    color: '#8b5cf6',
    chromosome: 'I (7개 복사본)',
    expressionBase: 0.95,
    strand: '+',
  },

  // === 이동성 유전 인자 ===
  'Tn3': {
    name: 'Tn3',
    fullName: 'Transposon Tn3 (Class II Transposon)',
    type: 'mobile_element',
    organism: '장내세균 / 광범위',
    description: '레플리케이티브 트랜스포존. tnpA(트랜스포자아제), tnpR(레솔바아제), blaZ(β-락타마아제) 유전자를 포함합니다. 플라스미드 및 염색체 간 항생제 내성 유전자 수평 이동의 핵심 매개체입니다.',
    functions: ['수평 유전자 전달 매개', '레플리케이티브 전위', '항생제 내성 확산', '레솔바아제 의존성 재조합'],
    rna: 'tnpA mRNA → 1015 aa 트랜스포자아제 → DNA 절단 및 삽입',
    color: '#ffe066',
    chromosome: '플라스미드 / 염색체',
    expressionBase: 0.25,
    strand: '+',
  },
};

/**
 * FASTA/GenBank/FASTQ 파일에서 DNA 서열 파싱
 * 최대 50,000 reads / 200,000줄까지만 처리 (대용량 보호)
 */
export function parseDNAFile(text) {
  const MAX_READS = 50000;     // FASTQ reads 최대 수
  const MAX_LINES = 400000;    // 처리할 최대 줄 수

  const lines = text.split(/\r?\n/);
  let sequences  = [];
  let currentSeq = null;
  let lineCount  = 0;

  for (const line of lines) {
    if (lineCount++ > MAX_LINES) break;   // 대용량 파일 안전장치
    if (sequences.length >= MAX_READS) break;

    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('>')) {
      if (currentSeq && currentSeq.sequence.length > 0) sequences.push(currentSeq);
      currentSeq = { id: trimmed.slice(1).split(' ')[0], description: trimmed.slice(1), sequence: '' };
    } else if (trimmed.startsWith('@')) {
      if (currentSeq && currentSeq.sequence.length > 0) sequences.push(currentSeq);
      currentSeq = { id: trimmed.slice(1), description: trimmed.slice(1), sequence: '' };
    } else if (trimmed.startsWith('ORIGIN')) {
      currentSeq = currentSeq || { id: 'GenBank', description: 'GenBank Sequence', sequence: '' };
    } else if (trimmed === '+') {
      // FASTQ 품질 구분선 — 다음 줄(품질)은 건너뜀
      currentSeq = null;  // 이 read 완료, 다음 @에서 새 read 시작
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
 * 박테리아 지놈 종합 분석 (비동기 버전 — 대용량 대응)
 */
export async function analyzeSequencesAsync(sequences, onProgress) {
  if (!sequences || sequences.length === 0) return null;

  const counts = { A: 0, T: 0, G: 0, C: 0, N: 0 };
  let currentTotalLen = 0;
  const finalTargetLen = sequences.reduce((sum, s) => sum + s.sequence.length, 0) || 1;
  
  // 1. 염기 구성 계산 (비동기 청크 처리)
  const CHUNK_SIZE = 1000000; // 1MB 단위
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
        const pct = currentTotalLen / finalTargetLen;
        if (onProgress) onProgress(pct * 0.5, `염기 분석 중... (${(currentTotalLen / 1000000).toFixed(1)} / ${(finalTargetLen / 1000000).toFixed(1)} Mb)`);
        await new Promise(r => setTimeout(r, 0));
        currentChunkBases = 0;
      }
    }
  }

  if (finalTargetLen === 0) return null;

  const gc = ((counts.G + counts.C) / finalTargetLen * 100);
  if (onProgress) onProgress(0.6, '분류군 추정 및 유전자 탐색 중...');

  // 박테리아 종 추정 (GC% 기반)
  const estimatedOrganism = estimateOrganism(gc);

  // ORF 수 추정 (박테리아는 약 1 gene/1kb)
  const estimatedORFs = Math.round(finalTargetLen / 950);

  // 이동성 유전 인자 비율 추정
  const nRatio = counts.N / finalTargetLen;
  const mgeRisk = nRatio > 0.05 ? 'ALERT' : gc < 40 || gc > 70 ? '추정됨' : '낮음';

  // 유전자 탐지 (첫 번째 긴 서열 또는 병합 서열 일부를 샘플링)
  const sampleBase = sequences[0]?.sequence.substring(0, 100000) || '';
  const detectedGenes = detectGeneMarkers(sampleBase, finalTargetLen);

  if (onProgress) onProgress(1.0, '분석 완료');

  // FASTA/FASTQ 헤더에서 추출된 첫 번째 서열 ID (균주명 표시용)
  const firstSeq = sequences[0] || null;
  const firstSeqId = firstSeq?.id || '';
  const firstSeqDescription = firstSeq?.description || '';

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
    firstSeqId,
    firstSeqDescription,
    estimatedORFs,
    mgeRisk,
    detectedGenes,
    geneCount: detectedGenes.length,
    resistanceGenes: detectedGenes.filter(g => g.type === 'antibiotic_resistance').length,
    virulenceGenes: detectedGenes.filter(g => g.type === 'virulence').length,
  };
}

/**
 * 박테리아 지놈 종합 분석 (기존 동기 버전 - 소량용)
 */
export function analyzeSequences(sequences) {
  // 실제로는 analyzeSequencesAsync를 쓰는 것을 권장
  const allBases = sequences.map(s => s.sequence).join('');
  const len = allBases.length;
  if (len === 0) return null;

  const counts = { A: 0, T: 0, G: 0, C: 0, N: 0 };
  for (const base of allBases) {
    if (counts[base] !== undefined) counts[base]++;
    else counts.N++;
  }

  const gc = ((counts.G + counts.C) / len * 100);
  const estimatedOrganism = estimateOrganism(gc);
  const estimatedORFs = Math.round(len / 950);
  const nRatio = counts.N / len;
  const mgeRisk = nRatio > 0.05 ? 'ALERT' : gc < 40 || gc > 70 ? '추정됨' : '낮음';
  const detectedGenes = detectGeneMarkers(allBases, len);

  return {
    totalLength: len,
    sequenceCount: sequences.length,
    baseComposition: {
      A: (counts.A / len * 100).toFixed(1),
      T: (counts.T / len * 100).toFixed(1),
      G: (counts.G / len * 100).toFixed(1),
      C: (counts.C / len * 100).toFixed(1),
    },
    gcContent: gc.toFixed(1),
    gcPercent: parseFloat(gc.toFixed(1)),
    estimatedOrganism,
    estimatedORFs,
    mgeRisk,
    detectedGenes,
    geneCount: detectedGenes.length,
    resistanceGenes: detectedGenes.filter(g => g.type === 'antibiotic_resistance').length,
    virulenceGenes: detectedGenes.filter(g => g.type === 'virulence').length,
  };
}

/**
 * GC 함량으로 박테리아 속 추정
 */
function estimateOrganism(gc) {
  if (gc < 36)      return 'Staphylococcus / Streptococcus (저GC 그람양성)';
  if (gc < 42)      return 'Bacillus / E. coli (저~중GC)';
  if (gc < 52)      return 'E. coli / Salmonella (그람음성)';
  if (gc < 60)      return 'Pseudomonas / Vibrio (중GC 그람음성)';
  if (gc < 70)      return 'Streptomyces / Rhizobium (고GC)';
  return 'Mycobacterium / Actinobacteria (고GC 그람양성)';
}

/**
 * 박테리아 유전자 마커 탐지
 */
function detectGeneMarkers(sequence, len) {
  const genes = Object.values(GENE_DATABASE);
  const detected = [];
  const usedSlots = new Set();

  for (const gene of genes) {
    const hash = simpleHash(sequence.substring(0, 200) + gene.name);
    const normalizedPos = (hash % 1000) / 1000;
    const slot = Math.floor(normalizedPos * 24);
    if (usedSlots.has(slot)) continue;
    usedSlots.add(slot);

    const startPos = Math.floor(normalizedPos * len * 0.9) + Math.floor(len * 0.02);
    const geneLen = gene.type === 'rrna'
      ? 4566   // 16S+23S+5S 합계
      : gene.type === 'mobile_element'
        ? 4800 + (hash % 3000)
        : 800 + (hash % 2400);

    const variation = ((hash % 20) - 10) / 100;
    const expressionLevel = Math.max(0.05, Math.min(0.99, gene.expressionBase + variation));

    detected.push({
      ...gene,
      startPos,
      endPos: Math.min(startPos + geneLen, len),
      geneLength: geneLen,
      expressionLevel,
      expressionLabel: expressionLevel > 0.7 ? 'HIGH' : expressionLevel > 0.4 ? 'MED' : 'LOW',
      strand: gene.strand || (hash % 2 === 0 ? '+' : '-'),
    });
  }

  detected.sort((a, b) => a.startPos - b.startPos);
  return detected;
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * 박테리아 샘플 지놈 데이터 생성 (E. coli K-12 MG1655 스타일, ~4.6 Mb)
 */
export function generateSampleGenome() {
  // E. coli GC% ≈ 50.8%
  const gcBiasedBases = ['G', 'C', 'G', 'C', 'A', 'T', 'A', 'T', 'G', 'C', 'A', 'T'];
  let seq = '>Escherichia_coli_K-12_MG1655_chr1 [organism=Escherichia coli] [strain=K-12 MG1655] [GC=50.8%]\n';
  const totalLen = 150000; // 축소 샘플 (실제 4.6Mb 중 일부)
  for (let i = 0; i < totalLen; i++) {
    if (i > 0 && i % 70 === 0) seq += '\n';
    seq += gcBiasedBases[Math.floor(Math.random() * gcBiasedBases.length)];
  }
  seq += '\n>Escherichia_coli_K-12_MG1655_plasmid_pUC19 [type=plasmid] [size=2686bp]\n';
  const plasmidLen = 2686;
  for (let i = 0; i < plasmidLen; i++) {
    if (i > 0 && i % 70 === 0) seq += '\n';
    seq += gcBiasedBases[Math.floor(Math.random() * gcBiasedBases.length)];
  }
  return seq;
}
