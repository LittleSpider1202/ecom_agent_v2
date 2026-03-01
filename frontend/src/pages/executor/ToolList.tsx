import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

interface Tool {
  id: number
  name: string
  description: string
  tool_type: string
  call_count: number
  allowed_roles: string[]
}

const TYPE_LABELS: Record<string, string> = {
  api: 'API',
  webhook: 'Webhook',
  script: '脚本',
}

const TYPE_COLORS: Record<string, string> = {
  api: 'bg-blue-100 text-blue-700',
  webhook: 'bg-purple-100 text-purple-700',
  script: 'bg-green-100 text-green-700',
}

const TYPE_ICONS: Record<string, string> = {
  api: '🔗',
  webhook: '⚡',
  script: '🐍',
}

export default function ToolList() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [tools, setTools] = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState<number | null>(null)
  const [executing, setExecuting] = useState<number | null>(null)

  useEffect(() => {
    const t = token || localStorage.getItem('auth_token')
    fetch('/api/tools', {
      headers: { Authorization: `Bearer ${t}` },
    })
      .then(r => {
        if (r.status === 401) {
          localStorage.removeItem('auth_token')
          localStorage.removeItem('auth_user')
          window.location.href = '/login'
          return []
        }
        return r.json()
      })
      .then(data => setTools(Array.isArray(data) ? data : []))
      .catch(() => setTools([]))
      .finally(() => setLoading(false))
  }, [token])

  const handleTrigger = async (toolId: number) => {
    const t = token || localStorage.getItem('auth_token')
    setExecuting(toolId)
    setConfirming(null)
    try {
      const res = await fetch(`/api/tools/${toolId}/execute`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}` },
      })
      if (res.ok) {
        const data = await res.json()
        navigate(`/executor/tools/${data.id}`)
      }
    } finally {
      setExecuting(null)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">工具箱</h1>

      {loading ? (
        <div className="text-center py-12 text-gray-400">加载中...</div>
      ) : tools.length === 0 ? (
        <div className="text-center py-12 text-gray-400">暂无可用工具</div>
      ) : (
        <div data-testid="tool-list" className="space-y-4">
          {tools.map(tool => (
            <div
              key={tool.id}
              data-testid={`tool-${tool.id}`}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span data-testid={`tool-icon-${tool.id}`} className="text-2xl flex-shrink-0">
                      {TYPE_ICONS[tool.tool_type] || '🔧'}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-800 text-lg">{tool.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[tool.tool_type] || 'bg-gray-100 text-gray-600'}`}>
                          {TYPE_LABELS[tool.tool_type] || tool.tool_type}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{tool.description}</p>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 ml-11">
                    累计调用：{tool.call_count} 次
                  </div>
                </div>

                <div className="ml-4 flex-shrink-0">
                  {confirming === tool.id ? (
                    <div className="flex gap-2">
                      <button
                        data-testid={`confirm-execute-${tool.id}`}
                        onClick={() => handleTrigger(tool.id)}
                        disabled={executing === tool.id}
                        className="px-4 py-2 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 disabled:opacity-50 font-medium"
                      >
                        {executing === tool.id ? '执行中...' : '确认执行'}
                      </button>
                      <button
                        onClick={() => setConfirming(null)}
                        className="px-3 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <button
                      data-testid={`trigger-btn-${tool.id}`}
                      onClick={() => setConfirming(tool.id)}
                      className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      立即执行
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm dialog overlay */}
      {confirming !== null && (
        <div
          data-testid="confirm-dialog"
          className="fixed inset-0 bg-black/20 flex items-center justify-center z-50"
          onClick={e => { if (e.target === e.currentTarget) setConfirming(null) }}
        >
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">确认执行</h3>
            <p className="text-gray-600 mb-5 text-sm">
              即将执行工具：<span className="font-medium">{tools.find(t => t.id === confirming)?.name}</span>，是否继续？
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirming(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
              >
                取消
              </button>
              <button
                data-testid="dialog-confirm-btn"
                onClick={() => handleTrigger(confirming)}
                disabled={executing !== null}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50 font-medium"
              >
                {executing !== null ? '执行中...' : '确认'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
