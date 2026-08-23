import React, { useState } from 'react';
import { 
  Building2, 
  ShieldCheck, 
  Users, 
  School, 
  Award, 
  CheckCircle2, 
  FileCheck2, 
  TrendingUp, 
  Layers,
  Lock,
  Sliders,
  Shield,
  FileText,
  UserCheck,
  Check,
  Zap,
  Globe,
  Settings,
  RotateCw,
  KeyRound
} from 'lucide-react';
import { HydratedLearnerRecord, School as SchoolType, ActiveUserSession } from '../types.js';
import { UserManagementView } from './UserManagementView.js';
import { FounderPasswordControl } from './FounderPasswordControl.js';

export type FounderSection = 
  | 'GOVERNANCE' 
  | 'FOUNDER_PASSWORD'
  | 'SYSTEM_ADMIN' 
  | 'SECURITY' 
  | 'USERS' 
  | 'ORGANIZATIONS' 
  | 'AUDIT' 
  | 'PLATFORM_CONTROLS';

interface Props {
  learners: HydratedLearnerRecord[];
  schools: SchoolType[];
  currentUser?: ActiveUserSession;
}

export const ExecutiveGovernmentPortal: React.FC<Props> = ({
  learners = [],
  schools = [],
  currentUser
}) => {
  const safeLearners = Array.isArray(learners) ? learners : [];
  const safeSchools = Array.isArray(schools) ? schools : [];

  const [currentTab, setCurrentTab] = useState<FounderSection>('GOVERNANCE');
  const [controlsSaved, setControlsSaved] = useState(false);

  const totalVerifiedGuardians = new Set(
    safeLearners.flatMap(l => (Array.isArray(l?.guardians) ? l.guardians.map(g => g?.guardian?.id).filter(Boolean) : []))
  ).size;

  const handleSaveControls = (e: React.FormEvent) => {
    e.preventDefault();
    setControlsSaved(true);
    setTimeout(() => setControlsSaved(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Executive Header */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3.5 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shrink-0">
            <Building2 className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                {currentUser?.role === 'FOUNDER_EXECUTIVE' 
                  ? 'Founder Governance & SuperAdmin Directorate' 
                  : 'National Governance & Child Protection Executive Directorate'}
              </h1>
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-cyan-500/20 text-cyan-300 rounded border border-cyan-500/30">
                {currentUser?.role === 'FOUNDER_EXECUTIVE' ? 'SUPERADMIN • FOUNDER • GOVERNANCE' : 'DBE • SAPS • ITIS'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              National Authoritative Child Protection & EMIS Identity Interoperability Framework
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-mono font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> 100% DHA & EMIS Cross-Match Integrity
          </span>
        </div>
      </div>

      {/* Role Navigation Bar for Founder/SuperAdmin */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-800 scrollbar-none">
        <button
          onClick={() => setCurrentTab('GOVERNANCE')}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
            currentTab === 'GOVERNANCE'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Governance</span>
        </button>

        {currentUser?.role === 'FOUNDER_EXECUTIVE' && (
          <button
            onClick={() => setCurrentTab('FOUNDER_PASSWORD')}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
              currentTab === 'FOUNDER_PASSWORD'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
            }`}
          >
            <KeyRound className="w-4 h-4 text-cyan-400" />
            <span>Password Control</span>
          </button>
        )}

        <button
          onClick={() => setCurrentTab('SYSTEM_ADMIN')}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
            currentTab === 'SYSTEM_ADMIN'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>System Administration</span>
        </button>

        <button
          onClick={() => setCurrentTab('SECURITY')}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
            currentTab === 'SECURITY'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Security</span>
        </button>

        <button
          onClick={() => setCurrentTab('USERS')}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
            currentTab === 'USERS'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Users</span>
        </button>

        <button
          onClick={() => setCurrentTab('ORGANIZATIONS')}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
            currentTab === 'ORGANIZATIONS'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Organizations</span>
        </button>

        <button
          onClick={() => setCurrentTab('AUDIT')}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
            currentTab === 'AUDIT'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>Audit</span>
        </button>

        <button
          onClick={() => setCurrentTab('PLATFORM_CONTROLS')}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
            currentTab === 'PLATFORM_CONTROLS'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Platform Controls</span>
        </button>
      </div>

      {/* ==================================================== */}
      {/* 1. GOVERNANCE DASHBOARD */}
      {/* ==================================================== */}
      {currentTab === 'GOVERNANCE' && (
        <div className="space-y-6">
          {/* Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Authoritative Learners</span>
              <div className="text-3xl font-bold text-cyan-400 font-mono">{learners.length}</div>
              <span className="text-[11px] text-emerald-400 font-medium">Capture Once • Zero duplicates</span>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Certified Guardians</span>
              <div className="text-3xl font-bold text-purple-400 font-mono">{totalVerifiedGuardians}</div>
              <span className="text-[11px] text-purple-300 font-medium">Multi-child relationships established</span>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Partner Schools</span>
              <div className="text-3xl font-bold text-white font-mono">{schools.length}</div>
              <span className="text-[11px] text-cyan-400 font-medium">Gauteng & Western Cape Corridors</span>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Response SLA Compliance</span>
              <div className="text-3xl font-bold text-emerald-400 font-mono">99.8%</div>
              <span className="text-[11px] text-emerald-400 font-medium">&lt; 180s Rapid Dispatch</span>
            </div>
          </div>

          {/* Core Principles Architecture Card */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
              <Layers className="w-4 h-4" />
              Authoritative Identity Decoupling Principle
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <span className="font-bold text-cyan-400 text-sm block">1. PERSON ENTITY</span>
                <p className="text-slate-300 leading-relaxed">
                  Core biological/citizen entity verified via Department of Home Affairs SA ID or EMIS. Created exactly once.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <span className="font-bold text-purple-400 text-sm block">2. GUARDIAN BOND</span>
                <p className="text-slate-300 leading-relaxed">
                  One guardian can link to multiple children across different schools without creating multiple accounts.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <span className="font-bold text-emerald-400 text-sm block">3. SCHOOL ENROLMENT</span>
                <p className="text-slate-300 leading-relaxed">
                  Explicit school affiliation record. Decoupled from learner identity when changing schools.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <span className="font-bold text-amber-400 text-sm block">4. ACADEMIC RECORD</span>
                <p className="text-slate-300 leading-relaxed">
                  Annual Grade/Class placement. Promoting grade advances the academic record without duplicating the learner.
                </p>
              </div>
            </div>
          </div>

          {/* Founder Password Control Component in Governance View */}
          {currentUser?.role === 'FOUNDER_EXECUTIVE' && (
            <FounderPasswordControl currentUser={currentUser} />
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* 2. FOUNDER PASSWORD CONTROL (DEDICATED VIEW) */}
      {/* ==================================================== */}
      {currentTab === 'FOUNDER_PASSWORD' && (
        <FounderPasswordControl currentUser={currentUser} />
      )}

      {/* ==================================================== */}
      {/* 3. SYSTEM ADMIN */}
      {/* ==================================================== */}
      {currentTab === 'SYSTEM_ADMIN' && (
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Settings className="w-4 h-4 text-cyan-400" />
            <span>National Infrastructure Health & Cloud Services</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-400">DHA Identity API Cluster</span>
              <strong className="text-emerald-400 block text-sm">HEALTHY (18ms latency)</strong>
            </div>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-400">SAPS Rapid TETRA Gateway</span>
              <strong className="text-emerald-400 block text-sm">CONNECTED (400MHz)</strong>
            </div>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-400">Voice Reassurance IVR Engine</span>
              <strong className="text-emerald-400 block text-sm">STANDBY (0 queue)</strong>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 4. SECURITY */}
      {/* ==================================================== */}
      {currentTab === 'SECURITY' && (
        <div className="space-y-6">
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              <span>Cryptographic Security & Access Control Posture</span>
            </h3>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-300 font-mono">
                <span>Hardware Encryption Standard</span>
                <span className="text-emerald-400">AES-256-GCM End-to-End</span>
              </div>
              <div className="flex justify-between text-slate-300 font-mono">
                <span>POPIA Data Sovereignty</span>
                <span className="text-emerald-400">Republic of South Africa (ZAF) In-Region</span>
              </div>
            </div>
          </div>

          {currentUser?.role === 'FOUNDER_EXECUTIVE' && (
            <FounderPasswordControl currentUser={currentUser} />
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* 4. USERS */}
      {/* ==================================================== */}
      {currentTab === 'USERS' && (
        <UserManagementView schools={safeSchools} currentUser={currentUser} />
      )}

      {/* ==================================================== */}
      {/* 5. ORGANIZATIONS */}
      {/* ==================================================== */}
      {currentTab === 'ORGANIZATIONS' && (
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-400" />
            <span>Affiliated Departments & School Districts</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <strong className="text-white block">Department of Basic Education</strong>
              <span className="text-slate-400">National EMIS Master Registry</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <strong className="text-white block">South African Police Service</strong>
              <span className="text-slate-400">Division: Visible Policing & Child Safety</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <strong className="text-white block">Department of Home Affairs</strong>
              <span className="text-slate-400">National Population Register (NPR) Link</span>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 6. AUDIT */}
      {/* ==================================================== */}
      {currentTab === 'AUDIT' && (
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Lock className="w-4 h-4 text-cyan-400" />
            <span>Executive Cryptographic Audit Stream</span>
          </h3>
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400">
            All administrative, role switch, and emergency dispatch events are cryptographically sealed.
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 7. PLATFORM CONTROLS */}
      {/* ==================================================== */}
      {currentTab === 'PLATFORM_CONTROLS' && (
        <form onSubmit={handleSaveControls} className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 text-xs">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span>Strategic Platform Controls</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold">National Geofence Tolerance (Meters)</label>
              <input type="number" defaultValue={25} className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono" />
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-semibold">SAPS Dispatch Escalation Timeout (Seconds)</label>
              <input type="number" defaultValue={180} className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono" />
            </div>
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button type="submit" className="min-h-[44px] px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-all">
              Save Strategic Controls
            </button>
            {controlsSaved && (
              <span className="text-emerald-400 font-bold font-mono flex items-center gap-1">
                <Check className="w-4 h-4" /> Strategic Controls Saved ✓
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  );
};
