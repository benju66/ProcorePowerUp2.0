# RFIsTab Architecture Notes

## Overview
Complete investigation of RFIsTab implementation to understand patterns for adding new tabs (e.g., Specifications).

---

## Component Structure

### RFIsTab.tsx (224 lines)
**Location:** `v2/src/sidepanel/components/RFIsTab.tsx`

**Key Characteristics:**
- Simpler than DrawingsTab (no grouping, no favorites, no status colors)
- Focused on list display with search
- Status badges for visual status indication
- Direct click-to-open functionality

**State Management:**
```typescript
- rfis: RFI[]                    // Main data array
- searchQuery: string            // Search input
- isLoading: boolean             // Initial load state
- isScanning: boolean            // Scan in progress
- scanStatus: string | null      // Status message
- scanPercent: number            // Progress 0-100
- lastCaptureCount: number | null // New items notification
```

**Key Differences from DrawingsTab:**
1. No discipline grouping (flat list)
2. No favorites integration
3. No status color cycling
4. No drag-and-drop
5. Simpler search (multi-word matching)
6. Status badges instead of status dots
7. No expand/collapse functionality
8. No keyboard navigation hooks

---

## Data Flow

### 1. Initial Load
```
Component Mount → useEffect → StorageService.getRFIs(projectId) → setRFIs()
```

### 2. Passive Capture (Wiretap)
```
Procore Page → Wiretap → Content Script → Background → StorageService.mergeRFIs() → DATA_SAVED message → Component reloads
```

### 3. Active Scan (Page-based)
```
Settings Button → handleScan('rfis') → Content Script PAGE_SCAN → performPageScan('rfis') → 
Expand/Scroll → Wiretap captures → Background processes → SCAN_PROGRESS messages → Component updates
```

### 4. Active Scan (API-based)
```
Settings Button → handleScan('rfis') → Background SCAN_RFIS → ApiService.fetchRFIs() → 
StorageService.mergeRFIs() → DATA_SAVED message → Component reloads
```

---

## Type Definitions

### RFI Interface
```typescript
export interface RFI {
  id: number
  number: string
  subject: string
  status: string
  created_at: string
  due_date?: string
  assignee?: string
  ball_in_court?: string
}
```

**Key Fields:**
- `id`: Unique identifier (required)
- `number`: RFI number (e.g., "RFI-001")
- `subject`: RFI subject/title
- `status`: Current status (open, draft, closed, void)
- `assignee`: Assigned person name

---

## Storage Service Pattern

### Store Creation
```typescript
const rfisStore = createStore('pp-rfis', 'rfis')
const rfiKey = (projectId: string) => `rfis_${projectId}`
```

### Methods
1. **getRFIs(projectId)** - Returns array, defaults to []
2. **saveRFIs(projectId, rfis)** - Overwrites all data
3. **mergeRFIs(projectId, newRFIs)** - Merges new items, avoids duplicates by ID

**Merge Logic:**
```typescript
const existing = await this.getRFIs(projectId)
const existingIds = new Set(existing.map(r => r.id))
const toAdd = newRFIs.filter(r => !existingIds.has(r.id))
const merged = [...existing, ...toAdd]
```

---

## API Service Pattern

### Fetch Method
```typescript
async fetchRFIs(projectId: string, options?: FetchOptions): Promise<RFI[]>
```

**Key Features:**
- Pagination: 100 items per page
- Error handling: Max 3 consecutive errors
- Progress callback support
- Safety limit: Max 100 pages

**Endpoint:**
```
GET /rest/v1.0/projects/{projectId}/rfis?page={page}&per_page={perPage}
```

### Normalization
```typescript
normalizeRFIs(data: unknown[]): RFI[]
```

**Field Mapping:**
- `number` or `rfi_number` → `number`
- `subject` or `title` → `subject`
- `status` → `status` (defaults to 'unknown')
- `created_at` → `created_at`
- `due_date` → `due_date`
- `assignee_name` → `assignee`
- `ball_in_court` → `ball_in_court`

---

## Wiretap Integration

### URL Detection
**Location:** `v2/src/content/wiretap.ts`

```typescript
if (lower.includes('/rfis')) {
  return true
}
```

### Background Processing
**Location:** `v2/src/background/service-worker.ts`

**Detection Function:**
```typescript
function isRFI(item: RawDataItem): boolean {
  return !(!item || !item.id || item.drawing_number || item.vendor || item.vendor_name) && 
    !!(item.subject && item.status && item.number !== undefined)
}
```

**Key Checks:**
- Must have `id`
- Must NOT have drawing-specific fields (`drawing_number`)
- Must NOT have commitment-specific fields (`vendor`, `vendor_name`)
- Must have RFI-specific fields (`subject`, `status`, `number`)

**Processing:**
```typescript
if (isRFISrc && isRFI(firstItem)) {
  const rfis = dataItems.filter(isRFI).map(item => ({
    id: numericId,
    number: item.number || '',
    subject: item.subject || '',
    status: item.status || 'unknown',
    // ... other fields
  }))
  await StorageService.mergeRFIs(activeProjectId, rfis)
}
```

---

## Page Scanning

### Content Script
**Location:** `v2/src/content/content.ts`

**URL Check:**
```typescript
if (scanType === 'rfis') {
  if (!currentUrl.includes('/rfis')) {
    return { success: false, message: 'Navigate to the RFIs page first' }
  }
}
```

**Scan Process:**
1. No special expansion needed (unlike drawings)
2. Auto-scroll to load all items
3. MutationObserver detects new rows
4. Stops when stable (5 cycles with no new rows)
5. Sends SCAN_PROGRESS messages during scan

---

## Message Handling

### Component Listens For:

1. **SCAN_PROGRESS**
   ```typescript
   {
     type: 'SCAN_PROGRESS',
     payload: {
       status: 'started' | 'scanning' | 'complete' | 'timeout',
       scanType: 'rfis',
       percent: number,
       message?: string
     }
   }
   ```

2. **DATA_SAVED**
   ```typescript
   {
     type: 'DATA_SAVED',
     payload: {
       type: 'rfis',
       count?: number
     }
   }
   ```

### Component Actions:
- Updates `scanPercent` and `scanStatus`
- Reloads data on completion
- Shows notification for new captures

---

## UI Components

### Status Colors
```typescript
const STATUS_COLORS: Record<string, string> = {
  'open': 'badge-yellow',
  'draft': 'badge-gray',
  'closed': 'badge-green',
  'void': 'badge-red',
}
```

### Search Functionality
- Multi-word search (all words must match)
- Searches: number (prefix), subject, status, assignee
- Case-insensitive

### Item Rendering
- RFI number (monospace, blue)
- Status badge (color-coded)
- Subject (truncated)
- Assignee (if present)

---

## Tab Visibility Management

### Context Provider
**Location:** `v2/src/sidepanel/contexts/TabVisibilityContext.tsx`

**Pattern:**
1. State in context
2. Load from preferences on mount
3. Setter persists to preferences
4. Reverts on error

**Usage:**
```typescript
const { showRFIsTab, setShowRFIsTab } = useTabVisibility()
```

### App.tsx Integration
```typescript
const visibleTabs = useMemo(() => 
  TABS.filter(tab => {
    if (tab.id === 'rfis') return showRFIsTab
    return true
  }), [showRFIsTab])
```

**Edge Case Handling:**
```typescript
if (activeTab === 'rfis' && !showRFIsTab) {
  setActiveTab('drawings')
}
```

---

## Settings Integration

### Scan Button
- Disabled during scan
- Shows progress percentage
- Error handling for wrong page

### Visibility Toggle
- Checkbox in Settings UI
- Persists to preferences
- Updates context immediately

---

## Key Patterns

### 1. Data Loading
```typescript
useEffect(() => {
  async function loadData() {
    if (rfis.length === 0) setIsLoading(true)
    const cached = await StorageService.getRFIs(projectId)
    if (dataVersion > 0 && cached.length > rfis.length) {
      // Show notification
    }
    setRFIs(cached)
    setIsLoading(false)
  }
  loadData()
}, [projectId, dataVersion])
```

### 2. Scan Progress Listening
```typescript
useEffect(() => {
  const handleMessage = async (message) => {
    if (message.type === 'SCAN_PROGRESS' && payload.scanType === 'rfis') {
      // Update progress
      if (payload.status === 'complete') {
        // Reload data
      }
    }
    if (message.type === 'DATA_SAVED' && payload.type === 'rfis') {
      // Reload data
    }
  }
  chrome.runtime.onMessage.addListener(handleMessage)
  return () => chrome.runtime.onMessage.removeListener(handleMessage)
}, [projectId, isScanning])
```

### 3. Search Filtering
```typescript
const filteredRFIs = useMemo(() => {
  if (!searchQuery.trim()) return rfis
  const words = searchQuery.toLowerCase().split(/\s+/).filter(Boolean)
  return rfis.filter(r => {
    const number = r.number?.toLowerCase() || ''
    const textFields = [r.subject, r.status, r.assignee]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return words.every(word => 
      number.startsWith(word) || textFields.includes(word)
    )
  })
}, [rfis, searchQuery])
```

### 4. Click Handler
```typescript
const handleRFIClick = useCallback(async (rfi: RFI) => {
  const openInBackground = await StorageService.getPreferences<boolean>(
    PREFERENCE_KEYS.openInBackground,
    false
  )
  const url = `https://app.procore.com/${projectId}/project/rfi/show/${rfi.id}`
  chrome.runtime.sendMessage({ 
    action: 'OPEN_TAB', 
    url, 
    background: openInBackground 
  })
}, [projectId])
```

---

## Differences from DrawingsTab

| Feature | DrawingsTab | RFIsTab |
|---------|-------------|---------|
| Grouping | By discipline | Flat list |
| Favorites | Yes | No |
| Status Colors | Custom colors | Status badges |
| Drag & Drop | Yes | No |
| Keyboard Nav | Full support | Basic |
| Expand/Collapse | Yes | No |
| Recents | Yes | No |
| Search Prefixes | `*` favorites, `@` discipline | None |

---

## File Dependencies

### RFIsTab Imports:
- `@/types` - RFI interface
- `@/services` - StorageService
- `@/types/preferences` - PREFERENCE_KEYS
- `./SearchInput` - Search component
- `lucide-preact` - Icons

### Files That Import RFIsTab:
- `App.tsx` - Main app component
- `components/index.ts` - Component exports

---

## Testing Considerations

1. **Data Loading:** Verify data loads on mount and dataVersion change
2. **Scan Progress:** Verify progress bar updates during scan
3. **Notifications:** Verify new capture notifications appear
4. **Search:** Verify multi-word search works correctly
5. **Click:** Verify RFI opens in Procore
6. **Empty States:** Verify empty and no-results states display
7. **Tab Visibility:** Verify tab shows/hides based on preference
8. **Wiretap:** Verify passive capture works
9. **API Scan:** Verify API scan works when not on page
10. **Page Scan:** Verify page scan works when on RFIs page

---

## Notes

- RFIsTab is simpler than DrawingsTab, making it a good reference for basic tab implementation
- No special expansion logic needed (unlike drawings)
- Status badges provide visual feedback without custom color system
- Search is straightforward multi-word matching
- No complex grouping or organization features
- Good example of minimal viable tab implementation
