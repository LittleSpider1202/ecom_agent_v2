import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

interface VersionItem {
  id: number
  version: number
  created_at: string | null
  nodes?: unknown[]
  edges?: unknown[]
}

export default function FlowVersions() {
  const { flowId } = useParams()
  const navigate = useNavigate()
  const [versions, setVersions] = useState<VersionItem[]>([])
  const [flowName, setFlowName] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<number[]>([])
  const [diffView, setDiffView] = useState(false)
  const [diffData, setDiffData] = useState<{ a: VersionItem | null; b: VersionItem | null }>({ a: null, b: null })
  const [rolling, setRolling] = useState<number | null>(null)
  const [confirmRollback, setConfirmRollback] = useState<number | null>(null)
  const [rollbackDone, setRollbackDone] = useState<number | null>(null)

  const token = localStorage.getItem('auth_token')
  const headers = { Authorization: `Bearer ${token}` }

  const fetchVersions = () => {
    if (!flowId) return
    Promise.all([
      fetch(`/api/flows/${flowId}`, { headers }).then(r => r.json()),
      fetch(`/api/flows/${flowId}/versions`, { headers }).then(r => r.json()),
    ])
      .then(([flowRes, vRes]) => {
        setFlowName(flowRes.name || '')
        setVersions(Array.isArray(vRes) ? vRes : [])
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchVersions() }, [flowId]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSelect = (v: number) => {
    setSelected(prev => {
      if (prev.includes(v)) return prev.filter(x => x !== v)
      if (prev.length >= 2) return [prev[1], v]
      return [...prev, v]
    })
  }

  const handleDiff = async () => {
    if (selected.length < 2) return
    const [va, vb] = selected.sort((a, b) => a - b)
    const [aData, bData] = await Promise.all([
      fetch(`/api/flows/${flowId}/versions/${va}`, { headers }).then(r => r.json()),
      fetch(`/api/flows/${flowId}/versions/${vb}`, { headers }).then(r => r.json()),
    ])
    setDiffData({ a: aData, b: bData })
    setDiffView(true)
  }

  const handleRollback = async (versionNum: number) => {
    if (!flowId) return
    setRolling(versionNum)
    setConfirmRollback(null)
    try {
      const res = await fetch(`/api/flows/${flowId}/versions/${versionNum}/rollback`, {
        method: 'POST',
        headers,
      })
      if (res.ok) {
        const data = await res.json()
        setRollbackDone(data.new_version)
        setLoading(true)
        fetchVersions()
      }
    } finally {
      setRolling(null)
    }
  }

  const sortedVersions = [...versions].sort((a, b) => b.version - a.version)
  const latestVersion = sortedVersions[0]?.version ?? 0

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button
        onClick={() => navigate(`/manage/flows/${flowId}`)}
        className="text-sm text-blue-600 hover:underline mb-4 inline-block"
      >
        ← 返回编辑器
      </button>
      <h1 className="text-2xl font-bold text-gray-800 mb-1" data-testid="versions-title">
        版本历史
      </h1>
      {flowName && <p className="text-gray-500 mb-6 text-sm">{flowName}</p>}

      {rollbackDone !== null && (
        <div data-testid="rollback-success" className="mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          已成功回滚，新版本 v{rollbackDone} 已创建
        </div>
      )}

      {/* Compare toolbar */}
      {selected.length === 2 && !diffView && (
        <div className="mb-4 flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          <span className="text-sm text-blue-700">已选 v{selected[0]} 和 v{selected[1]}</span>
          <button
            data-testid="diff-btn"
            onClick={handleDiff}
            className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium"
          >
            对比
          </button>
          <button onClick={() => setSelected([])} className="text-xs text-gray-400 hover:text-gray-600">清除</button>
        </div>
      )}

      {/* Diff view */}
      {diffView && diffData.a && diffData.b && (
        <div data-testid="diff-view" className="mb-6 bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-700">版本差异对比</h2>
            <button onClick={() => { setDiffView(false); setSelected([]) }} className="text-sm text-gray-400 hover:text-gray-600">关闭</button>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="font-medium text-gray-600 mb-2 px-3 py-1.5 bg-gray-50 rounded">
                v{diffData.a.version} — {diffData.a.created_at ? new Date(diffData.a.created_at).toLocaleString('zh-CN') : '-'}
              </div>
              <pre className="bg-gray-900 text-gray-200 rounded p-3 text-xs overflow-auto max-h-48 whitespace-pre-wrap">
                {JSON.stringify({ nodes: (diffData.a.nodes as unknown[])?.length ?? 0, edges: (diffData.a.edges as unknown[])?.length ?? 0 }, null, 2)}
              </pre>
            </div>
            <div>
              <div className="font-medium text-gray-600 mb-2 px-3 py-1.5 bg-blue-50 rounded">
                v{diffData.b.version} — {diffData.b.created_at ? new Date(diffData.b.created_at).toLocaleString('zh-CN') : '-'}
              </div>
              <pre className="bg-gray-900 text-gray-200 rounded p-3 text-xs overflow-auto max-h-48 whitespace-pre-wrap">
                {JSON.stringify({ nodes: (diffData.b.nodes as unknown[])?.length ?? 0, edges: (diffData.b.edges as unknown[])?.length ?? 0 }, null, 2)}
              </pre>
            </div>
          </div>
          <div data-testid="diff-highlight" className="mt-3 text-xs text-gray-500 bg-yellow-50 border border-yellow-200 rounded px-3 py-2">
            v{diffData.a.version}: {(diffData.a.nodes as unknown[])?.length ?? 0} 节点 / {(diffData.a.edges as unknown[])?.length ?? 0} 连线 →
            v{diffData.b.version}: {(diffData.b.nodes as unknown[])?.length ?? 0} 节点 / {(diffData.b.edges as unknown[])?.length ?? 0} 连线
          </div>
        </div>
      )}

      {/* Version list */}
      {loading ? (
        <div className="text-center text-gray-400 py-16">加载中…</div>
      ) : sortedVersions.length === 0 ? (
        <div className="text-center text-gray-400 py-16">暂无版本记录</div>
      ) : (
        <div className="space-y-3" data-testid="versions-list">
          {sortedVersions.map(v => (
            <div
              key={v.id}
              className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-5 py-4 hover:border-blue-200 transition-colors"
              data-testid={`version-item-v${v.version}`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  data-testid={`version-check-v${v.version}`}
                  checked={selected.includes(v.version)}
                  onChange={() => toggleSelect(v.version)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                />
                <span className="text-lg font-bold text-blue-600 font-mono">v{v.version}</span>
                {v.version === latestVersion && (
                  <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    当前版本
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4">
                <span className="text-xs text-gray-400">
                  {v.created_at ? new Date(v.created_at).toLocaleString('zh-CN') : '-'}
                </span>
                {v.version !== latestVersion && (
                  confirmRollback === v.version ? (
                    <div className="flex gap-2">
                      <button
                        data-testid={`confirm-rollback-v${v.version}`}
                        onClick={() => handleRollback(v.version)}
                        disabled={rolling !== null}
                        className="px-3 py-1 bg-orange-500 text-white text-xs rounded hover:bg-orange-600 disabled:opacity-50 font-medium"
                      >
                        {rolling === v.version ? '回滚中...' : '确认回滚'}
                      </button>
                      <button
                        onClick={() => setConfirmRollback(null)}
                        className="px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded hover:bg-gray-200"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <button
                      data-testid={`rollback-btn-v${v.version}`}
                      onClick={() => setConfirmRollback(v.version)}
                      className="px-3 py-1 border border-gray-300 text-gray-600 text-xs rounded hover:bg-gray-50 font-medium"
                    >
                      回滚
                    </button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rollback confirm dialog */}
      {confirmRollback !== null && (
        <div
          data-testid="rollback-dialog"
          className="fixed inset-0 bg-black/20 flex items-center justify-center z-50"
          onClick={e => { if (e.target === e.currentTarget) setConfirmRollback(null) }}
        >
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">确认回滚</h3>
            <p className="text-gray-600 mb-5 text-sm">
              将流程回滚到 <span className="font-bold text-blue-600">v{confirmRollback}</span>，
              系统将创建一个新版本 v{latestVersion + 1} 作为回滚副本。此操作不可撤销，是否继续？
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmRollback(null)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm">取消</button>
              <button
                data-testid="dialog-rollback-btn"
                onClick={() => handleRollback(confirmRollback)}
                disabled={rolling !== null}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600 disabled:opacity-50 font-medium"
              >
                确认回滚
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
