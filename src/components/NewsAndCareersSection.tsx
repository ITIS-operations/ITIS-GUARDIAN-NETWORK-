import React, { useState } from 'react';
import { 
  Newspaper, 
  Briefcase, 
  Bell, 
  ArrowRight, 
  Sparkles, 
  Mail, 
  Layers, 
  Cpu, 
  School, 
  Users2, 
  Building, 
  Compass,
  CheckCircle2,
  Inbox
} from 'lucide-react';

export const NewsAndCareersSection: React.FC = () => {
  const [selectedNewsCategory, setSelectedNewsCategory] = useState<string>('All');
  const [selectedCareerCategory, setSelectedCareerCategory] = useState<string>('All');

  const newsCategories = [
    { id: 'All', label: 'All Topics' },
    { id: 'Company Updates', label: 'Company Updates', icon: Building },
    { id: 'Safety Technology', label: 'Safety Technology', icon: Cpu },
    { id: 'School Safety', label: 'School Safety', icon: School },
    { id: 'Partnerships', label: 'Partnerships', icon: Layers },
    { id: 'Community Initiatives', label: 'Community Initiatives', icon: Users2 }
  ];

  const careerCategories = [
    { id: 'All', label: 'All Departments' },
    { id: 'Engineering & Technology', label: 'Engineering & Technology' },
    { id: 'Safety Operations', label: 'Safety Operations' },
    { id: 'Product & Design', label: 'Product & Design' },
    { id: 'Partnerships', label: 'Partnerships' },
    { id: 'Administration', label: 'Administration' }
  ];

  const scrollToContact = () => {
    const el = document.getElementById('contact');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.location.href = 'mailto:careers@itis.safety.za?subject=Future%20Opportunity%20Inquiry%20-%20ITIS%20Guardian%20Network';
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-12">
      
      {/* 2-COLUMN GRID FOR NEWS & CAREERS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* ==================================================== */}
        {/* NEWS & UPDATES */}
        {/* ==================================================== */}
        <section 
          id="news" 
          className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 sm:p-8 flex flex-col justify-between space-y-6 scroll-mt-24 shadow-xl"
        >
          <div className="space-y-5">
            
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4 gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-[10px] font-mono text-cyan-300">
                  <Newspaper className="w-3 h-3 text-cyan-400" />
                  <span>PUBLIC DISCLOSURES & RELEASES</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  News & Updates
                </h2>
              </div>
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider py-1 px-2 rounded bg-slate-950/80 border border-slate-800">
                Official Feed
              </span>
            </div>

            {/* Category Filter Chips */}
            <div className="space-y-2">
              <div className="text-[11px] font-medium text-slate-400">Filter by Topic:</div>
              <div className="flex flex-wrap gap-1.5">
                {newsCategories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedNewsCategory(category.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      selectedNewsCategory === category.id
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                        : 'bg-slate-950/60 text-slate-400 border border-slate-800 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Honest / Factual Status Message & Quiet Empty State */}
            <div className="rounded-2xl bg-slate-950/70 border border-slate-800/90 p-6 text-center space-y-3.5 my-2">
              <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 text-cyan-400 flex items-center justify-center mx-auto shadow-inner">
                <Bell className="w-5 h-5" />
              </div>

              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-sm font-bold text-white">
                  ITIS updates will appear here as the Guardian Network progresses.
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Official press statements, verified technology rollouts, school safety bulletins, and multi-agency initiatives will be published directly through this channel.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-center gap-2 text-[11px] text-slate-400 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/80 animate-pulse" />
                <span>Active monitoring channel</span>
              </div>
            </div>

          </div>

          {/* Footer of Card */}
          <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Media inquiries & communications</span>
            <a 
              href="mailto:press@itis.safety.za" 
              className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors inline-flex items-center gap-1"
            >
              <span>press@itis.safety.za</span>
              <ArrowRight className="w-3 h-3" />
            </a>
          </div>
        </section>


        {/* ==================================================== */}
        {/* CAREERS */}
        {/* ==================================================== */}
        <section 
          id="careers" 
          className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 sm:p-8 flex flex-col justify-between space-y-6 scroll-mt-24 shadow-xl"
        >
          <div className="space-y-5">
            
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4 gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-[10px] font-mono text-amber-300">
                  <Briefcase className="w-3 h-3 text-amber-400" />
                  <span>TALENT & CULTURE</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight uppercase font-mono">
                  BUILD THE FUTURE OF LEARNER SAFETY.
                </h2>
              </div>
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider py-1 px-2 rounded bg-slate-950/80 border border-slate-800">
                Opportunities
              </span>
            </div>

            {/* Mission Statement */}
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
              "ITIS brings together people who believe technology should make communities safer and help protect every learner."
            </p>

            {/* Functional Department Categories */}
            <div className="space-y-2">
              <div className="text-[11px] font-medium text-slate-400">Department Focus Areas:</div>
              <div className="flex flex-wrap gap-1.5">
                {careerCategories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCareerCategory(category.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      selectedCareerCategory === category.id
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                        : 'bg-slate-950/60 text-slate-400 border border-slate-800 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Honest / Factual No Current Vacancies Box */}
            <div className="rounded-2xl bg-slate-950/70 border border-slate-800/90 p-6 text-center space-y-3 my-2">
              <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
                <Inbox className="w-5 h-5" />
              </div>

              <div className="space-y-1 max-w-md mx-auto">
                <div className="text-xs font-mono font-bold text-amber-300 uppercase tracking-wider">
                  NO CURRENT VACANCIES
                </div>
                <h3 className="text-sm font-bold text-white">
                  Interested in contributing to the ITIS mission?
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Contact us for future opportunities. We welcome expressions of interest from experienced engineers, certified incident command professionals, and child safety advocates.
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={scrollToContact}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
                >
                  <Mail className="w-3.5 h-3.5 text-amber-400" />
                  <span>Send Expression of Interest</span>
                </button>
              </div>
            </div>

          </div>

          {/* Footer of Card */}
          <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Direct talent correspondence</span>
            <a 
              href="mailto:careers@itis.safety.za" 
              className="text-amber-400 hover:text-amber-300 font-medium transition-colors inline-flex items-center gap-1"
            >
              <span>careers@itis.safety.za</span>
              <ArrowRight className="w-3 h-3" />
            </a>
          </div>
        </section>

      </div>

    </div>
  );
};
