# Specifications Tab Implementation Guide

This document details everything needed to add a new "Specifications" tab to Procore Power-Up, based on the patterns used for RFIsTab, DrawingsTab, and CostTab.

## Table of Contents
1. [Component Architecture](#component-architecture)
2. [Type Definitions](#type-definitions)
3. [Storage Service](#storage-service)
4. [API Service](#api-service)
5. [Wiretap Integration](#wiretap-integration)
6. [Background Service Worker](#background-service-worker)
7. [Content Script (Page Scanning)](#content-script-page-scanning)
8. [Settings Integration](#settings-integration)
9. [Tab Visibility Management](#tab-visibility-management)
10. [App.tsx Integration](#apptsx-integration)
11. [TabBar Integration](#tabbar-integration)
12. [Complete File Checklist](#complete-file-checklist)

---

## Component Architecture

### SpecificationsTab Component Pattern

**Location:** `v2/src/sidepanel/components/SpecificationsTab.tsx`

**Key Features:**
- Loads data from storage on mount and when `dataVersion` changes
- Listens for `SCAN_PROGRESS` and `DATA_SAVED` messages
- Displays scan progress with progress bar
- Shows notification when new items are captured
- Implements search/filter functionality
- Handles click to open item in Procore
- Shows empty states

**State Management:**
```typescript
const [specifications, setSpecifications] = useState<Specification[]>([])
const [searchQuery, setSearchQuery] = useState('')
const [isLoading, setIsLoading] = useState(true)
const [isScanning, setIsScanning] = useState(false)
const [scanStatus, setScanStatus] = useState<string | null>(null)
const [scanPercent, setScanPercent] = useState(0)
const [lastCaptureCount, setLastCaptureCount] = useState<number | null>(null)
```

**Props Interface:**
```typescript
interface SpecificationsTabProps {
  projectId: string
  dataVersion?: number
}
```

**Key Lifecycle Hooks:**

1. **Data Loading Effect:**
   - Runs on `projectId` or `dataVersion` change
   - Calls `StorageService.getSpecifications(projectId)`
   - Detects new items when `dataVersion > 0`
   - Shows notification for new captures

2. **Scan Progress Listener:**
   - Listens for `SCAN_PROGRESS` messages with `scanType === 'specifications'`
   - Updates progress bar and status
   - Reloads data on completion
   - Also listens for `DATA_SAVED` during scanning

3. **Search Filter:**
   - Uses `useMemo` for filtered results
   - Multi-word search (all words must match)
   - Searches across multiple fields (number, title, section, etc.)

**UI Structure:**
```
<div className="flex flex-col h-full">
  {/* Notification Banner (new captures) */}
  {lastCaptureCount !== null && <NotificationBanner />}
  
  {/* Scan Status Banner */}
  {scanStatus && <ScanStatusBanner />}
  
  {/* Search Bar */}
  <SearchInput />
  
  {/* Stats Bar */}
  <StatsBar />
  
  {/* Content */}
  {specifications.length === 0 ? (
    <EmptyState />
  ) : filteredSpecifications.length === 0 ? (
    <NoResultsState />
  ) : (
    <SpecificationsList />
  )}
</div>
```

---

## Type Definitions

### 1. Specification Interface

**Location:** `v2/src/types/index.ts`

```typescript
export interface Specification {
  id: number
  number: string
  title: string
  section?: string
  division?: string
  status?: string
  created_at?: string
  updated_at?: string
  // Add other fields as needed based on Procore API
}
```

### 2. TabInfo Type Update

**Location:** `v2/src/types/index.ts`

```typescript
export interface TabInfo {
  id: 'drawings' | 'rfis' | 'cost' | 'specifications'  // Add 'specifications'
  label: string
  icon: import('lucide-preact').LucideIcon
}
```

### 3. Preferences Type Update

**Location:** `v2/src/types/preferences.ts`

```typescript
export interface UserPreferences {
  // ... existing fields
  showSpecificationsTab: boolean  // Add this
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  // ... existing defaults
  showSpecificationsTab: false,  // Add this
}

export const PREFERENCE_KEYS = {
  // ... existing keys
  showSpecificationsTab: 'showSpecificationsTab',  // Add this
} as const
```

---

## Storage Service

**Location:** `v2/src/services/storage.ts`

### 1. Create Store Instance

```typescript
const specificationsStore = createStore('pp-specifications', 'specifications')
const specificationKey = (projectId: string) => `specifications_${projectId}`
```

### 2. Add Storage Methods

```typescript
// ============================================
// SPECIFICATIONS
// ============================================

async getSpecifications(projectId: string): Promise<Specification[]> {
  if (!projectId) return []
  const data = await get<Specification[]>(specificationKey(projectId), specificationsStore)
  return data ?? []
},

async saveSpecifications(projectId: string, specifications: Specification[]): Promise<void> {
  if (!projectId) return
  await set(specificationKey(projectId), specifications, specificationsStore)
},

async mergeSpecifications(projectId: string, newSpecifications: Specification[]): Promise<Specification[]> {
  if (!projectId) return []
  const existing = await this.getSpecifications(projectId)
  const existingIds = new Set(existing.map(s => s.id))
  const toAdd = newSpecifications.filter(s => !existingIds.has(s.id))
  const merged = [...existing, ...toAdd]
  await this.saveSpecifications(projectId, merged)
  return merged
},
```

### 3. Update Project Deletion

```typescript
async deleteProject(projectId: string): Promise<void> {
  // ... existing deletions
  await del(specificationKey(projectId), specificationsStore)
}
```

### 4. Update Export/Import

```typescript
async exportProjectData(projectId: string): Promise<ProjectCache> {
  // ... existing exports
  data[`specifications_${project.id}`] = await this.getSpecifications(project.id)
}
```

---

## API Service

**Location:** `v2/src/services/api.ts`

### 1. Add Fetch Method

```typescript
// ============================================
// SPECIFICATIONS
// ============================================

async fetchSpecifications(
  projectId: string,
  options?: FetchOptions
): Promise<Specification[]> {
  const allSpecifications: Specification[] = []
  let page = 1
  const perPage = 100
  let hasMore = true
  let consecutiveErrors = 0

  while (hasMore && consecutiveErrors < 3) {
    try {
      // NOTE: Update URL based on actual Procore API endpoint
      const url = `${PROCORE_BASE}/rest/v1.0/projects/${projectId}/specifications?page=${page}&per_page=${perPage}`
      
      const response = await this.fetchPaginated<unknown>(url, options)
      const specifications = this.normalizeSpecifications(response.data)
      
      allSpecifications.push(...specifications)
      consecutiveErrors = 0
      
      if (options?.onProgress) {
        options.onProgress(allSpecifications.length, response.total)
      }

      if (specifications.length === 0 || specifications.length < perPage) {
        hasMore = false
      } else {
        page++
      }
      
      if (page > 100) {
        hasMore = false
      }
    } catch (error) {
      console.error('ApiService: Error fetching specifications page', page, error)
      consecutiveErrors++
      if (consecutiveErrors >= 3) {
        hasMore = false
      }
    }
  }

  return allSpecifications
},

normalizeSpecifications(data: unknown[]): Specification[] {
  return data
    .filter((item): item is Record<string, unknown> => 
      item !== null && typeof item === 'object' && 'id' in item
    )
    .map(item => ({
      id: item.id as number,
      number: (item.number || item.spec_number || '') as string,
      title: (item.title || item.name || '') as string,
      section: item.section as string | undefined,
      division: item.division as string | undefined,
      status: item.status as string | undefined,
      created_at: item.created_at as string | undefined,
      updated_at: item.updated_at as string | undefined,
    }))
},
```

---

## Wiretap Integration

**Location:** `v2/src/content/wiretap.ts`

### 1. Add URL Detection

```typescript
function isRelevantUrl(url: string | null): boolean {
  // ... existing checks
  
  // 4. Specifications
  if (lower.includes('/specifications') || lower.includes('/specs')) {
    return true
  }
  
  return false
}
```

---

## Background Service Worker

**Location:** `v2/src/background/service-worker.ts`

### 1. Add Detection Function

```typescript
function isSpecification(item: RawDataItem): boolean {
  if (!item || !item.id) return false
  // Must have specification-specific fields
  if (item.spec_number || item.section || item.division) return true
  // Must NOT have drawing-specific fields
  if (item.drawing_number || item.number?.match(/^[A-Z]-\d+/)) return false
  // Must NOT have commitment-specific fields
  if (item.vendor || item.vendor_name || item.contract_date) return false
  // Must NOT have RFI-specific fields
  if (item.subject && item.status && !item.drawing_number) return false
  return true
}
```

### 2. Update Wiretap Handler

```typescript
async function handleWiretapData(wiretapMessage: WiretapMessage): Promise<...> {
  // ... existing source detection
  
  const isSpecificationSrc = sourceLower.includes('/specifications') || 
                             sourceLower.includes('/specs')
  
  // ... existing processing
  
  // Process Specifications
  if (isSpecificationSrc && isSpecification(firstItem)) {
    const specifications = dataItems.filter(isSpecification).map(item => {
      const numericId = typeof item.id === 'string' ? parseInt(item.id, 10) : item.id!
      return {
        id: numericId as number,
        number: (item.number || item.spec_number || '') as string,
        title: (item.title || item.name || '') as string,
        section: item.section as string | undefined,
        division: item.division as string | undefined,
        status: item.status as string | undefined,
        created_at: item.created_at as string | undefined,
        updated_at: item.updated_at as string | undefined,
      }
    })
    
    if (specifications.length > 0) {
      await StorageService.mergeSpecifications(activeProjectId, specifications)
      console.log('PP Background: Saved', specifications.length, 'specifications')
      return { saved: true, type: 'specifications', count: specifications.length }
    }
  }
}
```

### 3. Add Scan Handler

```typescript
async function handleScanSpecifications(projectId: string): Promise<{ success: boolean; count?: number; error?: string }> {
  console.log('PP Background: Scanning specifications for project', projectId)
  
  try {
    const specifications = await ApiService.fetchSpecifications(projectId)
    if (specifications.length > 0) {
      await StorageService.mergeSpecifications(projectId, specifications)
    }
    
    console.log('PP Background: Scan complete, found', specifications.length, 'specifications')
    return { success: true, count: specifications.length }
  } catch (error) {
    console.error('PP Background: Specification scan failed', error)
    return { success: false, error: String(error) }
  }
}
```

### 4. Add Message Handler

```typescript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // ... existing handlers
  
  if (message.action === 'SCAN_SPECIFICATIONS') {
    handleScanSpecifications(message.projectId)
      .then((result) => {
        if (result.success) {
          chrome.runtime.sendMessage({ 
            type: 'DATA_SAVED', 
            payload: { type: 'specifications', count: result.count } 
          }).catch(() => {})
        }
        sendResponse(result)
      })
      .catch((err) => sendResponse({ success: false, error: String(err) }))
    return true
  }
})
```

---

## Content Script (Page Scanning)

**Location:** `v2/src/content/content.ts`

### 1. Update performPageScan Function

```typescript
async function performPageScan(scanType: 'drawings' | 'rfis' | 'commitments' | 'specifications'): Promise<...> {
  // ... existing checks
  
  } else if (scanType === 'specifications') {
    if (!currentUrl.includes('/specifications') && !currentUrl.includes('/specs')) {
      return { success: false, message: 'Navigate to the Specifications page first' }
    }
  }
  
  // ... rest of function (no special expansion needed like drawings)
}
```

### 2. Update Message Handler

```typescript
case 'PAGE_SCAN': {
  performPageScan(message.scanType as 'drawings' | 'rfis' | 'commitments' | 'specifications')
    .then(sendResponse)
    .catch(err => sendResponse({ success: false, message: String(err) }))
  return true
}
```

---

## Settings Integration

**Location:** `v2/src/sidepanel/components/Settings.tsx`

### 1. Update Scan State Type

```typescript
const [scanState, setScanState] = useState<{
  type: 'drawings' | 'rfis' | 'commitments' | 'specifications' | null
  isScanning: boolean
  percent: number
  status: string | null
}>({...})
```

### 2. Update handleScan Function

```typescript
const handleScan = async (scanType: 'drawings' | 'rfis' | 'commitments' | 'specifications') => {
  // ... existing logic
  
  status: `Error: Open Procore ${scanType === 'drawings' ? 'Drawings' : 
                              scanType === 'rfis' ? 'RFIs' : 
                              scanType === 'commitments' ? 'Commitments' : 
                              'Specifications'} page first`
}
```

### 3. Add Scan Button

```typescript
{showSpecificationsTab && (
  <button
    onClick={() => handleScan('specifications')}
    disabled={scanState.isScanning}
    className="w-full px-3 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
  >
    {scanState.isScanning && scanState.type === 'specifications' ? (
      <>
        <Loader2 size={16} className="animate-spin" />
        <span>{scanState.percent}%</span>
      </>
    ) : (
      <span>Scan Specifications</span>
    )}
  </button>
)}
```

### 4. Add Visibility Toggle

```typescript
const { showSpecificationsTab, setShowSpecificationsTab } = useTabVisibility()

// In the UI:
<label className="flex items-center justify-between px-2 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
  <span>Show Specifications Tab</span>
  <input
    type="checkbox"
    checked={showSpecificationsTab}
    onChange={(e) => setShowSpecificationsTab((e.target as HTMLInputElement).checked)}
    className="toggle-switch"
  />
</label>
```

---

## Tab Visibility Management

**Location:** `v2/src/sidepanel/contexts/TabVisibilityContext.tsx`

### 1. Update Context Interface

```typescript
interface TabVisibilityContextValue {
  showRFIsTab: boolean
  showCostTab: boolean
  showSpecificationsTab: boolean  // Add this
  setShowRFIsTab: (visible: boolean) => Promise<void>
  setShowCostTab: (visible: boolean) => Promise<void>
  setShowSpecificationsTab: (visible: boolean) => Promise<void>  // Add this
}
```

### 2. Add State and Setter

```typescript
const [showSpecificationsTab, setShowSpecificationsTabState] = useState(
  DEFAULT_PREFERENCES.showSpecificationsTab
)

// In loadPreferences:
const [rfis, cost, specs] = await Promise.all([
  StorageService.getPreferences<boolean>(
    PREFERENCE_KEYS.showRFIsTab,
    DEFAULT_PREFERENCES.showRFIsTab
  ),
  StorageService.getPreferences<boolean>(
    PREFERENCE_KEYS.showCostTab,
    DEFAULT_PREFERENCES.showCostTab
  ),
  StorageService.getPreferences<boolean>(
    PREFERENCE_KEYS.showSpecificationsTab,
    DEFAULT_PREFERENCES.showSpecificationsTab
  ),
])
setShowSpecificationsTabState(specs)

// Add setter function:
const setShowSpecificationsTab = useCallback(async (visible: boolean) => {
  setShowSpecificationsTabState(visible)
  try {
    await StorageService.savePreference(PREFERENCE_KEYS.showSpecificationsTab, visible)
  } catch (error) {
    console.error('Failed to save Specifications tab preference:', error)
    setShowSpecificationsTabState(!visible)
  }
}, [])

// Update provider value:
value={{
  showRFIsTab,
  showCostTab,
  showSpecificationsTab,  // Add this
  setShowRFIsTab,
  setShowCostTab,
  setShowSpecificationsTab,  // Add this
}}
```

---

## App.tsx Integration

**Location:** `v2/src/sidepanel/App.tsx`

### 1. Import Component

```typescript
import { SpecificationsTab } from './components/SpecificationsTab'
```

### 2. Add Tab Definition

```typescript
import { FileText } from 'lucide-preact'  // Or appropriate icon

const TABS: TabInfo[] = [
  { id: 'drawings', label: 'Drawings', icon: PencilRuler },
  { id: 'rfis', label: 'RFIs', icon: HelpCircle },
  { id: 'cost', label: 'Cost', icon: BadgeDollarSign },
  { id: 'specifications', label: 'Specifications', icon: FileText },  // Add this
]
```

### 3. Update Tab Visibility Logic

```typescript
const { showRFIsTab, showCostTab, showSpecificationsTab } = useTabVisibility()

const visibleTabs = useMemo(() => 
  TABS.filter(tab => {
    if (tab.id === 'rfis') return showRFIsTab
    if (tab.id === 'cost') return showCostTab
    if (tab.id === 'specifications') return showSpecificationsTab  // Add this
    return true // Always show drawings
  }), [showRFIsTab, showCostTab, showSpecificationsTab])  // Add dependency
```

### 4. Add Edge Case Handling

```typescript
useEffect(() => {
  if (activeTab === 'rfis' && !showRFIsTab) {
    setActiveTab('drawings')
  }
  if (activeTab === 'cost' && !showCostTab) {
    setActiveTab('drawings')
  }
  if (activeTab === 'specifications' && !showSpecificationsTab) {  // Add this
    setActiveTab('drawings')
  }
}, [showRFIsTab, showCostTab, showSpecificationsTab, activeTab])  // Add dependency
```

### 5. Add Render Case

```typescript
switch (activeTab) {
  case 'drawings':
    return <DrawingsTab projectId={currentProjectId} dataVersion={dataVersion} />
  case 'rfis':
    return <RFIsTab projectId={currentProjectId} dataVersion={dataVersion} />
  case 'cost':
    return <CostTab projectId={currentProjectId} dataVersion={dataVersion} />
  case 'specifications':  // Add this
    return <SpecificationsTab projectId={currentProjectId} dataVersion={dataVersion} />
  default:
    return null
}
```

---

## TabBar Integration

**Location:** `v2/src/sidepanel/components/TabBar.tsx`

**No changes needed** - TabBar is generic and works with any TabInfo array.

---

## Component Export

**Location:** `v2/src/sidepanel/components/index.ts`

```typescript
export { SpecificationsTab } from './SpecificationsTab'
```

---

## Complete File Checklist

### Files to Create:
- [ ] `v2/src/sidepanel/components/SpecificationsTab.tsx`

### Files to Modify:
- [ ] `v2/src/types/index.ts` - Add Specification interface, update TabInfo
- [ ] `v2/src/types/preferences.ts` - Add showSpecificationsTab preference
- [ ] `v2/src/services/storage.ts` - Add specification storage methods
- [ ] `v2/src/services/api.ts` - Add fetchSpecifications and normalizeSpecifications
- [ ] `v2/src/content/wiretap.ts` - Add specifications URL detection
- [ ] `v2/src/background/service-worker.ts` - Add isSpecification, wiretap handler, scan handler, message handler
- [ ] `v2/src/content/content.ts` - Update performPageScan for specifications
- [ ] `v2/src/sidepanel/components/Settings.tsx` - Add scan button and visibility toggle
- [ ] `v2/src/sidepanel/contexts/TabVisibilityContext.tsx` - Add specifications tab visibility
- [ ] `v2/src/sidepanel/App.tsx` - Import, add tab definition, update visibility logic, add render case
- [ ] `v2/src/sidepanel/components/index.ts` - Export SpecificationsTab

---

## Key Patterns to Follow

1. **Data Loading:** Always check `dataVersion` to detect new captures
2. **Scan Progress:** Listen for both `SCAN_PROGRESS` and `DATA_SAVED` messages
3. **Storage:** Use merge pattern to avoid duplicates (check by ID)
4. **Wiretap:** Detect source URL patterns and filter data items appropriately
5. **API:** Use pagination with error handling (max 3 consecutive errors)
6. **UI:** Show loading states, empty states, scan progress, and notifications
7. **Preferences:** Persist tab visibility to IndexedDB via StorageService
8. **Type Safety:** Use TypeScript interfaces consistently across all layers

---

## Testing Checklist

- [ ] Tab appears/disappears based on visibility setting
- [ ] Scan button triggers page scan when on specifications page
- [ ] Scan button triggers API scan when not on page
- [ ] Wiretap captures specifications automatically
- [ ] Data persists across extension restarts
- [ ] Search/filter works correctly
- [ ] Click opens specification in Procore
- [ ] Progress bar shows during scan
- [ ] Notification shows when new items captured
- [ ] Empty states display correctly
- [ ] Tab switching works with keyboard navigation

---

## Notes

- **Procore API Endpoint:** Verify the actual API endpoint for specifications. The example uses `/rest/v1.0/projects/{projectId}/specifications` but this may need adjustment.
- **Specification Fields:** Adjust the Specification interface based on actual Procore API response structure.
- **URL Patterns:** Verify Procore URL patterns for specifications pages (may be `/specifications` or `/specs`).
- **Icon:** Choose appropriate icon from `lucide-preact` (FileText, BookOpen, FileCheck, etc.)
