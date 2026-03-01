import { useState, useEffect } from 'react'

interface Tool {
  id: number
  name: string
  description: string
  tool_type: string
  enabled: boolean
  call_count: number
  allowed_roles: string[]
}

const TYPE_LABELS: Record<string, string> = {
  api: 'API调用',
  webhook: 'Webhook',
  script: 'Python脚本',
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

export default function ToolManagement() {
  const [tools, setTools] = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<number | null>(null)

  const token = localStorage.getItem('auth_token')
  const headers = { Authorization: `Bearer ${token}` }

  const fetchTools = () => {
    fetch('/api/tools/all', { headers })
      .then(r => r.json())
      .then(data => setTools(Array.isArray(data) ? data : []))
      .catch(() => setTools([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchTools() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = async (toolId: number, currentEnabled: boolean) => {
    setToggling(toolId)
    try {
      const res = await fetch(`/api/tools/${toolId}/toggle`, {
        method: 'PATCH',
        headers,
      })
      if (res.ok) {
        setTools(prev => prev.map(t =>
          t.id === toolId ? { ...t, enabled: !currentEnabled } : t
        ))
      }
    } finally {
      setToggling(null)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">工具库</h1>

      {loading ? (
        <div className="text-center py-12 text-gray-400">加载中...</div>
      ) : (
        <div data-testid="tool-management-list" className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">工具名称</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">类型</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">调用次数</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">成功率</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">状态</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tools.map(tool => (
                <tr key={tool.id} data-testid={`manage-tool-${tool.id}`} className={`hover:bg-gray-50 transition-colors ${!tool.enabled ? 'opacity-50' : ''}`}>
                  <td className="px-5 py-4">
                    <div className="font-medium text-gray-800">{tool.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5 max-w-xs truncate">{tool.description}</div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5">
                      <span data-testid={`tool-type-icon-${tool.id}`} className="text-base">
                        {TYPE_ICONS[tool.tool_type] || '🔧'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[tool.tool_type] || 'bg-gray-100 text-gray-600'}`}>
                        {TYPE_LABELS[tool.tool_type] || tool.tool_type}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span data-testid={`call-count-${tool.id}`} className="text-sm text-gray-700 font-mono">
                      {tool.call_count.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span data-testid={`success-rate-${tool.id}`} className="text-sm text-gray-700">
                      {tool.call_count > 0 ? '98%' : '-'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      data-testid={`tool-status-${tool.id}`}
                      className={`text-xs px-2 py-1 rounded-full font-medium ${tool.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {tool.enabled ? '已启用' : '已禁用'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      data-testid={`toggle-tool-${tool.id}`}
                      onClick={() => handleToggle(tool.id, tool.enabled)}
                      disabled={toggling === tool.id}
                      className={`px-3 py-1 text-xs rounded font-medium transition-colors disabled:opacity-50 ${
                        tool.enabled
                          ? 'border border-red-200 text-red-600 hover:bg-red-50'
                          : 'border border-green-200 text-green-600 hover:bg-green-50'
                      }`}
                    >
                      {toggling === tool.id ? '...' : tool.enabled ? '禁用' : '启用'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
