import { discoverElements, countForms, detectSections } from './analyzer/discovery';
import { classifyAndGenerate } from './analyzer/classifier';
import { fillAll } from './filler/value-injector';
import type { FauxMessage, AnalysisResponse } from '@shared/messages';
import type { ClassifiedField, FieldDescriptor } from '@shared/types';
import { API_BASE_URL, API_TIMEOUT } from '@shared/constants';
import { getSettings } from '@shared/settings';

/** Cached page data from last scan */
let cachedFields: FieldDescriptor[] = [];
let cachedSections: ReturnType<typeof detectSections> = [];
let lastClassified: ClassifiedField[] = [];

/** Map fields to backend schema with surrounding text context */
function toBackendFields(fields: FieldDescriptor[]) {
  return fields.map(f => {
    const el = document.querySelector(`[data-faux-id="${f.id}"]`);
    let context: string | null = null;
    if (el) {
      const container = el.closest('section, .panel, .card, [role="main"], form, fieldset, [class*="chat-panel"], [class*="conversation"]')
        || el.parentElement?.parentElement?.parentElement;
      if (container) {
        const texts: string[] = [];
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
          acceptNode: (node) => {
            const parent = node.parentElement;
            if (!parent || parent.closest('input, textarea, select, script, style, button')) return NodeFilter.FILTER_REJECT;
            const text = node.textContent?.trim();
            return text && text.length > 2 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
          }
        });
        let node: Node | null;
        while ((node = walker.nextNode())) {
          texts.push(node.textContent?.trim() || '');
        }
        if (texts.length > 0) {
          const fullText = texts.join(' ');
          context = fullText.length > 500 ? fullText.slice(-500) : fullText;
        }
      }
    }

    return {
      id: f.id,
      tag: f.tag,
      type: f.type,
      name: f.name,
      placeholder: f.placeholder,
      label_text: f.labelText,
      aria_label: f.ariaLabel,
      autocomplete: f.autocomplete,
      css_classes: f.cssClasses,
      parent_form_id: f.parentFormId,
      options: f.options,
      validation_pattern: f.validationPattern,
      min_length: f.minLength,
      max_length: f.maxLength,
      required: f.required,
      ...(context ? { surrounding_text: context } : {}),
    };
  });
}

/** Call backend LLM to generate values for fields */
async function generateViaBackend(fields: FieldDescriptor[]): Promise<ClassifiedField[] | null> {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), API_TIMEOUT);

    const settings = await getSettings();
    const providerConfig = settings.providers[settings.activeProvider];
    console.log('[Faux] Provider:', settings.activeProvider, 'Key set:', !!providerConfig.apiKey, 'Model:', providerConfig.model);

    // Build request headers with provider info
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-LLM-Provider': settings.activeProvider,
      'X-Instance-Id': settings.instanceId,
    };
    if (providerConfig.apiKey) {
      headers['X-LLM-Api-Key'] = providerConfig.apiKey;
    }
    if (providerConfig.model) {
      headers['X-LLM-Model'] = providerConfig.model;
    }

    // Build request body with optional persona
    const activeProfile = settings.profiles.find(p => p.id === settings.activeProfileId);
    const body: any = { fields: toBackendFields(fields) };
    if (activeProfile?.description) {
      body.persona = activeProfile.description;
    }

    const res = await fetch(`${API_BASE_URL}/generate-data`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      const detail = errorData?.detail || `HTTP ${res.status}`;
      throw new Error(detail);
    }

    const data = await res.json();
    return (data.results as any[]).map(r => ({
      fieldId: r.field_id,
      fieldType: r.field_type,
      confidence: r.confidence,
      generatedValue: r.generated_value,
    })) as ClassifiedField[];
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Backend unavailable';
    console.warn('[Faux] Generation failed:', message);
    throw err;
  }
}

/** Filter fields by section IDs */
function filterBySection(fields: FieldDescriptor[], sections: ReturnType<typeof detectSections>, sectionIds: string[]): FieldDescriptor[] {
  const allowedIds = new Set(
    sections
      .filter(s => sectionIds.includes(s.id))
      .flatMap(s => s.fieldIds)
  );
  return fields.filter(f => allowedIds.has(f.id));
}

/** Find a submit-like button within a container */
function findSubmitButton(container: Element): HTMLElement | null {
  // Priority 1: <input type="submit"> or <button type="submit">
  const submitInput = container.querySelector<HTMLElement>('input[type="submit"], button[type="submit"]');
  if (submitInput) return submitInput;

  // Priority 2: buttons with submit-like text
  const buttons = container.querySelectorAll<HTMLElement>('button, [role="button"], input[type="button"]');
  const submitWords = /submit|send|save|confirm|start|next|continue|go|post|reply|apply/i;

  for (const btn of buttons) {
    const text = (btn.textContent?.trim() || btn.getAttribute('value') || '').toLowerCase();
    if (submitWords.test(text)) return btn;
  }

  // Priority 3: last button in the container (often the primary action)
  if (buttons.length > 0) return buttons[buttons.length - 1];

  return null;
}

/** Report submitted form data to backend for RAG storage (fire-and-forget) */
function reportSubmission(classified: ClassifiedField[]) {
  getSettings().then(settings => {
    const fields = classified.map(c => {
      const el = document.querySelector(`[data-faux-id="${c.fieldId}"]`) as HTMLInputElement | HTMLTextAreaElement | null;
      const currentValue = el?.value ?? (el as HTMLElement)?.textContent ?? c.generatedValue;

      // Try to find the label for this field
      let label: string | null = null;
      if (el) {
        const id = el.getAttribute('id');
        if (id) {
          const labelEl = document.querySelector(`label[for="${CSS.escape(id)}"]`);
          if (labelEl) label = labelEl.textContent?.trim() || null;
        }
      }

      return {
        field_id: c.fieldId,
        label,
        field_type: c.fieldType,
        generated_value: c.generatedValue,
        submitted_value: currentValue,
      };
    });

    fetch(`${API_BASE_URL}/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Instance-Id': settings.instanceId,
      },
      body: JSON.stringify({
        url: window.location.href,
        page_title: document.title,
        fields,
      }),
    }).catch(() => {}); // Fire and forget
  });
}

/** Handle messages from the background service worker */
chrome.runtime.onMessage.addListener(
  (message: FauxMessage, _sender, sendResponse) => {
    switch (message.type) {
      case 'ANALYZE_PAGE': {
        // Pure DOM scraping — no LLM call
        const fields = discoverElements();
        const sections = detectSections(fields);
        cachedFields = fields;
        cachedSections = sections;

        const payload: AnalysisResponse = {
          url: window.location.href,
          title: document.title,
          fields,
          sections,
          classified: [],
          formCount: countForms(),
          timestamp: new Date().toISOString(),
        };

        sendResponse({ type: 'PAGE_ANALYSIS_RESULT', payload } satisfies FauxMessage);
        break;
      }

      case 'GENERATE_VALUES': {
        const sectionIds: string[] = (message as any).sectionIds ?? [];
        const fields = cachedFields.length > 0 ? cachedFields : discoverElements();
        const sections = cachedSections.length > 0 ? cachedSections : detectSections(fields);

        const fieldsToGenerate = sectionIds.length > 0
          ? filterBySection(fields, sections, sectionIds)
          : fields;

        // Call LLM, fall back to local classifier
        generateViaBackend(fieldsToGenerate).then(results => {
          lastClassified = results ?? classifyAndGenerate(fieldsToGenerate);
          sendResponse({ type: 'GENERATE_RESULT', payload: lastClassified } satisfies FauxMessage);
        }).catch(() => {
          lastClassified = classifyAndGenerate(fieldsToGenerate);
          sendResponse({ type: 'GENERATE_RESULT', payload: lastClassified } satisfies FauxMessage);
        });
        break;
      }

      case 'FILL_FORM': {
        const fieldsToFill = message.payload;
        const result = fillAll(fieldsToFill);
        sendResponse({ type: 'FILL_RESULT', payload: result } satisfies FauxMessage);
        break;
      }

      case 'SUBMIT_FORM': {
        const sectionIds: string[] = (message as any).sectionIds ?? [];
        const sections = cachedSections.length > 0 ? cachedSections : detectSections(cachedFields);

        // Find submit buttons within the selected sections' containers
        let button: HTMLElement | null = null;

        if (sectionIds.length > 0) {
          // Look for buttons near the selected sections' fields
          const fieldIds = sections
            .filter(s => sectionIds.includes(s.id))
            .flatMap(s => s.fieldIds);

          for (const fieldId of fieldIds) {
            const fieldEl = document.querySelector(`[data-faux-id="${fieldId}"]`);
            if (!fieldEl) continue;

            // Walk up to the section container and find a submit-like button
            const container = fieldEl.closest('section, .panel, .card, form, fieldset, [role="group"], [class*="chat-panel"]')
              || fieldEl.parentElement?.parentElement?.parentElement;
            if (!container) continue;

            button = findSubmitButton(container);
            if (button) break;
          }
        }

        // Fallback: find any submit button on the page
        if (!button) {
          button = findSubmitButton(document.body);
        }

        if (button) {
          button.click();

          // Report submission data to backend for RAG (fire-and-forget)
          if (lastClassified.length > 0) {
            reportSubmission(lastClassified);
          }

          const text = button.textContent?.trim() || button.getAttribute('value') || 'Submit';
          sendResponse({ type: 'SUBMIT_RESULT', payload: { success: true, buttonText: text } } satisfies FauxMessage);
        } else {
          sendResponse({ type: 'SUBMIT_RESULT', payload: { success: false, error: 'No submit button found' } } satisfies FauxMessage);
        }
        break;
      }

      case 'GET_STATUS': {
        sendResponse({
          type: 'STATUS',
          payload: {
            backendOnline: false,
            fieldsDetected: lastClassified.length,
          },
        } satisfies FauxMessage);
        break;
      }
    }

    return true;
  }
);

console.log('[Faux] Content script loaded');
