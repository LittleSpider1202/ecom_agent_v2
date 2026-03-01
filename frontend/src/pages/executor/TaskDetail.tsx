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
}

interface DagNodeData {
  key: string
  label: string
  node_type: string
  status: string
  log: string
  error_msg: string
  onSelect: (key: string) => void
  [key: string]: unknown
}

interface DagEdge {
  id: string
  source: string
  target: string
}

interface DagResponse {
  task: TaskInfo
  nodes: Array<{
    id: string
    label: string
    node_type: string
    status: string
    log: string
    error_msg: string
    position: { x: number; y: number }
    source_keys: string[]
  }>
  edges: DagEdge[]
}

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  completed: 'bg-green-50 border-green-400 text-green-800',
  running:   'bg-blue-50 border-blue-400 text-blue-800',
  failed:    'bg-red-50 border-red-400 text-red-800',
  pending:   'bg-gray-50 border-gray-300 text-gray-500',
}

const STATUS_LABEL: Record<string, string> = {
  completed: '✓ 已完成',
  running:   '⟳ 执行中',
  failed:    '✗ 失败',
  pending:   '○ 待执行',
}

const TASK_STATUS_BADGE: Record<string, string> = {
  running:   'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed:    'bg-red-100 text-red-700',
  pending:   'bg-yellow-100 text-yellow-700',
}

// ── Custom DAG node component ────────────────────────────────────────────────

function DagNodeComponent({ data }: NodeProps) {
  const d = data as DagNodeData
  const style = STATUS_STYLE[d.status] ?? STATUS_STYLE.pending
  const isRunning = d.status === 'running'

  return (
    <div
      data-testid={`dag-node-${d.key}`}
      data-status={d.status}
      onClick={() => d.onSelect(d.key)}
      className={`
        px-4 py-3 rounded-lg border-2 cursor-pointer min-w-[160px]
        shadow-sm hover:shadow-md transition-shadow
        ${style} ${isRunning ? 'animate-pulse' : ''}
      `}
    >
      <Handle type="target" position={Position.Top} className="opacity-50" />
      <div className="font-medium text-sm">{d.label}</div>
      <div className={`text-xs mt-1 ${d.status === 'running' ? 'text-blue-600' : ''}`}>
        {STATUS_LABEL[d.status] ?? d.status}
      </div>
      {d.status === 'failed' && d.error_msg && (
        <div className="text-xs text-red-500 mt-1 truncate max-w-[140px]" title={d.error_msg}>
          {d.error_msg}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="opacity-50" />
    </div>
  )
}

// ── Log Panel ────────────────────────────────────────────────────────────────

interface LogPanelProps {
  node: DagNodeData | null
  onClose: () => void
}

function LogPanel({ node, onClose }: LogPanelProps) {
  if (!node) return null

  return (
    <div
      data-testid="log-panel"
      className="absolute right-0 top-0 h-full w-80 bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div>
          <div className="font-semibold text-sm text-gray-800">{node.label}</div>
          <div className={`text-xs mt-0.5 ${STATUS_STYLE[node.status]?.includes('green') ? 'text-green-600' : node.status === 'failed' ? 'text-red-600' : 'text-blue-600'}`}>
            {STATUS_LABEL[node.status]}
          </div>
        </div>
        <button
          data-testid="log-panel-close"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-700 text-lg leading-none"
        >
          ✕
        </button>
      </div>

      {node.status === 'failed' && node.error_msg && (
        <div className="mx-3 mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          <div className="font-medium mb-1">错误信息</div>
          {node.error_msg}
        </div>
      )}

      <div className="flex-1 overflow-auto p-3">
        <div className="text-xs text-gray-500 mb-2 font-medium">执行日志</div>
        <pre
          data-testid="log-content"
          className="text-xs font-mono bg-gray-900 text-gray-100 rounded p-3 whitespace-pre-wrap leading-5 min-h-[80px]"
        >
          {node.log || '（暂无日志）'}
        </pre>
      </div>
    </div>
  )
}

// ── Main TaskDetail (inner, uses useReactFlow) ────────────────────────────────

function TaskDetailInner({
  task,
  dagData,
  selectedKey,
  setSelectedKey,
}: {
  task: TaskInfo
  dagData: DagResponse
  selectedKey: string | null
  setSelectedKey: (k: string | null) => void
}) {
  const navigate = useNavigate()

  const nodeTypes = useMemo(() => ({ dagNode: DagNodeComponent }), [])

  const handleSelect = useCallback((key: string) => {
    setSelectedKey(key)
  }, [setSelectedKey])

  const rfNodes: Node[] = useMemo(() =>
    dagData.nodes.map((n) => ({
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
        onSelect: handleSelect,
      } satisfies DagNodeData,
      draggable: false,
    })),
    [dagData.nodes, handleSelect],
  )

  const rfEdges: Edge[] = useMemo(() =>
    dagData.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'smoothstep',
      style: { stroke: '#94a3b8', strokeWidth: 2 },
    })),
    [dagData.edges],
  )

  const selectedNode = dagData.nodes.find((n) => n.id === selectedKey)
    ? {
        ...(dagData.nodes.find((n) => n.id === selectedKey)!),
        key: selectedKey!,
        onSelect: handleSelect,
      } as DagNodeData
    : null

  const taskStatusBadge = TASK_STATUS_BADGE[task.status] ?? 'bg-gray-100 text-gray-600'
  const taskStatusLabel: Record<string, string> = {
    running: '进行中', completed: '已完成', failed: '失败', pending: '待处理',
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-gray-200 flex items-start gap-4">
        <button
          onClick={() => navigate(-1)}
          className="mt-1 text-gray-400 hover:text-gray-600 text-sm"
        >
          ← 返回
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{task.title}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm text-gray-500">所属流程：{task.flow_name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${taskStatusBadge}`}>
              {taskStatusLabel[task.status] ?? task.status}
            </span>
            {task.current_step && (
              <span className="text-xs text-gray-400">当前步骤：{task.current_step}</span>
            )}
          </div>
        </div>
      </div>

      {/* DAG + Log Panel */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* DAG Canvas */}
        <div
          data-testid="dag-canvas"
          className="flex-1 bg-gray-50"
          style={{ minHeight: 400 }}
        >
          {dagData.nodes.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              暂无执行节点
            </div>
          ) : (
            <ReactFlow
              nodes={rfNodes}
              edges={rfEdges}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.3 }}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              panOnScroll
              zoomOnScroll
            >
              <Background gap={20} color="#e2e8f0" />
              <Controls showInteractive={false} />
            </ReactFlow>
          )}
        </div>

        {/* Log Panel */}
        <LogPanel node={selectedNode} onClose={() => setSelectedKey(null)} />
      </div>
    </div>
  )
}

// ── Page wrapper ──────────────────────────────────────────────────────────────

export default function TaskDetail() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [task, setTask] = useState<TaskInfo | null>(null)
  const [dagData, setDagData] = useState<DagResponse | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  useEffect(() => {
    if (!taskId) return
    api.get(`/api/tasks/${taskId}/dag`)
      .then((r) => {
        setTask(r.data.task)
        setDagData(r.data)
      })
      .catch(() => navigate('/executor/tasks'))
      .finally(() => setLoading(false))
  }, [taskId, navigate])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-gray-400">
        加载中...
      </div>
    )
  }

  if (!task || !dagData) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-gray-400">
        任务不存在
      </div>
    )
  }

  return (
    <ReactFlowProvider>
      <div className="h-[calc(100vh-64px)] flex flex-col">
        <TaskDetailInner
          task={task}
          dagData={dagData}
          selectedKey={selectedKey}
          setSelectedKey={setSelectedKey}
        />
      </div>
    </ReactFlowProvider>
  )
}
