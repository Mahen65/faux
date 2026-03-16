import { useState, useEffect } from 'preact/hooks';
import type { FormbotSettings, UserProfile, UsageSummaryData } from '@shared/types';
import { getSettings, saveSettings } from '@shared/settings';
import { API_BASE_URL } from '@shared/constants';
import { ProfileEditor } from './ProfileEditor';

export function AccountTab() {
  const [settings, setSettings] = useState<FormbotSettings | null>(null);
  const [usage, setUsage] = useState<UsageSummaryData | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(null);
  const [showNewProfile, setShowNewProfile] = useState(false);

  useEffect(() => {
    getSettings().then(s => {
      setSettings(s);
      fetchUsage(s.instanceId);
    });
  }, []);

  async function fetchUsage(instanceId: string) {
    setLoadingUsage(true);
    try {
      const res = await fetch(`${API_BASE_URL}/usage/summary?instance_id=${instanceId}`);
      if (res.ok) {
        setUsage(await res.json());
      }
    } catch {
      // Backend offline
    } finally {
      setLoadingUsage(false);
    }
  }

  async function persistSettings(updated: FormbotSettings) {
    setSettings(updated);
    await saveSettings(updated);
  }

  function handleSetActiveProfile(profileId: string | null) {
    if (!settings) return;
    persistSettings({ ...settings, activeProfileId: profileId });
  }

  function handleSaveProfile(profile: UserProfile) {
    if (!settings) return;
    const existing = settings.profiles.findIndex(p => p.id === profile.id);
    const profiles = [...settings.profiles];
    if (existing >= 0) {
      profiles[existing] = profile;
    } else {
      profiles.push(profile);
    }
    persistSettings({
      ...settings,
      profiles,
      activeProfileId: settings.activeProfileId || profile.id,
    });
    setEditingProfile(null);
    setShowNewProfile(false);
  }

  function handleDeleteProfile(profileId: string) {
    if (!settings) return;
    const profiles = settings.profiles.filter(p => p.id !== profileId);
    persistSettings({
      ...settings,
      profiles,
      activeProfileId: settings.activeProfileId === profileId ? null : settings.activeProfileId,
    });
  }

  if (!settings) return null;

  return (
    <div class="account-tab">
      {/* Usage Stats */}
      <div class="settings-section">
        <div class="settings-label">Usage</div>
        {loadingUsage ? (
          <div class="usage-loading">Loading...</div>
        ) : usage ? (
          <div class="usage-stats">
            <div class="usage-row">
              <span>Total API calls</span>
              <span class="usage-value">{usage.total_calls}</span>
            </div>
            <div class="usage-row">
              <span>Total tokens</span>
              <span class="usage-value">{usage.total_tokens.toLocaleString()}</span>
            </div>
            <div class="usage-row">
              <span>Estimated cost</span>
              <span class="usage-value">${usage.total_cost.toFixed(4)}</span>
            </div>
            <div class="usage-row">
              <span>Today</span>
              <span class="usage-value">{usage.today_calls} calls</span>
            </div>
            {usage.by_provider.length > 0 && (
              <div class="usage-providers">
                {usage.by_provider.map(p => (
                  <div class="usage-provider-row" key={p.provider}>
                    <span class="provider-name">{p.provider}</span>
                    <span>{p.total_calls} calls</span>
                    <span>${p.total_cost.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div class="usage-empty">Backend offline — usage data unavailable</div>
        )}
      </div>

      {/* Profiles */}
      <div class="settings-section">
        <div class="settings-label-row">
          <span class="settings-label">Profiles</span>
          {!showNewProfile && (
            <button class="add-btn" onClick={() => setShowNewProfile(true)}>+ Add</button>
          )}
        </div>

        {showNewProfile && (
          <ProfileEditor
            onSave={handleSaveProfile}
            onCancel={() => setShowNewProfile(false)}
          />
        )}

        {editingProfile && (
          <ProfileEditor
            profile={editingProfile}
            onSave={handleSaveProfile}
            onCancel={() => setEditingProfile(null)}
          />
        )}

        {settings.profiles.length === 0 && !showNewProfile ? (
          <div class="usage-empty">No profiles yet. Add one to use personas when generating data.</div>
        ) : (
          <div class="profile-list">
            {settings.profiles.map(profile => (
              <div
                class={`profile-card ${settings.activeProfileId === profile.id ? 'active' : ''}`}
                key={profile.id}
              >
                <div class="profile-info" onClick={() => handleSetActiveProfile(
                  settings.activeProfileId === profile.id ? null : profile.id
                )}>
                  <div class="profile-name">
                    {settings.activeProfileId === profile.id && <span class="active-dot" />}
                    {profile.name}
                  </div>
                  {profile.description && (
                    <div class="profile-desc">{profile.description.slice(0, 80)}...</div>
                  )}
                </div>
                <div class="profile-actions">
                  <button class="icon-btn" onClick={() => setEditingProfile(profile)} title="Edit">✏️</button>
                  <button class="icon-btn" onClick={() => handleDeleteProfile(profile.id)} title="Delete">🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
