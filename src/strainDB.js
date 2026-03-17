/**
 * Strain Management DB — LocalStorage CRUD Layer
 * 균주 관리 데이터베이스 (localStorage 기반)
 *
 * 균주 스키마:
 *   id, name, taxonomy, discovery, culture, deposit[], genome, experiments[], status, notes
 *
 * 실험 항목 (확장 가능):
 *   - 항균활성 (Antimicrobial Activity)
 *   - 인산가용능 (Phosphate Solubilization)
 *   - 사이드로포어 (Siderophore Production)
 */

const DB_KEY = 'bacteriaGenome_strains';

// ── 유틸 ──
function generateId() {
  const year = new Date().getFullYear();
  const all = load();
  const maxNum = all.reduce((m, s) => {
    const n = parseInt(s.id.split('-')[2] || 0, 10);
    return Math.max(m, n);
  }, 0);
  return `STR-${year}-${String(maxNum + 1).padStart(3, '0')}`;
}

function load() {
  try {
    return JSON.parse(localStorage.getItem(DB_KEY) || '[]');
  } catch { return []; }
}

function save(data) {
  localStorage.setItem(DB_KEY, JSON.stringify(data));
}

// ── CRUD ──
export const StrainDB = {
  getAll() { return load(); },

  getById(id) { return load().find(s => s.id === id) || null; },

  create(data) {
    const all = load();
    const strain = {
      id: generateId(),
      name: data.name || '이름 미지정',
      taxonomy: data.taxonomy || { genus: '', species: '', strain: '' },
      discovery: data.discovery || { date: '', location: '', researcher: '' },
      culture: data.culture || { temperature: '37°C', medium: 'LB', gram: '', shape: '' },
      deposit: data.deposit || [],
      genome: data.genome || { gcContent: null, sizeKb: null, fastaData: '' },
      experiments: data.experiments || [],
      status: data.status || '분석 중',
      notes: data.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    all.push(strain);
    save(all);
    return strain;
  },

  update(id, patches) {
    const all = load();
    const idx = all.findIndex(s => s.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...patches, updatedAt: new Date().toISOString() };
    save(all);
    return all[idx];
  },

  delete(id) {
    const all = load().filter(s => s.id !== id);
    save(all);
  },

  addExperiment(strainId, exp) {
    const strain = StrainDB.getById(strainId);
    if (!strain) return null;
    const entry = {
      id: `EXP-${Date.now()}`,
      date: exp.date || new Date().toISOString().slice(0, 10),
      type: exp.type,
      method: exp.method || '',
      result: exp.result || '',
      value: exp.value || '',
      unit: exp.unit || '',
      researcher: exp.researcher || '',
      notes: exp.notes || '',
      createdAt: new Date().toISOString(),
    };
    const experiments = [...(strain.experiments || []), entry];
    return StrainDB.update(strainId, { experiments });
  },

  addDeposit(strainId, dep) {
    const strain = StrainDB.getById(strainId);
    if (!strain) return null;
    const entry = {
      id: `DEP-${Date.now()}`,
      institute: dep.institute || 'KCTC',
      accession: dep.accession || '',
      date: dep.date || new Date().toISOString().slice(0, 10),
      type: dep.type || '기탁탁',
      notes: dep.notes || '',
    };
    const deposit = [...(strain.deposit || []), entry];
    let status = strain.status;
    if (deposit.length > 0) status = '기탁 완료';
    return StrainDB.update(strainId, { deposit, status });
  },

  search(query) {
    const q = query.toLowerCase();
    return load().filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q) ||
      (s.taxonomy.genus + ' ' + s.taxonomy.species).toLowerCase().includes(q) ||
      s.deposit.some(d => d.accession.toLowerCase().includes(q))
    );
  },

  // 초기화 (샘플 데이터 없을 시)
  initSampleData() {
    if (load().length > 0) return;
    const samples = [
      {
        name: 'Bacillus velezensis KR-01',
        taxonomy: { genus: 'Bacillus', species: 'velezensis', strain: 'KR-01' },
        discovery: { date: '2024-03-15', location: '제주도 한라산 토양 (해발 800m)', researcher: '김연구' },
        culture: { temperature: '37°C', medium: 'LB Agar', gram: 'Gram 양성 (+)', shape: '간균 (Rod)', oxygen: '호기성', sporulation: '내생포자 형성' },
        deposit: [{ id: 'DEP-001', institute: 'KCTC', accession: 'KCTC 14890BP', date: '2024-05-20', type: '기탁', notes: '특허 기탁' }],
        genome: { gcContent: 46.5, sizeKb: 4052 },
        experiments: [
          { id: 'EXP-001', date: '2024-04-01', type: '항균활성', method: '디스크 확산법', result: '황색포도상구균(S. aureus) 억제', value: '18', unit: 'mm (억제환)', researcher: '이실험', notes: '암피실린 대조군 대비 90% 수준' },
          { id: 'EXP-002', date: '2024-04-15', type: '인산가용능', method: 'Mark 한천 배지법', result: '양성 (+)', value: '2.8', unit: 'SI (용해 지수)', researcher: '이실험', notes: '' },
          { id: 'EXP-003', date: '2024-05-01', type: '사이드로포어', method: 'CAS 한천 배지법', result: '양성 (+)', value: '15.2', unit: 'mm (halo)', researcher: '박분석', notes: '철 제한 조건에서 강한 생산' },
        ],
        status: '기탁 완료',
        notes: '한라산 고지대 토양에서 분리. 항균 및 식물 성장 촉진 활성 우수.',
      },
      {
        name: 'Pseudomonas fluorescens SJ-02',
        taxonomy: { genus: 'Pseudomonas', species: 'fluorescens', strain: 'SJ-02' },
        discovery: { date: '2024-06-10', location: '서울 강서구 논 토양', researcher: '박연구' },
        culture: { temperature: '28°C', medium: 'King B Agar', gram: 'Gram 음성 (−)', shape: '간균 (Rod)', oxygen: '호기성', sporulation: '없음' },
        deposit: [],
        genome: { gcContent: 59.4, sizeKb: 6400 },
        experiments: [
          { id: 'EXP-004', date: '2024-07-03', type: '항균활성', method: '디스크 확산법', result: '대장균(E. coli) 억제', value: '12', unit: 'mm (억제환)', researcher: '박연구', notes: '' },
          { id: 'EXP-005', date: '2024-07-20', type: '사이드로포어', method: 'CAS 한천 배지법', result: '양성 (+)', value: '22.1', unit: 'mm (halo)', researcher: '박연구', notes: '형광 시데로포어(pyoverdine) 확인' },
        ],
        status: '실험 진행',
        notes: '논 토양 식물 리좀스피어에서 분리. 형광 색소 생산.',
      },
      {
        name: 'Streptomyces griseus YS-03',
        taxonomy: { genus: 'Streptomyces', species: 'griseus', strain: 'YS-03' },
        discovery: { date: '2024-09-22', location: '강원도 양양 해안 모래 토양', researcher: '김연구' },
        culture: { temperature: '30°C', medium: 'ISP-2 (Yeast-Malt) Agar', gram: 'Gram 양성 (+)', shape: '사상균 (Filamentous)', oxygen: '호기성', sporulation: '기균사 포자 형성' },
        deposit: [{ id: 'DEP-002', institute: 'KCTC', accession: 'KCTC 15320BP', date: '2024-11-05', type: '기탁', notes: '' }],
        genome: { gcContent: 72.1, sizeKb: 8750 },
        experiments: [
          { id: 'EXP-006', date: '2024-10-08', type: '항균활성', method: '디스크 확산법', result: '다제내성균(MRSA) 억제', value: '24', unit: 'mm (억제환)', researcher: '이실험', notes: '매우 강한 항균 활성. 스트렙토마이신 유사 화합물 의심.' },
          { id: 'EXP-007', date: '2024-10-15', type: '인산가용능', method: 'Mark 한천 배지법', result: '음성 (−)', value: '1.0', unit: 'SI', researcher: '박분석', notes: '' },
        ],
        status: '기탁 완료',
        notes: '해안 모래 토양 방선균. 항MRSA 활성 주목. 2차 대사산물 분석 예정.',
      },
      {
        name: 'Lactobacillus plantarum JJ-04',
        taxonomy: { genus: 'Lactobacillus', species: 'plantarum', strain: 'JJ-04' },
        discovery: { date: '2025-01-05', location: '전통 된장 (전남 순천)', researcher: '최연구' },
        culture: { temperature: '37°C', medium: 'MRS Broth/Agar', gram: 'Gram 양성 (+)', shape: '구균-간균 (Coccobacillus)', oxygen: '통성 혐기성', sporulation: '없음' },
        deposit: [],
        genome: { gcContent: 44.5, sizeKb: 3308 },
        experiments: [
          { id: 'EXP-008', date: '2025-02-01', type: '항균활성', method: '공배양 억제 실험', result: '식중독균(Listeria) 억제', value: '16', unit: 'mm (억제환)', researcher: '최연구', notes: '유기산 및 박테리오신 복합 작용 의심' },
        ],
        status: '분석 중',
        notes: '전통 발효 식품 유래 유산균. 프로바이오틱스 활성 평가 중.',
      },
    ];
    samples.forEach(s => StrainDB.create(s));
  },
};

// ── 실험 타입 메타데이터 ──
export const EXPERIMENT_TYPES = [
  {
    key: '항균활성',
    label: '항균활성 (Antimicrobial Activity)',
    methods: ['디스크 확산법 (Kirby-Bauer)', '최소 억제 농도(MIC) 측정', '브로스 미량 희석법', '공배양 억제 실험'],
    fields: [
      { name: 'result',     label: '결과',         type: 'select', options: ['양성 (+)', '음성 (-)', '약양성 (+/-)'] },
      { name: 'value',      label: '억제환/MIC값', type: 'text',   placeholder: '예: 18' },
      { name: 'unit',       label: '단위',         type: 'select', options: ['mm (억제환)', 'µg/mL (MIC)', 'mg/mL', '기타'] },
    ],
    color: '#ff4b6e',
    icon: '🛡️',
  },
  {
    key: '인산가용능',
    label: '인산가용능 (Phosphate Solubilization)',
    methods: ['Mark 한천 배지법', 'NBRIP 액체 배지법', '비색정량법 (몰리브덴 청법)'],
    fields: [
      { name: 'result',     label: '결과',         type: 'select', options: ['양성 (+)', '음성 (-)', '약양성 (+/-)'] },
      { name: 'value',      label: 'SI값 (용해지수)', type: 'text', placeholder: '예: 2.8' },
      { name: 'unit',       label: '단위',         type: 'select', options: ['SI (용해 지수)', 'µg/mL', 'mg P/L', '기타'] },
    ],
    color: '#38bdf8',
    icon: '⚗️',
  },
  {
    key: '사이드로포어',
    label: '사이드로포어 (Siderophore Production)',
    methods: ['CAS 한천 배지법', 'CAS 액체 배지 정량', '형광 측정법 (pyoverdine)'],
    fields: [
      { name: 'result',     label: '결과',         type: 'select', options: ['양성 (+)', '음성 (-)', '약양성 (+/-)'] },
      { name: 'value',      label: 'Halo 크기/생산량', type: 'text', placeholder: '예: 15.2' },
      { name: 'unit',       label: '단위',         type: 'select', options: ['mm (halo)', 'µmol/L', '% 생산율', '기타'] },
    ],
    color: '#ffe066',
    icon: '🔬',
  },
  {
    key: '기타',
    label: '기타 실험',
    methods: [],
    fields: [
      { name: 'result',     label: '결과 요약',    type: 'text',   placeholder: '실험 결과 요약' },
      { name: 'value',      label: '수치 데이터',  type: 'text',   placeholder: '수치 (선택)' },
      { name: 'unit',       label: '단위',         type: 'text',   placeholder: '단위 (선택)' },
    ],
    color: '#8b5cf6',
    icon: '📋',
  },
];

export const DEPOSIT_INSTITUTES = [
  { key: 'KCTC',  label: 'KCTC (한국생명공학연구원 생물자원센터)', country: '한국' },
  { key: 'KACC',  label: 'KACC (농업유전자원센터)',                 country: '한국' },
  { key: 'ATCC',  label: 'ATCC (American Type Culture Collection)', country: '미국' },
  { key: 'DSMZ',  label: 'DSMZ (Deutsche Sammlung von Mikroorganismen)', country: '독일' },
  { key: 'JCM',   label: 'JCM (Japan Collection of Microorganisms)', country: '일본' },
  { key: 'NRRL',  label: 'NRRL (National Center for Agricultural Utilization Research)', country: '미국' },
  { key: 'CGMCC', label: 'CGMCC (China General Microbiological Culture Collection Center)', country: '중국' },
  { key: '기타',  label: '기타 기관', country: '' },
];

export const STATUS_CONFIG = {
  '분석 중':     { color: '#ffe066', icon: '🔄', bg: 'rgba(255,224,102,0.12)' },
  '실험 진행':   { color: '#38bdf8', icon: '⚗️', bg: 'rgba(56,189,248,0.12)' },
  '기탁 완료':   { color: '#39ff8f', icon: '✅', bg: 'rgba(57,255,143,0.12)' },
  '특허 출원 중': { color: '#8b5cf6', icon: '📄', bg: 'rgba(139,92,246,0.12)' },
  '보류':        { color: '#7a87a8', icon: '⏸️', bg: 'rgba(122,135,168,0.12)' },
};
