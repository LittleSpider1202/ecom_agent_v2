import { useState, useCallback, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  type NodeProps,
  Handle,
  Position,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import axios from 'axios'

// ── Custom node components ──────────────────────────────────────────────────

function AutoNode({ data, selected }: NodeProps) {
  const cfg = data.config as Record<string, string> | undefined
  return (
    <div
      data-testid="node-auto"
      data-node-type="auto"
      className={`px-4 py-3 rounded-lg bg-blue-50 border-2 min-w-[140px] ${
        selected ? 'border-blue-500 shadow-lg' : 'border-blue-300'
      }`}
    >
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2">
        <span className="text-blue-500 text-lg">⚡</span>
        <div>
          <div className="text-[10px] text-blue-400 font-medium uppercase tracking-wide">API调用</div>
          <div className="text-sm font-semibold text-blue-800">{data.label as string}</div>
        </div>
      </div>
      {cfg?.url && (
        <div className="mt-1 text-[10px] text-blue-500 truncate max-w-[130px]">{cfg.url}</div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

function HumanNode({ data, selected }: NodeProps) {
  const cfg = data.config as Record<string, string> | undefined
  return (
    <div
      data-testid="node-human"
      data-node-type="human"
      className={`px-4 py-3 rounded-lg bg-orange-50 border-2 min-w-[140px] ${
        selected ? 'border-orange-500 shadow-lg' : 'border-orange-300'
      }`}
    >
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2">
        <span className="text-orange-500 text-lg">👤</span>
        <div>
          <div className="text-[10px] text-orange-400 font-medium uppercase tracking-wide">人工确认</div>
          <div className="text-sm font-semibold text-orange-800">{data.label as string}</div>
        </div>
      </div>
      {cfg?.role && (
        <div className="mt-1 text-[10px] text-orange-500">{cfg.role}</div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

function ConditionNode({ data, selected }: NodeProps) {
  return (
    <div
      data-testid="node-condition"
      data-node-type="condition"
      className="relative flex items-center justify-center"
      style={{ width: 130, height: 84 }}
    >
      <Handle type="target" position={Position.Top} style={{ top: 0 }} />
      <div
        className={`absolute inset-3 rotate-45 bg-purple-50 border-2 ${
          selected ? 'border-purple-500' : 'border-purple-300'
        }`}
      />
      <div className="relative z-10 text-center px-1">
        <div className="text-[10px] text-purple-400 font-medium">条件</div>
        <div className="text-sm font-semibold text-purple-800 leading-tight">{data.label as string}</div>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ bottom: 0 }} />
      <Handle type="source" position={Position.Right} id="false" style={{ right: 0 }} />
    </div>
  )
}

const nodeTypes: NodeTypes = { auto: AutoNode, human: HumanNode, condition: ConditionNode }

// ── Config panel ────────────────────────────────────────────────────────────

interface ConfigPanelProps {
  node: Node
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void
  onClose: () => void
}

function ConfigPanel({ node, onUpdate, onClose }: ConfigPanelProps) {
  const data = node.data as Record<string, unknown>
  const initialCfg = (data.config as Record<string, unknown>) || {}
  const [label, setLabel] = useState(data.label as string)
  const [cfg, setCfg] = useState<Record<string, unknown>>(initialCfg)

  const handleSave = () => {
    onUpdate(node.id, { ...data, label, config: cfg })
    onClose()
  }

  return (
    <div className="w-72 bg-white border-l border-gray-200 flex flex-col" data-testid="config-panel">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
        <h3 className="font-semibold text-gray-800 text-sm">节点配置</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">节点名称</label>
          <input
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={label}
            onChange={e => setLabel(e.target.value)}
            data-testid="node-label-input"
          />
        </div>

        {data.nodeType === 'auto' && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">请求URL</label>
              <input
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://api.example.com/endpoint"
                value={(cfg.url as string) || ''}
                onChange={e => setCfg({ ...cfg, url: e.target.value })}
                data-testid="config-url"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">HTTP方法</label>
              <select
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                value={(cfg.method as string) || 'GET'}
                onChange={e => setCfg({ ...cfg, method: e.target.value })}
                data-testid="config-method"
              >
                <option>GET</option>
                <option>POST</option>
                <option>PUT</option>
                <option>DELETE</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">请求参数（JSON）</label>
              <textarea
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm font-mono resize-none"
                rows={3}
                placeholder='{"key": "value"}'
                value={(cfg.params as string) || ''}
                onChange={e => setCfg({ ...cfg, params: e.target.value })}
                data-testid="config-params"
              />
            </div>
          </>
        )}

        {data.nodeType === 'human' && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">负责人角色</label>
              <select
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                value={(cfg.role as string) || ''}
                onChange={e => setCfg({ ...cfg, role: e.target.value })}
                data-testid="config-role"
              >
                <option value="">请选择</option>
                <option value="运营主管">运营主管</option>
                <option value="采购主管">采购主管</option>
                <option value="财务审核">财务审核</option>
                <option value="manager">管理员</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">操作说明</label>
              <textarea
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm resize-none"
                rows={3}
                placeholder="描述人工需要执行的操作..."
                value={(cfg.instructions as string) || ''}
                onChange={e => setCfg({ ...cfg, instructions: e.target.value })}
                data-testid="config-instructions"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">AI建议提示词</label>
              <textarea
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm resize-none"
                rows={2}
                placeholder="告诉AI如何生成建议..."
                value={(cfg.aiPrompt as string) || ''}
                onChange={e => setCfg({ ...cfg, aiPrompt: e.target.value })}
                data-testid="config-ai-prompt"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">超时时间（小时）</label>
              <input
                type="number"
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                value={(cfg.timeout as number) ?? 24}
                onChange={e => setCfg({ ...cfg, timeout: parseInt(e.target.value) })}
                data-testid="config-timeout"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="escalation"
                checked={(cfg.escalation as boolean) || false}
                onChange={e => setCfg({ ...cfg, escalation: e.target.checked })}
                data-testid="config-escalation"
              />
              <label htmlFor="escalation" className="text-sm text-gray-700">超时后催办</label>
            </div>
          </>
        )}

        {data.nodeType === 'condition' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">条件表达式</label>
            <input
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm font-mono"
              placeholder="库存数量 < 100"
              value={(cfg.expression as string) || ''}
              onChange={e => setCfg({ ...cfg, expression: e.target.value })}
              data-testid="config-expression"
            />
            <p className="text-[10px] text-gray-400 mt-1">True → 下方，False → 右侧</p>
          </div>
        )}
      </div>
      <div className="p-4 border-t">
        <button
          onClick={handleSave}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
          data-testid="config-save-btn"
        >
          保存配置
        </button>
      </div>
    </div>
  )
}

// ── Node panel item types ───────────────────────────────────────────────────

const PANEL_NODES = [
  { type: 'auto',      label: 'API调用',  icon: '⚡', desc: '自动执行API请求', color: 'blue' },
  { type: 'human',     label: '人工确认', icon: '👤', desc: '需人工操作的步骤', color: 'orange' },
  { type: 'condition', label: '条件分支', icon: '◇',  desc: '根据条件决定分支', color: 'purple' },
]

const DEFAULT_LABELS: Record<string, string> = {
  auto: '新API调用', human: '人工确认', condition: '条件判断',
}

// ── Inner editor (uses useReactFlow hook which requires ReactFlowProvider) ──

function FlowEditorInner() {
  const { flowId } = useParams()
  const navigate = useNavigate()
  const { screenToFlowPosition } = useReactFlow()
  const reactFlowRef = useRef<HTMLDivElement>(null)
  const nodeCounter = useRef(100)

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [flowName, setFlowName] = useState('未命名流程')
  const [currentFlowId, setCurrentFlowId] = useState<number | null>(flowId ? parseInt(flowId) : null)
  const [version, setVersion] = useState(1)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [configOpen, setConfigOpen] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [triggerDialogOpen, setTriggerDialogOpen] = useState(false)
  const [triggerMessage, setTriggerMessage] = useState('')
  const [triggerType, setTriggerType] = useState('')
  const [triggerConfig, setTriggerConfig] = useState('')

  // Load existing flow
  useEffect(() => {
    if (!flowId) return
    const token = localStorage.getItem('auth_token')
    axios.get(`/api/flows/${flowId}`, { headers: { Authorization: `Bearer ${token}` } }).then(res => {
      const flow = res.data
      setFlowName(flow.name)
      setNodes(flow.nodes || [])
      setEdges(flow.edges || [])
      setVersion(flow.version)
      setTriggerType(flow.trigger_type || '')
      setTriggerConfig(flow.trigger_config || '')
      setCurrentFlowId(flow.id)
      nodeCounter.current = (flow.nodes?.length || 0) + 100
    })
  }, [flowId])

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges(eds =>
        addEdge({ ...params, type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } }, eds),
      ),
    [setEdges],
  )

  const addNode = useCallback(
    (type: string, position?: { x: number; y: number }) => {
      const id = `node-${nodeCounter.current++}`
      const pos = position ?? { x: 180 + Math.random() * 200, y: 120 + Math.random() * 120 }
      setNodes(nds => [
        ...nds,
        {
          id,
          type,
          position: pos,
          data: { label: DEFAULT_LABELS[type] ?? '节点', nodeType: type, config: {} },
        },
      ])
    },
    [setNodes],
  )

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const type = event.dataTransfer.getData('application/reactflow')
      if (!type) return
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      addNode(type, position)
    },
    [screenToFlowPosition, addNode],
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node)
    setConfigOpen(true)
  }, [])

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node)
  }, [])

  const onNodeConfigUpdate = useCallback(
    (nodeId: string, newData: Record<string, unknown>) => {
      setNodes(nds => nds.map(n => (n.id === nodeId ? { ...n, data: newData } : n)))
      setSelectedNode(prev => (prev?.id === nodeId ? { ...prev, data: newData } : prev))
    },
    [setNodes],
  )

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return
    setAiLoading(true)
    try {
      const token = localStorage.getItem('auth_token')
      const res = await axios.post('/api/flows/generate', { prompt: aiPrompt }, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setNodes(res.data.nodes)
      setEdges(res.data.edges)
      nodeCounter.current = res.data.nodes.length + 100
    } finally {
      setAiLoading(false)
    }
  }

  const handleSave = async () => {
    setSaveStatus('saving')
    const token = localStorage.getItem('auth_token')
    const payload = {
      name: flowName,
      nodes,
      edges,
      trigger_type: triggerType || null,
      trigger_config: triggerConfig || null,
    }
    try {
      if (currentFlowId) {
        const res = await axios.put(`/api/flows/${currentFlowId}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        })
        setVersion(res.data.version)
      } else {
        const res = await axios.post('/api/flows', payload, {
          headers: { Authorization: `Bearer ${token}` },
        })
        setCurrentFlowId(res.data.id)
        setVersion(res.data.version)
        navigate(`/manage/flows/${res.data.id}`, { replace: true })
      }
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2500)
      // Trigger global toast
      const showToast = (window as unknown as Record<string, (msg: string, type: string) => void>).__showToast
      if (showToast) showToast('流程已保存', 'success')
    } catch {
      setSaveStatus('error')
      const showToast = (window as unknown as Record<string, (msg: string, type: string) => void>).__showToast
      if (showToast) showToast('保存失败，请重试', 'error')
    }
  }

  const handleTrigger = async () => {
    if (!currentFlowId) return
    const token = localStorage.getItem('auth_token')
    try {
      const res = await axios.post(`/api/flows/${currentFlowId}/trigger`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setTriggerMessage(`触发成功，任务 ID: ${res.data.task_id}`)
      setTriggerDialogOpen(false)
    } catch {
      setTriggerMessage('触发失败，请稍后重试')
      setTriggerDialogOpen(false)
    }
  }

  return (
    <div className="flex flex-col bg-gray-100" style={{ height: 'calc(100vh - 64px)' }}>
      {/* ── Toolbar ── */}
      <div
        className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200 shadow-sm flex-shrink-0 flex-wrap"
        data-testid="flow-toolbar"
      >
        <input
          className="border border-gray-300 rounded px-3 py-1.5 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={flowName}
          onChange={e => setFlowName(e.target.value)}
          placeholder="流程名称"
          data-testid="flow-name-input"
        />

        {/* AI generate */}
        <input
          className="border border-gray-300 rounded px-3 py-1.5 text-sm flex-1 min-w-[160px] max-w-sm"
          placeholder="描述流程，AI自动生成节点..."
          value={aiPrompt}
          onChange={e => setAiPrompt(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAiGenerate()}
          data-testid="ai-prompt-input"
        />
        <button
          onClick={handleAiGenerate}
          disabled={aiLoading}
          className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 disabled:opacity-50 whitespace-nowrap"
          data-testid="ai-generate-btn"
        >
          {aiLoading ? '生成中…' : '✨ AI生成'}
        </button>

        {/* Trigger config */}
        <select
          className="border border-gray-300 rounded px-2 py-1.5 text-sm"
          value={triggerType}
          onChange={e => setTriggerType(e.target.value)}
          data-testid="trigger-type-select"
        >
          <option value="">无触发器</option>
          <option value="manual">手动触发</option>
          <option value="cron">定时触发</option>
        </select>
        {triggerType === 'cron' && (
          <input
            className="border border-gray-300 rounded px-2 py-1.5 text-sm w-36"
            placeholder="0 8 * * *"
            value={triggerConfig}
            onChange={e => setTriggerConfig(e.target.value)}
            data-testid="cron-input"
          />
        )}

        <button
          onClick={handleSave}
          disabled={saveStatus === 'saving'}
          className={`px-4 py-1.5 text-sm rounded font-medium whitespace-nowrap ${
            saveStatus === 'saved'
              ? 'bg-green-600 text-white'
              : saveStatus === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
          data-testid="save-btn"
        >
          {saveStatus === 'saving' ? '保存中…' : saveStatus === 'saved' ? '已保存 ✓' : saveStatus === 'error' ? '保存失败' : '保存'}
        </button>

        {currentFlowId && (
          <button
            onClick={() => setTriggerDialogOpen(true)}
            className="px-4 py-1.5 text-sm rounded font-medium bg-green-600 text-white hover:bg-green-700 whitespace-nowrap"
            data-testid="trigger-btn"
          >
            触发
          </button>
        )}

        <span className="text-xs text-gray-400 whitespace-nowrap font-mono" data-testid="version-badge">
          v{version}
        </span>
      </div>

      {/* Trigger success message */}
      {triggerMessage && (
        <div
          className="px-4 py-2 bg-green-50 border-b border-green-200 text-sm text-green-700 flex items-center gap-2"
          data-testid="trigger-success-msg"
        >
          <span>✓ {triggerMessage}</span>
          <a href="/manage/monitor" className="text-blue-600 hover:underline text-xs">
            查看任务监控 →
          </a>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* ── Node panel ── */}
        <div className="w-52 bg-white border-r border-gray-200 flex flex-col flex-shrink-0" data-testid="node-panel">
          <div className="px-3 py-2 border-b text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            节点类型
          </div>
          <div className="flex-1 p-2 space-y-2 overflow-y-auto">
            {PANEL_NODES.map(n => (
              <div
                key={n.type}
                data-testid={`panel-node-${n.type}`}
                data-node-type={n.type}
                draggable
                onDragStart={e => {
                  e.dataTransfer.setData('application/reactflow', n.type)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onClick={() => addNode(n.type)}
                className={`p-3 rounded-lg border-2 cursor-pointer select-none transition-colors ${
                  n.color === 'blue'
                    ? 'bg-blue-50 border-blue-200 hover:border-blue-400 hover:bg-blue-100'
                    : n.color === 'orange'
                    ? 'bg-orange-50 border-orange-200 hover:border-orange-400 hover:bg-orange-100'
                    : 'bg-purple-50 border-purple-200 hover:border-purple-400 hover:bg-purple-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{n.icon}</span>
                  <div>
                    <div
                      className={`text-sm font-semibold ${
                        n.color === 'blue' ? 'text-blue-700' : n.color === 'orange' ? 'text-orange-700' : 'text-purple-700'
                      }`}
                    >
                      {n.label}
                    </div>
                    <div className="text-[10px] text-gray-400 leading-tight">{n.desc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="px-3 py-2 border-t text-[10px] text-gray-400">点击或拖拽到画布</div>
        </div>

        {/* ── Canvas ── */}
        <div className="flex-1" data-testid="flow-canvas" ref={reactFlowRef}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDoubleClick={onNodeDoubleClick}
            onNodeClick={onNodeClick}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode={['Delete', 'Backspace']}
            className="bg-gray-50"
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>

        {/* ── Config panel ── */}
        {configOpen && selectedNode && (
          <ConfigPanel
            node={selectedNode}
            onUpdate={onNodeConfigUpdate}
            onClose={() => setConfigOpen(false)}
          />
        )}
      </div>

      {/* ── Trigger dialog ── */}
      {triggerDialogOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          data-testid="trigger-dialog"
        >
          <div className="bg-white rounded-xl p-6 w-96 shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">手动触发流程</h3>
            <p className="text-gray-600 mb-6 text-sm">
              确定要立即触发流程 <strong>{flowName}</strong> 吗？这将创建一个新的任务实例。
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setTriggerDialogOpen(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                data-testid="trigger-cancel-btn"
              >
                取消
              </button>
              <button
                onClick={handleTrigger}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                data-testid="trigger-confirm-btn"
              >
                确认触发
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Export with ReactFlowProvider ───────────────────────────────────────────

export default function FlowEditor() {
  return (
    <ReactFlowProvider>
      <FlowEditorInner />
    </ReactFlowProvider>
  )
}
