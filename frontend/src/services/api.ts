import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cnas_token')
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export interface Session {
  token: string
  username: string
  role: 'INVESTIGATOR' | 'ANALYST' | 'ADMIN'
  name: string
}

export const authApi = {
  login: (username: string, password: string) =>
    api.post<Session>('/auth/login', { username, password }).then((r) => r.data),
  demoUsers: () => api.get('/auth/demo-users').then((r) => r.data),
}

export const dashboardApi = {
  summary: () => api.get('/dashboard/summary').then((r) => r.data),
  caseDistribution: () => api.get('/dashboard/case-distribution').then((r) => r.data),
  activity: () => api.get('/dashboard/activity').then((r) => r.data),
  alerts: (params?: Record<string, any>) => api.get('/dashboard/alerts', { params }).then((r) => r.data),
}

export const casesApi = {
  list: (params?: Record<string, string>) => api.get('/cases', { params }).then((r) => r.data),
  get: (caseId: string) => api.get(`/cases/${caseId}`).then((r) => r.data),
}

export const entitiesApi = {
  search: (q: string) => api.get('/search', { params: { q } }).then((r) => r.data),
  list: (type?: string) => api.get('/entities', { params: type ? { type } : {} }).then((r) => r.data),
  get: (id: string) => api.get(`/entities/${id}`).then((r) => r.data),
  person: (personId: string) => api.get(`/persons/${personId}`).then((r) => r.data),
  resolutionCandidates: (minConfidence = 0.3) =>
    api.get('/entity-resolution/candidates', { params: { min_confidence: minConfidence } }).then((r) => r.data),
  review: (payload: { person_a: string; person_b: string; action: string; notes?: string }) =>
    api.post('/entity-resolution/review', payload).then((r) => r.data),
  resolutionLog: () => api.get('/entity-resolution/log').then((r) => r.data),
}

export const networkApi = {
  full: (params?: Record<string, any>) => api.get('/network', { params }).then((r) => r.data),
  ego: (personId: string, params?: Record<string, any>) =>
    api.get(`/network/${personId}`, { params }).then((r) => r.data),
  overview: (maxNodes = 18) => api.get('/network/overview', { params: { max_nodes: maxNodes } }).then((r) => r.data),
  filtered: (params?: Record<string, any>) => api.get('/network/filtered', { params }).then((r) => r.data),
  entityDetail: (entityId: string) => api.get(`/network/entity/${entityId}`).then((r) => r.data),
  centrality: (limit = 20) => api.get('/analytics/centrality', { params: { limit } }).then((r) => r.data),
  centralityFor: (personId: string) => api.get(`/analytics/centrality/${personId}`).then((r) => r.data),
  centralityRanked: (metric = 'betweenness', limit = 20) =>
    api.get('/network/centrality', { params: { metric, limit } }).then((r) => r.data),
  communities: () => api.get('/analytics/communities').then((r) => r.data),
}

export const analyticsApi = {
  patterns: () => api.get('/analytics/patterns').then((r) => r.data),
  transactions: () => api.get('/analytics/transactions').then((r) => r.data),
  transaction: (id: string) => api.get(`/analytics/transactions/${id}`).then((r) => r.data),
  communications: () => api.get('/analytics/communications').then((r) => r.data),
  locations: (personId?: string) =>
    api.get('/analytics/locations', { params: personId ? { person_id: personId } : {} }).then((r) => r.data),
  risk: (limit = 20) => api.get('/analytics/risk', { params: { limit } }).then((r) => r.data),
  riskFor: (personId: string) => api.get(`/analytics/risk/${personId}`).then((r) => r.data),
  correlation: () => api.get('/analytics/correlation').then((r) => r.data),
  correlationFor: (personId: string) => api.get(`/analytics/correlation/${personId}`).then((r) => r.data),
  vehicles: () => api.get('/analytics/vehicles').then((r) => r.data),
}

export const timelineApi = {
  get: (params?: Record<string, string>) => api.get('/timeline', { params }).then((r) => r.data),
}

export const alertsApi = {
  list: (params?: Record<string, string>) => api.get('/alerts', { params }).then((r) => r.data),
  get: (id: string) => api.get(`/alerts/${id}`).then((r) => r.data),
  updateStatus: (id: string, analyst_status: string) =>
    api.post(`/alerts/${id}/status`, { analyst_status }).then((r) => r.data),
}

export const dataApi = {
  sources: () => api.get('/data/sources').then((r) => r.data),
  validate: () => api.get('/data/validate').then((r) => r.data),
  upload: (dataset: string, file: File) => {
    const form = new FormData()
    form.append('dataset', dataset)
    form.append('file', file)
    return api.post('/data/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data)
  },
  processAll: () => api.post('/data/process').then((r) => r.data),
}

export const reportsApi = {
  generate: (payload: { case_id?: string; person_id?: string; start_date?: string; end_date?: string }) =>
    api.post('/reports/generate', payload).then((r) => r.data),
}

export const adminApi = {
  auditLogs: (limit = 200) => api.get('/audit', { params: { limit } }).then((r) => r.data),
  users: () => api.get('/admin/users').then((r) => r.data),
  systemStatus: () => api.get('/admin/system-status').then((r) => r.data),
  evidence: (params?: Record<string, string>) => api.get('/evidence', { params }).then((r) => r.data),
  intelligence: (params?: Record<string, string>) => api.get('/intelligence', { params }).then((r) => r.data),
}

export const nlpApi = {
  extract: (text: string) => api.post('/nlp/extract', { text }).then((r) => r.data),
  samples: () => api.get('/nlp/sample-text').then((r) => r.data),
}
