import React, { useState } from 'react';
import { 
  ShieldCheck, 
  ChevronDown, 
  Mail, 
  MapPin, 
  Phone, 
  Lock,
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
    <footer className="w-full bg-[#040812] border-t border-slate-800/80 text-slate-400 text-xs selection:bg-cyan-500 selection:text-white">
      
      {/* MAIN FOOTER CONTAINER */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        
        {/* DESKTOP 6-COLUMN GRID (Hidden on mobile) */}
        <div className="hidden lg:grid grid-cols-12 gap-8">
          
          {/* COLUMN 1: ITIS BRAND IDENTITY (3.5 Columns) */}
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
              A coordinated child-safety network connecting schools, guardians and authorised response partners through intelligent technology and human-led coordination.
            </p>

            <div className="pt-2 flex items-center gap-2 text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-[#d4af37] shrink-0" />
              <span>Republic of South Africa • National Child Safety</span>
            </div>
          </div>

          {/* COLUMN 2: SOLUTIONS (1.6 Columns) */}
          <div className="col-span-2 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              SOLUTIONS
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button 
                  onClick={() => navigateToSection('four-answers')}
                  className="hover:text-cyan-300 transition-colors text-left cursor-pointer"
                >
                  Learner Safety
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigateToSection('for-parents')}
                  className="hover:text-cyan-300 transition-colors text-left cursor-pointer"
                >
                  Guardian Hub
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigateToSection('for-schools')}
                  className="hover:text-cyan-300 transition-colors text-left cursor-pointer"
                >
                  Campus Gate Defence
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigateToSection('emergency-response')}
                  className="hover:text-cyan-300 transition-colors text-left cursor-pointer"
                >
                  Emergency Response
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigateToSection('solutions')}
                  className="hover:text-cyan-300 transition-colors text-left cursor-pointer"
                >
                  Smart Wearables
                </button>
              </li>
            </ul>
          </div>

          {/* COLUMN 3: FOR PARENTS (1.6 Columns) */}
          <div className="col-span-2 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              FOR PARENTS
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button 
                  onClick={() => navigateToSection('for-parents')}
                  className="hover:text-cyan-300 transition-colors text-left cursor-pointer"
                >
                  Parent & Guardian Hub
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigateToSection('for-parents')}
                  className="hover:text-cyan-300 transition-colors text-left cursor-pointer"
                >
                  Custody Management
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigateToSection('safety-journey')}
                  className="hover:text-cyan-300 transition-colors text-left cursor-pointer"
                >
                  Live Journey Notifications
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigateToSection('emergency-response')}
                  className="hover:text-cyan-300 transition-colors text-left cursor-pointer"
                >
                  24/7 SOS Assistance
                </button>
              </li>
            </ul>
          </div>

          {/* COLUMN 4: FOR SCHOOLS (1.6 Columns) */}
          <div className="col-span-2 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              FOR SCHOOLS
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button 
                  onClick={() => navigateToSection('for-schools')}
                  className="hover:text-cyan-300 transition-colors text-left cursor-pointer"
                >
                  School Safety Portal
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigateToSection('for-schools')}
                  className="hover:text-cyan-300 transition-colors text-left cursor-pointer"
                >
                  Attendance Reconciliation
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigateToSection('request-demo')}
                  className="hover:text-cyan-300 transition-colors text-left cursor-pointer"
                >
                  Request School Pilot
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigateToSection('trust-safety')}
                  className="hover:text-cyan-300 transition-colors text-left cursor-pointer"
                >
                  Campus Perimeter Audits
                </button>
              </li>
            </ul>
          </div>

          {/* COLUMN 5: RESOURCES (1.6 Columns) */}
          <div className="col-span-1 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              RESOURCES
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button 
                  onClick={() => navigateToSection('safety-journey')}
                  className="hover:text-cyan-300 transition-colors text-left cursor-pointer"
                >
                  How It Works
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigateToSection('resources')}
                  className="hover:text-cyan-300 transition-colors text-left cursor-pointer"
                >
                  FAQs
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigateToSection('security')}
                  className="hover:text-cyan-300 transition-colors text-left cursor-pointer"
                >
                  POPIA & Privacy
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigateToSection('security')}
                  className="hover:text-cyan-300 transition-colors text-left cursor-pointer"
                >
                  Terms of Use
                </button>
              </li>
            </ul>
          </div>

          {/* COLUMN 6: COMPANY (1.6 Columns) */}
          <div className="col-span-1 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              COMPANY
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button 
                  onClick={() => navigateToSection('why-itis')}
                  className="hover:text-cyan-300 transition-colors text-left cursor-pointer"
                >
                  About ITIS
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigateToSection('news')}
                  className="hover:text-cyan-300 transition-colors text-left cursor-pointer"
                >
                  News
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigateToSection('careers')}
                  className="hover:text-cyan-300 transition-colors text-left cursor-pointer"
                >
                  Careers
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigateToSection('request-demo')}
                  className="hover:text-cyan-300 transition-colors text-left cursor-pointer"
                >
                  Contact
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigateToSection('security')}
                  className="hover:text-cyan-300 transition-colors text-left cursor-pointer"
                >
                  Disclosure
                </button>
              </li>
            </ul>
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
              A coordinated child-safety network connecting schools, guardians and authorised response partners through intelligent technology and human-led coordination.
            </p>
          </div>

          {/* Collapsible Sections Accordion */}
          <div className="border-t border-b border-slate-800 divide-y divide-slate-800/80">
            
            {/* Section: SOLUTIONS */}
            <div>
              <button
                type="button"
                onClick={() => toggleSection('solutions')}
                className="w-full py-3.5 flex items-center justify-between text-xs font-bold text-white uppercase font-mono tracking-wider text-left cursor-pointer"
              >
                <span>SOLUTIONS</span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${expandedSection === 'solutions' ? 'rotate-180 text-cyan-400' : ''}`} />
              </button>
              {expandedSection === 'solutions' && (
                <div className="pb-3.5 space-y-2 text-xs pl-2">
                  <button onClick={() => navigateToSection('four-answers')} className="py-1 text-slate-300 hover:text-cyan-300 block w-full text-left">
                    Learner Safety
                  </button>
                  <button onClick={() => navigateToSection('for-parents')} className="py-1 text-slate-300 hover:text-cyan-300 block w-full text-left">
                    Guardian Hub
                  </button>
                  <button onClick={() => navigateToSection('for-schools')} className="py-1 text-slate-300 hover:text-cyan-300 block w-full text-left">
                    Campus Gate Defence
                  </button>
                  <button onClick={() => navigateToSection('emergency-response')} className="py-1 text-slate-300 hover:text-cyan-300 block w-full text-left">
                    Emergency Response
                  </button>
                  <button onClick={() => navigateToSection('solutions')} className="py-1 text-slate-300 hover:text-cyan-300 block w-full text-left">
                    Smart Wearables
                  </button>
                </div>
              )}
            </div>

            {/* Section: FOR PARENTS */}
            <div>
              <button
                type="button"
                onClick={() => toggleSection('parents')}
                className="w-full py-3.5 flex items-center justify-between text-xs font-bold text-white uppercase font-mono tracking-wider text-left cursor-pointer"
              >
                <span>FOR PARENTS</span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${expandedSection === 'parents' ? 'rotate-180 text-cyan-400' : ''}`} />
              </button>
              {expandedSection === 'parents' && (
                <div className="pb-3.5 space-y-2 text-xs pl-2">
                  <button onClick={() => navigateToSection('for-parents')} className="py-1 text-slate-300 hover:text-cyan-300 block w-full text-left">
                    Parent & Guardian Hub
                  </button>
                  <button onClick={() => navigateToSection('for-parents')} className="py-1 text-slate-300 hover:text-cyan-300 block w-full text-left">
                    Custody Management
                  </button>
                  <button onClick={() => navigateToSection('safety-journey')} className="py-1 text-slate-300 hover:text-cyan-300 block w-full text-left">
                    Live Journey Notifications
                  </button>
                  <button onClick={() => navigateToSection('emergency-response')} className="py-1 text-slate-300 hover:text-cyan-300 block w-full text-left">
                    24/7 SOS Assistance
                  </button>
                </div>
              )}
            </div>

            {/* Section: FOR SCHOOLS */}
            <div>
              <button
                type="button"
                onClick={() => toggleSection('schools')}
                className="w-full py-3.5 flex items-center justify-between text-xs font-bold text-white uppercase font-mono tracking-wider text-left cursor-pointer"
              >
                <span>FOR SCHOOLS</span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${expandedSection === 'schools' ? 'rotate-180 text-cyan-400' : ''}`} />
              </button>
              {expandedSection === 'schools' && (
                <div className="pb-3.5 space-y-2 text-xs pl-2">
                  <button onClick={() => navigateToSection('for-schools')} className="py-1 text-slate-300 hover:text-cyan-300 block w-full text-left">
                    School Safety Portal
                  </button>
                  <button onClick={() => navigateToSection('for-schools')} className="py-1 text-slate-300 hover:text-cyan-300 block w-full text-left">
                    Attendance Reconciliation
                  </button>
                  <button onClick={() => navigateToSection('request-demo')} className="py-1 text-slate-300 hover:text-cyan-300 block w-full text-left">
                    Request School Pilot
                  </button>
                  <button onClick={() => navigateToSection('trust-safety')} className="py-1 text-slate-300 hover:text-cyan-300 block w-full text-left">
                    Campus Perimeter Audits
                  </button>
                </div>
              )}
            </div>

            {/* Section: RESOURCES */}
            <div>
              <button
                type="button"
                onClick={() => toggleSection('resources')}
                className="w-full py-3.5 flex items-center justify-between text-xs font-bold text-white uppercase font-mono tracking-wider text-left cursor-pointer"
              >
                <span>RESOURCES</span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${expandedSection === 'resources' ? 'rotate-180 text-cyan-400' : ''}`} />
              </button>
              {expandedSection === 'resources' && (
                <div className="pb-3.5 space-y-2 text-xs pl-2">
                  <button onClick={() => navigateToSection('safety-journey')} className="py-1 text-slate-300 hover:text-cyan-300 block w-full text-left">
                    How It Works
                  </button>
                  <button onClick={() => navigateToSection('resources')} className="py-1 text-slate-300 hover:text-cyan-300 block w-full text-left">
                    FAQs
                  </button>
                  <button onClick={() => navigateToSection('security')} className="py-1 text-slate-300 hover:text-cyan-300 block w-full text-left">
                    POPIA & Privacy
                  </button>
                  <button onClick={() => navigateToSection('security')} className="py-1 text-slate-300 hover:text-cyan-300 block w-full text-left">
                    Terms of Use
                  </button>
                </div>
              )}
            </div>

            {/* Section: COMPANY */}
            <div>
              <button
                type="button"
                onClick={() => toggleSection('company')}
                className="w-full py-3.5 flex items-center justify-between text-xs font-bold text-white uppercase font-mono tracking-wider text-left cursor-pointer"
              >
                <span>COMPANY</span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${expandedSection === 'company' ? 'rotate-180 text-cyan-400' : ''}`} />
              </button>
              {expandedSection === 'company' && (
                <div className="pb-3.5 space-y-2 text-xs pl-2">
                  <button onClick={() => navigateToSection('why-itis')} className="py-1 text-slate-300 hover:text-cyan-300 block w-full text-left">
                    About ITIS
                  </button>
                  <button onClick={() => navigateToSection('news')} className="py-1 text-slate-300 hover:text-cyan-300 block w-full text-left">
                    News
                  </button>
                  <button onClick={() => navigateToSection('careers')} className="py-1 text-slate-300 hover:text-cyan-300 block w-full text-left">
                    Careers
                  </button>
                  <button onClick={() => navigateToSection('request-demo')} className="py-1 text-slate-300 hover:text-cyan-300 block w-full text-left">
                    Contact
                  </button>
                  <button onClick={() => navigateToSection('security')} className="py-1 text-slate-300 hover:text-cyan-300 block w-full text-left">
                    Responsible Disclosure
                  </button>
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
              onClick={() => navigateToSection('security')}
              className="hover:text-cyan-300 transition-colors cursor-pointer"
            >
              Privacy Policy
            </button>
            <span>•</span>
            <button 
              onClick={() => navigateToSection('security')}
              className="hover:text-cyan-300 transition-colors cursor-pointer"
            >
              Terms of Use
            </button>
            <span>•</span>
            <button 
              onClick={() => navigateToSection('resources')}
              className="hover:text-cyan-300 transition-colors cursor-pointer"
            >
              POPIA Governance
            </button>
            <span>•</span>
            <button 
              onClick={() => navigateToSection('security')}
              className="hover:text-cyan-300 transition-colors cursor-pointer"
            >
              Responsible Disclosure
            </button>
          </div>

        </div>

      </div>

    </footer>
  );
};
