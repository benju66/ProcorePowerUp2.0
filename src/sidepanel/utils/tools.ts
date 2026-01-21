/**
 * Tool Definitions for Quick Navigation Toolbar
 * 
 * Defines all available Procore tools with their icons, colors, and URL generators.
 */

import type { ToolId } from '../../types/tools'
import type { Project } from '../../types/index'

export interface ToolDefinition {
  id: ToolId
  label: string
  icon: string  // SVG path d attribute
  colorClass: string
  getUrl: (project: Project) => string | null
}

export const AVAILABLE_TOOLS: ToolDefinition[] = [
  {
    id: 'home',
    label: 'Project Home',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    colorClass: 'hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30',
    getUrl: (p) => p.companyId 
      ? `https://app.procore.com/webclients/host/companies/${p.companyId}/projects/${p.id}/tools/projecthome` 
      : `https://app.procore.com/${p.id}/project/home`
  },
  {
    id: 'drawings',
    label: 'Drawings',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    colorClass: 'hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30',
    getUrl: (p) => p.companyId 
      ? (p.drawingAreaId 
        ? `https://app.procore.com/webclients/host/companies/${p.companyId}/projects/${p.id}/tools/drawings/areas/${p.drawingAreaId}/revisions` 
        : `https://app.procore.com/webclients/host/companies/${p.companyId}/projects/${p.id}/tools/drawings`) 
      : null
  },
  {
    id: 'specs',
    label: 'Specifications',
    icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
    colorClass: 'hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30',
    getUrl: (p) => p.companyId 
      ? `https://app.procore.com/webclients/host/companies/${p.companyId}/projects/${p.id}/tools/specifications/specification_sections` 
      : null
  },
  {
    id: 'submittals',
    label: 'Submittals',
    icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12',
    colorClass: 'hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30',
    getUrl: (p) => p.companyId 
      ? `https://app.procore.com/webclients/host/companies/${p.companyId}/projects/${p.id}/tools/submittals` 
      : null
  },
  {
    id: 'rfis',
    label: 'RFIs',
    icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    colorClass: 'hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30',
    getUrl: (p) => p.companyId 
      ? `https://app.procore.com/webclients/host/companies/${p.companyId}/projects/${p.id}/tools/rfis` 
      : null
  },
  {
    id: 'directory',
    label: 'Directory',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
    colorClass: 'hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/30',
    getUrl: (p) => `https://app.procore.com/${p.id}/project/directory/groups/users`
  },
  {
    id: 'budget',
    label: 'Budget',
    icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
    colorClass: 'hover:text-green-700 dark:hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/30',
    getUrl: (p) => p.companyId 
      ? `https://app.procore.com/webclients/host/companies/${p.companyId}/projects/${p.id}/tools/budgets` 
      : null
  },
  {
    id: 'prime_contract',
    label: 'Prime Contracts',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    colorClass: 'hover:text-blue-700 dark:hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30',
    getUrl: (p) => p.companyId 
      ? `https://app.procore.com/webclients/host/companies/${p.companyId}/projects/${p.id}/tools/contracts/prime_contracts` 
      : null
  },
  {
    id: 'commitments',
    label: 'Commitments',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    colorClass: 'hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/30',
    getUrl: (p) => p.companyId 
      ? `https://app.procore.com/webclients/host/companies/${p.companyId}/projects/${p.id}/tools/contracts/commitments` 
      : null
  },
  {
    id: 'change_events',
    label: 'Change Events',
    icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
    colorClass: 'hover:text-yellow-600 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/30',
    getUrl: (p) => `https://app.procore.com/${p.id}/project/change_events/events`
  },
  {
    id: 'photos',
    label: 'Photos',
    icon: 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z',
    colorClass: 'hover:text-pink-600 dark:hover:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-900/30',
    getUrl: (p) => p.companyId 
      ? `https://app.procore.com/webclients/host/companies/${p.companyId}/projects/${p.id}/tools/photos/timeline` 
      : null
  },
  {
    id: 'invoicing',
    label: 'Invoicing',
    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    colorClass: 'hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30',
    getUrl: (p) => p.companyId 
      ? `https://app.procore.com/webclients/host/companies/${p.companyId}/projects/${p.id}/tools/invoicing/subcontractor` 
      : null
  },
  {
    id: 'meetings',
    label: 'Meetings',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    colorClass: 'hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30',
    getUrl: (p) => p.companyId 
      ? `https://app.procore.com/webclients/host/companies/${p.companyId}/projects/${p.id}/tools/meetings/list` 
      : null
  },
  {
    id: 'punch',
    label: 'Punch List',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
    colorClass: 'hover:text-red-700 dark:hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30',
    getUrl: (p) => p.companyId 
      ? `https://app.procore.com/webclients/host/companies/${p.companyId}/projects/${p.id}/tools/punchlist/list` 
      : null
  },
  {
    id: 'documents',
    label: 'Documents',
    icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
    colorClass: 'hover:text-yellow-600 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/30',
    getUrl: (p) => p.companyId 
      ? `https://app.procore.com/webclients/host/companies/${p.companyId}/projects/${p.id}/tools/documents` 
      : null
  },
  {
    id: 'dailylog',
    label: 'Daily Log',
    icon: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z',
    colorClass: 'hover:text-orange-500 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/30',
    getUrl: (p) => p.companyId 
      ? `https://app.procore.com/webclients/host/companies/${p.companyId}/projects/${p.id}/tools/dailylog/list` 
      : null
  }
]
