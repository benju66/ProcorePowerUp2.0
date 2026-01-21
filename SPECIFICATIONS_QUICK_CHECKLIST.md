# Specifications Investigation Quick Checklist

## 🚀 Quick Start (5 minutes)

1. **Navigate to Specifications page** in Procore
2. **Open DevTools** (F12) → Console tab
3. **Paste and run** `specifications-investigator.js`
4. **Wait 5 seconds** or refresh page
5. **Copy results** from console (auto-copied to clipboard)
6. **Save to file**: `specifications-investigation-results.json`

---

## 📋 Manual Checklist

### API Information (Network Tab)
- [ ] Open Network tab → Filter: XHR/Fetch
- [ ] Find specifications API request
- [ ] Copy Request URL
- [ ] Copy Response JSON
- [ ] Note pagination headers (`total`, `per-page`)

**What to look for:**
```
GET /rest/v1.0/projects/{projectId}/specifications?page=1&per_page=100
Response: { data: [...], total: 500, per_page: 100 }
```

### URL Patterns (Address Bar)
- [ ] Copy full URL from address bar
- [ ] Note all URL variations when navigating
- [ ] Check for query parameters

**Common patterns:**
- `/tools/specifications`
- `/project/specifications`
- `/specification_sections`

### Page Structure (Elements Tab)
- [ ] Right-click on specification item → Inspect
- [ ] Check for AG Grid classes (`.ag-grid`, `.ag-body-viewport`)
- [ ] Note container selectors
- [ ] Check for expandable sections

**Quick check:**
```javascript
// Run in console:
console.log({
  hasAGGrid: !!document.querySelector('.ag-grid'),
  rows: document.querySelectorAll('[data-testid="ag-grid-row"]').length
});
```

### Data Fields (Response Tab)
- [ ] Open API response in Network tab
- [ ] Note all field names
- [ ] Identify required vs optional fields
- [ ] Check for field name variations

**Key fields to find:**
- `id` (required)
- `number` or `spec_number` or `section_number`
- `title` or `name`
- `section` or `section_number`
- `division` or `division_number`
- `status`
- `created_at`, `updated_at`

---

## 🔍 Critical Information Needed

### 1. API Endpoint
```
✅ Found: GET /rest/v1.0/projects/{projectId}/specifications
❌ Need: Exact endpoint URL
```

### 2. Response Structure
```
✅ Found: { data: [...], total: 500, per_page: 100 }
❌ Need: Actual response structure
```

### 3. Field Names
```
✅ Found: id, number, title
❌ Need: All field names and types
```

### 4. URL Patterns
```
✅ Found: /specifications
❌ Need: All URL patterns
```

### 5. Page Type
```
✅ Found: AG Grid
❌ Need: Grid/table type
```

---

## 🛠️ Quick Console Commands

### Capture API Request
```javascript
// Intercept fetch
const originalFetch = window.fetch;
window.fetch = function(...args) {
  if (args[0].includes('specification')) {
    console.log('🔍', args[0]);
    return originalFetch.apply(this, args).then(r => {
      r.clone().json().then(d => {
        console.log('📋', d);
        navigator.clipboard.writeText(JSON.stringify(d, null, 2));
      });
      return r;
    });
  }
  return originalFetch.apply(this, args);
};
```

### Extract URL Info
```javascript
console.log({
  url: window.location.href,
  projectId: window.location.href.match(/projects\/(\d+)/)?.[1],
  pathname: window.location.pathname
});
```

### Check Page Structure
```javascript
console.log({
  hasAGGrid: !!document.querySelector('.ag-grid'),
  viewport: document.querySelector('.ag-body-viewport'),
  rows: document.querySelectorAll('[data-testid="ag-grid-row"]').length
});
```

---

## 📊 What to Document

### API Endpoint
- [ ] Full URL pattern
- [ ] HTTP method (GET/POST)
- [ ] Query parameters
- [ ] Response structure
- [ ] Pagination details

### Data Fields
- [ ] Complete field list
- [ ] Field types
- [ ] Required vs optional
- [ ] Field name alternatives

### URL Patterns
- [ ] Main page URL
- [ ] Section URLs
- [ ] Detail view URLs
- [ ] Query parameters

### Page Structure
- [ ] Grid/table type
- [ ] Container selectors
- [ ] Row selectors
- [ ] Scroll container
- [ ] Expandable sections

---

## ✅ Verification Steps

After gathering information, verify:

1. **API works:** Can you fetch data manually?
2. **Wiretap works:** Does wiretap capture data?
3. **Fields match:** Do field names match API response?
4. **URLs match:** Do URL patterns match actual URLs?
5. **Structure matches:** Does page structure match expectations?

---

## 🎯 Expected Output

After investigation, you should have:

1. ✅ `specifications-investigation-results.json` file
2. ✅ API endpoint URL pattern
3. ✅ Sample API response data
4. ✅ Field mapping document
5. ✅ URL patterns list
6. ✅ Page structure notes

---

## 📝 Next Steps

1. Review investigation results
2. Update `SPECIFICATIONS_TAB_IMPLEMENTATION_GUIDE.md`
3. Create `Specification` interface in `types/index.ts`
4. Implement storage methods
5. Implement API service methods
6. Update wiretap detection
7. Create SpecificationsTab component
8. Test implementation

---

## 🆘 Troubleshooting

### No API requests captured?
- Refresh the page
- Check Network tab filters
- Try navigating to different sections

### No data in response?
- Check if you're logged in
- Verify project access
- Check API endpoint URL

### Can't find page structure?
- Try different selectors
- Check for iframes
- Inspect different elements

---

## 💡 Pro Tips

1. **Use the automated script** - It does most of the work
2. **Take screenshots** - Visual reference helps
3. **Test multiple projects** - Data may vary
4. **Check different sections** - URLs may differ
5. **Save everything** - Better to have too much info

---

## 🔗 Related Files

- `SPECIFICATIONS_INVESTIGATION_GUIDE.md` - Detailed guide
- `SPECIFICATIONS_TAB_IMPLEMENTATION_GUIDE.md` - Implementation guide
- `specifications-investigator.js` - Automated script
- `RFIS_TAB_ARCHITECTURE_NOTES.md` - Reference implementation
