import React from 'react';
import { 
  ShieldCheck, 
  UserCheck, 
  Eye, 
  Lock, 
  FileCheck2, 
  Radio,
  Activity,
  Shield,
  Users,
  Building
} from 'lucide-react';

export const TrustSafetySection: React.FC = () => {
  const trustPrinciples = [
    {
      number: '01',
      title: 'CHILD-FIRST PROTECTION',
      summary: 'Learner safety remains at the centre of every workflow.',
      description: 'Every alert, record, and feature is designed specifically to protect learner well-being during every school journey.',
      icon: ShieldCheck,
      color: 'text-cyan-400',
      borderColor: 'border-cyan-500/30',
      bgGradient: 'from-cyan-950/20 to-[#0a1224]'
    },
    {
      number: '02',
      title: 'VERIFIED ACCESS',
      summary: 'Only authorised users can access protected information.',
      description: 'Guardians, educators, and vetted responders are authenticated before viewing any learner or location details.',
      icon: UserCheck,
      color: 'text-cyan-400',
      borderColor: 'border-cyan-500/30',
      bgGradient: 'from-cyan-950/20 to-[#0a1224]'
    },
    {
      number: '03',
      title: 'HUMAN OVERSIGHT',
      summary: 'Emergency decisions remain under authorised human control.',
      description: 'Technology provides fast situational awareness, while trained command officers assess and direct every response.',
      icon: Eye,
      color: 'text-[#d4af37]',
      borderColor: 'border-[#d4af37]/35',
      bgGradient: 'from-[#d4af37]/10 to-[#0a1224]'
    },
    {
      number: '04',
      title: 'RESPONSIBLE DATA PROTECTION',
      summary: 'Sensitive information is handled according to applicable privacy and security requirements.',
      description: 'Learner information is protected under strict privacy guidelines, used solely for safety, and never monetized.',
      icon: Lock,
      color: 'text-emerald-400',
      borderColor: 'border-emerald-500/30',
      bgGradient: 'from-emerald-950/20 to-[#0a1224]'
    },
    {
      number: '05',
      title: 'ACCOUNTABILITY',
      summary: 'Important operational actions are securely recorded for review.',
      description: 'Verifiable audit trails ensure transparent record-keeping for schools, families, and authorized review.',
      icon: FileCheck2,
      color: 'text-[#d4af37]',
      borderColor: 'border-[#d4af37]/35',
      bgGradient: 'from-[#d4af37]/10 to-[#0a1224]'
    }
  ];

  const coordinationPartners = [
    {
      label: 'Designed for coordination with',
      entity: 'Police (SAPS)',
      detail: 'Standardized incident briefs & location handoffs for law enforcement.',
      icon: Shield
    },
    {
      label: 'Designed for coordination with',
      entity: 'Emergency Medical Services (EMS)',
      detail: 'Rapid incident triage and medical responder notifications.',
      icon: Activity
    },
    {
      label: 'Designed for coordination with',
      entity: 'Vetted Security Response',
      detail: 'Local patrol vehicle dispatch and perimeter verification.',
      icon: Radio
    },
    {
      label: 'Designed for coordination with',
      entity: 'Community Safety Groups',
      detail: 'Authorised neighborhood watches & Community Policing Forums.',
      icon: Users
    },
    {
      label: 'Designed for coordination with',
      entity: 'Approved Municipal Services',
      detail: 'Local disaster management, traffic control, and rescue services.',
      icon: Building
    }
  ];

  return (
    <section id="trust-safety" className="max-w-7xl mx-auto space-y-12 scroll-mt-24">
      
      {/* SECTION HEADER */}
      <div className="text-center space-y-4 max-w-3xl mx-auto px-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-xs font-mono text-cyan-300">
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
          <span>RESPONSIBLE CHILD SAFETY TECHNOLOGY</span>
        </div>
        
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight uppercase font-mono">
            BUILT FOR TRUST.
          </h2>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-cyan-300 tracking-tight leading-tight uppercase font-mono">
            DESIGNED FOR CHILD SAFETY.
          </h2>
        </div>

        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl mx-auto">
          We believe child protection requires uncompromising ethics, clear human accountability, and responsible data practices at every level.
        </p>
      </div>

      {/* 5 CONCISE TRUST PRINCIPLES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 px-2 sm:px-4">
        {trustPrinciples.map((principle, index) => {
          const Icon = principle.icon;
          const isWide = index === 3 || index === 4;
          
          return (
            <div
              key={principle.number}
              className={`rounded-2xl bg-gradient-to-b ${principle.bgGradient} border ${principle.borderColor} p-6 space-y-4 flex flex-col justify-between shadow-lg transition-all duration-200 hover:border-slate-600 ${
                index === 4 ? 'md:col-span-2 lg:col-span-1' : ''
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className={`w-10 h-10 rounded-xl bg-slate-950/90 border border-slate-800 flex items-center justify-center ${principle.color} shadow-inner`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-400">
                    {principle.number}
                  </span>
                </div>

                <div className="space-y-1 pt-1">
                  <h3 className="text-sm font-extrabold text-white tracking-wide uppercase font-mono">
                    {principle.title}
                  </h3>
                  <p className="text-xs font-semibold text-slate-200 leading-snug">
                    {principle.summary}
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed pt-2 border-t border-slate-800/80">
                {principle.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* TEXT-BASED COORDINATION FRAMEWORK (No fake logos, honest & authoritative) */}
      <div className="rounded-3xl bg-slate-900/70 border border-slate-800/90 p-6 sm:p-8 space-y-6 mx-2 sm:mx-4">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 border-b border-slate-800 pb-5">
          <div className="space-y-1">
            <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-bold">
              MULTI-AGENCY COMPATIBILITY
            </span>
            <h3 className="text-lg sm:text-xl font-bold text-white">
              Structured for Multi-Agency Coordination
            </h3>
          </div>
          <p className="text-xs text-slate-400 max-w-lg leading-relaxed">
            ITIS is engineered to share verified situational data smoothly with authorized response entities during critical events.
          </p>
        </div>

        {/* Text-based coordination blocks */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {coordinationPartners.map((item, idx) => {
            const PartnerIcon = item.icon;
            return (
              <div 
                key={idx}
                className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/90 flex flex-col justify-between space-y-2.5"
              >
                <div className="flex items-center justify-between text-slate-400">
                  <PartnerIcon className="w-4 h-4 text-cyan-400" />
                  <span className="text-[9px] font-mono uppercase tracking-wider text-slate-400">
                    Interoperable
                  </span>
                </div>
                
                <div>
                  <div className="text-[10px] text-slate-400 font-medium">
                    {item.label}
                  </div>
                  <div className="text-xs font-bold text-white mt-0.5">
                    {item.entity}
                  </div>
                  <p className="text-[11px] text-slate-300 mt-1.5 leading-snug">
                    {item.detail}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Responsible Tech Note */}
        <div className="text-center pt-2">
          <p className="text-[11px] text-slate-400 max-w-2xl mx-auto leading-relaxed">
            * Operational response dispatch is coordinated directly with accredited, locally active service providers. Response capabilities depend on geographic availability and authorized agreements.
          </p>
        </div>

      </div>

    </section>
  );
};
