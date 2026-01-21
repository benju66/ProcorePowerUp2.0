# Procore Specifications Investigation Guide

This guide will help you discover everything needed to implement the Specifications tab by investigating Procore's Specifications tool page.

---

## Step 1: Navigate to Specifications Page

1. Open Procore in Chrome
2. Navigate to a project
3. Go to the **Specifications** tool (usually under Project Tools)
4. Note the URL pattern - it will look something like:
   - `https://app.procore.com/{companyId}/projects/{projectId}/tools/specifications`
   - Or: `https://app.procore.com/{projectId}/project/specifications`
   - Or: `https://app.procore.com/{projectId}/project/specification_sections`

**Action:** Copy the exact URL and note all URL patterns you see when navigating.

---

## Step 2: Inspect Network Requests

### Using Chrome DevTools Network Tab

1. **Open DevTools:**
   - Press `F12` or `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
   - Go to **Network** tab

2. **Filter for API Requests:**
   - Filter by: `XHR` or `Fetch`
   - Look for requests to `app.procore.com/rest/` or `app.procore.com/api/`
   - Common patterns:
     - `/rest/v1.0/projects/{projectId}/specifications`
     - `/rest/v1.1/projects/{projectId}/specifications`
     - `/rest/v1.0/projects/{projectId}/specification_sections`

3. **Identify Key Endpoints:**
   - **List endpoint:** Fetches all specifications (usually paginated)
   - **Detail endpoint:** Fetches single specification (if clicking on one)
   - **Sections endpoint:** Fetches specification sections/divisions

4. **Inspect Request Details:**
   - Click on a request
   - Check **Headers** tab:
     - Request URL (full endpoint)
     - Request Method (GET, POST, etc.)
     - Query parameters (`?page=1&per_page=100`)
   - Check **Payload** tab (if POST/PUT)
   - Check **Response** tab:
     - Response structure
     - Field names
     - Data types

### What to Document:

```markdown
## API Endpoints Found:

### List Specifications
- **URL:** `GET /rest/v1.0/projects/{projectId}/specifications`
- **Query Params:** `?page=1&per_page=100`
- **Response Structure:**
  ```json
  {
    "data": [
      {
        "id": 12345,
        "number": "01 10 00",
        "title": "Summary",
        "section": "01",
        "division": "01 10 00",
        ...
      }
    ],
    "total": 500,
    "per_page": 100
  }
  ```

### Specification Sections
- **URL:** `GET /rest/v1.0/projects/{projectId}/specification_sections`
- **Response:** Array of sections/divisions
```

---

## Step 3: Inspect Page Structure

### Using Chrome DevTools Elements Tab

1. **Inspect Specification List:**
   - Right-click on a specification item in the list
   - Select "Inspect"
   - Look for:
     - Container classes/IDs
     - Data attributes (`data-*`)
     - AG Grid structure (if using AG Grid like Drawings)

2. **Identify Data Attributes:**
   - Look for `data-id`, `data-spec-id`, `data-number`, etc.
   - These help identify how Procore stores data in the DOM

3. **Check for AG Grid:**
   - Look for classes like `.ag-grid`, `.ag-body-viewport`
   - If present, specifications use AG Grid (like Drawings)
   - This means we can use similar scanning logic

### What to Document:

```markdown
## Page Structure:

- **Grid Type:** AG Grid / Custom Table / List
- **Container Selector:** `.specifications-list` or `.ag-body-viewport`
- **Row Selector:** `.spec-row` or `[data-testid="ag-grid-row"]`
- **Data Attributes:** `data-spec-id`, `data-number`, etc.
```

---

## Step 4: Capture API Response Data

### Method 1: Copy from Network Tab

1. In Network tab, find the specifications API request
2. Click on it
3. Go to **Response** tab
4. Right-click → **Copy** → **Copy response**
5. Save to a file: `specifications-api-response.json`

### Method 2: Use Console to Intercept

Open Console tab and run:

```javascript
// Intercept fetch requests
const originalFetch = window.fetch;
window.fetch = function(...args) {
  const url = args[0];
  if (url.includes('/specifications') || url.includes('/specs')) {
    console.log('🔍 Specifications API Call:', url);
    return originalFetch.apply(this, args).then(response => {
      const cloned = response.clone();
      cloned.json().then(data => {
        console.log('📋 Specifications Data:', data);
        // Copy this to clipboard
        navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        console.log('✅ Data copied to clipboard!');
      });
      return response;
    });
  }
  return originalFetch.apply(this, args);
};

console.log('✅ Fetch interceptor installed. Navigate or refresh the page.');
```

### Method 3: Use Wiretap Script (Recommended)

Create a temporary script to capture wiretap data:

```javascript
// Run this in Console on the Specifications page
(function() {
  // Listen for wiretap messages (if extension is installed)
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'PP_DATA' && 
        (event.data.source.includes('/specifications') || 
         event.data.source.includes('/specs'))) {
      console.log('📋 Wiretap captured Specifications data:', event.data);
      console.log('📦 Payload:', event.data.payload);
      console.log('🔗 Source:', event.data.source);
      
      // Copy to clipboard
      navigator.clipboard.writeText(JSON.stringify(event.data.payload, null, 2))
        .then(() => console.log('✅ Payload copied to clipboard!'));
    }
  });
  
  console.log('✅ Wiretap listener installed. Data will be logged when captured.');
})();
```

---

## Step 5: Analyze Data Structure

### Create a Data Analysis Script

Save this as `analyze-specifications.js` and run in Console:

```javascript
// Paste the API response data here, or fetch it
const sampleData = {
  // Paste your API response here
};

// Or fetch from current page
async function analyzeSpecifications() {
  // Find the API call from network tab and copy the response
  // Or intercept it:
  const response = await fetch(window.location.href.replace('/tools/specifications', '/rest/v1.0/projects/123/specifications'));
  const data = await response.json();
  
  console.log('📊 Specifications Data Analysis:');
  console.log('================================');
  
  // Analyze structure
  const items = Array.isArray(data) ? data : (data.data || data.entities || []);
  
  if (items.length === 0) {
    console.warn('⚠️ No items found in response');
    return;
  }
  
  const firstItem = items[0];
  
  console.log('\n📋 Sample Item Structure:');
  console.log(JSON.stringify(firstItem, null, 2));
  
  console.log('\n🔑 Key Fields:');
  console.log('- id:', firstItem.id, typeof firstItem.id);
  console.log('- number:', firstItem.number, typeof firstItem.number);
  console.log('- title:', firstItem.title, typeof firstItem.title);
  console.log('- section:', firstItem.section, typeof firstItem.section);
  console.log('- division:', firstItem.division, typeof firstItem.division);
  
  console.log('\n📊 All Fields:');
  Object.keys(firstItem).forEach(key => {
    const value = firstItem[key];
    console.log(`- ${key}:`, typeof value, Array.isArray(value) ? `[${value.length} items]` : value);
  });
  
  console.log('\n📈 Statistics:');
  console.log('- Total items:', items.length);
  console.log('- Items with number:', items.filter(i => i.number).length);
  console.log('- Items with title:', items.filter(i => i.title).length);
  console.log('- Items with section:', items.filter(i => i.section).length);
  console.log('- Unique sections:', [...new Set(items.map(i => i.section).filter(Boolean))].length);
  
  // Check for pagination
  if (data.total !== undefined) {
    console.log('\n📄 Pagination:');
    console.log('- Total:', data.total);
    console.log('- Per page:', data.per_page || items.length);
    console.log('- Has pagination:', data.total > items.length);
  }
  
  return {
    sampleItem: firstItem,
    allFields: Object.keys(firstItem),
    statistics: {
      total: items.length,
      hasPagination: data.total !== undefined
    }
  };
}

// Run analysis
analyzeSpecifications();
```

---

## Step 6: Test Wiretap Capture

### Check if Wiretap Already Captures Specifications

1. **Open your extension's side panel**
2. **Navigate to Specifications page in Procore**
3. **Open Console** and check for:
   - `PP Wiretap: Captured` messages
   - `PP Background: Wiretap received` messages

### Manual Wiretap Test

Run this in Console on Specifications page:

```javascript
// Simulate wiretap capture
const testData = {
  type: 'PP_DATA',
  payload: [
    // Paste a sample specification item here
    {
      id: 12345,
      number: "01 10 00",
      title: "Summary",
      // ... other fields
    }
  ],
  ids: {
    projectId: window.location.href.match(/projects\/(\d+)/)?.[1] || null,
    companyId: window.location.href.match(/companies\/(\d+)/)?.[1] || null,
    drawingAreaId: null
  },
  source: window.location.href,
  headers: {
    total: "500",
    perPage: "100"
  }
};

// Send to extension (if wiretap is set up)
window.postMessage(testData, window.location.origin);
console.log('✅ Test data sent:', testData);
```

---

## Step 7: Identify URL Patterns

### Document All URL Variations

Run this in Console:

```javascript
// Capture all URL patterns
const urlPatterns = {
  current: window.location.href,
  pathname: window.location.pathname,
  search: window.location.search,
  hash: window.location.hash
};

console.log('🔗 URL Patterns:');
console.log('Current URL:', urlPatterns.current);
console.log('Pathname:', urlPatterns.pathname);
console.log('Search params:', urlPatterns.search);
console.log('Hash:', urlPatterns.hash);

// Extract IDs
const projectMatch = window.location.href.match(/projects\/(\d+)/) || 
                     window.location.href.match(/\/(\d+)\/project/);
const companyMatch = window.location.href.match(/companies\/(\d+)/);

console.log('\n🆔 Extracted IDs:');
console.log('Project ID:', projectMatch?.[1]);
console.log('Company ID:', companyMatch?.[1]);

// Check for specification-specific paths
const specPaths = [
  '/specifications',
  '/specs',
  '/specification_sections',
  '/specification_sections/',
];

const foundPaths = specPaths.filter(path => 
  window.location.href.toLowerCase().includes(path.toLowerCase())
);

console.log('\n📋 Specification Paths Found:');
foundPaths.forEach(path => console.log('-', path));
```

---

## Step 8: Test Page Scanning

### Check if Page Uses AG Grid

Run this in Console:

```javascript
// Check for AG Grid
const agGridElements = {
  grid: document.querySelector('.ag-grid'),
  bodyViewport: document.querySelector('.ag-body-viewport'),
  rows: document.querySelectorAll('[data-testid="ag-grid-row"]'),
  rowGroups: document.querySelectorAll('[data-testid="ag-grid-row-group"]')
};

console.log('🔍 AG Grid Detection:');
console.log('Grid container:', agGridElements.grid ? '✅ Found' : '❌ Not found');
console.log('Body viewport:', agGridElements.bodyViewport ? '✅ Found' : '❌ Not found');
console.log('Rows:', agGridElements.rows.length);
console.log('Row groups:', agGridElements.rowGroups.length);

if (agGridElements.grid) {
  console.log('\n✅ Page uses AG Grid - can use similar scanning logic as Drawings');
} else {
  console.log('\n⚠️ Page does NOT use AG Grid - may need custom scanning logic');
}

// Check for expandable sections
const expandButtons = document.querySelectorAll('[aria-label*="expand"], .expand-button, .ag-group-contracted');
console.log('\n📂 Expandable Elements:', expandButtons.length);
```

---

## Step 9: Document Specification Fields

### Create Field Mapping

Based on your API response analysis, create a mapping:

```typescript
// From API Response → To Our Interface
interface SpecificationAPIResponse {
  id: number | string
  number?: string
  spec_number?: string
  title?: string
  name?: string
  section?: string
  division?: string
  section_number?: string
  division_number?: string
  status?: string
  created_at?: string
  updated_at?: string
  // ... other fields
}

// Our normalized interface
interface Specification {
  id: number
  number: string
  title: string
  section?: string
  division?: string
  status?: string
  created_at?: string
  updated_at?: string
}
```

### Field Mapping Logic

```typescript
function normalizeSpecification(item: SpecificationAPIResponse): Specification {
  return {
    id: typeof item.id === 'string' ? parseInt(item.id, 10) : item.id,
    number: item.number || item.spec_number || item.section_number || '',
    title: item.title || item.name || '',
    section: item.section || item.section_number,
    division: item.division || item.division_number,
    status: item.status,
    created_at: item.created_at,
    updated_at: item.updated_at,
  }
}
```

---

## Step 10: Test Detection Logic

### Test isSpecification() Function

Run this in Console with sample data:

```javascript
// Test detection logic
function isSpecification(item) {
  if (!item || !item.id) return false;
  
  // Must have specification-specific fields
  if (item.spec_number || item.section || item.division || item.section_number) {
    return true;
  }
  
  // Must NOT have drawing-specific fields
  if (item.drawing_number || (item.number && item.number.match(/^[A-Z]-\d+/))) {
    return false;
  }
  
  // Must NOT have commitment-specific fields
  if (item.vendor || item.vendor_name || item.contract_date) {
    return false;
  }
  
  // Must NOT have RFI-specific fields (without drawing_number)
  if (item.subject && item.status && !item.drawing_number && item.number?.startsWith('RFI')) {
    return false;
  }
  
  return false; // Default: not a specification
}

// Test with sample items
const testItems = [
  { id: 1, spec_number: "01 10 00", title: "Summary" }, // ✅ Should be true
  { id: 2, drawing_number: "A-101", title: "Plan" }, // ❌ Should be false
  { id: 3, vendor: "ABC Corp", title: "Contract" }, // ❌ Should be false
  { id: 4, section: "01", division: "01 10 00" }, // ✅ Should be true
];

testItems.forEach((item, i) => {
  const result = isSpecification(item);
  console.log(`Test ${i + 1}:`, result ? '✅' : '❌', item);
});
```

---

## Step 11: Complete Investigation Checklist

Use this checklist to ensure you have all needed information:

### API Information
- [ ] List endpoint URL (with project ID placeholder)
- [ ] API version (v1.0, v1.1, etc.)
- [ ] Pagination parameters (`page`, `per_page`)
- [ ] Response structure (array vs object with `data` property)
- [ ] Pagination headers (`total`, `per-page`)
- [ ] Sample API response (saved to file)

### Data Structure
- [ ] All field names from API response
- [ ] Field types (string, number, object, array)
- [ ] Required vs optional fields
- [ ] Field name variations (e.g., `number` vs `spec_number`)
- [ ] Nested objects/arrays structure

### URL Patterns
- [ ] Main specifications page URL pattern
- [ ] Section/division URL patterns
- [ ] Detail view URL pattern (if clicking on item)
- [ ] URL parameters used

### Page Structure
- [ ] Grid/table type (AG Grid, custom, etc.)
- [ ] Container selectors
- [ ] Row selectors
- [ ] Expandable sections (if any)
- [ ] Scroll container selector

### Wiretap Integration
- [ ] URL patterns that should trigger wiretap
- [ ] Source URL detection logic
- [ ] Data filtering logic (isSpecification function)

### Scanning Logic
- [ ] Does page need expansion (like drawings)?
- [ ] Scroll container identification
- [ ] MutationObserver targets
- [ ] Stability detection logic

---

## Step 12: Create Test Data File

Save your findings to `specifications-test-data.json`:

```json
{
  "apiEndpoint": "GET /rest/v1.0/projects/{projectId}/specifications",
  "urlPatterns": [
    "/tools/specifications",
    "/project/specifications",
    "/specification_sections"
  ],
  "sampleResponse": {
    "data": [
      {
        "id": 12345,
        "number": "01 10 00",
        "title": "Summary",
        "section": "01",
        "division": "01 10 00",
        "status": "active",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z"
      }
    ],
    "total": 500,
    "per_page": 100
  },
  "fieldMapping": {
    "id": "id (number)",
    "number": "number || spec_number || section_number",
    "title": "title || name",
    "section": "section || section_number",
    "division": "division || division_number",
    "status": "status",
    "created_at": "created_at",
    "updated_at": "updated_at"
  },
  "pageStructure": {
    "gridType": "AG Grid",
    "containerSelector": ".ag-body-viewport",
    "rowSelector": "[data-testid='ag-grid-row']",
    "needsExpansion": false
  },
  "wiretapPatterns": [
    "/specifications",
    "/specs",
    "/specification_sections"
  ]
}
```

---

## Quick Reference: Console Commands

Copy-paste these into Console for quick investigation:

```javascript
// 1. Capture all fetch requests
const originalFetch = window.fetch;
window.fetch = function(...args) {
  if (args[0].includes('specification') || args[0].includes('specs')) {
    console.log('🔍', args[0]);
    return originalFetch.apply(this, args).then(r => {
      r.clone().json().then(d => console.log('📋', d));
      return r;
    });
  }
  return originalFetch.apply(this, args);
};

// 2. Extract current page info
console.log({
  url: window.location.href,
  projectId: window.location.href.match(/projects\/(\d+)/)?.[1],
  companyId: window.location.href.match(/companies\/(\d+)/)?.[1],
  pathname: window.location.pathname
});

// 3. Check for AG Grid
console.log({
  hasAGGrid: !!document.querySelector('.ag-grid'),
  viewport: document.querySelector('.ag-body-viewport'),
  rows: document.querySelectorAll('[data-testid="ag-grid-row"]').length
});

// 4. List all network requests (run before page load)
performance.getEntriesByType('resource')
  .filter(r => r.name.includes('specification') || r.name.includes('specs'))
  .forEach(r => console.log(r.name));
```

---

## Next Steps After Investigation

Once you have all the information:

1. **Update the Implementation Guide** with your findings
2. **Create the Specification interface** based on actual API response
3. **Update wiretap.ts** with correct URL patterns
4. **Update service-worker.ts** with correct detection logic
5. **Update api.ts** with correct endpoint and normalization
6. **Test wiretap capture** on the Specifications page
7. **Test API scanning** using the background service worker
8. **Test page scanning** if applicable

---

## Troubleshooting

### If wiretap doesn't capture:
- Check `wiretap.ts` URL patterns match actual URLs
- Verify fetch interceptor is working
- Check console for wiretap messages

### If API endpoint doesn't work:
- Verify API version (v1.0 vs v1.1)
- Check authentication headers
- Verify project ID format
- Check for required query parameters

### If page scanning doesn't work:
- Verify scroll container selector
- Check if page uses AG Grid
- Verify MutationObserver targets
- Check stability detection logic
