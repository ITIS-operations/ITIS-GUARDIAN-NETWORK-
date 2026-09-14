import React, { useState } from 'react';
import { 
  ShieldCheck, 
  ChevronDown, 
  LogIn,
  ArrowRight
} from 'lucide-react';
import { AppTab } from './Header.js';

interface Props {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  onOpenLogin: () => void;
  onSelectLandingSection?: (sectionId: string) => void;
}

export const Footer: React.FC<Props> = ({
  activeTab,
  setActiveTab,
  onOpenLogin,
  onSelectLandingSection
}) => {
  // Mobile accordion state for expandable sections
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  const navigateToSection = (sectionId: string) => {
    if (onSelectLandingSection) {
      onSelectLandingSection(sectionId);
    }
    if (activeTab !== 'LANDING_PAGE') {
      setActiveTab('LANDING_PAGE');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="w-full bg-[#040812] border-t border-slate-800/80 text-slate-400 text-xs selection:bg-[#d4af37] selection:text-slate-950">
      
      {/* MAIN FOOTER CONTAINER */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        
        {/* DESKTOP 12-COLUMN GRID (Hidden on mobile) */}
        <div className="hidden lg:grid grid-cols-12 gap-8">
          
          {/* COLUMN 1: ITIS BRAND IDENTITY (4 Columns) */}
          <div className="col-span-4 space-y-4 pr-6">
            <div 
              onClick={() => navigateToSection('overview')}
              className="flex items-center gap-3 cursor-pointer group select-none"
            >
              <img 
                src="/branding/itis-logo.png" 
                alt="ITIS Logo" 
                className="w-10 h-10 rounded-xl border border-[#d4af37]/40 object-cover shadow-md group-hover:border-[#d4af37] transition-colors"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-white text-base tracking-tight">ITIS</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#d4af37] bg-[#d4af37]/10 px-2 py-0.5 rounded border border-[#d4af37]/30">
                    GUARDIAN NETWORK
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium tracking-wide">
                  Integrated Technology Intelligence & Safety
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed max-w-sm">
              South African child-safety technology and coordination platform connecting guardians, schools, and authorised response partners.
            </p>

            <div className="pt-2 flex items-center gap-2 text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-[#d4af37] shrink-0" />
              <span>South African Child-Safety Technology Platform</span>
            </div>
          </div>

          {/* GROUP 1: PLATFORM (2 Columns) */}
          <div className="col-span-2 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              PLATFORM
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button 
                  onClick={() => navigateToSection('for-parents')}
                  className="hover:text-[#d4af37] transition-colors text-left cursor-pointer"
                >
                  Guardian Safety
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigateToSection('for-schools')}
                  className="hover:text-[#d4af37] transition-colors text-left cursor-pointer"
                >
                  School Safety
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigateToSection('emergency-response')}
                  className="hover:text-[#d4af37] transition-colors text-left cursor-pointer"
                >
                  Response Coordination
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigateToSection('how-it-works')}
                  className="hover:text-[#d4af37] transition-colors text-left cursor-pointer"
                >
                  How ITIS Works
                </button>
              </li>
            </ul>
          </div>

          {/* GROUP 2: TRUST (2 Columns) */}
          <div className="col-span-2 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              TRUST
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button 
                  onClick={() => navigateToSection('trust-safety')}
                  className="hover:text-[#d4af37] transition-colors text-left cursor-pointer"
                >
                  Privacy
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigateToSection('trust-safety')}
                  className="hover:text-[#d4af37] transition-colors text-left cursor-pointer"
                >
                  POPIA
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigateToSection('trust-safety')}
                  className="hover:text-[#d4af37] transition-colors text-left cursor-pointer"
                >
                  Security
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigateToSection('trust-safety')}
                  className="hover:text-[#d4af37] transition-colors text-left cursor-pointer"
                >
                  Responsible Disclosure
                </button>
              </li>
            </ul>
          </div>

          {/* GROUP 3: COMPANY (2 Columns) */}
          <div className="col-span-2 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              COMPANY
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button 
                  onClick={() => navigateToSection('why-itis')}
                  className="hover:text-[#d4af37] transition-colors text-left cursor-pointer"
                >
                  About ITIS
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigateToSection('for-schools')}
                  className="hover:text-[#d4af37] transition-colors text-left cursor-pointer"
                >
                  Partnerships
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigateToSection('request-demo')}
                  className="hover:text-[#d4af37] transition-colors text-left cursor-pointer"
                >
                  Contact
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigateToSection('overview')}
                  className="hover:text-[#d4af37] transition-colors text-left cursor-pointer"
                >
                  Careers
                </button>
              </li>
            </ul>
          </div>

          {/* GROUP 4: PORTAL (2 Columns) */}
          <div className="col-span-2 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              PORTAL
            </h4>
            <div className="space-y-2">
              <button 
                onClick={onOpenLogin}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#d4af37] hover:bg-[#c29f2f] text-slate-950 font-extrabold text-xs tracking-wider uppercase transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                title="Authorised access for registered guardians, schools and response personnel"
              >
                <LogIn className="w-3.5 h-3.5 text-slate-950 shrink-0" />
                <span>PORTAL ACCESS</span>
              </button>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Authorised access for registered guardians, schools and response personnel.
              </p>
            </div>
          </div>

        </div>

        {/* MOBILE ACCORDION (Visible < 1024px) */}
        <div className="lg:hidden space-y-6">
          
          {/* Brand Header on Mobile */}
          <div className="space-y-3">
            <div 
              onClick={() => navigateToSection('overview')}
              className="flex items-center gap-3 cursor-pointer"
            >
              <img 
                src="/branding/itis-logo.png" 
                alt="ITIS Logo" 
                className="w-9 h-9 rounded-xl border border-[#d4af37]/40 object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-white text-base tracking-tight">ITIS</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[#d4af37] bg-[#d4af37]/10 px-1.5 py-0.5 rounded border border-[#d4af37]/30">
                    GUARDIAN NETWORK
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">
                  Integrated Technology Intelligence & Safety
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              South African child-safety technology and coordination platform connecting guardians, schools, and authorised response partners.
            </p>
          </div>

          {/* Collapsible Sections Accordion */}
          <div className="border-t border-b border-slate-800 divide-y divide-slate-800/80">
            
            {/* Group: PLATFORM */}
            <div>
              <button
                type="button"
                onClick={() => toggleSection('platform')}
                className="w-full py-3.5 flex items-center justify-between text-xs font-bold text-white uppercase font-mono tracking-wider text-left cursor-pointer"
              >
                <span>PLATFORM</span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${expandedSection === 'platform' ? 'rotate-180 text-[#d4af37]' : ''}`} />
              </button>
              {expandedSection === 'platform' && (
                <div className="pb-3.5 space-y-2 text-xs pl-2">
                  <button onClick={() => navigateToSection('for-parents')} className="py-1 text-slate-300 hover:text-[#d4af37] block w-full text-left">
                    Guardian Safety
                  </button>
                  <button onClick={() => navigateToSection('for-schools')} className="py-1 text-slate-300 hover:text-[#d4af37] block w-full text-left">
                    School Safety
                  </button>
                  <button onClick={() => navigateToSection('emergency-response')} className="py-1 text-slate-300 hover:text-[#d4af37] block w-full text-left">
                    Response Coordination
                  </button>
                  <button onClick={() => navigateToSection('how-it-works')} className="py-1 text-slate-300 hover:text-[#d4af37] block w-full text-left">
                    How ITIS Works
                  </button>
                </div>
              )}
            </div>

            {/* Group: TRUST */}
            <div>
              <button
                type="button"
                onClick={() => toggleSection('trust')}
                className="w-full py-3.5 flex items-center justify-between text-xs font-bold text-white uppercase font-mono tracking-wider text-left cursor-pointer"
              >
                <span>TRUST</span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${expandedSection === 'trust' ? 'rotate-180 text-[#d4af37]' : ''}`} />
              </button>
              {expandedSection === 'trust' && (
                <div className="pb-3.5 space-y-2 text-xs pl-2">
                  <button onClick={() => navigateToSection('trust-safety')} className="py-1 text-slate-300 hover:text-[#d4af37] block w-full text-left">
                    Privacy
                  </button>
                  <button onClick={() => navigateToSection('trust-safety')} className="py-1 text-slate-300 hover:text-[#d4af37] block w-full text-left">
                    POPIA
                  </button>
                  <button onClick={() => navigateToSection('trust-safety')} className="py-1 text-slate-300 hover:text-[#d4af37] block w-full text-left">
                    Security
                  </button>
                  <button onClick={() => navigateToSection('trust-safety')} className="py-1 text-slate-300 hover:text-[#d4af37] block w-full text-left">
                    Responsible Disclosure
                  </button>
                </div>
              )}
            </div>

            {/* Group: COMPANY */}
            <div>
              <button
                type="button"
                onClick={() => toggleSection('company')}
                className="w-full py-3.5 flex items-center justify-between text-xs font-bold text-white uppercase font-mono tracking-wider text-left cursor-pointer"
              >
                <span>COMPANY</span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${expandedSection === 'company' ? 'rotate-180 text-[#d4af37]' : ''}`} />
              </button>
              {expandedSection === 'company' && (
                <div className="pb-3.5 space-y-2 text-xs pl-2">
                  <button onClick={() => navigateToSection('why-itis')} className="py-1 text-slate-300 hover:text-[#d4af37] block w-full text-left">
                    About ITIS
                  </button>
                  <button onClick={() => navigateToSection('for-schools')} className="py-1 text-slate-300 hover:text-[#d4af37] block w-full text-left">
                    Partnerships
                  </button>
                  <button onClick={() => navigateToSection('request-demo')} className="py-1 text-slate-300 hover:text-[#d4af37] block w-full text-left">
                    Contact
                  </button>
                  <button onClick={() => navigateToSection('overview')} className="py-1 text-slate-300 hover:text-[#d4af37] block w-full text-left">
                    Careers
                  </button>
                </div>
              )}
            </div>

            {/* Group: PORTAL */}
            <div>
              <button
                type="button"
                onClick={() => toggleSection('portal')}
                className="w-full py-3.5 flex items-center justify-between text-xs font-bold text-white uppercase font-mono tracking-wider text-left cursor-pointer"
              >
                <span>PORTAL</span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${expandedSection === 'portal' ? 'rotate-180 text-[#d4af37]' : ''}`} />
              </button>
              {expandedSection === 'portal' && (
                <div className="pb-3.5 space-y-3 text-xs pl-2">
                  <button
                    onClick={onOpenLogin}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#d4af37] hover:bg-[#c29f2f] text-slate-950 font-extrabold text-xs tracking-wider uppercase transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                    title="Authorised access for registered guardians, schools and response personnel"
                  >
                    <LogIn className="w-3.5 h-3.5 text-slate-950 shrink-0" />
                    <span>PORTAL ACCESS</span>
                  </button>
                  <p className="text-[10px] text-slate-400 leading-relaxed text-center">
                    Authorised access for registered guardians, schools and response personnel.
                  </p>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* BOTTOM FOOTER / LEGAL & COMPLIANCE BAR */}
        <div className="pt-8 mt-8 border-t border-slate-800/80 flex flex-col md:flex-row items-center justify-between gap-4 text-slate-400 text-[11px]">
          
          <div className="flex items-center gap-2 text-slate-300">
            <span>© {new Date().getFullYear()} ITIS Guardian Network</span>
            <span className="hidden sm:inline">•</span>
            <span className="hidden sm:inline text-slate-400">All rights reserved</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <button 
              onClick={() => navigateToSection('trust-safety')}
              className="hover:text-[#d4af37] transition-colors cursor-pointer"
            >
              Privacy Policy
            </button>
            <span>•</span>
            <button 
              onClick={() => navigateToSection('trust-safety')}
              className="hover:text-[#d4af37] transition-colors cursor-pointer"
            >
              Terms of Use
            </button>
            <span>•</span>
            <button 
              onClick={() => navigateToSection('trust-safety')}
              className="hover:text-[#d4af37] transition-colors cursor-pointer"
            >
              POPIA Governance
            </button>
            <span>•</span>
            <button 
              onClick={() => navigateToSection('trust-safety')}
              className="hover:text-[#d4af37] transition-colors cursor-pointer"
            >
              Responsible Disclosure
            </button>
          </div>

        </div>

      </div>

    </footer>
  );
};
