import { useState, useEffect } from 'react'

const API_URL = ''

interface RoleData {
  id: number
  name: string
  description: string
  permissions: Record<string, Record<string, boolean>>
  node_types: string[]
}

interface RoleCreate {
  name: string
  description: string
  permissions: Record<string, Record<string, boolean>>
  node_types: string[]
}

const MODULES = [
  { key: 'tasks', label: '任务管理' },
  { key: 'flows', label: '流程管理' },
  { key: 'tools', label: '工具管理' },
  { key: 'knowledge', label: '知识库' },
]

const ACTIONS: Record<string, { key: string; label: string }[]> = {
  tasks: [
    { key: 'view', label: '查看' },
    { key: 'create', label: '创建' },
    { key: 'edit', label: '编辑' },
    { key: 'delete', label: '删除' },
  ],
  flows: [
    { key: 'view', label: '查看' },
    { key: 'create', label: '创建' },
    { key: 'edit', label: '编辑' },
    { key: 'delete', label: '删除' },
  ],
  tools: [
    { key: 'view', label: '查看' },
    { key: 'use', label: '使用' },
    { key: 'manage', label: '管理' },
  ],
  knowledge: [
    { key: 'view', label: '查看' },
    { key: 'contribute', label: '贡献' },
    { key: 'manage', label: '管理' },
  ],
}

const NODE_TYPES = [
  { key: 'data_confirm', label: '数值确认' },
  { key: 'review_judge', label: '审核判断' },
  { key: 'approval', label: '审批' },
  { key: 'manual_input', label: '手动录入' },
]

function getToken() {
  return localStorage.getItem('auth_token') || ''
}

async function apiCall(path: string, method = 'GET', body?: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Error' }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

function emptyPerms(): Record<string, Record<string, boolean>> {
  const p: Record<string, Record<string, boolean>> = {}
  MODULES.forEach(m => {
    p[m.key] = {}
    ACTIONS[m.key].forEach(a => { p[m.key][a.key] = false })
  })
  return p
}

function PermMatrix({
  permissions,
  onChange,
  readOnly,
}: {
  permissions: Record<string, Record<string, boolean>>
  onChange?: (p: Record<string, Record<string, boolean>>) => void
  readOnly?: boolean
}) {
  const toggle = (mod: string, action: string) => {
    if (readOnly || !onChange) return
    const updated = {
      ...permissions,
      [mod]: { ...permissions[mod], [action]: !permissions[mod]?.[action] },
    }
    onChange(updated)
  }

  return (
    <div data-testid="perm-matrix" className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50">
            <th className="text-left px-3 py-2 border border-gray-200 font-medium">功能模块</th>
            <th className="text-left px-3 py-2 border border-gray-200 font-medium">查看</th>
            <th className="text-left px-3 py-2 border border-gray-200 font-medium">创建/贡献/使用</th>
            <th className="text-left px-3 py-2 border border-gray-200 font-medium">编辑/管理</th>
            <th className="text-left px-3 py-2 border border-gray-200 font-medium">删除</th>
          </tr>
        </thead>
        <tbody>
          {MODULES.map(mod => {
            const actions = ACTIONS[mod.key]
            return (
              <tr key={mod.key} data-testid={`perm-row-${mod.key}`} className="hover:bg-gray-50">
                <td className="px-3 py-2 border border-gray-200 font-medium text-gray-700">{mod.label}</td>
                {[0, 1, 2, 3].map(col => {
                  const colActions = actions.filter((a) => {
                    if (col === 0) return a.key === 'view'
                    if (col === 1) return ['create', 'contribute', 'use'].includes(a.key)
                    if (col === 2) return ['edit', 'manage'].includes(a.key)
                    if (col === 3) return a.key === 'delete'
                    return false
                  })
                  return (
                    <td key={col} className="px-3 py-2 border border-gray-200">
                      {colActions.map(a => (
                        <label key={a.key} className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            data-testid={`perm-check-${mod.key}-${a.key}`}
                            checked={permissions[mod.key]?.[a.key] ?? false}
                            onChange={() => toggle(mod.key, a.key)}
                            disabled={readOnly}
                          />
                          <span className="text-xs text-gray-600">{a.label}</span>
                        </label>
                      ))}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function RoleManagement() {
  const [roles, setRoles] = useState<RoleData[]>([])
  const [selectedRole, setSelectedRole] = useState<RoleData | null>(null)
  const [loading, setLoading] = useState(true)

  // Edit state
  const [editPerms, setEditPerms] = useState<Record<string, Record<string, boolean>>>({})
  const [editNodeTypes, setEditNodeTypes] = useState<string[]>([])
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Create dialog
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState<RoleCreate>({
    name: '',
    description: '',
    permissions: emptyPerms(),
    node_types: [],
  })
  const [createError, setCreateError] = useState('')

  const load = () => {
    setLoading(true)
    apiCall('/api/roles')
      .then((data: RoleData[]) => {
        setRoles(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const selectRole = (role: RoleData) => {
    setSelectedRole(role)
    setEditPerms(JSON.parse(JSON.stringify(role.permissions || {})))
    setEditNodeTypes([...(role.node_types || [])])
    setSaveSuccess(false)
    setSaveError('')
  }

  const handleSave = async () => {
    if (!selectedRole) return
    try {
      await apiCall(`/api/roles/${selectedRole.id}`, 'PUT', {
        permissions: editPerms,
        node_types: editNodeTypes,
      })
      setSaveSuccess(true)
      setSaveError('')
      load()
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : '保存失败')
    }
  }

  const toggleNodeType = (key: string) => {
    setEditNodeTypes(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const handleCreate = async () => {
    if (!createForm.name.trim()) { setCreateError('请输入角色名称'); return }
    try {
      await apiCall('/api/roles', 'POST', createForm)
      setShowCreate(false)
      setCreateForm({ name: '', description: '', permissions: emptyPerms(), node_types: [] })
      setCreateError('')
      load()
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : '创建失败')
    }
  }

  if (loading) return <div className="p-6 text-gray-500">加载中...</div>

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">角色权限</h1>
        <button
          data-testid="create-role-btn"
          onClick={() => { setShowCreate(true); setCreateError('') }}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          新建角色
        </button>
      </div>

      <div className="flex gap-6">
        {/* Role list */}
        <div data-testid="role-list" className="w-48 flex-shrink-0">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {roles.map(role => (
              <button
                key={role.id}
                data-testid={`role-item-${role.id}`}
                onClick={() => selectRole(role)}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-blue-50 transition-colors ${
                  selectedRole?.id === role.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                }`}
              >
                {role.name}
              </button>
            ))}
          </div>
        </div>

        {/* Permission matrix */}
        <div className="flex-1">
          {selectedRole ? (
            <div data-testid="role-detail" className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-lg font-semibold mb-4 text-gray-800">{selectedRole.name} — 权限配置</h2>

              <PermMatrix
                permissions={editPerms}
                onChange={setEditPerms}
              />

              {/* Node types */}
              <div data-testid="node-types-section" className="mt-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">可接收人工节点类型</h3>
                <div className="flex flex-wrap gap-3">
                  {NODE_TYPES.map(nt => (
                    <label key={nt.key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        data-testid={`node-type-${nt.key}`}
                        checked={editNodeTypes.includes(nt.key)}
                        onChange={() => toggleNodeType(nt.key)}
                      />
                      <span className="text-sm text-gray-600">{nt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <button
                  data-testid="save-role-btn"
                  onClick={handleSave}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  保存权限
                </button>
                {saveSuccess && (
                  <span data-testid="save-success" className="text-green-600 text-sm">保存成功</span>
                )}
                {saveError && (
                  <span className="text-red-500 text-sm">{saveError}</span>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">
              请从左侧选择一个角色查看权限配置
            </div>
          )}
        </div>
      </div>

      {/* Create dialog */}
      {showCreate && (
        <div data-testid="create-role-dialog" className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-[500px] max-h-[80vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">新建角色</h2>
            <div className="mb-3">
              <label className="block text-sm text-gray-600 mb-1">角色名称</label>
              <input
                data-testid="role-name-input"
                value={createForm.name}
                onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="请输入角色名称"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-1">描述</label>
              <input
                data-testid="role-desc-input"
                value={createForm.description}
                onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border rounded px-3 py-2 focus:outline-none"
                placeholder="可选"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-2">初始权限（任务查看）</label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  data-testid="create-perm-tasks-view"
                  checked={createForm.permissions?.tasks?.view ?? false}
                  onChange={e => setCreateForm(f => ({
                    ...f,
                    permissions: {
                      ...f.permissions,
                      tasks: { ...(f.permissions?.tasks || {}), view: e.target.checked },
                    },
                  }))}
                />
                <span className="text-sm text-gray-600">任务查看</span>
              </label>
            </div>
            {createError && <p className="text-red-500 text-sm mb-3">{createError}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">取消</button>
              <button
                data-testid="confirm-create-role-btn"
                onClick={handleCreate}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                确认创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
