import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Radio, 
  UserCheck, 
  Users, 
  School, 
  Building2, 
  Navigation, 
  Lock, 
  PlusCircle,
  LogOut, 
  LogIn, 
  User,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  Phone,
  Newspaper,
  Briefcase,
  HelpCircle,
  Layers,
  HeartHandshake
} from 'lucide-react';
import { UserRole, ActiveUserSession } from '../types.js';

export type AppTab = 
  | 'LANDING_PAGE' 
  | 'LOGIN'
  | 'COMMAND_CENTRE' 
  | 'SCHOOL_PORTAL' 
  | 'GUARDIAN_HUB' 
  | 'RESPONDER_TACTICAL' 
  | 'EXECUTIVE_AUDIT' 
  | 'IMMUTABLE_LOGS'
  | 'TECHNICIAN_PORTAL'
  | 'ADMIN_PORTAL'
  | 'RBAC_SECURITY';

interface Props {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  currentUser: ActiveUserSession | null;
  onOpenLogin: () => void;
  onLogout: () => void;
  onOpenEnrolment: () => void;
  onOpenPanic: () => void;
  activePanicCount: number;
  activeLandingSection?: string;
  onSelectLandingSection?: (sectionId: string) => void;
}

export const Header: React.FC<Props> = ({
  activeTab,
  setActiveTab,
  currentUser,
  onOpenLogin,
  onLogout,
  onOpenEnrolment,
  onOpenPanic,
  activePanicCount,
  activeLandingSection = 'overview',
  onSelectLandingSection
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'PARENT_GUARDIAN': return { label: 'Guardian', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
      case 'SCHOOL_PRINCIPAL': return { label: 'Principal', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' };
      case 'SCHOOL_ADMIN_STAFF': return { label: 'School Admin', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' };
      case 'COMMAND_OPERATOR': return { label: 'Command Officer', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' };
      case 'TECHNICIAN': return { label: 'Hardware Tech', color: 'bg-slate-800 text-cyan-300 border-cyan-500/30' };
      case 'SYSTEM_ADMIN': return { label: 'System Admin', color: 'bg-slate-800 text-slate-200 border-slate-700' };
      case 'FIELD_RESPONDER': return { label: 'Field Responder', color: 'bg-blue-500/20 text-blue-300 border-blue-500/40' };
      case 'GOVERNMENT_AUDITOR': return { label: 'DBE Auditor', color: 'bg-[#d4af37]/15 text-[#f3d368] border-[#d4af37]/35' };
      case 'FOUNDER_EXECUTIVE': return { label: 'SuperAdmin / Founder', color: 'bg-[#d4af37]/20 text-[#f3d368] border-[#d4af37]/45' };
      default: return { label: 'Verified User', color: 'bg-slate-800 text-slate-300 border-slate-700' };
    }
  };

  const getPrimaryPortalTab = (role: UserRole): AppTab => {
    switch (role) {
      case 'PARENT_GUARDIAN': return 'GUARDIAN_HUB';
      case 'SCHOOL_PRINCIPAL':
      case 'SCHOOL_ADMIN_STAFF': return 'SCHOOL_PORTAL';
      case 'COMMAND_OPERATOR': return 'COMMAND_CENTRE';
      case 'TECHNICIAN': return 'TECHNICIAN_PORTAL';
      case 'SYSTEM_ADMIN': return 'ADMIN_PORTAL';
      case 'FIELD_RESPONDER': return 'RESPONDER_TACTICAL';
      case 'GOVERNMENT_AUDITOR': return 'EXECUTIVE_AUDIT';
      case 'FOUNDER_EXECUTIVE': return 'EXECUTIVE_AUDIT';
      default: return 'LANDING_PAGE';
    }
  };

  const navigateToSection = (sectionId: string) => {
    setMobileMenuOpen(false);
    if (onSelectLandingSection) {
      onSelectLandingSection(sectionId);
    }
    if (activeTab !== 'LANDING_PAGE') {
      setActiveTab('LANDING_PAGE');
    }
    setTimeout(() => {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  return (
    <header className="sticky top-0 z-50 bg-[#060b18]/95 backdrop-blur-md border-b border-slate-800/80 w-full transition-all">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-2 sm:gap-4">
          
          {/* ==================================================== */}
          {/* LEFT: OFFICIAL ITIS LOGO & BRAND IDENTITY */}
          {/* ==================================================== */}
          <div 
            onClick={() => {
              if (onSelectLandingSection) onSelectLandingSection('home');
              setActiveTab('LANDING_PAGE');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-2.5 sm:gap-3.5 shrink-0 cursor-pointer group select-none min-w-0"
          >
            <div className="relative shrink-0">
              <img 
                src="/branding/itis-logo.png" 
                alt="ITIS Official Emblem" 
                className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl border border-[#d4af37]/40 object-cover shadow-lg shadow-[#060b18]/80 group-hover:border-[#d4af37] group-hover:scale-105 transition-all duration-200 aspect-square"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold tracking-tight text-white text-sm sm:text-base md:text-lg">
                  ITIS GUARDIAN NETWORK
                </span>
              </div>
              <span className="text-[9px] sm:text-[10px] text-slate-400 font-mono tracking-wider uppercase hidden sm:block -mt-0.5 truncate">
                INTEGRATED TECHNOLOGY INTELLIGENCE &amp; SAFETY
              </span>
            </div>
          </div>

          {/* ==================================================== */}
          {/* CENTRE / RIGHT: PREMIUM NAVIGATION (DESKTOP) */}
          {/* ==================================================== */}
          <nav className="hidden md:flex items-center gap-2 lg:gap-4 text-xs lg:text-sm font-bold tracking-wide text-slate-300">
            <button
              onClick={() => navigateToSection('why-itis')}
              className="px-3 py-2 rounded-lg hover:text-[#d4af37] hover:bg-[#0a1224] transition-colors cursor-pointer"
            >
              WHY ITIS
            </button>
            <button
              onClick={() => navigateToSection('solutions')}
              className="px-3 py-2 rounded-lg hover:text-[#d4af37] hover:bg-[#0a1224] transition-colors cursor-pointer"
            >
              SOLUTIONS
            </button>
            <button
              onClick={() => navigateToSection('overview')}
              className="px-3 py-2 rounded-lg hover:text-[#d4af37] hover:bg-[#0a1224] transition-colors cursor-pointer"
            >
              EXPLORE
            </button>
            <button
              onClick={() => navigateToSection('company')}
              className="px-3 py-2 rounded-lg hover:text-[#d4af37] hover:bg-[#0a1224] transition-colors cursor-pointer"
            >
              COMPANY
            </button>
          </nav>

          {/* ==================================================== */}
          {/* RIGHT: UTILITY & AUTHENTICATED USER STATUS (NO LOGIN BUTTON) */}
          {/* ==================================================== */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            
            {/* Authenticated Portal Badge (Only when logged in) */}
            {currentUser && (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  onClick={() => setActiveTab(getPrimaryPortalTab(currentUser.role))}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#0a1224] hover:bg-slate-900 border border-[#d4af37]/40 text-xs font-semibold text-[#f3d368] flex items-center gap-2 cursor-pointer transition-colors shadow-sm"
                  title="Open Authorized Portal"
                >
                  <User className="w-3.5 h-3.5 text-[#d4af37] shrink-0" />
                  <span className="max-w-[80px] sm:max-w-[120px] truncate hidden xs:inline">{currentUser.name}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono border ${getRoleBadge(currentUser.role).color}`}>
                    {getRoleBadge(currentUser.role).label}
                  </span>
                </button>

                <button
                  onClick={onLogout}
                  className="min-h-[40px] min-w-[40px] p-2 rounded-xl bg-[#0a1224] hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-800 transition-colors flex items-center justify-center cursor-pointer"
                  title="Sign Out"
                  aria-label="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Mobile Hamburger Toggle Button (Min 44x44 Touch Target) */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden min-h-[44px] min-w-[44px] p-2.5 rounded-xl bg-[#0a1224] border border-slate-800 text-slate-200 hover:text-[#d4af37] hover:bg-slate-900 transition-colors flex items-center justify-center cursor-pointer active:scale-95"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5 text-[#d4af37]" />
            </button>
          </div>

        </div>
      </div>

      {/* ==================================================== */}
      {/* FULL-EXPERIENCE MOBILE NAVIGATION DRAWER */}
      {/* ==================================================== */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-[#060b18] overflow-y-auto flex flex-col animate-in fade-in duration-150">
          
          {/* Mobile Drawer Top Bar */}
          <div className="sticky top-0 z-10 bg-[#060b18]/95 backdrop-blur-md border-b border-slate-800 px-4 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img 
                src="/branding/itis-logo.png" 
                alt="ITIS Emblem" 
                className="w-8 h-8 rounded-lg border border-[#d4af37]/40 object-cover aspect-square"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div>
                <span className="font-extrabold text-white text-sm tracking-tight block">ITIS GUARDIAN NETWORK</span>
                <span className="text-[10px] text-cyan-400 font-mono">Mobile Navigation Hub</span>
              </div>
            </div>

            <button
              onClick={() => setMobileMenuOpen(false)}
              className="min-h-[44px] min-w-[44px] p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer active:scale-95"
              aria-label="Close Navigation Menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mobile Drawer Body */}
          <div className="flex-1 p-4 sm:p-6 space-y-6 max-w-md mx-auto w-full">
            
            {/* Authenticated user status if logged in */}
            {currentUser && (
              <div className="p-4 rounded-2xl bg-[#0a1224] border border-[#d4af37]/40 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Signed in as <strong className="text-white">{currentUser.name}</strong></span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${getRoleBadge(currentUser.role).color}`}>
                    {getRoleBadge(currentUser.role).label}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setActiveTab(getPrimaryPortalTab(currentUser.role));
                  }}
                  className="w-full min-h-[44px] py-2 rounded-xl bg-[#d4af37]/15 hover:bg-[#d4af37]/25 border border-[#d4af37]/40 text-[#f3d368] text-xs font-bold flex items-center justify-center gap-2"
                >
                  <UserCheck className="w-4 h-4 text-[#d4af37]" />
                  <span>Go to My Authorized Portal</span>
                </button>
              </div>
            )}

            {/* Structured Mobile Menu Items */}
            <div className="space-y-2">
              <div className="text-[11px] font-mono uppercase text-[#d4af37] font-bold px-2 mb-1">
                Navigation
              </div>

              {[
                { id: 'why-itis', title: 'Why ITIS', desc: 'Child-first protection & response coordination', icon: Building2 },
                { id: 'solutions', title: 'Solutions', desc: 'Guardians, schools & accredited responders', icon: Layers },
                { id: 'overview', title: 'Explore', desc: 'Comprehensive Guardian Network documentation', icon: ShieldCheck },
                { id: 'company', title: 'Company', desc: 'About, leadership, careers, news & contact', icon: Users },
              ].map((item) => {
                const ItemIcon = item.icon;
                const isActive = activeLandingSection === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => navigateToSection(item.id)}
                    className={`w-full min-h-[52px] p-3.5 rounded-xl text-left flex items-center justify-between gap-3 border transition-colors cursor-pointer active:scale-98 ${
                      isActive 
                        ? 'bg-[#0a1224] border-[#d4af37]/60 text-white' 
                        : 'bg-[#0a1224]/70 border-slate-800 text-slate-300 hover:bg-[#0a1224] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-[#060b18] flex items-center justify-center shrink-0 border border-[#d4af37]/30 text-[#d4af37]">
                        <ItemIcon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white tracking-wide">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {item.desc}
                        </div>
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                  </button>
                );
              })}
            </div>

            {/* Quick Actions at Bottom of Menu */}
            <div className="pt-2 border-t border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>24/7 Operations Hotline</span>
                <span className="text-emerald-400 font-mono font-bold">+27 (0) 12 004 8890</span>
              </div>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenPanic();
                }}
                className="w-full min-h-[44px] py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center justify-center gap-2 active:scale-95"
              >
                <Radio className="w-4 h-4 text-rose-400" />
                <span>Test Emergency SOS Response Simulation</span>
              </button>
            </div>

          </div>

        </div>
      )}
    </header>
  );
};

