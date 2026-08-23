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
  Volume2
} from 'lucide-react';
import { 
  IncidentAlert, 
  HydratedLearnerRecord, 
  EligibleResponderRanking, 
  ResponderUnit,
  IncidentSeverity,
  IncidentStatus
} from '../types.js';
import { api } from '../services/api.js';

export type CommandSection = 
  | 'EMERGENCIES'
  | 'RESPONSE_FLEET'
  | 'SCHOOLS'
  | 'HISTORY';

interface Props {
  incidents: IncidentAlert[];
  learners: HydratedLearnerRecord[];
  onRefresh: () => void;
  onOpenEnrolment: () => void;
  onOpenPanic: () => void;
  activeSection?: CommandSection;
  onNavigateToResponder?: () => void;
}

export const CommandCentre: React.FC<Props> = ({
  incidents = [],
  learners = [],
  onRefresh,
  onOpenEnrolment,
  onOpenPanic,
  activeSection = 'EMERGENCIES',
  onNavigateToResponder
}) => {
  const safeIncidents = useMemo(() => Array.isArray(incidents) ? incidents : [], [incidents]);
  const safeLearners = useMemo(() => Array.isArray(learners) ? learners : [], [learners]);

  const [currentTab, setCurrentTab] = useState<CommandSection>(activeSection);
  
  // Selected incident tracking by ID (stable against background polling)
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  // Workflow Progression State for Active Incident (Step 1 to Step 7)
  // 1: RECEIVED, 2: VERIFY, 3: ASSESS, 4: DISPATCH, 5: RESPONDING, 6: ON SCENE, 7: RESOLVED
  const [activeWorkflowStep, setActiveWorkflowStep] = useState<number>(1);
  const [assessedSeverity, setAssessedSeverity] = useState<IncidentSeverity>('CRITICAL_SOS');
  const [reassuranceSent, setReassuranceSent] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Ranked Eligible Responders State
  const [rankedResponders, setRankedResponders] = useState<EligibleResponderRanking[]>([]);
  const [allUnits, setAllUnits] = useState<ResponderUnit[]>([]);
  const [isLoadingRankings, setIsLoadingRankings] = useState(false);
  const [dispatchSuccessMsg, setDispatchSuccessMsg] = useState<string | null>(null);

  // Explicit Human Authorization Dispatch Confirmation Modal
  const [confirmModalRanking, setConfirmModalRanking] = useState<EligibleResponderRanking | null>(null);
  const [isAuthorizingDispatch, setIsAuthorizingDispatch] = useState(false);

  // False Alarm Confirmation Modal
  const [showFalseAlarmModal, setShowFalseAlarmModal] = useState(false);

  // Derive active emergencies
  const activeIncidents = useMemo(() => 
    safeIncidents.filter(i => i.status !== 'RESOLVED'),
    [safeIncidents]
  );

  // Resolve current active incident object
  const currentIncident = useMemo(() => {
    if (selectedIncidentId) {
      const found = safeIncidents.find(i => i.id === selectedIncidentId);
      if (found) return found;
    }
    // Default to the first active emergency, or first available incident
    return activeIncidents[0] || safeIncidents[0] || null;
  }, [selectedIncidentId, safeIncidents, activeIncidents]);

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
      // Incident is ACTIVE_ALARM: keep whatever sub-step 1, 2, 3, or 4 the officer is on
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

  // Execute Human Authorized Dispatch (Only authorized officer can trigger)
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
        note: `Command Officer authorized emergency dispatch for ${confirmModalRanking.responder.name}.`,
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
    setActiveWorkflowStep(6); // Move to Step 6: ON SCENE
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
    setActiveWorkflowStep(7); // Move to Step 7: RESOLVED
    onRefresh();
  };

  // Helper for responder type icon and label
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

  // Format time display
  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '10:42';
    }
  };

  return (
    <div id="command-centre-root" className="space-y-6">
      
      {/* ==================================================== */}
      {/* 1. TOP COMMAND BAR & NAVIGATION */}
      {/* ==================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>Emergency Response Command</span>
              {activeIncidents.length > 0 ? (
                <span className="px-2.5 py-0.5 text-xs font-black bg-rose-500 text-white rounded-full animate-pulse">
                  {activeIncidents.length} ACTIVE
                </span>
              ) : (
                <span className="px-2 py-0.5 text-xs font-bold bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/30">
                  ALL CLEAR
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-400">
              National Child Protection Dispatch • Human-Authorized Rapid Coordination
            </p>
          </div>
        </div>

        {/* View Switchers */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setCurrentTab('EMERGENCIES')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              currentTab === 'EMERGENCIES'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Emergencies {activeIncidents.length > 0 ? `(${activeIncidents.length})` : ''}</span>
          </button>

          <button
            onClick={() => setCurrentTab('RESPONSE_FLEET')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              currentTab === 'RESPONSE_FLEET'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Navigation className="w-4 h-4" />
            <span>Available Responders</span>
          </button>

          <button
            onClick={() => setCurrentTab('SCHOOLS')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              currentTab === 'SCHOOLS'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <SchoolIcon className="w-4 h-4" />
            <span>Schools</span>
          </button>

          <button
            onClick={() => setCurrentTab('HISTORY')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              currentTab === 'HISTORY'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>History</span>
          </button>
        </div>
      </div>

      {/* ==================================================== */}
      {/* 2. MAIN EMERGENCIES WORKSPACE */}
      {/* ==================================================== */}
      {currentTab === 'EMERGENCIES' && (
        <div className="space-y-6">
          
          {/* No active emergencies banner */}
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
                  <span>Simulate Emergency Alert</span>
                </button>
              </div>
            </div>
          )}

          {/* List of Primary Incident Cards (If multiple active) */}
          {activeIncidents.length > 1 && (
            <div className="space-y-3">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Active Emergencies ({activeIncidents.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {activeIncidents.map(inc => {
                  const isSelected = currentIncident?.id === inc.id;
                  return (
                    <div
                      key={inc.id}
                      className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                        isSelected
                          ? 'bg-rose-950/40 border-rose-500 shadow-lg shadow-rose-950/40'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="px-2.5 py-0.5 rounded text-xs font-black bg-rose-500 text-white">
                            🚨 CHILD SAFETY ALERT
                          </span>
                          <span className="text-xs font-mono text-slate-400">
                            Reported: {formatTime(inc.timestamp)}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                          <div>
                            <span className="text-[11px] text-slate-400 block">Learner:</span>
                            <strong className="text-white text-sm">{inc.learnerName}</strong>
                          </div>
                          <div>
                            <span className="text-[11px] text-slate-400 block">Location:</span>
                            <span className="text-slate-200">{inc.location.addressDescription || 'Braamfontein'}</span>
                          </div>
                        </div>

                        <div className="text-xs">
                          <span className="text-[11px] text-slate-400 block">Situation:</span>
                          <span className="text-rose-300 font-semibold">
                            {inc.triggerType === 'MANUAL_SOS_BEACON' ? 'Emergency SOS Button Pressed' : 'Child in danger / immediate alert'}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                        <span className="text-xs font-black text-rose-400">
                          Risk: {inc.severity}
                        </span>
                        <button
                          onClick={() => setSelectedIncidentId(inc.id)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                            isSelected
                              ? 'bg-rose-600 text-white'
                              : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                          }`}
                        >
                          <span>{isSelected ? 'Currently Open' : 'Open Incident'}</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* PRIMARY INCIDENT WORKSPACE (SEE → UNDERSTAND → DECIDE → DISPATCH) */}
          {/* ==================================================== */}
          {currentIncident && (
            <div className="p-5 sm:p-7 rounded-3xl bg-slate-900 border-2 border-rose-500/80 shadow-2xl shadow-rose-950/40 space-y-6">
              
              {/* PRIMARY INCIDENT HEADER CARD */}
              <div className="p-5 rounded-2xl bg-rose-950/50 border border-rose-500/40 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-rose-500/30 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-rose-500 text-white animate-pulse">
                      <ShieldAlert className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 text-xs font-black uppercase tracking-wider bg-rose-500 text-white rounded">
                          🚨 CHILD SAFETY ALERT
                        </span>
                        <span className="text-xs text-rose-300 font-bold">
                          Risk: {currentIncident.severity}
                        </span>
                        <span className="text-xs text-slate-400">
                          Reported: {formatTime(currentIncident.timestamp)}
                        </span>
                      </div>
                      <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                        {currentIncident.learnerName} ({currentIncident.learnerGrade})
                      </h2>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSendReassurance(currentIncident)}
                      className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center gap-1.5 transition-all"
                    >
                      <Volume2 className="w-4 h-4" />
                      <span>{reassuranceSent === currentIncident.id ? 'Guardian Update Sent ✓' : 'Update Guardian'}</span>
                    </button>

                    {onNavigateToResponder && (
                      <button
                        onClick={onNavigateToResponder}
                        className="px-3.5 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-bold flex items-center gap-1.5 transition-all"
                      >
                        <Navigation className="w-4 h-4" />
                        <span>Responder Terminal</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 6 Key Points: WHAT, WHERE, WHO, SEVERITY, STATUS */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">WHO NEEDS HELP</span>
                    <strong className="text-white text-sm block mt-0.5">{currentIncident.learnerName}</strong>
                    <span className="text-slate-400 text-[11px]">{currentIncident.schoolName}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">WHERE</span>
                    <strong className="text-emerald-400 text-sm block mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      {currentIncident.location.addressDescription}
                    </strong>
                    <span className="text-slate-400 text-[11px]">GPS Location Verified</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">SITUATION / WHAT HAPPENED</span>
                    <strong className="text-rose-300 text-sm block mt-0.5">
                      {currentIncident.triggerType === 'MANUAL_SOS_BEACON' ? 'Emergency Distress Beacon Activated' : 'Child Left Safe Route / Emergency'}
                    </strong>
                    <span className="text-slate-400 text-[11px]">Guardian: {currentIncident.guardianName}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">CURRENT STATUS</span>
                    <strong className="text-cyan-400 text-sm block mt-0.5">
                      {currentIncident.status === 'DISPATCHED' ? 'UNIT EN ROUTE' : currentIncident.status.replace(/_/g, ' ')}
                    </strong>
                    <span className="text-slate-400 text-[11px]">
                      {currentIncident.assignedResponder ? `Assigned: ${currentIncident.assignedResponder.name}` : 'Awaiting Dispatch'}
                    </span>
                  </div>
                </div>
              </div>

              {/* ==================================================== */}
              {/* 7-STEP PROGRESSION STEPPER BAR */}
              {/* ==================================================== */}
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
                          // Allow jumping back to review earlier steps, or forward if already dispatched
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

              {/* ==================================================== */}
              {/* STEP 1: RECEIVED */}
              {/* ==================================================== */}
              {activeWorkflowStep === 1 && (
                <div className="p-5 sm:p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
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

                  {/* ONLY ONE PROMINENT NEXT ACTION */}
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

              {/* ==================================================== */}
              {/* STEP 2: VERIFY */}
              {/* ==================================================== */}
              {activeWorkflowStep === 2 && (
                <div className="p-5 sm:p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
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

                  {/* PROMINENT PRIMARY ACTIONS */}
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

              {/* ==================================================== */}
              {/* STEP 3: ASSESS */}
              {/* ==================================================== */}
              {activeWorkflowStep === 3 && (
                <div className="p-5 sm:p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-5">
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

                  {/* Recommended Action */}
                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">
                      Recommended Action:
                    </span>
                    <p className="text-sm font-semibold text-white">
                      {assessedSeverity === 'CRITICAL_SOS'
                        ? 'Immediate tactical interception recommended. Dispatch nearest Police or Armed Security unit.'
                        : assessedSeverity === 'HIGH'
                        ? 'Dispatch nearest security or community unit to verify child location.'
                        : 'Contact school principal and dispatch local community escort.'}
                    </p>
                  </div>

                  {/* ONLY ONE PROMINENT NEXT ACTION */}
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

              {/* ==================================================== */}
              {/* STEP 4: DISPATCH (VERY CLEAR, NO TECHNICAL JARGON) */}
              {/* ==================================================== */}
              {activeWorkflowStep === 4 && (
                <div className="p-5 sm:p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-5">
                  <div className="border-b border-slate-850 pb-3">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Zap className="w-5 h-5 text-rose-400" />
                      <span>Step 4: Select and Dispatch Response Service</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      The Command Officer authorizes dispatch. Autonomous dispatch is prohibited.
                    </p>
                  </div>

                  {/* Structured Plain-Language Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">WHO NEEDS HELP:</span>
                      <strong className="text-white text-sm block mt-0.5">{currentIncident.learnerName}</strong>
                      <span className="text-slate-400">{currentIncident.schoolName}</span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">WHERE THEY ARE:</span>
                      <strong className="text-emerald-400 text-sm block mt-0.5">{currentIncident.location.addressDescription}</strong>
                      <span className="text-slate-400">GPS Verified Location</span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">WHAT TYPE OF HELP IS NEEDED:</span>
                      <strong className="text-rose-300 text-sm block mt-0.5">Rapid Tactical Protection & Interception</strong>
                      <span className="text-slate-400">Risk: {assessedSeverity}</span>
                    </div>
                  </div>

                  {/* Available Response Services List */}
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
                    ) : rankedResponders.length === 0 ? (
                      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-400">
                        No active responders currently within 10 km. Expand response perimeter.
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

              {/* ==================================================== */}
              {/* STEP 5: RESPONDING (LIVE INCIDENT MONITOR) */}
              {/* ==================================================== */}
              {activeWorkflowStep === 5 && (
                <div className="p-5 sm:p-6 rounded-2xl bg-blue-950/40 border-2 border-blue-500/60 space-y-5">
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
                      <span className="text-slate-400 block text-[11px]">CURRENT STATUS</span>
                      <strong className="text-blue-400 text-sm block flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                        RESPONDING / EN ROUTE
                      </strong>
                      <span className="text-slate-400 text-[11px]">Speed: 48 km/h</span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                      <span className="text-slate-400 block text-[11px]">SCENE LOCATION</span>
                      <strong className="text-white text-sm block">
                        {currentIncident.location.addressDescription}
                      </strong>
                      <span className="text-emerald-400 text-[11px]">GPS Coordinates Active</span>
                    </div>
                  </div>

                  {/* Important Plain-Language Updates Stream */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                      Incident Event Log
                    </span>
                    <div className="space-y-1.5 text-xs text-slate-300">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-mono">{formatTime(currentIncident.timestamp)}</span>
                        <span>🚨 Emergency SOS distress signal received.</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-mono">10:43</span>
                        <span>✓ Alert verified by Command Officer. Severity assessed as {currentIncident.severity}.</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-mono">10:44</span>
                        <span className="text-emerald-400">
                          🚔 {currentIncident.assignedResponder?.name || 'SAPS Unit'} officially dispatched.
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-mono">10:44</span>
                        <span className="text-cyan-300">
                          📱 Reassurance message delivered to parent/guardian ({currentIncident.guardianName}).
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* NEXT OBVIOUS ACTION: MARK ON SCENE */}
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

              {/* ==================================================== */}
              {/* STEP 6: ON SCENE */}
              {/* ==================================================== */}
              {activeWorkflowStep === 6 && (
                <div className="p-5 sm:p-6 rounded-2xl bg-emerald-950/40 border-2 border-emerald-500/60 space-y-5">
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

                  {/* PROMINENT RESOLUTION ACTION */}
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

              {/* ==================================================== */}
              {/* STEP 7: RESOLVED */}
              {/* ==================================================== */}
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
                      <span>Back to Command Workspace</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* 3. DISPATCH CONFIRMATION MODAL (EXPLICIT HUMAN AUTHORIZATION) */}
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
                  DISPATCH {confirmModalRanking.responder.name.toUpperCase()}?
                </h3>
              </div>

              <button
                onClick={() => setConfirmModalRanking(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Concise details */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Child:</span>
                <strong className="text-white">{currentIncident.learnerName}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Location:</span>
                <span className="text-slate-200">{currentIncident.location.addressDescription}</span>
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
                disabled={isAuthorizingDispatch}
                className="min-h-[44px] flex-1 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs transition-colors"
              >
                BACK
              </button>

              <button
                onClick={handleExecuteConfirmedDispatch}
                disabled={isAuthorizingDispatch}
                className="min-h-[44px] flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition-all flex items-center justify-center gap-2 shadow-xl shadow-rose-950"
              >
                {isAuthorizingDispatch ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Transmitting...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>CONFIRM DISPATCH</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 4. FALSE ALARM CONFIRMATION MODAL */}
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
              return (
                <div key={unit.id} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`px-2.5 py-0.5 rounded text-xs font-bold border ${badge.color}`}>
                      {badge.icon} {badge.label}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      unit.status === 'AVAILABLE'
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

                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{unit.currentLocation?.addressDescription || 'Sector 2 Patrol Area'}</span>
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
    </div>
  );
};
