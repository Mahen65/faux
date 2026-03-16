import { useState } from 'preact/hooks';
import type { UserProfile } from '@shared/types';

interface ProfileEditorProps {
  profile?: UserProfile;
  onSave: (profile: UserProfile) => void;
  onCancel: () => void;
}

export function ProfileEditor({ profile, onSave, onCancel }: ProfileEditorProps) {
  const [name, setName] = useState(profile?.name || '');
  const [description, setDescription] = useState(profile?.description || '');

  function handleSave() {
    if (!name.trim()) return;
    onSave({
      id: profile?.id || crypto.randomUUID?.() || `${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      isDefault: profile?.isDefault || false,
    });
  }

  return (
    <div class="profile-editor">
      <input
        type="text"
        class="settings-input"
        placeholder="Profile name (e.g., Senior Patient)"
        value={name}
        onInput={(e) => setName((e.target as HTMLInputElement).value)}
      />
      <textarea
        class="settings-textarea"
        placeholder="Persona description (e.g., 72-year-old retired teacher with mild hearing loss, lives alone, wears hearing aids)"
        value={description}
        onInput={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
        rows={3}
      />
      <div class="profile-editor-actions">
        <button class="btn btn-primary" onClick={handleSave} disabled={!name.trim()}>
          Save
        </button>
        <button class="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
