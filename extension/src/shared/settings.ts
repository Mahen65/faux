import type { FauxSettings, LLMProvider, ProviderConfig } from './types';

const SETTINGS_KEY = 'faux_settings';

const DEFAULT_PROVIDERS: Record<LLMProvider, ProviderConfig> = {
  anthropic: { apiKey: '', model: 'claude-haiku-4-5' },
  openai: { apiKey: '', model: 'gpt-4o-mini' },
  gemini: { apiKey: '', model: 'gemini-2.0-flash' },
  ollama: { apiKey: '', model: 'llama3.2', baseUrl: 'http://localhost:11434' },
};

function generateId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getDefaults(): FauxSettings {
  return {
    activeProvider: 'anthropic',
    providers: { ...DEFAULT_PROVIDERS },
    activeProfileId: null,
    profiles: [],
    instanceId: generateId(),
  };
}

export async function getSettings(): Promise<FauxSettings> {
  try {
    const data = await chrome.storage.local.get(SETTINGS_KEY);
    const saved = data?.[SETTINGS_KEY] as Partial<FauxSettings> | undefined;
    if (!saved) return getDefaults();

    // Merge with defaults to handle missing fields from older versions
    const defaults = getDefaults();
    return {
      ...defaults,
      ...saved,
      providers: {
        ...defaults.providers,
        ...(saved.providers ?? {}),
      },
      instanceId: saved.instanceId || defaults.instanceId,
    };
  } catch {
    return getDefaults();
  }
}

export async function saveSettings(settings: FauxSettings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

export async function getInstanceId(): Promise<string> {
  const settings = await getSettings();
  return settings.instanceId;
}
