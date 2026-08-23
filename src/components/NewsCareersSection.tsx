import React, { useState } from 'react';
import { 
  Newspaper, 
  Briefcase, 
  Mail, 
  Send, 
  CheckCircle2, 
  ArrowUpRight, 
  ShieldCheck, 
  Code2, 
  Radio, 
  Palette, 
  HeartHandshake, 
  Building,
  Bell,
  Sparkles,
  Info
} from 'lucide-react';

export const NewsCareersSection: React.FC = () => {
  const [selectedNewsCategory, setSelectedNewsCategory] = useState<string>('All');
  const [newsletterEmail, setNewsletterEmail] = useState<string>('');
  const [newsletterSubscribed, setNewsletterSubscribed] = useState<boolean>(false);
  const [selectedCareerCategory, setSelectedCareerCategory] = useState<string>('All');

  const newsCategories = [
    'All',
    'Company Updates',
    'Safety Technology',
    'School Safety',
    'Partnerships',
    'Community Initiatives'
  ];

  const careerCategories = [
    {
      id: 'eng',
      name: 'Engineering & Technology',
      description: 'Distributed IoT telemetry, cryptographic safety, and mission-critical cloud pipelines.',
      icon: Code2
    },
    {
      id: 'ops',
      name: 'Safety Operations',
      description: '24/7 command centre operations, incident triage, and responder coordination.',
      icon: Radio
    },
    {
      id: 'prod',
      name: 'Product & Design',
      description: 'Intuitive guardian interfaces, campus administrative consoles, and accessibility.',
      icon: Palette
    },
    {
      id: 'part',
      name: 'Partnerships',
      description: 'Liaison with school governing bodies, emergency services, and community safety groups.',
      icon: HeartHandshake
    },
    {
      id: 'admin',
      name: 'Administration',
      description: 'Compliance governance, statutory data protection (POPIA), and organizational support.',
      icon: Building
    }
  ];

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (newsletterEmail.trim()) {
      setNewsletterSubscribed(true);
      setNewsletterEmail('');
    }
  };

  return (
    <div className="space-y-16">
      
      {/* ==================================================== */}
      {/* SECTION 1: NEWS & UPDATES */}
      {/* ==================================================== */}
      <section id="news" className="max-w-7xl mx-auto space-y-8 scroll-mt-24">
        
        {/* News Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-xs font-mono text-cyan-300">
              <Newspaper className="w-3.5 h-3.5 text-cyan-400" />
              <span>OFFICIAL DISCLOSURES & RELEASES</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              News & Updates
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
              Official announcements, safety technology developments, and operational dispatches from the ITIS Guardian Network.
            </p>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {newsCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedNewsCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  selectedNewsCategory === cat
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                    : 'bg-slate-900/80 text-slate-400 border border-slate-800 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Clean, Non-Fabricated News Stage */}
        <div className="rounded-3xl bg-gradient-to-b from-slate-900/90 to-slate-950 border border-slate-800/90 p-8 sm:p-12 text-center space-y-6 relative overflow-hidden">
          
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mx-auto shadow-inner">
            <Bell className="w-8 h-8" />
          </div>

          <div className="space-y-3 max-w-xl mx-auto">
            <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              ITIS updates will appear here as the Guardian Network progresses.
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              We maintain strict corporate communication standards. Official announcements regarding technology releases, school onboarding guidelines, and ecosystem milestones will be published directly in this portal.
            </p>
          </div>

          {/* Category Roadmap Indicators */}
          <div className="pt-4 border-t border-slate-800/80 max-w-2xl mx-auto">
            <div className="text-[11px] font-mono uppercase text-slate-400 font-bold mb-3 tracking-wider">
              Upcoming Editorial Desks
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px] text-slate-300">
              <div className="p-2 rounded-lg bg-slate-900/70 border border-slate-800">Company Updates</div>
              <div className="p-2 rounded-lg bg-slate-900/70 border border-slate-800">Safety Tech</div>
              <div className="p-2 rounded-lg bg-slate-900/70 border border-slate-800">School Safety</div>
              <div className="p-2 rounded-lg bg-slate-900/70 border border-slate-800">Partnerships</div>
              <div className="col-span-2 sm:col-span-1 p-2 rounded-lg bg-slate-900/70 border border-slate-800">Community</div>
            </div>
          </div>

          {/* Newsletter Notification Signup */}
          <div className="pt-2 max-w-md mx-auto">
            {newsletterSubscribed ? (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Thank you. You will receive official bulletins as they are published.</span>
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="Enter email for official bulletins..."
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder:text-slate-400 focus:outline-none focus:border-cyan-500 transition-colors"
                  required
                />
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 text-slate-950" />
                  <span>Notify Me</span>
                </button>
              </form>
            )}
            <p className="text-[10px] text-slate-400 mt-2">
              No promotional spam. Official releases only. Unsubscribe at any time.
            </p>
          </div>

        </div>

      </section>

      {/* ==================================================== */}
      {/* SECTION 2: CAREERS */}
      {/* ==================================================== */}
      <section id="careers" className="max-w-7xl mx-auto space-y-8 scroll-mt-24">
        
        {/* Careers Header */}
        <div className="space-y-3 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-xs font-mono text-amber-300">
            <Briefcase className="w-3.5 h-3.5 text-amber-400" />
            <span>TALENT & CULTURE</span>
          </div>
          
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight uppercase font-mono">
            BUILD THE FUTURE OF LEARNER SAFETY.
          </h2>

          <p className="text-base sm:text-lg text-slate-300 font-medium leading-relaxed">
            "ITIS brings together people who believe technology should make communities safer and help protect every learner."
          </p>
        </div>

        {/* 5 Disciplines / Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {careerCategories.map((discipline, idx) => {
            const Icon = discipline.icon;
            const isSelected = selectedCareerCategory === discipline.name;

            return (
              <div 
                key={discipline.id}
                onClick={() => setSelectedCareerCategory(discipline.name)}
                className={`p-5 rounded-2xl bg-slate-900/80 border transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-3 ${
                  isSelected ? 'border-amber-500/50 bg-slate-900' : 'border-slate-800 hover:border-slate-700'
                } ${idx === 4 ? 'md:col-span-2 lg:col-span-1' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 text-amber-400 flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase">
                    Discipline
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white">
                    {discipline.name}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {discipline.description}
                  </p>
                </div>

                <div className="pt-2 text-[10px] font-mono text-slate-400 border-t border-slate-800/80 flex items-center justify-between">
                  <span>Talent Pool</span>
                  <span className="text-amber-400/80">Active Mission</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Authentic Status Card (No Fabricated Openings) */}
        <div className="rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-amber-500/30 p-8 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-6">
          
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-[11px] font-mono font-bold text-amber-300">
              <Info className="w-3 h-3 text-amber-400" />
              <span>NO CURRENT VACANCIES</span>
            </div>
            
            <h3 className="text-lg sm:text-xl font-bold text-white">
              Interested in contributing to the ITIS mission?
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
              We periodically review prospective talent profiles across engineering, safety operations, and community liaison roles. Contact us for future opportunities.
            </p>
          </div>

          <div className="shrink-0 flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <a
              href="mailto:careers@itis.safety.za?subject=Talent%20Inquiry%20-%20ITIS%20Mission"
              className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer text-center"
            >
              <Mail className="w-4 h-4 text-slate-950" />
              <span>Contact Talent Team</span>
            </a>
          </div>

        </div>

      </section>

    </div>
  );
};
