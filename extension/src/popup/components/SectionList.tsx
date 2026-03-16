import type { FormSection } from '@shared/types';

interface SectionListProps {
  sections: FormSection[];
  selected: Set<string>;
  onToggle: (sectionId: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
}

export function SectionList({ sections, selected, onToggle, onSelectAll, onSelectNone }: SectionListProps) {
  if (sections.length === 0) return null;

  return (
    <div class="section-list">
      <div class="section-header">
        <span class="section-title">Sections</span>
        <div class="section-actions">
          <button class="section-link" onClick={onSelectAll}>All</button>
          <button class="section-link" onClick={onSelectNone}>None</button>
        </div>
      </div>
      {sections.map(section => (
        <label class="section-item" key={section.id}>
          <input
            type="checkbox"
            checked={selected.has(section.id)}
            onChange={() => onToggle(section.id)}
          />
          <span class="section-name">{section.name}</span>
          <span class="section-count">{section.fieldIds.length} fields</span>
        </label>
      ))}
    </div>
  );
}
