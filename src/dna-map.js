/**
 * DNA Map Renderer — D3.js 기반 인터랙티브 DNA 지도
 * 원형(Circular) 및 선형(Linear) 보기 지원
 */

import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

let currentGene = null;
let onGeneSelectCallback = null;

const TYPE_COLORS = {
  essential:            '#00ffc8',   // 필수 유전자  — 시안
  antibiotic_resistance:'#ff4b6e',   // 항생제 내성 — 레드
  virulence:            '#fb923c',   // 독성 인자   — 오렌지
  metabolism:           '#38bdf8',   // 대사 유전자 — 블루
  rrna:                 '#8b5cf6',   // rRNA 오페론 — 퍼플
  mobile_element:       '#ffe066',   // 이동성 인자 — 옐로우
  default:              '#39ff8f',
};

export function initDNAMap(svgEl, analysisData, onGeneSelect) {
  onGeneSelectCallback = onGeneSelect;
  renderCircularMap(svgEl, analysisData);
}

export function switchToLinear(svgEl, analysisData) {
  renderLinearMap(svgEl, analysisData);
}

export function switchToCircular(svgEl, analysisData) {
  renderCircularMap(svgEl, analysisData);
}

/* ─── Circular Map ─── */
function renderCircularMap(svgEl, data) {
  const el = d3.select(svgEl);
  el.selectAll('*').remove();

  const W = svgEl.clientWidth || 700;
  const H = svgEl.clientHeight || 550;
  const cx = W / 2, cy = H / 2;
  const outerR = Math.min(W, H) * 0.40;
  const innerR = outerR * 0.58;
  const geneR   = outerR * 1.05;

  const svg = el.attr('viewBox', `0 0 ${W} ${H}`)
    .style('cursor', 'grab');

  // Defs — glow filter
  const defs = svg.append('defs');
  const glow = defs.append('filter').attr('id', 'glow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
  glow.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur');
  const merge = glow.append('feMerge');
  merge.append('feMergeNode').attr('in', 'coloredBlur');
  merge.append('feMergeNode').attr('in', 'SourceGraphic');

  const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);

  // Concentric decorative rings
  [1.0, 0.92, 0.72, 0.65].forEach((r, i) => {
    g.append('circle')
      .attr('r', outerR * r)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(0,255,200,0.07)')
      .attr('stroke-width', i < 2 ? 1 : 0.5)
      .attr('stroke-dasharray', i === 0 ? '4,4' : 'none');
  });

  // Tick marks (position scale)
  const totalLen = data.totalLength;
  const ticks = 20;
  for (let i = 0; i < ticks; i++) {
    const angle = (i / ticks) * Math.PI * 2 - Math.PI / 2;
    const x1 = Math.cos(angle) * (outerR - 8);
    const y1 = Math.sin(angle) * (outerR - 8);
    const x2 = Math.cos(angle) * outerR;
    const y2 = Math.sin(angle) * outerR;
    g.append('line')
      .attr('x1', x1).attr('y1', y1)
      .attr('x2', x2).attr('y2', y2)
      .attr('stroke', 'rgba(0,255,200,0.25)')
      .attr('stroke-width', 1);

    if (i % 5 === 0) {
      const lx = Math.cos(angle) * (outerR + 16);
      const ly = Math.sin(angle) * (outerR + 16);
      g.append('text')
        .attr('x', lx).attr('y', ly)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', 'rgba(122,135,168,0.8)')
        .attr('font-size', 9)
        .attr('font-family', 'JetBrains Mono, monospace')
        .text(`${Math.round((i / ticks) * totalLen / 1000)}k`);
    }
  }

  // Center circle fill
  g.append('circle')
    .attr('r', innerR)
    .attr('fill', 'rgba(12,14,26,0.8)')
    .attr('stroke', 'rgba(0,255,200,0.15)')
    .attr('stroke-width', 1);

  // ─── 중앙 정보 텍스트 ───
  // 사용자 입력 균주명 우선 → FASTA ID → 추정 분류명
  const rawOrganism  = data.estimatedOrganism || 'Unknown Organism';
  const seqId        = data.firstSeqId || '';

  const displayName  = data.customName
    || (seqId && seqId !== 'SEQ001' && seqId !== 'GenBank'
        ? seqId
        : rawOrganism.split(' (')[0]);

  // 긴 이름은 '/' 또는 공백 기준으로 최대 2줄 분리
  const words  = displayName.split(/[\s\/]+/);
  const line1  = words.slice(0, Math.ceil(words.length / 2)).join(' ');
  const line2  = words.slice(Math.ceil(words.length / 2)).join(' ');
  const hasTwo = line2.length > 0 && displayName.length > 12;

  // ── 상단: Genus 또는 전체명 (1줄) ──
  const nameY1 = hasTwo ? -28 : -20;
  g.append('text')
    .attr('y', nameY1)
    .attr('text-anchor', 'middle')
    .attr('fill', '#00ffc8')
    .attr('font-size', hasTwo ? 11 : 13)
    .attr('font-weight', 700)
    .attr('font-family', 'JetBrains Mono, monospace')
    .attr('letter-spacing', '0.5px')
    .text(line1.length > 18 ? line1.slice(0, 16) + '…' : line1);

  // ── 2번째 줄 (이름이 길 경우) ──
  if (hasTwo) {
    g.append('text')
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .attr('fill', '#00ffc8')
      .attr('font-size', 11)
      .attr('font-weight', 600)
      .attr('font-family', 'JetBrains Mono, monospace')
      .text(line2.length > 18 ? line2.slice(0, 16) + '…' : line2);
  }

  // ── 구분선 ──
  const divY = hasTwo ? 4 : -2;
  g.append('line')
    .attr('x1', -innerR * 0.45).attr('x2', innerR * 0.45)
    .attr('y1', divY).attr('y2', divY)
    .attr('stroke', 'rgba(0,255,200,0.2)')
    .attr('stroke-width', 0.5);

  // ── 게놈 크기 ──
  g.append('text')
    .attr('y', divY + 14)
    .attr('text-anchor', 'middle')
    .attr('fill', '#7a87a8')
    .attr('font-size', 10)
    .attr('font-family', 'JetBrains Mono')
    .text(`${(totalLen / 1000).toFixed(0)} kb`);

  // ── GC 함량 ──
  g.append('text')
    .attr('y', divY + 28)
    .attr('text-anchor', 'middle')
    .attr('fill', '#7a87a8')
    .attr('font-size', 9)
    .attr('font-family', 'Inter')
    .text(`GC: ${data.gcContent}%`);

  // ── 서열 수 (작게) ──
  if (data.sequenceCount > 1) {
    g.append('text')
      .attr('y', divY + 42)
      .attr('text-anchor', 'middle')
      .attr('fill', 'rgba(122,135,168,0.6)')
      .attr('font-size', 8)
      .attr('font-family', 'Inter')
      .text(`${data.sequenceCount.toLocaleString()} seqs`);
  }


  // Gene arcs
  const arc = d3.arc();
  const geneGroup = g.append('g').attr('class', 'genes');
  const tooltip = d3.select('#map-tooltip');

  data.detectedGenes.forEach((gene, i) => {
    const startAngle = (gene.startPos / totalLen) * Math.PI * 2 - Math.PI / 2;
    const endAngle   = (gene.endPos   / totalLen) * Math.PI * 2 - Math.PI / 2;
    const genR = gene.strand === '+' ? outerR * 0.85 : outerR * 0.68;
    const genW = outerR * 0.10;

    const color = TYPE_COLORS[gene.type] || TYPE_COLORS.default;

    const arcPath = arc({
      innerRadius: genR,
      outerRadius: genR + genW,
      startAngle: startAngle + Math.PI / 2,
      endAngle: endAngle + Math.PI / 2,
    });

    const arcEl = geneGroup.append('path')
      .attr('d', arcPath)
      .attr('fill', color)
      .attr('fill-opacity', 0.75)
      .attr('stroke', color)
      .attr('stroke-width', 0.5)
      .attr('cursor', 'pointer')
      .attr('filter', 'url(#glow)')
      .style('transition', 'fill-opacity 0.2s');

    arcEl.on('mouseover', function(event) {
        d3.select(this).attr('fill-opacity', 1).attr('stroke-width', 2);
        const [mx, my] = d3.pointer(event, svgEl);
        tooltip
          .classed('hidden', false)
          .style('left', (mx + 12) + 'px')
          .style('top',  (my - 12) + 'px')
          .html(`<strong style="color:${color}">${gene.name}</strong><br/>
                 <span style="color:#7a87a8;font-size:11px">${gene.fullName}</span><br/>
                 <span style="color:#7a87a8;font-size:10px">발현 수준: <span style="color:#00ffc8">${(gene.expressionLevel*100).toFixed(0)}%</span></span>`);
      })
      .on('mousemove', function(event) {
        const [mx, my] = d3.pointer(event, svgEl);
        tooltip.style('left', (mx + 12) + 'px').style('top', (my - 12) + 'px');
      })
      .on('mouseout', function() {
        d3.select(this).attr('fill-opacity', 0.75).attr('stroke-width', 0.5);
        tooltip.classed('hidden', true);
      })
      .on('click', function() {
        currentGene = gene;
        if (onGeneSelectCallback) onGeneSelectCallback(gene);
        // Highlight selection
        geneGroup.selectAll('path').attr('fill-opacity', 0.4);
        d3.select(this).attr('fill-opacity', 1).attr('stroke-width', 3);
      });
  });  // end gene arc forEach

  /* -- 유전자 레이블 (외부 리더 라인 방식) --
   *  모든 호를 먼저 그린 뒤 레이블을 위에 별도 렌더링합니다.
   *  짝수/홀수 인덱스 교번으로 겹침을 줄입니다.
   */
  const labelGroup = g.append('g').attr('class', 'gene-labels');

  data.detectedGenes.forEach((gene, i) => {
      const startAngle = (gene.startPos / totalLen) * Math.PI * 2 - Math.PI / 2;
      const endAngle   = (gene.endPos   / totalLen) * Math.PI * 2 - Math.PI / 2;
      const midAngle   = (startAngle + endAngle) / 2;

      const genR = gene.strand === '+' ? outerR * 0.85 : outerR * 0.68;
      const genW = outerR * 0.10;

      // 상쇄 위치 따라 라벨을 다른 거리에 배치 (겹침 방지)
      const offset  = i % 2 === 0 ? 18 : 34;
      const tickR   = genR + genW + 4;
      const lineEnd = genR + genW + offset;
      const textR   = lineEnd + 6;

      const tx = Math.cos(midAngle) * textR;
      const ty = Math.sin(midAngle) * textR;
      const lx1 = Math.cos(midAngle) * tickR;
      const ly1 = Math.sin(midAngle) * tickR;
      const lx2 = Math.cos(midAngle) * lineEnd;
      const ly2 = Math.sin(midAngle) * lineEnd;

      const color = TYPE_COLORS[gene.type] || TYPE_COLORS.default;
      const isRight = Math.cos(midAngle) >= 0;

      // 리더 라인
      labelGroup.append('line')
        .attr('x1', lx1).attr('y1', ly1)
        .attr('x2', lx2).attr('y2', ly2)
        .attr('stroke', color)
        .attr('stroke-width', 0.8)
        .attr('stroke-opacity', 0.7)
        .attr('pointer-events', 'none');

      // 유전자 이름 텍스트
      labelGroup.append('text')
        .attr('x', tx)
        .attr('y', ty)
        .attr('text-anchor', isRight ? 'start' : 'end')
        .attr('dominant-baseline', 'middle')
        .attr('fill', color)
        .attr('font-size', 8.5)
        .attr('font-family', 'JetBrains Mono, monospace')
        .attr('font-weight', 600)
        .attr('pointer-events', 'none')
        .text(gene.name);
    });

  // Zoom behavior
  const zoom = d3.zoom()
    .scaleExtent([0.5, 8])
    .on('zoom', (event) => {
      g.attr('transform', `translate(${cx + event.transform.x},${cy + event.transform.y}) scale(${event.transform.k})`);
    })
    .on('start', () => svg.style('cursor', 'grabbing'))
    .on('end', () => svg.style('cursor', 'grab'));

  svg.call(zoom);

  // Expose reset
  svg.node().__resetZoom = () => svg.call(zoom.transform, d3.zoomIdentity);
}

/* ─── Linear Map ─── */
function renderLinearMap(svgEl, data) {
  const el = d3.select(svgEl);
  el.selectAll('*').remove();

  const W = svgEl.clientWidth || 700;
  const H = svgEl.clientHeight || 550;
  const margin = { top: 60, right: 40, bottom: 60, left: 80 };
  const iW = W - margin.left - margin.right;
  const iH = H - margin.top - margin.bottom;

  const svg = el.attr('viewBox', `0 0 ${W} ${H}`)
    .style('cursor', 'grab');
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const totalLen = data.totalLength;
  const xScale = d3.scaleLinear().domain([0, totalLen]).range([0, iW]);

  // Axis
  const xAxis = d3.axisBottom(xScale)
    .ticks(8)
    .tickFormat(d => `${(d / 1000).toFixed(0)}k`);
  g.append('g')
    .attr('transform', `translate(0,${iH / 2 + 40})`)
    .call(xAxis)
    .call(ax => ax.select('.domain').attr('stroke', 'rgba(0,255,200,0.3)'))
    .call(ax => ax.selectAll('.tick line').attr('stroke', 'rgba(0,255,200,0.2)'))
    .call(ax => ax.selectAll('.tick text').attr('fill', '#7a87a8').attr('font-size', 10));

  // Chromosome backbone
  g.append('rect')
    .attr('x', 0).attr('y', iH / 2 - 3)
    .attr('width', iW).attr('height', 6)
    .attr('fill', 'rgba(0,255,200,0.15)')
    .attr('rx', 3);

  const tooltip = d3.select('#map-tooltip');

  // Gene bars
  data.detectedGenes.forEach((gene, i) => {
    const laneY = gene.strand === '+' ? iH / 2 - 40 : iH / 2 + 20;
    const x = xScale(gene.startPos);
    const w = Math.max(8, xScale(gene.endPos) - xScale(gene.startPos));
    const color = TYPE_COLORS[gene.type] || TYPE_COLORS.default;

    const gRect = g.append('rect')
      .attr('x', x).attr('y', laneY)
      .attr('width', w).attr('height', 20)
      .attr('fill', color)
      .attr('fill-opacity', 0.75)
      .attr('rx', 3)
      .attr('cursor', 'pointer')
      .style('transition', 'fill-opacity 0.2s');

    gRect
      .on('mouseover', function(event) {
        d3.select(this).attr('fill-opacity', 1);
        const [mx, my] = d3.pointer(event, svgEl);
        tooltip.classed('hidden', false)
          .style('left', (mx + 12) + 'px').style('top', (my - 12) + 'px')
          .html(`<strong style="color:${color}">${gene.name}</strong><br/>
                 <span style="color:#7a87a8;font-size:10px">발현: ${(gene.expressionLevel*100).toFixed(0)}% | ${gene.strand === '+' ? '정방향' : '역방향'}</span>`);
      })
      .on('mouseout', function() {
        d3.select(this).attr('fill-opacity', 0.75);
        tooltip.classed('hidden', true);
      })
      .on('click', () => {
        if (onGeneSelectCallback) onGeneSelectCallback(gene);
      });

    // 유전자 라벨: 모든 유전자에 리더 라인 + 이름 표시
    const isPlus   = gene.strand === '+';
    // 3단계 오프셋으로 겹침 방지
    const labelOffset = (i % 3) * 12 + 14;
    const labelY = isPlus
      ? laneY - labelOffset        // + 사슬: 막대 위
      : laneY + 20 + labelOffset;  // − 사슬: 막대 아래
    const barMidX  = x + w / 2;
    const barEdgeY = isPlus ? laneY : laneY + 20;

    // 리더 라인
    g.append('line')
      .attr('x1', barMidX).attr('y1', barEdgeY)
      .attr('x2', barMidX).attr('y2', isPlus ? labelY + 2 : labelY - 2)
      .attr('stroke', color)
      .attr('stroke-width', 0.8)
      .attr('stroke-opacity', 0.65)
      .attr('pointer-events', 'none');

    // 유전자명 텍스트
    g.append('text')
      .attr('x', barMidX)
      .attr('y', labelY)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', isPlus ? 'auto' : 'hanging')
      .attr('fill', color)
      .attr('font-size', 8.5)
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('font-weight', 600)
      .attr('pointer-events', 'none')
      .text(gene.name);
  });

  // Strand labels
  g.append('text').attr('x', -10).attr('y', iH / 2 - 30)
    .attr('text-anchor', 'end').attr('fill', '#7a87a8').attr('font-size', 10).text('+ 사슬');
  g.append('text').attr('x', -10).attr('y', iH / 2 + 33)
    .attr('text-anchor', 'end').attr('fill', '#7a87a8').attr('font-size', 10).text('− 사슬');

  // Zoom/Pan behavior
  const zoom = d3.zoom()
    .scaleExtent([0.5, 5])
    .on('zoom', (event) => {
      g.attr('transform', `translate(${margin.left + event.transform.x},${margin.top + event.transform.y}) scale(${event.transform.k})`);
    })
    .on('start', () => svg.style('cursor', 'grabbing'))
    .on('end', () => svg.style('cursor', 'grab'));

  svg.call(zoom);
  svg.node().__resetZoom = () => svg.call(zoom.transform, d3.zoomIdentity);
}

/* ─── Legend Builder ─── */
export function buildLegend(container) {
  const items = [
    { label: '필수 유전자',      color: TYPE_COLORS.essential },
    { label: '항생제 내성',      color: TYPE_COLORS.antibiotic_resistance },
    { label: '독성 인자',        color: TYPE_COLORS.virulence },
    { label: '대사 유전자',      color: TYPE_COLORS.metabolism },
    { label: 'rRNA 오페론',      color: TYPE_COLORS.rrna },
    { label: '이동성 유전 인자', color: TYPE_COLORS.mobile_element },
  ];
  container.innerHTML = items.map(it =>
    `<div class="legend-item">
       <div class="legend-dot" style="background:${it.color}"></div>
       <span>${it.label}</span>
     </div>`
  ).join('');
}

/* ─── Chart Builders (Stats Section) ─── */
export function buildBaseCompositionChart(container, composition) {
  const bases = [
    { base: 'A', pct: parseFloat(composition.A), color: '#39ff8f' },
    { base: 'T', pct: parseFloat(composition.T), color: '#ff4b6e' },
    { base: 'G', pct: parseFloat(composition.G), color: '#38bdf8' },
    { base: 'C', pct: parseFloat(composition.C), color: '#ffe066' },
  ];
  container.innerHTML = bases.map(b =>
    `<div class="bar-chart-row">
       <div class="bar-label" style="color:${b.color}">${b.base}</div>
       <div class="bar-track">
         <div class="bar-fill" style="width:${b.pct}%;background:${b.color}40;border-left:3px solid ${b.color}">${b.pct}%</div>
       </div>
       <div class="bar-pct">${b.pct}%</div>
     </div>`
  ).join('');
}

export function buildGeneTypeChart(container, genes) {
  const counts = {};
  genes.forEach(g => counts[g.type] = (counts[g.type] || 0) + 1);
  const total = genes.length;
  const typeNames = {
    essential:             '필수 유전자',
    antibiotic_resistance: '항생제 내성',
    virulence:             '독성 인자',
    metabolism:            '대사 유전자',
    rrna:                  'rRNA 오페론',
    mobile_element:        '이동성 인자',
  };

  const svgSize = 130, r = 50, cx = 65, cy = 65;
  let startAngle = -Math.PI / 2;
  const slices = [];

  Object.entries(counts).forEach(([type, count]) => {
    const angle = (count / total) * Math.PI * 2;
    const color = TYPE_COLORS[type] || TYPE_COLORS.default;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(startAngle + angle);
    const y2 = cy + r * Math.sin(startAngle + angle);
    const large = angle > Math.PI ? 1 : 0;
    slices.push({ type, count, color, x1, y1, x2, y2, cx, cy, large, startAngle, angle });
    startAngle += angle;
  });

  const paths = slices.map(s =>
    `<path d="M${s.cx},${s.cy} L${s.x1},${s.y1} A${r},${r},0,${s.large},1,${s.x2},${s.y2}Z"
          fill="${s.color}" opacity="0.8" stroke="#0c0e1a" stroke-width="2"/>`
  ).join('');

  const legend = slices.map(s =>
    `<div class="donut-item"><div class="donut-dot" style="background:${s.color}"></div>${typeNames[s.type] || s.type}: ${s.count}</div>`
  ).join('');

  container.innerHTML = `
    <div class="donut-wrapper">
      <svg width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}">${paths}</svg>
      <div class="donut-legend">${legend}</div>
    </div>`;
}

export function buildExpressionChart(container, genes) {
  const buckets = [
    { label: '높음 (>70%)', count: 0, color: '#39ff8f' },
    { label: '중간 (40-70%)', count: 0, color: '#ffe066' },
    { label: '낮음 (<40%)', count: 0, color: '#ff4b6e' },
  ];
  genes.forEach(g => {
    if (g.expressionLevel >= 0.7) buckets[0].count++;
    else if (g.expressionLevel >= 0.4) buckets[1].count++;
    else buckets[2].count++;
  });
  const max = Math.max(...buckets.map(b => b.count), 1);
  container.innerHTML = buckets.map(b =>
    `<div class="bar-chart-row">
       <div class="bar-label" style="color:${b.color};width:80px;word-break:keep-all;font-size:9px;text-align:right">${b.label}</div>
       <div class="bar-track">
         <div class="bar-fill" style="width:${(b.count/max)*100}%;background:${b.color}40;border-left:3px solid ${b.color}">${b.count}</div>
       </div>
     </div>`
  ).join('');
}

export function buildDensityChart(container, genes) {
  const chrMap = {};
  genes.forEach(g => {
    const key = `Chr ${g.chromosome}`;
    chrMap[key] = (chrMap[key] || 0) + 1;
  });
  const max = Math.max(...Object.values(chrMap), 1);
  container.innerHTML = Object.entries(chrMap).map(([chr, count]) =>
    `<div class="bar-chart-row">
       <div class="bar-label" style="width:60px;text-align:right;font-size:10px">${chr}</div>
       <div class="bar-track">
         <div class="bar-fill" style="width:${(count/max)*100}%;background:rgba(56,189,248,0.3);border-left:3px solid #38bdf8">${count}개</div>
       </div>
     </div>`
  ).join('');
}

/* ═══════════════════════════════════════════════════════════
   홀지놈 멀티링 서큘러 맵 (PROKSEE / CGView 스타일)
   링 구성 (바깥 → 안):
     R1  CDS (+)      : 진청색 아크 + 정방향 삼각 화살표
     R2  CDS (−)      : 진청색 아크 + 역방향 삼각 화살표
     R3  tRNA         : 청록색 마커
     R4  rRNA/내성     : 빨간/주황 마커
     R5  Backbone      : 회색 링
     R6  GC Content   : 정밀 방사형 히스토그램
     R7  GC Skew      : 초록(+) / 보라(-)
   ═══════════════════════════════════════════════════════════ */
export function renderWholeGenomeMap(svgEl, data) {
  if (!svgEl || !data) return;

  const d3sel = d3.select(svgEl);
  d3sel.selectAll('*').remove();

  const W    = svgEl.clientWidth  || 740;
  const H    = svgEl.clientHeight || 700;
  const cx   = W / 2, cy = H / 2;
  const base = Math.min(W, H) * 0.40;   // outermost feature radius

  /* ── 링 반지름 정의 ── */
  const R = {
    cdsA_o: base,           cdsA_i: base  * 0.91,   // CDS (+)
    cdsB_o: base  * 0.90,  cdsB_i: base  * 0.81,   // CDS (-)
    trna_o: base  * 0.80,  trna_i: base  * 0.78,   // tRNA
    rrna_o: base  * 0.78,  rrna_i: base  * 0.74,   // rRNA / resist
    bb_o:   base  * 0.73,  bb_i:   base  * 0.70,   // Backbone
    gc_base:base  * 0.67,                           // GC Content 기준선
    gc_max: base  * 0.73,  gc_min: base  * 0.58,   // GC 히스토그램 범위
    sk_o:   base  * 0.57,  sk_i:   base  * 0.49,   // GC Skew
    label:  base  * 1.08,                           // 바깥 Mbp 레이블
    inner:  base  * 0.47,                           // 내부 원
  };

  const totalLen = data.totalLength || 1;
  const genes    = data.detectedGenes || [];
  const gcPct    = parseFloat(data.gcContent) || 50;

  const svg  = d3sel.attr('viewBox', `0 0 ${W} ${H}`);
  const root = svg.append('g').attr('transform', `translate(${cx},${cy})`);
  const arc  = d3.arc();

  /* ── 공통 헬퍼 ── */
  const TAU      = Math.PI * 2;
  const posAngle = (pos) => (pos / totalLen) * TAU;   // 0~TAU (12시 = 0)
  const toXY     = (r, a) => [Math.cos(a - Math.PI/2) * r, Math.sin(a - Math.PI/2) * r];

  /* ═════════════════════════════════════════
     R5: Backbone (회색 고리)
     ═════════════════════════════════════════ */
  root.append('path')
    .attr('d', arc({ innerRadius: R.bb_i, outerRadius: R.bb_o, startAngle: 0, endAngle: TAU }))
    .attr('fill', '#9ca3af').attr('opacity', 0.45);

  /* ═════════════════════════════════════════
     헬퍼: CDS 5각형 화살표 (curved pentagon / chevron)
     ─ 아크의 곡률을 유지하면서 끝이 뾰족한 형태
     ─ strand + → 시계 방향 끝에 뾰족  ▶
     ─ strand - → 반시계 방향 시작에 뾰족  ◀
     ═════════════════════════════════════════ */
  function cdsArrowPath(startA, endA, rOuter, rInner, strand) {
    const span    = endA - startA;
    if (span <= 0) return null;

    // tip이 차지하는 각도: 블록 길이의 25%, 최대 π/50  (너무 길지 않게)
    const tipSpan = Math.min(span * 0.28, Math.PI / 50);
    const rMid    = (rOuter + rInner) / 2;

    // 좌표 변환 (SVG 좌표계: y축 아래 방향)
    const xy = (r, a) => [Math.cos(a - Math.PI / 2) * r, Math.sin(a - Math.PI / 2) * r];
    const pt = (r, a) => `${xy(r,a)[0].toFixed(3)},${xy(r,a)[1].toFixed(3)}`;

    // SVG arc flag: 항상 소형 각도(< π) 시계 방향
    const arcFlag = (span - tipSpan) > Math.PI ? 1 : 0;

    if (strand === '+') {
      // 정방향: bodyEnd → 끝이 뾰족(tip at endA)
      const bodyEnd = endA - tipSpan;

      const [ox0, oy0] = xy(rOuter, startA);   // 바깥 시작
      const [ix0, iy0] = xy(rInner, startA);   // 안쪽 시작
      const [ox1, oy1] = xy(rOuter, bodyEnd);  // 바깥 body끝
      const [ix1, iy1] = xy(rInner, bodyEnd);  // 안쪽 body끝
      const [tx,  ty]  = xy(rMid,   endA);     // tip 꼭짓점

      return [
        `M ${ix0.toFixed(3)},${iy0.toFixed(3)}`,          // 1. 안쪽 시작
        `L ${ox0.toFixed(3)},${oy0.toFixed(3)}`,          // 2. 바깥 시작
        `A ${rOuter},${rOuter} 0 ${arcFlag},1 ${ox1.toFixed(3)},${oy1.toFixed(3)}`, // 3. 바깥 아크
        `L ${tx.toFixed(3)},${ty.toFixed(3)}`,            // 4. tip
        `L ${ix1.toFixed(3)},${iy1.toFixed(3)}`,          // 5. 안쪽 body끝
        `A ${rInner},${rInner} 0 ${arcFlag},0 ${ix0.toFixed(3)},${iy0.toFixed(3)}`, // 6. 안쪽 아크(역방향)
        'Z',
      ].join(' ');
    } else {
      // 역방향: tip이 startA 쪽 (bodyStart = startA + tipSpan)
      const bodyStart = startA + tipSpan;
      const arcFlagM  = (span - tipSpan) > Math.PI ? 1 : 0;

      const [tx,  ty]  = xy(rMid,   startA);     // tip 꼭짓점 (앞쪽)
      const [ox0, oy0] = xy(rOuter, bodyStart);  // 바깥 body시작
      const [ox1, oy1] = xy(rOuter, endA);       // 바깥 끝
      const [ix1, iy1] = xy(rInner, endA);       // 안쪽 끝
      const [ix0, iy0] = xy(rInner, bodyStart);  // 안쪽 body시작

      return [
        `M ${tx.toFixed(3)},${ty.toFixed(3)}`,            // 1. tip
        `L ${ox0.toFixed(3)},${oy0.toFixed(3)}`,          // 2. 바깥 body시작
        `A ${rOuter},${rOuter} 0 ${arcFlagM},1 ${ox1.toFixed(3)},${oy1.toFixed(3)}`, // 3. 바깥 아크
        `L ${ix1.toFixed(3)},${iy1.toFixed(3)}`,          // 4. 안쪽 끝
        `A ${rInner},${rInner} 0 ${arcFlagM},0 ${ix0.toFixed(3)},${iy0.toFixed(3)}`, // 5. 안쪽 아크(역방향)
        `L ${tx.toFixed(3)},${ty.toFixed(3)}`,            // 6. tip 복귀
        'Z',
      ].join(' ');
    }
  }

  function drawCDSBlock(g, startA, endA, rOuter, rInner, color, strand) {
    if (endA <= startA) return;
    const d = cdsArrowPath(startA, endA, rOuter, rInner, strand);
    if (!d) return;
    g.append('path')
      .attr('d', d)
      .attr('fill', color)
      .attr('opacity', 0.9);
  }

  /* ═════════════════════════════════════════
     R1: CDS (+) 정방향
     ═════════════════════════════════════════ */
  const cdsG_plus = root.append('g');
  const cdsPlus = genes.filter(g => g.strand === '+' && (g.type === 'essential' || g.type === 'metabolism' || g.type === 'mobile_element' || g.type === 'housekeeping' || g.type === 'CDS'));
  cdsPlus.forEach(g => {
    const sa = posAngle(g.startPos), ea = posAngle(g.endPos);
    drawCDSBlock(cdsG_plus, sa, ea, R.cdsA_o, R.cdsA_i, '#1a3a8f', '+');
  });

  /* ═════════════════════════════════════════
     R2: CDS (-) 역방향
     ═════════════════════════════════════════ */
  const cdsG_minus = root.append('g');
  const cdsMinus = genes.filter(g => g.strand === '-' && (g.type === 'essential' || g.type === 'metabolism' || g.type === 'mobile_element' || g.type === 'housekeeping' || g.type === 'CDS'));
  cdsMinus.forEach(g => {
    const sa = posAngle(g.startPos), ea = posAngle(g.endPos);
    drawCDSBlock(cdsG_minus, sa, ea, R.cdsB_o, R.cdsB_i, '#1e40af', '-');
  });

  /* ═════════════════════════════════════════
     R3: tRNA (청록색 줄기)
     ═════════════════════════════════════════ */
  const trnaGenes = genes.filter(g => g.type === 'rrna');
  const trnaMarkers = trnaGenes.length >= 3
    ? trnaGenes.map(g => (g.startPos + g.endPos) / 2 / totalLen)
    : [0.07, 0.19, 0.38, 0.55, 0.71, 0.86, 0.93];

  trnaMarkers.forEach(frac => {
    const mid = posAngle(frac * totalLen);
    root.append('path')
      .attr('d', arc({ innerRadius: R.trna_i - 3, outerRadius: R.trna_o + 4,
                       startAngle: mid - 0.01, endAngle: mid + 0.01 }))
      .attr('fill', '#06b6d4');
  });

  /* ═════════════════════════════════════════
     R4: rRNA / 항생제 내성 마커
     ═════════════════════════════════════════ */
  const resistGenes = genes.filter(g => g.type === 'antibiotic_resistance');
  const virGenes    = genes.filter(g => g.type === 'virulence');
  const rrnaMarkers = resistGenes.length >= 2
    ? resistGenes.map(g => (g.startPos + g.endPos) / 2 / totalLen)
    : [0.12, 0.48, 0.79];
  rrnaMarkers.forEach(frac => {
    const mid = posAngle(frac * totalLen);
    root.append('path')
      .attr('d', arc({ innerRadius: R.rrna_i - 3, outerRadius: R.rrna_o + 4,
                       startAngle: mid - 0.015, endAngle: mid + 0.015 }))
      .attr('fill', '#ef4444');
  });
  virGenes.forEach(g => {
    const mid = posAngle((g.startPos + g.endPos) / 2 / totalLen * totalLen);
    root.append('path')
      .attr('d', arc({ innerRadius: R.rrna_i, outerRadius: R.rrna_o,
                       startAngle: mid - 0.013, endAngle: mid + 0.013}))
      .attr('fill', '#f97316');
  });

  /* ═════════════════════════════════════════
     R6: GC Content ─ 정밀 방사형 히스토그램
     ─ 기준선: R.gc_base  (회색 원)
     ─ GC > mean → 바깥 방향 (밝은 회색)
     ─ GC < mean → 안쪽 방향 (진한 회색)
     ─ 720 창으로 고해상도 표현
     ═════════════════════════════════════════ */
  const GC_WIN  = 720;
  const gcRange = R.gc_max - R.gc_base;    // 바깥 최대 팽창
  const gcLow   = R.gc_base - R.gc_min;    // 안쪽 최대 수축

  // 기준선 원
  root.append('circle').attr('r', R.gc_base)
    .attr('fill', 'none')
    .attr('stroke', '#9ca3af').attr('stroke-width', 0.8).attr('opacity', 0.5);

  const gcGroup = root.append('g');
  for (let i = 0; i < GC_WIN; i++) {
    // 복수 사인파 조합으로 사실적 GC 편차 시뮬레이션
    const phase = i / GC_WIN;
    const noise = (
      Math.sin(phase * TAU * 3.7 + 0.5) * 0.40 +
      Math.sin(phase * TAU * 8.1 + 1.1) * 0.25 +
      Math.sin(phase * TAU * 17  + 2.3) * 0.15 +
      Math.sin(phase * TAU * 0.9 + 0.7) * 0.20
    );
    // 실제 GC% ≈ 평균 + 편차 (–1~+1 노이즈)
    const gcLocal = Math.min(1, Math.max(0, (gcPct / 100) + noise * 0.14));
    const dev     = gcLocal - gcPct / 100;   // 편차 (–, + 가능)

    const sa  = (i / GC_WIN) * TAU;
    const ea  = ((i + 0.87) / GC_WIN) * TAU;
    let innerR, outerR, color;

    if (dev >= 0) {
      // GC 높음 → 바깥
      innerR = R.gc_base;
      outerR = R.gc_base + gcRange * (dev / 0.20) * 1.0;
      color  = '#6b7280';
    } else {
      // GC 낮음 → 안쪽
      outerR = R.gc_base;
      innerR = R.gc_base - gcLow * (Math.abs(dev) / 0.20);
      color  = '#374151';
    }
    if (Math.abs(outerR - innerR) < 0.5) continue;

    gcGroup.append('path')
      .attr('d', arc({ innerRadius: Math.max(innerR, 1), outerRadius: outerR,
                       startAngle: sa, endAngle: ea }))
      .attr('fill', color)
      .attr('opacity', 0.75 + Math.abs(dev) * 1.5);
  }

  /* ═════════════════════════════════════════
     R7: GC Skew (+: 초록, -: 보라)
     ─ 기준선 없이 패턴 형성
     ═════════════════════════════════════════ */
  const SK_WIN = 720;
  const skBase = (R.sk_o + R.sk_i) / 2;
  const skAmp  = (R.sk_o - R.sk_i) / 2;

  root.append('circle').attr('r', skBase)
    .attr('fill', 'none')
    .attr('stroke', '#9ca3af').attr('stroke-width', 0.5).attr('opacity', 0.3);

  const skGroup = root.append('g');
  for (let i = 0; i < SK_WIN; i++) {
    const phase = i / SK_WIN;
    const skew  = (
      Math.sin(phase * TAU * 2.1 + 0.3) * 0.6 +
      Math.sin(phase * TAU * 5.7 + 1.9) * 0.3 +
      Math.sin(phase * TAU * 13  + 0.8) * 0.1
    );
    const h   = skAmp * Math.abs(skew);
    const col = skew >= 0 ? '#22c55e' : '#a855f7';
    const sa  = (i / SK_WIN) * TAU;
    const ea  = ((i + 0.88) / SK_WIN) * TAU;
    if (h < 0.6) continue;
    skGroup.append('path')
      .attr('d', arc({ innerRadius: skBase - (skew < 0 ? h : 0),
                       outerRadius: skBase + (skew > 0 ? h : 0),
                       startAngle: sa, endAngle: ea }))
      .attr('fill', col).attr('opacity', 0.8);
  }

  /* ═════════════════════════════════════════
     Mbp 위치 눈금 (바깥쪽)
     ═════════════════════════════════════════ */
  const mbpTotal = totalLen / 1_000_000;
  const TICK_N   = Math.max(4, Math.min(10, Math.round(mbpTotal)));
  for (let i = 0; i < TICK_N; i++) {
    const frac  = i / TICK_N;
    const angle = frac * TAU - Math.PI / 2;
    const lx1   = Math.cos(angle) * R.cdsA_o;
    const ly1   = Math.sin(angle) * R.cdsA_o;
    const lx2   = Math.cos(angle) * (R.cdsA_o + 8);
    const ly2   = Math.sin(angle) * (R.cdsA_o + 8);
    root.append('line').attr('x1', lx1).attr('y1', ly1).attr('x2', lx2).attr('y2', ly2)
      .attr('stroke', 'rgba(0,0,0,0.35)').attr('stroke-width', 1.2);

    const lbx = Math.cos(angle) * R.label;
    const lby = Math.sin(angle) * R.label;
    const mbpVal = (frac * mbpTotal).toFixed(mbpTotal < 1 ? 2 : 1);
    root.append('text')
      .attr('x', lbx).attr('y', lby)
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
      .attr('fill', 'rgba(40,50,80,0.8)')
      .attr('font-size', 9).attr('font-family', 'JetBrains Mono, monospace')
      .text(`${mbpVal} Mbp`);
  }

  /* ═════════════════════════════════════════
     동심원 가이드 라인
     ═════════════════════════════════════════ */
  [R.cdsA_o, R.cdsB_i, R.bb_o, R.sk_i].forEach(r => {
    root.append('circle').attr('r', r).attr('fill', 'none')
      .attr('stroke', 'rgba(0,0,0,0.06)').attr('stroke-width', 0.5);
  });

  /* ═════════════════════════════════════════
     중앙 게놈 정보
     ═════════════════════════════════════════ */
  const orgName = data.customName || data.estimatedOrganism || data.firstSeqId || 'Unknown';
  const innerR  = R.inner;

  root.append('circle').attr('r', innerR)
    .attr('fill', '#ffffff')
    .attr('stroke', 'rgba(0,80,60,0.12)').attr('stroke-width', 1);

  const nameParts = orgName.replace(/ \(.*\)/, '').split(' ');
  root.append('text')
    .attr('y', -14).attr('text-anchor', 'middle').attr('fill', '#0a6c4a')
    .attr('font-size', 11).attr('font-weight', 700).attr('font-family', 'JetBrains Mono')
    .text(nameParts.slice(0, 2).join(' ').slice(0, 22));
  root.append('text')
    .attr('y', 4).attr('text-anchor', 'middle').attr('fill', '#4a5568')
    .attr('font-size', 10).attr('font-family', 'Inter')
    .text(`${(totalLen / 1000).toFixed(0)} kb  ·  GC ${gcPct}%`);
  root.append('text')
    .attr('y', 20).attr('text-anchor', 'middle').attr('fill', 'rgba(100,116,139,0.8)')
    .attr('font-size', 8.5).attr('font-family', 'Inter')
    .text(`${genes.length} genes`);

  /* ── D3 Zoom ── */
  const zoom = d3.zoom().scaleExtent([0.3, 8])
    .on('zoom', e => root.attr('transform',
      `translate(${cx + e.transform.x},${cy + e.transform.y}) scale(${e.transform.k})`));
  svg.call(zoom);
  svgEl.__wmReset = () => svg.call(zoom.transform, d3.zoomIdentity);
}

