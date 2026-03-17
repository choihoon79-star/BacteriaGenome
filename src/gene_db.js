/**
 * 주요 박테리아 유전자 마커 데이터베이스
 */

export const GENE_DATABASE = {
  dnaA: { name: 'dnaA', fullName: 'Chromosomal replication initiator protein', type: 'essential' },
  recA: { name: 'recA', fullName: 'Protein RecA (Recombination)', type: 'essential' },
  rpoB: { name: 'rpoB', fullName: 'DNA-directed RNA polymerase subunit beta', type: 'essential' },
  gyrA: { name: 'gyrA', fullName: 'DNA gyrase subunit A', type: 'essential' },
  mecA: { name: 'mecA', fullName: 'Penicillin-binding protein 2\' (Resistance)', type: 'antibiotic_resistance' },
  tetA: { name: 'tetA', fullName: 'Tetracycline resistance protein', type: 'antibiotic_resistance' },
  vanA: { name: 'vanA', fullName: 'Vancomycin resistance protein', type: 'antibiotic_resistance' },
  stx1: { name: 'stx1', fullName: 'Shiga toxin 1 (Virulence)', type: 'virulence' },
  algD: { name: 'algD', fullName: 'GDP-mannose 6-dehydrogenase (Biofilm)', type: 'metabolism' },
  ftsZ: { name: 'ftsZ', fullName: 'Cell division protein FtsZ', type: 'essential' },
  nifH: { name: 'nifH', fullName: 'Glutamine synthetase (Nitrogen fixation)', type: 'metabolism' },
  groEL: { name: 'groEL', fullName: 'Chaperonin GroEL', type: 'essential' }
};
