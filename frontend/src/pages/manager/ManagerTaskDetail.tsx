import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import api from '../../hooks/useApi'

// ── Types ────────────────────────────────────────────────────────────────────

interface TaskInfo {
  id: number
  title: string
  flow_name: string
  status: string
  current_step: string | null
  has_human_step: boolean
  created_at: string | null
}

interface DagNodeData {
  key: string
  label: string
  node_type: string
  status: string
  log: string
  error_msg: string
  started_at: string | null
  finished_at: string | null
  onSelect: (key: string) => void
  [key: string]: unknown
}

interface RawNode {
  id: string
  label: string
  node_type: string
  status: string
  log: string
  error_msg: string
  reject_reason?: string
  position: { x: number; y: number }
  source_keys: string[]
  started_at: string | null
  finished_at: string | null
}

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  completed: 'bg-green-50 border-green-400 text-green-800',
  running:   'bg-blue-50 border-blue-400 text-blue-800',
  failed:    'bg-red-50 border-red-400 text-red-800',
  pending:   'bg-gray-50 border-gray-300 text-gray-500',
  rejected:  'bg-orange-50 border-orange-400 text-orange-800',
}

const STATUS_LABEL: Record<string, string> = {
  completed: '✓ 已完成',
  running:   '⟳ 执行中',
  failed:    '✗ 失败',
  pending:   '○ 待执行',
  rejected:  '✗ 已驳回',
}

const TASK_STATUS_BADGE: Record<string, string> = {
  running:   'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed:    'bg-red-100 text-red-700',
  pending:   'bg-yellow-100 text-yellow-700',
  rejected:  'bg-gray-100 text-gray-600',
}

function fmtTime(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('zh-CN')
}

function fmtDuration(startIso: string | null, endIso: string | null): string {
  if (!startIso || !endIso) return '-'
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime()
  if (ms < 0) return '-'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

// ── Node component ────────────────────────────────────────────────────────────

function DagNode({ data }: NodeProps) {
  const d = data as DagNodeData
  const isHuman = d.node_type === 'human'
  const cls = STATUS_STYLE[d.status] ?? STATUS_STYLE.pending

  return (
    <div
      onClick={() => d.onSelect(d.key)}
      className={`border-2 rounded-lg px-4 py-2 text-sm font-medium cursor-pointer min-w-[120px] text-center select-none transition-shadow hover:shadow-md ${cls} ${
        isHuman ? 'border-orange-400' : ''
      }`}
      data-testid={`dag-node-${d.key}`}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div className="text-xs text-gray-400 mb-0.5">
        {isHuman ? '👤 人工' : '⚙ 自动'}
      </div>
      <div>{d.label}</div>
      <div className="text-xs mt-1 opacity-70">{STATUS_LABEL[d.status] ?? d.status}</div>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  )
}

const nodeTypes = { dagNode: DagNode }

// ── Main component ────────────────────────────────────────────────────────────

function ManagerTaskDetailInner() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()

  const [task, setTask] = useState<TaskInfo | null>(null)
  const [rawNodes, setRawNodes] = useState<RawNode[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Admin action states
  const [showTerminate, setShowTerminate] = useState(false)
  const [terminateReason, setTerminateReason] = useState('')
  const [terminateLoading, setTerminateLoading] = useState(false)

  const [urgeNodeKey, setUrgeNodeKey] = useState<string | null>(null)
  const [urgeLoading, setUrgeLoading] = useState(false)
  const [urgeMsg, setUrgeMsg] = useState<string | null>(null)

  const [proxyStep, setProxyStep] = useState<{ stepId: number; stepName: string } | null>(null)
  const [proxyContent, setProxyContent] = useState('')
  const [proxyLoading, setProxyLoading] = useState(false)

  const loadDag = useCallback(async () => {
    if (!taskId) return
    try {
      const res = await api.get(`/api/tasks/${taskId}/dag`)
      setTask(res.data.task)
      setRawNodes(res.data.nodes)
      setEdges(res.data.edges)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [taskId])

  useEffect(() => {
    loadDag()
  }, [loadDag])

  const handleSelect = useCallback((key: string) => {
    setSelectedKey(prev => (prev === key ? null : key))
  }, [])

  const nodes: Node[] = useMemo(() => {
    return rawNodes.map(n => ({
      id: n.id,
      type: 'dagNode',
      position: n.position,
      data: {
        key: n.id,
        label: n.label,
        node_type: n.node_type,
        status: n.status,
        log: n.log,
        error_msg: n.error_msg,
        started_at: n.started_at,
        finished_at: n.finished_at,
        onSelect: handleSelect,
      },
    }))
  }, [rawNodes, handleSelect])

  const selectedNode = rawNodes.find(n => n.id === selectedKey)

  // Find pending human step for proxy handle
  const pendingHumanNodes = rawNodes.filter(n => n.node_type === 'human' && n.status === 'pending')

  const handleUrge = async () => {
    if (!taskId) return
    setUrgeLoading(true)
    try {
      const res = await api.post(`/api/tasks/${taskId}/urge`)
      setUrgeMsg(res.data.message)
      setUrgeNodeKey(null)
    } catch {
      setUrgeMsg('催办失败')
    } finally {
      setUrgeLoading(false)
    }
  }

  const handleTerminate = async () => {
    if (!taskId) return
    setTerminateLoading(true)
    try {
      await api.post(`/api/tasks/${taskId}/terminate?reason=${encodeURIComponent(terminateReason || '管理员强制终止')}`)
      await loadDag()
      setShowTerminate(false)
      setTerminateReason('')
    } catch {
      // ignore
    } finally {
      setTerminateLoading(false)
    }
  }

  const handleProxySubmit = async () => {
    if (!taskId || !proxyStep) return
    setProxyLoading(true)
    try {
      await api.post(`/api/tasks/${taskId}/steps/${proxyStep.stepId}/submit`, {
        content: proxyContent,
        mode: 'accept',
      })
      await loadDag()
      setProxyStep(null)
      setProxyContent('')
    } catch {
      // ignore
    } finally {
      setProxyLoading(false)
    }
  }

  const loadPendingStep = async () => {
    if (!taskId) return
    try {
      const res = await api.get(`/api/tasks/${taskId}/steps/current`)
      return res.data
    } catch {
      return null
    }
  }

  const openProxyHandle = async () => {
    const step = await loadPendingStep()
    if (step) {
      setProxyStep({ stepId: step.id, stepName: step.step_name })
      setProxyContent(step.ai_suggestion || '')
    }
  }

  if (loading) {
    return <div className="p-6 text-center text-gray-400">加载中…</div>
  }

  if (!task) {
    return <div className="p-6 text-center text-gray-500">任务不存在</div>
  }

  const taskBadge = TASK_STATUS_BADGE[task.status] ?? TASK_STATUS_BADGE.pending
  const canTerminate = task.status === 'running' || task.status === 'pending'

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/manage/monitor')}
          className="text-gray-400 hover:text-gray-600"
        >
          ← 返回监控
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-800" data-testid="task-detail-title">
              {task.title}
            </h1>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${taskBadge}`} data-testid="task-status-badge">
              {task.status === 'running' ? '进行中' :
               task.status === 'completed' ? '已完成' :
               task.status === 'failed' ? '已终止' :
               task.status === 'rejected' ? '已驳回' : '待处理'}
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-0.5">流程：{task.flow_name}　开始：{fmtTime(task.created_at)}</p>
        </div>
        {/* Admin actions */}
        <div className="flex items-center gap-2">
          {(task.has_human_step || task.status === 'rejected') && (
            <>
              {task.has_human_step && (
                <button
                  data-testid="urge-task-btn"
                  onClick={() => setUrgeNodeKey('task')}
                  className="px-3 py-1.5 text-sm bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200"
                >
                  催办
                </button>
              )}
              <button
                data-testid="proxy-handle-btn"
                onClick={openProxyHandle}
                className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
              >
                代为处理
              </button>
            </>
          )}
          {canTerminate && (
            <button
              data-testid="terminate-btn"
              onClick={() => setShowTerminate(true)}
              className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
            >
              强制终止
            </button>
          )}
        </div>
      </div>

      {/* Success message */}
      {urgeMsg && (
        <div data-testid="urge-msg" className="mb-4 px-4 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm flex items-center justify-between">
          <span>{urgeMsg}</span>
          <button onClick={() => setUrgeMsg(null)} className="ml-4 text-green-500">✕</button>
        </div>
      )}

      <div className="flex gap-6">
        {/* DAG */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden" style={{ height: 480 }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={true}
          >
            <Background />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        {/* Side panel */}
        <div className="w-72 flex-shrink-0">
          {selectedNode ? (
            <div className="bg-white rounded-xl border border-gray-200 p-4" data-testid="node-detail-panel">
              <h3 className="font-semibold text-gray-800 mb-3">{selectedNode.label}</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">状态</span>
                  <span>{STATUS_LABEL[selectedNode.status] ?? selectedNode.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">类型</span>
                  <span>{selectedNode.node_type === 'human' ? '人工节点' : '自动节点'}</span>
                </div>
                <hr className="border-gray-100" />
                <div>
                  <span className="text-gray-400">开始时间</span>
                  <div className="text-gray-700 mt-0.5" data-testid="node-started-at">{fmtTime(selectedNode.started_at)}</div>
                </div>
                <div>
                  <span className="text-gray-400">结束时间</span>
                  <div className="text-gray-700 mt-0.5" data-testid="node-finished-at">{fmtTime(selectedNode.finished_at)}</div>
                </div>
                <div>
                  <span className="text-gray-400">耗时</span>
                  <div className="text-gray-700 mt-0.5" data-testid="node-duration">{fmtDuration(selectedNode.started_at, selectedNode.finished_at)}</div>
                </div>
                {selectedNode.log && (
                  <>
                    <hr className="border-gray-100" />
                    <div>
                      <span className="text-gray-400">执行日志</span>
                      <pre className="text-xs text-gray-600 mt-1 bg-gray-50 rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap">{selectedNode.log}</pre>
                    </div>
                  </>
                )}
                {selectedNode.error_msg && (
                  <div className="p-2 bg-red-50 text-red-700 text-xs rounded">{selectedNode.error_msg}</div>
                )}
                {selectedNode.status === 'rejected' && selectedNode.reject_reason && (
                  <div data-testid="rejected-reason-panel" className="p-2 bg-orange-50 text-orange-700 text-xs rounded border border-orange-200">
                    <span className="font-medium">驳回原因：</span>{selectedNode.reject_reason}
                  </div>
                )}
                {/* Node-level urge for pending human nodes */}
                {selectedNode.node_type === 'human' && selectedNode.status === 'pending' && (
                  <button
                    data-testid="node-urge-btn"
                    onClick={() => setUrgeNodeKey(selectedNode.id)}
                    className="w-full mt-2 px-3 py-1.5 text-sm bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200"
                  >
                    催办此节点
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center text-gray-400 text-sm">
              点击节点查看详情
            </div>
          )}

          {/* Pending human nodes list */}
          {pendingHumanNodes.length > 0 && (
            <div className="mt-3 bg-orange-50 rounded-xl border border-orange-200 p-3">
              <p className="text-xs font-medium text-orange-700 mb-2">待处理人工节点</p>
              {pendingHumanNodes.map(n => (
                <div key={n.id} className="text-sm text-orange-800 py-1">{n.label}</div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Urge confirmation dialog */}
      {urgeNodeKey != null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" data-testid="urge-dialog">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">确认催办</h3>
            <p className="text-sm text-gray-600 mb-4">确定发送催办通知给该任务的负责人吗？</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setUrgeNodeKey(null)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                取消
              </button>
              <button
                data-testid="urge-confirm"
                onClick={handleUrge}
                disabled={urgeLoading}
                className="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
              >
                {urgeLoading ? '发送中…' : '确认催办'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proxy handle modal */}
      {proxyStep && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" data-testid="proxy-handle-modal">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-1">代为处理</h3>
            <p className="text-sm text-gray-500 mb-4">步骤：{proxyStep.stepName}　（管理员代操）</p>
            <textarea
              data-testid="proxy-content-input"
              value={proxyContent}
              onChange={e => setProxyContent(e.target.value)}
              rows={4}
              placeholder="填写处理内容…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setProxyStep(null)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                取消
              </button>
              <button
                data-testid="proxy-submit-btn"
                onClick={handleProxySubmit}
                disabled={proxyLoading || !proxyContent.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {proxyLoading ? '提交中…' : '以管理员身份提交'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terminate confirmation dialog */}
      {showTerminate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" data-testid="terminate-dialog">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-1">强制终止任务</h3>
            <p className="text-sm text-gray-500 mb-3">此操作将立即停止任务执行，无法恢复。请输入终止原因：</p>
            <input
              data-testid="terminate-reason-input"
              type="text"
              value={terminateReason}
              onChange={e => setTerminateReason(e.target.value)}
              placeholder="终止原因（如：流程异常需重启）"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowTerminate(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                取消
              </button>
              <button
                data-testid="terminate-confirm-btn"
                onClick={handleTerminate}
                disabled={terminateLoading}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {terminateLoading ? '终止中…' : '确认终止'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ManagerTaskDetail() {
  return (
    <ReactFlowProvider>
      <ManagerTaskDetailInner />
    </ReactFlowProvider>
  )
}
