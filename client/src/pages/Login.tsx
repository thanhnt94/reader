import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { BookOpen, ShieldAlert, ArrowRight, Lock } from 'lucide-react';

export default function Login() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { authConfig, fetchAuthConfig, login, isLoggedIn } = useAppStore();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const isBackdoor = searchParams.get('backdoor') === '1';
  const urlError = searchParams.get('error');

  useEffect(() => {
    fetchAuthConfig();
  }, [fetchAuthConfig]);

  useEffect(() => {
    if (isLoggedIn) {
      navigate('/');
    }
  }, [isLoggedIn, navigate]);

  // Automatic SSO redirection if enabled and not backdoor
  useEffect(() => {
    if (authConfig && authConfig.sso_enabled && !isBackdoor && !urlError && authConfig.jump_url) {
      window.location.href = authConfig.jump_url;
    }
  }, [authConfig, isBackdoor, urlError]);

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
      navigate('/');
    } else {
      setErrorMsg(res.error || 'Invalid credentials');
    }
  };

  const handleSSORedirect = () => {
    if (authConfig?.jump_url) {
      window.location.href = authConfig.jump_url;
    } else {
      setErrorMsg('SSO Jump URL not configured or service unavailable.');
    }
  };

  if (!authConfig) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-white flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-3 border-emerald-500/30 border-t-emerald-500 animate-spin" />
          <span className="text-slate-400 text-xs font-medium">Connecting to CentralAuth...</span>
        </div>
      </div>
    );
  }

  const showSSO = authConfig.sso_enabled && !isBackdoor;

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white flex items-center justify-center font-sans p-6 relative overflow-hidden">
      {/* Glow Orbs */}
      <div className="absolute top-[-20%] left-[-20%] w-[55vw] h-[55vw] rounded-full bg-emerald-600 opacity-10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[55vw] h-[55vw] rounded-full bg-teal-500 opacity-10 blur-[130px] pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 backdrop-blur-2xl rounded-3xl p-8 shadow-2xl relative z-10">
        {/* Brand Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-slate-950 font-bold shadow-xl shadow-emerald-600/25 mb-4">
            <BookOpen className="w-7 h-7 fill-current" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Reader LMS</h2>
          <p className="text-xs text-slate-400 mt-1">
            {showSSO ? 'Sign in with your centralized InMind account' : 'Administrator Local Backdoor Access'}
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
                <div className="w-9 h-9 rounded-full border-3 border-emerald-500/30 border-t-emerald-500 animate-spin" />
                <span className="text-emerald-400 font-semibold text-xs animate-pulse">
                  Redirecting to Central SSO...
                </span>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleSSORedirect}
                  className="w-full py-3.5 px-6 rounded-2xl font-bold text-xs bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 shadow-lg shadow-emerald-600/25 transition-all duration-300 flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
                >
                  <span>Sign In with Central SSO</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="flex items-center justify-center mt-2">
                  <button
                    type="button"
                    onClick={() => setSearchParams({ backdoor: '1' })}
                    className="text-xs text-slate-400 hover:text-emerald-400 font-medium underline transition-colors cursor-pointer"
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
            {authConfig.sso_enabled && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 font-medium flex items-start gap-2">
                <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>SSO active. Local backdoor access is restricted to administrators.</span>
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
                className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-xs"
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
                className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-xs"
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
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold underline transition-colors cursor-pointer"
                >
                  Sign In using Central SSO instead
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
