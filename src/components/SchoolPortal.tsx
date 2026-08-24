import React, { useState } from 'react';
import { 
  School as SchoolIcon, 
  UserPlus, 
  GraduationCap, 
  Users, 
  Search, 
  ShieldCheck, 
  HeartPulse, 
  Radio, 
  MapPin, 
  Calendar,
  Layers,
  ChevronRight,
  History,
  Check,
  CheckCircle2,
  AlertTriangle,
  FileText,
  HelpCircle,
  Clock,
  RotateCw,
  Phone,
  Mail,
  X,
  PlusCircle,
  Eye
} from 'lucide-react';
import { HydratedLearnerRecord, School, ActiveUserSession } from '../types.js';
import { api } from '../services/api.js';
import { AnnualSafetyUpdateModal } from './AnnualSafetyUpdateModal.js';

export type SchoolSection = 
  | 'DASHBOARD' 
  | 'LEARNERS' 
  | 'ATTENDANCE' 
  | 'SCHOOL_SAFETY' 
  | 'ALERTS' 
  | 'REPORTS' 
  | 'SUPPORT';

interface Props {
  learners: HydratedLearnerRecord[];
  schools: School[];
  currentUser: ActiveUserSession;
  onOpenEnrolment: () => void;
  onRefresh: () => void;
}

export const SchoolPortal: React.FC<Props> = ({
  learners = [],
  schools = [],
  currentUser,
  onOpenEnrolment,
  onRefresh
}) => {
  const safeLearners = Array.isArray(learners) ? learners : [];
  const safeSchools = Array.isArray(schools) ? schools : [];

  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(currentUser?.schoolId || safeSchools[0]?.id || 'sch-001');
  const [currentTab, setCurrentTab] = useState<SchoolSection>('DASHBOARD');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState('ALL');
  
  // Grade Progression Modal State
  const [advancingLearner, setAdvancingLearner] = useState<HydratedLearnerRecord | null>(null);
  const [safetyUpdateLearner, setSafetyUpdateLearner] = useState<HydratedLearnerRecord | null>(null);
  const [newAcademicYear, setNewAcademicYear] = useState(2027);
  const [newGrade, setNewGrade] = useState('Grade 11');
  const [newClassSection, setNewClassSection] = useState('11-A');
  const [newTeacher, setNewTeacher] = useState('Mrs. S. Khumalo');
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [advanceMessage, setAdvanceMessage] = useState<string | null>(null);

  const currentSchool = safeSchools.find(s => s.id === selectedSchoolId) || safeSchools[0];

  const schoolLearners = safeLearners.filter(l => {
    if (!l || !l.person || !l.learner) return false;
    const matchesSchool = l.currentEnrolment?.schoolId === selectedSchoolId;
    const matchesSearch = searchQuery
      ? (l.person.firstName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.person.lastName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.learner.emisId || '').toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    const matchesGrade = selectedGradeFilter === 'ALL'
      ? true
      : l.currentAcademicRecord?.grade === selectedGradeFilter;

    return matchesSchool && matchesSearch && matchesGrade;
  });

  const handleAdvanceAcademicYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!advancingLearner) return;

    setIsAdvancing(true);
    try {
      await api.advanceGrade({
        learnerId: advancingLearner.learner.id,
        schoolId: selectedSchoolId,
        newYear: newAcademicYear,
        newGrade,
        newClassSection,
        homeroomTeacher: newTeacher,
        staffContext: {
          staffUserId: currentUser.id,
          staffName: currentUser.name,
          staffRole: currentUser.role
        }
      });
      setAdvanceMessage(`Successfully advanced ${advancingLearner.person.firstName} to ${newGrade} (${newClassSection}) without duplicating learner record!`);
      onRefresh();
      setTimeout(() => {
        setAdvancingLearner(null);
        setAdvanceMessage(null);
      }, 2000);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsAdvancing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* School Header & Stats */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shrink-0">
            <SchoolIcon className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight truncate">{currentSchool?.name}</h1>
              <span className="px-2 py-0.5 text-xs font-mono bg-slate-800 text-cyan-300 rounded border border-slate-700">
                {currentSchool?.emisCode}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
              <span>{currentSchool?.district} • {currentSchool?.province}</span>
              <span className="hidden sm:inline">• Principal: {currentSchool?.principalName}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenEnrolment}
            className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all shadow-md shadow-cyan-950/40 flex items-center justify-center gap-2 active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>Authoritative Enrolment</span>
          </button>
        </div>
      </div>

      {/* Role Navigation Bar for School */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-800 scrollbar-none">
        <button
          onClick={() => setCurrentTab('DASHBOARD')}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
            currentTab === 'DASHBOARD'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Dashboard</span>
        </button>

        <button
          onClick={() => setCurrentTab('LEARNERS')}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
            currentTab === 'LEARNERS'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Learners</span>
        </button>

        <button
          onClick={() => setCurrentTab('ATTENDANCE')}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
            currentTab === 'ATTENDANCE'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Attendance</span>
        </button>

        <button
          onClick={() => setCurrentTab('SCHOOL_SAFETY')}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
            currentTab === 'SCHOOL_SAFETY'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>School Safety</span>
        </button>

        <button
          onClick={() => setCurrentTab('ALERTS')}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
            currentTab === 'ALERTS'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>Alerts</span>
        </button>

        <button
          onClick={() => setCurrentTab('REPORTS')}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
            currentTab === 'REPORTS'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Reports</span>
        </button>

        <button
          onClick={() => setCurrentTab('SUPPORT')}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
            currentTab === 'SUPPORT'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>Support</span>
        </button>
      </div>

      {/* ==================================================== */}
      {/* 1. DASHBOARD OVERVIEW */}
      {/* ==================================================== */}
      {currentTab === 'DASHBOARD' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-semibold uppercase">Enrolled Learners</span>
              <div className="text-2xl font-bold text-white font-mono">{schoolLearners.length} Active</div>
              <span className="text-[11px] text-cyan-400 font-medium">100% DHA & EMIS Linked</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-semibold uppercase">Morning Check-In Rate</span>
              <div className="text-2xl font-bold text-emerald-400 font-mono">98.6%</div>
              <span className="text-[11px] text-slate-400">Class &amp; point attendance recorded</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-semibold uppercase">Authorized Guardians</span>
              <div className="text-2xl font-bold text-purple-400 font-mono">
                {new Set(schoolLearners.flatMap(l => l.guardians.map(g => g.guardian.id))).size} Verified
              </div>
              <span className="text-[11px] text-purple-300">Guardian notifications active</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-semibold uppercase">Safety Boundary</span>
              <div className="text-2xl font-bold text-emerald-400 font-mono">SECURE</div>
              <span className="text-[11px] text-emerald-300">Authorised school safety area</span>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 2. LEARNERS ROSTER */}
      {/* ==================================================== */}
      {(currentTab === 'LEARNERS' || currentTab === 'DASHBOARD') && (
        <div className="space-y-4">
          {/* Controls: Search & Filter */}
          <div className="p-3 sm:p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <div className="relative flex-1 min-w-0">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search learner, EMIS, ID..."
                  className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs focus:border-cyan-500 outline-none"
                />
              </div>

              <select
                value={selectedGradeFilter}
                onChange={e => setSelectedGradeFilter(e.target.value)}
                className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs outline-none"
              >
                <option value="ALL">All Grades</option>
                <option value="Grade 8">Grade 8</option>
                <option value="Grade 9">Grade 9</option>
                <option value="Grade 10">Grade 10</option>
                <option value="Grade 11">Grade 11</option>
                <option value="Grade 12">Grade 12</option>
              </select>
            </div>

            <div className="flex items-center gap-2 justify-between sm:justify-end">
              <span className="text-xs text-slate-400 font-mono">
                {schoolLearners.length} Registered Learners
              </span>
            </div>
          </div>

          {/* Roster Cards */}
          {schoolLearners.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <HelpCircle className="w-8 h-8 text-slate-500 mx-auto" />
              <strong className="text-white block text-sm">No learners found matching search</strong>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                WHAT HAPPENED: No active learner profiles match the search text or grade filter.
                <br />
                WHAT TO DO NEXT: Adjust your search terms or click "Authoritative Enrolment" above.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {schoolLearners.map((record) => {
                const primaryGuardian = record.guardians.find(g => g.relationship.isPrimary) || record.guardians[0];
                const academic = record.currentAcademicRecord;

                return (
                  <div
                    key={record.learner.id}
                    className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 hover:border-slate-700 transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Top identity row */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={record.learner.photoUrl || "https://images.unsplash.com/photo-1544717305-2782549b5136?w=150&auto=format&fit=crop&q=80"}
                            alt=""
                            className="w-12 h-12 rounded-xl object-cover border border-slate-700 shrink-0"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-bold text-white">
                                {record.person.firstName} {record.person.lastName}
                              </h3>
                            </div>
                            <span className="text-xs text-cyan-400 font-mono">
                              EMIS: {record.learner.emisId}
                            </span>
                          </div>
                        </div>

                        <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-800 text-cyan-300 border border-slate-700 font-mono">
                          {academic?.grade || 'Unassigned'} • {academic?.classSection || 'N/A'}
                        </span>
                      </div>

                      {/* Info grid */}
                      <div className="mt-3.5 grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs">
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase font-mono">Primary Guardian</span>
                          <strong className="text-slate-300 truncate block">
                            {primaryGuardian?.person.firstName} {primaryGuardian?.person.lastName}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase font-mono">Emergency Phone</span>
                          <span className="text-emerald-400 font-mono truncate block">
                            {primaryGuardian?.guardian.mobileNumber || 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase font-mono">Homeroom Teacher</span>
                          <span className="text-slate-300 truncate block">
                            {academic?.homeroomTeacher || 'Unassigned'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase font-mono">Safety ID / Point</span>
                          <span className="text-cyan-400 font-mono truncate block">
                            {record.learner.trackingBeaconId ? `Assigned #${record.learner.trackingBeaconId}` : 'Digital Profile'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action row */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs gap-2 flex-wrap">
                      <span className="text-slate-400">
                        {record.guardians.length} Registered Guardian{record.guardians.length > 1 ? 's' : ''}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSafetyUpdateLearner(record)}
                          className="min-h-[40px] px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 font-semibold transition-colors flex items-center gap-1.5"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Annual Safety Update</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setAdvancingLearner(record);
                            setNewGrade(academic?.grade === 'Grade 10' ? 'Grade 11' : 'Grade 12');
                            setNewClassSection(academic?.classSection || '11-A');
                          }}
                          className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-colors flex items-center gap-1.5"
                        >
                          <GraduationCap className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Advance Grade →</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* 3. ATTENDANCE SECTION */}
      {/* ==================================================== */}
      {currentTab === 'ATTENDANCE' && (
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Today's Verified Attendance &amp; Arrival Summary</span>
          </h3>

          <div className="space-y-2 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <strong className="text-white block">Grade 10 Attendance Rate</strong>
                <span className="text-slate-400">142 of 144 learners verified on campus</span>
              </div>
              <span className="text-emerald-400 font-mono font-bold">98.6% Attended</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <strong className="text-white block">Grade 11 Attendance Rate</strong>
                <span className="text-slate-400">138 of 140 learners verified on campus</span>
              </div>
              <span className="text-emerald-400 font-mono font-bold">98.5% Attended</span>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 4. SCHOOL SAFETY SECTION */}
      {/* ==================================================== */}
      {currentTab === 'SCHOOL_SAFETY' && (
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>Campus Safety Areas &amp; Journey Protection</span>
          </h3>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between text-slate-300">
              <span>Main Campus Entrance: Arrival Check-In Status</span>
              <span className="text-emerald-400 font-mono">ACTIVE • NORMAL FLOW</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Sports Field &amp; Campus Perimeter</span>
              <span className="text-emerald-400 font-mono">SECURE • 0 ALERTS</span>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 5. ALERTS SECTION */}
      {/* ==================================================== */}
      {currentTab === 'ALERTS' && (
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400" />
            <span>Active Safety Alerts & Incident Queue</span>
          </h3>

          <div className="p-6 text-center rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <strong className="text-white block text-sm">All Campus Zones Clear</strong>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              No active security incidents, perimeter warnings, or medical distress calls at {currentSchool?.name}.
            </p>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 6. REPORTS SECTION */}
      {/* ==================================================== */}
      {currentTab === 'REPORTS' && (
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-400" />
            <span>EMIS & National Safety Compliance Reports</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <strong className="text-white block">Monthly EMIS Attendance Export</strong>
              <p className="text-slate-400">Official DBE formatted CSV containing verified timestamps.</p>
              <button className="text-cyan-400 hover:text-cyan-300 font-bold">Export EMIS File →</button>
            </div>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <strong className="text-white block">Child Safety Audit Trail</strong>
              <p className="text-slate-400">Cryptographically sealed log of all gate entries and exits.</p>
              <button className="text-cyan-400 hover:text-cyan-300 font-bold">Download Audit Log →</button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 7. SUPPORT SECTION */}
      {/* ==================================================== */}
      {currentTab === 'SUPPORT' && (
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-cyan-400" />
            <span>ITIS School Support & Helpdesk</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <strong className="text-white block">24/7 School Safety Operations Desk</strong>
              <p className="text-slate-400">Attendance onboarding, safety zone configuration, and staff access support.</p>
              <a href="tel:0800000888" className="text-cyan-400 hover:text-cyan-300 font-mono font-bold block">
                Call: 0800 000 888 (Toll Free)
              </a>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <strong className="text-white block">DBE District Coordinator</strong>
              <p className="text-slate-400">Gauteng East District Office Child Protection Officer.</p>
              <a href="mailto:district@dbe.gov.za" className="text-cyan-400 hover:text-cyan-300 font-mono font-bold block">
                Email: district@dbe.gov.za
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* ADVANCE GRADE MODAL */}
      {/* ==================================================== */}
      {advancingLearner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-5 sm:p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white">
                  Advance Academic Grade
                </h3>
                <span className="text-xs text-cyan-400 font-mono">
                  {advancingLearner.person.firstName} {advancingLearner.person.lastName} ({advancingLearner.learner.emisId})
                </span>
              </div>
              <button
                onClick={() => setAdvancingLearner(null)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdvanceAcademicYear} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-400 block font-mono text-[11px]">AUTHORITATIVE ENTITY PRINCIPLE</span>
                <p className="text-slate-300">
                  Advancing academic placement creates a new historical record without changing the underlying biological Person identity or duplicating guardians.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">New Academic Year</label>
                  <input
                    type="number"
                    value={newAcademicYear}
                    onChange={e => setNewAcademicYear(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">New Grade</label>
                  <select
                    value={newGrade}
                    onChange={e => setNewGrade(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  >
                    <option value="Grade 9">Grade 9</option>
                    <option value="Grade 10">Grade 10</option>
                    <option value="Grade 11">Grade 11</option>
                    <option value="Grade 12">Grade 12</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Class Section</label>
                  <input
                    type="text"
                    value={newClassSection}
                    onChange={e => setNewClassSection(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                    placeholder="e.g. 11-A"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Homeroom Teacher</label>
                  <input
                    type="text"
                    value={newTeacher}
                    onChange={e => setNewTeacher(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                    placeholder="e.g. Mrs. S. Khumalo"
                    required
                  />
                </div>
              </div>

              {advanceMessage && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-2 font-mono">
                  <Check className="w-4 h-4" />
                  <span>{advanceMessage}</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAdvancingLearner(null)}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdvancing}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all flex items-center gap-2"
                >
                  <GraduationCap className="w-4 h-4" />
                  <span>{isAdvancing ? 'Saving Record...' : 'Confirm Grade Advancement'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Annual Learner Safety & Information Update Modal */}
      <AnnualSafetyUpdateModal
        isOpen={!!safetyUpdateLearner}
        onClose={() => setSafetyUpdateLearner(null)}
        onSuccess={() => {
          setSafetyUpdateLearner(null);
          onRefresh();
        }}
        learner={safetyUpdateLearner}
        schools={schools}
        currentUser={currentUser}
      />
    </div>
  );
};
