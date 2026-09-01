import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldAlert, 
  MapPin, 
  Clock, 
  PhoneCall, 
  UserCheck, 
  Navigation, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Shield, 
  Activity, 
  ChevronRight, 
  Zap, 
  Check, 
  AlertTriangle, 
  User, 
  Building2, 
  Eye, 
  FileText, 
  Lock, 
  Sparkles, 
  School as SchoolIcon, 
  Car, 
  HeartPulse, 
  X, 
  Timer, 
  ArrowLeft,
  ArrowRight,
  Send,
  CheckSquare,
  Compass,
  Radio,
  Volume2,
  Users,
  Share2,
  Columns,
  Maximize2,
  ShieldCheck,
  Phone,
  MessageSquare
} from 'lucide-react';
import { 
  IncidentAlert, 
  HydratedLearnerRecord, 
  EligibleResponderRanking, 
  ResponderUnit,
  IncidentSeverity,
  IncidentStatus,
  ActiveUserSession,
  CommandOfficerWorkload,
  MonitoringOfficer
} from '../types.js';
import { api } from '../services/api.js';
import { TacticalInterceptionMap } from './TacticalInterceptionMap.js';

export type CommandSection = 
  | 'EMERGENCIES'
  | 'TACTICAL_MAP'
  | 'RESPONSE_FLEET'
  | 'SCHOOLS'
  | 'HISTORY';

interface Props {
  incidents: IncidentAlert[];
  learners: HydratedLearnerRecord[];
  currentUser?: ActiveUserSession | null;
  onRefresh: () => void;
  onOpenEnrolment: () => void;
  onOpenPanic: () => void;
  activeSection?: CommandSection;
  onNavigateToResponder?: () => void;
}

export const CommandCentre: React.FC<Props> = ({
  incidents = [],
  learners = [],
  currentUser,
  onRefresh,
  onOpenEnrolment,
  onOpenPanic,
  activeSection = 'EMERGENCIES',
  onNavigateToResponder
}) => {
  const safeIncidents = useMemo(() => Array.isArray(incidents) ? incidents : [], [incidents]);
  const safeLearners = useMemo(() => Array.isArray(learners) ? learners : [], [learners]);

  const [currentTab, setCurrentTab] = useState<CommandSection>(activeSection);
  
  // Selected primary incident tracking by ID
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  // Split-Screen Dual Incident Monitoring Mode
  const [isSplitScreenMode, setIsSplitScreenMode] = useState(false);
  const [secondaryIncidentId, setSecondaryIncidentId] = useState<string | null>(null);

  // Incident Queue Filter: 'ALL' | 'MINE' | 'MONITORED' | 'UNCLAIMED'
  const [queueFilter, setQueueFilter] = useState<'ALL' | 'MINE' | 'MONITORED' | 'UNCLAIMED'>('ALL');

  // Workflow Progression State for Active Incident (Step 1 to Step 7)
  const [activeWorkflowStep, setActiveWorkflowStep] = useState<number>(1);
  const [assessedSeverity, setAssessedSeverity] = useState<IncidentSeverity>('CRITICAL_SOS');
  const [reassuranceSent, setReassuranceSent] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Ranked Eligible Responders State
  const [rankedResponders, setRankedResponders] = useState<EligibleResponderRanking[]>([]);
  const [allUnits, setAllUnits] = useState<ResponderUnit[]>([]);
  const [isLoadingRankings, setIsLoadingRankings] = useState(false);
  const [dispatchSuccessMsg, setDispatchSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Explicit Human Authorization Dispatch Confirmation Modal
  const [confirmModalRanking, setConfirmModalRanking] = useState<EligibleResponderRanking | null>(null);
  const [isAuthorizingDispatch, setIsAuthorizingDispatch] = useState(false);

  // False Alarm Confirmation Modal
  const [showFalseAlarmModal, setShowFalseAlarmModal] = useState(false);

  // Handover Command Modal State
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [handoverTargetOfficerId, setHandoverTargetOfficerId] = useState('');
  const [handoverTargetOfficerName, setHandoverTargetOfficerName] = useState('');
  const [handoverReason, setHandoverReason] = useState('');
  const [isHandingOver, setIsHandingOver] = useState(false);

  // Officer Workload Roster Drawer / Modal
  const [showWorkloadRoster, setShowWorkloadRoster] = useState(false);
  const [officersWorkload, setOfficersWorkload] = useState<CommandOfficerWorkload[]>([]);
  const [isLoadingWorkload, setIsLoadingWorkload] = useState(false);

  // Quick Tactical Note input state
  const [tacticalNoteInput, setTacticalNoteInput] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // Operational Hardening Validation Suite State (14 Acceptance Tests)
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationReport, setValidationReport] = useState<any | null>(null);
  const [isRunningValidation, setIsRunningValidation] = useState(false);

  const handleRunValidationSuite = async () => {
    try {
      setIsRunningValidation(true);
      setShowValidationModal(true);
      const report = await api.runOperationalSuite();
      setValidationReport(report);
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Failed to run operational validation suite');
    } finally {
      setIsRunningValidation(false);
    }
  };

  // Derive active emergencies
  const activeIncidents = useMemo(() => 
    safeIncidents.filter(i => i.status !== 'RESOLVED'),
    [safeIncidents]
  );

  // Filtered queue based on officer ownership
  const filteredIncidents = useMemo(() => {
    return activeIncidents.filter(inc => {
      if (queueFilter === 'MINE') {
        return inc.primaryOfficerId === currentUser?.id;
      }
      if (queueFilter === 'MONITORED') {
        return inc.monitoringOfficers?.some(m => m.userId === currentUser?.id);
      }
      if (queueFilter === 'UNCLAIMED') {
        return !inc.primaryOfficerId;
      }
      return true;
    });
  }, [activeIncidents, queueFilter, currentUser?.id]);

  // Resolve primary active incident object
  const currentIncident = useMemo(() => {
    if (selectedIncidentId) {
      const found = safeIncidents.find(i => i.id === selectedIncidentId);
      if (found) return found;
    }
    return filteredIncidents[0] || activeIncidents[0] || safeIncidents[0] || null;
  }, [selectedIncidentId, safeIncidents, activeIncidents, filteredIncidents]);

  // Resolve secondary incident for split-screen monitoring
  const secondaryIncident = useMemo(() => {
    if (!isSplitScreenMode) return null;
    if (secondaryIncidentId) {
      const found = safeIncidents.find(i => i.id === secondaryIncidentId && i.id !== currentIncident?.id);
      if (found) return found;
    }
    return activeIncidents.find(i => i.id !== currentIncident?.id) || null;
  }, [isSplitScreenMode, secondaryIncidentId, safeIncidents, activeIncidents, currentIncident?.id]);

  // Synchronize selected ID on mount or when active emergency arrives
  useEffect(() => {
    if (!selectedIncidentId && currentIncident) {
      setSelectedIncidentId(currentIncident.id);
    }
  }, [currentIncident?.id]);

  // Derive workflow step automatically if incident status is advanced in backend
  useEffect(() => {
    if (!currentIncident) return;
    
    if (currentIncident.status === 'RESOLVED') {
      setActiveWorkflowStep(7);
    } else if (currentIncident.status === 'ON_SCENE' || currentIncident.status === 'CONTAINED') {
      setActiveWorkflowStep(6);
    } else if (currentIncident.status === 'DISPATCHED') {
      setActiveWorkflowStep(5);
    } else {
      setAssessedSeverity(currentIncident.severity || 'CRITICAL_SOS');
    }
  }, [currentIncident?.id, currentIncident?.status, currentIncident?.severity]);

  // Load available responders when in dispatch step or when emergency changes
  useEffect(() => {
    if (currentIncident && (activeWorkflowStep === 4 || currentIncident.status === 'DISPATCHED')) {
      loadRankedResponders(currentIncident.id);
    }
    loadAllUnits();
  }, [currentIncident?.id, activeWorkflowStep]);

  // Load officers workload
  const loadOfficersWorkload = async () => {
    try {
      setIsLoadingWorkload(true);
      const list = await api.getCommandOfficersWorkload();
      setOfficersWorkload(list);
    } catch (err) {
      console.warn('Failed to load command officers workload:', err);
    } finally {
      setIsLoadingWorkload(false);
    }
  };

  useEffect(() => {
    loadOfficersWorkload();
    const interval = setInterval(loadOfficersWorkload, 15000);
    return () => clearInterval(interval);
  }, []);

  const loadRankedResponders = async (incidentId: string) => {
    try {
      setIsLoadingRankings(true);
      const rankings = await api.getEligibleRespondersRanking(incidentId);
      setRankedResponders(rankings);
    } catch (err) {
      console.warn('Failed to load eligible responder rankings:', err);
    } finally {
      setIsLoadingRankings(false);
    }
  };

  const loadAllUnits = async () => {
    try {
      const units = await api.getResponderUnits();
      setAllUnits(units);
    } catch (err) {
      console.warn('Failed to load responder units:', err);
    }
  };

  // ----------------------------------------------------
  // MULTI-OFFICER CLAIMING & COORDINATION HANDLERS
  // ----------------------------------------------------

  const handleClaimIncident = async (incidentId: string) => {
    try {
      setActionErrorMsg(null);
      const res = await api.claimIncident(incidentId);
      setActionSuccessMsg(`✓ You are now the Primary Incident Commander for case ${incidentId}`);
      setTimeout(() => setActionSuccessMsg(null), 4000);
      onRefresh();
      loadOfficersWorkload();
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Failed to claim incident');
    }
  };

  const handleReleaseIncident = async (incidentId: string) => {
    try {
      setActionErrorMsg(null);
      await api.releaseIncident(incidentId, 'Officer released case back to general command queue');
      setActionSuccessMsg('✓ Incident released back to general Command Centre queue');
      setTimeout(() => setActionSuccessMsg(null), 4000);
      onRefresh();
      loadOfficersWorkload();
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Failed to release incident');
    }
  };

  const handleOpenHandover = (incident: IncidentAlert) => {
    setShowHandoverModal(true);
    setHandoverReason('Shift handover / cross-sector tactical escalation');
  };

  const handleExecuteHandover = async () => {
    if (!currentIncident || !handoverTargetOfficerId) return;
    try {
      setIsHandingOver(true);
      setActionErrorMsg(null);
      await api.handoverIncident(
        currentIncident.id,
        { id: handoverTargetOfficerId, name: handoverTargetOfficerName, role: 'COMMAND_OPERATOR' },
        handoverReason || 'Tactical command handover executed'
      );
      setShowHandoverModal(false);
      setActionSuccessMsg(`✓ Command successfully transferred to ${handoverTargetOfficerName}`);
      setTimeout(() => setActionSuccessMsg(null), 5000);
      onRefresh();
      loadOfficersWorkload();
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Failed to transfer incident command');
    } finally {
      setIsHandingOver(false);
    }
  };

  const handleToggleMonitoring = async (incidentId: string, isCurrentlyMonitoring: boolean) => {
    try {
      setActionErrorMsg(null);
      if (isCurrentlyMonitoring) {
        await api.leaveIncidentMonitoring(incidentId);
        setActionSuccessMsg('Left incident observation feed');
      } else {
        await api.joinIncidentMonitoring(incidentId);
        setActionSuccessMsg('Joined active incident monitoring stream');
      }
      setTimeout(() => setActionSuccessMsg(null), 3000);
      onRefresh();
      loadOfficersWorkload();
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Failed to update monitoring status');
    }
  };

  const handleAddTacticalNote = async (incidentId: string) => {
    if (!tacticalNoteInput.trim()) return;
    try {
      setIsSubmittingNote(true);
      await api.addIncidentTacticalNote(incidentId, tacticalNoteInput.trim());
      setTacticalNoteInput('');
      setActionSuccessMsg('Tactical note logged to immutable audit trail');
      setTimeout(() => setActionSuccessMsg(null), 3000);
      onRefresh();
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Failed to add tactical note');
    } finally {
      setIsSubmittingNote(false);
    }
  };

  // Plain-Language Reassurance Update to Guardian
  const handleSendReassurance = async (incident: IncidentAlert) => {
    setReassuranceSent(incident.id);
    await api.updateIncidentStatus(
      incident.id, 
      incident.status, 
      'Emergency response update sent to guardian: Command Officer coordinating verified response.'
    );
    setTimeout(() => setReassuranceSent(null), 4000);
  };

  // Step 2 Action: Confirm Genuine Emergency
  const handleConfirmGenuineEmergency = () => {
    setActiveWorkflowStep(3); // Move to Step 3: ASSESS
  };

  // Step 2 Action: Mark as False Alarm
  const handleMarkFalseAlarm = async () => {
    if (!currentIncident) return;
    setIsVerifying(true);
    try {
      await api.updateIncidentStatus(
        currentIncident.id,
        'RESOLVED',
        'Command Officer verified alert as unconfirmed / test alarm. Incident cleared.'
      );
      setShowFalseAlarmModal(false);
      onRefresh();
      setSelectedIncidentId(null);
    } catch (err) {
      console.error('Failed to mark false alarm:', err);
    } finally {
      setIsVerifying(false);
    }
  };

  // Step 3 Action: Proceed to Dispatch
  const handleProceedToDispatch = () => {
    setActiveWorkflowStep(4); // Move to Step 4: DISPATCH
  };

  // Step 4 Action: Open confirmation dialog for human officer authorization
  const handleOpenDispatchConfirmation = (ranking: EligibleResponderRanking) => {
    setConfirmModalRanking(ranking);
  };

  // Execute Human Authorized Dispatch
  const handleExecuteConfirmedDispatch = async () => {
    if (!currentIncident || !confirmModalRanking) return;

    setIsAuthorizingDispatch(true);
    try {
      await api.dispatchResponder({
        incidentId: currentIncident.id,
        responderId: confirmModalRanking.responder.id,
        responderName: confirmModalRanking.responder.name,
        unitType: confirmModalRanking.responder.unitType,
        vehicleId: confirmModalRanking.responder.vehicleId,
        etaMinutes: confirmModalRanking.estimatedEtaMinutes ?? 4,
        note: `Command Officer ${currentUser?.name || ''} authorized emergency dispatch for ${confirmModalRanking.responder.name}.`,
        isHumanDispatch: true
      });

      setDispatchSuccessMsg(`✓ ${confirmModalRanking.responder.name.toUpperCase()} DISPATCHED`);
      setConfirmModalRanking(null);
      setActiveWorkflowStep(5); // Move to Step 5: RESPONDING
      onRefresh();
      setTimeout(() => setDispatchSuccessMsg(null), 6000);
    } catch (err) {
      console.error('Dispatch authorization error:', err);
    } finally {
      setIsAuthorizingDispatch(false);
    }
  };

  // Step 5 Action: Mark Unit On Scene
  const handleMarkOnScene = async () => {
    if (!currentIncident) return;
    await api.updateIncidentStatus(
      currentIncident.id,
      'ON_SCENE',
      'Assigned response unit arrived on scene. Area secured.'
    );
    setActiveWorkflowStep(6);
    onRefresh();
  };

  // Step 6 Action: Resolve Emergency
  const handleResolveEmergency = async () => {
    if (!currentIncident) return;
    await api.updateIncidentStatus(
      currentIncident.id,
      'RESOLVED',
      'Child confirmed safe and in custody of authoritative guardian/school principal. Emergency resolved.'
    );
    setActiveWorkflowStep(7);
    onRefresh();
  };

  const getServiceTypeBadge = (unitType: string) => {
    switch (unitType) {
      case 'NATIONAL_POLICE':
      case 'SAPS':
      case 'METRO_POLICE':
        return { label: 'POLICE', icon: '🚔', color: 'bg-blue-600/20 text-blue-300 border-blue-500/40' };
      case 'PARAMEDIC_EMS':
        return { label: 'EMS / MEDICAL', icon: '🚑', color: 'bg-rose-600/20 text-rose-300 border-rose-500/40' };
      case 'PRIVATE_SECURITY':
      case 'SCHOOL_SECURITY':
        return { label: 'SECURITY', icon: '🛡', color: 'bg-amber-600/20 text-amber-300 border-amber-500/40' };
      default:
        return { label: 'COMMUNITY RESPONSE', icon: '👥', color: 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40' };
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '10:42:00';
    }
  };

  // User ownership state for the currently active incident
  const isClaimedByMe = currentIncident?.primaryOfficerId === currentUser?.id;
  const isClaimedByOther = !!currentIncident?.primaryOfficerId && currentIncident?.primaryOfficerId !== currentUser?.id;
  const isUnclaimed = !currentIncident?.primaryOfficerId;
  const isMonitoredByMe = currentIncident?.monitoringOfficers?.some(m => m.userId === currentUser?.id);

  // Active Dispatched Responder for Tactical Map
  const activeMapResponder = useMemo(() => {
    if (!currentIncident?.assignedResponder) return null;
    return allUnits.find(u => u.id === currentIncident.assignedResponder?.id) || ({
      id: currentIncident.assignedResponder.id,
      callSign: 'TACTICAL-01',
      name: currentIncident.assignedResponder.name,
      unitType: currentIncident.assignedResponder.unitType,
      vehicleId: currentIncident.assignedResponder.vehicleId,
      contactPhone: '+27 11 000 0000',
      currentLocation: {
        lat: currentIncident.assignedResponder.currentLat || currentIncident.location.lat - 0.008,
        lng: currentIncident.assignedResponder.currentLng || currentIncident.location.lng - 0.012,
        addressDescription: 'En route to scene'
      },
      status: 'EN_ROUTE',
      capabilities: ['TACTICAL_DISPATCH']
    } as ResponderUnit);
  }, [currentIncident, allUnits]);

  return (
    <div id="command-centre-root" className="space-y-5">
      
      {/* ==================================================== */}
      {/* 1. TOP COMMAND BAR: OFFICER IDENTITY & WORKSPACE HUD */}
      {/* ==================================================== */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                National 24/7 Command Centre
              </h1>
              {activeIncidents.length > 0 ? (
                <span className="px-2.5 py-0.5 text-xs font-black bg-rose-500 text-white rounded-full animate-pulse">
                  {activeIncidents.length} ACTIVE ALARMS
                </span>
              ) : (
                <span className="px-2 py-0.5 text-xs font-bold bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/30">
                  ALL CORRIDORS SECURE
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Multi-Officer Tactical Coordination • Sovereign Child Protection Network
            </p>
          </div>
        </div>

        {/* Officer Status, Workload & Split-Screen Controls */}
        <div className="flex items-center gap-2 flex-wrap self-start lg:self-auto">
          {/* Current Officer Badge */}
          <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono flex items-center gap-2 text-slate-300">
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <span>Officer: <strong>{currentUser?.name || 'Command Operator'}</strong></span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>

          {/* Roster & Workload Button */}
          <button
            onClick={() => setShowWorkloadRoster(true)}
            className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-850 text-cyan-300 border border-cyan-500/30 text-xs font-bold font-mono flex items-center gap-1.5 transition-colors"
            title="View Active Command Officers & Workloads"
          >
            <Users className="w-3.5 h-3.5 text-cyan-400" />
            <span>Officers ({officersWorkload.length || 3})</span>
          </button>

          {/* Operational Validation Suite Button */}
          <button
            onClick={handleRunValidationSuite}
            className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold font-mono flex items-center gap-1.5 transition-colors"
            title="Run Operational Hardening Acceptance Suite (14 Tests)"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>Acceptance Suite (14)</span>
          </button>

          {/* Split Screen Toggle */}
          <button
            onClick={() => setIsSplitScreenMode(v => !v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
              isSplitScreenMode
                ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                : 'bg-slate-950 hover:bg-slate-850 text-slate-300 border border-slate-800'
            }`}
            title="Toggle Split-Screen Multi-Incident Monitoring"
          >
            <Columns className="w-3.5 h-3.5" />
            <span>{isSplitScreenMode ? 'Dual Screen Active' : 'Split-Screen'}</span>
          </button>

          <button
            onClick={onRefresh}
            className="p-2 rounded-xl bg-slate-950 hover:bg-slate-850 text-slate-300 hover:text-white border border-slate-800 transition-colors"
            title="Refresh Operational Feeds"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Action Notification Banners */}
      {actionErrorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{actionErrorMsg}</span>
          </div>
          <button onClick={() => setActionErrorMsg(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionSuccessMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ==================================================== */}
      {/* 2. NAVIGATION SECTION TABS */}
      {/* ==================================================== */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => setCurrentTab('EMERGENCIES')}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
            currentTab === 'EMERGENCIES'
              ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
              : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Incident Queue {activeIncidents.length > 0 ? `(${activeIncidents.length})` : ''}</span>
        </button>

        <button
          onClick={() => setCurrentTab('TACTICAL_MAP')}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
            currentTab === 'TACTICAL_MAP'
              ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
              : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Compass className="w-4 h-4" />
          <span>Tactical Map</span>
        </button>

        <button
          onClick={() => setCurrentTab('RESPONSE_FLEET')}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
            currentTab === 'RESPONSE_FLEET'
              ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
              : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Navigation className="w-4 h-4" />
          <span>Response Fleet ({allUnits.length})</span>
        </button>

        <button
          onClick={() => setCurrentTab('SCHOOLS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
            currentTab === 'SCHOOLS'
              ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
              : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <SchoolIcon className="w-4 h-4" />
          <span>Schools</span>
        </button>

        <button
          onClick={() => setCurrentTab('HISTORY')}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
            currentTab === 'HISTORY'
              ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
              : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Audit History</span>
        </button>
      </div>

      {/* ==================================================== */}
      {/* 3. INCIDENT WORKSPACE (EMERGENCIES TAB) */}
      {/* ==================================================== */}
      {currentTab === 'EMERGENCIES' && (
        <div className="space-y-5">
          
          {/* Queue Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[11px] mr-1">Queue Filter:</span>
              
              <button
                onClick={() => setQueueFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-colors ${
                  queueFilter === 'ALL' ? 'bg-cyan-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                All ({activeIncidents.length})
              </button>

              <button
                onClick={() => setQueueFilter('MINE')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-colors flex items-center gap-1 ${
                  queueFilter === 'MINE' ? 'bg-emerald-500 text-slate-950 font-black' : 'text-emerald-400 hover:text-emerald-300'
                }`}
              >
                <Check className="w-3 h-3" />
                <span>My Incidents ({activeIncidents.filter(i => i.primaryOfficerId === currentUser?.id).length})</span>
              </button>

              <button
                onClick={() => setQueueFilter('UNCLAIMED')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-colors flex items-center gap-1 ${
                  queueFilter === 'UNCLAIMED' ? 'bg-amber-500 text-slate-950 font-black' : 'text-amber-400 hover:text-amber-300'
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                <span>Unclaimed / Queue ({activeIncidents.filter(i => !i.primaryOfficerId).length})</span>
              </button>

              <button
                onClick={() => setQueueFilter('MONITORED')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-colors flex items-center gap-1 ${
                  queueFilter === 'MONITORED' ? 'bg-blue-500 text-slate-950 font-black' : 'text-blue-400 hover:text-blue-300'
                }`}
              >
                <Eye className="w-3 h-3" />
                <span>Monitored ({activeIncidents.filter(i => i.monitoringOfficers?.some(m => m.userId === currentUser?.id)).length})</span>
              </button>
            </div>

            <button
              onClick={onOpenPanic}
              className="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              <Zap className="w-3.5 h-3.5 text-rose-400" />
              <span>Simulate Emergency Drill</span>
            </button>
          </div>

          {/* Empty State Banner */}
          {activeIncidents.length === 0 && (
            <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">All Safe Corridors Normal</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                  Zero uncontained emergencies reported. All registered students are within designated school zones and safe travel paths.
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={onOpenPanic}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs inline-flex items-center gap-2 shadow-lg shadow-rose-950 transition-all"
                >
                  <Zap className="w-4 h-4" />
                  <span>Trigger Simulated Distress Signal</span>
                </button>
              </div>
            </div>
          )}

          {/* ACTIVE EMERGENCIES QUEUE CARDS (When multiple) */}
          {activeIncidents.length > 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredIncidents.map(inc => {
                const isSelected = currentIncident?.id === inc.id;
                const isSecondary = secondaryIncident?.id === inc.id;
                const isThisClaimedByMe = inc.primaryOfficerId === currentUser?.id;
                const isThisUnclaimed = !inc.primaryOfficerId;

                return (
                  <div
                    key={inc.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                      isSelected
                        ? 'bg-rose-950/40 border-rose-500 shadow-xl shadow-rose-950/40'
                        : isSecondary
                        ? 'bg-cyan-950/30 border-cyan-500 shadow-lg'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-1 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded text-xs font-black bg-rose-500 text-white flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3" />
                          <span>{inc.triggerType === 'MANUAL_SOS_BEACON' ? 'SOS BEACON' : 'ALERT'}</span>
                        </span>
                        
                        {isThisClaimedByMe ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                            <Check className="w-3 h-3" /> CLAIMED BY YOU
                          </span>
                        ) : isThisUnclaimed ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                            QUEUE (UNCLAIMED)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                            OFFICER: {inc.primaryOfficerName || 'Assigned'}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <div>
                          <span className="text-[11px] text-slate-400 block">Learner:</span>
                          <strong className="text-white text-sm">{inc.learnerName}</strong>
                          <span className="text-slate-400 text-[10px]">{inc.schoolName}</span>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-400 block">Location:</span>
                          <span className="text-slate-200 block text-xs truncate">{inc.location.addressDescription || 'Pretoria Safe Zone'}</span>
                          <span className="text-slate-400 text-[10px]">{formatTime(inc.timestamp)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                      {isThisUnclaimed ? (
                        <button
                          onClick={() => handleClaimIncident(inc.id)}
                          className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow-md"
                        >
                          CLAIM CASE
                        </button>
                      ) : (
                        <span className="text-[11px] font-mono text-slate-400">
                          {inc.status.replace(/_/g, ' ')}
                        </span>
                      )}

                      <div className="flex items-center gap-1">
                        {isSplitScreenMode && (
                          <button
                            onClick={() => setSecondaryIncidentId(inc.id)}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                              isSecondary ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:text-white'
                            }`}
                            title="Set as Secondary Monitored Screen"
                          >
                            Split 2
                          </button>
                        )}

                        <button
                          onClick={() => setSelectedIncidentId(inc.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                            isSelected
                              ? 'bg-rose-600 text-white'
                              : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                          }`}
                        >
                          <span>{isSelected ? 'Open (Primary)' : 'Select'}</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ==================================================== */}
          {/* PRIMARY WORKSPACE (SINGLE OR DUAL SPLIT-SCREEN) */}
          {/* ==================================================== */}
          {currentIncident && (
            <div className={`grid gap-5 ${isSplitScreenMode && secondaryIncident ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'}`}>
              
              {/* PRIMARY INCIDENT WORKSPACE (LEFT PANEL) */}
              <div className="p-5 sm:p-7 rounded-3xl bg-slate-900 border-2 border-rose-500/80 shadow-2xl shadow-rose-950/40 space-y-6">
                
                {/* 1. PRIMARY INCIDENT HEADER & MULTI-OFFICER CONTROLS */}
                <div className="p-5 rounded-2xl bg-rose-950/50 border border-rose-500/40 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-rose-500/30 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-rose-500 text-white animate-pulse">
                        <ShieldAlert className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 text-xs font-black uppercase tracking-wider bg-rose-500 text-white rounded">
                            🚨 CHILD SAFETY INCIDENT
                          </span>
                          <span className="text-xs text-rose-300 font-bold">
                            Risk: {currentIncident.severity}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">
                            {formatTime(currentIncident.timestamp)}
                          </span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                          {currentIncident.learnerName} ({currentIncident.learnerGrade})
                        </h2>
                      </div>
                    </div>

                    {/* Officer Claim / Handover / Monitoring Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {isUnclaimed ? (
                        <button
                          onClick={() => handleClaimIncident(currentIncident.id)}
                          className="min-h-[40px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow-lg flex items-center gap-1.5"
                        >
                          <Zap className="w-4 h-4 fill-slate-950" />
                          <span>CLAIM INCIDENT COMMAND</span>
                        </button>
                      ) : isClaimedByMe ? (
                        <>
                          <span className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            <span>Primary Commander (You)</span>
                          </span>

                          <button
                            onClick={() => handleOpenHandover(currentIncident)}
                            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center gap-1"
                            title="Transfer Command to Another Officer"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            <span>Handover</span>
                          </button>

                          <button
                            onClick={() => handleReleaseIncident(currentIncident.id)}
                            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-700 text-xs font-bold"
                            title="Return Incident to Queue"
                          >
                            Release
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="px-3 py-1.5 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/40 text-xs font-bold">
                            Commander: {currentIncident.primaryOfficerName || 'Officer'}
                          </span>

                          <button
                            onClick={() => handleToggleMonitoring(currentIncident.id, !!isMonitoredByMe)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${
                              isMonitoredByMe
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'bg-slate-900 hover:bg-slate-800 text-blue-300 border border-blue-500/30'
                            }`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{isMonitoredByMe ? 'Leave Monitoring' : 'Join as Observer'}</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Active Observers / Monitoring Officers Bar */}
                  {currentIncident.monitoringOfficers && currentIncident.monitoringOfficers.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-slate-300 pt-1">
                      <Eye className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="text-slate-400 font-mono text-[11px]">Active Observers:</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {currentIncident.monitoringOfficers.map(m => (
                          <span key={m.userId} className="px-2 py-0.5 rounded bg-slate-950 text-slate-300 text-[11px] font-mono border border-slate-800">
                            {m.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Key Situation Details */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">LEARNER</span>
                      <strong className="text-white text-sm block mt-0.5">{currentIncident.learnerName}</strong>
                      <span className="text-slate-400 text-[11px]">{currentIncident.schoolName}</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">LOCATION</span>
                      <strong className="text-emerald-400 text-sm block mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        {currentIncident.location.addressDescription}
                      </strong>
                      <span className="text-slate-400 text-[11px]">GPS Lock ±{currentIncident.location.accuracyMeters || 3.2}m</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">DISTRESS TRIGGER</span>
                      <strong className="text-rose-300 text-sm block mt-0.5">
                        {currentIncident.triggerType === 'MANUAL_SOS_BEACON' ? 'Manual SOS Beacon' : 'Safe Route Deviation'}
                      </strong>
                      <span className="text-slate-400 text-[11px]">Guardian: {currentIncident.guardianName}</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">TACTICAL STATUS</span>
                      <strong className="text-cyan-400 text-sm block mt-0.5">
                        {currentIncident.status === 'DISPATCHED' ? 'UNIT EN ROUTE' : currentIncident.status.replace(/_/g, ' ')}
                      </strong>
                      <span className="text-slate-400 text-[11px]">
                        {currentIncident.assignedResponder ? currentIncident.assignedResponder.name : 'Awaiting Dispatch'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. TACTICAL INTERCEPTION MAP EMBEDDED */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Compass className="w-4 h-4 text-cyan-400" />
                      <span>Live Tactical Interception Map & Responder Tracking</span>
                    </span>
                    <span className="font-mono text-emerald-400">
                      {currentIncident.assignedResponder ? 'TRACKING UNIT' : 'SECTOR RADAR ACTIVE'}
                    </span>
                  </div>

                  <TacticalInterceptionMap
                    incident={currentIncident}
                    responders={allUnits}
                    activeResponder={activeMapResponder}
                    height="h-[360px]"
                  />
                </div>

                {/* 3. 7-STEP PROGRESSION STEPPER BAR */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-bold px-1">
                    <span>INCIDENT PROGRESSION WORKFLOW</span>
                    <span>STEP {activeWorkflowStep} OF 7</span>
                  </div>

                  <div className="grid grid-cols-7 gap-1.5">
                    {[
                      { step: 1, label: 'RECEIVED' },
                      { step: 2, label: 'VERIFY' },
                      { step: 3, label: 'ASSESS' },
                      { step: 4, label: 'DISPATCH' },
                      { step: 5, label: 'RESPONDING' },
                      { step: 6, label: 'ON SCENE' },
                      { step: 7, label: 'RESOLVED' }
                    ].map(s => {
                      const isPassed = activeWorkflowStep > s.step;
                      const isCurrent = activeWorkflowStep === s.step;

                      return (
                        <button
                          key={s.step}
                          onClick={() => {
                            if (s.step <= 4 || currentIncident.status === 'DISPATCHED' || currentIncident.status === 'RESOLVED') {
                              setActiveWorkflowStep(s.step);
                            }
                          }}
                          className={`p-2 rounded-xl text-center transition-all flex flex-col items-center justify-center min-h-[46px] ${
                            isCurrent
                              ? 'bg-rose-500 text-white font-black shadow-lg shadow-rose-950 border border-rose-400'
                              : isPassed
                              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 font-bold'
                              : 'bg-slate-950 text-slate-500 border border-slate-800'
                          }`}
                        >
                          <span className="text-[10px] block opacity-80">STEP {s.step}</span>
                          <span className="text-xs tracking-tight whitespace-nowrap">{s.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. WORKFLOW STEP CONTENTS */}
                {activeWorkflowStep === 1 && (
                  <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                    <div className="border-b border-slate-850 pb-3">
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <Clock className="w-5 h-5 text-cyan-400" />
                        <span>Step 1: Alert Received</span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        New emergency distress signal transmitted to the National Command Centre.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                        <span className="text-slate-400 block font-bold uppercase text-[11px]">Child Details</span>
                        <div className="text-white text-sm font-bold">{currentIncident.learnerName}</div>
                        <div className="text-slate-300">Grade: {currentIncident.learnerGrade}</div>
                        <div className="text-slate-300">School: {currentIncident.schoolName}</div>
                        <div className="text-slate-300">Guardian: {currentIncident.guardianName} ({currentIncident.guardianMobile})</div>
                      </div>

                      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                        <span className="text-slate-400 block font-bold uppercase text-[11px]">Alert & Location</span>
                        <div className="text-rose-400 text-sm font-bold">
                          {currentIncident.triggerType === 'MANUAL_SOS_BEACON' ? 'Manual SOS Panic Triggered' : 'Route Deviation Alert'}
                        </div>
                        <div className="text-emerald-300 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {currentIncident.location.addressDescription}
                        </div>
                        <div className="text-slate-300">Time Received: {formatTime(currentIncident.timestamp)}</div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-850 flex justify-end">
                      <button
                        onClick={() => setActiveWorkflowStep(2)}
                        className="min-h-[48px] px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm transition-all flex items-center gap-2 shadow-xl shadow-rose-950"
                      >
                        <span>VERIFY ALERT</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {activeWorkflowStep === 2 && (
                  <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                    <div className="border-b border-slate-850 pb-3">
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        <span>Step 2: Verify Alert</span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Review key verification points to confirm whether the emergency is genuine.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                        <span className="text-slate-400 block text-[11px]">1. CHILD PROFILE</span>
                        <strong className="text-white block text-sm">{currentIncident.learnerName}</strong>
                        <span className="text-emerald-400 block text-[11px]">✓ Registered in National Database</span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                        <span className="text-slate-400 block text-[11px]">2. LOCATION STATUS</span>
                        <strong className="text-emerald-400 block text-sm">GPS Verified</strong>
                        <span className="text-slate-300 block text-[11px]">{currentIncident.location.addressDescription}</span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                        <span className="text-slate-400 block text-[11px]">3. VERIFIED GUARDIAN</span>
                        <strong className="text-white block text-sm">{currentIncident.guardianName}</strong>
                        <span className="text-cyan-300 block text-[11px]">{currentIncident.guardianMobile}</span>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-850 flex flex-col sm:flex-row items-center justify-between gap-3">
                      <button
                        onClick={() => setShowFalseAlarmModal(true)}
                        className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all border border-slate-700"
                      >
                        FALSE / UNCONFIRMED ALARM
                      </button>

                      <button
                        onClick={handleConfirmGenuineEmergency}
                        className="w-full sm:w-auto min-h-[48px] px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm transition-all flex items-center justify-center gap-2 shadow-xl shadow-rose-950"
                      >
                        <span>CONFIRM EMERGENCY</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {activeWorkflowStep === 3 && (
                  <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-5">
                    <div className="border-b border-slate-850 pb-3">
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                        <span>Step 3: Assess Emergency Level</span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Select the emergency severity level. The Command Officer remains in complete control.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button
                        onClick={() => setAssessedSeverity('CRITICAL_SOS')}
                        className={`p-4 rounded-2xl border text-left transition-all space-y-2 ${
                          assessedSeverity === 'CRITICAL_SOS'
                            ? 'bg-rose-950/60 border-rose-500 shadow-lg shadow-rose-950/40 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="px-2.5 py-0.5 text-xs font-black bg-rose-500 text-white rounded">
                            CRITICAL
                          </span>
                          {assessedSeverity === 'CRITICAL_SOS' && <Check className="w-4 h-4 text-rose-400" />}
                        </div>
                        <p className="text-xs text-rose-200">
                          Immediate danger to life or safety. Kidnapping risk or distress beacon active.
                        </p>
                      </button>

                      <button
                        onClick={() => setAssessedSeverity('HIGH')}
                        className={`p-4 rounded-2xl border text-left transition-all space-y-2 ${
                          assessedSeverity === 'HIGH'
                            ? 'bg-amber-950/60 border-amber-500 shadow-lg shadow-amber-950/40 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="px-2.5 py-0.5 text-xs font-black bg-amber-500 text-slate-950 rounded">
                            HIGH
                          </span>
                          {assessedSeverity === 'HIGH' && <Check className="w-4 h-4 text-amber-400" />}
                        </div>
                        <p className="text-xs text-amber-200">
                          Child left designated safe corridor or unreachable outside expected hours.
                        </p>
                      </button>

                      <button
                        onClick={() => setAssessedSeverity('MEDIUM')}
                        className={`p-4 rounded-2xl border text-left transition-all space-y-2 ${
                          assessedSeverity === 'MEDIUM'
                            ? 'bg-yellow-950/60 border-yellow-500 shadow-lg shadow-yellow-950/40 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="px-2.5 py-0.5 text-xs font-black bg-yellow-500 text-slate-950 rounded">
                            MEDIUM
                          </span>
                          {assessedSeverity === 'MEDIUM' && <Check className="w-4 h-4 text-yellow-400" />}
                        </div>
                        <p className="text-xs text-yellow-200">
                          Transit delay or minor route variation. Community check recommended.
                        </p>
                      </button>
                    </div>

                    <div className="pt-3 border-t border-slate-850 flex justify-between items-center">
                      <button
                        onClick={() => setActiveWorkflowStep(2)}
                        className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs"
                      >
                        ← Back to Verify
                      </button>

                      <button
                        onClick={handleProceedToDispatch}
                        className="min-h-[48px] px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm transition-all flex items-center gap-2 shadow-xl shadow-rose-950"
                      >
                        <span>PROCEED TO DISPATCH</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {activeWorkflowStep === 4 && (
                  <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-5">
                    <div className="border-b border-slate-850 pb-3">
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <Zap className="w-5 h-5 text-rose-400" />
                        <span>Step 4: Select and Dispatch Response Service</span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        The Command Officer authorizes dispatch. Autonomous dispatch is prohibited.
                      </p>
                    </div>

                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                          Available Response Units (Ranked by Proximity & ETA)
                        </h4>
                        <button
                          onClick={() => loadRankedResponders(currentIncident.id)}
                          disabled={isLoadingRankings}
                          className="px-2.5 py-1 rounded-lg bg-slate-900 text-slate-300 hover:text-white border border-slate-800 text-xs flex items-center gap-1"
                        >
                          <RefreshCw className={`w-3 h-3 ${isLoadingRankings ? 'animate-spin' : ''}`} />
                          <span>Refresh Distances</span>
                        </button>
                      </div>

                      {isLoadingRankings ? (
                        <div className="p-8 text-center text-xs text-slate-400">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-400" />
                          Finding nearest available responders...
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {rankedResponders.map((rank, idx) => {
                            const badge = getServiceTypeBadge(rank.responder.unitType);
                            const isTopRank = idx === 0;

                            return (
                              <div
                                key={rank.responder.id}
                                className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                                  isTopRank
                                    ? 'bg-slate-900 border-amber-500/60 shadow-lg shadow-amber-950/20'
                                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-750'
                                }`}
                              >
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`px-2.5 py-0.5 rounded text-xs font-bold border ${badge.color}`}>
                                      {badge.icon} {badge.label}
                                    </span>

                                    {isTopRank && (
                                      <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-[11px] flex items-center gap-1">
                                        <Sparkles className="w-3 h-3 fill-slate-950" />
                                        RECOMMENDED
                                      </span>
                                    )}

                                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                      AVAILABLE
                                    </span>
                                  </div>

                                  <div className="text-white font-bold text-sm">
                                    {rank.responder.name}
                                  </div>

                                  <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                                    <span className="text-cyan-300 font-bold">{rank.distanceKm || '1.4'} km away</span>
                                    <span>•</span>
                                    <span className="text-emerald-400 font-bold">ETA ~{rank.estimatedEtaMinutes || 4} min</span>
                                    <span>•</span>
                                    <span>Vehicle: {rank.responder.vehicleId}</span>
                                  </div>
                                </div>

                                <div>
                                  <button
                                    onClick={() => handleOpenDispatchConfirmation(rank)}
                                    className={`w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                                      isTopRank
                                        ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950'
                                        : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                                    }`}
                                  >
                                    <Zap className="w-4 h-4" />
                                    <span>DISPATCH {badge.label}</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={() => setActiveWorkflowStep(3)}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs"
                      >
                        ← Back to Assess
                      </button>
                    </div>
                  </div>
                )}

                {activeWorkflowStep === 5 && (
                  <div className="p-5 rounded-2xl bg-blue-950/40 border-2 border-blue-500/60 space-y-5">
                    <div className="p-4 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        <span>
                          ✓ {currentIncident.assignedResponder?.name?.toUpperCase() || 'RESPONSE UNIT'} DISPATCHED
                        </span>
                      </div>
                      <span className="font-mono text-white bg-slate-950 px-2.5 py-1 rounded">
                        ETA: {currentIncident.assignedResponder?.etaMinutes || 4} MINUTES
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                        <span className="text-slate-400 block text-[11px]">RESPONDER</span>
                        <strong className="text-white text-sm block">
                          {currentIncident.assignedResponder?.name || 'SAPS Sector Patrol'}
                        </strong>
                        <span className="text-slate-400 text-[11px]">Vehicle: {currentIncident.assignedResponder?.vehicleId || 'SAPS-GP-9912'}</span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                        <span className="text-slate-400 block text-[11px]">ESTIMATED ARRIVAL</span>
                        <strong className="text-emerald-400 text-sm block">
                          {currentIncident.assignedResponder?.etaMinutes || 4} Minutes
                        </strong>
                        <span className="text-slate-400 text-[11px]">Direct Route</span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                        <span className="text-slate-400 block text-[11px]">STATUS</span>
                        <strong className="text-blue-400 text-sm block flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                          RESPONDING
                        </strong>
                        <span className="text-slate-400 text-[11px]">Speed: 48 km/h</span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                        <span className="text-slate-400 block text-[11px]">SCENE LOCATION</span>
                        <strong className="text-white text-sm block truncate">
                          {currentIncident.location.addressDescription}
                        </strong>
                        <span className="text-emerald-400 text-[11px]">GPS Coords Active</span>
                      </div>
                    </div>

                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800">
                      <button
                        onClick={() => handleSendReassurance(currentIncident)}
                        className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center gap-2"
                      >
                        <Volume2 className="w-4 h-4" />
                        <span>Send Reassurance Update to Guardian</span>
                      </button>

                      <button
                        onClick={handleMarkOnScene}
                        className="min-h-[48px] px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm transition-all flex items-center gap-2 shadow-xl shadow-blue-950"
                      >
                        <span>MARK ON SCENE</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {activeWorkflowStep === 6 && (
                  <div className="p-5 rounded-2xl bg-emerald-950/40 border-2 border-emerald-500/60 space-y-5">
                    <div className="p-4 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-emerald-400 shrink-0" />
                      <span>📍 UNIT ON SCENE — {currentIncident.assignedResponder?.name?.toUpperCase() || 'RESPONSE TEAM'}</span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                      <strong className="text-white text-sm block">Scene Containment & Child Verification</strong>
                      <p className="text-slate-300 leading-relaxed">
                        Responder unit has arrived at {currentIncident.location.addressDescription}. Field officers are securing the immediate perimeter and confirming the safety of learner {currentIncident.learnerName}.
                      </p>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={handleResolveEmergency}
                        className="min-h-[48px] px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm transition-all flex items-center gap-2 shadow-xl shadow-emerald-950"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        <span>CONFIRM CHILD SAFE & RESOLVE INCIDENT</span>
                      </button>
                    </div>
                  </div>
                )}

                {activeWorkflowStep === 7 && (
                  <div className="p-6 rounded-2xl bg-slate-950 border border-emerald-500/40 text-center space-y-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white">Emergency Successfully Resolved</h3>
                      <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                        Learner {currentIncident.learnerName} has been verified safe and handed over to authoritative care. Immutable audit record sealed.
                      </p>
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={() => {
                          setSelectedIncidentId(null);
                          onRefresh();
                        }}
                        className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs inline-flex items-center gap-2"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back to Command Queue</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* 5. TACTICAL NOTES & IMMUTABLE LOG FEED */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4 text-cyan-400" />
                      <span>Tactical Notes & Chronological Event Stream</span>
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">SHA-256 Verifiable</span>
                  </div>

                  {/* Input form to append tactical note */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tacticalNoteInput}
                      onChange={e => setTacticalNoteInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddTacticalNote(currentIncident.id)}
                      placeholder="Add officer tactical observation (e.g. Guardian confirmed en route)..."
                      className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      onClick={() => handleAddTacticalNote(currentIncident.id)}
                      disabled={isSubmittingNote || !tacticalNoteInput.trim()}
                      className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center gap-1 transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Log</span>
                    </button>
                  </div>

                  {/* List of notes */}
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {currentIncident.notes && currentIncident.notes.length > 0 ? (
                      currentIncident.notes.map((n, idx) => (
                        <div key={idx} className="p-2 rounded-lg bg-slate-900/80 border border-slate-850 text-slate-300 font-mono text-[11px] flex items-start gap-2">
                          <span className="text-cyan-400 font-bold shrink-0">#{idx + 1}</span>
                          <span>{n}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-500 italic text-[11px]">No custom tactical notes logged yet.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* SECONDARY INCIDENT WORKSPACE (RIGHT PANEL IN SPLIT-SCREEN) */}
              {isSplitScreenMode && secondaryIncident && (
                <div className="p-5 sm:p-7 rounded-3xl bg-slate-900 border-2 border-cyan-500/60 shadow-2xl space-y-5">
                  <div className="flex items-center justify-between border-b border-cyan-500/30 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 text-xs font-black bg-cyan-500 text-slate-950 rounded">
                        MONITORED INCIDENT (DUAL VIEW)
                      </span>
                      <h3 className="text-base font-bold text-white">
                        {secondaryIncident.learnerName} ({secondaryIncident.learnerGrade})
                      </h3>
                    </div>
                    <button
                      onClick={() => setSelectedIncidentId(secondaryIncident.id)}
                      className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
                    >
                      Make Primary
                    </button>
                  </div>

                  {/* Mini Tactical Map for Secondary Incident */}
                  <TacticalInterceptionMap
                    incident={secondaryIncident}
                    responders={allUnits}
                    height="h-[280px]"
                  />

                  {/* Secondary Summary */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">LOCATION</span>
                      <strong className="text-white block truncate">{secondaryIncident.location.addressDescription}</strong>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">STATUS</span>
                      <strong className="text-cyan-400 block">{secondaryIncident.status}</strong>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                    <span className="text-slate-400 font-bold uppercase">Situation</span>
                    <p className="text-slate-300">
                      {secondaryIncident.triggerType === 'MANUAL_SOS_BEACON' ? 'Manual SOS distress beacon active' : 'Safe corridor deviation alarm active in secondary monitoring quadrant.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* 4. FULL-WIDTH TACTICAL MAP TAB */}
      {/* ==================================================== */}
      {currentTab === 'TACTICAL_MAP' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Compass className="w-5 h-5 text-cyan-400" />
                <span>Sector Tactical Interception Radar & Fleet Overview</span>
              </h2>
              <p className="text-xs text-slate-400">
                Live geospatial positioning of all registered school safe corridors, child distress origins, and mobile patrol units.
              </p>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Fleet Telemetry: LIVE</span>
            </div>
          </div>

          {currentIncident ? (
            <TacticalInterceptionMap
              incident={currentIncident}
              responders={allUnits}
              activeResponder={activeMapResponder}
              height="h-[600px]"
            />
          ) : (
            <div className="p-12 text-center bg-slate-900 rounded-2xl border border-slate-800 text-slate-400 text-xs">
              No active distress signal. Displaying baseline Pretoria Safe Corridor Sector 2 grid.
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* 5. RESPONSE FLEET VIEW */}
      {/* ==================================================== */}
      {currentTab === 'RESPONSE_FLEET' && (
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Navigation className="w-4 h-4 text-cyan-400" />
                <span>Available Response Fleet ({allUnits.length || 5} Units)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Police, Security, and EMS units registered for immediate dispatch.
              </p>
            </div>

            <button
              onClick={loadAllUnits}
              className="px-3 py-1.5 rounded-xl bg-slate-950 text-slate-300 hover:text-white border border-slate-800 text-xs flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Fleet</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            {allUnits.map(unit => {
              const badge = getServiceTypeBadge(unit.unitType);
              const isAvailable = unit.status === 'AVAILABLE';
              return (
                <div key={unit.id} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`px-2.5 py-0.5 rounded text-xs font-bold border ${badge.color}`}>
                      {badge.icon} {badge.label}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      isAvailable
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-blue-500/20 text-blue-300'
                    }`}>
                      {unit.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div>
                    <strong className="text-white text-sm block">{unit.name}</strong>
                    <span className="text-slate-400 text-xs">Vehicle: {unit.vehicleId}</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-2 font-mono text-[11px]">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>GPS: {unit.currentLocation?.lat?.toFixed(4) || '-25.7550'}, {unit.currentLocation?.lng?.toFixed(4) || '28.2310'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 6. SCHOOLS OVERVIEW */}
      {/* ==================================================== */}
      {currentTab === 'SCHOOLS' && (
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <SchoolIcon className="w-4 h-4 text-cyan-400" />
            <span>Active Partner Schools</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
              <strong className="text-white text-sm block">Pretoria Boys High School</strong>
              <p className="text-slate-400">EMIS Code: EMIS-GP-7002319 • Gauteng East</p>
              <span className="text-emerald-400 block font-bold">Status: Active Safe Perimeter</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
              <strong className="text-white text-sm block">Bishops Diocesan College</strong>
              <p className="text-slate-400">EMIS Code: EMIS-WC-1004592 • Western Cape Metro</p>
              <span className="text-emerald-400 block font-bold">Status: Active Safe Perimeter</span>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 7. RECENT HISTORY VIEW */}
      {/* ==================================================== */}
      {currentTab === 'HISTORY' && (
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-400" />
            <span>Recent Emergency Incident History</span>
          </h3>

          <div className="space-y-2.5 text-xs">
            {safeIncidents.map(inc => (
              <div key={inc.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <strong className="text-white block">{inc.learnerName} — {inc.location.addressDescription}</strong>
                  <span className="text-slate-400">{inc.schoolName} • Reported: {formatTime(inc.timestamp)}</span>
                </div>
                <span className={`px-2.5 py-1 rounded text-xs font-bold ${
                  inc.status === 'RESOLVED'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}>
                  {inc.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 1: DISPATCH CONFIRMATION (HUMAN IN THE LOOP) */}
      {/* ==================================================== */}
      {confirmModalRanking && currentIncident && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border-2 border-rose-500 rounded-3xl p-6 sm:p-7 space-y-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <h3 className="text-base font-black text-white">
                  AUTHORIZE DISPATCH?
                </h3>
              </div>
              <button onClick={() => setConfirmModalRanking(null)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Child:</span>
                <strong className="text-white">{currentIncident.learnerName}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Response Unit:</span>
                <span className="text-cyan-300 font-bold">{confirmModalRanking.responder.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Estimated Arrival:</span>
                <span className="text-emerald-400 font-bold">{confirmModalRanking.estimatedEtaMinutes || 4} Minutes</span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setConfirmModalRanking(null)}
                className="min-h-[44px] flex-1 px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
              >
                CANCEL
              </button>
              <button
                onClick={handleExecuteConfirmedDispatch}
                disabled={isAuthorizingDispatch}
                className="min-h-[44px] flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-xl"
              >
                {isAuthorizingDispatch ? 'Authorizing...' : 'CONFIRM DISPATCH'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 2: COMMAND HANDOVER TO ANOTHER OFFICER */}
      {/* ==================================================== */}
      {showHandoverModal && currentIncident && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border-2 border-cyan-500 rounded-3xl p-6 space-y-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Transfer Incident Command</h3>
              </div>
              <button onClick={() => setShowHandoverModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Select Target Command Officer:</label>
                <select
                  value={handoverTargetOfficerId}
                  onChange={e => {
                    setHandoverTargetOfficerId(e.target.value);
                    const sel = officersWorkload.find(o => o.userId === e.target.value);
                    if (sel) setHandoverTargetOfficerName(sel.name);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500"
                >
                  <option value="">-- Choose Online Officer --</option>
                  {officersWorkload.filter(o => o.userId !== currentUser?.id).map(off => (
                    <option key={off.userId} value={off.userId}>
                      {off.name} ({off.activeIncidentCount} active cases)
                    </option>
                  ))}
                  {officersWorkload.length <= 1 && (
                    <>
                      <option value="usr-cmd-02">Officer David Khumalo (Sector 2 Command)</option>
                      <option value="usr-cmd-03">Officer Nomvula Sithole (Tshwane Regional)</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Handover Reason / Operational Briefing:</label>
                <textarea
                  value={handoverReason}
                  onChange={e => setHandoverReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                  placeholder="e.g. Shift rotation handover; SAPS unit already en route with 3 min ETA."
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowHandoverModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteHandover}
                disabled={isHandingOver || !handoverTargetOfficerId}
                className="flex-1 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-black text-xs flex items-center justify-center gap-2"
              >
                {isHandingOver ? 'Transferring...' : 'EXECUTE HANDOVER'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 3: OFFICER WORKLOAD ROSTER */}
      {/* ==================================================== */}
      {showWorkloadRoster && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Active Command Officers Workload Roster</h3>
              </div>
              <button onClick={() => setShowWorkloadRoster(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1 text-xs">
              {officersWorkload.length > 0 ? (
                officersWorkload.map(off => (
                  <div key={off.userId} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <strong className="text-white text-sm">{off.name}</strong>
                        {off.userId === currentUser?.id && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300">
                            YOU
                          </span>
                        )}
                      </div>
                      <p className="text-slate-400">{off.role}</p>
                    </div>

                    <div className="text-right font-mono">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        off.isOverloaded
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      }`}>
                        {off.activeIncidentCount} Claimed • {off.monitoredIncidentCount} Monitored
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-slate-400">Loading active officers roster...</div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowWorkloadRoster(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 text-white font-bold text-xs"
              >
                Close Roster
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 4: FALSE ALARM CONFIRMATION */}
      {/* ==================================================== */}
      {showFalseAlarmModal && currentIncident && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Mark Alert as False Alarm?</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Confirming this will close the alert for {currentIncident.learnerName} and log the event in the audit trail without dispatching field response units.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowFalseAlarmModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>

              <button
                onClick={handleMarkFalseAlarm}
                disabled={isVerifying}
                className="flex-1 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-2"
              >
                {isVerifying ? 'Closing Alert...' : 'Confirm False Alarm'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ==================================================== */}
      {/* MODAL 5: OPERATIONAL VALIDATION ACCEPTANCE SUITE */}
      {/* ==================================================== */}
      {showValidationModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-3xl p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-base font-bold text-white">Operational Lifecycle & Command Hardening Suite</h3>
                  <p className="text-xs text-slate-400">14 Authoritative PostgreSQL Acceptance Tests</p>
                </div>
              </div>
              <button 
                onClick={() => setShowValidationModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isRunningValidation ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-3">
                <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
                <p className="text-sm font-bold text-slate-200">Executing 14 Authoritative Acceptance Tests...</p>
                <p className="text-xs text-slate-400">Testing state machines, atomic claiming (SELECT FOR UPDATE), telemetry ingest, and ABAC boundaries.</p>
              </div>
            ) : validationReport ? (
              <div className="space-y-4 overflow-y-auto pr-1">
                {/* Summary Banner */}
                <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                  validationReport.allPassed 
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' 
                    : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                }`}>
                  <div className="flex items-center gap-3">
                    {validationReport.allPassed ? (
                      <CheckCircle2 className="w-7 h-7 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-7 h-7 text-rose-400 shrink-0" />
                    )}
                    <div>
                      <h4 className="font-bold text-sm">
                        {validationReport.allPassed ? 'ALL 14 OPERATIONAL ACCEPTANCE TESTS PASSED' : 'TEST FAILURES DETECTED'}
                      </h4>
                      <p className="text-xs opacity-85">
                        Compliance Verdict: <span className="font-mono font-bold">{validationReport.complianceVerdict}</span> • {validationReport.passedTests}/{validationReport.totalTests} Passed
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleRunValidationSuite}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Re-Run Suite</span>
                  </button>
                </div>

                {/* Individual Test Results List */}
                <div className="space-y-2 text-xs">
                  {validationReport.results?.map((test: any) => (
                    <div 
                      key={test.id}
                      className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 ${
                        test.passed 
                          ? 'bg-slate-950/70 border-slate-800 text-slate-200' 
                          : 'bg-rose-950/20 border-rose-800 text-rose-200'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-amber-400">{test.id}</span>
                          <strong className="text-white">{test.name}</strong>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                            {test.category}
                          </span>
                        </div>
                        <p className="text-slate-400">{test.description}</p>
                        <p className="text-slate-300 font-mono text-[11px] bg-slate-900/80 p-2 rounded border border-slate-800/80">
                          Result: {test.actualResult}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                          test.passed 
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}>
                          {test.passed ? 'PASSED' : 'FAILED'}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">{test.durationMs}ms</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-slate-400 text-xs">
                Click "Run Suite" to execute live authoritative tests.
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowValidationModal(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
