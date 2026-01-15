/**
 * ApiService - Headless Scanning via Procore REST API
 * 
 * NOTE: These functions should be called from the BACKGROUND SERVICE WORKER
 * or CONTENT SCRIPT, not from the side panel directly (CORS issues).
 * 
 * The side panel should send messages to the background to trigger scans.
 */

import type { Drawing, RFI, Commitment, DisciplineMap } from '@/types'

const PROCORE_BASE = 'https://app.procore.com'

export interface FetchOptions {
  signal?: AbortSignal
  onProgress?: (loaded: number, total: number | null) => void
}

interface PaginatedResponse<T> {
  data: T[]
  total: number | null
  perPage: number | null
}

export const ApiService = {
  /**
   * Generic fetch wrapper with credentials and error handling
   */
  async fetchJson<T>(url: string, options?: FetchOptions): Promise<T> {
    console.log('ApiService: Fetching', url)
    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      signal: options?.signal,
    })

    if (!response.ok) {
      console.error('ApiService: Error', response.status, response.statusText)
      throw new Error(`API Error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  },

  /**
   * Fetch with pagination header extraction
   */
  async fetchPaginated<T>(url: string, options?: FetchOptions): Promise<PaginatedResponse<T>> {
    console.log('ApiService: Fetching paginated', url)
    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
      },
      signal: options?.signal,
    })

    if (!response.ok) {
      console.error('ApiService: Error', response.status, response.statusText)
      throw new Error(`API Error: ${response.status} ${response.statusText}`)
    }

    const total = response.headers.get('total') || response.headers.get('Total')
    const perPage = response.headers.get('per-page') || response.headers.get('Per-Page')
    const data = await response.json()

    return {
      data: Array.isArray(data) ? data : data.data ?? data.entities ?? [],
      total: total ? parseInt(total, 10) : null,
      perPage: perPage ? parseInt(perPage, 10) : null,
    }
  },

  // ============================================
  // DRAWINGS
  // ============================================

  async fetchDrawings(
    projectId: string, 
    drawingAreaId: string,
    options?: FetchOptions
  ): Promise<Drawing[]> {
    const allDrawings: Drawing[] = []
    let page = 1
    const perPage = 500
    let hasMore = true
    let consecutiveErrors = 0

    console.log('ApiService: Starting drawing fetch for project', projectId, 'area', drawingAreaId)

    while (hasMore && consecutiveErrors < 3) {
      try {
        const url = `${PROCORE_BASE}/rest/v1.1/projects/${projectId}/drawing_areas/${drawingAreaId}/drawing_log?page=${page}&per_page=${perPage}`
        
        const response = await this.fetchPaginated<unknown>(url, options)
        const drawings = this.normalizeDrawings(response.data)
        
        console.log('ApiService: Page', page, 'returned', drawings.length, 'drawings')
        
        allDrawings.push(...drawings)
        consecutiveErrors = 0
        
        if (options?.onProgress) {
          options.onProgress(allDrawings.length, response.total)
        }

        // Stop conditions
        if (drawings.length === 0 || drawings.length < perPage) {
          hasMore = false
        } else {
          page++
        }
        
        // Safety limit
        if (page > 100) {
          console.warn('ApiService: Hit page limit, stopping')
          hasMore = false
        }
      } catch (error) {
        console.error('ApiService: Error on page', page, error)
        consecutiveErrors++
        if (consecutiveErrors >= 3) {
          console.error('ApiService: Too many consecutive errors, stopping')
          hasMore = false
        }
      }
    }

    console.log('ApiService: Finished, total drawings:', allDrawings.length)
    return allDrawings
  },

  async fetchDisciplines(
    projectId: string,
    drawingAreaId: string,
    options?: FetchOptions
  ): Promise<DisciplineMap> {
    const url = `${PROCORE_BASE}/rest/v1.1/projects/${projectId}/drawing_areas/${drawingAreaId}/drawing_disciplines`
    
    try {
      const data = await this.fetchJson<Array<{ id: number; name: string }>>(url, options)
      const map: DisciplineMap = {}
      
      data.forEach((disc, index) => {
        map[disc.id] = { name: disc.name, index }
      })
      
      return map
    } catch (error) {
      console.error('ApiService: Error fetching disciplines', error)
      return {}
    }
  },

  normalizeDrawings(data: unknown[]): Drawing[] {
    return data
      .filter((item): item is Record<string, unknown> => 
        item !== null && typeof item === 'object' && 'id' in item
      )
      .filter(item => {
        const hasNum = item.number || item.drawing_number
        const isCommitment = item.vendor || item.vendor_name || item.contract_date
        return hasNum && !isCommitment
      })
      .map(item => ({
        id: item.id as number,
        num: (item.number || item.drawing_number) as string,
        title: (item.title || '') as string,
        discipline: item.discipline as number | undefined,
        discipline_name: (
          item.discipline_name || 
          (item.discipline && typeof item.discipline === 'object' 
            ? (item.discipline as { name?: string }).name 
            : undefined)
        ) as string | undefined,
      }))
  },

  // ============================================
  // RFIs
  // ============================================

  async fetchRFIs(
    projectId: string,
    options?: FetchOptions
  ): Promise<RFI[]> {
    const allRFIs: RFI[] = []
    let page = 1
    const perPage = 100
    let hasMore = true
    let consecutiveErrors = 0

    while (hasMore && consecutiveErrors < 3) {
      try {
        const url = `${PROCORE_BASE}/rest/v1.0/projects/${projectId}/rfis?page=${page}&per_page=${perPage}`
        
        const response = await this.fetchPaginated<unknown>(url, options)
        const rfis = this.normalizeRFIs(response.data)
        
        allRFIs.push(...rfis)
        consecutiveErrors = 0
        
        if (options?.onProgress) {
          options.onProgress(allRFIs.length, response.total)
        }

        if (rfis.length === 0 || rfis.length < perPage) {
          hasMore = false
        } else {
          page++
        }
        
        if (page > 100) {
          hasMore = false
        }
      } catch (error) {
        console.error('ApiService: Error fetching RFIs page', page, error)
        consecutiveErrors++
        if (consecutiveErrors >= 3) {
          hasMore = false
        }
      }
    }

    return allRFIs
  },

  normalizeRFIs(data: unknown[]): RFI[] {
    return data
      .filter((item): item is Record<string, unknown> => 
        item !== null && typeof item === 'object' && 'id' in item
      )
      .map(item => ({
        id: item.id as number,
        number: (item.number || item.rfi_number || '') as string,
        subject: (item.subject || item.title || '') as string,
        status: (item.status || 'unknown') as string,
        created_at: (item.created_at || '') as string,
        due_date: item.due_date as string | undefined,
        assignee: item.assignee_name as string | undefined,
        ball_in_court: item.ball_in_court as string | undefined,
      }))
  },

  // ============================================
  // COMMITMENTS
  // ============================================

  async fetchCommitments(
    projectId: string,
    options?: FetchOptions
  ): Promise<Commitment[]> {
    const allCommitments: Commitment[] = []

    const endpoints = [
      `/rest/v1.0/projects/${projectId}/commitments`,
      `/rest/v1.0/projects/${projectId}/purchase_order_contracts`,
      `/rest/v1.0/projects/${projectId}/work_order_contracts`,
    ]

    for (const endpoint of endpoints) {
      let page = 1
      const perPage = 100
      let hasMore = true

      while (hasMore) {
        try {
          const url = `${PROCORE_BASE}${endpoint}?page=${page}&per_page=${perPage}`
          const response = await this.fetchPaginated<unknown>(url, options)
          const commitments = this.normalizeCommitments(response.data)
          
          allCommitments.push(...commitments)
          
          if (commitments.length === 0 || commitments.length < perPage) {
            hasMore = false
          } else {
            page++
          }
          
          if (page > 50) {
            hasMore = false
          }
        } catch {
          hasMore = false
        }
      }
    }

    // Deduplicate by ID
    const seen = new Set<number>()
    return allCommitments.filter(c => {
      if (seen.has(c.id)) return false
      seen.add(c.id)
      return true
    })
  },

  normalizeCommitments(data: unknown[]): Commitment[] {
    return data
      .filter((item): item is Record<string, unknown> => 
        item !== null && typeof item === 'object' && 'id' in item
      )
      .filter(item => {
        if (item.drawing_number) return false
        const hasInfo = item.number || item.title || item.contract_date
        const hasContext = item.vendor || item.vendor_name || 
          (item.type && String(item.type).includes('Contract'))
        return hasInfo && hasContext
      })
      .map(item => ({
        id: item.id as number,
        number: (item.number || '') as string,
        title: (item.title || '') as string,
        vendor: item.vendor as string | undefined,
        vendor_name: (
          item.vendor_name || 
          (item.vendor && typeof item.vendor === 'object' 
            ? (item.vendor as { name?: string }).name 
            : undefined)
        ) as string | undefined,
        status: item.status as string | undefined,
        contract_date: item.contract_date as string | undefined,
        type: item.type as string | undefined,
        approved_amount: item.approved_amount as number | undefined,
        pending_amount: item.pending_amount as number | undefined,
        draft_amount: item.draft_amount as number | undefined,
      }))
  },

  // ============================================
  // PROJECT INFO
  // ============================================

  async fetchDrawingAreas(projectId: string, options?: FetchOptions): Promise<Array<{ id: number; name: string }>> {
    const url = `${PROCORE_BASE}/rest/v1.1/projects/${projectId}/drawing_areas`
    try {
      return await this.fetchJson(url, options)
    } catch (error) {
      console.error('ApiService: Error fetching drawing areas', error)
      return []
    }
  },

  parseProjectUrl(url: string): { companyId: string | null; projectId: string | null; drawingAreaId: string | null } {
    const projectMatch = url.match(/projects\/(\d+)/) || url.match(/\/(\d+)\/project/)
    const areaMatch = url.match(/areas\/(\d+)/) || url.match(/drawing_areas\/(\d+)/)
    const companyMatch = url.match(/companies\/(\d+)/)
    
    return {
      companyId: companyMatch?.[1] ?? null,
      projectId: projectMatch?.[1] ?? null,
      drawingAreaId: areaMatch?.[1] ?? null,
    }
  },
}
