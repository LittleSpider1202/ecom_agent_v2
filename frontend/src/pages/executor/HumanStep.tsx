import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../hooks/useApi'

interface Step {
  id: number
  task_id: number
  step_name: string
  background_info: string | null
  instructions: string | null
  ai_suggestion: string | null
  status: string
  final_content: string | null
  reject_reason: string | null
}

type DialogType = 'accept' | 'modify' | 'reject' | null

export default function HumanStep() {
  const { taskId, stepId } = useParams<{ taskId: string; stepId: string }>()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [suggestion, setSuggestion] = useState('')
  const [suggestionError, setSuggestionError] = useState('')

  const [dialog, setDialog] = useState<DialogType>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectReasonError, setRejectReasonError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    setLoading(true)
    api.get(`/api/tasks/${taskId}/steps/${stepId}`)
      .then((r) => {
        setStep(r.data)
        setSuggestion(r.data.ai_suggestion || '')
      })
      .catch((err) => {
        setError(err.response?.data?.detail || '加载步骤失败')
      })
      .finally(() => setLoading(false))
  }, [taskId, stepId])

  const handleAcceptAI = () => {
    setDialog('accept')
  }

  const handleModifySubmit = () => {
    if (!suggestion.trim()) {
      setSuggestionError('AI建议内容不能为空')
      return
    }
    setSuggestionError('')
    setDialog('modify')
  }

  const handleReject = () => {
    setRejectReason('')
    setRejectReasonError('')
    setDialog('reject')
  }

  const confirmSubmit = async (mode: 'accept' | 'modify') => {
    if (!step) return
    const content = mode === 'accept' ? (step.ai_suggestion || '') : suggestion
    setSubmitting(true)
    try {
      await api.post(`/api/tasks/${taskId}/steps/${step.id}/submit`, { content, mode })
      setDialog(null)
      setSuccessMessage('提交成功！')
      setTimeout(() => navigate('/executor/tasks'), 1500)
    } catch (err: any) {
      setError(err.response?.data?.detail || '提交失败，请重试')
      setDialog(null)
    } finally {
      setSubmitting(false)
    }
  }

  const confirmReject = async () => {
    if (!step) return
    if (!rejectReason.trim()) {
      setRejectReasonError('请填写驳回原因')
      return
    }
    setSubmitting(true)
    try {
      await api.post(`/api/tasks/${taskId}/steps/${step.id}/reject`, { reason: rejectReason })
      setDialog(null)
      setSuccessMessage('已驳回！')
      setTimeout(() => navigate('/executor/tasks'), 1500)
    } catch (err: any) {
      setError(err.response?.data?.detail || '驳回失败，请重试')
      setDialog(null)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">加载中...</div>
      </div>
    )
  }

  if (error && !step) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="text-blue-600 hover:underline text-sm"
          >
            返回上一页
          </button>
        </div>
      </div>
    )
  }

  if (successMessage) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">✅</div>
          <p
            className="text-green-600 font-semibold text-lg"
            data-testid="success-message"
          >
            {successMessage}
          </p>
          <p className="text-gray-400 text-sm mt-2">正在跳转至任务列表...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* 页面标题 */}
      <div className="mb-6">
        <p className="text-xs text-gray-400 mb-1">
          <span
            className="hover:underline cursor-pointer"
            onClick={() => navigate('/executor/tasks')}
          >
            任务列表
          </span>
          {' › '}人工操作步骤
        </p>
        <h1
          className="text-xl font-bold text-gray-900"
          data-testid="step-title"
        >
          {step?.step_name || '人工操作步骤'}
        </h1>
      </div>

      {/* 警告横幅 */}
      <div
        className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6 flex items-center gap-3"
        data-testid="warning-banner"
      >
        <span className="text-red-500 text-base font-bold flex-shrink-0">⚠️</span>
        <span className="text-red-700 font-semibold text-sm">
          提交后不可撤回，请仔细确认内容后再提交
        </span>
      </div>

      {/* 背景信息 */}
      <section
        className="bg-white rounded-xl border border-gray-200 p-5 mb-4"
        data-testid="background-section"
      >
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span className="w-1.5 h-4 bg-blue-500 rounded-full inline-block" />
          背景信息（机器已完成）
        </h2>
        <p
          className="text-sm text-gray-600 leading-relaxed whitespace-pre-line"
          data-testid="background-content"
        >
          {step?.background_info || '暂无背景信息'}
        </p>
      </section>

      {/* 操作说明 */}
      <section
        className="bg-white rounded-xl border border-gray-200 p-5 mb-4"
        data-testid="instructions-section"
      >
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span className="w-1.5 h-4 bg-yellow-500 rounded-full inline-block" />
          需要您完成
        </h2>
        <p
          className="text-sm text-gray-600 leading-relaxed whitespace-pre-line"
          data-testid="instructions-content"
        >
          {step?.instructions || '暂无操作说明'}
        </p>
      </section>

      {/* AI建议（可修改） */}
      <section
        className="bg-white rounded-xl border border-gray-200 p-5 mb-6"
        data-testid="ai-suggestion-section"
      >
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span className="w-1.5 h-4 bg-purple-500 rounded-full inline-block" />
          AI建议
          <span className="text-xs text-gray-400 font-normal">(可修改)</span>
        </h2>
        <textarea
          value={suggestion}
          onChange={(e) => {
            setSuggestion(e.target.value)
            if (e.target.value.trim()) setSuggestionError('')
          }}
          data-testid="ai-suggestion-textarea"
          rows={8}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        />
        {suggestionError && (
          <p className="text-red-500 text-xs mt-1" data-testid="suggestion-error">
            {suggestionError}
          </p>
        )}
      </section>

      {/* 操作按钮 */}
      {/* 一键采纳 — quick approve without modification */}
      <div className="mb-3">
        <button
          onClick={handleAcceptAI}
          data-testid="quick-approve-btn"
          className="w-full px-6 py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
        >
          <span>✓</span>
          一键采纳
        </button>
      </div>

      <div
        className="flex flex-col sm:flex-row gap-3"
        data-testid="action-buttons"
      >
        <button
          onClick={handleReject}
          data-testid="reject-button"
          className="px-6 py-2.5 border border-red-300 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors"
        >
          驳回
        </button>
        <div className="flex-1 flex gap-3 sm:justify-end">
          <button
            onClick={handleModifySubmit}
            data-testid="modify-submit-button"
            className="flex-1 sm:flex-none px-6 py-2.5 border border-blue-300 text-blue-600 rounded-xl text-sm font-medium hover:bg-blue-50 transition-colors"
          >
            修改后提交
          </button>
          <button
            onClick={handleAcceptAI}
            data-testid="accept-ai-button"
            className="flex-1 sm:flex-none px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            全部采纳AI建议
          </button>
        </div>
      </div>

      {/* 确认采纳对话框 */}
      {dialog === 'accept' && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          data-testid="confirm-dialog"
        >
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-base font-semibold text-gray-900 mb-2">
              确认全部采纳AI建议？
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              提交后不可撤回，将以AI建议原文作为最终内容提交。
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDialog(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={() => confirmSubmit('accept')}
                disabled={submitting}
                data-testid="confirm-submit-button"
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? '提交中...' : '确认提交'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 确认修改提交对话框 */}
      {dialog === 'modify' && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          data-testid="confirm-dialog"
        >
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-base font-semibold text-gray-900 mb-2">
              确认提交修改内容？
            </h3>
            <p className="text-sm text-gray-500 mb-3">
              将以您修改后的内容作为最终提交，提交后不可撤回。
            </p>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 max-h-28 overflow-y-auto">
              <p className="text-xs text-gray-600 whitespace-pre-line">{suggestion}</p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDialog(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={() => confirmSubmit('modify')}
                disabled={submitting}
                data-testid="confirm-submit-button"
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? '提交中...' : '确认提交'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 驳回对话框 */}
      {dialog === 'reject' && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          data-testid="reject-dialog"
        >
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-base font-semibold text-gray-900 mb-2">
              驳回此步骤
            </h3>
            <p className="text-sm text-gray-500 mb-3">
              请说明驳回原因，驳回后流程将暂停等待管理员处理。
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => {
                setRejectReason(e.target.value)
                if (e.target.value.trim()) setRejectReasonError('')
              }}
              data-testid="reject-reason-input"
              placeholder="请输入驳回原因..."
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
            {rejectReasonError && (
              <p className="text-red-500 text-xs mt-1" data-testid="reject-reason-error">
                {rejectReasonError}
              </p>
            )}
            <div className="flex gap-3 justify-end mt-4">
              <button
                onClick={() => setDialog(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={confirmReject}
                disabled={submitting}
                data-testid="confirm-reject-button"
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {submitting ? '提交中...' : '确认驳回'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
