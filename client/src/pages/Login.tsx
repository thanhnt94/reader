import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAppStore } from '../store/useAppStore';
import { BookOpen, ShieldAlert, ArrowRight, Lock, Settings as SettingsIcon, X, Check, Globe } from 'lucide-react';

export default function Login() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { authConfig, fetchAuthConfig, login, isLoggedIn } = useAppStore();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // SSO Settings Modal on Login
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [ssoUrl, setSsoUrl] = useState('https://inmind.site');
  const [ssoClientId, setSsoClientId] = useState('reader-v1');
  const [ssoClientSecret, setSsoClientSecret] = useState('reader_secret_123');
  const [ssoEnabled, setSsoEnabled] = useState(true);
  const [ssoTestStatus, setSsoTestStatus] = useState<{ status: 'idle' | 'loading' | 'success' | 'error'; message: string }>({
    status: 'idle',
    message: ''
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const isBackdoor = searchParams.get('backdoor') === '1';
  const urlError = searchParams.get('error');

  useEffect(() => {
    fetchAuthConfig();
  }, [fetchAuthConfig]);

  useEffect(() => {
    if (isLoggedIn) {
      const redirect = searchParams.get('redirect') || '/';
      navigate(redirect);
    }
  }, [isLoggedIn, navigate, searchParams]);

  // Load SSO config when opening settings
  const loadSSOConfig = async () => {
    try {
      const res = await axios.get('/api/sso/config');
      if (res.data) {
        setSsoUrl(res.data.server_url || 'https://inmind.site');
        setSsoClientId(res.data.client_id || 'reader-v1');
        setSsoClientSecret(res.data.client_secret || 'reader_secret_123');
        setSsoEnabled(res.data.is_enabled ?? true);
      }
    } catch (e) {
      console.warn('Could not load SSO config:', e);
    }
  };

  const handleOpenSettings = () => {
    loadSSOConfig();
    setIsSettingsOpen(true);
    setSsoTestStatus({ status: 'idle', message: '' });
  };

  const handleTestSSO = async () => {
    setSsoTestStatus({ status: 'loading', message: 'Testing connection...' });
    try {
      const res = await axios.post('/api/sso/test', { server_url: ssoUrl.trim() });
      if (res.data?.status === 'success') {
        setSsoTestStatus({ status: 'success', message: res.data.message || 'Connected successfully!' });
      } else {
        setSsoTestStatus({ status: 'error', message: res.data?.message || 'Connection failed' });
      }
    } catch (e: any) {
      setSsoTestStatus({ status: 'error', message: e.response?.data?.message || e.message || 'Connection test failed' });
    }
  };

  const handleSaveSSOSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await axios.post('/api/sso/config', {
        is_enabled: ssoEnabled,
        server_url: ssoUrl.trim(),
        client_id: ssoClientId.trim(),
        client_secret: ssoClientSecret.trim()
      });
      await fetchAuthConfig();
      setIsSettingsOpen(false);
    } catch (e) {
      alert('Failed to save SSO settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Automatic SSO redirection if enabled and not backdoor
  useEffect(() => {
    if (authConfig && authConfig.sso_enabled && !isBackdoor && !urlError && authConfig.jump_url) {
      const redirect = searchParams.get('redirect');
      if (redirect) {
        document.cookie = `sso_return_url=${encodeURIComponent(redirect)}; path=/; max-age=600; SameSite=Lax`;
        const delimiter = authConfig.jump_url.includes('?') ? '&' : '?';
        window.location.href = `${authConfig.jump_url}${delimiter}state=${encodeURIComponent(redirect)}`;
      } else {
        window.location.href = authConfig.jump_url;
      }
    }
  }, [authConfig, isBackdoor, urlError, searchParams]);

  useEffect(() => {
    if (urlError) {
      setErrorMsg(decodeURIComponent(urlError));
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('error');
          return next;
        },
        { replace: true }
      );
    }
  }, [urlError, setSearchParams]);

  const handleLocalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMsg('Please enter both username and password.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    const res = await login({
      username: username.trim(),
      password: password.trim(),
      is_backdoor: isBackdoor,
    });

    setIsSubmitting(false);

    if (res.success) {
      const redirect = searchParams.get('redirect') || '/';
      navigate(redirect);
    } else {
      setErrorMsg(res.error || 'Invalid credentials');
    }
  };

  const handleSSORedirect = () => {
    if (authConfig?.jump_url) {
      const redirect = searchParams.get('redirect');
      if (redirect) {
        document.cookie = `sso_return_url=${encodeURIComponent(redirect)}; path=/; max-age=600; SameSite=Lax`;
        const delimiter = authConfig.jump_url.includes('?') ? '&' : '?';
        window.location.href = `${authConfig.jump_url}${delimiter}state=${encodeURIComponent(redirect)}`;
      } else {
        window.location.href = authConfig.jump_url;
      }
    } else {
      setErrorMsg('SSO Jump URL not configured or service unavailable.');
    }
  };

  if (!authConfig) {
    return (
      <div className="min-h-screen bg-[#070a13] text-white flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-3 border-sky-500/30 border-t-sky-500 animate-spin" />
          <span className="text-slate-400 text-xs font-medium">Connecting to CentralAuth...</span>
        </div>
      </div>
    );
  }

  const showSSO = authConfig.sso_enabled && !isBackdoor;

  return (
    <div className="min-h-screen bg-[#070a13] text-white flex items-center justify-center font-sans p-6 relative overflow-hidden">
      {/* Glow Orbs */}
      <div className="absolute top-[-20%] left-[-20%] w-[55vw] h-[55vw] rounded-full bg-sky-600 opacity-10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[55vw] h-[55vw] rounded-full bg-cyan-500 opacity-10 blur-[130px] pointer-events-none" />

      {/* Top Right Quick Settings Toggle */}
      <button
        type="button"
        onClick={handleOpenSettings}
        className="absolute top-6 right-6 p-2.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-all cursor-pointer z-20 flex items-center gap-2 text-xs font-semibold"
        title="SSO Configuration"
      >
        <SettingsIcon className="w-4 h-4 text-sky-400" />
        <span className="hidden sm:inline">SSO Settings</span>
      </button>

      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 backdrop-blur-2xl rounded-3xl p-8 shadow-2xl relative z-10">
        {/* Brand Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-sky-600 to-cyan-500 flex items-center justify-center text-slate-950 font-bold shadow-xl shadow-sky-600/25 mb-4">
            <BookOpen className="w-7 h-7 fill-current" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Reader LMS</h2>
          <p className="text-xs text-slate-400 mt-1">
            {showSSO ? 'Sign in with CentralAuth Single Sign-On' : 'Administrator Local Backdoor Access'}
          </p>
        </div>

        {/* Error Banner */}
        {errorMsg && (
          <div className="p-3.5 mb-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium flex gap-2.5 items-center">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* SSO Panel */}
        {showSSO ? (
          <div className="flex flex-col gap-5">
            {!urlError ? (
              <div className="flex flex-col items-center gap-3 py-6">
                <div className="w-9 h-9 rounded-full border-3 border-sky-500/30 border-t-sky-500 animate-spin" />
                <span className="text-sky-400 font-semibold text-xs animate-pulse">
                  Redirecting to Central SSO...
                </span>
                <button
                  type="button"
                  onClick={handleSSORedirect}
                  className="mt-3 text-xs text-slate-300 hover:text-white underline cursor-pointer"
                >
                  Click here if not redirected automatically
                </button>
                <div className="flex items-center justify-center mt-3">
                  <button
                    type="button"
                    onClick={() => setSearchParams({ backdoor: '1' })}
                    className="text-xs text-slate-400 hover:text-sky-400 font-medium underline transition-colors cursor-pointer"
                  >
                    Administrator Local Backdoor Bypass
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleSSORedirect}
                  className="w-full py-3.5 px-6 rounded-2xl font-bold text-xs bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 text-slate-950 shadow-lg shadow-sky-600/25 transition-all duration-300 flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
                >
                  <span>Sign In with Central SSO</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="flex items-center justify-center mt-2">
                  <button
                    type="button"
                    onClick={() => setSearchParams({ backdoor: '1' })}
                    className="text-xs text-slate-400 hover:text-sky-400 font-medium underline transition-colors cursor-pointer"
                  >
                    Administrator Local Backdoor Bypass
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          /* Local Backdoor Form */
          <form onSubmit={handleLocalSubmit} className="flex flex-col gap-4">
            {authConfig.sso_enabled ? (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 font-medium flex items-start gap-2">
                <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>SSO is active. Local backdoor access is restricted to administrators.</span>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300 font-medium flex items-start gap-2">
                <Globe className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <span>SSO Routing is currently disabled. Using local database accounts.</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 text-xs"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 text-xs"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-3 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Verifying...' : 'Submit Local Access'}
            </button>

            {authConfig.sso_enabled && (
              <div className="flex items-center justify-center mt-3">
                <button
                  type="button"
                  onClick={() => setSearchParams({})}
                  className="text-xs text-sky-400 hover:text-sky-300 font-semibold underline transition-colors cursor-pointer"
                >
                  Sign In using Central SSO instead
                </button>
              </div>
            )}
          </form>
        )}
      </div>

      {/* SSO Configuration Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">CentralAuth SSO Switch</h3>
                  <p className="text-[11px] text-slate-400">Toggle CentralAuth SSO vs Local Login</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSSOSettings} className="space-y-4">
              {/* Enable / Disable Toggle Switch */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <label htmlFor="ssoEnabledSwitch" className="text-xs font-bold text-white block cursor-pointer">
                    Enable CentralAuth SSO
                  </label>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {ssoEnabled ? 'Logins redirect to inmind.site' : 'Logins stay on Reader locally'}
                  </p>
                </div>
                <input
                  id="ssoEnabledSwitch"
                  type="checkbox"
                  checked={ssoEnabled}
                  onChange={(e) => setSsoEnabled(e.target.checked)}
                  className="w-5 h-5 text-sky-500 bg-slate-800 border-slate-700 rounded focus:ring-sky-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  CentralAuth Server URL
                </label>
                <input
                  type="url"
                  value={ssoUrl}
                  onChange={(e) => setSsoUrl(e.target.value)}
                  placeholder="https://inmind.site"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Client ID
                  </label>
                  <input
                    type="text"
                    value={ssoClientId}
                    onChange={(e) => setSsoClientId(e.target.value)}
                    placeholder="reader-v1"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Client Secret
                  </label>
                  <input
                    type="password"
                    value={ssoClientSecret}
                    onChange={(e) => setSsoClientSecret(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                    required
                  />
                </div>
              </div>

              {/* Test Status Banner */}
              {ssoTestStatus.status !== 'idle' && (
                <div
                  className={`p-3 rounded-xl text-xs font-medium ${
                    ssoTestStatus.status === 'success'
                      ? 'bg-sky-500/10 border border-sky-500/20 text-sky-300'
                      : ssoTestStatus.status === 'error'
                      ? 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {ssoTestStatus.status === 'loading' && 'Testing connection to CentralAuth...'}
                  {ssoTestStatus.status === 'success' && `✅ ${ssoTestStatus.message}`}
                  {ssoTestStatus.status === 'error' && `❌ ${ssoTestStatus.message}`}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleTestSSO}
                  disabled={ssoTestStatus.status === 'loading'}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
                >
                  Test Connection
                </button>
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-600/20 transition-all cursor-pointer"
                >
                  {isSavingSettings ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
