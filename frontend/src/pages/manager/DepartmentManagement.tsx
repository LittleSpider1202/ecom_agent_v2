import { useState, useEffect } from 'react'

const API_URL = ''

interface DeptNode {
  id: number
  name: string
  parent_id: number | null
  member_count: number
  children: DeptNode[]
}

interface ApiResponse {
  tree: DeptNode[]
  flat: DeptNode[]
}

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

function DeptTreeNode({
  node,
  onEdit,
  onDelete,
  onAddChild,
}: {
  node: DeptNode
  onEdit: (n: DeptNode) => void
  onDelete: (n: DeptNode) => void
  onAddChild: (parentId: number) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const hasChildren = node.children && node.children.length > 0

  return (
    <div data-testid={`dept-node-${node.id}`} style={{ marginLeft: node.parent_id ? 24 : 0 }}>
      <div className="flex items-center gap-2 py-1 px-2 rounded hover:bg-gray-50">
        {hasChildren ? (
          <button
            data-testid={`toggle-${node.id}`}
            onClick={() => setCollapsed(!collapsed)}
            className="w-5 h-5 text-gray-400 hover:text-gray-600 flex items-center justify-center"
          >
            {collapsed ? '▶' : '▼'}
          </button>
        ) : (
          <span className="w-5 h-5 inline-block" />
        )}
        <span className="text-base" data-testid={`dept-icon-${node.id}`}>{node.parent_id ? '📂' : '🏢'}</span>
        <span className="text-gray-800 font-medium" data-testid={`dept-name-${node.id}`}>
          {node.name}
        </span>
        {node.member_count > 0 && (
          <span className="text-xs text-gray-400">({node.member_count}人)</span>
        )}
        <div className="flex items-center gap-1 ml-2">
          <button
            data-testid={`edit-btn-${node.id}`}
            onClick={() => onEdit(node)}
            className="text-xs text-blue-600 hover:underline px-1"
          >
            编辑
          </button>
          <button
            data-testid={`add-child-btn-${node.id}`}
            onClick={() => onAddChild(node.id)}
            className="text-xs text-green-600 hover:underline px-1"
          >
            +子部门
          </button>
          <button
            data-testid={`delete-btn-${node.id}`}
            onClick={() => onDelete(node)}
            className="text-xs text-red-500 hover:underline px-1"
          >
            删除
          </button>
        </div>
      </div>
      {!collapsed && hasChildren && (
        <div data-testid={`children-${node.id}`}>
          {node.children.map(child => (
            <DeptTreeNode
              key={child.id}
              node={child}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function DepartmentManagement() {
  const [tree, setTree] = useState<DeptNode[]>([])
  const [flat, setFlat] = useState<DeptNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Create dialog
  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createParentId, setCreateParentId] = useState<number | null>(null)
  const [createError, setCreateError] = useState('')

  // Edit dialog
  const [editNode, setEditNode] = useState<DeptNode | null>(null)
  const [editName, setEditName] = useState('')
  const [editError, setEditError] = useState('')

  // Delete dialog
  const [deleteNode, setDeleteNode] = useState<DeptNode | null>(null)
  const [deleteError, setDeleteError] = useState('')

  const load = () => {
    setLoading(true)
    apiCall('/api/departments')
      .then((data: ApiResponse) => {
        setTree(data.tree)
        setFlat(data.flat)
        setLoading(false)
      })
      .catch(e => {
        setError(e.message)
        setLoading(false)
      })
  }

  useEffect(() => { load() }, [])

  const openCreate = (parentId?: number) => {
    setCreateName('')
    setCreateParentId(parentId ?? null)
    setCreateError('')
    setShowCreate(true)
  }

  const handleCreate = async () => {
    if (!createName.trim()) { setCreateError('请输入部门名称'); return }
    try {
      await apiCall('/api/departments', 'POST', { name: createName.trim(), parent_id: createParentId })
      setShowCreate(false)
      load()
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : '创建失败')
    }
  }

  const openEdit = (node: DeptNode) => {
    setEditNode(node)
    setEditName(node.name)
    setEditError('')
  }

  const handleEdit = async () => {
    if (!editNode || !editName.trim()) { setEditError('请输入部门名称'); return }
    try {
      await apiCall(`/api/departments/${editNode.id}`, 'PUT', { name: editName.trim() })
      setEditNode(null)
      load()
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : '保存失败')
    }
  }

  const openDelete = (node: DeptNode) => {
    setDeleteNode(node)
    setDeleteError('')
  }

  const handleDelete = async () => {
    if (!deleteNode) return
    try {
      await apiCall(`/api/departments/${deleteNode.id}`, 'DELETE')
      setDeleteNode(null)
      load()
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : '删除失败')
    }
  }

  if (loading) return <div className="p-6 text-gray-500">加载中...</div>
  if (error) return <div className="p-6 text-red-500">{error}</div>

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">部门管理</h1>
        <button
          data-testid="create-dept-btn"
          onClick={() => openCreate()}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          新建部门
        </button>
      </div>

      <div data-testid="dept-tree" className="bg-white rounded-lg border border-gray-200 p-4">
        {tree.length === 0 ? (
          <div className="text-gray-400 text-center py-8">暂无部门数据</div>
        ) : (
          tree.map(node => (
            <DeptTreeNode
              key={node.id}
              node={node}
              onEdit={openEdit}
              onDelete={openDelete}
              onAddChild={openCreate}
            />
          ))
        )}
      </div>

      {/* Create dialog */}
      {showCreate && (
        <div data-testid="create-dialog" className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96">
            <h2 className="text-lg font-semibold mb-4">新建部门</h2>
            <div className="mb-3">
              <label className="block text-sm text-gray-600 mb-1">部门名称</label>
              <input
                data-testid="dept-name-input"
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="请输入部门名称"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-1">父级部门</label>
              <select
                data-testid="parent-dept-select"
                value={createParentId ?? ''}
                onChange={e => setCreateParentId(e.target.value ? Number(e.target.value) : null)}
                className="w-full border rounded px-3 py-2 focus:outline-none"
              >
                <option value="">— 无（顶级部门）</option>
                {flat.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            {createError && <p className="text-red-500 text-sm mb-3">{createError}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">取消</button>
              <button
                data-testid="confirm-create-btn"
                onClick={handleCreate}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                确认创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit dialog */}
      {editNode && (
        <div data-testid="edit-dialog" className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96">
            <h2 className="text-lg font-semibold mb-4">编辑部门</h2>
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-1">部门名称</label>
              <input
                data-testid="edit-name-input"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {editError && <p className="text-red-500 text-sm mb-3">{editError}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditNode(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">取消</button>
              <button
                data-testid="confirm-edit-btn"
                onClick={handleEdit}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete dialog */}
      {deleteNode && (
        <div data-testid="delete-dialog" className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96">
            <h2 className="text-lg font-semibold mb-3">确认删除</h2>
            <p className="text-gray-600 mb-4">确定删除部门「{deleteNode.name}」？此操作不可撤销。</p>
            {deleteError && (
              <p data-testid="delete-error" className="text-red-500 text-sm mb-3">{deleteError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteNode(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">取消</button>
              <button
                data-testid="confirm-delete-btn"
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
