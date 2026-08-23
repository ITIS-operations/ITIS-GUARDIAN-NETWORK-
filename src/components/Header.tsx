import React, { useState } from 'react';
import { 
  ShieldCheck, 
  UserCheck, 
  Users, 
  School, 
  Building2, 
  Lock, 
  LogOut, 
  LogIn, 
  User,
  Menu,
  X,
  Layers,
  HeartHandshake
} from 'lucide-react';
import { UserRole, ActiveUserSession } from '../types.js';
import { PublicNavigationDrawer } from './PublicNavigationDrawer.js';

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
  activeLandingSection = 'home',
  onSelectLandingSection
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  const handleNavClick = (sectionId: string) => {
    if (onSelectLandingSection) {
      onSelectLandingSection(sectionId);
    }
    if (activeTab !== 'LANDING_PAGE') {
      setActiveTab('LANDING_PAGE');
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#060b18]/95 backdrop-blur-md border-b border-slate-800/80 w-full transition-all">
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
            title="ITIS Guardian Network — Return to Homepage"
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
          {/* CENTRE: RESTRAINED PUBLIC NAVIGATION (DESKTOP) */}
          {/* ==================================================== */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-2 text-xs font-bold tracking-wider text-slate-300">
            <button
              onClick={() => handleNavClick('why-itis')}
              className="px-3 py-2 rounded-lg hover:text-[#d4af37] hover:bg-[#0a1224] transition-colors cursor-pointer"
            >
              WHY ITIS
            </button>
            <button
              onClick={() => handleNavClick('solutions')}
              className="px-3 py-2 rounded-lg hover:text-[#d4af37] hover:bg-[#0a1224] transition-colors cursor-pointer"
            >
              SOLUTIONS
            </button>
            <button
              onClick={() => handleNavClick('overview')}
              className="px-3 py-2 rounded-lg hover:text-[#d4af37] hover:bg-[#0a1224] transition-colors cursor-pointer"
            >
              EXPLORE
            </button>
            <button
              onClick={() => handleNavClick('company')}
              className="px-3 py-2 rounded-lg hover:text-[#d4af37] hover:bg-[#0a1224] transition-colors cursor-pointer"
            >
              COMPANY
            </button>
          </nav>

          {/* ==================================================== */}
          {/* RIGHT: SINGLE LOGIN BUTTON & TOP-RIGHT DRAWER BUTTON */}
          {/* ==================================================== */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            
            {/* Authenticated Portal Badge (Only when logged in) */}
            {currentUser ? (
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
            ) : (
              /* Public Visitor: Single Authoritative Login Button */
              <button
                onClick={onOpenLogin}
                className="min-h-[40px] px-4 sm:px-5 py-2 rounded-xl bg-[#d4af37] hover:bg-[#c29f2f] text-slate-950 text-xs sm:text-sm font-extrabold tracking-wide transition-all shadow-md shadow-[#d4af37]/15 flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <LogIn className="w-4 h-4 text-slate-950 shrink-0" />
                <span>LOGIN</span>
              </button>
            )}

            {/* Top-Right Secondary Information Drawer Trigger (All Screen Sizes) */}
            <button
              onClick={() => setDrawerOpen(true)}
              className="min-h-[40px] min-w-[40px] px-2.5 sm:px-3 py-2 rounded-xl bg-[#0a1224] hover:bg-slate-900 border border-slate-800 hover:border-[#d4af37]/40 text-slate-200 hover:text-[#d4af37] transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              aria-label="Open Public Information Menu"
              title="Public Information Menu"
            >
              <Menu className="w-4 h-4 sm:w-5 sm:h-5 text-[#d4af37]" />
              <span className="hidden sm:inline text-xs font-bold font-mono tracking-wider">MENU</span>
            </button>
          </div>

        </div>
      </div>

      {/* ==================================================== */}
      {/* PUBLIC INFORMATION & NAVIGATION DRAWER */}
      {/* ==================================================== */}
      <PublicNavigationDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onOpenLogin={onOpenLogin}
        onSelectCategory={(catId) => {
          if (onSelectLandingSection) onSelectLandingSection(catId);
          if (activeTab !== 'LANDING_PAGE') setActiveTab('LANDING_PAGE');
        }}
        currentUser={currentUser}
      />
    </header>
  );
};

