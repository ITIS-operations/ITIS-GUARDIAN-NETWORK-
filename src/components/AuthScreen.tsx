import React, { useState } from 'react';
import { 
  Lock, 
  ShieldCheck, 
  Mail, 
  Key, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  X
} from 'lucide-react';
import { api } from '../services/api.js';
import { ActiveUserSession } from '../types.js';

interface Props {
  onLoginSuccess: (user: ActiveUserSession) => void;
  onBackToLanding: () => void;
  redirectNotice?: string | null;
}

export const AuthScreen: React.FC<Props> = ({
  onLoginSuccess,
  onBackToLanding,
  redirectNotice
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Optional: Modal for Forgot Password
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Please enter your registered email address.');
      return;
    }
    if (!password) {
      setError('Please enter your account password.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.login({ email: email.trim(), password });
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotSubmitted(true);
    setTimeout(() => {
      setForgotSubmitted(false);
      setShowForgotPasswordModal(false);
      setForgotEmail('');
    }, 2500);
  };

  return (
    <div className="max-w-xl mx-auto py-6 sm:py-12 space-y-6 animate-fadeIn">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToLanding}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-cyan-400 transition-colors py-1.5 px-3 rounded-lg hover:bg-slate-900 cursor-pointer"
        >
          <span>← Back to Public Website</span>
        </button>

        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>SERVER-AUTHORITATIVE AUTHENTICATION</span>
        </div>
      </div>

      {/* Redirect Notice if routed from unauthorized route */}
      {redirectNotice && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-3">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>{redirectNotice}</span>
        </div>
      )}

      {/* Unified Authoritative Sign In Card */}
      <div className="rounded-3xl bg-[#0a1224] border border-slate-800 p-6 sm:p-10 shadow-2xl space-y-6">
        
        {/* Emblem & Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center mb-1">
            <img 
              src="/branding/itis-logo.png" 
              alt="ITIS Official Emblem" 
              className="w-14 h-14 rounded-2xl border-2 border-[#d4af37]/50 object-cover shadow-lg shadow-[#060b18]"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          
          <div className="space-y-1">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Sign In to ITIS
            </h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
              Enter your registered credentials. The server authoritatively verifies your identity, role, and clearance.
            </p>
          </div>
        </div>

        {/* Authentication Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="leading-snug">{error}</span>
            </div>
          )}

          {/* Email Address */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              EMAIL ADDRESS
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@organization.co.za"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500 transition-colors font-mono"
                autoComplete="email"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-300">
                PASSWORD
              </label>
              <button
                type="button"
                onClick={() => setShowForgotPasswordModal(true)}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
              >
                FORGOT PASSWORD?
              </button>
            </div>
            <div className="relative">
              <Key className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-11 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500 transition-colors font-mono"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* SIGN IN SUBMIT BUTTON */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white text-sm font-bold shadow-lg shadow-cyan-950/60 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>SIGN IN</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Security & Compliance Footnote */}
        <div className="pt-4 border-t border-slate-800/80 space-y-2">
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Server-Authoritative RBAC: Role & portal verified exclusively on server.</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>POPIA §18 & Child Care Act Compliant Security Architecture.</span>
          </div>
        </div>

      </div>

      {/* Forgot Password Modal (Optional) */}
      {showForgotPasswordModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-cyan-400" />
                <span>Reset Account Password</span>
              </h3>
              <button
                onClick={() => setShowForgotPasswordModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Enter your registered email address. Password reset instructions will be dispatched to your registered DBE or institutional channel.
            </p>

            {forgotSubmitted ? (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Reset instructions dispatched to registered account channel.</span>
              </div>
            ) : (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Registered Email Address
                  </label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="e.g. grace.molefe@safetynet.co.za"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotPasswordModal(false)}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold cursor-pointer"
                  >
                    Submit Request
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

