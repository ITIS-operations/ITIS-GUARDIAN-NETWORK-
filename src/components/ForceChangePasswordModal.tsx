import React, { useState } from 'react';
import { ShieldCheck, Lock, AlertCircle, CheckCircle, KeyRound, Eye, EyeOff } from 'lucide-react';
import { ActiveUserSession } from '../types.js';
import { api } from '../services/api.js';

interface Props {
  currentUser: ActiveUserSession;
  onPasswordChanged: () => void;
  onLogout: () => void;
}

export const ForceChangePasswordModal: React.FC<Props> = ({
  currentUser,
  onPasswordChanged,
  onLogout
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!newPassword || newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation password do not match.');
      return;
    }

    try {
      setIsLoading(true);
      const res = await api.changePassword({ newPassword, confirmPassword });
      setSuccessMsg(res.message || 'Password updated successfully. Granting portal access...');
      setTimeout(() => {
        onPasswordChanged();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to update password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-md bg-[#0a1224] border border-cyan-500/40 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6 text-white">
        
        {/* Header with emblem */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400">
            <KeyRound className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Mandatory First-Time Password Change
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Welcome, <span className="font-semibold text-cyan-300">{currentUser.name || currentUser.email}</span>. For your security, newly activated accounts must choose a secure personal password before accessing the ITIS portal.
          </p>
        </div>

        {/* Security Alert / Status */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              New Personal Password <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <input
                id="input-force-new-password"
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                required
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Confirm New Password <span className="text-rose-400">*</span>
            </label>
            <input
              id="input-force-confirm-password"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your new password"
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>Password Security Standards:</span>
            </div>
            <p>• At least 8 characters in length</p>
            <p>• Use a combination of uppercase, numbers, and symbols</p>
            <p>• Never share your credentials with anyone</p>
          </div>

          <div className="pt-2 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onLogout}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Sign Out
            </button>
            <button
              id="btn-submit-force-change-password"
              type="submit"
              disabled={isLoading || !!successMsg}
              className="flex-1 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-cyan-600/30 transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <span>Saving New Password...</span>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Activate & Enter Portal</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
