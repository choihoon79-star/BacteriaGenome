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
  CDS:                  '#4dabf7',   // 일반 유전자 — 밝은 블루 (가시성 대폭 개선)
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

  const svg = el.attr('viewBox', `0 0 ${W} ${H}`).style('cursor', 'grab');

  const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);

  // 중앙 정보
  const totalLen = data.totalLength;
  g.append('circle').attr('r', innerR).attr('fill', 'rgba(12,14,26,0.9)').attr('stroke', 'rgba(0,255,200,0.2)').attr('stroke-width', 1);
  const displayName = (data.customName || data.firstSeqId || 'Genome').slice(0, 15);
  g.append('text').attr('y', -10).attr('text-anchor', 'middle').attr('fill', '#00ffc8').attr('font-size', 13).attr('font-weight', 700).text(displayName);
  g.append('text').attr('y', 15).attr('text-anchor', 'middle').attr('fill', '#7a87a8').attr('font-size', 10).text(`${(totalLen / 1000).toFixed(0)} kb | GC ${data.gcContent}%`);

  // DNA 눈금
  const ticks = 20;
  for (let i = 0; i < ticks; i++) {
    const angle = (i / ticks) * Math.PI * 2 - Math.PI / 2;
    const x1 = Math.cos(angle) * (outerR + 5);
    const y1 = Math.sin(angle) * (outerR + 5);
    const x2 = Math.cos(angle) * (outerR + 12);
    const y2 = Math.sin(angle) * (outerR + 12);
    g.append('line').attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2).attr('stroke', 'rgba(122,135,168,0.4)').attr('stroke-width', 1);
    if (i % 5 === 0) {
      const lx = Math.cos(angle) * (outerR + 25);
      const ly = Math.sin(angle) * (outerR + 25);
      g.append('text').attr('x', lx).attr('y', ly).attr('text-anchor', 'middle').attr('dominant-baseline', 'middle').attr('fill', '#7a87a8').attr('font-size', 9).text(`${Math.round((i/ticks)*totalLen/1000)}k`);
    }
  }

  const arc = d3.arc();
  const geneGroup = g.append('g').attr('class', 'genes');
  const tooltip = d3.select('#map-tooltip');

  const genes = data.detectedGenes || [];
  genes.forEach((gene) => {
    const startAngle = (gene.startPos / totalLen) * Math.PI * 2 - Math.PI / 2;
    const endAngle   = (gene.endPos   / totalLen) * Math.PI * 2 - Math.PI / 2;
    const genR = gene.strand === '+' ? outerR * 0.88 : outerR * 0.72;
    const genW = outerR * 0.12;
    const color = TYPE_COLORS[gene.type] || TYPE_COLORS.default;

    const arcPath = arc({
      innerRadius: genR,
      outerRadius: genR + genW,
      startAngle: startAngle + Math.PI / 2,
      endAngle: endAngle + Math.PI / 2,
    });

    geneGroup.append('path')
      .attr('d', arcPath)
      .attr('fill', color)
      .attr('fill-opacity', 0.8)
      .attr('stroke', 'rgba(12,14,26,0.3)')
      .attr('stroke-width', 0.5)
      .attr('cursor', 'pointer')
      .on('mouseover', function(event) {
        d3.select(this).attr('fill-opacity', 1).attr('stroke', '#fff').attr('stroke-width', 1.5);
        tooltip.classed('hidden', false).html(`<strong style="color:${color}">${gene.name}</strong><br/><span style="font-size:11px">${gene.fullName}</span>`);
      })
      .on('mousemove', (e) => tooltip.style('left', (e.pageX + 10) + 'px').style('top', (e.pageY - 10) + 'px'))
      .on('mouseout', function() {
        d3.select(this).attr('fill-opacity', 0.8).attr('stroke', 'rgba(12,14,26,0.3)').attr('stroke-width', 0.5);
        tooltip.classed('hidden', true);
      })
      .on('click', () => { if (onGeneSelectCallback) onGeneSelectCallback(gene); });
  });

  // 주요 유전자 이름 표시 (너무 많으면 생략)
  const labelGroup = g.append('g').attr('class', 'labels');
  genes.forEach((gene, i) => {
    if (gene.type === 'CDS' && genes.length > 80) return;
    const midAngle = ((gene.startPos + gene.endPos) / 2 / totalLen) * Math.PI * 2 - Math.PI / 2;
    const labelR = outerR + 40;
    const tx = Math.cos(midAngle) * labelR;
    const ty = Math.sin(midAngle) * labelR;
    labelGroup.append('text').attr('x', tx).attr('y', ty).attr('text-anchor', 'middle').attr('fill', TYPE_COLORS[gene.type] || '#fff').attr('font-size', 9).attr('font-weight', 600).text(gene.name);
  });

  const zoom = d3.zoom().scaleExtent([0.5, 10]).on('zoom', (event) => {
    g.attr('transform', `translate(${cx + event.transform.x},${cy + event.transform.y}) scale(${event.transform.k})`);
  });
  svg.call(zoom);
}

/* ─── Linear Map ─── */
function renderLinearMap(svgEl, data) {
  const el = d3.select(svgEl);
  el.selectAll('*').remove();
  const W = svgEl.clientWidth || 700, H = svgEl.clientHeight || 550;
  const margin = { top: 60, left: 80, right: 40, bottom: 60 };
  const iW = W - margin.left - margin.right, iH = H - margin.top - margin.bottom;

  const svg = el.attr('viewBox', `0 0 ${W} ${H}`).style('cursor', 'grab');
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  const xScale = d3.scaleLinear().domain([0, data.totalLength]).range([0, iW]);

  g.append('rect').attr('x', 0).attr('y', iH / 2 - 3).attr('width', iW).attr('height', 6).attr('fill', 'rgba(0,255,200,0.15)').attr('rx', 3);

  const genes = data.detectedGenes || [];
  genes.forEach((gene) => {
    const laneY = gene.strand === '+' ? iH / 2 - 45 : iH / 2 + 15;
    const x = xScale(gene.startPos), w = Math.max(3, xScale(gene.endPos) - x);
    const color = TYPE_COLORS[gene.type] || TYPE_COLORS.default;

    g.append('rect').attr('x', x).attr('y', laneY).attr('width', w).attr('height', 30).attr('fill', color).attr('fill-opacity', 0.8).attr('rx', 4).attr('cursor', 'pointer')
      .on('click', () => { if (onGeneSelectCallback) onGeneSelectCallback(gene); });

    if (gene.type !== 'CDS' || genes.length < 100) {
      g.append('text').attr('x', x + w / 2).attr('y', gene.strand === '+' ? laneY - 8 : laneY + 45).attr('text-anchor', 'middle').attr('fill', color).attr('font-size', 9).attr('font-weight', 600).text(gene.name);
    }
  });

  svg.call(d3.zoom().scaleExtent([0.5, 10]).on('zoom', (e) => g.attr('transform', `translate(${margin.left + e.transform.x},${margin.top + e.transform.y}) scale(${e.transform.k})`)));
}

/* ─── Legend & Charts ─── */
export function buildLegend(container) {
  const items = [
    { label: '필수 유전자', color: TYPE_COLORS.essential },
    { label: '항생제 내성', color: TYPE_COLORS.antibiotic_resistance },
    { label: '독성 인자', color: TYPE_COLORS.virulence },
    { label: 'rRNA 오페론', color: TYPE_COLORS.rrna },
    { label: '일반 유전자(CDS)', color: TYPE_COLORS.CDS },
  ];
  container.innerHTML = items.map(it => `<div class="legend-item"><div class="legend-dot" style="background:${it.color}"></div><span>${it.label}</span></div>`).join('');
}

export function buildBaseCompositionChart(container, composition) {
  const bases = [{ key: 'A', color: '#39ff8f' }, { key: 'T', color: '#ff4b6e' }, { key: 'G', color: '#38bdf8' }, { key: 'C', color: '#ffe066' }];
  container.innerHTML = bases.map(b => `<div class="bar-chart-row"><div class="bar-label">${b.key}</div><div class="bar-track"><div class="bar-fill" style="width:${composition[b.key]}%;background:${b.color}40;border-left:3px solid ${b.color}">${composition[b.key]}%</div></div></div>`).join('');
}

export function renderWholeGenomeMap(svgEl, data) {
  if (!svgEl || !data) return;
  const d3sel = d3.select(svgEl); d3sel.selectAll('*').remove();
  const W = svgEl.clientWidth || 740, H = svgEl.clientHeight || 700, cx = W / 2, cy = H / 2, base = Math.min(W, H) * 0.40;
  const root = d3sel.attr('viewBox', `0 0 ${W} ${H}`).append('g').attr('transform', `translate(${cx},${cy})`);
  const totalLen = data.totalLength, genes = data.detectedGenes || [];

  root.append('circle').attr('r', base * 0.70).attr('fill', 'none').attr('stroke', 'rgba(255,255,255,0.1)').attr('stroke-width', 1);
  
  genes.forEach(g => {
    const sa = (g.startPos / totalLen) * Math.PI * 2 - Math.PI / 2;
    const ea = (g.endPos / totalLen) * Math.PI * 2 - Math.PI / 2;
    const r = g.strand === '+' ? base * 0.90 : base * 0.75;
    root.append('path').attr('d', d3.arc()({ innerRadius: r, outerRadius: r + 18, startAngle: sa + Math.PI/2, endAngle: ea + Math.PI/2 }))
        .attr('fill', TYPE_COLORS[g.type] || TYPE_COLORS.default).attr('opacity', 0.9);
  });

  root.append('text').attr('text-anchor', 'middle').attr('fill', '#00ffc8').attr('font-size', 16).attr('font-weight', 700).text(`${(totalLen / 1000000).toFixed(2)} Mbp`);
  d3sel.call(d3.zoom().scaleExtent([0.3, 10]).on('zoom', e => root.attr('transform', `translate(${cx + e.transform.x},${cy + e.transform.y}) scale(${e.transform.k})`)));
}
