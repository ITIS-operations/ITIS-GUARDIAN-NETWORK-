import React, { useState } from 'react';
import { 
  X, 
  ChevronDown, 
  ChevronRight, 
  ShieldCheck, 
  Building2, 
  Shield, 
  Lock, 
  Users, 
  BookOpen, 
  Briefcase, 
  HeartHandshake, 
  Radio, 
  School as SchoolIcon, 
  FileCheck2, 
  HelpCircle, 
  Phone, 
  LogIn, 
  ExternalLink,
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
  const [selectedSubItem, setSelectedSubItem] = useState<string | null>(null);

  if (!isOpen) return null;

  const categories: DrawerCategory[] = [
    {
      id: 'about',
      title: 'ABOUT ITIS',
      icon: Building2,
      items: [
        {
          id: 'who-we-are',
          title: 'Who ITIS is',
          description: 'South Africa’s dedicated national child-safety network connecting guardians, schools, and accredited response partners into a coordinated protection ecosystem.',
          targetCategory: 'why-itis'
        },
        {
          id: 'why-exists',
          title: 'Why ITIS exists',
          description: 'To eliminate safety blind spots during daily school journeys and replace uncertainty with verified, immediate human coordination.',
          targetCategory: 'why-itis'
        },
        {
          id: 'mission',
          title: 'Our mission',
          description: 'Ensuring every learner experiences safe movement between home and school through responsible technology and certified human oversight.',
          targetCategory: 'overview'
        }
      ]
    },
    {
      id: 'safety',
      title: 'SAFETY',
      icon: ShieldCheck,
      items: [
        {
          id: 'learner-safety',
          title: 'Learner Safety',
          description: 'Non-intrusive safety checkpoints and silent distress capabilities built specifically for children navigating daily school journeys.',
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
          description: 'High-throughput campus gate verification, automated attendance reconciliation, and dispute-free student pickup confirmation.',
          targetCategory: 'for-schools'
        },
        {
          id: 'emergency-response',
          title: 'Emergency Response',
          description: 'Certified national operations command coordinating directly with SAPS, private armed responders, and medical emergency services (EMS).',
          targetCategory: 'emergency-response'
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
          description: 'Cryptographic SHA-256 audit trails documenting every verification and dispatch event for complete institutional transparency.',
          targetCategory: 'trust-safety'
        }
      ]
    },
    {
      id: 'for-partners',
      title: 'FOR PARTNERS',
      icon: Users,
      items: [
        {
          id: 'schools-partner',
          title: 'Schools',
          description: 'Fast campus gate verification, digital custody rosters, and automated attendance reporting that reduces administrative overhead.',
          targetCategory: 'for-schools'
        },
        {
          id: 'emergency-partner',
          title: 'Emergency Services',
          description: 'Direct situational coordinates and verified incident data delivered straight to accredited emergency responders.',
          targetCategory: 'emergency-response'
        },
        {
          id: 'government-partner',
          title: 'Government',
          description: 'Provincial and national education department alignment with transparent compliance reporting and safety audits.',
          targetCategory: 'trust-safety'
        },
        {
          id: 'community-partner',
          title: 'Community Safety Partners',
          description: 'Structured collaboration with vetted community policing forums (CPFs) and accredited neighborhood watch groups.',
          targetCategory: 'why-itis'
        }
      ]
    },
    {
      id: 'resources',
      title: 'RESOURCES',
      icon: BookOpen,
      items: [
        {
          id: 'news-updates',
          title: 'News & Updates',
          description: 'National safety bulletins, institutional pilot milestones, and verified educational updates.',
          targetCategory: 'overview'
        },
        {
          id: 'faqs',
          title: 'FAQs',
          description: 'Frequently asked questions regarding guardian registration, school onboarding, hardware requirements, and data privacy.',
          targetCategory: 'how-it-works'
        },
        {
          id: 'request-demo-item',
          title: 'Request a Demonstration',
          description: 'Schedule a tailored campus demonstration and technical consultation with our institutional safety team.',
          targetCategory: 'request-demo'
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
          id: 'careers',
          title: 'Careers',
          description: 'Explore opportunities across safety engineering, 24/7 command operations, and school partnership coordination.',
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
    setSelectedSubItem(null);
  };

  const handleItemClick = (item: DrawerSubItem) => {
    setSelectedSubItem(prev => prev === item.id ? null : item.id);
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
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
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
            
            {/* Quick Public Explorer Link */}
            <button
              onClick={() => handleOpenDetailedSection('overview')}
              className="w-full min-h-[46px] p-3 rounded-xl bg-[#0a1224] hover:bg-[#0f1a30] border border-[#d4af37]/40 text-[#f3d368] text-xs font-bold flex items-center justify-between gap-2 transition-all cursor-pointer group mb-2"
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[#d4af37]" />
                <span>Open Guardian Network Explorer</span>
              </div>
              <ArrowRight className="w-4 h-4 text-[#d4af37] group-hover:translate-x-1 transition-transform" />
            </button>

            {/* Category Accordion */}
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isExpanded = expandedCategory === cat.title;

              return (
                <div 
                  key={cat.id}
                  className="rounded-xl bg-[#0a1224]/80 border border-slate-800/90 overflow-hidden transition-colors"
                >
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(cat.title)}
                    className="w-full min-h-[48px] px-4 py-3 text-left flex items-center justify-between gap-3 text-xs font-bold text-slate-200 hover:text-[#d4af37] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-md bg-[#060b18] border border-slate-700/80 flex items-center justify-center text-[#d4af37]">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="tracking-wide uppercase font-mono text-[11px] sm:text-xs text-white">
                        {cat.title}
                      </span>
                    </div>

                    <ChevronDown 
                      className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                        isExpanded ? 'rotate-180 text-[#d4af37]' : ''
                      }`} 
                    />
                  </button>

                  {/* Category Items */}
                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-1.5 border-t border-slate-800/80 pt-2 bg-[#060b18]/60">
                      {cat.items.map((item) => {
                        const isSubSelected = selectedSubItem === item.id;
                        return (
                          <div 
                            key={item.id}
                            className="rounded-lg bg-[#0a1224] border border-slate-800/60 p-2.5 space-y-1.5 transition-all"
                          >
                            <button
                              onClick={() => handleItemClick(item)}
                              className="w-full text-left flex items-center justify-between text-xs font-semibold text-slate-200 hover:text-[#f3d368] transition-colors cursor-pointer"
                            >
                              <span className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37]/80" />
                                <span>{item.title}</span>
                              </span>
                              <ChevronRight className={`w-3.5 h-3.5 text-slate-500 transition-transform ${isSubSelected ? 'rotate-90 text-[#d4af37]' : ''}`} />
                            </button>

                            {/* Expandable sub-item description */}
                            {isSubSelected && (
                              <div className="pl-3 pr-1 pt-1 space-y-2 text-[11px] text-slate-300 leading-relaxed border-t border-slate-800/60 mt-1.5">
                                <p>{item.description}</p>
                                {item.targetCategory && (
                                  <button
                                    onClick={() => handleOpenDetailedSection(item.targetCategory)}
                                    className="text-[10px] font-bold font-mono text-[#d4af37] hover:text-[#f3d368] flex items-center gap-1 cursor-pointer pt-0.5"
                                  >
                                    <span>Read full section in explorer</span>
                                    <ArrowRight className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

          </div>

          {/* Drawer Bottom Bar: Single Login CTA & Contact */}
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
