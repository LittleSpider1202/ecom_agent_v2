import { useState, useEffect, useCallback } from 'react'

interface HistoryTask {
  id: number
  title: string
  flow_name: string
  status: 'completed' | 'failed' | 'rejected'
  completed_at: string | null
  created_at: string | null
  duration_seconds: number | null
}

interface MyStep {
  step_id: number
  step_name: string
  task_id: number
  task_title: string
  action: '采纳' | '修改' | '驳回'
  completed_at: string | null
}

const API = ''

function getToken(): string {
  return localStorage.getItem('auth_token') || ''
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fmtDuration(s: number | null): string {
  if (s === null || s === undefined) return '—'
  if (s < 60) return `${s}秒`
  if (s < 3600) return `${Math.floor(s / 60)}分${s % 60}秒`
  return `${Math.floor(s / 3600)}小时${Math.floor((s % 3600) / 60)}分`
}

const STATUS_LABELS: Record<string, string> = {
  completed: '已完成',
  failed: '失败',
  rejected: '已驳回',
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  rejected: 'bg-gray-100 text-gray-700',
}

const ACTION_COLORS: Record<string, string> = {
  采纳: 'bg-green-100 text-green-800',
  修改: 'bg-blue-100 text-blue-800',
  驳回: 'bg-red-100 text-red-800',
}

export default function TaskHistory() {
  const [tab, setTab] = useState<'history' | 'my-steps'>('history')

  // ── history tab state ──
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [pendingSearch, setPendingSearch] = useState('')
  const [pendingFrom, setPendingFrom] = useState('')
  const [pendingTo, setPendingTo] = useState('')
  const [historyItems, setHistoryItems] = useState<HistoryTask[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // ── my-steps tab state ──
  const [mySteps, setMySteps] = useState<MyStep[]>([])
  const [myStepsLoading, setMyStepsLoading] = useState(false)

  const fetchHistory = useCallback(async (s: string, f: string, t: string) => {
    setHistoryLoading(true)
    try {
      const params = new URLSearchParams()
      if (s) params.set('search', s)
      if (f) params.set('from', f)
      if (t) params.set('to', t)
      const res = await fetch(`${API}/api/tasks/history?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      const data = await res.json()
      setHistoryItems(data.items || [])
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  const fetchMySteps = useCallback(async () => {
    setMyStepsLoading(true)
    try {
      const res = await fetch(`${API}/api/tasks/my-steps`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      const data = await res.json()
      setMySteps(Array.isArray(data) ? data : [])
    } finally {
      setMyStepsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHistory(search, dateFrom, dateTo)
  }, [fetchHistory]) // initial load, no filters

  useEffect(() => {
    if (tab === 'my-steps') fetchMySteps()
  }, [tab, fetchMySteps])

  const applyFilter = () => {
    setSearch(pendingSearch)
    setDateFrom(pendingFrom)
    setDateTo(pendingTo)
    fetchHistory(pendingSearch, pendingFrom, pendingTo)
  }

  const clearFilter = () => {
    setPendingSearch('')
    setPendingFrom('')
    setPendingTo('')
    setSearch('')
    setDateFrom('')
    setDateTo('')
    fetchHistory('', '', '')
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">任务历史</h1>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {(['history', 'my-steps'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'history' ? '已完成任务' : '我的操作记录'}
          </button>
        ))}
      </div>

      {/* ── History tab ── */}
      {tab === 'history' && (
        <>
          {/* Filter bar */}
          <div className="flex flex-wrap gap-3 mb-5 items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1">任务名称</label>
              <input
                type="text"
                placeholder="搜索任务名称..."
                value={pendingSearch}
                onChange={(e) => setPendingSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyFilter()}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm w-52"
                data-testid="search-input"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">开始日期</label>
              <input
                type="date"
                value={pendingFrom}
                onChange={(e) => setPendingFrom(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm"
                data-testid="date-from"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">结束日期</label>
              <input
                type="date"
                value={pendingTo}
                onChange={(e) => setPendingTo(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm"
                data-testid="date-to"
              />
            </div>
            <button
              onClick={applyFilter}
              className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700"
              data-testid="filter-btn"
            >
              筛选
            </button>
            <button
              onClick={clearFilter}
              className="border border-gray-300 text-gray-600 px-4 py-1.5 rounded text-sm hover:bg-gray-50"
              data-testid="clear-filter-btn"
            >
              清空
            </button>
          </div>

          {/* Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">任务名称</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">流程名</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">状态</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">完成时间</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">总耗时</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {historyLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400">加载中...</td>
                  </tr>
                ) : historyItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400">暂无历史记录</td>
                  </tr>
                ) : (
                  historyItems.map((task) => (
                    <tr key={task.id} className="hover:bg-gray-50" data-testid="history-row">
                      <td className="px-4 py-3 font-medium text-gray-900">{task.title}</td>
                      <td className="px-4 py-3 text-gray-600">{task.flow_name}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[task.status] || 'bg-gray-100 text-gray-700'}`}>
                          {STATUS_LABELS[task.status] || task.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap" data-testid="completed-at">
                        {fmtTime(task.completed_at)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap" data-testid="duration">
                        {fmtDuration(task.duration_seconds)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── My steps tab ── */}
      {tab === 'my-steps' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">步骤名称</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">所属任务</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">操作类型</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">操作时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {myStepsLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">加载中...</td>
                </tr>
              ) : mySteps.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400" data-testid="no-steps-msg">
                    暂无操作记录
                  </td>
                </tr>
              ) : (
                mySteps.map((step) => (
                  <tr key={step.step_id} className="hover:bg-gray-50" data-testid="step-row">
                    <td className="px-4 py-3 font-medium text-gray-900">{step.step_name}</td>
                    <td className="px-4 py-3 text-gray-600">{step.task_title}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[step.action] || 'bg-gray-100 text-gray-700'}`}
                        data-testid="action-badge"
                      >
                        {step.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {fmtTime(step.completed_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
