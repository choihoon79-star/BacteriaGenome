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
  CDS:                  '#1a3a8f',   // 일반 유전자 — 진청색
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

  const defs = svg.append('defs');
  const glow = defs.append('filter').attr('id', 'glow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
  glow.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur');
  const merge = glow.append('feMerge');
  merge.append('feMergeNode').attr('in', 'coloredBlur');
  merge.append('feMergeNode').attr('in', 'SourceGraphic');

  const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);

  const totalLen = data.totalLength;
  const ticks = 20;
  for (let i = 0; i < ticks; i++) {
    const angle = (i / ticks) * Math.PI * 2 - Math.PI / 2;
    const x1 = Math.cos(angle) * (outerR - 8);
    const y1 = Math.sin(angle) * (outerR - 8);
    const x2 = Math.cos(angle) * outerR;
    const y2 = Math.sin(angle) * outerR;
    g.append('line').attr('x1', x1).attr('y1', y1)
      .attr('x2', x2).attr('y2', y2).attr('stroke', 'rgba(0,255,200,0.25)').attr('stroke-width', 1);

    if (i % 5 === 0) {
      const lx = Math.cos(angle) * (outerR + 16);
      const ly = Math.sin(angle) * (outerR + 16);
      g.append('text').attr('x', lx).attr('y', ly).attr('text-anchor', 'middle').attr('dominant-baseline', 'middle').attr('fill', 'rgba(122,135,168,0.8)').attr('font-size', 9).attr('font-family', 'JetBrains Mono, monospace').text(`${Math.round((i / ticks) * totalLen / 1000)}k`);
    }
  }

  g.append('circle').attr('r', innerR).attr('fill', 'rgba(12,14,26,0.8)').attr('stroke', 'rgba(0,255,200,0.15)').attr('stroke-width', 1);

  const orgName = data.customName || data.estimatedOrganism || 'Unknown';
  g.append('text').attr('y', -10).attr('text-anchor', 'middle').attr('fill', '#00ffc8').attr('font-size', 13).attr('font-weight', 700).text(orgName.split(' (')[0].slice(0, 18));
  g.append('text').attr('y', 15).attr('text-anchor', 'middle').attr('fill', '#7a87a8').attr('font-size', 10).text(`${(totalLen / 1000).toFixed(0)} kb  |  GC ${data.gcContent}%`);

  const arc = d3.arc();
  const geneGroup = g.append('g').attr('class', 'genes');
  const tooltip = d3.select('#map-tooltip');

  data.detectedGenes.forEach((gene, i) => {
    const startAngle = (gene.startPos / totalLen) * Math.PI * 2 - Math.PI / 2;
    const endAngle   = (gene.endPos   / totalLen) * Math.PI * 2 - Math.PI / 2;
    const genR = gene.strand === '+' ? outerR * 0.85 : outerR * 0.68;
    const genW = outerR * 0.10;
    const color = TYPE_COLORS[gene.type] || TYPE_COLORS.default;

    const arcPath = arc({ innerRadius: genR, outerRadius: genR + genW, startAngle: startAngle + Math.PI / 2, endAngle: endAngle + Math.PI / 2 });

    geneGroup.append('path').attr('d', arcPath).attr('fill', color).attr('fill-opacity', 0.75).attr('stroke', color).attr('stroke-width', 0.5).attr('cursor', 'pointer').attr('filter', 'url(#glow)')
      .on('mouseover', function(event) {
        d3.select(this).attr('fill-opacity', 1).attr('stroke-width', 2);
        tooltip.classed('hidden', false).html(`<strong>${gene.name}</strong><br/>${gene.fullName}`);
      })
      .on('mousemove', e => tooltip.style('left', (e.pageX + 10) + 'px').style('top', (e.pageY - 10) + 'px'))
      .on('mouseout', function() { d3.select(this).attr('fill-opacity', 0.75); tooltip.classed('hidden', true); })
      .on('click', () => { if (onGeneSelectCallback) onGeneSelectCallback(gene); });
  });

  const labelGroup = g.append('g').attr('class', 'labels');
  data.detectedGenes.forEach((gene, i) => {
    if (gene.type === 'CDS' && data.detectedGenes.length > 50) return;
    const midAngle = ((gene.startPos + gene.endPos) / 2 / totalLen) * Math.PI * 2 - Math.PI / 2;
    const lr = outerR + 25;
    g.append('text').attr('x', Math.cos(midAngle) * lr).attr('y', Math.sin(midAngle) * lr).attr('text-anchor', 'middle').attr('fill', TYPE_COLORS[gene.type] || '#fff').attr('font-size', 8).text(gene.name);
  });

  const zoom = d3.zoom().scaleExtent([0.5, 8]).on('zoom', e => g.attr('transform', `translate(${cx + e.transform.x},${cy + e.transform.y}) scale(${e.transform.k})`));
  svg.call(zoom);
}

/* ─── Linear Map ─── */
function renderLinearMap(svgEl, data) {
  const el = d3.select(svgEl);
  el.selectAll('*').remove();
  const W = svgEl.clientWidth || 700, H = svgEl.clientHeight || 550, margin = { top: 60, left: 80, right: 40, bottom: 60 };
  const iW = W - margin.left - margin.right, iH = H - margin.top - margin.bottom;

  const svg = el.attr('viewBox', `0 0 ${W} ${H}`).style('cursor', 'grab');
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  const xScale = d3.scaleLinear().domain([0, data.totalLength]).range([0, iW]);

  g.append('rect').attr('x', 0).attr('y', iH / 2 - 3).attr('width', iW).attr('height', 6).attr('fill', 'rgba(0,255,200,0.1)').attr('rx', 3);

  data.detectedGenes.forEach((gene, i) => {
    const laneY = gene.strand === '+' ? iH / 2 - 40 : iH / 2 + 20;
    const x = xScale(gene.startPos), w = Math.max(5, xScale(gene.endPos) - x);
    const color = TYPE_COLORS[gene.type] || TYPE_COLORS.default;

    g.append('rect').attr('x
