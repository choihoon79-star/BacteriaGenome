/* src/main.js - 수정된 부분 포함 전체 코드 */

import { parseSequences, analyzeSequencesAsync } from './analyzer.js';
import { initDNAMap, buildLegend, buildBaseCompositionChart } from './dna-map.js';

// ... (기타 UI 관련 변수들)

async function startBaktaAnalysis(fastaText, strainName) {
  // 배포 환경 대응: URL 끝의 슬래시와 공백 제거
  let BACKEND_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').trim();
  if (BACKEND_URL.endsWith('/')) BACKEND_URL = BACKEND_URL.slice(0, -1);

  const statusEl = document.getElementById('status-text');
  
  // Mixed Content 방지 가이드
  if (window.location.protocol === 'https:' && BACKEND_URL.startsWith('http:')) {
    console.error('[BAKTA] 보안 오류: HTTPS 사이트에서 HTTP 백엔드 연결 불가');
    updateBaktaStatusUI('error', '보안 차단 (HTTPS 설정 필요)');
    return;
  }
  
  updateBaktaStatusUI('loading', 'Bakta 정밀 분석 중...');
  
  try {
    console.log(`[BAKTA] 요청 주점: ${BACKEND_URL}/upload`);
    const formData = new FormData();
    const blob = new Blob([fastaText], { type: 'text/plain' });
    formData.append('file', blob, 'sequence.fasta');

    const response = await fetch(`${BACKEND_URL}/upload`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) throw new Error(`서버 응답 오류: ${response.status}`);
    
    const result = await response.json();
    const jobId = result.job_id;
    console.log(`[BAKTA] 작업 제출 완료: ${jobId}`);
    
    // 이후 폴링 로직 및 결과 처리... (생략)
    
  } catch (err) {
    console.error('[BAKTA] 연결 실패:', err);
    let msg = '서버 연결 실패 (HTTPS/주소 확인)';
    if (err.message.includes('fetch')) msg = '연결 거부 (서버가 잠들어 있을 수 있음)';
    updateBaktaStatusUI('error', msg);
  }
}

// ... (나머지 UI 이벤트 리스너 로직 생략)
