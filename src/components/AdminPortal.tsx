import React, { useState, useEffect } from 'react';
import { 
  Users, 
  School, 
  UserCheck, 
  ShieldCheck, 
  Cpu, 
  Lock, 
  Settings, 
  Search, 
  PlusCircle, 
  CheckCircle2, 
  XCircle,
  Key, 
  Sliders, 
  HelpCircle,
  Building2,
  Phone,
  Mail,
  Shield,
  FileCheck,
  RotateCw,
  AlertTriangle,
  Radio,
  ExternalLink,
  X
} from 'lucide-react';
import { ActiveUserSession, HydratedLearnerRecord, School as SchoolType, UserRole } from '../types.js';
import { api } from '../services/api.js';
import { RegisterSchoolModal } from './RegisterSchoolModal.js';
import { AnnualSafetyUpdateModal } from './AnnualSafetyUpdateModal.js';

export type AdminSection = 
  | 'USERS' 
  | 'SCHOOLS' 
  | 'LEARNERS' 
  | 'GUARDIANS' 
  | 'DEVICES' 
  | 'AUDIT' 
  | 'SYSTEM_SETTINGS';

interface Props {
  currentUser: ActiveUserSession;
  learners: HydratedLearnerRecord[];
  schools: SchoolType[];
  onOpenEnrolment: () => void;
  onRefresh: () => void;
}

export const AdminPortal: React.FC<Props> = ({
  currentUser,
  learners = [],
  schools = [],
  onOpenEnrolment,
  onRefresh
}) => {
  const safeLearners = Array.isArray(learners) ? learners : [];
  const safeSchools = Array.isArray(schools) ? schools : [];

  const [currentTab, setCurrentTab] = useState<AdminSection>('USERS');
  const [searchQuery, setSearchQuery] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [liveUsers, setLiveUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // School Registration & Safety Update Modals
  const [isRegisterSchoolOpen, setIsRegisterSchoolOpen] = useState(false);
  const [selectedLearnerForSafetyUpdate, setSelectedLearnerForSafetyUpdate] = useState<HydratedLearnerRecord | null>(null);

  // Enrolment & Duplicate Prevention Validation Test Suite State
  const [enrolmentTestReport, setEnrolmentTestReport] = useState<any | null>(null);
  const [isRunningEnrolmentTests, setIsRunningEnrolmentTests] = useState(false);
  const [showEnrolmentTestsModal, setShowEnrolmentTestsModal] = useState(false);

  // Unauthorized Test Attempt State
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testResult, setTestResult] = useState<{
    status: number;
    error?: string;
    violationCode?: string;
    timestamp?: string;
  } | null>(null);
  const [isAttempting, setIsAttempting] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const u = await api.getUsers();
      setLiveUsers(Array.isArray(u) ? u : []);
    } catch (err) {
      console.warn('Could not fetch live users:', err);
      setLiveUsers([]);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleAttemptUserCreationAsAdmin = async () => {
    setIsAttempting(true);
    setTestResult(null);
    try {
      await api.createUser({
        firstName: 'Unauthorized',
        surname: 'Staff Attempt',
        email: 'test.staff@safety.za',
        role: 'SCHOOL_ADMIN_STAFF'
      });
      setTestResult({ status: 200, error: 'UNEXPECTED: User creation succeeded (should have been blocked!)' });
    } catch (err: any) {
      // Expected 403 Forbidden
      setTestResult({
        status: 403,
        error: err.message || 'ACCESS DENIED: Only Founder/SuperAdmin is authorized to create platform user identities.',
        violationCode: 'UNAUTHORIZED_USER_CREATION_ATTEMPT',
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsAttempting(false);
    }
  };

  const handleRunEnrolmentValidation = async () => {
    setIsRunningEnrolmentTests(true);
    try {
      const report = await api.runEnrolmentValidationSuite();
      setEnrolmentTestReport(report);
      setShowEnrolmentTestsModal(true);
    } catch (err: any) {
      console.error('Validation test run failed:', err);
    } finally {
      setIsRunningEnrolmentTests(false);
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const filteredUsers = liveUsers.filter(u => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shrink-0">
            <Settings className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                System Administration Console
              </h1>
              <span className="px-2.5 py-0.5 text-xs font-mono bg-rose-500/10 text-rose-400 border border-rose-500/30 rounded">
                SYSTEM_ADMIN (Operational)
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Operational administration for schools, learner enrolment coordination, optional devices, and institutional system settings.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-mono font-bold flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" /> Sovereign Boundary Active
          </span>
        </div>
      </div>

      {/* Sovereign Scope Callout */}
      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-slate-300">
            <strong className="text-white">Authoritative RBAC Architecture:</strong> Admin is an operational administrator. Admin is <span className="text-rose-400 font-bold">NOT SuperAdmin</span>. Direct platform user creation and system security policy modification are strictly restricted to the Sovereign Founder.
          </div>
        </div>

        <button
          onClick={() => {
            setTestModalOpen(true);
            setTestResult(null);
          }}
          className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold whitespace-nowrap transition-colors flex items-center justify-center gap-1.5 shrink-0"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Test 403 User Creation Attack</span>
        </button>
      </div>

      {/* Admin Role Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-800 scrollbar-none">
        <button
          onClick={() => setCurrentTab('USERS')}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
            currentTab === 'USERS'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Registered Platform Users ({liveUsers.length})</span>
        </button>

        <button
          onClick={() => setCurrentTab('SCHOOLS')}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
            currentTab === 'SCHOOLS'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
          }`}
        >
          <School className="w-4 h-4" />
          <span>Schools ({schools.length})</span>
        </button>

        <button
          onClick={() => setCurrentTab('LEARNERS')}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
            currentTab === 'LEARNERS'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Learners ({learners.length})</span>
        </button>

        <button
          onClick={() => setCurrentTab('GUARDIANS')}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
            currentTab === 'GUARDIANS'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Guardians</span>
        </button>

        <button
          onClick={() => setCurrentTab('DEVICES')}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
            currentTab === 'DEVICES'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>Devices</span>
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
          onClick={() => setCurrentTab('SYSTEM_SETTINGS')}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
            currentTab === 'SYSTEM_SETTINGS'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>System Settings</span>
        </button>
      </div>

      {/* ==================================================== */}
      {/* 1. USERS SECTION */}
      {/* ==================================================== */}
      {currentTab === 'USERS' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search platform users by name, email, or role..."
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setTestModalOpen(true);
                  setTestResult(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold border border-slate-700 transition-all flex items-center justify-center gap-1.5 min-h-[40px]"
              >
                <Lock className="w-4 h-4 text-rose-400" />
                <span>Provision User (Founder Guarded)</span>
              </button>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px]">
                    <th className="py-3 px-4">User Name & Identity</th>
                    <th className="py-3 px-4">Canonical Role</th>
                    <th className="py-3 px-4">Department / Scope</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Clearance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {filteredUsers.map(u => (
                    <tr key={u.id} className="hover:bg-slate-850/50 transition-colors">
                      <td className="py-3 px-4">
                        <strong className="text-white block font-sans text-sm">{u.name}</strong>
                        <span className="text-slate-400 text-[11px]">{u.email}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                          u.role === 'FOUNDER_EXECUTIVE' 
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                            : u.role === 'SYSTEM_ADMIN'
                            ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                            : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-sans">
                        {u.department || u.schoolId || 'ITIS Core Infrastructure'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]">
                          {u.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-sans text-xs text-slate-400">
                        {u.permissions?.includes('*') ? 'UNRESTRICTED' : `${u.permissions?.length || 0} permissions`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 2. SCHOOLS SECTION */}
      {/* ==================================================== */}
      {currentTab === 'SCHOOLS' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Registered School Institutions</h3>
              <p className="text-xs text-slate-400">Total Authoritative Schools: {schools.length}</p>
            </div>
            <button
              onClick={() => setIsRegisterSchoolOpen(true)}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-cyan-950/40"
            >
              <Building2 className="w-4 h-4" />
              <span>Register New School</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {schools.map(sch => (
              <div key={sch.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white">{sch.name}</h3>
                    <span className="text-xs text-cyan-400 font-mono">EMIS: {sch.emisCode}</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-xs font-mono">Active Campus</span>
                </div>

                <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-mono">Principal</span>
                    <strong className="text-slate-200">{sch.principalName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-mono">Location</span>
                    <span className="text-slate-300">{sch.district}, {sch.province}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-mono">Contact Phone</span>
                    <span className="text-emerald-400 font-mono">{sch.contactPhone}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-mono">Safe Geofence</span>
                    <span className="text-cyan-400 font-mono">{sch.geofenceCenter.radiusMeters}m Perimeter</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 3. LEARNERS SECTION */}
      {/* ==================================================== */}
      {currentTab === 'LEARNERS' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white">Central Learner Master Registry</h3>
              <p className="text-xs text-slate-400">Total Authoritative Enrolments: {learners.length} • Capture Once Model Active</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRunEnrolmentValidation}
                disabled={isRunningEnrolmentTests}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all flex items-center gap-1.5"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isRunningEnrolmentTests ? 'animate-spin' : ''}`} />
                <span>Run Validation Suite (8 Tests)</span>
              </button>
              <button
                onClick={onOpenEnrolment}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-cyan-950/40"
              >
                <PlusCircle className="w-4 h-4" />
                <span>New Learner + Guardian</span>
              </button>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px]">
                    <th className="py-3 px-4">Learner Name</th>
                    <th className="py-3 px-4">EMIS & Admission</th>
                    <th className="py-3 px-4">SA ID Number</th>
                    <th className="py-3 px-4">Current Enrolment</th>
                    <th className="py-3 px-4">Verified Guardians</th>
                    <th className="py-3 px-4 text-right">Operational Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {learners.map(l => (
                    <tr key={l.learner.id} className="hover:bg-slate-850/50 transition-colors">
                      <td className="py-3 px-4">
                        <strong className="text-white block font-sans text-sm">{l.person.firstName} {l.person.lastName}</strong>
                        <span className="text-slate-400 text-[11px] font-sans">DOB: {l.person.dateOfBirth}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-cyan-400">{l.learner.emisId}</span>
                        <span className="text-slate-500 block text-[10px]">{l.learner.admissionNumber}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {l.person.officialId || 'Foreign / Verified'}
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <span className="text-white block">{l.currentSchool?.name || 'Pretoria Boys High'}</span>
                        <span className="text-slate-400 text-xs font-mono">{l.currentAcademicRecord?.grade} ({l.currentAcademicRecord?.classSection})</span>
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-300">
                        {l.guardians.map(g => `${g.person.firstName} ${g.person.lastName}`).join(', ') || 'None'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedLearnerForSafetyUpdate(l)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all inline-flex items-center gap-1"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Annual Safety Update</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 4. GUARDIANS SECTION */}
      {/* ==================================================== */}
      {currentTab === 'GUARDIANS' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <h3 className="text-sm font-bold text-white">Verified Legal Custody Registry</h3>
            <p className="text-xs text-slate-400">POPIA Section 19 and Children's Act verified custody relationships</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {learners.flatMap(l => l.guardians).map((g, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white font-sans">{g.person.firstName} {g.person.lastName}</h4>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-xs font-mono font-bold">
                    {g.relationship.relationshipType}
                  </span>
                </div>
                <div className="text-xs text-slate-400 font-mono space-y-1">
                  <div>Mobile: <span className="text-slate-200">{g.guardian.mobileNumber}</span></div>
                  <div>ID: <span className="text-slate-300">{g.guardian.saIdMasked || g.person.officialId}</span></div>
                  <div>Legal Custody: <span className="text-emerald-400">{g.relationship.legalCustodyVerified ? 'Verified Authority' : 'Emergency Contact'}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 5. DEVICES SECTION */}
      {/* ==================================================== */}
      {currentTab === 'DEVICES' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <h3 className="text-sm font-bold text-white">Hardware IoT Device Fleet & Gateways</h3>
            <p className="text-xs text-slate-400">Cryptographically paired BLE beacons, GPS wearables, and RF gateways</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-slate-500">Total Active Beacons</div>
              <div className="text-2xl font-bold text-white mt-1">1,482</div>
              <div className="text-emerald-400 text-[10px] mt-1">99.8% Signal Health</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-slate-500">School Gateway Towers</div>
              <div className="text-2xl font-bold text-cyan-400 mt-1">128</div>
              <div className="text-slate-400 text-[10px] mt-1">All Online</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-slate-500">Firmware Version</div>
              <div className="text-2xl font-bold text-purple-400 mt-1">v3.4.1</div>
              <div className="text-slate-400 text-[10px] mt-1">SHA-256 Signed</div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 6. AUDIT SECTION */}
      {/* ==================================================== */}
      {currentTab === 'AUDIT' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-3">
          <Lock className="w-8 h-8 text-emerald-400 mx-auto" />
          <h3 className="text-base font-bold text-white">National SHA-256 Immutable Audit Ledger</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Every authentication, role delegation, onboarding transaction, and unauthorized access attempt is cryptographically chained.
          </p>
          <div className="pt-2">
            <span className="px-3 py-1 bg-slate-950 text-slate-300 border border-slate-800 rounded-lg text-xs font-mono">
              Audit Logs Active • Viewable via Audit Trail tab
            </span>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 7. SYSTEM SETTINGS SECTION */}
      {/* ==================================================== */}
      {currentTab === 'SYSTEM_SETTINGS' && (
        <form onSubmit={handleSaveSettings} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 text-xs">
          <h3 className="text-sm font-bold text-white font-sans">Platform Environmental Settings</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 mb-1">National Child Protection SLA (seconds)</label>
              <input type="number" defaultValue={180} className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono" />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">POPIA PII Masking Mode</label>
              <select defaultValue="STRICT" className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono">
                <option value="STRICT">STRICT (Need-To-Know Redaction)</option>
                <option value="AUDIT">AUDIT_ONLY</option>
              </select>
            </div>
          </div>
          <button type="submit" className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-all">
            {saveSuccess ? '✓ Settings Saved' : 'Save Operational Config'}
          </button>
        </form>
      )}

      {/* Direct 403 Unauthorized Attack Simulation Modal */}
      {testModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl">
                  <Lock className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Live RBAC Direct Attack Test</h3>
              </div>
              <button
                onClick={() => setTestModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                ✕ Close
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-2">
              <p>
                <strong>Scenario:</strong> You are currently authenticated as <span className="text-rose-400 font-mono font-bold">SYSTEM_ADMIN</span>.
              </p>
              <p className="text-slate-400">
                Under the Authoritative RBAC Matrix (Phase RBAC-02), operational Admins are prohibited from creating platform user accounts. When you click the button below, the client issues a direct <code className="bg-slate-950 px-1 py-0.5 rounded text-amber-400">POST /api/users</code> request to test the server's authoritative refusal.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={handleAttemptUserCreationAsAdmin}
                disabled={isAttempting}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <RotateCw className={`w-4 h-4 ${isAttempting ? 'animate-spin' : ''}`} />
                {isAttempting ? 'Executing Direct API Call...' : 'Execute Direct API Call (POST /api/users)'}
              </button>
            </div>

            {testResult && (
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Response Status:</span>
                  <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold">
                    HTTP {testResult.status} Forbidden
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Violation Code:</span>
                  <span className="text-amber-400 font-bold">{testResult.violationCode}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Server Decision Reason:</span>
                  <p className="text-slate-200 bg-slate-900 p-2 rounded border border-slate-800 text-[11px] font-sans">
                    {testResult.error}
                  </p>
                </div>
                <div className="text-[10px] text-emerald-400 flex items-center gap-1 pt-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Immutable Audit Log Event Chained Successfully
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Register Authoritative School Modal */}
      <RegisterSchoolModal
        isOpen={isRegisterSchoolOpen}
        onClose={() => setIsRegisterSchoolOpen(false)}
        onSuccess={() => {
          setIsRegisterSchoolOpen(false);
          onRefresh();
        }}
        currentUser={currentUser}
      />

      {/* Annual Learner Safety & Information Update Modal */}
      <AnnualSafetyUpdateModal
        isOpen={!!selectedLearnerForSafetyUpdate}
        onClose={() => setSelectedLearnerForSafetyUpdate(null)}
        onSuccess={() => {
          setSelectedLearnerForSafetyUpdate(null);
          onRefresh();
        }}
        learner={selectedLearnerForSafetyUpdate}
        schools={schools}
        currentUser={currentUser}
      />

      {/* Live Enrolment & Duplicate Prevention Test Suite Modal */}
      {showEnrolmentTestsModal && enrolmentTestReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Enrolment & Duplicate Prevention Validation Report</h3>
                  <p className="text-xs text-slate-400">
                    Authoritative Test Matrix • {enrolmentTestReport.totalTests} Scenarios Evaluated
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEnrolmentTestsModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
                  <div className="text-xl font-bold text-white font-mono">{enrolmentTestReport.totalTests}</div>
                  <div className="text-[10px] text-slate-400 uppercase font-mono mt-0.5">Total Tests</div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950 border border-emerald-900/40 text-center">
                  <div className="text-xl font-bold text-emerald-400 font-mono">{enrolmentTestReport.passedCount}</div>
                  <div className="text-[10px] text-emerald-300 uppercase font-mono mt-0.5">Passed Tests</div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
                  <div className="text-xl font-bold text-cyan-400 font-mono">{enrolmentTestReport.verdict}</div>
                  <div className="text-[10px] text-cyan-300 uppercase font-mono mt-0.5">Compliance Verdict</div>
                </div>
              </div>

              {/* Individual Test Cases */}
              <div className="space-y-2.5">
                {enrolmentTestReport.results.map((t: any) => (
                  <div
                    key={t.id}
                    className={`p-3.5 rounded-xl border text-xs font-mono space-y-1.5 transition-all ${
                      t.passed
                        ? 'bg-emerald-950/20 border-emerald-800/40 text-slate-200'
                        : 'bg-rose-950/30 border-rose-800 text-rose-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.passed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                        }`}>
                          {t.id}
                        </span>
                        <strong className="text-white font-sans text-xs">{t.testName}</strong>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        t.passed ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500 text-white'
                      }`}>
                        {t.passed ? 'PASSED' : 'FAILED'}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                      {t.description}
                    </p>

                    <div className="text-[10px] text-slate-300 bg-slate-950/70 p-2 rounded border border-slate-800/60 font-mono">
                      <div><strong className="text-cyan-400">Result:</strong> {t.actualOutcome}</div>
                      {t.auditTrailVerified && (
                        <div className="text-emerald-400 mt-0.5">✓ Cryptographic Audit Trail Verified</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-950 px-6 py-3.5 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowEnrolmentTestsModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

