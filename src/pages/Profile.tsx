import { useEffect, useState } from 'react';
import UserAvatar from '../components/UserAvatar.js';
import { api } from '../lib/api.js';
import { prepareAvatarUpload } from '../lib/avatar-upload.js';
import { useAppShell } from '../lib/app-shell.js';

type ProfileDraft = {
  username: string;
  status: string;
  avatarUrl: string | null;
};

type PasswordDraft = {
  password: string;
  confirmPassword: string;
};

type ProfileMode = 'view' | 'edit' | 'password';

function buildProfileDraft(username: string, status: string, avatarUrl: string | null): ProfileDraft {
  return {
    username,
    status,
    avatarUrl
  };
}

function buildEmptyPasswordDraft(): PasswordDraft {
  return {
    password: '',
    confirmPassword: ''
  };
}

export default function Profile() {
  const { bootstrap, refreshBootstrap } = useAppShell();
  const [mode, setMode] = useState<ProfileMode>('view');
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPreparingAvatar, setIsPreparingAvatar] = useState(false);
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>(() =>
    buildProfileDraft(bootstrap.currentUser.username, bootstrap.currentUser.status, bootstrap.currentUser.avatarUrl)
  );
  const [passwordDraft, setPasswordDraft] = useState<PasswordDraft>(() => buildEmptyPasswordDraft());

  const currentUser = bootstrap.currentUser;
  const isEditing = mode === 'edit';
  const isChangingPassword = mode === 'password';

  useEffect(() => {
    if (mode === 'view') {
      setProfileDraft(buildProfileDraft(currentUser.username, currentUser.status, currentUser.avatarUrl));
      setPasswordDraft(buildEmptyPasswordDraft());
    }
  }, [currentUser.avatarUrl, currentUser.status, currentUser.username, mode]);

  function openEditMode() {
    setNotice(null);
    setError(null);
    setProfileDraft(buildProfileDraft(currentUser.username, currentUser.status, currentUser.avatarUrl));
    setMode('edit');
  }

  function openPasswordMode() {
    setNotice(null);
    setError(null);
    setPasswordDraft(buildEmptyPasswordDraft());
    setMode('password');
  }

  function handleDiscard() {
    setError(null);
    setProfileDraft(buildProfileDraft(currentUser.username, currentUser.status, currentUser.avatarUrl));
    setPasswordDraft(buildEmptyPasswordDraft());
    setMode('view');
  }

  async function handleAvatarSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setIsPreparingAvatar(true);
    setError(null);

    try {
      const avatarUrl = await prepareAvatarUpload(file);
      setProfileDraft((current) => ({
        ...current,
        avatarUrl
      }));
    } catch (avatarError) {
      setError(avatarError instanceof Error ? avatarError.message : 'Could not prepare that photo.');
    } finally {
      setIsPreparingAvatar(false);
      event.target.value = '';
    }
  }

  async function handleProfileSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setNotice(null);
    setError(null);

    try {
      await api.updateProfile({
        username: profileDraft.username,
        status: profileDraft.status,
        avatarUrl: profileDraft.avatarUrl
      });
      await refreshBootstrap();
      setMode('view');
      setNotice('Profile updated.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not update your profile.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePasswordSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setError(null);

    if (passwordDraft.password !== passwordDraft.confirmPassword) {
      setError('The new passwords do not match.');
      return;
    }

    setIsSaving(true);

    try {
      await api.changePassword({
        password: passwordDraft.password
      });
      setPasswordDraft(buildEmptyPasswordDraft());
      setMode('view');
      setNotice('Password updated.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not change your password.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="stack">
      <section className="card stack">
        {notice ? <div className="success">{notice}</div> : null}
        {error ? <div className="error">{error}</div> : null}

        {mode === 'view' ? (
          <div className="stack profile-view">
            <div className="profile-hero">
              <div className="profile-summary">
                <UserAvatar
                  className="profile-avatar"
                  username={currentUser.username}
                  avatarUrl={currentUser.avatarUrl}
                  ariaHidden
                />

                <div className="stack profile-summary-copy">
                  <div>
                    <h1 className="page-title">{currentUser.username}</h1>
                    <p className="muted profile-status-copy">{currentUser.status || 'No status yet.'}</p>
                  </div>
                </div>
              </div>

              <div className="inline-actions profile-toolbar-actions">
                <button className="button-ghost" type="button" onClick={openPasswordMode}>
                  Change password
                </button>
                <button className="button-secondary" type="button" onClick={openEditMode}>
                  Edit
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {isEditing ? (
          <form className="stack" onSubmit={handleProfileSave}>
            <div className="field">
              <label>Profile photo</label>
              <div className="profile-photo-editor">
                <UserAvatar
                  className="profile-avatar profile-avatar-edit"
                  username={profileDraft.username || currentUser.username}
                  avatarUrl={profileDraft.avatarUrl}
                  ariaHidden
                />

                <div className="stack profile-photo-actions">
                  <div className="inline-actions profile-photo-buttons">
                    <label className="button-secondary button-compact profile-upload-button" htmlFor="profile-avatar-upload">
                      {isPreparingAvatar ? 'Preparing photo…' : 'Upload photo'}
                    </label>
                    <input
                      id="profile-avatar-upload"
                      className="visually-hidden"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/jpg"
                      onChange={(event) => void handleAvatarSelect(event)}
                      disabled={isPreparingAvatar}
                    />
                    <button
                      className="button-ghost button-compact"
                      type="button"
                      onClick={() => setProfileDraft((current) => ({ ...current, avatarUrl: null }))}
                      disabled={!profileDraft.avatarUrl || isPreparingAvatar}
                    >
                      Remove photo
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="field">
              <label htmlFor="profile-username">Username</label>
              <input
                id="profile-username"
                className="input"
                autoFocus
                value={profileDraft.username}
                onChange={(event) => setProfileDraft((current) => ({ ...current, username: event.target.value }))}
              />
            </div>

            <div className="field">
              <label htmlFor="profile-status">Status</label>
              <textarea
                id="profile-status"
                className="textarea"
                maxLength={140}
                placeholder="What are you betting on today?"
                value={profileDraft.status}
                onChange={(event) => setProfileDraft((current) => ({ ...current, status: event.target.value }))}
              />
              <div className="muted field-hint">{profileDraft.status.trim().length}/140</div>
            </div>

            <div className="page-actions">
              <button className="button" type="submit" disabled={isSaving || isPreparingAvatar}>
                {isPreparingAvatar ? 'Preparing photo…' : isSaving ? 'Saving…' : 'Save changes'}
              </button>
              <button
                className="button-ghost"
                type="button"
                onClick={handleDiscard}
                disabled={isSaving || isPreparingAvatar}
              >
                Discard
              </button>
            </div>
          </form>
        ) : null}

        {isChangingPassword ? (
          <form className="stack" onSubmit={handlePasswordSave}>
            <div className="field">
              <label htmlFor="profile-password">New password</label>
              <input
                id="profile-password"
                className="input"
                type="password"
                autoFocus
                autoComplete="new-password"
                value={passwordDraft.password}
                onChange={(event) => setPasswordDraft((current) => ({ ...current, password: event.target.value }))}
              />
            </div>

            <div className="field">
              <label htmlFor="profile-password-confirm">Confirm new password</label>
              <input
                id="profile-password-confirm"
                className="input"
                type="password"
                autoComplete="new-password"
                value={passwordDraft.confirmPassword}
                onChange={(event) =>
                  setPasswordDraft((current) => ({ ...current, confirmPassword: event.target.value }))
                }
              />
            </div>

            <div className="page-actions">
              <button className="button" type="submit" disabled={isSaving}>
                {isSaving ? 'Saving…' : 'Save password'}
              </button>
              <button className="button-ghost" type="button" onClick={handleDiscard} disabled={isSaving}>
                Discard
              </button>
            </div>
          </form>
        ) : null}
      </section>
    </div>
  );
}
