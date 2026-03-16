/** Describes a detected interactive element on the page */
export interface FieldDescriptor {
  id: string;
  tag: string;
  type: string | null;
  name: string | null;
  placeholder: string | null;
  labelText: string | null;
  ariaLabel: string | null;
  autocomplete: string | null;
  cssClasses: string[];
  parentFormId: string | null;
  options: string[] | null;
  validationPattern: string | null;
  minLength: number | null;
  maxLength: number | null;
  required: boolean;
  visible: boolean;
  rect: { top: number; left: number; width: number; height: number };
}

/** Result of classifying a field */
export interface ClassifiedField {
  fieldId: string;
  fieldType: FieldType;
  confidence: number;
  generatedValue: string;
}

/** Supported field types for classification */
export type FieldType =
  | 'first_name' | 'last_name' | 'full_name'
  | 'email' | 'phone' | 'password' | 'username'
  | 'street_address' | 'city' | 'state' | 'zip_code' | 'country'
  | 'date_of_birth' | 'date'
  | 'company' | 'job_title'
  | 'url' | 'number'
  | 'credit_card' | 'cvv' | 'expiry'
  | 'message' | 'comment' | 'textarea'
  | 'checkbox' | 'radio' | 'select'
  | 'search' | 'identifier' | 'measurement'
  | 'unknown';

/** A logical section of the page containing related fields */
export interface FormSection {
  id: string;
  name: string;
  fieldIds: string[];
}

/** Page analysis result sent from content script */
export interface PageAnalysisResult {
  url: string;
  title: string;
  fields: FieldDescriptor[];
  sections: FormSection[];
  formCount: number;
  timestamp: string;
}

/** Supported LLM providers */
export type LLMProvider = 'anthropic' | 'openai' | 'gemini' | 'ollama';

/** Configuration for a single LLM provider */
export interface ProviderConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;  // For Ollama custom URL
}

/** A user profile / test persona */
export interface UserProfile {
  id: string;
  name: string;
  description: string;  // Persona prompt appended to LLM system prompt
  isDefault: boolean;
}

/** All Faux settings stored in chrome.storage.local */
export interface FauxSettings {
  activeProvider: LLMProvider;
  providers: Record<LLMProvider, ProviderConfig>;
  activeProfileId: string | null;
  profiles: UserProfile[];
  instanceId: string;
}

/** Usage stats for a single provider */
export interface ProviderUsage {
  provider: string;
  total_calls: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost: number;
}

/** Aggregated usage summary from backend */
export interface UsageSummaryData {
  total_calls: number;
  total_tokens: number;
  total_cost: number;
  today_calls: number;
  by_provider: ProviderUsage[];
}

/** Fill result sent back after auto-fill */
export interface FillResult {
  filled: number;
  skipped: number;
  errors: number;
  details: Array<{ fieldId: string; success: boolean; error?: string }>;
}
