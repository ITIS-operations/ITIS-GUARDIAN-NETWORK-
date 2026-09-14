import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Users, 
  School as SchoolIcon, 
  Lock, 
  ArrowRight, 
  ChevronRight,
  ChevronLeft,
  CheckCircle2, 
  LogIn,
  HeartHandshake,
  Send,
  Radio,
  Clock,
  UserCheck,
  Building2,
  FileCheck2,
  Navigation,
  MapPin,
  Eye,
  ShieldAlert,
  Mail
} from 'lucide-react';
import { ActiveUserSession } from '../types.js';
import cinematicHeroImg from '../assets/images/itis_hero_cinematic_1787556203824.jpg';

interface Props {
  currentUser: ActiveUserSession | null;
  onOpenLogin: () => void;
  onNavigateToAuthorizedPortal: () => void;
  onOpenEnrolment: () => void;
  onOpenPanic: () => void;
  activeSection?: string;
  onSelectSection?: (sectionId: string) => void;
}

type ExploreCategory = 
  | 'overview' 
  | 'why-itis' 
  | 'how-it-works' 
  | 'for-parents' 
  | 'for-schools' 
  | 'emergency-response' 
  | 'trust-safety' 
  | 'request-demo';

export const LandingPage: React.FC<Props> = ({
  currentUser,
  onOpenLogin,
  onNavigateToAuthorizedPortal,
  activeSection = 'home',
  onSelectSection
}) => {
  // Navigation mode: 'home' shows the calm homepage; any category key shows the dedicated Explore view
  const [currentView, setCurrentView] = useState<'home' | 'explore'>('home');
  const [selectedCategory, setSelectedCategory] = useState<ExploreCategory>('overview');

  useEffect(() => {
    if (activeSection === 'home' || activeSection === 'overview-home') {
      setCurrentView('home');
    } else if (activeSection) {
      const validCategories: ExploreCategory[] = [
        'overview', 'why-itis', 'how-it-works', 'for-parents', 
        'for-schools', 'emergency-response', 'trust-safety', 'request-demo'
      ];
      
      let targetCat: ExploreCategory = 'overview';
      if (validCategories.includes(activeSection as ExploreCategory)) {
        targetCat = activeSection as ExploreCategory;
      } else if (activeSection === 'four-answers') {
        targetCat = 'overview';
      } else if (activeSection === 'safety-journey') {
        targetCat = 'how-it-works';
      } else if (activeSection === 'solutions') {
        targetCat = 'for-parents';
      } else if (activeSection === 'security' || activeSection === 'resources') {
        targetCat = 'trust-safety';
      }
      
      setSelectedCategory(targetCat);
      setCurrentView('explore');
    }
  }, [activeSection]);

  const openExplore = (category: ExploreCategory = 'overview') => {
    setSelectedCategory(category);
    setCurrentView('explore');
    if (onSelectSection) {
      onSelectSection(category);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const returnToHome = () => {
    setCurrentView('home');
    if (onSelectSection) {
      onSelectSection('home');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Consultation request form state
  const [demoForm, setDemoForm] = useState({
    name: '',
    email: '',
    phone: '',
    organization: '',
    role: 'School Principal / Headmaster',
    learnerCount: '',
    message: ''
  });
  const [demoSubmitted, setDemoSubmitted] = useState(false);

  const handleDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDemoSubmitted(true);
    setTimeout(() => {
      setDemoSubmitted(false);
      setDemoForm({
        name: '',
        email: '',
        phone: '',
        organization: '',
        role: 'School Principal / Headmaster',
        learnerCount: '',
        message: ''
      });
    }, 5000);
  };

  const exploreNavItems: { id: ExploreCategory; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'overview', label: 'OVERVIEW', icon: Building2 },
    { id: 'why-itis', label: 'WHY ITIS', icon: Eye },
    { id: 'how-it-works', label: 'HOW IT WORKS', icon: Navigation },
    { id: 'for-parents', label: 'FOR PARENTS', icon: HeartHandshake },
    { id: 'for-schools', label: 'FOR SCHOOLS', icon: SchoolIcon },
    { id: 'emergency-response', label: 'EMERGENCY RESPONSE', icon: Radio },
    { id: 'trust-safety', label: 'TRUST & SAFETY', icon: ShieldCheck },
    { id: 'request-demo', label: 'CONTACT ITIS', icon: Mail },
  ];

  // State for hero image load error / fallback
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  // =========================================================================
  // VIEW 1: CALM, PROFESSIONAL PUBLIC HOMEPAGE (currentView === 'home')
  // =========================================================================
  if (currentView === 'home') {
    return (
      <div className="text-slate-100 selection:bg-[#d4af37] selection:text-slate-950 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16 space-y-16 sm:space-y-24">
        
        {/* ==================================================== */}
        {/* 1. HERO SECTION: REFINED SPLIT-SCREEN (DESKTOP & MOBILE) */}
        {/* ==================================================== */}
        
        {/* --- DESKTOP SPLIT-SCREEN HERO (lg:grid) --- */}
        <section className="hidden lg:grid grid-cols-12 gap-8 xl:gap-12 items-center pt-2 sm:pt-4 relative">
          
          <div className="absolute -top-12 -left-12 w-96 h-96 bg-[#d4af37]/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/2 right-0 w-96 h-96 bg-[#0a1836]/40 rounded-full blur-3xl pointer-events-none" />

          {/* LEFT COLUMN: BRANDING & PURPOSE (7 Cols) */}
          <div className="col-span-7 space-y-6 text-left relative z-10">
            
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl bg-[#0a1224]/90 border border-[#d4af37]/40 text-[#f3d368] text-xs font-mono font-bold tracking-wider uppercase shadow-lg shadow-[#040812]">
                <img 
                  src="/branding/itis-logo.png" 
                  alt="ITIS Official Emblem" 
                  className="w-5 h-5 rounded-md object-cover border border-[#d4af37]/50"
                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                />
                <span className="tracking-widest">ITIS GUARDIAN NETWORK</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-1" title="Platform Active" />
              </div>
              
              <p className="text-xs xl:text-sm font-extrabold tracking-widest text-[#d4af37] uppercase font-mono flex items-center gap-2">
                <span>INTEGRATED TECHNOLOGY INTELLIGENCE &amp; SAFETY</span>
              </p>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl xl:text-5xl 2xl:text-6xl font-black text-white tracking-tight leading-[1.08]">
              PROTECTING EVERY LEARNER.<br />
              EVERY JOURNEY.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#d4af37] via-[#f3d368] to-[#d4af37] drop-shadow-[0_2px_16px_rgba(212,175,55,0.35)]">
                EVERY SECOND.
              </span>
            </h1>

            {/* Refined Supporting Statements */}
            <div className="space-y-2 max-w-2xl">
              <p className="text-base xl:text-lg text-slate-200 leading-relaxed font-normal">
                ITIS connects schools, guardians and authorised response partners so the right people can act when a learner needs help.
              </p>
              <p className="text-xs xl:text-sm text-slate-400 font-mono">
                Technology for visibility. People for decisions. Coordination for response.
              </p>
            </div>

            {/* Core Capability Badges */}
            <div className="flex flex-wrap gap-2.5 pt-1">
              <span className="px-3 py-1.5 rounded-lg bg-[#060b18] border border-[#d4af37]/25 text-slate-300 text-xs font-mono flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-[#d4af37]" />
                <span>Human-Led Verification</span>
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-[#060b18] border border-[#d4af37]/25 text-slate-300 text-xs font-mono flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#d4af37]" />
                <span>Geospatial Safety Zones</span>
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-[#060b18] border border-[#d4af37]/25 text-slate-300 text-xs font-mono flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-[#d4af37]" />
                <span>POPIA-Aligned Safeguards</span>
              </span>
            </div>

            {/* Actions: PORTAL ACCESS & EXPLORE */}
            <div className="pt-2 flex items-center gap-4">
              <button
                onClick={onOpenLogin}
                className="min-h-[48px] px-8 py-3.5 rounded-xl bg-gradient-to-r from-[#d4af37] via-[#f3d368] to-[#d4af37] hover:brightness-110 text-slate-950 text-sm font-extrabold flex items-center justify-center gap-2.5 shadow-xl shadow-[#d4af37]/25 transition-all cursor-pointer active:scale-95 border border-[#f3d368]"
                title="Authorised access for registered guardians, schools and response personnel"
              >
                <LogIn className="w-4 h-4 text-slate-950 shrink-0 stroke-[2.5]" />
                <span>PORTAL ACCESS</span>
              </button>

              <button
                onClick={() => openExplore('overview')}
                className="min-h-[48px] px-6 py-3.5 rounded-xl bg-[#0a1224] hover:bg-[#0f1a30] border border-[#d4af37]/45 text-slate-100 hover:text-white text-sm font-bold flex items-center justify-center gap-2.5 transition-all cursor-pointer group shadow-lg shadow-[#040812]"
              >
                <span>EXPLORE GUARDIAN NETWORK</span>
                <ArrowRight className="w-4 h-4 text-[#d4af37] group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            <p className="text-[11px] text-slate-400 font-mono pt-0.5">
              Authorised access for registered guardians, schools and response personnel.
            </p>

          </div>

          {/* RIGHT COLUMN: CINEMATIC VISUAL (5 Cols) */}
          <div className="col-span-5 w-full relative">
            
            <div className="relative rounded-2xl p-1 bg-gradient-to-b from-[#d4af37]/50 via-[#d4af37]/20 to-[#d4af37]/40 shadow-2xl shadow-[#040812]">
              <div className="relative rounded-xl bg-[#0a1224] overflow-hidden aspect-[4/3] flex items-center justify-center group">
                
                {!heroImgFailed ? (
                  <img
                    src={cinematicHeroImg}
                    alt="South African School Safety & Connected Entrance"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgFailed(true)}
                  />
                ) : null}

                {/* Institutional Fallback Frame */}
                {heroImgFailed && (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#0a1224] via-[#060b18] to-[#0a1224] p-8 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-20 h-20 rounded-2xl bg-[#060b18] border border-[#d4af37]/50 flex items-center justify-center shadow-xl shadow-[#d4af37]/15">
                      <img 
                        src="/branding/itis-logo.png" 
                        alt="ITIS Emblem" 
                        className="w-12 h-12 object-contain"
                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-base font-extrabold text-white tracking-wide">ITIS GUARDIAN NETWORK</h3>
                      <p className="text-xs text-[#d4af37] font-mono font-semibold">
                        INTEGRATED TECHNOLOGY INTELLIGENCE &amp; SAFETY
                      </p>
                      <p className="text-xs text-slate-400 max-w-xs font-mono">
                        South African Child-Safety Technology Platform
                      </p>
                    </div>
                    <span className="text-[10px] text-[#f3d368] bg-[#d4af37]/10 px-3 py-1 rounded-full border border-[#d4af37]/30 font-mono font-bold uppercase tracking-wider">
                      South Africa
                    </span>
                  </div>
                )}

                {/* Top Badge */}
                <div className="absolute top-3 left-3 bg-[#060b18]/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#d4af37]/30 flex items-center gap-2 shadow-lg">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-[10px] font-mono font-bold text-slate-200 tracking-wider">
                    SAFETY CORRIDOR ACTIVE
                  </span>
                </div>

                {/* Bottom Badge */}
                <div className="absolute bottom-3 left-3 right-3 bg-[#060b18]/90 backdrop-blur-md px-3 py-2 rounded-lg border border-[#d4af37]/30 flex items-center justify-between shadow-lg">
                  <div className="flex items-center gap-2">
                    <Radio className="w-3.5 h-3.5 text-[#d4af37] animate-pulse" />
                    <span className="text-[11px] font-mono font-semibold text-slate-200 truncate">
                      Gate Radar • Geofence Monitoring
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[#f3d368] font-bold shrink-0">
                    COORDINATION LAYER
                  </span>
                </div>

                <div className="absolute inset-0 bg-gradient-to-t from-[#060b18]/70 via-transparent to-[#060b18]/20 pointer-events-none" />
              </div>
            </div>

          </div>

        </section>

        {/* --- DEDICATED RESPONSIVE MOBILE HERO (Visible only below lg) --- */}
        <section className="lg:hidden flex flex-col space-y-6 pt-2 text-left">
          
          <div className="flex items-center gap-3">
            <img 
              src="/branding/itis-logo.png" 
              alt="ITIS Emblem" 
              className="w-11 h-11 rounded-xl border border-[#d4af37]/50 object-cover shadow-md shrink-0"
              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
            />
            <div>
              <span className="font-extrabold text-white text-base tracking-tight block">
                ITIS GUARDIAN NETWORK
              </span>
              <span className="text-[10.5px] font-bold text-[#d4af37] font-mono tracking-wider uppercase block">
                INTEGRATED TECHNOLOGY INTELLIGENCE &amp; SAFETY
              </span>
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-[1.12]">
            PROTECTING EVERY LEARNER.<br />
            EVERY JOURNEY.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#d4af37] to-[#f3d368]">
              EVERY SECOND.
            </span>
          </h1>

          <div className="space-y-1.5">
            <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
              ITIS connects schools, guardians and authorised response partners so the right people can act when a learner needs help.
            </p>
            <p className="text-xs text-slate-400 font-mono">
              Technology for visibility. People for decisions. Coordination for response.
            </p>
          </div>

          {/* Badges on Mobile */}
          <div className="flex flex-wrap gap-2">
            <span className="px-2.5 py-1 rounded-md bg-[#060b18] border border-[#d4af37]/25 text-slate-300 text-[11px] font-mono flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3 text-[#d4af37]" />
              <span>Human Verification</span>
            </span>
            <span className="px-2.5 py-1 rounded-md bg-[#060b18] border border-[#d4af37]/25 text-slate-300 text-[11px] font-mono flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-[#d4af37]" />
              <span>Safe Zones</span>
            </span>
            <span className="px-2.5 py-1 rounded-md bg-[#060b18] border border-[#d4af37]/25 text-slate-300 text-[11px] font-mono flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-[#d4af37]" />
              <span>POPIA Safeguards</span>
            </span>
          </div>

          {/* Action Buttons: PORTAL ACCESS & EXPLORE */}
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <button
              onClick={onOpenLogin}
              className="min-h-[46px] w-full px-6 py-3 rounded-xl bg-gradient-to-r from-[#d4af37] via-[#f3d368] to-[#d4af37] text-slate-950 text-sm font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-[#d4af37]/20 transition-all cursor-pointer active:scale-95"
              title="Authorised access for registered guardians, schools and response personnel"
            >
              <LogIn className="w-4 h-4 text-slate-950 shrink-0 stroke-[2.5]" />
              <span>PORTAL ACCESS</span>
            </button>

            <button
              onClick={() => openExplore('overview')}
              className="min-h-[46px] w-full px-5 py-3 rounded-xl bg-[#0a1224] hover:bg-[#0f1a30] border border-[#d4af37]/40 text-slate-100 hover:text-white text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
            >
              <span>EXPLORE GUARDIAN NETWORK</span>
              <ArrowRight className="w-4 h-4 text-[#d4af37]" />
            </button>
          </div>

          <p className="text-[10px] text-slate-400 text-center leading-tight">
            Authorised access for registered guardians, schools and response personnel.
          </p>

          {/* Mobile Image Frame */}
          <div className="pt-2">
            <div className="relative rounded-2xl p-1 bg-gradient-to-b from-[#d4af37]/40 via-[#d4af37]/15 to-[#d4af37]/30 shadow-xl shadow-[#040812]">
              <div className="relative rounded-xl bg-[#0a1224] overflow-hidden aspect-[16/10] flex items-center justify-center">
                {!heroImgFailed ? (
                  <img
                    src={cinematicHeroImg}
                    alt="ITIS Guardian Network"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgFailed(true)}
                  />
                ) : null}

                {heroImgFailed && (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#0a1224] to-[#060b18] p-6 flex flex-col items-center justify-center text-center space-y-3">
                    <div className="w-14 h-14 rounded-xl bg-[#060b18] border border-[#d4af37]/40 flex items-center justify-center">
                      <img 
                        src="/branding/itis-logo.png" 
                        alt="ITIS Emblem" 
                        className="w-9 h-9 object-contain"
                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                      />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-white">ITIS GUARDIAN NETWORK</h3>
                      <p className="text-[11px] text-slate-400 font-mono">
                        South African Child-Safety Technology Platform
                      </p>
                    </div>
                  </div>
                )}

                <div className="absolute bottom-2.5 left-2.5 right-2.5 bg-[#060b18]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#d4af37]/30 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-200 font-semibold">
                    Campus Gate Radar • Safe Zones
                  </span>
                  <span className="text-[9px] font-mono text-[#f3d368] font-bold">
                    ACTIVE
                  </span>
                </div>

                <div className="absolute inset-0 bg-gradient-to-t from-[#060b18]/60 via-transparent to-transparent pointer-events-none" />
              </div>
            </div>
          </div>

        </section>

        {/* ==================================================== */}
        {/* 2. WHY ITIS: VISIBILITY • VERIFICATION • COORDINATION */}
        {/* ==================================================== */}
        <section id="why-itis" className="space-y-8 pt-8 border-t border-slate-800/80 max-w-5xl mx-auto">
          <div className="space-y-3 text-center max-w-3xl mx-auto">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#d4af37]">
              WHY ITIS
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Addressing the Gaps in School Journey Safety
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              School journeys involve daily handovers between home, scholar transport, and campus gates. When delays or unexpected incidents occur, families and educators need timely clarity, not uncertainty.
            </p>
          </div>

          {/* Three Strong Concepts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            
            {/* VISIBILITY */}
            <div className="p-6 rounded-2xl bg-[#0a1224] border border-slate-800 hover:border-[#d4af37]/40 transition-colors space-y-3 text-left">
              <div className="w-10 h-10 rounded-xl bg-[#060b18] border border-[#d4af37]/30 text-[#d4af37] flex items-center justify-center">
                <Eye className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#d4af37]">
                  VISIBILITY
                </div>
                <h3 className="text-base font-bold text-white">
                  Know what is happening
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Know what is happening and where attention may be required across daily journeys, arrival points, and safety zones.
              </p>
            </div>

            {/* VERIFICATION */}
            <div className="p-6 rounded-2xl bg-[#0a1224] border border-slate-800 hover:border-[#d4af37]/40 transition-colors space-y-3 text-left">
              <div className="w-10 h-10 rounded-xl bg-[#060b18] border border-[#d4af37]/30 text-[#f3d368] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#f3d368]">
                  VERIFICATION
                </div>
                <h3 className="text-base font-bold text-white">
                  Understand before acting
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Give authorised people the information they need to understand an incident before action is taken, avoiding confusion and false alarms.
              </p>
            </div>

            {/* COORDINATION */}
            <div className="p-6 rounded-2xl bg-[#0a1224] border border-slate-800 hover:border-[#d4af37]/40 transition-colors space-y-3 text-left">
              <div className="w-10 h-10 rounded-xl bg-[#060b18] border border-[#d4af37]/30 text-[#d4af37] flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#d4af37]">
                  COORDINATION
                </div>
                <h3 className="text-base font-bold text-white">
                  Connect the right people
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Connect the appropriate people and organisations so response can be organised effectively when assistance is needed.
              </p>
            </div>

          </div>

          {/* 4 Concrete Operational Elements */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            {[
              { label: 'SCHOOL CHECK-INS', desc: 'Gate arrival & register points' },
              { label: 'JOURNEY VISIBILITY', desc: 'Milestone notifications for families' },
              { label: 'SAFETY CORRIDORS', desc: 'Approved campus & transit areas' },
              { label: 'COORDINATED RESPONSE', desc: 'Structured communication workflows' },
            ].map((elem, idx) => (
              <div 
                key={elem.label} 
                className="p-4 rounded-xl bg-[#060b18] border border-slate-800 space-y-1 text-left"
              >
                <div className="text-[10px] font-mono font-bold text-[#d4af37]">
                  0{idx + 1}
                </div>
                <h4 className="text-xs font-bold text-white font-mono">
                  {elem.label}
                </h4>
                <p className="text-[11px] text-slate-400">
                  {elem.desc}
                </p>
              </div>
            ))}
          </div>

        </section>

        {/* ==================================================== */}
        {/* 3. HOW IT WORKS: SIMPLIFIED CONCEPTUAL FLOW */}
        {/* ==================================================== */}
        <section className="space-y-8 pt-8 border-t border-slate-800/80 max-w-5xl mx-auto">
          <div className="space-y-3 text-center max-w-3xl mx-auto">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#d4af37]">
              HOW IT WORKS
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              A Connected Journey Safety Flow
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              ITIS acts as the technology and coordination layer connecting each participant throughout the school travel day.
            </p>
          </div>

          {/* Sequential Conceptual Flow */}
          <div className="p-6 sm:p-8 rounded-2xl bg-[#0a1224] border border-slate-800 space-y-6">
            <div className="text-xs font-mono font-bold text-[#d4af37] uppercase tracking-wider text-center">
              COORDINATION FLOW
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 items-stretch">
              {[
                { title: 'LEARNER', desc: 'Journey milestone or safety event occurs' },
                { title: 'SCHOOL', desc: 'Gate check-in recorded for campus visibility' },
                { title: 'GUARDIAN', desc: 'Timely status update received' },
                { title: 'ITIS LAYER', desc: 'Information organized & verified' },
                { title: 'RESPONSE PARTNER', desc: 'Authorised personnel coordinate if needed' },
                { title: 'OUTCOME', desc: 'Situation resolved & documented' }
              ].map((step, idx) => (
                <div 
                  key={step.title}
                  className="p-3.5 rounded-xl bg-[#060b18] border border-slate-800 text-center space-y-1.5 flex flex-col justify-between"
                >
                  <div className="text-[10px] font-mono text-[#d4af37] font-bold">
                    STEP 0{idx + 1}
                  </div>
                  <div className="text-xs font-bold text-white font-mono leading-tight">
                    {step.title}
                  </div>
                  <div className="text-[11px] text-slate-400 leading-tight">
                    {step.desc}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-[#060b18] border border-[#d4af37]/30 text-center">
              <p className="text-xs text-slate-200 font-medium">
                Human decisions remain central to emergency escalation.
              </p>
            </div>

            {/* Expected vs Unexpected Event Handling */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-5 rounded-xl bg-[#060b18] border border-emerald-500/30 space-y-2 text-left">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>DURING NORMAL JOURNEYS</span>
                </div>
                <ul className="text-xs text-slate-300 space-y-1.5 pl-5 list-disc marker:text-emerald-500">
                  <li>Learner arrival or departure is verified at the campus gate</li>
                  <li>Guardians receive timely milestone notifications</li>
                  <li>Schools maintain accurate attendance and presence records</li>
                </ul>
              </div>

              <div className="p-5 rounded-xl bg-[#060b18] border border-[#d4af37]/40 space-y-2 text-left">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#f3d368]">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-[#d4af37]" />
                  <span>WHEN ASSISTANCE IS NEEDED</span>
                </div>
                <ul className="text-xs text-slate-300 space-y-1.5 pl-5 list-disc marker:text-[#d4af37]">
                  <li>The platform flags the delay, deviation, or alert</li>
                  <li>Authorised personnel review and verify situational details</li>
                  <li>Relevant response providers are coordinated swiftly</li>
                </ul>
              </div>
            </div>

          </div>
        </section>

        {/* ==================================================== */}
        {/* 4. SOLUTIONS: ONE NETWORK. THREE CRITICAL CONNECTIONS. */}
        {/* ==================================================== */}
        <section id="solutions" className="space-y-8 pt-8 border-t border-slate-800/80 max-w-5xl mx-auto">
          <div className="space-y-2 text-center max-w-2xl mx-auto">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#d4af37]">
              SOLUTIONS
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              ONE NETWORK. THREE CRITICAL CONNECTIONS.
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Tailored capabilities providing coordinated communication for families, educational institutions, and response personnel.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            
            {/* Card 1: GUARDIANS */}
            <div className="p-6 rounded-2xl bg-[#0a1224] border border-slate-800 hover:border-[#d4af37]/40 transition-colors space-y-3 text-left">
              <div className="w-9 h-9 rounded-xl bg-[#060b18] border border-[#d4af37]/30 text-[#d4af37] flex items-center justify-center">
                <HeartHandshake className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#d4af37]">
                  GUARDIANS
                </div>
                <h3 className="text-base font-bold text-white">Know what’s happening.</h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Guardians can receive relevant learner safety and journey information through the ITIS platform, providing peace of mind from morning departure to safe arrival.
              </p>
              <button
                onClick={() => openExplore('for-parents')}
                className="text-xs font-bold text-[#d4af37] hover:text-[#f3d368] inline-flex items-center gap-1 cursor-pointer pt-1"
              >
                <span>Learn more</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Card 2: SCHOOLS */}
            <div className="p-6 rounded-2xl bg-[#0a1224] border border-slate-800 hover:border-[#d4af37]/40 transition-colors space-y-3 text-left">
              <div className="w-9 h-9 rounded-xl bg-[#060b18] border border-[#d4af37]/30 text-[#d4af37] flex items-center justify-center">
                <SchoolIcon className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#d4af37]">
                  SCHOOLS
                </div>
                <h3 className="text-base font-bold text-white">Know who is responsible.</h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Schools can manage learner safety information, authorised contacts, incidents and coordination through the platform, streamlining daily arrivals and collections.
              </p>
              <button
                onClick={() => openExplore('for-schools')}
                className="text-xs font-bold text-[#d4af37] hover:text-[#f3d368] inline-flex items-center gap-1 cursor-pointer pt-1"
              >
                <span>Learn more</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Card 3: RESPONSE PARTNERS */}
            <div className="p-6 rounded-2xl bg-[#0a1224] border border-slate-800 hover:border-[#d4af37]/40 transition-colors space-y-3 text-left">
              <div className="w-9 h-9 rounded-xl bg-[#060b18] border border-[#d4af37]/30 text-[#d4af37] flex items-center justify-center">
                <Radio className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#d4af37]">
                  RESPONSE PARTNERS
                </div>
                <h3 className="text-base font-bold text-white">Know where and how to respond.</h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Authorised response personnel can receive appropriate incident information and coordinate their response swiftly when an escalation is required.
              </p>
              <button
                onClick={() => openExplore('emergency-response')}
                className="text-xs font-bold text-[#d4af37] hover:text-[#f3d368] inline-flex items-center gap-1 cursor-pointer pt-1"
              >
                <span>Learn more</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>
        </section>

        {/* ==================================================== */}
        {/* 5. ABOUT ITIS */}
        {/* ==================================================== */}
        <section id="company" className="space-y-6 pt-8 border-t border-slate-800/80 max-w-5xl mx-auto">
          <div className="space-y-2 text-center max-w-2xl mx-auto">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#d4af37]">
              COMPANY
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              ABOUT ITIS
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Technology built around a simple purpose: helping protect learners.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            {[
              { label: 'ABOUT ITIS', cat: 'why-itis' as ExploreCategory },
              { label: 'OUR APPROACH', cat: 'how-it-works' as ExploreCategory },
              { label: 'PARTNERSHIPS', cat: 'for-schools' as ExploreCategory },
              { label: 'CONTACT', cat: 'request-demo' as ExploreCategory },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => openExplore(item.cat)}
                className="p-3.5 rounded-xl bg-[#0a1224] hover:bg-[#0f1a30] border border-slate-800 hover:border-[#d4af37]/40 text-xs font-bold text-slate-300 hover:text-white transition-all text-center cursor-pointer"
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>

      </div>
    );
  }


  // =========================================================================
  // VIEW 2: DEDICATED "EXPLORE THE GUARDIAN NETWORK" PUBLIC INFORMATION HUB
  // =========================================================================
  return (
    <div className="text-slate-100 selection:bg-[#d4af37] selection:text-slate-950 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
      
      {/* Top Return Navigation Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <button
          onClick={returnToHome}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0a1224] hover:bg-slate-800 border border-slate-800 text-xs font-bold text-[#d4af37] hover:text-white flex items-center gap-2 transition-all cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4 text-[#d4af37]" />
          <span>← BACK TO ITIS</span>
        </button>

        {currentUser && (
          <button
            onClick={onNavigateToAuthorizedPortal}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0a1224] border border-[#d4af37]/40 text-[#f3d368] text-xs font-bold flex items-center gap-2 cursor-pointer shrink-0"
          >
            <UserCheck className="w-3.5 h-3.5 text-[#d4af37]" />
            <span>Open My Portal</span>
          </button>
        )}
      </div>

      {/* Main Explore Header & Subheading */}
      <div className="space-y-2 pt-2">
        <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
          EXPLORE THE GUARDIAN NETWORK
        </h1>
        <p className="text-sm sm:text-base text-slate-300 max-w-3xl leading-relaxed">
          Discover how ITIS connects people, technology and coordinated response around learner safety.
        </p>
      </div>

      {/* Category Navigation */}
      <div className="bg-[#0a1224] border border-[#d4af37]/30 rounded-2xl p-1.5 shadow-lg shadow-[#040812]">
        <div className="hidden lg:grid grid-cols-4 gap-1.5">
          {exploreNavItems.map((item) => {
            const Icon = item.icon;
            const isSelected = selectedCategory === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSelectedCategory(item.id)}
                className={`min-h-[44px] px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  isSelected
                    ? 'bg-[#d4af37] text-slate-950 shadow-md font-extrabold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-slate-950' : 'text-[#d4af37]'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="lg:hidden grid grid-cols-2 gap-1.5">
          {exploreNavItems.map((item) => {
            const Icon = item.icon;
            const isSelected = selectedCategory === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSelectedCategory(item.id)}
                className={`min-h-[44px] px-3 py-2 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center ${
                  isSelected
                    ? 'bg-[#d4af37] text-slate-950 shadow-md font-extrabold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-slate-950' : 'text-[#d4af37]'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Category Content Container */}
      <div className="pt-2">

        {/* 1. OVERVIEW */}
        {selectedCategory === 'overview' && (
          <div className="p-6 sm:p-10 rounded-2xl bg-[#0a1224] border border-[#d4af37]/30 space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#d4af37]">
                Platform Summary
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                Overview of the ITIS Guardian Network
              </h2>
            </div>

            <p className="text-sm sm:text-base text-slate-200 leading-relaxed max-w-3xl">
              ITIS (Integrated Technology Intelligence &amp; Safety) is a South African child-safety technology platform designed to bridge the communication gap between schools, guardians, and authorised response partners. By combining campus arrival visibility, journey notifications, and structured incident coordination, ITIS helps ensure the right people have the information they need to act when a learner needs assistance.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-800/80">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <div className="text-[#d4af37] text-xs font-mono font-bold">IDENTITY</div>
                <div className="text-xs text-slate-300">South African child-safety technology platform.</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <div className="text-emerald-400 text-xs font-mono font-bold">OPERATIONS</div>
                <div className="text-xs text-slate-300">Human-led verification and coordination.</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <div className="text-[#f3d368] text-xs font-mono font-bold">GOVERNANCE</div>
                <div className="text-xs text-slate-300">Built with POPIA-aligned privacy safeguards.</div>
              </div>
            </div>
          </div>
        )}

        {/* 2. WHY ITIS */}
        {selectedCategory === 'why-itis' && (
          <div className="p-6 sm:p-10 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#d4af37]">
                The Safety Challenge
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                Why South Africa Needs ITIS
              </h2>
            </div>

            <p className="text-sm sm:text-base text-slate-200 leading-relaxed max-w-3xl">
              South African learners encounter daily travel transitions between home, transport points, and campus gates. Long commutes and fragmented communication can create hours of uncertainty when delays occur.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
              <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#d4af37]" />
                  <span>Journey Communication Gaps</span>
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  When unexpected delays occur during commutes, families and schools often face uncertainty. ITIS provides timely status notifications to maintain clear awareness.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  <span>Authorised Custody &amp; Collections</span>
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Uncertain collections disrupt school dismissal. ITIS maintains clear digital verification between schools, legal guardians, and designated caregivers.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#f3d368]" />
                  <span>Human Decision-Making</span>
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Technology supports decisions; authorised people remain responsible for escalation and response. Human oversight avoids false alarms and ensures context-appropriate action.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-cyan-400" />
                  <span>Controlled Access &amp; Privacy</span>
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Learner information is protected through encrypted transmission and role-based access controls, designed around POPIA requirements.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 3. HOW IT WORKS */}
        {selectedCategory === 'how-it-works' && (
          <div className="p-6 sm:p-10 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#d4af37]">
                Operational Flow
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                How the Coordinated Response Works
              </h2>
              <p className="text-xs sm:text-sm text-slate-300">
                A clear, sequential workflow ensuring verifiable safety and human oversight at every step.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              {[
                {
                  step: '01',
                  name: 'LEARNER',
                  desc: 'A journey milestone, check-in point, or safety notice is registered as a learner moves along their travel corridor.'
                },
                {
                  step: '02',
                  name: 'SCHOOL',
                  desc: 'Campus arrival and departure points record attendance events, maintaining visibility of learner presence.'
                },
                {
                  step: '03',
                  name: 'GUARDIAN',
                  desc: 'Verified guardians receive timely updates regarding departures, arrivals, and expected milestones.'
                },
                {
                  step: '04',
                  name: 'ITIS LAYER',
                  desc: 'The platform coordinates data flows, identifies exceptions, and structures information for authorised review.'
                },
                {
                  step: '05',
                  name: 'AUTHORISED RESPONSE',
                  desc: 'When an incident requires escalation, relevant situational details are shared with authorised response providers.'
                },
                {
                  step: '06',
                  name: 'SAFE OUTCOME',
                  desc: 'Coordinated assistance is delivered, and verified status updates are documented for guardians and administrators.'
                }
              ].map((item) => (
                <div key={item.step} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start gap-4">
                  <div className="w-8 h-8 rounded-lg bg-[#060b18] text-[#d4af37] border border-[#d4af37]/30 text-xs font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {item.step}
                  </div>
                  <div className="space-y-1 text-left">
                    <h3 className="text-sm font-bold text-white tracking-wide">{item.name}</h3>
                    <p className="text-xs text-slate-300 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-[#060b18] border border-slate-800 text-center">
              <p className="text-xs text-slate-300">
                Human decisions remain central to emergency escalation.
              </p>
            </div>
          </div>
        )}

        {/* 4. FOR PARENTS */}
        {selectedCategory === 'for-parents' && (
          <div className="p-6 sm:p-10 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#d4af37]">
                Guardian Experience
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                Reassuring Peace of Mind for Parents &amp; Guardians
              </h2>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">
              Knowing your child is safe while commuting to and from school is paramount. ITIS provides timely, relevant notifications without invasive surveillance.
            </p>

            <div className="space-y-4 pt-2">
              <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5 text-left">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#d4af37]" />
                  <span>Journey Milestone Updates</span>
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Receive updates when your child reaches school, boards designated transport, or completes daily journey milestones.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5 text-left">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#d4af37]" />
                  <span>Authorised Custody &amp; Collections</span>
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Easily designate trusted contacts or family members authorised to collect your child from school grounds.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5 text-left">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#d4af37]" />
                  <span>Coordinated Support</span>
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  If an unexpected delay or safety concern occurs, the platform facilitates swift communication with school staff and response providers.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 5. FOR SCHOOLS */}
        {selectedCategory === 'for-schools' && (
          <div className="p-6 sm:p-10 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#d4af37]">
                School Coordination
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                Streamlined Campus Safety &amp; Enrolment
              </h2>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">
              ITIS supports schools with campus arrival coordination, attendance visibility, and custody management without creating administrative friction.
            </p>

            <div className="space-y-4 pt-2">
              <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5 text-left">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-[#d4af37]" />
                  <span>Unified Safety Records</span>
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Enrolment links the learner, verified legal guardians, and authorised transport contacts into an authoritative safety profile.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5 text-left">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <SchoolIcon className="w-4 h-4 text-[#d4af37]" />
                  <span>Flexible Campus Ingress</span>
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Adapts to diverse school environments—from digital register check-ins to automated gate points—ensuring orderly flow during morning peak hours.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5 text-left">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#d4af37]" />
                  <span>Custody &amp; Collection Clarity</span>
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  School staff can quickly confirm authorised collectors, preventing custody uncertainties at school gates.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 6. EMERGENCY RESPONSE */}
        {selectedCategory === 'emergency-response' && (
          <div className="p-6 sm:p-10 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#d4af37]">
                Response Coordination
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                Coordination with Authorised Response Providers
              </h2>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">
              Designed for coordination with schools, authorised security providers, emergency services and public-sector stakeholders to support swift incident resolution.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
              <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 text-left">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-[#d4af37]" />
                  <span>Incident Verification</span>
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Authorised personnel verify situational details so response can be coordinated swiftly and appropriately.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 text-left">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Radio className="w-4 h-4 text-[#f3d368]" />
                  <span>Structured Coordination</span>
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Designed to work alongside schools, security providers, emergency services and public-sector stakeholders.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 text-left">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-emerald-400" />
                  <span>Accurate Incident Information</span>
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Response teams receive relevant location details and contact information to support their response.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 text-left">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-cyan-400" />
                  <span>Controlled Operational Access</span>
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Incident channels are restricted to verified personnel based on operational need, safeguarding minor privacy.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 7. TRUST & SAFETY: 4 PRINCIPLES */}
        {selectedCategory === 'trust-safety' && (
          <div className="p-6 sm:p-10 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#d4af37]">
                Governance &amp; Safeguards
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                Four Principles of Trust &amp; Safety
              </h2>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">
              Child safety technology requires strict ethical, legal, and operational governance. ITIS is built around four foundational principles.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
              
              {/* CHILD FIRST */}
              <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 text-left">
                <div className="flex items-center gap-2">
                  <HeartHandshake className="w-4 h-4 text-[#d4af37]" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">1. CHILD FIRST</h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Safety decisions are designed around the learner's wellbeing. Data collection is purposeful and limited to designated travel corridors and active safety events.
                </p>
              </div>

              {/* CONTROLLED ACCESS */}
              <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 text-left">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#f3d368]" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">2. CONTROLLED ACCESS</h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Information is available according to role and operational need. School staff, guardians, and response teams see only what is required for their responsibilities.
                </p>
              </div>

              {/* HUMAN DECISION-MAKING */}
              <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 text-left">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">3. HUMAN DECISION-MAKING</h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Technology supports decisions; authorised people remain responsible for escalation and response. Human judgment remains central to every emergency workflow.
                </p>
              </div>

              {/* PRIVACY BY DESIGN */}
              <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 text-left">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">4. PRIVACY BY DESIGN</h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Personal information is handled with privacy, security and accountability in mind. Built with POPIA-aligned privacy and security safeguards, subject to formal legal and compliance review.
                </p>
              </div>

            </div>
          </div>
        )}

        {/* 8. REQUEST A DEMO / CONTACT */}
        {selectedCategory === 'request-demo' && (
          <div className="p-6 sm:p-10 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#d4af37]">
                Institutional Consultation
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                Request a Consultation
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                Connect with the ITIS team to evaluate deployment options for your school campus, transport fleet, or district.
              </p>
            </div>

            {demoSubmitted ? (
              <div className="p-6 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">Consultation Request Received</h3>
                <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                  Thank you for your inquiry. An ITIS safety specialist will review your details and be in touch promptly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleDemoSubmit} className="space-y-4 max-w-2xl text-left">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-slate-300 block">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={demoForm.name}
                      onChange={(e) => setDemoForm({ ...demoForm, name: e.target.value })}
                      placeholder="e.g. Dr. Pieter van der Merwe"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#d4af37]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-slate-300 block">Official Email Address *</label>
                    <input
                      type="email"
                      required
                      value={demoForm.email}
                      onChange={(e) => setDemoForm({ ...demoForm, email: e.target.value })}
                      placeholder="principal@schoolname.edu.za"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#d4af37]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-slate-300 block">Contact Phone Number *</label>
                    <input
                      type="tel"
                      required
                      value={demoForm.phone}
                      onChange={(e) => setDemoForm({ ...demoForm, phone: e.target.value })}
                      placeholder="+27 (0) 11 555 0192"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#d4af37]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-slate-300 block">School or Organisation Name *</label>
                    <input
                      type="text"
                      required
                      value={demoForm.organization}
                      onChange={(e) => setDemoForm({ ...demoForm, organization: e.target.value })}
                      placeholder="e.g. Pretoria High School for Girls"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#d4af37]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-slate-300 block">Your Role</label>
                    <select
                      value={demoForm.role}
                      onChange={(e) => setDemoForm({ ...demoForm, role: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-[#d4af37]"
                    >
                      <option>School Principal / Headmaster</option>
                      <option>School Governing Body (SGB) Member</option>
                      <option>Campus Safety Coordinator</option>
                      <option>Scholar Transport Operator</option>
                      <option>Education Stakeholder</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-slate-300 block">Estimated Number of Learners</label>
                    <input
                      type="text"
                      value={demoForm.learnerCount}
                      onChange={(e) => setDemoForm({ ...demoForm, learnerCount: e.target.value })}
                      placeholder="e.g. 850 learners"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#d4af37]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300 block">Specific Requirements or Comments</label>
                  <textarea
                    rows={3}
                    value={demoForm.message}
                    onChange={(e) => setDemoForm({ ...demoForm, message: e.target.value })}
                    placeholder="Tell us about your campus gates, transport routes, or scheduling requirements..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#d4af37] resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full sm:w-auto min-h-[48px] px-8 py-3 rounded-xl bg-[#d4af37] hover:bg-[#c29f2f] text-slate-950 text-xs font-extrabold shadow-lg shadow-[#d4af37]/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>SUBMIT CONSULTATION REQUEST</span>
                </button>
              </form>
            )}
          </div>
        )}

      </div>

      {/* Explore Footer Navigation */}
      <div className="pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
        <button
          onClick={returnToHome}
          className="text-xs font-bold text-slate-400 hover:text-[#d4af37] flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-[#d4af37]" />
          <span>Return to Homepage Overview</span>
        </button>

        <button
          onClick={() => setSelectedCategory('request-demo')}
          className="text-xs font-bold text-[#d4af37] hover:text-[#f3d368] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <span>Contact ITIS</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

    </div>
  );
};
