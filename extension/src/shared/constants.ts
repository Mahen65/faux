/** CSS selector matching all standard interactive elements */
export const INTERACTIVE_SELECTOR = [
  'input:not([type="hidden"])',
  'textarea',
  'select',
  'button',
  '[role="button"]',
  '[role="textbox"]',
  '[role="combobox"]',
  '[role="listbox"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[contenteditable="true"]',
].join(', ');

/** Backend API base URL */
export const API_BASE_URL = 'http://localhost:8888/api/v1';

/** Timeout for backend API requests (ms) */
export const API_TIMEOUT = 15000;

/** Provider metadata for the settings UI */
export const PROVIDER_INFO = {
  anthropic: {
    label: 'Anthropic (Claude)',
    defaultModel: 'claude-haiku-4-5',
    models: ['claude-haiku-4-5', 'claude-sonnet-4-6', 'claude-opus-4-6'],
    requiresKey: true,
  },
  openai: {
    label: 'OpenAI (GPT)',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-nano'],
    requiresKey: true,
  },
  gemini: {
    label: 'Google Gemini',
    defaultModel: 'gemini-2.0-flash',
    models: ['gemini-2.0-flash', 'gemini-2.5-pro'],
    requiresKey: true,
  },
  ollama: {
    label: 'Ollama (Local)',
    defaultModel: 'llama3.2',
    models: ['llama3.2', 'mistral', 'gemma2', 'phi3'],
    requiresKey: false,
  },
} as const;

/** Max wait time for SPA hydration (ms) */
export const SPA_WAIT_MAX = 5000;

/** Debounce time for MutationObserver (ms) */
export const MUTATION_DEBOUNCE = 1500;
