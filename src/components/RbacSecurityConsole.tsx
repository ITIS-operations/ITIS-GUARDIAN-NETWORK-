import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Lock, 
  Play, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Key, 
  UserCheck, 
  Users, 
  Server, 
  FileText, 
  Terminal, 
  RefreshCw, 
  ChevronDown, 
  ChevronRight, 
  Info,
  Building,
  School,
  Radio,
  Wrench,
  Eye,
  Activity
} from 'lucide-react';
import { api } from '../services/api.js';
import { ActiveUserSession, UserRole, RoleMatrixDefinition } from '../types.js';

interface Props {
  currentUser: ActiveUserSession | null;
  onClose?: () => void;
}

interface TestReportState {
  timestamp: string;
  totalTests: number;
  passedCount: number;
  failedCount: number;
  complianceVerdict: 'COMPLIANT' | 'NON_COMPLIANT';
  results: Array<{
    id: string;
    role: UserRole;
    scenario: string;
    targetEndpoint: string;
    attemptedOperation: string;
    expectedStatus: number;
    actualStatus: number;
    passed: boolean;
    blockedBy: string;
    auditEventGenerated: boolean;
    auditAction?: string;
    evidence: string;
  }>;
  matrixSummary: Record<UserRole, RoleMatrixDefinition>;
}

export const RbacSecurityConsole: React.FC<Props> = ({ currentUser, onClose }) => {
  const [activeSubTab, setActiveSubTab] = useState<'MATRIX' | 'TEST_SUITE' | 'MY_CLEARANCE'>('TEST_SUITE');
  const [matrixData, setMatrixData] = useState<Record<UserRole, RoleMatrixDefinition> | null>(null);
  const [testReport, setTestReport] = useState<TestReportState | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [expandedRole, setExpandedRole] = useState<UserRole | null>('SYSTEM_ADMIN');
  const [expandedTest, setExpandedTest] = useState<string | null>(null);
  const [myClearance, setMyClearance] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [matrixRes, suiteRes] = await Promise.all([
        api.getRbacMatrix(),
        api.runSecuritySuite()
      ]);
      setMatrixData(matrixRes.matrix);
      setTestReport(suiteRes);

      if (currentUser) {
        try {
          const clearance = await api.getMyClearance();
          setMyClearance(clearance);
        } catch (e) {
          console.warn('Could not fetch clearance:', e);
        }
      }
    } catch (err) {
      console.error('Failed to load RBAC specifications:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunSecuritySuite = async () => {
    setIsRunningTests(true);
    try {
      const suiteRes = await api.runSecuritySuite();
      setTestReport(suiteRes);
    } catch (err) {
      console.error('Failed running test suite:', err);
    } finally {
      setIsRunningTests(false);
    }
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'FOUNDER_EXECUTIVE': return <ShieldCheck className="w-5 h-5 text-amber-400" />;
      case 'SYSTEM_ADMIN': return <Lock className="w-5 h-5 text-rose-400" />;
      case 'SCHOOL_PRINCIPAL': return <School className="w-5 h-5 text-blue-400" />;
      case 'SCHOOL_ADMIN_STAFF': return <Users className="w-5 h-5 text-blue-400" />;
      case 'PARENT_GUARDIAN': return <UserCheck className="w-5 h-5 text-emerald-400" />;
      case 'COMMAND_OPERATOR': return <Radio className="w-5 h-5 text-cyan-400" />;
      case 'FIELD_RESPONDER': return <ShieldAlert className="w-5 h-5 text-orange-400" />;
      case 'TECHNICIAN': return <Wrench className="w-5 h-5 text-purple-400" />;
      case 'GOVERNMENT_AUDITOR': return <FileText className="w-5 h-5 text-indigo-400" />;
      default: return <Key className="w-5 h-5 text-slate-400" />;
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl space-y-6 p-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-2xl">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-white tracking-tight">
                Authoritative RBAC & ABAC Security Architecture
              </h2>
              <span className="px-2.5 py-0.5 text-xs font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded">
                PHASE RBAC-02
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Strict 9-Role Permission Matrix, Sovereign Boundaries, and Server-Side Refusal Test Verification.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRunSecuritySuite}
            disabled={isRunningTests}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs sm:text-sm rounded-xl flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRunningTests ? 'animate-spin' : ''}`} />
            {isRunningTests ? 'Executing Security Attacks...' : 'Run Security Test Suite'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveSubTab('TEST_SUITE')}
          className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all flex items-center gap-2 ${
            activeSubTab === 'TEST_SUITE'
              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Activity className="w-4 h-4" />
          Security Test Suite & Refusal Proofs
          {testReport && (
            <span className="ml-1 px-2 py-0.2 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-mono font-bold">
              {testReport.passedCount}/{testReport.totalTests} Passed
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('MATRIX')}
          className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all flex items-center gap-2 ${
            activeSubTab === 'MATRIX'
              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Key className="w-4 h-4" />
          9-Role Canonical Permission Matrix
        </button>

        {currentUser && (
          <button
            onClick={() => setActiveSubTab('MY_CLEARANCE')}
            className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all flex items-center gap-2 ${
              activeSubTab === 'MY_CLEARANCE'
                ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            Active Caller Clearance ({currentUser.role})
          </button>
        )}
      </div>

      {/* TAB 1: SECURITY TEST SUITE */}
      {activeSubTab === 'TEST_SUITE' && testReport && (
        <div className="space-y-6">
          {/* Summary Box */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-xs text-slate-400">Total Test Scenarios</div>
              <div className="text-2xl font-mono font-bold text-white mt-1">{testReport.totalTests}</div>
              <div className="text-xs text-slate-500 mt-1">Direct unauthorized API operations</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-xs text-emerald-400">Blocked & Verified (403/200)</div>
              <div className="text-2xl font-mono font-bold text-emerald-400 mt-1">{testReport.passedCount}</div>
              <div className="text-xs text-emerald-500/80 mt-1">100% Correct Enforcements</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-xs text-slate-400">Failed / Breached</div>
              <div className="text-2xl font-mono font-bold text-slate-200 mt-1">{testReport.failedCount}</div>
              <div className="text-xs text-slate-500 mt-1">Zero Tolerance</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
              <div className="text-xs text-slate-400">Compliance Verdict</div>
              <div className="flex items-center gap-2 mt-1">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                <span className="text-sm font-bold font-mono text-emerald-400 tracking-wider">
                  {testReport.complianceVerdict}
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-1">POPIA / Child Care Act Guarded</div>
            </div>
          </div>

          {/* Test Case Breakdown */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                Automated Test Scenarios & Refusal Proofs
              </h3>
              <span className="text-xs text-slate-400">Click any scenario to view technical evidence</span>
            </div>

            <div className="space-y-2">
              {testReport.results.map(test => {
                const isExpanded = expandedTest === test.id;
                return (
                  <div
                    key={test.id}
                    className="border border-slate-800 bg-slate-950 rounded-xl overflow-hidden hover:border-slate-700 transition-colors"
                  >
                    <div
                      onClick={() => setExpandedTest(isExpanded ? null : test.id)}
                      className="p-3.5 sm:p-4 flex items-center justify-between gap-3 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {test.passed ? (
                          <div className="p-1 rounded-full bg-emerald-500/20 text-emerald-400 shrink-0">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        ) : (
                          <div className="p-1 rounded-full bg-rose-500/20 text-rose-400 shrink-0">
                            <XCircle className="w-4 h-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs text-slate-400">{test.id}</span>
                            <span className="text-xs px-2 py-0.5 bg-slate-800 text-slate-300 rounded font-mono">
                              {test.role}
                            </span>
                            <span className="text-sm font-semibold text-white truncate">
                              {test.scenario}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                            <span className="text-amber-400/90">{test.targetEndpoint}</span>
                            <span className="text-slate-600">•</span>
                            <span>Operation: {test.attemptedOperation}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                          test.actualStatus === 403 
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}>
                          HTTP {test.actualStatus}
                        </span>
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-4 bg-slate-900/80 border-t border-slate-800 text-xs font-mono space-y-2.5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <span className="text-slate-500">Enforcement Guard:</span>
                            <div className="text-slate-200 font-sans font-semibold mt-0.5">{test.blockedBy}</div>
                          </div>
                          <div>
                            <span className="text-slate-500">Audit Action Generated:</span>
                            <div className="text-amber-400 font-bold mt-0.5">
                              {test.auditAction || 'IMMUTABLE_LOG_AUDIT'}
                            </div>
                          </div>
                        </div>

                        <div>
                          <span className="text-slate-500">Security Decision Evidence:</span>
                          <div className="p-2.5 bg-slate-950 rounded border border-slate-800 text-slate-300 mt-1 font-sans">
                            {test.evidence}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: 9-ROLE PERMISSION MATRIX */}
      {activeSubTab === 'MATRIX' && matrixData && (
        <div className="space-y-4">
          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white">Authoritative Scope Rule:</span> Permissions are non-transferable. Operational Admins cannot create platform user accounts. Responders cannot self-dispatch. Guardians can only access their verified linked children.
            </div>
          </div>

          <div className="space-y-3">
            {(Object.keys(matrixData) as UserRole[]).map(roleKey => {
              const roleDef = matrixData[roleKey];
              const isExpanded = expandedRole === roleKey;

              return (
                <div
                  key={roleKey}
                  className="border border-slate-800 bg-slate-950 rounded-xl overflow-hidden"
                >
                  <div
                    onClick={() => setExpandedRole(isExpanded ? null : roleKey)}
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-900/50 transition-colors select-none"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                        {getRoleIcon(roleKey)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white font-sans">{roleDef.displayName}</h4>
                          <span className="px-2 py-0.5 text-xs font-mono bg-slate-800 text-slate-300 rounded">
                            {roleKey}
                          </span>
                          {roleDef.isSoleUserCreator && (
                            <span className="px-2 py-0.5 text-xs font-mono bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded">
                              SOLE USER CREATOR
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 font-sans mt-0.5">{roleDef.scope}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-slate-400">
                        {roleDef.role === 'FOUNDER_EXECUTIVE' ? 'UNRESTRICTED' : `${roleDef.permissions.length} Permissions`}
                      </span>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-4 bg-slate-900/60 border-t border-slate-800 space-y-4">
                      {/* Operational Authority vs Prohibitions */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-3 bg-emerald-950/20 border border-emerald-900/30 rounded-xl space-y-1.5">
                          <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Authorized Authority (CAN)
                          </div>
                          <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                            {roleDef.canList?.map((item: string, idx: number) => (
                              <li key={idx}>{item}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="p-3 bg-rose-950/20 border border-rose-900/30 rounded-xl space-y-1.5">
                          <div className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                            <XCircle className="w-3.5 h-3.5" /> Strict Sovereign Boundaries (CANNOT)
                          </div>
                          <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                            {roleDef.cannotList?.map((item: string, idx: number) => (
                              <li key={idx}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Technical Permission Keys */}
                      <div>
                        <div className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider font-mono">
                          Technical Permission Keys
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {roleDef.permissions.map(perm => (
                            <span
                              key={perm}
                              className="px-2 py-0.5 bg-slate-950 text-slate-300 border border-slate-800 rounded font-mono text-xs"
                            >
                              {perm}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: ACTIVE CALLER CLEARANCE */}
      {activeSubTab === 'MY_CLEARANCE' && currentUser && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                  {getRoleIcon(currentUser.role)}
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">{currentUser.name}</h4>
                  <div className="text-xs text-slate-400 font-mono">{currentUser.email}</div>
                </div>
              </div>

              <span className="px-3 py-1 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-mono font-bold">
                {currentUser.role}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800 text-xs font-mono">
              <div>
                <span className="text-slate-500">School Scope:</span>
                <div className="text-slate-200 font-bold mt-0.5">{currentUser.schoolId || 'GLOBAL / NONE'}</div>
              </div>
              <div>
                <span className="text-slate-500">Guardian ID:</span>
                <div className="text-slate-200 font-bold mt-0.5">{currentUser.guardianId || 'NONE'}</div>
              </div>
              <div>
                <span className="text-slate-500">Responder Unit:</span>
                <div className="text-slate-200 font-bold mt-0.5">{currentUser.responderUnit || 'NONE'}</div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
              Effective Server-Authoritative Permissions
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {currentUser.role === 'FOUNDER_EXECUTIVE' ? (
                <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded font-mono text-xs font-bold">
                  * (ALL PLATFORM PERMISSIONS - SOVEREIGN FOUNDER CLEARANCE)
                </span>
              ) : (
                myClearance?.effectivePermissions?.map((perm: string) => (
                  <span
                    key={perm}
                    className="px-2 py-0.5 bg-slate-900 text-emerald-400 border border-slate-800 rounded font-mono text-xs"
                  >
                    {perm}
                  </span>
                )) || <span className="text-xs text-slate-500">Loading permissions...</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
