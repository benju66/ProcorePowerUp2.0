/**
 * Tool Definitions for Quick Navigation Toolbar
 * 
 * Defines all available Procore tools with their icons, colors, and URL generators.
 */

import {
  Home,
  ScrollText,
  BookOpen,
  ClipboardList,
  MessageCircleQuestion,
  Users,
  Calculator,
  FileSignature,
  Handshake,
  FileDiff,
  Image,
  Receipt,
  CalendarDays,
  ListTodo,
  Files,
  Sun,
} from 'lucide-preact'
import type { LucideIcon } from 'lucide-preact'
import type { ToolId } from '../../types/tools'
import type { Project } from '../../types/index'

export interface ToolDefinition {
  id: ToolId
  label: string
  icon: LucideIcon
  colorClass: string
  getUrl: (project: Project) => string | null
}

export const AVAILABLE_TOOLS: ToolDefinition[] = [
  {
    id: 'home',
    label: 'Project Home',
    icon: Home,
    colorClass: 'hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30',
    getUrl: (p) => p.companyId 
      ? `https://app.procore.com/webclients/host/companies/${p.companyId}/projects/${p.id}/tools/projecthome` 
      : `https://app.procore.com/${p.id}/project/home`
  },
  {
    id: 'drawings',
    label: 'Drawings',
    icon: ScrollText,
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
    icon: BookOpen,
    colorClass: 'hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30',
    getUrl: (p) => p.companyId 
      ? `https://app.procore.com/webclients/host/companies/${p.companyId}/projects/${p.id}/tools/specifications/specification_sections` 
      : null
  },
  {
    id: 'submittals',
    label: 'Submittals',
    icon: ClipboardList,
    colorClass: 'hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30',
    getUrl: (p) => p.companyId 
      ? `https://app.procore.com/webclients/host/companies/${p.companyId}/projects/${p.id}/tools/submittals` 
      : null
  },
  {
    id: 'rfis',
    label: 'RFIs',
    icon: MessageCircleQuestion,
    colorClass: 'hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30',
    getUrl: (p) => p.companyId 
      ? `https://app.procore.com/webclients/host/companies/${p.companyId}/projects/${p.id}/tools/rfis` 
      : null
  },
  {
    id: 'directory',
    label: 'Directory',
    icon: Users,
    colorClass: 'hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/30',
    getUrl: (p) => `https://app.procore.com/${p.id}/project/directory/groups/users`
  },
  {
    id: 'budget',
    label: 'Budget',
    icon: Calculator,
    colorClass: 'hover:text-green-700 dark:hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/30',
    getUrl: (p) => p.companyId 
      ? `https://app.procore.com/webclients/host/companies/${p.companyId}/projects/${p.id}/tools/budgets` 
      : null
  },
  {
    id: 'prime_contract',
    label: 'Prime Contracts',
    icon: FileSignature,
    colorClass: 'hover:text-blue-700 dark:hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30',
    getUrl: (p) => p.companyId 
      ? `https://app.procore.com/webclients/host/companies/${p.companyId}/projects/${p.id}/tools/contracts/prime_contracts` 
      : null
  },
  {
    id: 'commitments',
    label: 'Commitments',
    icon: Handshake,
    colorClass: 'hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/30',
    getUrl: (p) => p.companyId 
      ? `https://app.procore.com/webclients/host/companies/${p.companyId}/projects/${p.id}/tools/contracts/commitments` 
      : null
  },
  {
    id: 'change_events',
    label: 'Change Events',
    icon: FileDiff,
    colorClass: 'hover:text-yellow-600 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/30',
    getUrl: (p) => `https://app.procore.com/${p.id}/project/change_events/events`
  },
  {
    id: 'photos',
    label: 'Photos',
    icon: Image,
    colorClass: 'hover:text-pink-600 dark:hover:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-900/30',
    getUrl: (p) => p.companyId 
      ? `https://app.procore.com/webclients/host/companies/${p.companyId}/projects/${p.id}/tools/photos/timeline` 
      : null
  },
  {
    id: 'invoicing',
    label: 'Invoicing',
    icon: Receipt,
    colorClass: 'hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30',
    getUrl: (p) => p.companyId 
      ? `https://app.procore.com/webclients/host/companies/${p.companyId}/projects/${p.id}/tools/invoicing/subcontractor` 
      : null
  },
  {
    id: 'meetings',
    label: 'Meetings',
    icon: CalendarDays,
    colorClass: 'hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30',
    getUrl: (p) => p.companyId 
      ? `https://app.procore.com/webclients/host/companies/${p.companyId}/projects/${p.id}/tools/meetings/list` 
      : null
  },
  {
    id: 'punch',
    label: 'Punch List',
    icon: ListTodo,
    colorClass: 'hover:text-red-700 dark:hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30',
    getUrl: (p) => p.companyId 
      ? `https://app.procore.com/webclients/host/companies/${p.companyId}/projects/${p.id}/tools/punchlist/list` 
      : null
  },
  {
    id: 'documents',
    label: 'Documents',
    icon: Files,
    colorClass: 'hover:text-yellow-600 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/30',
    getUrl: (p) => p.companyId 
      ? `https://app.procore.com/webclients/host/companies/${p.companyId}/projects/${p.id}/tools/documents` 
      : null
  },
  {
    id: 'dailylog',
    label: 'Daily Log',
    icon: Sun,
    colorClass: 'hover:text-orange-500 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/30',
    getUrl: (p) => p.companyId 
      ? `https://app.procore.com/webclients/host/companies/${p.companyId}/projects/${p.id}/tools/dailylog/list` 
      : null
  }
]
