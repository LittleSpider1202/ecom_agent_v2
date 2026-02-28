import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

interface Param {
  name: string
  type: string
  required: boolean
  description: string
}

interface ToolConfig {
  url?: string
  method?: string
  headers?: Record<string, string>
  script_filename?: string
}

interface Tool {
  id?: number
  name: string
  description: string
  tool_type: string
  allowed_roles: string[]
  config: ToolConfig
  params: Param[]
  enabled?: boolean
}

const TOOL_TYPES = [
  { value: 'api', label: 'API调用' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'script', label: 'Python脚本' },
]

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const PARAM_TYPES = ['string', 'number', 'boolean', 'array', 'object']
const ALL_ROLES = ['executor', 'manager']

const emptyTool = (): Tool => ({
  name: '',
  description: '',
  tool_type: 'api',
  allowed_roles: ['executor', 'manager'],
  config: { url: '', method: 'POST', headers: {} },
  params: [],
})

export default function ToolEditor() {
  const { toolId } = useParams<{ toolId?: string }>()
  const navigate = useNavigate()
  const isNew = !toolId || toolId === 'new'

  const [tool, setTool] = useState<Tool>(emptyTool())
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [scriptFilename, setScriptFilename] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Add header state
  const [newHeaderKey, setNewHeaderKey] = useState('')
  const [newHeaderVal, setNewHeaderVal] = useState('')

  const token = localStorage.getItem('auth_token')
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  useEffect(() => {
    if (!isNew && toolId) {
      fetch(`/api/tools/${toolId}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => {
          setTool({
            ...data,
            config: data.config || {},
            params: data.params || [],
          })
          if (data.config?.script_filename) setScriptFilename(data.config.script_filename)
        })
        .finally(() => setLoading(false))
    }
  }, [toolId]) // eslint-disable-line react-hooks/exhaustive-deps

  const update = (patch: Partial<Tool>) => setTool(prev => ({ ...prev, ...patch }))
  const updateConfig = (patch: Partial<ToolConfig>) =>
    setTool(prev => ({ ...prev, config: { ...prev.config, ...patch } }))

  const addParam = () => {
    setTool(prev => ({
      ...prev,
      params: [...prev.params, { name: '', type: 'string', required: false, description: '' }],
    }))
  }

  const updateParam = (idx: number, patch: Partial<Param>) => {
    setTool(prev => ({
      ...prev,
      params: prev.params.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    }))
  }

  const removeParam = (idx: number) => {
    setTool(prev => ({ ...prev, params: prev.params.filter((_, i) => i !== idx) }))
  }

  const addHeader = () => {
    if (!newHeaderKey) return
    updateConfig({ headers: { ...(tool.config.headers || {}), [newHeaderKey]: newHeaderVal } })
    setNewHeaderKey('')
    setNewHeaderVal('')
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setScriptFilename(file.name)
      updateConfig({ script_filename: file.name })
    }
  }

  const handleSave = async () => {
    if (!tool.name.trim()) return
    setSaving(true)
    try {
      const body = {
        name: tool.name,
        description: tool.description,
        tool_type: tool.tool_type,
        allowed_roles: tool.allowed_roles,
        config: tool.config,
        params: tool.params,
      }
      const res = await fetch(
        isNew ? '/api/tools' : `/api/tools/${toolId}`,
        { method: isNew ? 'POST' : 'PUT', headers, body: JSON.stringify(body) }
      )
      if (res.ok) {
        const data = await res.json()
        setSaved(true)
        setTimeout(() => navigate(`/manage/tools/${data.id}`), 1500)
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6 text-center text-gray-400">加载中...</div>

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button
        onClick={() => navigate('/manage/tools')}
        className="text-sm text-blue-600 hover:underline mb-4 inline-block"
      >
        ← 返回工具库
      </button>

      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        {isNew ? '新建工具' : '编辑工具'}
      </h1>

      {saved && (
        <div data-testid="save-success" className="mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          工具保存成功，正在跳转...
        </div>
      )}

      <div className="space-y-6">
        {/* Basic info */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-700 mb-4">基本信息</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">工具名称 *</label>
              <input
                data-testid="tool-name-input"
                type="text"
                value={tool.name}
                onChange={e => update({ name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="如：ERP库存查询"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">描述</label>
              <textarea
                data-testid="tool-desc-input"
                value={tool.description}
                onChange={e => update({ description: e.target.value })}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="工具功能说明..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">工具类型</label>
              <div data-testid="tool-type-select" className="flex gap-3">
                {TOOL_TYPES.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    data-testid={`type-btn-${t.value}`}
                    onClick={() => {
                      update({ tool_type: t.value })
                      updateConfig({ url: '', method: 'POST', headers: {}, script_filename: '' })
                    }}
                    className={`px-4 py-2 rounded-lg text-sm border font-medium transition-colors ${
                      tool.tool_type === t.value
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Type-specific config */}
        {(tool.tool_type === 'api' || tool.tool_type === 'webhook') && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-700 mb-4">
              {tool.tool_type === 'api' ? 'API 配置' : 'Webhook 配置'}
            </h2>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="w-32">
                  <label className="block text-xs font-medium text-gray-500 mb-1">HTTP方法</label>
                  <select
                    data-testid="http-method-select"
                    value={tool.config.method || 'POST'}
                    onChange={e => updateConfig({ method: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {HTTP_METHODS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">URL</label>
                  <input
                    data-testid="api-url-input"
                    type="text"
                    value={tool.config.url || ''}
                    onChange={e => updateConfig({ url: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://api.example.com/endpoint"
                  />
                </div>
              </div>

              {/* Headers */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">认证头 / Headers</label>
                <div data-testid="headers-list" className="space-y-1 mb-2">
                  {Object.entries(tool.config.headers || {}).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2 bg-gray-50 rounded px-3 py-1.5 text-sm">
                      <span className="font-mono text-gray-600">{k}</span>
                      <span className="text-gray-400">:</span>
                      <span className="font-mono text-gray-500 truncate">{v}</span>
                      <button
                        onClick={() => {
                          const { [k]: _, ...rest } = tool.config.headers || {}
                          updateConfig({ headers: rest })
                        }}
                        className="ml-auto text-red-400 hover:text-red-600 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    data-testid="header-key-input"
                    type="text"
                    value={newHeaderKey}
                    onChange={e => setNewHeaderKey(e.target.value)}
                    className="w-40 border border-gray-300 rounded px-2 py-1.5 text-xs"
                    placeholder="Authorization"
                  />
                  <input
                    data-testid="header-val-input"
                    type="text"
                    value={newHeaderVal}
                    onChange={e => setNewHeaderVal(e.target.value)}
                    className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-xs"
                    placeholder="Bearer ..."
                  />
                  <button
                    data-testid="add-header-btn"
                    onClick={addHeader}
                    className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200 font-medium"
                  >
                    添加
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {tool.tool_type === 'script' && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-700 mb-4">脚本配置</h2>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">上传脚本文件</label>
              <div className="flex items-center gap-3">
                <button
                  data-testid="upload-script-btn"
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="px-4 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
                >
                  选择 .py 文件
                </button>
                {scriptFilename && (
                  <span data-testid="script-filename" className="text-sm text-green-600 font-medium">
                    ✓ {scriptFilename}
                  </span>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".py"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="script-file-input"
              />
            </div>
          </div>
        )}

        {/* Parameters */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-700">输入参数</h2>
            <button
              data-testid="add-param-btn"
              onClick={addParam}
              className="px-3 py-1.5 bg-blue-50 text-blue-600 text-xs rounded-lg hover:bg-blue-100 font-medium"
            >
              + 添加参数
            </button>
          </div>

          {tool.params.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">暂无参数，点击右上角添加</p>
          ) : (
            <div data-testid="params-list" className="space-y-3">
              {tool.params.map((p, i) => (
                <div key={i} data-testid={`param-item-${i}`} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    <input
                      data-testid={`param-name-${i}`}
                      type="text"
                      value={p.name}
                      onChange={e => updateParam(i, { name: e.target.value })}
                      placeholder="参数名"
                      className="border border-gray-300 rounded px-2 py-1.5 text-xs"
                    />
                    <select
                      data-testid={`param-type-${i}`}
                      value={p.type}
                      onChange={e => updateParam(i, { type: e.target.value })}
                      className="border border-gray-300 rounded px-2 py-1.5 text-xs"
                    >
                      {PARAM_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                    <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                      <input
                        data-testid={`param-required-${i}`}
                        type="checkbox"
                        checked={p.required}
                        onChange={e => updateParam(i, { required: e.target.checked })}
                        className="rounded"
                      />
                      必填
                    </label>
                    <button
                      onClick={() => removeParam(i)}
                      className="text-red-400 hover:text-red-600 text-xs text-right"
                    >
                      删除
                    </button>
                  </div>
                  <input
                    data-testid={`param-desc-${i}`}
                    type="text"
                    value={p.description}
                    onChange={e => updateParam(i, { description: e.target.value })}
                    placeholder="参数描述"
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Permissions */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-700 mb-4">访问权限</h2>
          <div data-testid="roles-section" className="flex gap-4">
            {ALL_ROLES.map(role => (
              <label key={role} className="flex items-center gap-2 cursor-pointer">
                <input
                  data-testid={`role-check-${role}`}
                  type="checkbox"
                  checked={tool.allowed_roles.includes(role)}
                  onChange={e => {
                    update({
                      allowed_roles: e.target.checked
                        ? [...tool.allowed_roles, role]
                        : tool.allowed_roles.filter(r => r !== role),
                    })
                  }}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">{role === 'executor' ? '执行者' : '管理员'}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end gap-3">
          <button
            onClick={() => navigate('/manage/tools')}
            className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
          >
            取消
          </button>
          <button
            data-testid="save-tool-btn"
            onClick={handleSave}
            disabled={saving || !tool.name.trim()}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
