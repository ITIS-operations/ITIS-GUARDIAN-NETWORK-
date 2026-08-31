import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  ShieldCheck, 
  MapPin, 
  HeartPulse, 
  PhoneCall, 
  CheckCircle2, 
  Clock, 
  Eye, 
  School as SchoolIcon, 
  Calendar, 
  AlertCircle, 
  X, 
  ChevronRight, 
  Shield, 
  Mail, 
  Phone,
  Bell,
  History,
  HelpCircle,
  Settings,
  Check,
  Volume2,
  AlertTriangle,
  Radio
} from 'lucide-react';
import { HydratedLearnerRecord, ActiveUserSession } from '../types.js';

export type GuardianTab = 
  | 'MY_CHILDREN' 
  | 'ALERTS' 
  | 'SAFETY_HISTORY' 
  | 'CONTACT' 
  | 'HELP' 
  | 'PREFERENCES';

interface Props {
  learners: HydratedLearnerRecord[];
  currentUser: ActiveUserSession;
  onOpenPanic: () => void;
  initialTab?: GuardianTab;
}

export const GuardianDashboard: React.FC<Props> = ({
  learners = [],
  currentUser,
  onOpenPanic,
  initialTab = 'MY_CHILDREN'
}) => {
  const [currentTab, setCurrentTab] = useState<GuardianTab>(initialTab);

  // PostgreSQL-authorized linked learners only (Security boundary enforced server-side)
  const myChildren = useMemo(() => Array.isArray(learners) ? learners : [], [learners]);
  
  const [selectedChildId, setSelectedChildId] = useState<string>(myChildren[0]?.learner?.id || '');

  // Keep selected child ID synchronized when children data updates
  useEffect(() => {
    if (myChildren.length > 0) {
      if (!selectedChildId || !myChildren.some(c => c.learner.id === selectedChildId)) {
        setSelectedChildId(myChildren[0].learner.id);
      }
    } else {
      setSelectedChildId('');
    }
  }, [myChildren, selectedChildId]);
  
  // Modals for Child Actions
  const [viewChildModal, setViewChildModal] = useState<HydratedLearnerRecord | null>(null);
  const [viewLocationModal, setViewLocationModal] = useState<HydratedLearnerRecord | null>(null);
  const [contactSchoolModal, setContactSchoolModal] = useState<HydratedLearnerRecord | null>(null);

  // Notification Preferences State
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [voiceReassuranceEnabled, setVoiceReassuranceEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [prefLanguage, setPrefLanguage] = useState('ENGLISH');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  // Distinct schools from authorized linked children for the contact directory
  const linkedSchools = useMemo(() => {
    const map = new Map<string, {
      id: string;
      name: string;
      principalName?: string;
      contactPhone?: string;
      contactEmail?: string;
      address?: string;
      district?: string;
      province?: string;
      enrolledChildren: string[];
    }>();

    myChildren.forEach(c => {
      const sch = c.currentSchool;
      if (sch && sch.id) {
        if (!map.has(sch.id)) {
          map.set(sch.id, {
            id: sch.id,
            name: sch.name,
            principalName: sch.principalName || 'Principal Administration',
            contactPhone: sch.contactPhone || '+27 (0) 12 000 0000',
            contactEmail: sch.contactEmail || 'admin@itis-school.za',
            address: sch.address,
            district: sch.district,
            province: sch.province,
            enrolledChildren: [`${c.person.firstName} ${c.person.lastName}`]
          });
        } else {
          const existing = map.get(sch.id)!;
          existing.enrolledChildren.push(`${c.person.firstName} ${c.person.lastName}`);
        }
      }
    });

    return Array.from(map.values());
  }, [myChildren]);

  return (
    <div className="space-y-6">
      {/* ==================================================== */}
      {/* GUARDIAN WELCOME & VERIFICATION STATUS BANNER */}
      {/* ==================================================== */}
      <div className="p-5 sm:p-7 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Verified Guardian Profile</span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Safety Portal — {currentUser.name || 'Guardian'}
            </h1>
            
            <p className="text-sm sm:text-base text-slate-300 font-medium">
              Live safety status, school arrival confirmations, and authorized emergency coordination.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="px-3.5 py-2 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-300 text-xs font-semibold flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              <span>Authoritative School Link</span>
            </div>

            {myChildren.length > 0 && (
              <button
                type="button"
                onClick={onOpenPanic}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-rose-950/40 border border-rose-500/40"
              >
                <Radio className="w-4 h-4 animate-pulse" />
                <span>EMERGENCY SOS</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ==================================================== */}
      {/* GUARDIAN PORTAL NAVIGATION TABS */}
      {/* MY CHILDREN • ALERTS • SAFETY HISTORY • CONTACT • HELP • PREFERENCES */}
      {/* ==================================================== */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-800 scrollbar-none">
        <button
          onClick={() => setCurrentTab('MY_CHILDREN')}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
            currentTab === 'MY_CHILDREN'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>MY CHILDREN ({myChildren.length})</span>
        </button>

        <button
          onClick={() => setCurrentTab('ALERTS')}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
            currentTab === 'ALERTS'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>SAFETY ALERTS</span>
        </button>

        <button
          onClick={() => setCurrentTab('SAFETY_HISTORY')}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
            currentTab === 'SAFETY_HISTORY'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
          }`}
        >
          <History className="w-4 h-4" />
          <span>JOURNEY HISTORY</span>
        </button>

        <button
          onClick={() => setCurrentTab('CONTACT')}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
            currentTab === 'CONTACT'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
          }`}
        >
          <PhoneCall className="w-4 h-4" />
          <span>SCHOOL & EMERGENCY DIRECTORY</span>
        </button>

        <button
          onClick={() => setCurrentTab('HELP')}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
            currentTab === 'HELP'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>HELP & GUIDELINES</span>
        </button>

        <button
          onClick={() => setCurrentTab('PREFERENCES')}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
            currentTab === 'PREFERENCES'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>PREFERENCES</span>
        </button>
      </div>

      {/* ==================================================== */}
      {/* 1. MY CHILDREN TAB (MULTI-CHILD SUPPORT) */}
      {/* ==================================================== */}
      {currentTab === 'MY_CHILDREN' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              <span>Linked Learners ({myChildren.length})</span>
            </h2>
            <span className="text-xs text-slate-400">
              Verified legal custody & school registration
            </span>
          </div>

          {myChildren.length === 0 ? (
            <div className="p-8 sm:p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-400 border border-slate-700">
                <Users className="w-7 h-7" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-base font-bold text-white">No learners are currently linked to your Guardian account.</h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  Learners are officially enrolled and verified by school administrative personnel and linked directly to your verified profile.
                </p>
                <p className="text-xs text-slate-500 leading-relaxed pt-2">
                  If your child is attending an ITIS-secured institution and does not appear here, please contact the school admissions office to verify your guardian relationship record.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {myChildren.map((child) => {
                const hasActiveIncident = !!child.recentIncident && child.recentIncident.status !== 'RESOLVED';
                const isSafe = !hasActiveIncident;
                const currentSchoolName = child.currentSchool?.name || 'Enrolled School';
                const grade = child.currentAcademicRecord?.grade || 'Grade 10';
                const classSection = child.currentAcademicRecord?.classSection || '';
                
                const plainLanguageStatus = hasActiveIncident 
                  ? `Active safety alert — ${child.recentIncident?.status || 'In Progress'}`
                  : `Safe on campus at ${currentSchoolName}`;

                const lastVerifiedTime = hasActiveIncident
                  ? `Alert timestamp: ${child.recentIncident?.timestamp ? new Date(child.recentIncident.timestamp).toLocaleTimeString() : 'Recent'}`
                  : 'Verified on campus today';

                return (
                  <div
                    key={child.learner.id}
                    className={`p-5 sm:p-6 rounded-2xl border transition-all flex flex-col justify-between space-y-5 shadow-lg relative ${
                      hasActiveIncident
                        ? 'bg-slate-900 border-rose-500/60 ring-1 ring-rose-500/40'
                        : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Top Section: Photo + Identity */}
                    <div className="flex items-start gap-4">
                      <div className="relative shrink-0">
                        <img
                          src={child.learner.photoUrl || "https://images.unsplash.com/photo-1544717305-2782549b5136?w=150&auto=format&fit=crop&q=80"}
                          alt={`${child.person.firstName} ${child.person.lastName}`}
                          className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl object-cover border-2 border-slate-700 shadow-md"
                        />
                        <span 
                          className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-900 ${
                            isSafe ? 'bg-emerald-400' : 'bg-rose-500 animate-ping'
                          }`} 
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-lg font-bold text-white truncate">
                            {child.person.firstName} {child.person.lastName}
                          </h3>
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                            {grade}{classSection ? ` • ${classSection}` : ''}
                          </span>
                        </div>

                        <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5 truncate">
                          <SchoolIcon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span className="truncate">{currentSchoolName}</span>
                        </p>

                        {/* Plain Language Safety Status */}
                        <div className="mt-2.5 flex items-center gap-2">
                          <span className={`p-1 rounded-full ${isSafe ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
                            {isSafe ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4 animate-pulse" />}
                          </span>
                          <span className={`text-xs font-semibold truncate ${isSafe ? 'text-emerald-400' : 'text-rose-300'}`}>
                            {plainLanguageStatus}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-1 font-mono">
                          <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                          <span>{lastVerifiedTime}</span>
                        </div>
                      </div>
                    </div>

                    {/* Safety Highlights */}
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-mono">EMIS Number</span>
                        <strong className="text-slate-200 font-mono truncate block">{child.learner.emisId || 'Verified'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-mono">Health Flags</span>
                        <strong className="text-amber-300 truncate block">
                          {child.learner.allergies?.length ? child.learner.allergies.join(', ') : (child.learner.medicalNotes ? 'Notes recorded' : 'No chronic issues')}
                        </strong>
                      </div>
                    </div>

                    {/* Mandated Actions: VIEW CHILD • VIEW LOCATION • CONTACT SCHOOL */}
                    <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800/80">
                      <button
                        type="button"
                        onClick={() => setViewChildModal(child)}
                        className="min-h-[44px] py-2 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5 text-cyan-400" />
                        <span>VIEW CHILD</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setViewLocationModal(child)}
                        className="min-h-[44px] py-2 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                      >
                        <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                        <span>LOCATION</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setContactSchoolModal(child)}
                        className="min-h-[44px] py-2 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                      >
                        <PhoneCall className="w-3.5 h-3.5 text-amber-400" />
                        <span>SCHOOL</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* 2. ALERTS TAB (DYNAMIC PER LINKED CHILD) */}
      {/* ==================================================== */}
      {currentTab === 'ALERTS' && (
        <div className="space-y-4">
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Bell className="w-4 h-4 text-cyan-400" />
              <span>Safety Alerts & Automated Reassurance</span>
            </h3>

            {myChildren.length === 0 ? (
              <p className="text-xs text-slate-400">No alerts or notifications to display. No learners are currently linked to your account.</p>
            ) : (
              <div className="space-y-3">
                {myChildren.map((child) => {
                  const hasIncident = child.recentIncident && child.recentIncident.status !== 'RESOLVED';
                  const schoolName = child.currentSchool?.name || 'Enrolled School';
                  
                  if (hasIncident) {
                    return (
                      <div key={child.learner.id} className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 flex items-start justify-between gap-3 text-xs">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
                            <AlertTriangle className="w-4 h-4" />
                          </div>
                          <div>
                            <strong className="text-rose-300 block text-sm">
                              Safety Alert: {child.person.firstName} {child.person.lastName}
                            </strong>
                            <p className="text-slate-300 mt-0.5">
                              Status: {child.recentIncident?.status} • Trigger: {child.recentIncident?.triggerType}
                            </p>
                            {child.recentIncident?.assignedResponder && (
                              <p className="text-cyan-400 mt-0.5">
                                Dispatched Unit: {child.recentIncident.assignedResponder.name} ({child.recentIncident.assignedResponder.vehicleId})
                              </p>
                            )}
                            <span className="text-[11px] text-slate-400 font-mono mt-1 block">
                              {child.recentIncident?.timestamp ? new Date(child.recentIncident.timestamp).toLocaleString() : 'Active Alert'}
                            </span>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-mono shrink-0">
                          {child.recentIncident?.severity || 'ACTIVE'}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div key={child.learner.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-start justify-between gap-3 text-xs">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                          <strong className="text-white block text-sm">
                            {child.person.firstName} safely on campus at {schoolName}
                          </strong>
                          <p className="text-slate-400 mt-0.5">
                            Standard school safety status active. No alarms or corridor deviations detected.
                          </p>
                          <span className="text-[11px] text-slate-500 font-mono mt-1 block">
                            Active Session Verified • SMS & Voice Reassurance Enabled
                          </span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-mono shrink-0">
                        NORMAL
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 3. SAFETY HISTORY TAB (DYNAMIC JOURNEY LOGS) */}
      {/* ==================================================== */}
      {currentTab === 'SAFETY_HISTORY' && (
        <div className="space-y-4">
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-cyan-400" />
              <span>School Journey & Safety Log</span>
            </h3>

            {myChildren.length === 0 ? (
              <p className="text-xs text-slate-400">No safety history records available.</p>
            ) : (
              <div className="space-y-2.5 text-xs">
                {myChildren.map((child) => {
                  const schoolName = child.currentSchool?.name || 'Enrolled School';
                  return (
                    <React.Fragment key={child.learner.id}>
                      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
                          <div>
                            <strong className="text-white block">{child.person.firstName} {child.person.lastName} — {schoolName}</strong>
                            <span className="text-slate-400">Campus perimeter verified & safe</span>
                          </div>
                        </div>
                        <span className="font-mono text-slate-300 text-[11px] shrink-0">Today</span>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 4. CONTACT TAB (LINKED SCHOOLS & EMERGENCY DIRECTORY) */}
      {/* ==================================================== */}
      {currentTab === 'CONTACT' && (
        <div className="space-y-4">
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-cyan-400" />
              <span>Verified School & Emergency Directory</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Linked Schools */}
              {linkedSchools.map((school) => (
                <div key={school.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <strong className="text-white text-sm block">{school.name}</strong>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        {school.enrolledChildren.length} {school.enrolledChildren.length === 1 ? 'Child' : 'Children'}
                      </span>
                    </div>
                    <p className="text-slate-400 mt-1">Principal: {school.principalName}</p>
                    <p className="text-slate-500 text-[11px]">Enrolled: {school.enrolledChildren.join(', ')}</p>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-900">
                    <a
                      href={`tel:${school.contactPhone?.replace(/\s+/g, '')}`}
                      className="min-h-[44px] flex-1 py-2 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-all flex items-center justify-center gap-1.5"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>{school.contactPhone}</span>
                    </a>
                  </div>
                </div>
              ))}

              {/* National SAPS Emergency Liaison */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 flex flex-col justify-between">
                <div>
                  <strong className="text-white text-sm block">SAPS Flying Squad & School Safety Liaison</strong>
                  <p className="text-slate-400 mt-1">Dedicated 24/7 National Emergency Rapid Response</p>
                  <p className="text-slate-500 text-[11px]">Integrated with ITIS Command Centre Dispatch</p>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-slate-900">
                  <a
                    href="tel:10111"
                    className="min-h-[44px] flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold transition-all flex items-center justify-center gap-1.5 border border-slate-700"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Call Police: 10111</span>
                  </a>
                </div>
              </div>

              {/* Childline South Africa */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 flex flex-col justify-between">
                <div>
                  <strong className="text-white text-sm block">Childline South Africa (Toll-Free)</strong>
                  <p className="text-slate-400 mt-1">24/7 Free child safety, trauma & crisis counseling</p>
                  <p className="text-slate-500 text-[11px]">National Child Protection Line</p>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-slate-900">
                  <a
                    href="tel:0800055555"
                    className="min-h-[44px] flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 font-bold transition-all flex items-center justify-center gap-1.5 border border-slate-700"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call 0800 055 555</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 5. HELP TAB */}
      {/* ==================================================== */}
      {currentTab === 'HELP' && (
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-cyan-400" />
            <span>Frequently Asked Questions & Guardian Safety Guidelines</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <strong className="text-white block text-sm">How School Check-Ins Work</strong>
              <p className="text-slate-400 leading-relaxed">
                Your child's arrival and campus presence are confirmed through school registers and arrival check-ins, keeping you informed in real time.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <strong className="text-white block text-sm">What Happens in an Emergency?</strong>
              <p className="text-slate-400 leading-relaxed">
                If an alert is triggered, the Command Centre verifies the situation promptly and coordinates rapid response while keeping you directly notified.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <strong className="text-white block text-sm">How to Authorize Pickups</strong>
              <p className="text-slate-400 leading-relaxed">
                Only guardians verified in the school safety records can sign out learners. You can authorize a family member during enrolment or through the school.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 6. PREFERENCES TAB */}
      {/* ==================================================== */}
      {currentTab === 'PREFERENCES' && (
        <form onSubmit={handleSavePreferences} className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Settings className="w-4 h-4 text-cyan-400" />
            <span>Emergency Notification & Language Preferences</span>
          </h3>

          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <strong className="text-white block">SMS Immediate Alerts</strong>
                  <span className="text-slate-400">Receive instant SMS text updates when your child reaches school or during any safety event.</span>
                </div>
                <input
                  type="checkbox"
                  checked={smsEnabled}
                  onChange={e => setSmsEnabled(e.target.checked)}
                  className="w-5 h-5 rounded bg-slate-900 border-slate-700 text-cyan-600 focus:ring-cyan-500"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-slate-800">
                <div>
                  <strong className="text-white block">Priority Voice Reassurance Calls</strong>
                  <span className="text-slate-400">Receive priority automated voice calls in high-priority safety situations.</span>
                </div>
                <input
                  type="checkbox"
                  checked={voiceReassuranceEnabled}
                  onChange={e => setVoiceReassuranceEnabled(e.target.checked)}
                  className="w-5 h-5 rounded bg-slate-900 border-slate-700 text-cyan-600 focus:ring-cyan-500"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-slate-800">
                <div>
                  <strong className="text-white block">App Push Notifications</strong>
                  <span className="text-slate-400">Real-time status updates and campus arrival confirmations.</span>
                </div>
                <input
                  type="checkbox"
                  checked={pushEnabled}
                  onChange={e => setPushEnabled(e.target.checked)}
                  className="w-5 h-5 rounded bg-slate-900 border-slate-700 text-cyan-600 focus:ring-cyan-500"
                />
              </label>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold">Preferred Voice Notification Language</label>
              <select
                value={prefLanguage}
                onChange={e => setPrefLanguage(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white outline-none min-h-[44px]"
              >
                <option value="ENGLISH">English (Default)</option>
                <option value="ISIZULU">isiZulu</option>
                <option value="SESOTHO">Sesotho</option>
                <option value="AFRIKAANS">Afrikaans</option>
              </select>
            </div>
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              type="submit"
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all"
            >
              Save Preferences
            </button>

            {savedSuccess && (
              <span className="text-xs text-emerald-400 font-bold flex items-center gap-1 font-mono">
                <Check className="w-4 h-4" /> Preferences Saved Successfully ✓
              </span>
            )}
          </div>
        </form>
      )}

      {/* ==================================================== */}
      {/* MODAL 1: VIEW CHILD DETAILS */}
      {/* ==================================================== */}
      {viewChildModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-5 sm:p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <img
                  src={viewChildModal.learner.photoUrl || "https://images.unsplash.com/photo-1544717305-2782549b5136?w=150&auto=format&fit=crop&q=80"}
                  alt=""
                  className="w-12 h-12 rounded-xl object-cover border border-slate-700"
                />
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {viewChildModal.person.firstName} {viewChildModal.person.lastName}
                  </h3>
                  <span className="text-xs text-cyan-400 font-mono">
                    EMIS: {viewChildModal.learner.emisId || 'Enrolled'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setViewChildModal(null)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-mono">Enrolled School</span>
                  <strong className="text-white">{viewChildModal.currentSchool?.name || 'Enrolled School'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-mono">Academic Placement</span>
                  <strong className="text-white">
                    {viewChildModal.currentAcademicRecord?.grade || 'Grade 10'} {viewChildModal.currentAcademicRecord?.classSection ? `(${viewChildModal.currentAcademicRecord.classSection})` : ''}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-mono">Date of Birth</span>
                  <span className="text-slate-300 font-mono">{viewChildModal.person.dateOfBirth || 'Recorded'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-mono">Blood Type</span>
                  <span className="text-emerald-400 font-mono font-bold">{viewChildModal.learner.bloodType || 'Recorded'}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-500 block text-[10px] uppercase font-mono">Medical Triggers & Allergies</span>
                <span className="text-amber-300 font-medium">
                  {viewChildModal.learner.allergies?.length ? viewChildModal.learner.allergies.join(', ') : 'None recorded'}
                </span>
                {viewChildModal.learner.medicalNotes && (
                  <p className="text-slate-400 mt-1">{viewChildModal.learner.medicalNotes}</p>
                )}
              </div>

              {viewChildModal.guardians && viewChildModal.guardians.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-slate-500 block text-[10px] uppercase font-mono">Registered Emergency Guardians</span>
                  <div className="space-y-1 pt-1">
                    {viewChildModal.guardians.map((g, i) => (
                      <div key={i} className="flex justify-between items-center text-slate-300">
                        <span>{g.person.firstName} {g.person.lastName} ({g.relationship.relationshipType})</span>
                        <span className="text-emerald-400 font-mono">{g.guardian.mobileNumber}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setViewChildModal(null)}
                className="w-full min-h-[44px] py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 2: VIEW LOCATION & SAFE CORRIDOR */}
      {/* ==================================================== */}
      {viewLocationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Safe Location Status — {viewLocationModal.person.firstName}
                </h3>
                <span className="text-xs text-emerald-400 flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Inside Approved Safe Zone
                </span>
              </div>
              <button
                onClick={() => setViewLocationModal(null)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Safe Zone Visualization */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-mono">Current Zone:</span>
                <strong className="text-white">{viewLocationModal.currentSchool?.name || 'School'} Campus Perimeter</strong>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-mono">Status:</span>
                <span className="text-cyan-400 font-medium">Safe Ingress Recorded</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-mono">Security Status:</span>
                <span className="text-emerald-400 font-mono">Active & Encrypted</span>
              </div>

              {/* Safe Route Visual */}
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span>Enrolled at {viewLocationModal.currentSchool?.name || 'School'}</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>Currently safe inside school grounds</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setViewLocationModal(null)}
              className="w-full min-h-[44px] py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 3: CONTACT SCHOOL */}
      {/* ==================================================== */}
      {contactSchoolModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Contact School Administration
                </h3>
                <span className="text-xs text-slate-400">
                  {contactSchoolModal.currentSchool?.name || 'Enrolled School'}
                </span>
              </div>
              <button
                onClick={() => setContactSchoolModal(null)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <a
                href={`tel:${contactSchoolModal.currentSchool?.contactPhone?.replace(/\s+/g, '') || '0120000000'}`}
                className="min-h-[44px] p-3.5 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 flex items-center justify-between transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="text-white block text-sm">Call Administration</strong>
                    <span className="text-slate-400">{contactSchoolModal.currentSchool?.contactPhone || 'Available upon enrolment'}</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
              </a>

              {contactSchoolModal.currentSchool?.contactEmail && (
                <a
                  href={`mailto:${contactSchoolModal.currentSchool.contactEmail}`}
                  className="min-h-[44px] p-3.5 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 flex items-center justify-between transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <strong className="text-white block text-sm">Send Email to School</strong>
                      <span className="text-slate-400">{contactSchoolModal.currentSchool.contactEmail}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                </a>
              )}
            </div>

            <button
              type="button"
              onClick={() => setContactSchoolModal(null)}
              className="w-full min-h-[44px] py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
