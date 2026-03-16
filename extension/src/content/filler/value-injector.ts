import type { ClassifiedField, FillResult } from '@shared/types';

/** Get the native value setter to bypass framework wrappers */
const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
  HTMLInputElement.prototype, 'value'
)?.set;

const nativeTextareaValueSetter = Object.getOwnPropertyDescriptor(
  HTMLTextAreaElement.prototype, 'value'
)?.set;

/** Dispatch input/change/blur events that frameworks listen to */
function dispatchEvents(el: Element): void {
  el.dispatchEvent(new Event('focus', { bubbles: true }));
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('blur', { bubbles: true }));
}

/** Set value on a text input (works with React, Angular, Vue) */
function setTextInput(el: HTMLInputElement, value: string): void {
  el.focus();
  nativeInputValueSetter?.call(el, value);
  dispatchEvents(el);
}

/** Set value on a textarea */
function setTextarea(el: HTMLTextAreaElement, value: string): void {
  el.focus();
  nativeTextareaValueSetter?.call(el, value);
  dispatchEvents(el);
}

/** Set value on a select element */
function setSelect(el: HTMLSelectElement, value: string): void {
  // Try to match by text content first, then by value
  const option = Array.from(el.options).find(
    o => o.textContent?.trim() === value || o.value === value
  );
  if (option) {
    el.value = option.value;
  } else if (el.options.length > 1) {
    // Fallback: pick the second option (first is often a placeholder)
    el.selectedIndex = 1;
  }
  dispatchEvents(el);
}

/** Toggle a checkbox */
function setCheckbox(el: HTMLInputElement, value: string): void {
  const shouldCheck = value === 'true';
  if (el.checked !== shouldCheck) {
    el.click();
  }
}

/** Select a radio button */
function setRadio(el: HTMLInputElement): void {
  if (!el.checked) {
    el.click();
  }
}

/** Set value on a date input */
function setDateInput(el: HTMLInputElement, value: string): void {
  // Native date inputs expect YYYY-MM-DD format
  nativeInputValueSetter?.call(el, value);
  dispatchEvents(el);
}

/** Set value on a contenteditable element */
function setContentEditable(el: HTMLElement, value: string): void {
  el.focus();
  el.textContent = value;
  el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('blur', { bubbles: true }));
}

/** Fill a single element with its generated value */
function fillElement(el: Element, field: ClassifiedField): { success: boolean; error?: string } {
  try {
    const tag = el.tagName.toLowerCase();

    // Contenteditable
    if (el.getAttribute('contenteditable') === 'true') {
      setContentEditable(el as HTMLElement, field.generatedValue);
      return { success: true };
    }

    // Select
    if (tag === 'select') {
      setSelect(el as HTMLSelectElement, field.generatedValue);
      return { success: true };
    }

    // Textarea
    if (tag === 'textarea') {
      setTextarea(el as HTMLTextAreaElement, field.generatedValue);
      return { success: true };
    }

    // Input
    if (tag === 'input') {
      const input = el as HTMLInputElement;
      const type = input.type.toLowerCase();

      switch (type) {
        case 'checkbox':
          setCheckbox(input, field.generatedValue);
          return { success: true };
        case 'radio':
          setRadio(input);
          return { success: true };
        case 'date':
        case 'datetime-local':
          setDateInput(input, field.generatedValue);
          return { success: true };
        case 'file':
          // File inputs can't be set programmatically in MVP
          return { success: false, error: 'File inputs not supported in MVP' };
        case 'range':
          nativeInputValueSetter?.call(input, field.generatedValue);
          dispatchEvents(input);
          return { success: true };
        default:
          setTextInput(input, field.generatedValue);
          return { success: true };
      }
    }

    // ARIA role-based elements (textbox, combobox, etc.)
    if (el.getAttribute('role') === 'textbox') {
      setContentEditable(el as HTMLElement, field.generatedValue);
      return { success: true };
    }

    return { success: false, error: `Unsupported element: ${tag}` };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/** Fill all detected fields on the page */
export function fillAll(fields: ClassifiedField[]): FillResult {
  const result: FillResult = { filled: 0, skipped: 0, errors: 0, details: [] };

  for (const field of fields) {
    const el = document.querySelector(`[data-faux-id="${field.fieldId}"]`);
    if (!el) {
      result.skipped++;
      result.details.push({ fieldId: field.fieldId, success: false, error: 'Element not found' });
      continue;
    }

    if (field.fieldType === 'unknown' && !field.generatedValue) {
      result.skipped++;
      result.details.push({ fieldId: field.fieldId, success: false, error: 'Unknown field type with no value' });
      continue;
    }

    const { success, error } = fillElement(el, field);
    if (success) {
      result.filled++;
    } else {
      result.errors++;
    }
    result.details.push({ fieldId: field.fieldId, success, error });
  }

  return result;
}
