/**
 * Wiretap Script (MAIN world)
 * 
 * Intercepts fetch and XHR requests to capture Procore API responses.
 * Ported from injected.js with TypeScript types.
 */

;(function() {
  console.log('Procore Power-Up 2.0: Wiretap active')

  interface WiretapIds {
    companyId: string | null
    projectId: string | null
    drawingAreaId: string | null
  }

  interface WiretapHeaders {
    total: string | null
    perPage: string | null
  }

  function getIds(): WiretapIds {
    const url = window.location.href
    const projectMatch = url.match(/projects\/(\d+)/) || url.match(/\/(\d+)\/project/)
    const areaMatch = url.match(/areas\/(\d+)/) || url.match(/drawing_areas\/(\d+)/)
    const companyMatch = url.match(/companies\/(\d+)/)

    return {
      companyId: companyMatch?.[1] ?? null,
      projectId: projectMatch?.[1] ?? null,
      drawingAreaId: areaMatch?.[1] ?? null,
    }
  }

  function broadcast(data: unknown, sourceUrl: string, headers: WiretapHeaders = { total: null, perPage: null }) {
    // Log what we're capturing for debugging
    const dataLength = Array.isArray(data) ? data.length : 'object'
    console.log('PP Wiretap: Captured', dataLength, 'items from:', sourceUrl.substring(0, 100))
    
    window.postMessage({
      type: 'PP_DATA',
      payload: data,
      ids: getIds(),
      source: sourceUrl,
      headers,
    }, window.location.origin)
  }

  function isRelevantUrl(url: string | null): boolean {
    if (!url) return false

    // Resolve relative URLs
    let fullUrl = url
    if (url.startsWith('/')) {
      fullUrl = window.location.origin + url
    }

    // Basic domain check
    if (!fullUrl.includes('procore.com')) return false

    const lower = fullUrl.toLowerCase()

    // Exclude static assets
    if (/\.(png|jpg|gif|css|js|pdf|zip|svg|woff|woff2|ico)(\?.*)?$/.test(lower)) {
      return false
    }

    // 1. Drawings - capture all drawing-related endpoints
    if (lower.includes('drawing_log') || lower.includes('drawing_revisions') || lower.includes('/drawings')) {
      return true
    }
    // Groups/disciplines - these contain the discipline mappings
    if (lower.includes('groups') || lower.includes('discipline') || lower.includes('drawing_areas')) {
      return true
    }
    // AG Grid server-side row model requests (Procore uses AG Grid)
    if (lower.includes('server_side') || lower.includes('serverside')) {
      return true
    }

    // 2. RFIs
    if (lower.includes('/rfis')) {
      return true
    }

    // 3. Commitments
    if (lower.includes('commitment') || lower.includes('contract')) {
      return true
    }

    return false
  }

  // --- FETCH INTERCEPTOR ---
  const originalFetch = window.fetch
  window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const response = await originalFetch.call(window, input, init)

    // Handle Request object or string URL
    let url: string
    if (input instanceof Request) {
      url = input.url
    } else if (input instanceof URL) {
      url = input.href
    } else {
      url = input
    }

    if (isRelevantUrl(url)) {
      const clone = response.clone()

      // Capture pagination headers
      const headers: WiretapHeaders = {
        total: response.headers.get('total') || response.headers.get('Total'),
        perPage: response.headers.get('per-page') || response.headers.get('Per-Page'),
      }

      const contentType = response.headers.get('content-type')
      if (contentType?.includes('application/json')) {
        clone.json()
          .then((data) => broadcast(data, url, headers))
          .catch(() => { /* Ignore JSON parse errors */ })
      }
    }

    return response
  }

  // --- XHR INTERCEPTOR ---
  const originalXHRSend = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.send = function(body?: Document | XMLHttpRequestBodyInit | null) {
    this.addEventListener('load', function(this: XMLHttpRequest) {
      const url = this.responseURL
      if (isRelevantUrl(url)) {
        try {
          const contentType = this.getResponseHeader('Content-Type')
          if (contentType?.includes('application/json')) {
            const headers: WiretapHeaders = {
              total: this.getResponseHeader('total'),
              perPage: this.getResponseHeader('per-page'),
            }
            const data = JSON.parse(this.responseText)
            broadcast(data, url, headers)
          }
        } catch {
          /* Ignore parse errors */
        }
      }
    })

    return originalXHRSend.call(this, body)
  }
})()
