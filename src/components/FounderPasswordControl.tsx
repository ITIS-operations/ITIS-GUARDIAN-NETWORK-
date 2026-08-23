import React, { useState } from 'react';
import { 
  KeyRound, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Lock,
  UserCheck
} from 'lucide-react';
import { api } from '../services/api.js';
import { ActiveUserSession } from '../types.js';

interface Props {
  currentUser?: ActiveUserSession | null;
}

export const FounderPasswordControl: React.FC<Props> = ({ currentUser }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Password Policy Checks
  const policyChecks = {
    length: newPassword.length >= 12,
    uppercase: /[A-Z]/.test(newPassword),
    lowercase: /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(newPassword),
    match: newPassword.length > 0 && newPassword === confirmPassword
  };

  const isFormValid =
    policyChecks.length &&
    policyChecks.uppercase &&
    policyChecks.lowercase &&
    policyChecks.number &&
    policyChecks.special &&
    policyChecks.match;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    // Validation
    if (!newPassword) {
      setErrorMessage('Please enter a new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('New password and confirm password do not match.');
      return;
    }
    if (!isFormValid) {
      setErrorMessage('Password must satisfy all security policy criteria.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.updateFounderPassword({
        newPassword,
        confirmPassword
      });

      // Clear plain passwords from React state immediately upon completion
      setNewPassword('');
      setConfirmPassword('');

      // Display required success message
      setSuccessMessage(res.message || 'Founder password updated successfully.');
    } catch (err: any) {
      // Clear plain passwords from React state on failure as well
      setNewPassword('');
      setConfirmPassword('');
      setErrorMessage(err.message || 'Failed to update Founder password.');
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser || currentUser.role !== 'FOUNDER_EXECUTIVE') {
    return (
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 text-xs">
        <div className="flex items-center gap-2 text-rose-400 font-bold mb-2">
          <AlertCircle className="w-4 h-4" />
          <span>403 Forbidden: Restricted Access</span>
        </div>
        <p>Founder password management is strictly restricted to authenticated Founder/SuperAdmin sessions.</p>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              SET / RESET FOUNDER PASSWORD
            </h3>
            <p className="text-xs text-slate-400">
              Temporary development & testing credential management for sovereign Founder access.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-xs font-mono font-medium flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>founder@itis365.co.za</span>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-mono font-bold">
            SuperAdmin / Founder
          </span>
        </div>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-2.5 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-bold">{successMessage}</span>
        </div>
      )}

      {/* Error Notification */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-2.5 animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* New Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>New Password</span>
              <span className="text-[11px] text-slate-500 font-mono">12+ characters</span>
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (successMessage) setSuccessMessage(null);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Enter new strong password"
                autoComplete="new-password"
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-500 text-white placeholder-slate-500 text-xs font-mono transition-colors"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                aria-label={showNewPassword ? 'Hide password' : 'Show password'}
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Confirm Password</span>
              {confirmPassword.length > 0 && (
                <span className={`text-[11px] font-mono ${policyChecks.match ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {policyChecks.match ? 'Passwords match ✓' : 'Must match'}
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (successMessage) setSuccessMessage(null);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Re-enter new password to confirm"
                autoComplete="new-password"
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-500 text-white placeholder-slate-500 text-xs font-mono transition-colors"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Security Policy Status Checklist */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            Password Policy Requirements
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] font-mono">
            <span className={`flex items-center gap-1.5 ${policyChecks.length ? 'text-emerald-400' : 'text-slate-500'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${policyChecks.length ? 'bg-emerald-400' : 'bg-slate-600'}`} />
              12+ characters
            </span>
            <span className={`flex items-center gap-1.5 ${policyChecks.uppercase ? 'text-emerald-400' : 'text-slate-500'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${policyChecks.uppercase ? 'bg-emerald-400' : 'bg-slate-600'}`} />
              Uppercase (A-Z)
            </span>
            <span className={`flex items-center gap-1.5 ${policyChecks.lowercase ? 'text-emerald-400' : 'text-slate-500'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${policyChecks.lowercase ? 'bg-emerald-400' : 'bg-slate-600'}`} />
              Lowercase (a-z)
            </span>
            <span className={`flex items-center gap-1.5 ${policyChecks.number ? 'text-emerald-400' : 'text-slate-500'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${policyChecks.number ? 'bg-emerald-400' : 'bg-slate-600'}`} />
              Number (0-9)
            </span>
            <span className={`flex items-center gap-1.5 ${policyChecks.special ? 'text-emerald-400' : 'text-slate-500'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${policyChecks.special ? 'bg-emerald-400' : 'bg-slate-600'}`} />
              Special character
            </span>
            <span className={`flex items-center gap-1.5 ${policyChecks.match ? 'text-emerald-400' : 'text-slate-500'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${policyChecks.match ? 'bg-emerald-400' : 'bg-slate-600'}`} />
              Matching passwords
            </span>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Server-side SHA-256 Hashing • Authoritative Audit Stream</span>
          </div>

          <button
            type="submit"
            disabled={loading || !newPassword || !confirmPassword}
            className={`min-h-[44px] px-6 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 ${
              loading || !newPassword || !confirmPassword
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-950/50 cursor-pointer active:scale-95'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Updating Password...</span>
              </>
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                <span>SET PASSWORD</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
