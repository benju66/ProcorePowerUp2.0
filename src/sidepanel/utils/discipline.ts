/**
 * Discipline color utilities
 * Shared between DrawingsTab and CommandPalette
 */

/**
 * Returns Tailwind background color class for a discipline name
 * Matches v1 color mapping logic
 */
export function getDisciplineColor(name: string): string {
  if (!name) return 'bg-gray-400'
  const n = name.toUpperCase()
  if (n.includes('ARCH') || n.startsWith('A')) return 'bg-red-500'
  if (n.includes('STR') || n.startsWith('S')) return 'bg-blue-500'
  if (n.includes('MECH') || n.startsWith('M')) return 'bg-green-500'
  if (n.includes('ELEC') || n.startsWith('E')) return 'bg-yellow-500'
  if (n.includes('PLUM') || n.startsWith('P')) return 'bg-cyan-500'
  if (n.includes('CIV') || n.startsWith('C')) return 'bg-amber-700'
  if (n.includes('FIRE') || n.startsWith('F')) return 'bg-orange-500'
  if (n.includes('LAND') || n.startsWith('L')) return 'bg-lime-500'
  return 'bg-gray-400'
}
