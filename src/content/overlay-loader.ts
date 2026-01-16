/**
 * Dynamic Import Loader for Overlay
 * 
 * This loader script runs as a classic script and dynamically imports
 * the ES module overlay.js, which is registered as a web_accessible_resource.
 */

(async () => {
  const src = chrome.runtime.getURL('overlay.js')
  await import(src)
})()
