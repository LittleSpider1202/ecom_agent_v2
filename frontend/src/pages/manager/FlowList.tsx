import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

interface FlowItem {
  id: number
  name: string
  version: number
  status: string
  trigger_type: string | null
  trigger_config: string | null
  is_enabled: boolean
  success_rate: number | null
  avg_duration: number | null
  created_at: string
}

function healthColor(successRate: number | null): { dot: string; label: string } {
  if (successRate === null) return { dot: 'bg-gray-300', label: '暂无数据' }
  if (successRate >= 80) return { dot: 'bg-green-500', label: '健康' }
  if (successRate >= 50) return { dot: 'bg-yellow-400', label: '一般' }
  return { dot: 'bg-red-500', label: '异常' }
}

export default function FlowList() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [flows, setFlows] = useState<FlowItem[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<number | null>(null)

  const fetchFlows = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const url = q
        ? `/api/flows?search=${encodeURIComponent(q)}`
        : '/api/flows'
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setFlows(data)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchFlows(search)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchFlows(search)
  }

  const handleSearchClear = () => {
    setSearch('')
    fetchFlows('')
  }

  const handleToggle = async (flow: FlowItem) => {
    setToggling(flow.id)
    try {
      const res = await fetch(`/api/flows/${flow.id}/toggle`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      const updated = await res.json()
      setFlows(prev =>
        prev.map(f =>
          f.id === flow.id
            ? { ...f, status: updated.status, is_enabled: updated.is_enabled }
            : f
        )
      )
    } finally {
      setToggling(null)
    }
  }

  const triggerLabel = (t: string | null) => {
    if (t === 'cron') return '定时触发'
    if (t === 'manual') return '手动触发'
    return '未配置'
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">流程定义</h1>
        <button
          data-testid="new-flow-btn"
          onClick={() => navigate('/manage/flows/new')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          + 新建流程
        </button>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="mb-6 flex gap-2">
        <input
          data-testid="flow-search-input"
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="搜索流程名称..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          搜索
        </button>
        {search && (
          <button
            type="button"
            onClick={handleSearchClear}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            清空
          </button>
        )}
      </form>

      {/* Flow list */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">加载中...</div>
      ) : flows.length === 0 ? (
        <div className="text-center py-16 text-gray-400">暂无流程</div>
      ) : (
        <div data-testid="flow-list" className="space-y-3">
          {flows.map(flow => {
            const { dot, label } = healthColor(flow.success_rate)
            return (
              <div
                key={flow.id}
                data-testid={`flow-card-${flow.id}`}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/manage/flows/${flow.id}`)}
              >
                <div className="flex items-center justify-between">
                  {/* Left: health dot + name + badges */}
                  <div className="flex items-center gap-3">
                    <span
                      data-testid={`health-dot-${flow.id}`}
                      className={`w-3 h-3 rounded-full flex-shrink-0 ${dot}`}
                      title={label}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className="font-semibold text-gray-800 hover:text-blue-600 hover:underline cursor-pointer"
                          data-testid={`flow-name-${flow.id}`}
                          onClick={e => { e.stopPropagation(); navigate(`/manage/flows/${flow.id}`) }}
                        >{flow.name}</span>
                        <span className="text-xs text-gray-400">v{flow.version}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                          {triggerLabel(flow.trigger_type)}
                        </span>
                      </div>
                      {/* Health metrics */}
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        {flow.success_rate !== null ? (
                          <>
                            <span data-testid={`success-rate-${flow.id}`}>
                              成功率：<span className="font-medium text-gray-700">{flow.success_rate}%</span>
                            </span>
                            {flow.avg_duration !== null && (
                              <span data-testid={`avg-duration-${flow.id}`}>
                                平均耗时：<span className="font-medium text-gray-700">{flow.avg_duration} 分钟</span>
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-gray-400">暂无执行记录</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: toggle + status */}
                  <div
                    className="flex items-center gap-3"
                    onClick={e => e.stopPropagation()}
                  >
                    <span className={`text-sm ${flow.is_enabled ? 'text-green-600' : 'text-gray-400'}`}>
                      {flow.is_enabled ? '已启用' : '已禁用'}
                    </span>
                    <button
                      data-testid={`toggle-${flow.id}`}
                      disabled={toggling === flow.id}
                      onClick={() => handleToggle(flow)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                        flow.is_enabled ? 'bg-blue-600' : 'bg-gray-300'
                      } ${toggling === flow.id ? 'opacity-50' : ''}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          flow.is_enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
