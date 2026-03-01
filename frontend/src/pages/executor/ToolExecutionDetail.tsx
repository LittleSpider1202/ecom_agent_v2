import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

interface Execution {
  id: number
  tool_id: number
  tool_name: string
  status: string
  logs: string
  has_output: boolean
  output_file: string | null
  started_at: string | null
  finished_at: string | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  running: { label: '进行中', color: 'bg-blue-100 text-blue-700' },
  success: { label: '成功', color: 'bg-green-100 text-green-700' },
  failed: { label: '失败', color: 'bg-red-100 text-red-700' },
}

function formatTime(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('zh-CN')
}

export default function ToolExecutionDetail() {
  const { executionId } = useParams<{ executionId: string }>()
  const { token } = useAuth()
  const navigate = useNavigate()
  const [execution, setExecution] = useState<Execution | null>(null)
  const [loading, setLoading] = useState(true)
  const logRef = useRef<HTMLPreElement>(null)

  const fetchExecution = () => {
    const t = token || localStorage.getItem('auth_token')
    fetch(`/api/tools/executions/${executionId}`, {
      headers: { Authorization: `Bearer ${t}` },
    })
      .then(r => r.json())
      .then(data => setExecution(data))
      .catch(() => setExecution(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchExecution()
  }, [executionId, token]) // eslint-disable-line react-hooks/exhaustive-deps

  // Poll every 2 seconds when execution is running
  useEffect(() => {
    if (!execution || execution.status !== 'running') return
    const timer = setInterval(fetchExecution, 2000)
    return () => clearInterval(timer)
  }, [execution?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [execution?.logs])

  const handleDownload = () => {
    const t = token || localStorage.getItem('auth_token')
    const a = document.createElement('a')
    a.href = `/api/tools/executions/${executionId}/download`
    // Use fetch to trigger with auth header
    fetch(`/api/tools/executions/${executionId}/download`, {
      headers: { Authorization: `Bearer ${t}` },
    })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob)
        a.href = url
        a.download = `output_${executionId}.xlsx`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      })
  }

  if (loading) {
    return <div className="p-6 text-center text-gray-400">加载中...</div>
  }

  if (!execution) {
    return (
      <div className="p-6 text-center text-red-500">
        <p>执行记录不存在</p>
        <button onClick={() => navigate('/executor/tools')} className="mt-4 text-blue-600 hover:underline">
          返回工具列表
        </button>
      </div>
    )
  }

  const statusConfig = STATUS_CONFIG[execution.status] || { label: execution.status, color: 'bg-gray-100 text-gray-600' }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button
        onClick={() => navigate('/executor/tools')}
        className="flex items-center gap-1 text-gray-500 hover:text-gray-700 mb-6 text-sm"
      >
        ← 返回工具列表
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 data-testid="execution-tool-name" className="text-xl font-bold text-gray-800 mb-2">
              {execution.tool_name}
            </h1>
            <div className="flex items-center gap-3">
              <span
                data-testid="execution-status"
                className={`text-sm px-3 py-1 rounded-full font-medium ${statusConfig.color}`}
              >
                {statusConfig.label}
              </span>
              <span data-testid="execution-id" className="text-xs text-gray-400">
                执行 #{execution.id}
              </span>
            </div>
          </div>

          {execution.has_output && execution.status === 'success' && (
            <button
              data-testid="download-btn"
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              下载输出
            </button>
          )}
        </div>

        {/* Meta info */}
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">开始时间：</span>
            <span data-testid="execution-started-at" className="text-gray-800">
              {formatTime(execution.started_at)}
            </span>
          </div>
          <div>
            <span className="text-gray-500">结束时间：</span>
            <span data-testid="execution-finished-at" className="text-gray-800">
              {formatTime(execution.finished_at)}
            </span>
          </div>
        </div>
      </div>

      {/* Logs */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-700 mb-3">执行日志</h2>
        <pre
          data-testid="execution-logs"
          ref={logRef}
          className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs font-mono overflow-auto max-h-80 whitespace-pre-wrap"
        >
          {execution.logs || '暂无日志'}
        </pre>
      </div>
    </div>
  )
}
