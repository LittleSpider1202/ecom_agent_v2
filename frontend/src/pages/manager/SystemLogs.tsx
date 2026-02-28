import { useEffect, useState } from 'react'
import api from '../../hooks/useApi'

interface LogEntry {
  id: number
  user: string
  action: string
  detail: string
  timestamp: string
}

interface LogResponse {
  total: number
  logs: LogEntry[]
  users: string[]
  actions: string[]
}

export default function SystemLogs() {
  const [data, setData] = useState<LogResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [userFilter, setUserFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const load = async (overrides?: { user?: string; action?: string; start?: string; end?: string }) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      const u = overrides !== undefined ? overrides.user ?? '' : userFilter
      const a = overrides !== undefined ? overrides.action ?? '' : actionFilter
      const s = overrides !== undefined ? overrides.start ?? '' : startDate
      const e = overrides !== undefined ? overrides.end ?? '' : endDate
      if (u) params.set('user', u)
      if (a) params.set('action', a)
      if (s) params.set('start_date', s)
      if (e) params.set('end_date', e)
      const res = await api.get(`/api/logs?${params}`)
      setData(res.data)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const applyFilters = () => load({ user: userFilter, action: actionFilter, start: startDate, end: endDate })

  const clearFilters = () => {
    setUserFilter('')
    setActionFilter('')
    setStartDate('')
    setEndDate('')
    load({ user: '', action: '', start: '', end: '' })
  }

  const exportCsv = () => {
    const token = localStorage.getItem('auth_token')
    const params = new URLSearchParams()
    if (userFilter) params.set('user', userFilter)
    if (actionFilter) params.set('action', actionFilter)
    const url = `/api/logs/export?${params}`
    // Trigger download
    const a = document.createElement('a')
    a.href = url
    a.setAttribute('Authorization', `Bearer ${token}`)
    // Fetch and download
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = 'system_logs.csv'
        link.click()
        URL.revokeObjectURL(link.href)
      })
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800" data-testid="logs-title">系统日志</h1>
        <button
          data-testid="export-csv-btn"
          onClick={exportCsv}
          className="px-4 py-2 text-sm bg-white border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          导出CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4" data-testid="log-filters">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {/* User filter */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">操作用户</label>
            <select
              data-testid="user-filter"
              value={userFilter}
              onChange={e => setUserFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">全部用户</option>
              {(data?.users ?? []).map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          {/* Action filter */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">操作类型</label>
            <select
              data-testid="action-filter"
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">全部类型</option>
              {(data?.actions ?? []).map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          {/* Date range */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">开始日期</label>
            <input
              data-testid="start-date"
              type="datetime-local"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">结束日期</label>
            <input
              data-testid="end-date"
              type="datetime-local"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            data-testid="apply-filter-btn"
            onClick={applyFilters}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            应用筛选
          </button>
          <button
            data-testid="clear-filter-btn"
            onClick={clearFilters}
            className="px-4 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            清除
          </button>
        </div>
      </div>

      {/* Log table */}
      {loading ? (
        <div className="text-center py-20 text-gray-400">加载中…</div>
      ) : !data || data.logs.length === 0 ? (
        <div className="text-center py-20 text-gray-400">暂无日志记录</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" data-testid="log-table">
          <div className="px-4 py-2 border-b border-gray-100 text-xs text-gray-400">
            共 {data.total} 条记录
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">时间</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">操作用户</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">操作类型</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">详情</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50" data-testid={`log-row-${log.id}`}>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString('zh-CN')}
                  </td>
                  <td className="px-4 py-3 text-gray-700 font-medium" data-testid={`log-user-${log.id}`}>
                    {log.user}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs" data-testid={`log-action-${log.id}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{log.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
