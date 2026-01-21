/**
 * Procore Specifications Investigator Script
 * 
 * Run this in the browser console on the Procore Specifications page
 * to automatically gather all information needed for implementation.
 * 
 * Usage:
 * 1. Navigate to Procore Specifications page
 * 2. Open DevTools Console (F12)
 * 3. Paste this entire script and press Enter
 * 4. Results will be logged to console and copied to clipboard
 */

(function() {
  console.log('🔍 Procore Specifications Investigator');
  console.log('=====================================\n');

  const results = {
    timestamp: new Date().toISOString(),
    url: {},
    apiEndpoints: [],
    pageStructure: {},
    sampleData: null,
    fieldMapping: {},
    recommendations: []
  };

  // ============================================
  // 1. URL ANALYSIS
  // ============================================
  console.log('📋 Step 1: Analyzing URL...');
  
  const url = window.location.href;
  const projectMatch = url.match(/projects\/(\d+)/) || url.match(/\/(\d+)\/project/);
  const companyMatch = url.match(/companies\/(\d+)/);
  const specMatch = url.match(/(specifications|specs|specification_sections)/i);
  
  results.url = {
    full: url,
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
    projectId: projectMatch?.[1] || null,
    companyId: companyMatch?.[1] || null,
    specificationPath: specMatch?.[0] || null,
    patterns: [
      '/specifications',
      '/specs',
      '/specification_sections',
      '/tools/specifications'
    ].filter(pattern => url.toLowerCase().includes(pattern.toLowerCase()))
  };
  
  console.log('✅ URL Analysis Complete');
  console.log('  Project ID:', results.url.projectId);
  console.log('  Company ID:', results.url.companyId);
  console.log('  Specification Path:', results.url.specificationPath);
  console.log('  URL Patterns Found:', results.url.patterns);
  console.log('');

  // ============================================
  // 2. PAGE STRUCTURE ANALYSIS
  // ============================================
  console.log('📋 Step 2: Analyzing Page Structure...');
  
  const agGrid = document.querySelector('.ag-grid');
  const agViewport = document.querySelector('.ag-body-viewport');
  const agRows = document.querySelectorAll('[data-testid="ag-grid-row"]');
  const agRowGroups = document.querySelectorAll('[data-testid="ag-grid-row-group"]');
  const expandButtons = document.querySelectorAll('[aria-label*="expand"], .expand-button, .ag-group-contracted');
  
  results.pageStructure = {
    usesAGGrid: !!agGrid,
    containerSelector: agViewport ? '.ag-body-viewport' : null,
    rowSelector: agRows.length > 0 ? '[data-testid="ag-grid-row"]' : null,
    rowCount: agRows.length,
    hasExpandableSections: agRowGroups.length > 0,
    expandButtonCount: expandButtons.length,
    recommendedScanning: agGrid ? 'AG Grid (similar to Drawings)' : 'Custom (may need custom logic)'
  };
  
  console.log('✅ Page Structure Analysis Complete');
  console.log('  Uses AG Grid:', results.pageStructure.usesAGGrid ? '✅ Yes' : '❌ No');
  console.log('  Container:', results.pageStructure.containerSelector || 'Not found');
  console.log('  Rows Found:', results.pageStructure.rowCount);
  console.log('  Has Expandable Sections:', results.pageStructure.hasExpandableSections ? '✅ Yes' : '❌ No');
  console.log('');

  // ============================================
  // 3. NETWORK REQUEST INTERCEPTION
  // ============================================
  console.log('📋 Step 3: Setting up Network Interception...');
  
  const capturedRequests = [];
  
  // Intercept fetch
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const requestUrl = typeof args[0] === 'string' ? args[0] : args[0].url;
    
    if (requestUrl.includes('specification') || requestUrl.includes('/specs')) {
      console.log('🔍 Captured API Request:', requestUrl);
      
      return originalFetch.apply(this, args).then(response => {
        const cloned = response.clone();
        
        cloned.json().then(data => {
          capturedRequests.push({
            url: requestUrl,
            method: args[1]?.method || 'GET',
            data: data,
            timestamp: new Date().toISOString()
          });
          
          // Store first substantial response as sample
          const items = Array.isArray(data) ? data : (data.data || data.entities || []);
          if (items.length > 0 && !results.sampleData) {
            results.sampleData = {
              raw: data,
              firstItem: items[0],
              itemCount: items.length,
              hasPagination: data.total !== undefined,
              total: data.total,
              perPage: data.per_page
            };
            
            console.log('📦 Sample Data Captured!');
            console.log('  Items:', items.length);
            console.log('  First Item:', items[0]);
          }
        }).catch(() => {
          // Not JSON, ignore
        });
        
        return response;
      });
    }
    
    return originalFetch.apply(this, args);
  };
  
  // Intercept XMLHttpRequest
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._url = url;
    return originalXHROpen.apply(this, [method, url, ...rest]);
  };
  
  XMLHttpRequest.prototype.send = function(...args) {
    if (this._url && (this._url.includes('specification') || this._url.includes('/specs'))) {
      console.log('🔍 Captured XHR Request:', this._url);
      
      this.addEventListener('load', function() {
        try {
          const data = JSON.parse(this.responseText);
          capturedRequests.push({
            url: this._url,
            method: 'GET',
            data: data,
            timestamp: new Date().toISOString()
          });
          
          const items = Array.isArray(data) ? data : (data.data || data.entities || []);
          if (items.length > 0 && !results.sampleData) {
            results.sampleData = {
              raw: data,
              firstItem: items[0],
              itemCount: items.length,
              hasPagination: data.total !== undefined,
              total: data.total,
              perPage: data.per_page
            };
            
            console.log('📦 Sample Data Captured!');
            console.log('  Items:', items.length);
            console.log('  First Item:', items[0]);
          }
        } catch (e) {
          // Not JSON, ignore
        }
      });
    }
    
    return originalXHRSend.apply(this, args);
  };
  
  console.log('✅ Network Interceptors Installed');
  console.log('  ⚠️  Navigate or refresh the page to capture API requests');
  console.log('');

  // ============================================
  // 4. ANALYZE CAPTURED DATA
  // ============================================
  function analyzeData() {
    if (!results.sampleData) {
      console.log('⚠️  No sample data captured yet. Try refreshing the page.');
      return;
    }
    
    console.log('📋 Step 4: Analyzing Captured Data...');
    
    const item = results.sampleData.firstItem;
    const allFields = Object.keys(item);
    
    // Identify key fields
    results.fieldMapping = {
      id: {
        source: 'id',
        type: typeof item.id,
        required: true,
        example: item.id
      },
      number: {
        source: allFields.find(f => f.includes('number') || f.includes('Number')) || 'number',
        alternatives: allFields.filter(f => f.includes('number') || f.includes('Number')),
        type: typeof (item.number || item.spec_number || item.section_number),
        example: item.number || item.spec_number || item.section_number
      },
      title: {
        source: allFields.find(f => f.includes('title') || f.includes('Title') || f.includes('name') || f.includes('Name')) || 'title',
        alternatives: allFields.filter(f => f.includes('title') || f.includes('Title') || f.includes('name') || f.includes('Name')),
        type: typeof (item.title || item.name),
        example: item.title || item.name
      },
      section: {
        source: allFields.find(f => f.includes('section') || f.includes('Section')) || null,
        alternatives: allFields.filter(f => f.includes('section') || f.includes('Section')),
        type: typeof (item.section || item.section_number),
        example: item.section || item.section_number
      },
      division: {
        source: allFields.find(f => f.includes('division') || f.includes('Division')) || null,
        alternatives: allFields.filter(f => f.includes('division') || f.includes('Division')),
        type: typeof (item.division || item.division_number),
        example: item.division || item.division_number
      }
    };
    
    // Extract API endpoint pattern
    if (capturedRequests.length > 0) {
      const firstRequest = capturedRequests[0];
      const endpointMatch = firstRequest.url.match(/\/rest\/v[\d.]+\/projects\/\d+\/([^?]+)/);
      if (endpointMatch) {
        results.apiEndpoints.push({
          pattern: `/rest/v1.0/projects/{projectId}/${endpointMatch[1]}`,
          fullUrl: firstRequest.url,
          method: firstRequest.method,
          hasPagination: results.sampleData.hasPagination,
          paginationParams: firstRequest.url.includes('page=') ? 'page, per_page' : 'unknown'
        });
      }
    }
    
    console.log('✅ Data Analysis Complete');
    console.log('  Total Fields:', allFields.length);
    console.log('  Key Fields:', Object.keys(results.fieldMapping));
    console.log('');
  }

  // ============================================
  // 5. GENERATE RECOMMENDATIONS
  // ============================================
  function generateRecommendations() {
    console.log('📋 Step 5: Generating Recommendations...');
    
    results.recommendations = [];
    
    // Wiretap recommendations
    if (results.url.patterns.length > 0) {
      results.recommendations.push({
        type: 'wiretap',
        action: 'Add URL patterns to wiretap.ts',
        patterns: results.url.patterns,
        code: `if (lower.includes('${results.url.patterns[0]}')) { return true; }`
      });
    }
    
    // API endpoint recommendations
    if (results.apiEndpoints.length > 0) {
      const endpoint = results.apiEndpoints[0];
      results.recommendations.push({
        type: 'api',
        action: 'Add fetch method to api.ts',
        endpoint: endpoint.pattern,
        code: `const url = \`\${PROCORE_BASE}${endpoint.pattern}?page=\${page}&per_page=\${perPage}\`;`
      });
    }
    
    // Detection function recommendations
    if (results.sampleData) {
      const item = results.sampleData.firstItem;
      const hasSpecFields = item.spec_number || item.section || item.division;
      const hasDrawingFields = item.drawing_number;
      const hasCommitmentFields = item.vendor || item.vendor_name;
      
      results.recommendations.push({
        type: 'detection',
        action: 'Create isSpecification() function',
        logic: hasSpecFields ? 'Has spec-specific fields' : 'Needs investigation',
        code: `function isSpecification(item) {
  if (!item || !item.id) return false;
  if (item.spec_number || item.section || item.division) return true;
  if (item.drawing_number) return false;
  if (item.vendor || item.vendor_name) return false;
  return false;
}`
      });
    }
    
    // Scanning recommendations
    if (results.pageStructure.usesAGGrid) {
      results.recommendations.push({
        type: 'scanning',
        action: 'Use similar scanning logic as Drawings',
        note: 'Page uses AG Grid - can reuse DrawingsTab scanning patterns'
      });
    } else {
      results.recommendations.push({
        type: 'scanning',
        action: 'May need custom scanning logic',
        note: 'Page does not use AG Grid - investigate scroll container'
      });
    }
    
    console.log('✅ Recommendations Generated');
    console.log('');
  }

  // ============================================
  // 6. OUTPUT RESULTS
  // ============================================
  function outputResults() {
    console.log('📋 Step 6: Final Results');
    console.log('========================\n');
    
    console.log('📊 Complete Investigation Results:');
    console.log(JSON.stringify(results, null, 2));
    
    // Copy to clipboard
    navigator.clipboard.writeText(JSON.stringify(results, null, 2))
      .then(() => {
        console.log('\n✅ Results copied to clipboard!');
        console.log('💾 Paste into a file: specifications-investigation-results.json');
      })
      .catch(() => {
        console.log('\n⚠️  Could not copy to clipboard. Copy the JSON above manually.');
      });
    
    // Generate implementation code snippets
    console.log('\n📝 Implementation Code Snippets:');
    console.log('================================\n');
    
    if (results.apiEndpoints.length > 0) {
      console.log('1. API Endpoint:');
      console.log(`   ${results.apiEndpoints[0].pattern}`);
      console.log('');
    }
    
    if (results.sampleData) {
      console.log('2. Field Mapping:');
      Object.entries(results.fieldMapping).forEach(([key, value]) => {
        console.log(`   ${key}: ${value.source} (${value.type})`);
      });
      console.log('');
    }
    
    if (results.url.patterns.length > 0) {
      console.log('3. Wiretap URL Patterns:');
      results.url.patterns.forEach(pattern => {
        console.log(`   - ${pattern}`);
      });
      console.log('');
    }
    
    console.log('✅ Investigation Complete!');
    console.log('\n📋 Next Steps:');
    console.log('1. Review the results above');
    console.log('2. Save the JSON to a file');
    console.log('3. Update SPECIFICATIONS_TAB_IMPLEMENTATION_GUIDE.md with your findings');
    console.log('4. Implement the tab using the guide');
  }

  // ============================================
  // AUTO-RUN ANALYSIS AFTER DELAY
  // ============================================
  console.log('⏳ Waiting for data capture...');
  console.log('   (This will analyze data automatically in 5 seconds)');
  console.log('   (Or refresh the page to capture API requests)\n');
  
  setTimeout(() => {
    analyzeData();
    generateRecommendations();
    outputResults();
  }, 5000);
  
  // Also provide manual trigger
  window.analyzeSpecifications = function() {
    analyzeData();
    generateRecommendations();
    outputResults();
  };
  
  console.log('💡 Tip: Run analyzeSpecifications() manually after page loads');
  
})();
