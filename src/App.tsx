import React, { useState, useEffect, useCallback } from 'react';
import { Header, AppTab } from './components/Header.js';
import { Footer } from './components/Footer.js';
import { LandingPage } from './components/LandingPage.js';
import { AuthScreen } from './components/AuthScreen.js';
import { AccessDenied } from './components/AccessDenied.js';
import { CommandCentre } from './components/CommandCentre.js';
import { SchoolPortal } from './components/SchoolPortal.js';
import { GuardianDashboard } from './components/GuardianDashboard.js';
import { ResponderView } from './components/ResponderView.js';
import { ExecutiveGovernmentPortal } from './components/ExecutiveGovernmentPortal.js';
import { AuditLogView } from './components/AuditLogView.js';
import { TechnicianPortal } from './components/TechnicianPortal.js';
import { AdminPortal } from './components/AdminPortal.js';
import { RbacSecurityConsole } from './components/RbacSecurityConsole.js';
import { AuthoritativeEnrolmentModal } from './components/AuthoritativeEnrolmentModal.js';
import { PanicConsole } from './components/PanicConsole.js';
import { api } from './services/api.js';
import { HydratedLearnerRecord, School, IncidentAlert, ActiveUserSession, UserRole } from './types.js';

// URL Route Mapping Table
const ROUTE_TO_TAB_MAP: Record<string, AppTab> = {
  '': 'LANDING_PAGE',
  'landing': 'LANDING_PAGE',
  'home': 'LANDING_PAGE',
  'login': 'LOGIN',
  'auth': 'LOGIN',
  'command': 'COMMAND_CENTRE',
  'school': 'SCHOOL_PORTAL',
  'guardian': 'GUARDIAN_HUB',
  'parent': 'GUARDIAN_HUB',
  'technician': 'TECHNICIAN_PORTAL',
  'admin': 'ADMIN_PORTAL',
  'responder': 'RESPONDER_TACTICAL',
  'government': 'EXECUTIVE_AUDIT',
  'executive': 'EXECUTIVE_AUDIT',
  'audit': 'IMMUTABLE_LOGS',
  'logs': 'IMMUTABLE_LOGS',
  'security': 'RBAC_SECURITY',
  'rbac': 'RBAC_SECURITY'
};

const TAB_TO_ROUTE_MAP: Record<AppTab, string> = {
  'LANDING_PAGE': '',
  'LOGIN': 'login',
  'COMMAND_CENTRE': 'command',
  'SCHOOL_PORTAL': 'school',
  'GUARDIAN_HUB': 'guardian',
  'TECHNICIAN_PORTAL': 'technician',
  'ADMIN_PORTAL': 'admin',
  'RESPONDER_TACTICAL': 'responder',
  'EXECUTIVE_AUDIT': 'executive',
  'IMMUTABLE_LOGS': 'audit',
  'RBAC_SECURITY': 'security'
};

export function App() {
  // Start on the approved public Landing Page by default for all visitors
  const [activeTab, setActiveTab] = useState<AppTab>('LANDING_PAGE');
  const [activeLandingSection, setActiveLandingSection] = useState<string>('home');
  
  // Authoritative Session State
  const [currentUser, setCurrentUser] = useState<ActiveUserSession | null>(null);
  const [authRedirectNotice, setAuthRedirectNotice] = useState<string | null>(null);
  const [sessionChecking, setSessionChecking] = useState(true);

  // Core Platform Data State
  const [learners, setLearners] = useState<HydratedLearnerRecord[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [incidents, setIncidents] = useState<IncidentAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isEnrolmentOpen, setIsEnrolmentOpen] = useState(false);
  const [isPanicOpen, setIsPanicOpen] = useState(false);

  // Helper to determine primary portal for a given role
  const getPrimaryPortalForRole = useCallback((role: UserRole): AppTab => {
    switch (role) {
      case 'PARENT_GUARDIAN': return 'GUARDIAN_HUB';
      case 'SCHOOL_PRINCIPAL':
      case 'SCHOOL_ADMIN_STAFF': return 'SCHOOL_PORTAL';
      case 'COMMAND_OPERATOR': return 'COMMAND_CENTRE';
      case 'TECHNICIAN': return 'TECHNICIAN_PORTAL';
      case 'SYSTEM_ADMIN': return 'ADMIN_PORTAL';
      case 'FIELD_RESPONDER': return 'RESPONDER_TACTICAL';
      case 'GOVERNMENT_AUDITOR':
      case 'FOUNDER_EXECUTIVE': return 'EXECUTIVE_AUDIT';
      default: return 'LANDING_PAGE';
    }
  }, []);

  // Authoritative Role & Scope RBAC Authorization Guard
  const canAccessTab = useCallback((user: ActiveUserSession | null, tab: AppTab): boolean => {
    if (tab === 'LANDING_PAGE' || tab === 'LOGIN') {
      return true;
    }
    if (!user) {
      return false;
    }

    // Founder has executive oversight across all domains
    if (user.role === 'FOUNDER_EXECUTIVE') {
      return true;
    }

    switch (tab) {
      case 'GUARDIAN_HUB':
        return user.role === 'PARENT_GUARDIAN';
      case 'SCHOOL_PORTAL':
        return user.role === 'SCHOOL_PRINCIPAL' || user.role === 'SCHOOL_ADMIN_STAFF';
      case 'COMMAND_CENTRE':
        return user.role === 'COMMAND_OPERATOR';
      case 'RESPONDER_TACTICAL':
        return user.role === 'FIELD_RESPONDER' || user.role === 'COMMAND_OPERATOR';
      case 'TECHNICIAN_PORTAL':
        return user.role === 'TECHNICIAN';
      case 'ADMIN_PORTAL':
        return user.role === 'SYSTEM_ADMIN';
      case 'EXECUTIVE_AUDIT':
        return user.role === 'GOVERNMENT_AUDITOR';
      case 'IMMUTABLE_LOGS':
        return (
          user.role === 'COMMAND_OPERATOR' ||
          user.role === 'GOVERNMENT_AUDITOR' ||
          user.role === 'SYSTEM_ADMIN'
        );
      case 'RBAC_SECURITY':
        return true; // Any authenticated user can view the authoritative RBAC matrix & run security audits
      default:
        return false;
    }
  }, []);

  const getPortalLabel = (tab: AppTab): string => {
    switch (tab) {
      case 'COMMAND_CENTRE': return '24/7 Command Centre';
      case 'SCHOOL_PORTAL': return 'School Administration Portal';
      case 'GUARDIAN_HUB': return 'Guardian Safety Hub';
      case 'RESPONDER_TACTICAL': return 'SAPS Tactical Responder Console';
      case 'EXECUTIVE_AUDIT': return 'Executive & DBE Governance Portal';
      case 'IMMUTABLE_LOGS': return 'National SHA-256 Audit Trail';
      case 'TECHNICIAN_PORTAL': return 'Hardware & IoT Technician Portal';
      case 'ADMIN_PORTAL': return 'System Administration Console';
      case 'RBAC_SECURITY': return 'Authoritative RBAC & Security Test Suite';
      default: return tab;
    }
  };

  // Safe navigation handler enforcing auth & clearance + updating URL
  const handleNavigateTab = (targetTab: AppTab) => {
    // Update URL hash smoothly
    const routeSlug = TAB_TO_ROUTE_MAP[targetTab];
    if (typeof window !== 'undefined') {
      window.location.hash = routeSlug ? `/${routeSlug}` : '';
    }

    if (targetTab === 'LANDING_PAGE' || targetTab === 'LOGIN') {
      setAuthRedirectNotice(null);
      setActiveTab(targetTab);
      return;
    }

    if (!currentUser) {
      setAuthRedirectNotice(`Authentication required. Please sign in to access the ${getPortalLabel(targetTab)}.`);
      setActiveTab('LOGIN');
      return;
    }

    setAuthRedirectNotice(null);
    setActiveTab(targetTab);
  };

  // Login handler triggered by AuthScreen on successful server verification
  const handleLoginSuccess = (user: ActiveUserSession) => {
    setCurrentUser(user);
    setAuthRedirectNotice(null);
    const targetPortal = getPrimaryPortalForRole(user.role);
    const routeSlug = TAB_TO_ROUTE_MAP[targetPortal];
    if (typeof window !== 'undefined') {
      window.location.hash = routeSlug ? `/${routeSlug}` : '';
    }
    setActiveTab(targetPortal);
    loadData();
  };

  // Logout handler
  const handleLogout = async () => {
    await api.logout();
    setCurrentUser(null);
    setLearners([]);
    setSchools([]);
    setIncidents([]);
    setAuthRedirectNotice(null);
    if (typeof window !== 'undefined') {
      window.location.hash = '';
    }
    setActiveTab('LANDING_PAGE');
  };

  // Operational Data loader
  const loadData = async () => {
    try {
      const [lData, sData, iData] = await Promise.all([
        api.getLearners(),
        api.getSchools(),
        api.getIncidents()
      ]);
      setLearners(Array.isArray(lData) ? lData : []);
      setSchools(Array.isArray(sData) ? sData : []);
      setIncidents(Array.isArray(iData) ? iData : []);
    } catch (err) {
      console.warn('Operational data sync notice:', err);
      setLearners(prev => prev || []);
      setSchools(prev => prev || []);
      setIncidents(prev => prev || []);
    } finally {
      setIsLoading(false);
    }
  };

  // Resolve route from current window hash or pathname
  const resolveRouteFromUrl = useCallback((): AppTab => {
    if (typeof window === 'undefined') return 'LANDING_PAGE';
    
    // Check hash first (e.g. #/command or #command)
    let raw = window.location.hash.replace(/^#\/?/, '').trim().toLowerCase();
    
    // If no hash, check pathname (e.g. /command)
    if (!raw && window.location.pathname && window.location.pathname !== '/') {
      raw = window.location.pathname.replace(/^\//, '').trim().toLowerCase();
    }

    return ROUTE_TO_TAB_MAP[raw] || 'LANDING_PAGE';
  }, []);

  // Non-blocking background session verification on startup & URL hash listener
  useEffect(() => {
    let isMounted = true;

    const hydrateSession = async () => {
      try {
        const sessionData = await api.getSession();
        if (isMounted && sessionData?.user) {
          setCurrentUser(sessionData.user);
          
          // If a URL was requested, route to it or their primary portal
          const initialTab = resolveRouteFromUrl();
          if (initialTab !== 'LANDING_PAGE' && initialTab !== 'LOGIN') {
            setActiveTab(initialTab);
          } else if (initialTab === 'LOGIN') {
            // Already logged in, route to permitted portal
            setActiveTab(getPrimaryPortalForRole(sessionData.user.role));
          }
        } else {
          // Unauthenticated visitor
          const initialTab = resolveRouteFromUrl();
          if (initialTab !== 'LANDING_PAGE' && initialTab !== 'LOGIN') {
            setAuthRedirectNotice(`Authentication required. Please sign in to access the ${getPortalLabel(initialTab)}.`);
            setActiveTab('LOGIN');
          } else {
            setActiveTab(initialTab);
          }
        }
      } catch (err) {
        console.warn('No active session restored:', err);
      } finally {
        if (isMounted) {
          setSessionChecking(false);
        }
      }
    };

    hydrateSession();

    // Listen for browser navigation / URL changes
    const handleHashChange = () => {
      const targetTab = resolveRouteFromUrl();
      if (targetTab === 'LANDING_PAGE' || targetTab === 'LOGIN') {
        setActiveTab(targetTab);
      } else {
        setActiveTab(targetTab);
      }
    };

    window.addEventListener('hashchange', handleHashChange);

    return () => {
      isMounted = false;
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [resolveRouteFromUrl, getPrimaryPortalForRole]);

  // Operational polling only when an authenticated portal is actively being viewed
  useEffect(() => {
    if (!currentUser || activeTab === 'LANDING_PAGE' || activeTab === 'LOGIN') {
      return;
    }

    loadData();
    const interval = setInterval(loadData, 6000);
    return () => clearInterval(interval);
  }, [currentUser, activeTab]);

  const activePanicCount = Array.isArray(incidents) ? incidents.filter(i => i && i.status !== 'RESOLVED').length : 0;

  const handleSelectLandingSection = useCallback((sectionId: string) => {
    setActiveLandingSection(sectionId);
    if (activeTab !== 'LANDING_PAGE') {
      setActiveTab('LANDING_PAGE');
    }
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-[#060b18] text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-white max-w-full overflow-x-hidden">
      {/* Master Canonical Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={handleNavigateTab}
        currentUser={currentUser}
        activeLandingSection={activeLandingSection}
        onSelectLandingSection={handleSelectLandingSection}
        onOpenLogin={() => {
          setAuthRedirectNotice(null);
          handleNavigateTab('LOGIN');
        }}
        onLogout={handleLogout}
        onOpenEnrolment={() => {
          if (!currentUser) {
            setAuthRedirectNotice('Please sign in with school administrative credentials to launch Authoritative Enrolment.');
            handleNavigateTab('LOGIN');
          } else {
            setIsEnrolmentOpen(true);
          }
        }}
        onOpenPanic={() => setIsPanicOpen(true)}
        activePanicCount={activePanicCount}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* PUBLIC LANDING PAGE */}
        {activeTab === 'LANDING_PAGE' && (
          <LandingPage
            currentUser={currentUser}
            activeSection={activeLandingSection}
            onSelectSection={handleSelectLandingSection}
            onOpenLogin={() => {
              setAuthRedirectNotice(null);
              handleNavigateTab('LOGIN');
            }}
            onNavigateToAuthorizedPortal={() => {
              if (currentUser) {
                handleNavigateTab(getPrimaryPortalForRole(currentUser.role));
              } else {
                handleNavigateTab('LOGIN');
              }
            }}
            onOpenEnrolment={() => {
              if (!currentUser) {
                setAuthRedirectNotice('Sign in with school administrative credentials to launch Authoritative Enrolment.');
                handleNavigateTab('LOGIN');
              } else {
                setIsEnrolmentOpen(true);
              }
            }}
            onOpenPanic={() => setIsPanicOpen(true)}
          />
        )}

        {/* UNIFIED AUTHENTICATION SCREEN */}
        {activeTab === 'LOGIN' && (
          <AuthScreen
            onLoginSuccess={handleLoginSuccess}
            onBackToLanding={() => handleNavigateTab('LANDING_PAGE')}
            redirectNotice={authRedirectNotice}
          />
        )}

        {/* PROTECTED PORTALS */}
        {activeTab !== 'LANDING_PAGE' && activeTab !== 'LOGIN' && (
          <>
            {sessionChecking ? (
              <div className="flex flex-col items-center justify-center h-96 space-y-3">
                <div className="w-10 h-10 border-4 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin" />
                <p className="text-xs text-slate-400 font-mono">Verifying Sovereign Security Ledger...</p>
              </div>
            ) : !currentUser || !canAccessTab(currentUser, activeTab) ? (
              <AccessDenied
                currentUser={currentUser || {
                  id: 'anon',
                  name: 'Unauthenticated Visitor',
                  email: 'public@itis.safety.za',
                  role: 'PARENT_GUARDIAN',
                  token: ''
                }}
                attemptedPortal={getPortalLabel(activeTab)}
                onNavigateToAuthorizedPortal={() => {
                  if (currentUser) {
                    handleNavigateTab(getPrimaryPortalForRole(currentUser.role));
                  } else {
                    handleNavigateTab('LOGIN');
                  }
                }}
                onLogout={handleLogout}
                onBackToLanding={() => handleNavigateTab('LANDING_PAGE')}
              />
            ) : (
              <>
                {activeTab === 'COMMAND_CENTRE' && (
                  <CommandCentre
                    incidents={incidents}
                    learners={learners}
                    onRefresh={loadData}
                    onOpenEnrolment={() => setIsEnrolmentOpen(true)}
                    onOpenPanic={() => setIsPanicOpen(true)}
                    onNavigateToResponder={() => handleNavigateTab('RESPONDER_TACTICAL')}
                  />
                )}

                {activeTab === 'SCHOOL_PORTAL' && (
                  <SchoolPortal
                    learners={learners}
                    schools={schools}
                    currentUser={currentUser}
                    onOpenEnrolment={() => setIsEnrolmentOpen(true)}
                    onRefresh={loadData}
                  />
                )}

                {activeTab === 'GUARDIAN_HUB' && (
                  <GuardianDashboard
                    learners={learners}
                    currentUser={currentUser}
                    onOpenPanic={() => setIsPanicOpen(true)}
                  />
                )}

                {activeTab === 'TECHNICIAN_PORTAL' && (
                  <TechnicianPortal
                    currentUser={currentUser}
                  />
                )}

                {activeTab === 'ADMIN_PORTAL' && (
                  <AdminPortal
                    currentUser={currentUser}
                    learners={learners}
                    schools={schools}
                    onOpenEnrolment={() => setIsEnrolmentOpen(true)}
                    onRefresh={loadData}
                  />
                )}

                {activeTab === 'RESPONDER_TACTICAL' && (
                  <ResponderView
                    incidents={incidents}
                    learners={learners}
                    onRefresh={loadData}
                  />
                )}

                {activeTab === 'EXECUTIVE_AUDIT' && (
                  <ExecutiveGovernmentPortal
                    learners={learners}
                    schools={schools}
                    currentUser={currentUser}
                  />
                )}

                {activeTab === 'IMMUTABLE_LOGS' && (
                  <AuditLogView />
                )}

                {activeTab === 'RBAC_SECURITY' && (
                  <RbacSecurityConsole currentUser={currentUser} />
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* Authoritative Enrolment Modal (Capture-Once Core) */}
      {currentUser && (
        <AuthoritativeEnrolmentModal
          isOpen={isEnrolmentOpen}
          onClose={() => setIsEnrolmentOpen(false)}
          onSuccess={loadData}
          currentUser={currentUser}
          schools={schools}
          preselectedSchoolId={currentUser.schoolId}
        />
      )}

      {/* Emergency SOS Panic Simulation Modal */}
      <PanicConsole
        isOpen={isPanicOpen}
        onClose={() => setIsPanicOpen(false)}
        learners={learners}
        onTriggerSuccess={loadData}
      />

      {/* Complete Corporate Footer */}
      <Footer 
        activeTab={activeTab}
        setActiveTab={handleNavigateTab}
        onOpenLogin={() => handleNavigateTab('LOGIN')}
        onSelectLandingSection={handleSelectLandingSection}
      />
    </div>
  );
}

export default App;
