/**
 * ============================================================================
 * ITIS GUARDIAN NETWORK — OFFICIAL BRAND & DESIGN SYSTEM TOKENS
 * ============================================================================
 * Authoritative design system constants and tokens for the ITIS platform.
 * 
 * CORE VALUES:
 * TRUST | AUTHORITY | CHILD SAFETY | TECHNOLOGY | NATIONAL OPERATIONS | HUMAN OVERSIGHT
 * ============================================================================
 */

export const ITIS_BRAND = {
  // Official Nomenclature
  NAME: 'ITIS',
  FULL_NAME: 'INTEGRATED TECHNOLOGY INTELLIGENCE & SAFETY',
  NETWORK_NAME: 'ITIS GUARDIAN NETWORK',
  
  // Official Positioning Statements
  PRIMARY_POSITIONING: 'PROTECTING EVERY LEARNER. EVERY JOURNEY. EVERY SECOND.',
  SUPPORTING_POSITIONING: 'CONNECTED INTELLIGENCE. COORDINATED RESPONSE. SAFER LEARNERS.',
  
  // Core Narrative
  CORE_MESSAGE:
    'A coordinated child-safety network connecting learners, guardians, schools, emergency operations and response partners through intelligent technology and human-led response.',
  
  // Official Branding Asset Paths
  LOGO_PATH: '/branding/itis-logo.png',
  LOGO_ALT: 'ITIS Official Master Brand Mark',
  
  // Sovereign Governance Badges
  NATIONAL_INITIATIVE_LABEL: 'REPUBLIC OF SOUTH AFRICA NATIONAL CHILD SAFETY INITIATIVE',
  CAPTURE_ONCE_PHILOSOPHY: 'Capture Once → Verify Once → Create Once → Reuse Everywhere'
} as const;

/**
 * Official ITIS Color Token Palette
 * 
 * • Deep ITIS Navy / Midnight Blue: Primary Canvas & Surface Foundations
 * • ITIS Cyan / Electric Blue: Technology, active navigation, key interactions
 * • ITIS Gold: Authority, sovereign trust, governance accents, institution badges
 * • White / Cool White: Primary high-contrast text
 * • Muted Blue-Grey: Secondary content & structural metadata
 * • Controlled Emergency Red: SOS distress, critical danger states only
 * • Controlled Green: Verified safe, attendance present, confirmed status
 */
export const ITIS_COLORS = {
  // Canvas & Backgrounds (Deep ITIS Navy)
  NAVY_CANVAS: '#060b18',
  NAVY_SURFACE_PRIMARY: '#0a1224',
  NAVY_SURFACE_SECONDARY: '#0f1a30',
  NAVY_SURFACE_ELEVATED: '#15223c',
  NAVY_BORDER_SUBTLE: 'rgba(51, 65, 85, 0.4)',
  NAVY_BORDER_STRONG: 'rgba(51, 65, 85, 0.8)',
  
  // Technology & Active State (ITIS Cyan)
  CYAN_PRIMARY: '#00c2ff',
  CYAN_HOVER: '#38bdf8',
  CYAN_GLOW: 'rgba(0, 194, 255, 0.25)',
  CYAN_SURFACE: 'rgba(0, 194, 255, 0.10)',
  CYAN_BORDER: 'rgba(0, 194, 255, 0.35)',

  // Authority & Governance Accents (ITIS Gold)
  GOLD_ACCENT: '#d4af37',
  GOLD_HOVER: '#f3d368',
  GOLD_DARK: '#c59b27',
  GOLD_SURFACE: 'rgba(212, 175, 55, 0.12)',
  GOLD_BORDER: 'rgba(212, 175, 55, 0.35)',

  // Typography
  TEXT_PRIMARY: '#f8fafc',
  TEXT_SECONDARY: '#94a3b8',
  TEXT_MUTED: '#64748b',

  // Safety & Emergency (Strictly Controlled)
  EMERGENCY_RED: '#f43f5e',
  EMERGENCY_RED_SURFACE: 'rgba(244, 63, 94, 0.15)',
  EMERGENCY_RED_BORDER: 'rgba(244, 63, 94, 0.40)',

  VERIFIED_GREEN: '#10b981',
  VERIFIED_GREEN_SURFACE: 'rgba(16, 185, 129, 0.15)',
  VERIFIED_GREEN_BORDER: 'rgba(16, 185, 129, 0.40)'
} as const;

/**
 * Authoritative Tailwind CSS Classes for the ITIS Design System
 */
export const ITIS_STYLES = {
  // Card Styles
  CARD_CANVAS: 'bg-slate-900/90 border border-slate-800/80 rounded-2xl shadow-xl backdrop-blur-sm',
  CARD_ELEVATED: 'bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl',
  CARD_CYAN_ACCENT: 'bg-slate-900 border border-cyan-500/30 rounded-2xl p-5 shadow-lg shadow-cyan-950/20',
  CARD_GOLD_ACCENT: 'bg-slate-900 border border-amber-500/30 rounded-2xl p-5 shadow-lg shadow-amber-950/20',
  CARD_EMERGENCY: 'bg-slate-900 border-2 border-rose-500/60 rounded-2xl p-5 shadow-xl shadow-rose-950/30',

  // Button Styles
  BTN_CYAN_PRIMARY: 'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm transition-all shadow-md shadow-cyan-950/40 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
  BTN_GOLD_PRIMARY: 'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-all shadow-md shadow-amber-950/40 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
  BTN_SECONDARY_OUTLINE: 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-950/80 hover:bg-slate-850 text-slate-300 hover:text-white border border-slate-700 text-sm font-semibold transition-all cursor-pointer',
  BTN_EMERGENCY_ACTION: 'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm transition-all shadow-lg shadow-rose-950/50 cursor-pointer',

  // Badge & Chip Styles
  BADGE_CYAN: 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-950/70 text-cyan-300 border border-cyan-500/30',
  BADGE_GOLD: 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/70 text-amber-300 border border-amber-500/30',
  BADGE_EMERGENCY: 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-950/80 text-rose-300 border border-rose-500/50',
  BADGE_VERIFIED: 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/70 text-emerald-300 border border-emerald-500/30',
  BADGE_MUTED: 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700',

  // Input & Field Styles
  INPUT_FIELD: 'w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-all font-sans'
} as const;
