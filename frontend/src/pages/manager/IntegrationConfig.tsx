import { useEffect, useState } from 'react'
import api from '../../hooks/useApi'

interface Integration {
  id: string
  name: string
  description: string
  connected: boolean
  config: Record<string, string>
}

export default function IntegrationConfig() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  // Feishu form
  const [feishuAppId, setFeishuAppId] = useState('')
  const [feishuSecret, setFeishuSecret] = useState('')
  const [feishuWebhook, setFeishuWebhook] = useState('')
  const [feishuTesting, setFeishuTesting] = useState(false)
  const [feishuResult, setFeishuResult] = useState<{ success: boolean; message: string } | null>(null)
  const [feishuSaved, setFeishuSaved] = useState(false)

  // ERP form
  const [erpUrl, setErpUrl] = useState('')
  const [erpKey, setErpKey] = useState('')
  const [erpSaving, setErpSaving] = useState(false)

  // Taobao form
  const [taobaoPlat, setTaobaoPlat] = useState('taobao')
  const [taobaoAppKey, setTaobaoAppKey] = useState('')
  const [taobaoSecret, setTaobaoSecret] = useState('')
  const [taobaoSaving, setTaobaoSaving] = useState(false)

  const load = async () => {
    try {
      const res = await api.get('/api/integrations')
      setIntegrations(res.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleFeishuTest = async () => {
    setFeishuTesting(true)
    setFeishuResult(null)
    try {
      const res = await api.post('/api/integrations/feishu/test', {
        app_id: feishuAppId,
        app_secret: feishuSecret,
      })
      setFeishuResult(res.data)
      load()
    } catch {
      setFeishuResult({ success: false, message: '连接请求失败' })
    } finally {
      setFeishuTesting(false)
    }
  }

  const handleFeishuSave = async () => {
    try {
      await api.post('/api/integrations/feishu/save', {
        app_id: feishuAppId,
        app_secret: feishuSecret,
        webhook_url: feishuWebhook,
      })
      setFeishuSaved(true)
      setTimeout(() => setFeishuSaved(false), 3000)
      load()
    } catch {
      // ignore
    }
  }

  const handleErpSave = async () => {
    setErpSaving(true)
    setSaveMsg(null)
    try {
      await api.post('/api/integrations/erp/save', { api_url: erpUrl, api_key: erpKey })
      setSaveMsg('ERP配置保存成功')
      load()
    } catch {
      setSaveMsg('保存失败')
    } finally {
      setErpSaving(false)
    }
  }

  const handleTaobaoSave = async () => {
    setTaobaoSaving(true)
    setSaveMsg(null)
    try {
      await api.post('/api/integrations/taobao/save', {
        platform: taobaoPlat,
        app_key: taobaoAppKey,
        app_secret: taobaoSecret,
      })
      setSaveMsg(`${taobaoPlat === 'taobao' ? '淘宝' : '天猫'}配置保存成功`)
      load()
    } catch {
      setSaveMsg('保存失败')
    } finally {
      setTaobaoSaving(false)
    }
  }

  const connectedBadge = (c: boolean) => c
    ? <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">已连接</span>
    : <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">未连接</span>

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6" data-testid="integrations-title">平台集成配置</h1>

      {saveMsg && (
        <div data-testid="save-success" className="mb-4 px-4 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm flex justify-between">
          <span>{saveMsg}</span>
          <button onClick={() => setSaveMsg(null)} className="text-green-500">✕</button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-gray-400">加载中…</div>
      ) : (
        <div className="space-y-6" data-testid="integration-list">
          {/* Status overview */}
          <div className="grid grid-cols-3 gap-4">
            {integrations.map(intg => (
              <div key={intg.id} data-testid={`intg-status-${intg.id}`} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-gray-700">{intg.name}</span>
                  {connectedBadge(intg.connected)}
                </div>
                <p className="text-xs text-gray-400">{intg.description}</p>
              </div>
            ))}
          </div>

          {/* Feishu config */}
          <div className="bg-white rounded-xl border border-gray-200 p-5" data-testid="feishu-section">
            <h2 className="text-base font-semibold text-gray-700 mb-4">飞书集成配置</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">App ID</label>
                <input
                  data-testid="feishu-app-id"
                  type="text"
                  value={feishuAppId}
                  onChange={e => setFeishuAppId(e.target.value)}
                  placeholder="cli_xxxxxxxxxxxxxxxx"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">App Secret</label>
                <input
                  data-testid="feishu-app-secret"
                  type="password"
                  value={feishuSecret}
                  onChange={e => setFeishuSecret(e.target.value)}
                  placeholder="App Secret"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">机器人 Webhook 地址</label>
                <input
                  data-testid="feishu-webhook"
                  type="text"
                  value={feishuWebhook}
                  onChange={e => setFeishuWebhook(e.target.value)}
                  placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div className="flex gap-2">
                <button
                  data-testid="feishu-test-btn"
                  onClick={handleFeishuTest}
                  disabled={feishuTesting}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {feishuTesting ? '测试中…' : '测试连接'}
                </button>
                <button
                  data-testid="feishu-save-btn"
                  onClick={handleFeishuSave}
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  保存配置
                </button>
              </div>
              {feishuResult && (
                <div
                  data-testid="feishu-result"
                  className={`px-3 py-2 rounded-lg text-sm ${feishuResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}
                >
                  {feishuResult.message}
                </div>
              )}
              {feishuSaved && (
                <div data-testid="feishu-save-success" className="px-3 py-2 rounded-lg text-sm bg-green-50 text-green-700">
                  飞书配置已保存
                </div>
              )}
            </div>
          </div>

          {/* ERP config */}
          <div className="bg-white rounded-xl border border-gray-200 p-5" data-testid="erp-section">
            <h2 className="text-base font-semibold text-gray-700 mb-4">ERP系统配置</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">API 基础URL</label>
                <input
                  data-testid="erp-api-url"
                  type="text"
                  value={erpUrl}
                  onChange={e => setErpUrl(e.target.value)}
                  placeholder="https://erp.example.com/api"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">API 密钥</label>
                <input
                  data-testid="erp-api-key"
                  type="password"
                  value={erpKey}
                  onChange={e => setErpKey(e.target.value)}
                  placeholder="API Key"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <button
                data-testid="erp-save-btn"
                onClick={handleErpSave}
                disabled={erpSaving}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {erpSaving ? '保存中…' : '保存配置'}
              </button>
            </div>
          </div>

          {/* Taobao config */}
          <div className="bg-white rounded-xl border border-gray-200 p-5" data-testid="taobao-section">
            <h2 className="text-base font-semibold text-gray-700 mb-4">电商平台配置</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">平台类型</label>
                <select
                  data-testid="taobao-platform-select"
                  value={taobaoPlat}
                  onChange={e => setTaobaoPlat(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                >
                  <option value="taobao">淘宝</option>
                  <option value="tmall">天猫</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">App Key</label>
                <input
                  data-testid="taobao-app-key"
                  type="text"
                  value={taobaoAppKey}
                  onChange={e => setTaobaoAppKey(e.target.value)}
                  placeholder="App Key"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">App Secret</label>
                <input
                  data-testid="taobao-app-secret"
                  type="password"
                  value={taobaoSecret}
                  onChange={e => setTaobaoSecret(e.target.value)}
                  placeholder="App Secret"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <button
                data-testid="taobao-save-btn"
                onClick={handleTaobaoSave}
                disabled={taobaoSaving}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {taobaoSaving ? '保存中…' : '保存配置'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
