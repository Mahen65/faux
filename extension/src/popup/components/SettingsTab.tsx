import { useState, useEffect } from 'preact/hooks';
import type { FauxSettings, LLMProvider } from '@shared/types';
import { getSettings, saveSettings } from '@shared/settings';
import { PROVIDER_INFO, API_BASE_URL } from '@shared/constants';

const PROVIDERS = Object.keys(PROVIDER_INFO) as LLMProvider[];

export function SettingsTab() {
  const [settings, setSettings] = useState<FauxSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  if (!settings) return null;

  const activeInfo = PROVIDER_INFO[settings.activeProvider];
  const activeConfig = settings.providers[settings.activeProvider];

  function updateProvider(provider: LLMProvider) {
    setSettings(s => s ? { ...s, activeProvider: provider } : s);
    setTestResult(null);
  }

  function updateApiKey(key: string) {
    setSettings(s => {
      if (!s) return s;
      return {
        ...s,
        providers: {
          ...s.providers,
          [s.activeProvider]: { ...s.providers[s.activeProvider], apiKey: key },
        },
      };
    });
  }

  function updateModel(model: string) {
    setSettings(s => {
      if (!s) return s;
      return {
        ...s,
        providers: {
          ...s.providers,
          [s.activeProvider]: { ...s.providers[s.activeProvider], model },
        },
      };
    });
  }

  function updateOllamaUrl(url: string) {
    setSettings(s => {
      if (!s) return s;
      return {
        ...s,
        providers: {
          ...s.providers,
          ollama: { ...s.providers.ollama, baseUrl: url },
        },
      };
    });
  }

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    await saveSettings(settings);
    setSaving(false);
  }

  async function handleTest() {
    if (!settings) return;
    setTesting(true);
    setTestResult(null);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-LLM-Provider': settings.activeProvider,
      };
      if (activeConfig.apiKey) headers['X-LLM-Api-Key'] = activeConfig.apiKey;
      if (activeConfig.model) headers['X-LLM-Model'] = activeConfig.model;

      const res = await fetch(`${API_BASE_URL}/providers/test`, {
        method: 'POST',
        headers,
      });
      const data = await res.json();
      setTestResult({ ok: data.success, msg: data.message });
    } catch (e) {
      setTestResult({ ok: false, msg: 'Backend not reachable' });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div class="settings-tab">
      <div class="settings-section">
        <div class="settings-label">LLM Provider</div>
        <div class="provider-list">
          {PROVIDERS.map(p => (
            <label class={`provider-option ${settings.activeProvider === p ? 'active' : ''}`} key={p}>
              <input
                type="radio"
                name="provider"
                checked={settings.activeProvider === p}
                onChange={() => updateProvider(p)}
              />
              <span>{PROVIDER_INFO[p].label}</span>
            </label>
          ))}
        </div>
      </div>

      {activeInfo.requiresKey && (
        <div class="settings-section">
          <div class="settings-label">API Key</div>
          <div class="key-input-row">
            <input
              type={showKey ? 'text' : 'password'}
              class="settings-input"
              value={activeConfig.apiKey}
              onInput={(e) => updateApiKey((e.target as HTMLInputElement).value)}
              placeholder={`Enter ${activeInfo.label} API key`}
            />
            <button class="key-toggle" onClick={() => setShowKey(!showKey)}>
              {showKey ? '🙈' : '👁️'}
            </button>
          </div>
        </div>
      )}

      <div class="settings-section">
        <div class="settings-label">Model</div>
        <select
          class="settings-select"
          value={activeConfig.model}
          onChange={(e) => updateModel((e.target as HTMLSelectElement).value)}
        >
          {activeInfo.models.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {settings.activeProvider === 'ollama' && (
        <div class="settings-section">
          <div class="settings-label">Ollama URL</div>
          <input
            type="text"
            class="settings-input"
            value={settings.providers.ollama.baseUrl || 'http://localhost:11434'}
            onInput={(e) => updateOllamaUrl((e.target as HTMLInputElement).value)}
          />
        </div>
      )}

      <div class="settings-actions">
        <button class="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
        <button class="btn btn-secondary" onClick={handleTest} disabled={testing}>
          {testing ? 'Testing...' : 'Test Connection'}
        </button>
      </div>

      {testResult && (
        <div class={`test-result ${testResult.ok ? 'success' : 'error'}`}>
          {testResult.ok ? '✓' : '✗'} {testResult.msg}
        </div>
      )}

      <div class="settings-section" style={{ marginTop: 12, fontSize: 11, color: '#999' }}>
        Instance ID: {settings.instanceId.slice(0, 8)}...
      </div>
    </div>
  );
}
