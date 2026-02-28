import { useState, FormEvent, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({})
  const [loading, setLoading] = useState(false)

  const from = (location.state as { from?: string })?.from || '/executor/dashboard'

  useEffect(() => {
    if (user) {
      navigate(from, { replace: true })
    }
  }, [user, from, navigate])

  if (user) return null

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    // Inline field validation
    const errs: { username?: string; password?: string } = {}
    if (!username.trim()) errs.username = '请输入用户名'
    if (!password.trim()) errs.password = '请输入密码'
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return }
    setFieldErrors({})
    setLoading(true)
    try {
      await login(username, password)
      navigate(from, { replace: true })
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        '登录失败，请重试'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">电商智能运营平台</h1>
          <p className="text-gray-500 text-sm mt-1">v2 · 人机混合执行</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
            <input
              data-testid="username-input"
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setFieldErrors(prev => ({ ...prev, username: undefined })) }}
              placeholder="请输入用户名"
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.username ? 'border-red-400' : 'border-gray-300'}`}
            />
            {fieldErrors.username && (
              <p data-testid="username-error" className="mt-1 text-xs text-red-500">{fieldErrors.username}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
            <input
              data-testid="password-input"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setFieldErrors(prev => ({ ...prev, password: undefined })) }}
              placeholder="请输入密码"
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.password ? 'border-red-400' : 'border-gray-300'}`}
            />
            {fieldErrors.password && (
              <p data-testid="password-error" className="mt-1 text-xs text-red-500">{fieldErrors.password}</p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-6">
          默认账号：admin / admin123
        </p>
      </div>
    </div>
  )
}
