// Consistent colors for jurisdictions
const COLORS = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
  '#14B8A6', // teal
  '#6366F1', // indigo
  '#84CC16', // lime
  '#D946EF', // fuchsia
  '#0EA5E9', // sky
  '#22C55E', // green
  '#E11D48', // rose
  '#A855F7', // purple
  '#64748B', // slate
  '#78716C', // stone
];

const colorMap = new Map<string, string>();

export function getJurisdictionColor(jurisdiction: string): string {
  if (jurisdiction === 'Unknown') return '#D1D5DB';

  if (!colorMap.has(jurisdiction)) {
    colorMap.set(jurisdiction, COLORS[colorMap.size % COLORS.length]);
  }
  return colorMap.get(jurisdiction)!;
}

export function getConfidenceOpacity(confidence: string): number {
  switch (confidence) {
    case 'high': return 1;
    case 'medium': return 0.75;
    case 'low': return 0.45;
    case 'none': return 0.2;
    default: return 0.5;
  }
}
