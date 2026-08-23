import React, { useState } from 'react';
import { 
  Users, 
  ShieldCheck, 
  MapPin, 
  HeartPulse, 
  PhoneCall, 
  CheckCircle2, 
  Clock, 
  PlusCircle, 
  Eye, 
  Building2, 
  School as SchoolIcon, 
  Calendar, 
  AlertCircle, 
  X, 
  ChevronRight, 
  Shield, 
  Mail, 
  Phone,
  Radio,
  Bell,
  History,
  HelpCircle,
  Settings,
  Check,
  Send,
  Volume2
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
  onOpenEnrolment: () => void;
  onOpenPanic: () => void;
  initialTab?: GuardianTab;
}

export const GuardianDashboard: React.FC<Props> = ({
  learners = [],
  currentUser,
  onOpenEnrolment,
  onOpenPanic,
  initialTab = 'MY_CHILDREN'
}) => {
  const [currentTab, setCurrentTab] = useState<GuardianTab>(initialTab);

  const safeLearners = Array.isArray(learners) ? learners : [];
  // Find all children linked to this guardian (default Grace Molefe grd-001)
  const guardianId = currentUser?.guardianId || 'grd-001';
  const myChildren = safeLearners.filter(l => l && Array.isArray(l.guardians) && l.guardians.some(g => g?.guardian?.id === guardianId));
  
  const [selectedChildId, setSelectedChildId] = useState<string>(myChildren[0]?.learner?.id || '');
  
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

  const activeChild = myChildren.find(c => c.learner.id === selectedChildId) || myChildren[0];

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* ==================================================== */}
      {/* GUARDIAN WELCOME & REASSURANCE BANNER */}
      {/* ==================================================== */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>DHA Verified Parent Profile</span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Good morning, {currentUser.name || 'Grace Molefe'}
            </h1>
            
            <p className="text-sm sm:text-base text-slate-300 font-medium">
              Here is the live safety status of your children across active school corridors.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenEnrolment}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all shadow-md shadow-cyan-950/40 flex items-center gap-2 active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add Another Child</span>
            </button>
          </div>
        </div>
      </div>

      {/* ==================================================== */}
      {/* ROLE-AWARE PARENT NAVIGATION TABS */}
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
          <span>MY CHILDREN</span>
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
          <span>ALERTS</span>
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
          <span>SAFETY HISTORY</span>
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
          <span>CONTACT</span>
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
          <span>HELP</span>
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
      {/* 1. MY CHILDREN TAB */}
      {/* ==================================================== */}
      {currentTab === 'MY_CHILDREN' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              <span>Registered Children ({myChildren.length})</span>
            </h2>
            <span className="text-xs text-slate-400">
              Automated notifications active for SMS & Voice
            </span>
          </div>

          {myChildren.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <Users className="w-8 h-8 text-slate-500 mx-auto" />
              <strong className="text-white block text-sm">No registered children found</strong>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                WHAT HAPPENED: No active learner records are currently associated with your national ID profile.
                <br />
                WHAT TO DO NEXT: Tap "Add Another Child" to complete the fast authoritative onboarding wizard.
              </p>
              <button
                onClick={onOpenEnrolment}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-cyan-600 text-white text-xs font-bold"
              >
                Start Onboarding
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {myChildren.map((child) => {
                const hasActiveIncident = !!child.recentIncident && child.recentIncident.status !== 'RESOLVED';
                const isSafe = !hasActiveIncident;
                const currentSchoolName = child.currentSchool?.name || 'Pretoria Boys High School';
                const grade = child.currentAcademicRecord?.grade || 'Grade 10';
                const classSection = child.currentAcademicRecord?.classSection || '10-B';
                
                const plainLanguageStatus = hasActiveIncident 
                  ? 'Active safety alert being resolved by school & SAPS'
                  : `Safe on campus at ${currentSchoolName}`;

                const lastVerifiedTime = hasActiveIncident
                  ? 'Alert broadcast 1 min ago'
                  : 'Verified 3 minutes ago at School Main Gate';

                return (
                  <div
                    key={child.learner.id}
                    className={`p-5 sm:p-6 rounded-2xl border transition-all flex flex-col justify-between space-y-5 shadow-lg relative ${
                      hasActiveIncident
                        ? 'bg-slate-900 border-rose-500/60 ring-1 ring-rose-500/40'
                        : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Top Section: Photo + Core Identity */}
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
                            {grade} • {classSection}
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
                          <span className={`text-xs font-semibold ${isSafe ? 'text-emerald-400' : 'text-rose-300'}`}>
                            {plainLanguageStatus}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-1 font-mono">
                          <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                          <span>{lastVerifiedTime}</span>
                        </div>
                      </div>
                    </div>

                    {/* Plain-Language Safety Highlights */}
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-mono">EMIS Admission</span>
                        <strong className="text-slate-200 font-mono">{child.learner.emisId}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-mono">Health Alerts</span>
                        <strong className="text-amber-300 truncate block">
                          {child.learner.allergies?.join(', ') || 'No known allergies'}
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
                        <span>VIEW LOCATION</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setContactSchoolModal(child)}
                        className="min-h-[44px] py-2 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                      >
                        <PhoneCall className="w-3.5 h-3.5 text-amber-400" />
                        <span>CONTACT SCHOOL</span>
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
      {/* 2. ALERTS TAB */}
      {/* ==================================================== */}
      {currentTab === 'ALERTS' && (
        <div className="space-y-4">
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Bell className="w-4 h-4 text-cyan-400" />
              <span>Safety Alerts & Voice Reassurance Dispatches</span>
            </h3>

            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-start justify-between gap-3 text-xs">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="text-white block text-sm">Katlego safely verified at Pretoria Boys High</strong>
                    <p className="text-slate-400 mt-0.5">RFID North Ingress Gate scan verified on time at 07:42 AM.</p>
                    <span className="text-[11px] text-slate-500 font-mono mt-1 block">Today, 07:42 AM • SMS & Push Confirmed</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-mono">NORMAL</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-start justify-between gap-3 text-xs">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
                    <Volume2 className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="text-white block text-sm">Automated Voice Reassurance Call Receipt</strong>
                    <p className="text-slate-400 mt-0.5">Voice confirmation delivered to +27 82 555 0192. System operational test acknowledged.</p>
                    <span className="text-[11px] text-slate-500 font-mono mt-1 block">Yesterday, 14:15 PM • Voice Call Answered</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 text-[10px] font-mono">VERIFIED</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 3. SAFETY HISTORY TAB */}
      {/* ==================================================== */}
      {currentTab === 'SAFETY_HISTORY' && (
        <div className="space-y-4">
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-cyan-400" />
              <span>Corridor Transit & Arrival History</span>
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <div>
                    <strong className="text-white block">Morning Arrival — Pretoria Boys High</strong>
                    <span className="text-slate-400">Scanned via Main North Entrance Gate</span>
                  </div>
                </div>
                <span className="font-mono text-slate-300">Today • 07:42 AM</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <div>
                    <strong className="text-white block">Afternoon Departure — School Bus Depot</strong>
                    <span className="text-slate-400">Supervised corridor transit completed</span>
                  </div>
                </div>
                <span className="font-mono text-slate-300">Yesterday • 15:30 PM</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <div>
                    <strong className="text-white block">Morning Arrival — Pretoria Boys High</strong>
                    <span className="text-slate-400">Scanned via Main North Entrance Gate</span>
                  </div>
                </div>
                <span className="font-mono text-slate-300">Yesterday • 07:45 AM</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 4. CONTACT TAB */}
      {/* ==================================================== */}
      {currentTab === 'CONTACT' && (
        <div className="space-y-4">
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-cyan-400" />
              <span>Verified School & Emergency Directory</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <strong className="text-white text-sm block">Pretoria Boys High School Administration</strong>
                <p className="text-slate-400">Principal: Dr. Gregory Hassenkamp</p>
                <div className="flex items-center gap-2 pt-2">
                  <a
                    href="tel:0124602246"
                    className="min-h-[44px] flex-1 py-2 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call (012) 460-2246</span>
                  </a>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <strong className="text-white text-sm block">SAPS Sunnyside Sector 2 School Liaison</strong>
                <p className="text-slate-400">Dedicated Tactical Rapid Response Interceptor</p>
                <div className="flex items-center gap-2 pt-2">
                  <a
                    href="tel:10111"
                    className="min-h-[44px] flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold transition-all flex items-center justify-center gap-1.5 border border-slate-700"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Call Police: 10111</span>
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
            <span>Frequently Asked Questions & Parent Guidelines</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <strong className="text-white block text-sm">How RFID Scans Protect Learners</strong>
              <p className="text-slate-400 leading-relaxed">
                Your child carries a light, encrypted beacon tag that automatically registers when entering or leaving school gates.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <strong className="text-white block text-sm">What Happens in an Emergency?</strong>
              <p className="text-slate-400 leading-relaxed">
                If an alarm is triggered, the Command Centre verifies the incident within 180 seconds and dispatches SAPS while calling you directly.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <strong className="text-white block text-sm">How to Authorize Pickups</strong>
              <p className="text-slate-400 leading-relaxed">
                Only guardians verified in the national register can sign out learners. You can authorize a family member during enrolment.
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
                  <span className="text-slate-400">Receive instant SMS text updates when your child reaches school.</span>
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
                  <span className="text-slate-400">Receive priority automated voice calls in high-priority situations.</span>
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
                  <span className="text-slate-400">Real-time status markers and gate arrival alerts.</span>
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
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-5 sm:p-6 space-y-5 shadow-2xl">
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
                    EMIS: {viewChildModal.learner.emisId}
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
                  <strong className="text-white">{viewChildModal.currentSchool?.name}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-mono">Academic Placement</span>
                  <strong className="text-white">
                    {viewChildModal.currentAcademicRecord?.grade} ({viewChildModal.currentAcademicRecord?.classSection})
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-mono">Date of Birth</span>
                  <span className="text-slate-300 font-mono">{viewChildModal.person.dateOfBirth}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-mono">Blood Type</span>
                  <span className="text-emerald-400 font-mono font-bold">{viewChildModal.learner.bloodType || 'O+'}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-500 block text-[10px] uppercase font-mono">Medical Triggers & Allergies</span>
                <span className="text-amber-300 font-medium">
                  {viewChildModal.learner.allergies?.join(', ') || 'None recorded'}
                </span>
                {viewChildModal.learner.medicalNotes && (
                  <p className="text-slate-400 mt-1">{viewChildModal.learner.medicalNotes}</p>
                )}
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-500 block text-[10px] uppercase font-mono">Registered Guardians</span>
                <div className="space-y-1 pt-1">
                  {viewChildModal.guardians.map((g, i) => (
                    <div key={i} className="flex justify-between items-center text-slate-300">
                      <span>{g.person.firstName} {g.person.lastName} ({g.relationship.relationshipType})</span>
                      <span className="text-emerald-400 font-mono">{g.guardian.mobileNumber}</span>
                    </div>
                  ))}
                </div>
              </div>
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

            {/* Reassuring Map / Safe Zone Visualization */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-mono">Current Zone:</span>
                <strong className="text-white">{viewLocationModal.currentSchool?.name} Campus Perimeter</strong>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-mono">Last Checkpoint:</span>
                <span className="text-cyan-400 font-medium">Pretoria Boys High North Gate Ingress</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-mono">Beacon Signal:</span>
                <span className="text-emerald-400 font-mono">Active & Encrypted (Tag {viewLocationModal.learner.trackingBeaconId})</span>
              </div>

              {/* Simplified Safe Route Visual */}
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span>07:42 AM — Entered Safe Corridor (Lynnwood Rd)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span>07:55 AM — Arrived safely at Campus Gate</span>
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
                  {contactSchoolModal.currentSchool?.name}
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
                href={`tel:${contactSchoolModal.currentSchool?.contactPhone || '0124602246'}`}
                className="min-h-[44px] p-3.5 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 flex items-center justify-between transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="text-white block text-sm">Call Administration</strong>
                    <span className="text-slate-400">{contactSchoolModal.currentSchool?.contactPhone || '+27 (0) 12 460 2246'}</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
              </a>

              <a
                href={`mailto:${contactSchoolModal.currentSchool?.contactEmail || 'admin@pbhs.co.za'}`}
                className="min-h-[44px] p-3.5 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 flex items-center justify-between transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="text-white block text-sm">Send Email to Principal</strong>
                    <span className="text-slate-400">{contactSchoolModal.currentSchool?.contactEmail || 'admin@pbhs.co.za'}</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
              </a>
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
