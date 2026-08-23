import React from 'react';
import { 
  ShieldAlert, 
  Lock, 
  ArrowLeft, 
  LogOut, 
  ShieldCheck, 
  AlertTriangle,
  FileCheck2,
  Users,
  Radio,
  School,
  Cpu,
  Navigation
} from 'lucide-react';
import { ActiveUserSession, UserRole } from '../types.js';

interface Props {
  currentUser: ActiveUserSession;
  attemptedPortal: string;
  onNavigateToAuthorizedPortal: () => void;
  onLogout: () => void;
  onBackToLanding: () => void;
}

export const AccessDenied: React.FC<Props> = ({
  currentUser,
  attemptedPortal,
  onNavigateToAuthorizedPortal,
  onLogout,
  onBackToLanding
}) => {
  const getRoleDisplayName = (role: UserRole) => {
    switch (role) {
      case 'PARENT_GUARDIAN': return 'Parent / Legal Guardian';
      case 'SCHOOL_PRINCIPAL': return 'School Principal';
      case 'SCHOOL_ADMIN_STAFF': return 'School Administrator';
      case 'COMMAND_OPERATOR': return '24/7 Command Centre Officer';
      case 'TECHNICIAN': return 'Hardware & IoT Technician';
      case 'SYSTEM_ADMIN': return 'System Administrator';
      case 'FIELD_RESPONDER': return 'SAPS Tactical Responder';
      case 'GOVERNMENT_AUDITOR': return 'Government & DBE Auditor';
      case 'FOUNDER_EXECUTIVE': return 'Executive Director (Founder)';
      default: return role;
    }
  };

  const getAuthorizedPortalName = (role: UserRole) => {
    switch (role) {
      case 'PARENT_GUARDIAN': return 'Guardian Safety Hub';
      case 'SCHOOL_PRINCIPAL':
      case 'SCHOOL_ADMIN_STAFF': return 'School Administration Portal';
      case 'COMMAND_OPERATOR': return '24/7 Command Centre';
      case 'TECHNICIAN': return 'Technician Hardware Portal';
      case 'SYSTEM_ADMIN': return 'System Administration Console';
      case 'FIELD_RESPONDER': return 'SAPS Tactical Responder Console';
      case 'GOVERNMENT_AUDITOR':
      case 'FOUNDER_EXECUTIVE': return 'Executive Governance Portal';
      default: return 'Authorized Dashboard';
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 sm:py-16 space-y-6 animate-fadeIn">
      <div className="rounded-3xl bg-slate-900 border border-rose-500/30 p-6 sm:p-10 shadow-2xl space-y-6 text-center">
        {/* Shield Icon */}
        <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-lg shadow-rose-950/40">
          <ShieldAlert className="w-8 h-8 sm:w-10 sm:h-10" />
        </div>

        {/* Header */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs font-mono font-bold">
            <Lock className="w-3.5 h-3.5" />
            <span>403 — AUTHORIZATION DENIED</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Restricted Security Clearance
          </h2>
          <p className="text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
            Your authenticated session does not possess the requisite security clearance or institutional scope to access <span className="text-rose-400 font-semibold">{attemptedPortal}</span>.
          </p>
        </div>

        {/* User Clearance Details */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-left space-y-3 text-xs">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
            <span className="text-slate-400">Authenticated Identity:</span>
            <strong className="text-white font-medium">{currentUser.name}</strong>
          </div>
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
            <span className="text-slate-400">Assigned Role:</span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-mono font-semibold">
              {getRoleDisplayName(currentUser.role)}
            </span>
          </div>
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
            <span className="text-slate-400">Institutional Scope:</span>
            <span className="text-slate-300 font-mono">
              {currentUser.schoolId ? `School ID: ${currentUser.schoolId}` : currentUser.guardianId ? `Guardian ID: ${currentUser.guardianId}` : currentUser.responderUnit ? `Unit: ${currentUser.responderUnit}` : 'National Platform'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Policy Enforcement:</span>
            <span className="text-cyan-400 font-mono">POPIA §18 Strict Role Boundary</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={onNavigateToAuthorizedPortal}
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-sm font-bold shadow-lg shadow-cyan-950/60 transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Return to {getAuthorizedPortalName(currentUser.role)}</span>
          </button>

          <button
            onClick={onLogout}
            className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition-all flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4 text-slate-400" />
            <span>Sign Out & Switch Account</span>
          </button>
        </div>

        <div className="pt-2">
          <button
            onClick={onBackToLanding}
            className="text-xs text-slate-400 hover:text-cyan-400 transition-colors"
          >
            ← Back to Public Website Overview
          </button>
        </div>
      </div>
    </div>
  );
};
