import type { FieldDescriptor, ClassifiedField } from '@shared/types';

interface FieldListProps {
  fields: FieldDescriptor[];
  classified: ClassifiedField[];
}

export function FieldList({ fields, classified }: FieldListProps) {
  const classifiedMap = new Map(classified.map(c => [c.fieldId, c]));

  return (
    <div class="field-list">
      {fields.filter(f => f.visible).map(field => {
        const cls = classifiedMap.get(field.id);
        const label = field.labelText || field.placeholder || field.name || field.ariaLabel || '(unlabeled)';

        return (
          <div class="field-item" key={field.id}>
            <div class="field-info">
              <span class="field-label">{label}</span>
              {cls && (
                <span class="field-value">{cls.generatedValue || '—'}</span>
              )}
            </div>
            <span class="field-type">
              {cls?.fieldType || field.type || field.tag}
            </span>
          </div>
        );
      })}
    </div>
  );
}
