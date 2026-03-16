import type { FieldDescriptor, FieldType, ClassifiedField } from '@shared/types';

/** Static dummy values for each field type (used in offline/MVP mode) */
const DUMMY_VALUES: Record<FieldType, string> = {
  first_name: 'John',
  last_name: 'Doe',
  full_name: 'John Doe',
  email: 'john.doe@example.com',
  phone: '(555) 123-4567',
  password: 'P@ssw0rd!2024',
  username: 'johndoe42',
  street_address: '123 Main Street',
  city: 'Springfield',
  state: 'Illinois',
  zip_code: '62704',
  country: 'United States',
  date_of_birth: '1990-05-15',
  date: '2024-01-15',
  company: 'Acme Corporation',
  job_title: 'Software Engineer',
  url: 'https://example.com',
  number: '42',
  credit_card: '4111111111111111',
  cvv: '123',
  expiry: '12/28',
  message: 'This is a test message for form validation purposes.',
  comment: 'Test comment.',
  textarea: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
  checkbox: 'true',
  radio: 'true',
  select: '',
  search: 'test query',
  identifier: 'ID-20240042',
  measurement: '25',
  unknown: 'test data',
};

/** Pattern rules: [regex, fieldType, weight] */
type PatternRule = [RegExp, FieldType, number];

/** Classification patterns matched against various field signals */
const PATTERNS: PatternRule[] = [
  // Email
  [/^email$/i, 'email', 1.0],
  [/e[-_]?mail/i, 'email', 0.9],
  [/\bmail\b/i, 'email', 0.7],

  // Phone
  [/^tel$/i, 'phone', 1.0],
  [/phone|mobile|cell|telephone/i, 'phone', 0.9],
  [/\btel\b/i, 'phone', 0.8],

  // Password
  [/^password$/i, 'password', 1.0],
  [/pass[-_]?w(or)?d|pwd/i, 'password', 0.9],
  [/confirm[-_]?pass/i, 'password', 0.9],

  // First name
  [/^given[-_]?name$/i, 'first_name', 1.0],
  [/first[-_]?name|fname|given/i, 'first_name', 0.9],

  // Last name
  [/^family[-_]?name$/i, 'last_name', 1.0],
  [/last[-_]?name|lname|surname|family/i, 'last_name', 0.9],

  // Full name
  [/full[-_]?name|your[-_]?name|display[-_]?name/i, 'full_name', 0.9],

  // Username
  [/user[-_]?name|login|handle|screen[-_]?name/i, 'username', 0.9],

  // Address
  [/street|address[-_]?(line)?[-_]?1|addr/i, 'street_address', 0.9],
  [/city|town|locality/i, 'city', 0.9],
  [/state|province|region/i, 'state', 0.9],
  [/zip|postal[-_]?code|postcode/i, 'zip_code', 0.9],
  [/country/i, 'country', 0.9],

  // Date
  [/date[-_]?of[-_]?birth|dob|birth[-_]?date|birthday/i, 'date_of_birth', 0.9],
  [/\bdate\b/i, 'date', 0.6],

  // Company / Job
  [/company|organization|org[-_]?name|employer/i, 'company', 0.9],
  [/job[-_]?title|position|role|occupation/i, 'job_title', 0.9],

  // URL
  [/\burl\b|website|homepage|web[-_]?address/i, 'url', 0.9],

  // Credit card
  [/card[-_]?number|cc[-_]?num|credit[-_]?card/i, 'credit_card', 0.9],
  [/\bcvv\b|cvc|security[-_]?code/i, 'cvv', 0.9],
  [/expir|exp[-_]?date|exp[-_]?month/i, 'expiry', 0.9],

  // Message / Comment
  [/message|comment|feedback|description|notes|bio|about/i, 'message', 0.7],

  // Search
  [/search|query|find|keyword/i, 'search', 0.8],

  // Number
  [/\bage\b|quantity|amount|count/i, 'number', 0.7],

  // Generic name (catches "Patient Name", "Client Name", "Member Name", etc.)
  [/\bname\b/i, 'full_name', 0.7],

  // Generic identifier (catches "Patient ID", "Employee ID", "Reference ID", etc.)
  [/\bid\b|identifier|ref[-_\s]?(?:no|number|num)?/i, 'identifier', 0.7],

  // Measurement / Audiogram (Hz values, dB values, test readings)
  [/\d+\s*(?:hz|khz)\s*(?:right|left|r\b|l\b)/i, 'measurement', 0.9],
  [/(?:right|left)\s*\d*\s*(?:hz|khz|db)/i, 'measurement', 0.9],
  [/\b\d+\s*(?:right|left)\b/i, 'measurement', 0.85],
  [/\b(?:hz|frequency|db|decibel|threshold|audiogram)\b/i, 'measurement', 0.8],
];

/** Autocomplete attribute -> field type (HTML standard) */
const AUTOCOMPLETE_MAP: Record<string, FieldType> = {
  'given-name': 'first_name',
  'family-name': 'last_name',
  'name': 'full_name',
  'email': 'email',
  'tel': 'phone',
  'street-address': 'street_address',
  'address-line1': 'street_address',
  'address-level2': 'city',
  'address-level1': 'state',
  'postal-code': 'zip_code',
  'country-name': 'country',
  'country': 'country',
  'bday': 'date_of_birth',
  'organization': 'company',
  'organization-title': 'job_title',
  'url': 'url',
  'username': 'username',
  'new-password': 'password',
  'current-password': 'password',
  'cc-number': 'credit_card',
  'cc-csc': 'cvv',
  'cc-exp': 'expiry',
};

/** Input type -> field type mapping */
const TYPE_MAP: Record<string, FieldType> = {
  'email': 'email',
  'tel': 'phone',
  'password': 'password',
  'url': 'url',
  'number': 'number',
  'date': 'date',
  'search': 'search',
  'checkbox': 'checkbox',
  'radio': 'radio',
};

interface ScoredMatch {
  fieldType: FieldType;
  confidence: number;
}

/** Classify a single field using weighted signal matching */
function classifyField(field: FieldDescriptor): ScoredMatch {
  // 1. Check autocomplete attribute (highest confidence)
  if (field.autocomplete && AUTOCOMPLETE_MAP[field.autocomplete]) {
    return { fieldType: AUTOCOMPLETE_MAP[field.autocomplete], confidence: 1.0 };
  }

  // 2. Check HTML input type
  if (field.type && TYPE_MAP[field.type]) {
    return { fieldType: TYPE_MAP[field.type], confidence: 1.0 };
  }

  // 3. Handle textarea
  if (field.tag === 'textarea') {
    // Try pattern matching on signals first for more specific classification
    const textareaMatch = matchPatterns(field);
    if (textareaMatch && textareaMatch.confidence > 0.7) return textareaMatch;
    return { fieldType: 'textarea', confidence: 0.8 };
  }

  // 4. Handle select
  if (field.tag === 'select') {
    const selectMatch = matchPatterns(field);
    if (selectMatch && selectMatch.confidence > 0.7) return selectMatch;
    return { fieldType: 'select', confidence: 0.8 };
  }

  // 5. Pattern matching against all signals
  const match = matchPatterns(field);
  if (match) return match;

  return { fieldType: 'unknown', confidence: 0.1 };
}

/** Run pattern rules against all available signals for a field */
function matchPatterns(field: FieldDescriptor): ScoredMatch | null {
  // Build signal string from all available context
  const signals: Array<{ text: string; weight: number }> = [];
  if (field.name) signals.push({ text: field.name, weight: 0.85 });
  if (field.labelText) signals.push({ text: field.labelText, weight: 0.9 });
  if (field.placeholder) signals.push({ text: field.placeholder, weight: 0.75 });
  if (field.ariaLabel) signals.push({ text: field.ariaLabel, weight: 0.85 });
  if (field.cssClasses.length) signals.push({ text: field.cssClasses.join(' '), weight: 0.5 });

  let bestMatch: ScoredMatch | null = null;

  for (const [regex, fieldType, patternWeight] of PATTERNS) {
    for (const signal of signals) {
      if (regex.test(signal.text)) {
        const confidence = patternWeight * signal.weight;
        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = { fieldType, confidence };
        }
      }
    }
  }

  return bestMatch;
}

/** Classify all fields and generate dummy values */
export function classifyAndGenerate(fields: FieldDescriptor[]): ClassifiedField[] {
  return fields.map(field => {
    const { fieldType, confidence } = classifyField(field);

    // For select elements, pick the second option (first is often a placeholder)
    let value = DUMMY_VALUES[fieldType];
    if (field.tag === 'select' && field.options && field.options.length > 1) {
      value = field.options[1];
    }

    return {
      fieldId: field.id,
      fieldType,
      confidence,
      generatedValue: value,
    };
  });
}
