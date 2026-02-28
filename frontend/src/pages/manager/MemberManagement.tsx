import { useState, useEffect } from 'react'

const API_URL = ''

interface Member {
  id: number
  username: string
  display_name: string
  email: string | null
  feishu_id: string | null
  role: string
  is_active: boolean
  department_id: number | null
  department_name: string | null
}

interface Department {
  id: number
  name: string
  parent_id: number | null
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

const ROLE_LABELS: Record<string, string> = {
  admin: '管理员',
  manager: '经理',
  executor: '执行者',
}

export default function MemberManagement() {
  const [members, setMembers] = useState<Member[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [loading, setLoading] = useState(true)

  // Invite dialog
  const [showInvite, setShowInvite] = useState(false)
  const [inviteForm, setInviteForm] = useState({
    display_name: '',
    feishu_id: '',
    email: '',
    role: 'executor',
    department_id: '',
  })
  const [inviteSuccess, setInviteSuccess] = useState(false)
  const [inviteError, setInviteError] = useState('')

  // Edit dialog
  const [editMember, setEditMember] = useState<Member | null>(null)
  const [editRole, setEditRole] = useState('')
  const [editDeptId, setEditDeptId] = useState('')
  const [editSuccess, setEditSuccess] = useState(false)

  // Remove dialog
  const [removeMember, setRemoveMember] = useState<Member | null>(null)

  const load = (q = '', deptId = '') => {
    setLoading(true)
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (deptId) params.set('department_id', deptId)
    const qs = params.toString() ? `?${params.toString()}` : ''
    Promise.all([
      apiCall(`/api/members${qs}`),
      apiCall('/api/departments'),
    ]).then(([memberData, deptData]) => {
      setMembers(memberData)
      setDepartments(deptData.flat || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    load(e.target.value, deptFilter)
  }

  const handleDeptFilter = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDeptFilter(e.target.value)
    load(search, e.target.value)
  }

  const handleInvite = async () => {
    if (!inviteForm.display_name.trim()) { setInviteError('请输入姓名'); return }
    if (!inviteForm.feishu_id.trim() && !inviteForm.email.trim()) {
      setInviteError('请输入飞书ID或邮箱'); return
    }
    try {
      await apiCall('/api/members/invite', 'POST', {
        display_name: inviteForm.display_name.trim(),
        feishu_id: inviteForm.feishu_id.trim() || null,
        email: inviteForm.email.trim() || null,
        role: inviteForm.role,
        department_id: inviteForm.department_id ? Number(inviteForm.department_id) : null,
      })
      setInviteSuccess(true)
      setInviteError('')
      setTimeout(() => {
        setShowInvite(false)
        setInviteSuccess(false)
        setInviteForm({ display_name: '', feishu_id: '', email: '', role: 'executor', department_id: '' })
        load()
      }, 1500)
    } catch (e: unknown) {
      setInviteError(e instanceof Error ? e.message : '邀请失败')
    }
  }

  const openEdit = (m: Member) => {
    setEditMember(m)
    setEditRole(m.role)
    setEditDeptId(m.department_id ? String(m.department_id) : '')
    setEditSuccess(false)
  }

  const handleEdit = async () => {
    if (!editMember) return
    try {
      await apiCall(`/api/members/${editMember.id}`, 'PUT', {
        role: editRole,
        department_id: editDeptId ? Number(editDeptId) : null,
      })
      setEditSuccess(true)
      setTimeout(() => {
        setEditMember(null)
        load()
      }, 1000)
    } catch {
      // ignore
    }
  }

  const handleRemove = async () => {
    if (!removeMember) return
    try {
      await apiCall(`/api/members/${removeMember.id}`, 'DELETE')
      setRemoveMember(null)
      load()
    } catch {
      // ignore
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">成员管理</h1>
        <button
          data-testid="invite-btn"
          onClick={() => { setShowInvite(true); setInviteError(''); setInviteSuccess(false) }}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          邀请成员
        </button>
      </div>

      {/* Search & Filter */}
      <div className="mb-4 flex gap-3 flex-wrap">
        <input
          data-testid="member-search"
          value={search}
          onChange={handleSearch}
          placeholder="搜索姓名、用户名或飞书ID..."
          className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 w-72"
        />
        <select
          data-testid="dept-filter"
          value={deptFilter}
          onChange={handleDeptFilter}
          className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">全部部门</option>
          {departments.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      {/* Member list */}
      <div data-testid="member-list" className="bg-white rounded-lg border border-gray-200">
        {loading ? (
          <div className="p-8 text-center text-gray-400">加载中...</div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center text-gray-400">暂无成员</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 text-gray-600 font-medium border-b">姓名</th>
                <th className="px-4 py-3 text-gray-600 font-medium border-b">用户名</th>
                <th className="px-4 py-3 text-gray-600 font-medium border-b">角色</th>
                <th className="px-4 py-3 text-gray-600 font-medium border-b">部门</th>
                <th className="px-4 py-3 text-gray-600 font-medium border-b">操作</th>
              </tr>
            </thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id} data-testid={`member-row-${m.id}`} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    <div className="flex items-center gap-2">
                      <div
                        data-testid={`member-avatar-${m.id}`}
                        className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold flex-shrink-0"
                      >
                        {(m.display_name || m.username).charAt(0).toUpperCase()}
                      </div>
                      <span>
                        {m.display_name}
                        {m.feishu_id && <span className="text-xs text-gray-400 ml-1">({m.feishu_id})</span>}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{m.username}</td>
                  <td className="px-4 py-3">
                    <span data-testid={`member-role-${m.id}`} className={`px-2 py-1 rounded text-xs font-medium ${
                      m.role === 'manager' ? 'bg-purple-100 text-purple-700'
                      : m.role === 'admin' ? 'bg-red-100 text-red-700'
                      : 'bg-blue-100 text-blue-700'
                    }`}>
                      {ROLE_LABELS[m.role] || m.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{m.department_name || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        data-testid={`edit-member-${m.id}`}
                        onClick={() => openEdit(m)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        编辑
                      </button>
                      <button
                        data-testid={`remove-member-${m.id}`}
                        onClick={() => setRemoveMember(m)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        移除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Invite dialog */}
      {showInvite && (
        <div data-testid="invite-dialog" className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-[420px]">
            <h2 className="text-lg font-semibold mb-4">邀请成员</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">姓名 *</label>
                <input
                  data-testid="invite-name-input"
                  value={inviteForm.display_name}
                  onChange={e => setInviteForm(f => ({ ...f, display_name: e.target.value }))}
                  className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入姓名"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">飞书ID</label>
                <input
                  data-testid="invite-feishu-input"
                  value={inviteForm.feishu_id}
                  onChange={e => setInviteForm(f => ({ ...f, feishu_id: e.target.value }))}
                  className="w-full border rounded px-3 py-2 focus:outline-none"
                  placeholder="飞书用户ID"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">邮箱</label>
                <input
                  data-testid="invite-email-input"
                  value={inviteForm.email}
                  onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full border rounded px-3 py-2 focus:outline-none"
                  placeholder="邮箱地址"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">初始角色</label>
                <select
                  data-testid="invite-role-select"
                  value={inviteForm.role}
                  onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full border rounded px-3 py-2 focus:outline-none"
                >
                  <option value="executor">执行者</option>
                  <option value="manager">经理</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">所属部门</label>
                <select
                  data-testid="invite-dept-select"
                  value={inviteForm.department_id}
                  onChange={e => setInviteForm(f => ({ ...f, department_id: e.target.value }))}
                  className="w-full border rounded px-3 py-2 focus:outline-none"
                >
                  <option value="">— 不指定</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>
            {inviteError && <p className="text-red-500 text-sm mt-2">{inviteError}</p>}
            {inviteSuccess && (
              <p data-testid="invite-success" className="text-green-600 text-sm mt-2">邀请成功！</p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowInvite(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">取消</button>
              <button
                data-testid="confirm-invite-btn"
                onClick={handleInvite}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                发送邀请
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit dialog */}
      {editMember && (
        <div data-testid="edit-member-dialog" className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-[380px]">
            <h2 className="text-lg font-semibold mb-4">编辑成员：{editMember.display_name}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">角色</label>
                <select
                  data-testid="edit-role-select"
                  value={editRole}
                  onChange={e => setEditRole(e.target.value)}
                  className="w-full border rounded px-3 py-2 focus:outline-none"
                >
                  <option value="executor">执行者</option>
                  <option value="manager">经理</option>
                  <option value="admin">管理员</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">所属部门</label>
                <select
                  data-testid="edit-dept-select"
                  value={editDeptId}
                  onChange={e => setEditDeptId(e.target.value)}
                  className="w-full border rounded px-3 py-2 focus:outline-none"
                >
                  <option value="">— 不指定</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>
            {editSuccess && (
              <p data-testid="edit-success" className="text-green-600 text-sm mt-2">已保存</p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEditMember(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">取消</button>
              <button
                data-testid="confirm-edit-member-btn"
                onClick={handleEdit}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove dialog */}
      {removeMember && (
        <div data-testid="remove-dialog" className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-80">
            <h2 className="text-lg font-semibold mb-3">确认移除</h2>
            <p className="text-gray-600 mb-4">确定将「{removeMember.display_name}」移出组织？</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setRemoveMember(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">取消</button>
              <button
                data-testid="confirm-remove-btn"
                onClick={handleRemove}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                确认移除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
