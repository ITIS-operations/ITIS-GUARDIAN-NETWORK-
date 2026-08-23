import React, { useState } from 'react';
import { 
  User, 
  School, 
  HeartHandshake, 
  Radio, 
  ShieldAlert, 
  CheckCircle2, 
  ArrowRight, 
  ArrowDown, 
  ShieldCheck, 
  Lock, 
  Building2, 
  Siren, 
  Activity, 
  Users2,
  PhoneCall,
  UserCheck
} from 'lucide-react';

export const SafetyJourneySection: React.FC = () => {
  const [activeStep, setActiveStep] = useState<number | null>(null);

  const steps = [
    {
      id: 'step-learner',
      stepNumber: '01',
      title: 'LEARNER',
      subtitle: 'In Need of Assistance',
      icon: User,
      iconColor: 'text-cyan-400',
      bgGlow: 'bg-cyan-500/10 border-cyan-500/30',
      description: 'A learner activates a silent distress signal, encounters a route deviation, or faces a medical/transit emergency during their school journey.',
      details: 'Instant geo-location timestamp, battery telemetry, and verified identity signal sent without noisy panic sirens that could escalate danger.'
    },
    {
      id: 'step-school',
      stepNumber: '02',
      title: 'SCHOOL',
      subtitle: 'Instant Campus Awareness',
      icon: School,
      iconColor: 'text-blue-400',
      bgGlow: 'bg-blue-500/10 border-blue-500/30',
      description: 'The school administration and safety officer receive an immediate status notice confirming whether the incident is on campus or in transit.',
      details: 'EMIS class attendance records and campus security gate logs automatically correlate to verify last known authorized custody status.'
    },
    {
      id: 'step-guardian',
      stepNumber: '03',
      title: 'GUARDIAN',
      subtitle: 'Real-Time Notification',
      icon: HeartHandshake,
      iconColor: 'text-cyan-400',
      bgGlow: 'bg-cyan-500/10 border-cyan-500/30',
      description: 'Verified legal parents and guardians receive instant encrypted mobile alerts with live tracking coordinates and direct status updates.',
      details: 'No frantic confusion or delayed phone trees. Guardians see the exact situation and know command officers are actively managing the event.'
    },
    {
      id: 'step-command',
      stepNumber: '04',
      title: 'ITIS COMMAND CENTRE',
      subtitle: 'Trained Human Officer Review',
      icon: Radio,
      iconColor: 'text-[#d4af37]',
      bgGlow: 'bg-[#d4af37]/10 border-[#d4af37]/40 ring-1 ring-[#d4af37]/40',
      description: 'A certified 24/7 National Operations Officer assesses the live telemetry, verifies the incident, and makes the critical operational dispatch decision.',
      details: 'Crucial human-in-the-loop guarantee: Automated algorithms alert officers in seconds, but only trained human professionals authorise and direct live emergency dispatch.'
    },
    {
      id: 'step-responder',
      stepNumber: '05',
      title: 'NEAREST AVAILABLE RESPONSE PARTNER',
      subtitle: 'Multi-Agency Coordination',
      icon: Siren,
      iconColor: 'text-rose-400',
      bgGlow: 'bg-rose-500/10 border-rose-500/30',
      description: 'The Command Centre coordinates and routes the closest vetted responder directly to the live verified coordinates with learner profile dossiers.',
      details: 'Includes SAPS (Police), EMS Medical Paramedics, Armed Response, and Community Safety Partners based on the exact emergency classification.'
    },
    {
      id: 'step-safe',
      stepNumber: '06',
      title: 'SAFE OUTCOME',
      subtitle: 'Resolved & Secure',
      icon: CheckCircle2,
      iconColor: 'text-emerald-400',
      bgGlow: 'bg-emerald-500/10 border-emerald-500/30 ring-1 ring-emerald-500/40',
      description: 'The child is secured, medical care is provided if needed, physical custody is handed back to verified guardians, and an audit report is generated.',
      details: 'Complete end-to-end statutory audit log created for the school, SAPS, and family under strict POPIA privacy protection protocols.'
    }
  ];

  const authorizedPartners = [
    {
      title: 'Police (SAPS)',
      description: 'Sector policing units and rapid-response vehicles.',
      icon: ShieldCheck,
      badge: 'Law Enforcement',
      color: 'text-blue-400 bg-blue-950/60 border-blue-500/30'
    },
    {
      title: 'EMS (Paramedics)',
      description: 'State and private ambulance & medical trauma dispatch.',
      icon: Activity,
      badge: 'Medical',
      color: 'text-rose-400 bg-rose-950/60 border-rose-500/30'
    },
    {
      title: 'Security Response',
      description: 'Vetted private armed response & patrol fleets.',
      icon: Lock,
      badge: 'Area Security',
      color: 'text-amber-400 bg-amber-950/60 border-amber-500/30'
    },
    {
      title: 'Community Safety',
      description: 'Community Policing Forums (CPFs) & neighborhood watches.',
      icon: Users2,
      badge: 'Local Eyes',
      color: 'text-emerald-400 bg-emerald-950/60 border-emerald-500/30'
    },
    {
      title: 'Approved Emergency Services',
      description: 'Fire & rescue, municipal disaster management teams.',
      icon: Building2,
      badge: 'Specialized',
      color: 'text-cyan-400 bg-cyan-950/60 border-cyan-500/30'
    }
  ];

  return (
    <section id="safety-journey" className="max-w-7xl mx-auto space-y-10 scroll-mt-24">
      
      {/* SECTION HEADER */}
      <div className="text-center space-y-3 max-w-3xl mx-auto px-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-xs font-mono text-cyan-300">
          <Radio className="w-3.5 h-3.5 text-cyan-400" />
          <span>COORDINATED SAFETY LIFECYCLE</span>
        </div>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight">
          The ITIS Child Safety Journey
        </h2>
        <p className="text-base sm:text-lg text-slate-300 font-medium">
          "ITIS brings the right people together when a learner needs help."
        </p>
        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-2xl mx-auto">
          From the instant a distress signal is raised to safe resolution, ITIS bridges every stakeholder in real time with seamless technology and trained human command.
        </p>
      </div>

      {/* 6-STEP LINEAR PROGRESSION WITH SUBTLE HOVER & EXPANSION */}
      <div className="relative px-2 sm:px-4">
        
        {/* DESKTOP CONNECTING TRACK LINE (Hidden on Mobile) */}
        <div className="hidden xl:block absolute top-[52px] left-12 right-12 h-0.5 bg-gradient-to-r from-cyan-500/30 via-purple-500/40 to-emerald-500/30 z-0 pointer-events-none" />

        {/* STEP CARDS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4 relative z-10">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isHovered = activeStep === idx;
            
            return (
              <div 
                key={step.id}
                onMouseEnter={() => setActiveStep(idx)}
                onMouseLeave={() => setActiveStep(null)}
                className={`relative rounded-2xl bg-slate-900/90 border transition-all duration-300 p-5 flex flex-col justify-between cursor-default group ${
                  isHovered ? `${step.bgGlow} shadow-lg -translate-y-1` : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Step Top Badge */}
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                  <span className="text-[11px] font-mono font-bold text-slate-400 group-hover:text-white transition-colors">
                    STEP {step.stepNumber}
                  </span>
                  
                  {/* Arrow Indicator on Desktop */}
                  {idx < steps.length - 1 && (
                    <div className="hidden xl:block text-slate-600 group-hover:text-cyan-400 transition-colors">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  )}

                  {/* Mobile Down Arrow for intermediate cards */}
                  {idx < steps.length - 1 && (
                    <div className="xl:hidden text-slate-600">
                      <ArrowDown className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>

                {/* Step Main Body */}
                <div className="space-y-3 py-3">
                  <div className={`w-11 h-11 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-center ${step.iconColor} group-hover:scale-105 transition-transform shadow-inner`}>
                    <Icon className="w-5 h-5" />
                  </div>

                  <div>
                    <h3 className="text-sm font-extrabold text-white tracking-tight">
                      {step.title}
                    </h3>
                    <p className="text-[11px] font-medium text-slate-400 group-hover:text-slate-300 transition-colors">
                      {step.subtitle}
                    </p>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {/* Micro Detail Snippet */}
                <div className="pt-2.5 border-t border-slate-800/70 text-[10px] text-slate-400 leading-tight">
                  {step.details}
                </div>
              </div>
            );
          })}
        </div>

      </div>

      {/* CRITICAL GOVERNANCE MANDATE: HUMAN-LED COMMAND (HIGH-VISIBILITY CALLOUT) */}
      <div className="rounded-2xl bg-gradient-to-r from-purple-950/40 via-slate-900/90 to-cyan-950/40 border border-purple-500/30 p-6 sm:p-8 space-y-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/40 text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
              <UserCheck className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-purple-300 bg-purple-950 px-2 py-0.5 rounded border border-purple-500/30 font-bold">
                  GOVERNANCE MANDATE
                </span>
                <span className="text-xs text-slate-400">Strict Operational Protocol</span>
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-white">
                Zero Automated Dispatch: Human Officers Remain Responsible
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-3xl">
                ITIS technology rapidly flags potential crises, gathers live coordinates, and presents structured data in seconds. 
                <strong className="text-white font-semibold"> However, ITIS does NOT allow an automated system to independently dispatch emergency services.</strong> A trained, accredited command officer evaluates every signal, verifies the context, and remains strictly responsible for the operational response decision.
              </p>
            </div>
          </div>

          <div className="shrink-0 w-full lg:w-auto p-4 rounded-xl bg-slate-950/80 border border-purple-500/20 text-center lg:text-left space-y-1">
            <div className="text-[11px] text-slate-400 font-mono">Verification Standard</div>
            <div className="text-xs font-bold text-purple-300 flex items-center justify-center lg:justify-start gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>100% Certified Human Decision</span>
            </div>
          </div>

        </div>
      </div>

      {/* AUTHORISED RESPONSE PARTNERS GRID */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 px-1">
          <div>
            <span className="text-[11px] font-mono uppercase font-bold text-cyan-400 tracking-wider">
              MULTI-AGENCY ECOSYSTEM
            </span>
            <h3 className="text-lg sm:text-xl font-bold text-white">
              Authorised Response Partners Coordinated by ITIS
            </h3>
          </div>
          <p className="text-xs text-slate-400 max-w-md sm:text-right">
            Dispatched based on incident severity, jurisdiction, and proximity to ensure immediate physical safety.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {authorizedPartners.map((partner, pIdx) => {
            const PartnerIcon = partner.icon;
            return (
              <div 
                key={pIdx}
                className={`p-4 rounded-xl border bg-slate-900/60 ${partner.color} space-y-2.5 transition-all hover:bg-slate-900/90`}
              >
                <div className="flex items-center justify-between">
                  <PartnerIcon className="w-5 h-5" />
                  <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-950/80 border border-current">
                    {partner.badge}
                  </span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">
                    {partner.title}
                  </h4>
                  <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                    {partner.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </section>
  );
};
