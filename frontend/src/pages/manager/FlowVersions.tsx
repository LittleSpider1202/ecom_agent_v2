import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'

interface VersionItem {
  id: number
  version: number
  created_at: string | null
}

export default function FlowVersions() {
  const { flowId } = useParams()
  const navigate = useNavigate()
  const [versions, setVersions] = useState<VersionItem[]>([])
  const [flowName, setFlowName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!flowId) return
    const token = localStorage.getItem('auth_token')
    const headers = { Authorization: `Bearer ${token}` }
    Promise.all([
      axios.get(`/api/flows/${flowId}`, { headers }),
      axios.get(`/api/flows/${flowId}/versions`, { headers }),
    ])
      .then(([flowRes, vRes]) => {
        setFlowName(flowRes.data.name)
        setVersions(vRes.data)
      })
      .finally(() => setLoading(false))
  }, [flowId])

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button
        onClick={() => navigate(`/manage/flows/${flowId}`)}
        className="text-sm text-blue-600 hover:underline mb-4 inline-block"
      >
        ← 返回编辑器
      </button>
      <h1 className="text-2xl font-bold text-gray-800 mb-2" data-testid="versions-title">
        版本历史
      </h1>
      {flowName && <p className="text-gray-500 mb-6 text-sm">{flowName}</p>}

      {loading ? (
        <div className="text-center text-gray-400 py-16">加载中…</div>
      ) : versions.length === 0 ? (
        <div className="text-center text-gray-400 py-16">暂无版本记录</div>
      ) : (
        <div className="space-y-3" data-testid="versions-list">
          {versions.map(v => (
            <div
              key={v.id}
              className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-5 py-4"
              data-testid={`version-item-v${v.version}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-blue-600 font-mono">v{v.version}</span>
                {v.version === versions[versions.length - 1]?.version && (
                  <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    当前版本
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-400">
                {v.created_at ? new Date(v.created_at).toLocaleString('zh-CN') : '-'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
