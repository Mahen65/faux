import { INTERACTIVE_SELECTOR } from '@shared/constants';
import type { FieldDescriptor, FormSection } from '@shared/types';

let elementCounter = 0;

/** Generate a unique ID for a discovered element */
function generateId(): string {
  return `fx-${Date.now()}-${++elementCounter}`;
}

/** Check if an element is visible on the page */
function isVisible(el: Element): boolean {
  const htmlEl = el as HTMLElement;
  if (htmlEl.offsetParent === null && htmlEl.style.position !== 'fixed') return false;
  const style = getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/** Resolve the label text for an element */
function resolveLabel(el: Element): string | null {
  // 1. aria-label
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;

  // 2. <label for="id">
  const id = el.getAttribute('id');
  if (id) {
    const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (label) return label.textContent?.trim() || null;
  }

  // 3. Parent <label>
  const parentLabel = el.closest('label');
  if (parentLabel) {
    // Get label text without the input's own text
    const clone = parentLabel.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('input, select, textarea').forEach(c => c.remove());
    const text = clone.textContent?.trim();
    if (text) return text;
  }

  // 4. aria-labelledby
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const parts = labelledBy.split(/\s+/).map(refId => {
      const ref = document.getElementById(refId);
      return ref?.textContent?.trim() || '';
    }).filter(Boolean);
    if (parts.length) return parts.join(' ');
  }

  // 5. Previous sibling text (check label, span, div, p, th, td)
  const prev = el.previousElementSibling;
  if (prev) {
    const tag = prev.tagName;
    if (tag === 'LABEL' || tag === 'SPAN' || tag === 'DIV' || tag === 'P' || tag === 'TH' || tag === 'TD') {
      const text = prev.textContent?.trim();
      if (text) return text;
    }
  }

  // 6. Parent element's previous sibling (handles wrapper divs around inputs)
  // Skip if inside a table cell — step 7 handles tables with full context
  const parent = el.parentElement;
  if (parent && !parent.closest('td, th')) {
    const parentPrev = parent.previousElementSibling;
    if (parentPrev) {
      const text = parentPrev.textContent?.trim();
      if (text) return text;
    }
  }

  // 7. Table context: combine row header + column header
  const cell = el.closest('td, th');
  if (cell) {
    const row = cell.closest('tr');
    const table = cell.closest('table');
    if (row && table) {
      const parts: string[] = [];

      // Row header (first cell in the row)
      const rowHeader = row.querySelector('th, td:first-child');
      if (rowHeader && rowHeader !== cell) {
        const text = rowHeader.textContent?.trim();
        if (text) parts.push(text);
      }

      // Column header (matching <th> in <thead> by column index)
      const cellIndex = Array.from(row.children).indexOf(cell);
      const thead = table.querySelector('thead');
      if (thead && cellIndex >= 0) {
        const headerRow = thead.querySelector('tr');
        if (headerRow && headerRow.children[cellIndex]) {
          const text = headerRow.children[cellIndex].textContent?.trim();
          if (text) parts.push(text);
        }
      }

      if (parts.length) return parts.join(' ');
    }
  }

  return null;
}

/** Extract a FieldDescriptor from a DOM element */
function extractDescriptor(el: Element): FieldDescriptor {
  const rect = el.getBoundingClientRect();
  const input = el as HTMLInputElement;
  const select = el as HTMLSelectElement;

  let options: string[] | null = null;
  if (el.tagName === 'SELECT') {
    options = Array.from(select.options).map(o => o.textContent?.trim() || o.value);
  }

  return {
    id: el.getAttribute('data-faux-id') || (() => {
      const id = generateId();
      el.setAttribute('data-faux-id', id);
      return id;
    })(),
    tag: el.tagName.toLowerCase(),
    type: el.getAttribute('type'),
    name: el.getAttribute('name'),
    placeholder: el.getAttribute('placeholder'),
    labelText: resolveLabel(el),
    ariaLabel: el.getAttribute('aria-label'),
    autocomplete: el.getAttribute('autocomplete'),
    cssClasses: Array.from(el.classList),
    parentFormId: el.closest('form')?.getAttribute('id') || el.closest('form')?.getAttribute('name') || null,
    options,
    validationPattern: el.getAttribute('pattern'),
    minLength: input.minLength > 0 ? input.minLength : null,
    maxLength: input.maxLength > 0 ? input.maxLength : null,
    required: input.required || el.getAttribute('aria-required') === 'true',
    visible: isVisible(el),
    rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
  };
}

/** Discover all interactive elements on the page (Pass 1: standard DOM) */
export function discoverElements(): FieldDescriptor[] {
  const elements = document.querySelectorAll(INTERACTIVE_SELECTOR);
  const descriptors: FieldDescriptor[] = [];

  for (const el of elements) {
    // Skip buttons for now (we focus on fillable elements)
    if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') continue;
    if ((el as HTMLInputElement).type === 'submit' || (el as HTMLInputElement).type === 'button') continue;

    descriptors.push(extractDescriptor(el));
  }

  return descriptors;
}

/** Count forms on the page */
export function countForms(): number {
  return document.querySelectorAll('form').length;
}

/** Section-like container selectors (ordered by specificity) */
const SECTION_SELECTORS = [
  'form',
  'fieldset',
  'section',
  '[role="group"]',
  '[role="form"]',
  '.panel',
  '.card',
  '.section',
  '.form-group',
  '.form-section',
  '.panel-body',
].join(', ');

/** Extract a human-readable name for a section container */
function resolveSectionName(container: Element): string {
  // 1. aria-label
  const ariaLabel = container.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;

  // 2. <legend> for fieldsets
  if (container.tagName === 'FIELDSET') {
    const legend = container.querySelector('legend');
    if (legend) return legend.textContent?.trim() || '';
  }

  // 3. Heading inside or just before the container
  const heading = container.querySelector('h1, h2, h3, h4, h5, h6, .panel-header, [class*="header"], [class*="title"]');
  if (heading) {
    // Get text without nested interactive elements
    const clone = heading.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('button, input, select, textarea').forEach(c => c.remove());
    const text = clone.textContent?.trim();
    if (text) return text;
  }

  // 4. Previous sibling heading
  const prev = container.previousElementSibling;
  if (prev && /^H[1-6]$/.test(prev.tagName)) {
    return prev.textContent?.trim() || '';
  }

  // 5. Form name/id/title
  const name = container.getAttribute('name') || container.getAttribute('title') || container.getAttribute('id');
  if (name) return name.replace(/[-_]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');

  return '';
}

/** Find the nearest section-like container for a DOM element */
function findSectionContainer(el: Element): Element | null {
  let current: Element | null = el.parentElement;
  while (current && current !== document.body) {
    if (current.matches(SECTION_SELECTORS)) return current;
    current = current.parentElement;
  }
  return null;
}

let sectionCounter = 0;

/** Detect logical sections and group fields into them */
export function detectSections(descriptors: FieldDescriptor[]): FormSection[] {
  const containerMap = new Map<Element | null, string[]>();
  const containerNames = new Map<Element | null, string>();

  for (const field of descriptors) {
    const el = document.querySelector(`[data-faux-id="${field.id}"]`);
    if (!el) continue;

    const container = findSectionContainer(el);
    if (!containerMap.has(container)) {
      containerMap.set(container, []);
      containerNames.set(container, container ? resolveSectionName(container) : '');
    }
    containerMap.get(container)!.push(field.id);
  }

  const sections: FormSection[] = [];
  let unnamed = 0;

  for (const [container, fieldIds] of containerMap) {
    if (fieldIds.length === 0) continue;
    const name = containerNames.get(container) || `Section ${++unnamed}`;
    sections.push({
      id: `section-${++sectionCounter}`,
      name,
      fieldIds,
    });
  }

  return sections;
}
