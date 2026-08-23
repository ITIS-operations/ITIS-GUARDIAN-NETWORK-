import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Users, 
  School as SchoolIcon, 
  Lock, 
  ArrowRight, 
  ChevronRight,
  ChevronLeft,
  Phone, 
  Mail, 
  CheckCircle2, 
  LogIn,
  HeartHandshake,
  Send,
  Radio,
  Clock,
  UserCheck,
  Building2,
  Shield,
  HelpCircle,
  Layers,
  Sparkles,
  Info,
  Flame,
  FileCheck2,
  Navigation
} from 'lucide-react';
import { ActiveUserSession } from '../types.js';

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
      // Map any incoming section ID to valid explore category or open explore
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

  // Demo consultation form state
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
    { id: 'overview', label: 'OVERVIEW', icon: Info },
    { id: 'why-itis', label: 'WHY ITIS', icon: Building2 },
    { id: 'how-it-works', label: 'HOW IT WORKS', icon: Navigation },
    { id: 'for-parents', label: 'FOR PARENTS', icon: HeartHandshake },
    { id: 'for-schools', label: 'FOR SCHOOLS', icon: SchoolIcon },
    { id: 'emergency-response', label: 'EMERGENCY RESPONSE', icon: Radio },
    { id: 'trust-safety', label: 'TRUST & SAFETY', icon: ShieldCheck },
    { id: 'request-demo', label: 'REQUEST A DEMO', icon: Phone },
  ];

  // State for hero image load error / fallback
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  // =========================================================================
  // VIEW 1: CALM, PREMIUM, SPACIOUS CORPORATE HOMEPAGE (currentView === 'home')
  // =========================================================================
  if (currentView === 'home') {
    return (
      <div className="text-slate-100 selection:bg-[#d4af37] selection:text-slate-950 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-16 sm:space-y-24">
        
        {/* ==================================================== */}
        {/* 1. HERO SECTION (2-Column Desktop / Stacked Mobile) */}
        {/* ==================================================== */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center pt-2 sm:pt-4">
          
          {/* LEFT COLUMN: BRAND & MISSION (7 Cols) */}
          <div className="lg:col-span-7 space-y-6 text-left">
            
            {/* Official Brand Identity */}
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#0a1224] border border-[#d4af37]/40 text-[#f3d368] text-xs font-mono font-bold tracking-wider uppercase">
                <ShieldCheck className="w-3.5 h-3.5 text-[#d4af37]" />
                <span>ITIS GUARDIAN NETWORK</span>
              </div>
              <p className="text-xs sm:text-sm font-semibold tracking-widest text-slate-400 uppercase font-mono">
                INTEGRATED TECHNOLOGY INTELLIGENCE &amp; SAFETY
              </p>
            </div>

            {/* Primary Mission Headline */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.1]">
              PROTECTING EVERY LEARNER.<br />
              EVERY JOURNEY.<br />
              <span className="text-[#d4af37]">EVERY SECOND.</span>
            </h1>

            {/* Short Supporting Statement (Appears ONLY ONCE) */}
            <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl">
              A coordinated child-safety network connecting guardians, schools and authorised response partners through intelligent technology and human-led coordination.
            </p>

            {/* Dual Actions with Clear Hierarchy: PRIMARY: LOGIN, SECONDARY: EXPLORE */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
              <button
                onClick={onOpenLogin}
                className="min-h-[46px] px-8 py-3 rounded-xl bg-[#d4af37] hover:bg-[#c29f2f] text-slate-950 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-[#d4af37]/15 transition-all cursor-pointer active:scale-95"
              >
                <LogIn className="w-4 h-4 text-slate-950" />
                <span>LOGIN</span>
              </button>

              <button
                onClick={() => openExplore('overview')}
                className="min-h-[46px] px-6 py-3 rounded-xl bg-[#0a1224] hover:bg-[#0f1a30] border border-[#d4af37]/40 text-slate-100 hover:text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer group shadow-sm"
              >
                <span>EXPLORE GUARDIAN NETWORK</span>
                <ArrowRight className="w-4 h-4 text-[#d4af37] group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

          </div>

          {/* RIGHT COLUMN: DEDICATED HERO IMAGE (5 Cols) */}
          <div className="lg:col-span-5 w-full">
            <div className="relative rounded-2xl border border-[#d4af37]/30 bg-[#0a1224] overflow-hidden shadow-2xl shadow-[#040812] aspect-[16/11] sm:aspect-[16/10] lg:aspect-[4/3] flex items-center justify-center group">
              
              {/* Actual image */}
              {!heroImgFailed ? (
                <img
                  src="/images/itis-hero.jpg"
                  alt="ITIS Guardian Network"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  onError={() => setHeroImgFailed(true)}
                />
              ) : null}

              {/* Graceful Fallback Frame */}
              {heroImgFailed && (
                <div className="absolute inset-0 bg-gradient-to-br from-[#0a1224] via-[#060b18] to-[#0a1224] p-6 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-[#060b18] border border-[#d4af37]/50 flex items-center justify-center shadow-lg shadow-[#d4af37]/10">
                    <img 
                      src="/branding/itis-logo.png" 
                      alt="ITIS Emblem" 
                      className="w-10 h-10 object-contain"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-white tracking-wide">ITIS GUARDIAN NETWORK</h3>
                    <p className="text-[11px] text-slate-400 max-w-xs font-mono">
                      National Child Safety &amp; Journey Coordination Infrastructure
                    </p>
                  </div>
                  <span className="text-[10px] text-[#d4af37] bg-[#d4af37]/10 px-2.5 py-1 rounded border border-[#d4af37]/30 font-mono">
                    Republic of South Africa
                  </span>
                </div>
              )}

              {/* Subtle Gold Edge Highlight */}
              <div className="absolute inset-0 rounded-2xl border border-[#d4af37]/20 pointer-events-none" />
            </div>
          </div>

        </section>

        {/* ==================================================== */}
        {/* 2. WHY ITIS (CONCISE & 3 PRINCIPLES) */}
        {/* ==================================================== */}
        <section id="why-itis" className="space-y-8 pt-8 border-t border-slate-800/80 max-w-5xl mx-auto">
          <div className="space-y-2 text-center max-w-2xl mx-auto">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#d4af37]">
              WHY ITIS
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              When a learner needs help, every second matters.
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              ITIS bridges the communication gap during daily school journeys between home and school gates, replacing uncertainty with verified, immediate coordination.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            <div className="p-6 rounded-2xl bg-[#0a1224] border border-slate-800 space-y-2.5">
              <div className="text-[#d4af37] font-mono text-xs font-bold uppercase tracking-wider">
                CHILD-FIRST
              </div>
              <h3 className="text-base font-bold text-white">
                Learner at the Centre
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Every protocol, alert and operational procedure is built exclusively to protect the physical safety and dignity of the learner.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#0a1224] border border-slate-800 space-y-2.5">
              <div className="text-[#f3d368] font-mono text-xs font-bold uppercase tracking-wider">
                COORDINATED
              </div>
              <h3 className="text-base font-bold text-white">
                Unified Ecosystem
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Bringing schools, verified guardians and accredited first responders into a single, verified communication loop.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#0a1224] border border-slate-800 space-y-2.5">
              <div className="text-[#d4af37] font-mono text-xs font-bold uppercase tracking-wider">
                HUMAN-LED
              </div>
              <h3 className="text-base font-bold text-white">
                Certified Oversight
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Trained national command operators assess, verify, and direct every emergency response with zero autonomous dispatch.
              </p>
            </div>
          </div>
        </section>

        {/* ==================================================== */}
        {/* 3. SOLUTIONS (CONCISE SUMMARY OF 3 PILLARS) */}
        {/* ==================================================== */}
        <section id="solutions" className="space-y-8 pt-8 border-t border-slate-800/80 max-w-5xl mx-auto">
          <div className="space-y-2 text-center max-w-2xl mx-auto">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#d4af37]">
              SOLUTIONS
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Coordinated Safety Across Every School Journey
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Tailored capabilities providing seamless protection for families, institutions and emergency professionals.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            <div className="p-6 rounded-2xl bg-[#0a1224] border border-slate-800 space-y-3">
              <div className="w-9 h-9 rounded-xl bg-[#060b18] border border-[#d4af37]/30 text-[#d4af37] flex items-center justify-center">
                <HeartHandshake className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-white">For Guardians</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Real-time journey milestone alerts, digital custody delegation, and 24/7 human-assisted emergency support.
              </p>
              <button
                onClick={() => openExplore('for-parents')}
                className="text-xs font-bold text-[#d4af37] hover:text-[#f3d368] inline-flex items-center gap-1 cursor-pointer pt-1"
              >
                <span>Learn more</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-6 rounded-2xl bg-[#0a1224] border border-slate-800 space-y-3">
              <div className="w-9 h-9 rounded-xl bg-[#060b18] border border-[#d4af37]/30 text-[#d4af37] flex items-center justify-center">
                <SchoolIcon className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-white">For Schools</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                High-throughput contactless gate verification, automated attendance reconciliation, and verified custody pickup.
              </p>
              <button
                onClick={() => openExplore('for-schools')}
                className="text-xs font-bold text-[#d4af37] hover:text-[#f3d368] inline-flex items-center gap-1 cursor-pointer pt-1"
              >
                <span>Learn more</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-6 rounded-2xl bg-[#0a1224] border border-slate-800 space-y-3">
              <div className="w-9 h-9 rounded-xl bg-[#060b18] border border-[#d4af37]/30 text-[#d4af37] flex items-center justify-center">
                <Radio className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-white">For Responders</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Direct tactical dispatch, live situational coordinates, and accredited multi-agency emergency coordination.
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
        {/* 4. COMPANY & PUBLIC INFORMATION */}
        {/* ==================================================== */}
        <section id="company" className="space-y-6 pt-8 border-t border-slate-800/80 max-w-5xl mx-auto">
          <div className="space-y-2 text-center max-w-2xl mx-auto">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#d4af37]">
              COMPANY
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Institutional Governance &amp; Purpose
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Dedicated to national child safety, ethical technology standards, and sovereign South African data custody.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
            {[
              { label: 'ABOUT ITIS', cat: 'why-itis' as ExploreCategory },
              { label: 'LEADERSHIP', cat: 'trust-safety' as ExploreCategory },
              { label: 'CAREERS', cat: 'overview' as ExploreCategory },
              { label: 'NEWS', cat: 'overview' as ExploreCategory },
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
  // (Shows ONLY the single selected category's content)
  // =========================================================================
  return (
    <div className="text-slate-100 selection:bg-[#d4af37] selection:text-slate-950 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
      
      {/* Top Return Navigation Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <button
          onClick={returnToHome}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0a1224] hover:bg-slate-850 border border-slate-800 text-xs font-bold text-[#d4af37] hover:text-white flex items-center gap-2 transition-all cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4 text-[#d4af37]" />
          <span>← BACK TO ITIS</span>
        </button>

        {/* Authenticated user status if already signed in */}
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
          Discover how ITIS connects people, technology and coordinated response around the safety of every learner.
        </p>
      </div>

      {/* ==================================================== */}
      {/* CATEGORY NAVIGATION (Desktop Tabs / Mobile Segmented Grid) */}
      {/* ==================================================== */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-1.5">
        {/* Desktop Tabs */}
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
                    ? 'bg-cyan-500 text-slate-950 shadow-md font-extrabold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Mobile / Tablet Segmented 2-Column Grid (Compact, No Horizontal Scroll) */}
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
                    ? 'bg-cyan-500 text-slate-950 shadow-md font-extrabold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ==================================================== */}
      {/* CATEGORY CONTENT CONTAINER (Only Selected Category Visible) */}
      {/* ==================================================== */}
      <div className="pt-2">

        {/* 1. OVERVIEW (~100 words concise overview) */}
        {selectedCategory === 'overview' && (
          <div className="p-6 sm:p-10 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-cyan-400">
                Institutional Summary
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                Overview of the ITIS Guardian Network
              </h2>
            </div>

            <p className="text-sm sm:text-base text-slate-200 leading-relaxed max-w-3xl">
              ITIS (Integrated Technology Intelligence &amp; Safety) is South Africa’s dedicated child-safety and journey coordination network. It bridges the critical communication gap between schools, verified guardians, and accredited emergency response services into an active protection ecosystem. By combining automated campus gate access, secure journey verification, and a 24/7 human-command operations centre, ITIS ensures rapid, verified coordination during critical school journey moments. Engineered with privacy-first standards, ITIS maintains strict POPIA §18 minor data protection with sovereign local hosting and a 0% autonomous dispatch mandate.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-800/80">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <div className="text-cyan-400 text-xs font-mono font-bold">IDENTITY</div>
                <div className="text-xs text-slate-300">National child-safety coordination infrastructure.</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <div className="text-emerald-400 text-xs font-mono font-bold">OPERATIONS</div>
                <div className="text-xs text-slate-300">24/7 human-verified emergency triage.</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <div className="text-amber-400 text-xs font-mono font-bold">GOVERNANCE</div>
                <div className="text-xs text-slate-300">Sovereign South African POPIA §18 compliance.</div>
              </div>
            </div>
          </div>
        )}

        {/* 2. WHY ITIS (Safety problem statement) */}
        {selectedCategory === 'why-itis' && (
          <div className="p-6 sm:p-10 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-amber-400">
                The Core Challenge
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                Why South Africa Needs ITIS
              </h2>
            </div>

            <p className="text-sm sm:text-base text-slate-200 leading-relaxed max-w-3xl">
              South African learners encounter significant daily vulnerabilities during school journeys: long travel distances, informal scholar transport arrangements, delayed emergency reporting, and disconnected communications between schools and parents.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
              <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>The Daily Journey Communication Gap</span>
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  When a child is delayed or in distress during school travel, schools and parents often don't find out for hours. ITIS eliminates this blind spot with instantaneous corridor alerts.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-cyan-400" />
                  <span>Legal Custody Verification</span>
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Unauthorized campus pick-ups and custody disputes disrupt school operations. ITIS creates verified digital links between schools, legal guardians, and vetted drivers.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Radio className="w-4 h-4 text-purple-400" />
                  <span>0% Autonomous Dispatch</span>
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Automated bots cause false alarms that overwhelm emergency personnel. ITIS routes all anomalies through certified human operators before dispatching field teams.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <span>Data Sovereignty &amp; Child Privacy</span>
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Consumer tracking applications monetize location data. ITIS is non-commercial, fully POPIA §18 compliant, and hosted exclusively within South Africa.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 3. HOW IT WORKS (Sequential 6-step flow with clear descriptions) */}
        {selectedCategory === 'how-it-works' && (
          <div className="p-6 sm:p-10 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-cyan-400">
                End-to-End Workflow
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                How the Coordinated Response Works
              </h2>
              <p className="text-xs sm:text-sm text-slate-300">
                A seamless sequence ensuring verifiable safety at every point of the journey.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              {[
                {
                  step: '01',
                  name: 'LEARNER',
                  desc: 'A safe journey corridor check-in is recorded or a silent distress signal is initiated via smart wearable or safe check-in point.'
                },
                {
                  step: '02',
                  name: 'SCHOOL',
                  desc: 'Campus gate sensors log attendance automatically, eliminating gate queues and administrative paperwork.'
                },
                {
                  step: '03',
                  name: 'GUARDIAN',
                  desc: 'Verified legal guardians receive real-time notification of departures, arrivals, and safe journey milestones.'
                },
                {
                  step: '04',
                  name: 'ITIS COMMAND',
                  desc: 'In any distress situation, 24/7 certified National Operations Command personnel verify the alert in under 15 seconds.'
                },
                {
                  step: '05',
                  name: 'AUTHORISED RESPONSE',
                  desc: 'Command operators coordinate directly with accredited SAPS units, private armed response partners, or EMS paramedics.'
                },
                {
                  step: '06',
                  name: 'SAFE OUTCOME',
                  desc: 'Child is secured in verified custody with instant incident resolution logs sent to guardians and school administrators.'
                }
              ].map((item) => (
                <div key={item.step} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start gap-4">
                  <div className="w-8 h-8 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-500/30 text-xs font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {item.step}
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-white tracking-wide">{item.name}</h3>
                    <p className="text-xs text-slate-300 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. FOR PARENTS (Guardian experience in simple reassuring language) */}
        {selectedCategory === 'for-parents' && (
          <div className="p-6 sm:p-10 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-cyan-400">
                Guardian Experience
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                Reassuring Peace of Mind for Parents &amp; Guardians
              </h2>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">
              As a parent, knowing your child is safe while commuting to and from school is paramount. ITIS provides simple, transparent notifications without invasive surveillance.
            </p>

            <div className="space-y-4 pt-2">
              <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                  <span>Real-Time Safe Journey Milestone Notifications</span>
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Receive instant alerts when your child safely enters school gates, boards designated transport, or arrives back home.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                  <span>Simple Custody Delegation</span>
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Authorize a grandparent, trusted friend, or vetted transport driver to collect your child from school with a single secure tap.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                  <span>24/7 Human-Assisted Emergency Support</span>
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  If your child experiences an unexpected delay or safety concern, dedicated emergency operators are instantly on standby to coordinate help.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 5. FOR SCHOOLS (School coordination & capture-once enrolment) */}
        {selectedCategory === 'for-schools' && (
          <div className="p-6 sm:p-10 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-blue-400">
                School Coordination
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                Streamlined Campus Safety &amp; Capture-Once Enrolment
              </h2>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">
              ITIS empowers schools with fast, contactless campus gate management and seamless student safety coordination without adding administrative workload for teachers or staff.
            </p>

            <div className="space-y-4 pt-2">
              <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-blue-400" />
                  <span>Capture-Once Enrolment Architecture</span>
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  A single enrolment transaction links the learner, verified legal guardians, and authorized transport providers into a secure custody record.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <SchoolIcon className="w-4 h-4 text-blue-400" />
                  <span>High-Throughput Gate Verification</span>
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Automated gate readers process hundreds of arrivals per minute, ensuring zero congestion during morning peak hours.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-400" />
                  <span>Dispute-Free Custody Assurance</span>
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Gate security personnel instantly verify whether an individual collecting a child is currently authorized, preventing custody disputes at the school gates.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 6. EMERGENCY RESPONSE (Human-led command coordination) */}
        {selectedCategory === 'emergency-response' && (
          <div className="p-6 sm:p-10 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-amber-400">
                Command Coordination
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                Professional Multi-Agency Emergency Response
              </h2>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">
              ITIS operates a dedicated 24/7 National Operations Command centre that coordinates with verified emergency partners across South Africa to resolve school journey incidents swiftly.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
              <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-amber-400" />
                  <span>Human-Verified Triage</span>
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Certified operators verify distress signals within 15 seconds, eliminating false panic while ensuring authentic emergencies receive immediate attention.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Radio className="w-4 h-4 text-cyan-400" />
                  <span>Accredited Partner Interoperability</span>
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Command staff directly dispatch accredited SAPS units, vetted private armed response fleets, and EMS paramedics based on exact incident requirements.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-purple-400" />
                  <span>Tactical GPS Precision</span>
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  First responders receive verified situational coordinates and emergency contact details to minimize response times and locate minors rapidly.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <span>Strict Operational Privacy</span>
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Tactical response channels are cryptographically restricted to authorized personnel, safeguarding minor identities at all times.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 7. TRUST & SAFETY (Child-first protection, POPIA §18, human oversight) */}
        {selectedCategory === 'trust-safety' && (
          <div className="p-6 sm:p-10 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-400">
                Governance &amp; Privacy
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                Built Upon Uncompromising Standards of Trust
              </h2>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">
              Child safety technology requires strict legal, ethical, and operational governance. ITIS is built around three foundational pillars of trust.
            </p>

            <div className="space-y-4 pt-2">
              <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2">
                  <HeartHandshake className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-bold text-white">1. Child-First Protection</h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Every technical capability is designed exclusively to protect the physical safety and dignity of the learner. Data is collected only during designated school travel corridors and active emergencies.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">2. Responsible POPIA §18 Data Protection</h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  All learner records are encrypted end-to-end and stored strictly on sovereign South African cloud infrastructure. Minor data is never sold, shared, or monetized for commercial advertising.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-white">3. 100% Human Oversight</h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  We enforce a strict 0% Autonomous Dispatch rule. Every emergency event is handled and verified by certified command specialists who evaluate context before deploying resources.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 8. REQUEST A DEMO (Institutional pilot consultation form) */}
        {selectedCategory === 'request-demo' && (
          <div className="p-6 sm:p-10 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-cyan-400">
                Institutional Consultation
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                Request a School Pilot Consultation
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                Connect with our national safety engineering team to evaluate deployment for your school campus, transport fleet, or district.
              </p>
            </div>

            {demoSubmitted ? (
              <div className="p-6 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">Consultation Request Received</h3>
                <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                  Thank you for your interest. An ITIS Institutional Safety Specialist will review your details and contact you within 1 business day.
                </p>
              </div>
            ) : (
              <form onSubmit={handleDemoSubmit} className="space-y-4 max-w-2xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-slate-300 block">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={demoForm.name}
                      onChange={(e) => setDemoForm({ ...demoForm, name: e.target.value })}
                      placeholder="e.g. Dr. Pieter van der Merwe"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
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
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
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
                      placeholder="+27 (0)11 555 0192"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-slate-300 block">School or Institution Name *</label>
                    <input
                      type="text"
                      required
                      value={demoForm.organization}
                      onChange={(e) => setDemoForm({ ...demoForm, organization: e.target.value })}
                      placeholder="e.g. Pretoria High School for Girls"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-slate-300 block">Your Role</label>
                    <select
                      value={demoForm.role}
                      onChange={(e) => setDemoForm({ ...demoForm, role: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option>School Principal / Headmaster</option>
                      <option>School Governing Body (SGB) Member</option>
                      <option>Campus Safety Coordinator</option>
                      <option>Scholar Transport Operator</option>
                      <option>Municipal / Provincial Education Official</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-slate-300 block">Estimated Number of Learners</label>
                    <input
                      type="text"
                      value={demoForm.learnerCount}
                      onChange={(e) => setDemoForm({ ...demoForm, learnerCount: e.target.value })}
                      placeholder="e.g. 850 learners"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
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
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full sm:w-auto min-h-[48px] px-8 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-extrabold shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>SUBMIT PILOT CONSULTATION REQUEST</span>
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

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-500">24/7 Operations Hotline:</span>
          <span className="text-xs font-mono font-bold text-[#d4af37]">
            +27 (0) 12 004 8890
          </span>
        </div>
      </div>

    </div>
  );
};
