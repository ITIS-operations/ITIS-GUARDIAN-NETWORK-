import React, { useState } from 'react';
import { 
  X, 
  ChevronDown, 
  ShieldCheck, 
  Building2, 
  Lock, 
  Users, 
  Briefcase, 
  Radio, 
  School as SchoolIcon, 
  HeartHandshake,
  LogIn, 
  ArrowRight
} from 'lucide-react';
import { ActiveUserSession } from '../types.js';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOpenLogin: () => void;
  onSelectCategory?: (categoryId: string) => void;
  currentUser: ActiveUserSession | null;
}

interface DrawerSubItem {
  id: string;
  title: string;
  description: string;
  targetCategory?: string;
}

interface DrawerCategory {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: DrawerSubItem[];
}

export const PublicNavigationDrawer: React.FC<Props> = ({
  isOpen,
  onClose,
  onOpenLogin,
  onSelectCategory,
  currentUser
}) => {
  const [expandedCategory, setExpandedCategory] = useState<string | null>('ABOUT ITIS');

  if (!isOpen) return null;

  const categories: DrawerCategory[] = [
    {
      id: 'about-itis',
      title: 'ABOUT ITIS',
      icon: Building2,
      items: [
        {
          id: 'who-we-are',
          title: 'Who We Are',
          description: 'South Africa’s dedicated national child-safety network connecting guardians, schools, and accredited response partners into a coordinated protection ecosystem.',
          targetCategory: 'why-itis'
        },
        {
          id: 'why-exists',
          title: 'Why ITIS Exists',
          description: 'To eliminate safety blind spots during daily school journeys and replace uncertainty with verified, immediate human coordination.',
          targetCategory: 'why-itis'
        },
        {
          id: 'our-mission',
          title: 'Our Mission',
          description: 'Ensuring every learner experiences safe movement between home and school through responsible technology and certified human oversight.',
          targetCategory: 'overview'
        }
      ]
    },
    {
      id: 'safety-network',
      title: 'SAFETY NETWORK',
      icon: ShieldCheck,
      items: [
        {
          id: 'learner-safety',
          title: 'Learner Safety',
          description: 'Authorised devices, school access points and safety zones help provide a clearer picture of a learner\'s expected journey.',
          targetCategory: 'how-it-works'
        },
        {
          id: 'guardian-protection',
          title: 'Guardian Protection',
          description: 'Real-time arrival and departure notifications, digital custody delegation, and 24/7 emergency reassurance without invasive tracking.',
          targetCategory: 'for-parents'
        },
        {
          id: 'school-safety',
          title: 'School Safety',
          description: 'Schools can use verified gate and attendance events to improve visibility of learner presence and safety.',
          targetCategory: 'for-schools'
        },
        {
          id: 'geofenced-safety',
          title: 'Geofenced Safety',
          description: 'Approved locations can define trusted safety areas and help identify meaningful arrival, departure and movement events.',
          targetCategory: 'how-it-works'
        },
        {
          id: 'emergency-response',
          title: 'Emergency Response',
          description: 'When a genuine emergency is identified, authorised Command personnel coordinate the appropriate response.',
          targetCategory: 'emergency-response'
        }
      ]
    },
    {
      id: 'schools-partners',
      title: 'SCHOOLS & PARTNERS',
      icon: Users,
      items: [
        {
          id: 'for-schools',
          title: 'For Schools',
          description: 'Where deployed, gate scanners and geofenced zones streamline morning entry, afternoon departure, and verified attendance records.',
          targetCategory: 'for-schools'
        },
        {
          id: 'for-guardians',
          title: 'For Guardians',
          description: 'Verified legal guardians receive milestone updates as learners move between home, transit points, and school grounds.',
          targetCategory: 'for-parents'
        },
        {
          id: 'for-emergency-partners',
          title: 'For Emergency Partners',
          description: 'Accredited responders receive verified situational coordinates and emergency contact details for swift coordination.',
          targetCategory: 'emergency-response'
        },
        {
          id: 'for-government',
          title: 'For Government',
          description: 'Provincial education and safety alignment with sovereign data hosting and verifiable POPIA compliance.',
          targetCategory: 'trust-safety'
        }
      ]
    },
    {
      id: 'trust-governance',
      title: 'TRUST & GOVERNANCE',
      icon: Lock,
      items: [
        {
          id: 'privacy-popia',
          title: 'Privacy & POPIA',
          description: 'Strict adherence to POPIA §18 standards for minor data protection, end-to-end encryption, and sovereign South African data custody.',
          targetCategory: 'trust-safety'
        },
        {
          id: 'human-oversight',
          title: 'Human Oversight',
          description: 'A strict 0% autonomous dispatch policy ensuring every safety alert is verified by certified command specialists before field deployment.',
          targetCategory: 'trust-safety'
        },
        {
          id: 'responsible-tech',
          title: 'Responsible Technology',
          description: 'Purpose-built child protection infrastructure that activates only during designated school travel corridors and active emergencies.',
          targetCategory: 'trust-safety'
        },
        {
          id: 'accountability',
          title: 'Accountability',
          description: 'Cryptographic audit trails documenting every verification and dispatch event for complete institutional transparency.',
          targetCategory: 'trust-safety'
        }
      ]
    },
    {
      id: 'company',
      title: 'COMPANY',
      icon: Briefcase,
      items: [
        {
          id: 'about-company',
          title: 'About ITIS',
          description: 'Integrated Technology Intelligence & Safety is a South African child-protection technology initiative dedicated to national learner safety.',
          targetCategory: 'why-itis'
        },
        {
          id: 'news',
          title: 'News',
          description: 'National safety bulletins, institutional pilot milestones, and verified educational updates.',
          targetCategory: 'overview'
        },
        {
          id: 'careers',
          title: 'Careers',
          description: 'Opportunities across safety engineering, 24/7 command operations, and school partnership coordination.',
          targetCategory: 'overview'
        },
        {
          id: 'contact',
          title: 'Contact',
          description: 'Direct communication channels for headmasters, school governing bodies, emergency agencies, and institutional partners.',
          targetCategory: 'request-demo'
        }
      ]
    }
  ];

  const toggleCategory = (title: string) => {
    setExpandedCategory(prev => prev === title ? null : title);
  };

  const handleOpenDetailedSection = (targetCategory?: string) => {
    if (targetCategory && onSelectCategory) {
      onSelectCategory(targetCategory);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none">
      {/* Backdrop with smooth blur */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-[#040812]/80 backdrop-blur-sm transition-opacity duration-300"
        aria-hidden="true"
      />

      {/* Slide-over Drawer Panel */}
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div className="w-screen max-w-md bg-[#060b18] border-l border-slate-800 shadow-2xl flex flex-col">
          
          {/* Top Header Bar */}
          <div className="p-4 sm:p-5 bg-[#0a1224] border-b border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <img 
                src="/branding/itis-logo.png" 
                alt="ITIS Logo" 
                className="w-8 h-8 rounded-lg border border-[#d4af37]/40 object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div>
                <span className="font-extrabold text-white text-sm tracking-tight block">
                  ITIS GUARDIAN NETWORK
                </span>
                <span className="text-[10px] font-mono text-[#d4af37] tracking-wider uppercase">
                  PUBLIC INFORMATION &amp; NAVIGATION
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="min-h-[40px] min-w-[40px] p-2 rounded-xl bg-slate-900/90 border border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center justify-center cursor-pointer active:scale-95"
              aria-label="Close Information Drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body — Organized Public Categories */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
            
            {/* Category Accordion */}
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isExpanded = expandedCategory === cat.title;

              return (
                <div 
                  key={cat.id}
                  className="rounded-xl bg-[#0a1224]/90 border border-slate-800/90 overflow-hidden transition-all duration-200"
                >
                  {/* Category Header Button */}
                  <button
                    onClick={() => toggleCategory(cat.title)}
                    className="w-full min-h-[48px] px-4 py-3.5 text-left flex items-center justify-between gap-3 text-xs font-bold text-slate-200 hover:text-[#d4af37] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-md bg-[#060b18] border border-slate-700/80 flex items-center justify-center text-[#d4af37]">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="tracking-wider uppercase font-mono text-[11px] sm:text-xs text-white">
                        {cat.title}
                      </span>
                    </div>

                    <ChevronDown 
                      className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                        isExpanded ? 'rotate-180 text-[#d4af37]' : ''
                      }`} 
                    />
                  </button>

                  {/* Category Content: Instantly revealed with clean spacing & readable typography */}
                  {isExpanded && (
                    <div className="px-3 pb-3.5 space-y-2 border-t border-slate-800/80 pt-2.5 bg-[#060b18]/70">
                      {cat.items.map((item) => (
                        <div 
                          key={item.id}
                          className="rounded-lg bg-[#0a1224] border border-slate-800/70 p-3 space-y-1.5 transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37]" />
                              <span>{item.title}</span>
                            </span>
                            {item.targetCategory && (
                              <button
                                onClick={() => handleOpenDetailedSection(item.targetCategory)}
                                className="text-[10px] font-mono text-[#d4af37] hover:text-[#f3d368] inline-flex items-center gap-0.5 cursor-pointer"
                                title="View in Explorer"
                              >
                                <span>Explore</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-300 leading-relaxed pl-3">
                            {item.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

          </div>

          {/* Drawer Bottom Bar: Single Login CTA & National Support */}
          <div className="p-4 sm:p-5 bg-[#0a1224] border-t border-slate-800 space-y-3 shrink-0">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>National Operations Support</span>
              <span className="text-[#d4af37] font-mono font-bold">+27 (0) 12 004 8890</span>
            </div>

            <button
              onClick={() => {
                onClose();
                onOpenLogin();
              }}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#d4af37] hover:bg-[#c29f2f] text-slate-950 font-extrabold text-xs tracking-wider uppercase transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <LogIn className="w-4 h-4 text-slate-950" />
              <span>LOGIN TO AUTHORISED PORTAL</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
