import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  Navigation, 
  MapPin, 
  HeartPulse, 
  PhoneCall, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Compass,
  Volume2,
  ShieldAlert,
  Car,
  Check,
  X,
  Send,
  AlertCircle,
  FileCheck,
  User,
  Building2,
  ChevronRight,
  Shield,
  Layers,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Phone,
  Flame,
  Zap,
  Info
} from 'lucide-react';
import { 
  IncidentAlert, 
  HydratedLearnerRecord, 
  AssignedIncidentView, 
  ResponderOperationalState, 
  ResponderDeclineReason, 
  IncidentOutcomeReport 
} from '../types.js';
import { api } from '../services/api.js';

interface Props {
  incidents?: IncidentAlert[];
  learners?: HydratedLearnerRecord[];
  onRefresh?: () => void;
}

export const ResponderView: React.FC<Props> = ({
  incidents = [],
  learners = [],
  onRefresh
}) => {
  const [assignedIncident, setAssignedIncident] = useState<AssignedIncidentView | null>(null);
  const [loading, setLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Decline Modal State
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState<ResponderDeclineReason>('VEHICLE_UNAVAILABLE');
  const [customDeclineNote, setCustomDeclineNote] = useState('');

  // Backup Request Modal State
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [backupNote, setBackupNote] = useState('');
  const [backupRequested, setBackupRequested] = useState(false);

  // Field Note & Outcome Report State
  const [fieldNote, setFieldNote] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportForm, setReportForm] = useState<{
    learnerCondition: IncidentOutcomeReport['learnerCondition'];
    guardianHandoverStatus: IncidentOutcomeReport['guardianHandoverStatus'];
    handoverPersonName: string;
    handoverPersonContact: string;
    caseReferenceNumber: string;
    sceneStatusSummary: string;
  }>({
    learnerCondition: 'UNHARMED_SAFE',
    guardianHandoverStatus: 'HANDED_TO_AUTHORITATIVE_GUARDIAN',
    handoverPersonName: '',
    handoverPersonContact: '',
    caseReferenceNumber: 'OB-2026-SUNNYSIDE-4491',
    sceneStatusSummary: 'Learner located safely on school journey route. Identity verified against registered safety profile. Handed over to verified legal guardian.'
  });

  // Radio VoIP Call Simulation
  const [activeCallModal, setActiveCallModal] = useState<{ type: 'COMMAND' | 'GUARDIAN' | 'SCHOOL'; name: string; number: string } | null>(null);

  // Live Timer for On-Scene / En-Route
  const [timerSeconds, setTimerSeconds] = useState(0);

  // Load server-authoritative assigned incident
  const loadAssignedIncident = async (isInitial = false) => {
    try {
      if (isInitial) {
        setLoading(true);
      }
      setErrorMsg(null);
      const assignment = await api.getAssignedIncident();
      setAssignedIncident(assignment);

      // Pre-fill handover person with guardian name if available
      if (assignment?.primaryGuardianContact?.name) {
        setReportForm(prev => ({
          ...prev,
          handoverPersonName: prev.handoverPersonName || `${assignment.primaryGuardianContact.name} (${assignment.primaryGuardianContact.relationship})`,
          handoverPersonContact: prev.handoverPersonContact || assignment.primaryGuardianContact.mobileNumber
        }));
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to sync tactical assignment');
    } finally {
      if (isInitial) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadAssignedIncident(true);
    const interval = setInterval(() => loadAssignedIncident(false), 6000);
    return () => clearInterval(interval);
  }, []);

  // Timer ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setTimerSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ----------------------------------------------------
  // ACTION HANDLERS
  // ----------------------------------------------------

  const handleAcceptAssignment = async () => {
    if (!assignedIncident) return;
    setIsActionLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.acceptAssignment(assignedIncident.incidentId);
      setAssignedIncident(res.assignment);
      setSuccessMsg('Emergency assignment accepted. Tactical GPS navigation engaged.');
      setTimeout(() => setSuccessMsg(null), 4000);
      onRefresh?.();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to accept assignment');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDeclineAssignment = async () => {
    if (!assignedIncident) return;
    setIsActionLoading(true);
    setErrorMsg(null);
    try {
      const fullReason = `${declineReason}: ${customDeclineNote || 'Tactical unit unavailable'}`;
      await api.declineAssignment(assignedIncident.incidentId, fullReason);
      setShowDeclineModal(false);
      setAssignedIncident(null);
      setSuccessMsg('Assignment declined. Command Centre notified for immediate reassignment.');
      setTimeout(() => setSuccessMsg(null), 4000);
      onRefresh?.();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to decline assignment');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleUpdateStatus = async (newState: ResponderOperationalState, customMsg?: string) => {
    if (!assignedIncident) return;
    setIsActionLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.updateResponderStatus(
        assignedIncident.incidentId,
        newState,
        customMsg || fieldNote
      );
      setAssignedIncident(res.assignment);
      setFieldNote('');
      setSuccessMsg(`Status updated to ${newState.replace(/_/g, ' ')}`);
      setTimeout(() => setSuccessMsg(null), 3000);
      onRefresh?.();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update tactical status');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRequestBackup = async () => {
    if (!assignedIncident) return;
    setIsActionLoading(true);
    try {
      await api.updateResponderStatus(
        assignedIncident.incidentId,
        'ASSISTANCE_REQUIRED',
        backupNote || 'Requesting secondary tactical armed and pediatric EMS backup on scene.'
      );
      setBackupRequested(true);
      setShowBackupModal(false);
      setSuccessMsg('Tactical backup request broadcasted to Command Centre & Netcare 911.');
      setTimeout(() => setSuccessMsg(null), 4000);
      onRefresh?.();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to request backup');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSubmitOutcomeReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignedIncident) return;
    setIsActionLoading(true);
    setErrorMsg(null);
    try {
      const report: IncidentOutcomeReport = {
        incidentId: assignedIncident.incidentId,
        responderId: 'resp-pol-01',
        responderName: 'National Police Sunnyside Sector 2 Unit 01',
        learnerCondition: reportForm.learnerCondition,
        guardianHandoverStatus: reportForm.guardianHandoverStatus,
        handoverPersonName: reportForm.handoverPersonName || assignedIncident.primaryGuardianContact.name,
        handoverPersonContact: reportForm.handoverPersonContact || assignedIncident.primaryGuardianContact.mobileNumber,
        caseReferenceNumber: reportForm.caseReferenceNumber,
        sceneStatusSummary: reportForm.sceneStatusSummary,
        submittedAt: new Date().toISOString()
      };

      await api.submitOutcomeReport(report);
      setShowReportModal(false);
      setAssignedIncident(null);
      setSuccessMsg('Official Incident Outcome Report submitted. Case closed and audited.');
      setTimeout(() => setSuccessMsg(null), 5000);
      onRefresh?.();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit report');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Helper for simulation: trigger test incident dispatch
  const handleSimulateDispatch = async () => {
    try {
      setIsActionLoading(true);
      setErrorMsg(null);
      // Find learner
      const learnerId = 'lrn-001';
      await api.triggerPanic({
        learnerId,
        triggerType: 'MANUAL_SOS_BEACON',
        customNotes: 'SIMULATION: Automated test distress signal for responder response drill.',
        location: {
          lat: -25.7589,
          lng: 28.2321,
          addressDescription: 'Brooklyn Safe Zone - South Gate Corridor (Roper St)',
          accuracyMeters: 2.8
        }
      });
      await loadAssignedIncident();
      onRefresh?.();
      setSuccessMsg('Simulation dispatch activated! Incoming assignment received.');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to trigger simulation');
    } finally {
      setIsActionLoading(false);
    }
  };

  const operationalState = assignedIncident?.operationalState || 'AVAILABLE';

  return (
    <div id="responder-application-root" className="space-y-5 max-w-5xl mx-auto">
      
      {/* ==================================================== */}
      {/* 1. TACTICAL TERMINAL HUD & STATUS BAR */}
      {/* ==================================================== */}
      <div id="responder-hud-bar" className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/30">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  National Emergency Response Application
                </h1>
                <span className="px-2.5 py-0.5 text-xs font-mono font-bold bg-blue-500/20 text-blue-300 rounded border border-blue-500/40">
                  Unit: POLICE-GP-9912 (Patrol 01)
                </span>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  ON DUTY
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Sector 2 Pretoria Safe Corridor • National Child Protection Mandate • Authorized Dispatch Terminal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => loadAssignedIncident(true)}
              disabled={loading || isActionLoading}
              className="p-2 rounded-xl bg-slate-950 hover:bg-slate-850 text-slate-300 hover:text-white border border-slate-800 transition-colors"
              title="Refresh Tactical Feeds"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={() => setActiveCallModal({
                type: 'COMMAND',
                name: 'National 24/7 Command Centre',
                number: '+27 12 358 7099 (400.125 MHz)'
              })}
              className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-850 text-cyan-300 border border-cyan-500/30 text-xs font-bold font-mono flex items-center gap-1.5 transition-colors"
            >
              <Radio className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
              <span>TETRA Radio (CH-02)</span>
            </button>
          </div>
        </div>

        {/* Telemetry & Compliance Pill Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] font-mono text-slate-400 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            <span>GPS: -25.7550, 28.2310 (±2.5m)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Car className="w-3.5 h-3.5 text-blue-400" />
            <span>Armored Hilux 4x4 (GP-9912)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <HeartPulse className="w-3.5 h-3.5 text-rose-400" />
            <span>Trauma ALS First Aid Onboard</span>
          </div>
          <div className="flex items-center gap-1.5 text-amber-400">
            <Clock className="w-3.5 h-3.5" />
            <span>SLA Target: &lt; 180s Intercept</span>
          </div>
        </div>
      </div>

      {/* Alert Notifications */}
      {errorMsg && (
        <div id="responder-error-banner" className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div id="responder-success-banner" className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ==================================================== */}
      {/* 2. CORE VIEW SWITCHER ACCORDING TO OPERATIONAL STATE */}
      {/* ==================================================== */}

      {/* ---------------------------------------------------- */}
      {/* STATE 1: AVAILABLE / STANDBY (No Active Assignment) */}
      {/* ---------------------------------------------------- */}
      {!assignedIncident && (
        <div id="responder-standby-view" className="p-8 sm:p-12 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-6">
          <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 shadow-xl shadow-emerald-950/20">
            <CheckCircle2 className="w-10 h-10 animate-pulse" />
          </div>

          <div className="max-w-md mx-auto space-y-2">
            <span className="px-3 py-1 text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/40 uppercase tracking-wider">
              Status: Available on Standby
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              Patrol Sector 2 Active
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Standing by for authorized emergency assignments from the National 24/7 Command Centre. Your unit location and readiness are synchronized in real-time.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl mx-auto text-left text-xs">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-500 text-[10px] uppercase font-bold block">Assigned Sector</span>
              <strong className="text-white block font-sans">Pretoria Boys High & Brooklyn</strong>
              <span className="text-slate-400 text-[11px]">Safe Corridor Zone 4B</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-500 text-[10px] uppercase font-bold block">Command Link</span>
              <strong className="text-emerald-400 block font-sans">Online (TETRA OK)</strong>
              <span className="text-slate-400 text-[11px]">Latency: 18ms</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-500 text-[10px] uppercase font-bold block">Dispatch Protocol</span>
              <strong className="text-cyan-400 block font-sans">Uber-Model Response</strong>
              <span className="text-slate-400 text-[11px]">Direct Command Assignment</span>
            </div>
          </div>

          {/* Simulation Helper */}
          <div className="pt-4 border-t border-slate-800/80 max-w-md mx-auto">
            <p className="text-xs text-slate-500 mb-3">
              Need to test the incoming emergency response flow?
            </p>
            <button
              id="simulate-dispatch-trigger-btn"
              onClick={handleSimulateDispatch}
              disabled={isActionLoading}
              className="min-h-[44px] w-full px-5 py-2.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-bold transition-all flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4 text-blue-400" />
              <span>Simulate Command Centre Dispatch (Test SOS)</span>
            </button>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* STATE 2: ASSIGNMENT_RECEIVED (Incoming High-Priority Alert) */}
      {/* ---------------------------------------------------- */}
      {assignedIncident && operationalState === 'ASSIGNMENT_RECEIVED' && (
        <div id="incoming-assignment-card" className="p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-rose-950/60 via-slate-900 to-slate-900 border-2 border-rose-500 shadow-2xl shadow-rose-950/60 space-y-6 animate-in zoom-in-95">
          
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rose-500/30 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-rose-500 text-white animate-bounce shadow-lg shadow-rose-950">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div>
                <span className="px-2.5 py-0.5 text-xs font-mono font-black bg-rose-500 text-white rounded uppercase tracking-wider animate-pulse">
                  CRITICAL EMERGENCY ASSIGNMENT
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                  Immediate Armed Response Authorized
                </h2>
              </div>
            </div>

            <div className="text-right self-start sm:self-auto bg-slate-950/80 px-4 py-2 rounded-xl border border-rose-500/40">
              <span className="text-[11px] text-rose-300 uppercase tracking-wider font-bold block">Estimated Travel</span>
              <div className="text-2xl font-black text-amber-400 font-mono">
                {assignedIncident.route.etaMinutes} min ({assignedIncident.route.distanceKm} km)
              </div>
            </div>
          </div>

          {/* Learner & Location Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Left: Learner Card */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center gap-4">
              <img
                src={assignedIncident.learnerPhotoUrl || 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=200&auto=format&fit=crop&q=80'}
                alt={assignedIncident.learnerName}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-700 shrink-0"
              />
              <div className="space-y-1">
                <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider font-bold block">
                  Target Learner
                </span>
                <strong className="text-white text-base block font-sans">
                  {assignedIncident.learnerName}
                </strong>
                <span className="text-slate-400 text-xs block">
                  {assignedIncident.learnerGrade} • {assignedIncident.schoolName}
                </span>
              </div>
            </div>

            {/* Middle: Distress Location */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-[10px] font-mono text-rose-400 uppercase tracking-wider font-bold flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                Target Distress Location
              </span>
              <strong className="text-white text-sm block font-sans">
                {assignedIncident.approvedLocation.addressDescription}
              </strong>
              <span className="text-slate-400 text-xs font-mono block">
                GPS: {assignedIncident.approvedLocation.lat.toFixed(4)}, {assignedIncident.approvedLocation.lng.toFixed(4)} (±{assignedIncident.approvedLocation.accuracyMeters}m)
              </span>
            </div>

            {/* Right: Medical Criticals */}
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-1">
              <span className="text-[10px] font-mono text-rose-300 uppercase tracking-wider font-bold flex items-center gap-1">
                <HeartPulse className="w-3 h-3 text-rose-400" />
                Medical Critical Note
              </span>
              <strong className="text-white text-xs block">
                Blood Type: {assignedIncident.medicalCriticals.bloodType || 'O+'}
              </strong>
              <p className="text-rose-200 text-xs">
                {assignedIncident.medicalCriticals.medicalNotes || 'Asthmatic, carries inhaler.'}
              </p>
            </div>
          </div>

          {/* Dispatch Notice */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-center gap-2">
            <Info className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              <strong>Command Directive:</strong> {assignedIncident.situationSummary}
            </span>
          </div>

          {/* Action Buttons: ACCEPT or DECLINE */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              id="accept-emergency-assignment-btn"
              onClick={handleAcceptAssignment}
              disabled={isActionLoading}
              className="min-h-[52px] w-full sm:flex-1 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm tracking-wide transition-all shadow-xl shadow-emerald-950/60 flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5 stroke-[3]" />
              <span>ACCEPT EMERGENCY ASSIGNMENT</span>
            </button>

            <button
              id="decline-assignment-btn"
              onClick={() => setShowDeclineModal(true)}
              disabled={isActionLoading}
              className="min-h-[52px] w-full sm:w-auto px-6 py-3 rounded-2xl bg-slate-950 hover:bg-rose-950/40 text-rose-400 hover:text-rose-300 border border-rose-500/40 text-xs font-bold transition-all flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
              <span>Decline with Cause</span>
            </button>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* STATE 3: EN_ROUTE / NAVIGATION HUD */}
      {/* ---------------------------------------------------- */}
      {assignedIncident && (operationalState === 'EN_ROUTE' || operationalState === 'ACCEPTED') && (
        <div id="responder-enroute-view" className="space-y-4">
          
          {/* Turn Banner HUD */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-950 via-slate-900 to-slate-900 border-2 border-blue-500/60 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3.5 rounded-2xl bg-blue-500 text-white animate-pulse">
                <Navigation className="w-7 h-7" />
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-mono font-bold text-blue-300 uppercase tracking-wider">
                  Next Tactical Turn • Safe Corridor 4B
                </span>
                <h3 className="text-lg sm:text-xl font-bold text-white">
                  Turn Left in 60m onto Brooklyn Rd
                </h3>
                <p className="text-xs text-slate-400">
                  Target: {assignedIncident.approvedLocation.addressDescription}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 self-start md:self-auto bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800">
              <div>
                <span className="text-[10px] text-slate-400 block font-mono">Distance</span>
                <strong className="text-base font-bold text-white font-mono">{assignedIncident.route.distanceKm} km</strong>
              </div>
              <div className="w-px h-8 bg-slate-800" />
              <div>
                <span className="text-[10px] text-slate-400 block font-mono">Speed</span>
                <strong className="text-base font-bold text-emerald-400 font-mono">42 km/h</strong>
              </div>
              <div className="w-px h-8 bg-slate-800" />
              <div>
                <span className="text-[10px] text-slate-400 block font-mono">ETA</span>
                <strong className="text-base font-bold text-amber-400 font-mono">{assignedIncident.route.etaMinutes} min</strong>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            
            {/* Tactical Map Simulation (2 Cols) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                    <Compass className="w-4 h-4 animate-spin text-cyan-400" />
                    Live Tactical GPS Route Tracker
                  </span>
                  <span className="text-xs font-mono text-emerald-400">
                    Precision GPS: 3.2m Lock
                  </span>
                </div>

                {/* Tactical Visual Canvas */}
                <div className="relative h-72 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center p-4 overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px] opacity-60" />
                  
                  {/* Route corridor trace */}
                  <div className="absolute w-64 h-1 bg-gradient-to-r from-blue-500 to-rose-500 -rotate-12 opacity-80" />

                  {/* Vehicle Marker */}
                  <div className="absolute top-16 left-20 flex flex-col items-center">
                    <div className="p-2.5 rounded-full bg-blue-600 text-white shadow-xl shadow-blue-900 border-2 border-white animate-pulse">
                      <Car className="w-5 h-5" />
                    </div>
                    <span className="mt-1 px-2 py-0.5 rounded bg-slate-900 text-[10px] font-mono text-blue-300 border border-blue-500/40">
                      National Police Unit 01 (You)
                    </span>
                  </div>

                  {/* Target Distress Marker */}
                  <div className="absolute bottom-12 right-20 flex flex-col items-center">
                    <div className="p-3 rounded-full bg-rose-600 text-white shadow-2xl shadow-rose-950 border-2 border-white animate-bounce">
                      <MapPin className="w-6 h-6" />
                    </div>
                    <span className="mt-1 px-2.5 py-0.5 rounded bg-slate-900 text-[11px] font-bold text-rose-300 border border-rose-500">
                      {assignedIncident.learnerName} ({assignedIncident.approvedLocation.addressDescription.slice(0, 20)}...)
                    </span>
                  </div>
                </div>

                {/* Primary Transition Button: MARK ARRIVED ON-SCENE */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs text-slate-300">
                    Approaching distress perimeter? Tap when wheels have stopped on scene.
                  </div>
                  <button
                    id="mark-arrived-btn"
                    onClick={() => handleUpdateStatus('ARRIVED')}
                    disabled={isActionLoading}
                    className="min-h-[44px] w-full sm:w-auto px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-950/50 flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>MARK ON-SCENE (ARRIVED)</span>
                  </button>
                </div>
              </div>

              {/* Waypoint Steps */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Tactical Route Sequence
                </span>
                <div className="space-y-1.5 font-mono">
                  {assignedIncident.route.waypoints.map((wp, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-slate-950 border border-slate-850 flex items-center gap-3">
                      <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center text-[10px] font-bold shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-slate-300 text-xs font-sans">{wp.instruction}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Authoritative Need-to-Know Dossier */}
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 text-xs">
                <h3 className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2">
                  <User className="w-4 h-4 text-cyan-400" />
                  Need-To-Know Child Dossier
                </h3>

                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <img
                    src={assignedIncident.learnerPhotoUrl}
                    alt={assignedIncident.learnerName}
                    className="w-14 h-14 rounded-xl object-cover border border-slate-700"
                  />
                  <div>
                    <strong className="text-white text-sm block font-sans">{assignedIncident.learnerName}</strong>
                    <span className="text-slate-400">{assignedIncident.learnerGrade} • Age {assignedIncident.learnerAge || 16}</span>
                    <span className="text-cyan-400 block text-[11px] mt-0.5">{assignedIncident.schoolName}</span>
                  </div>
                </div>

                {/* Medical Criticals */}
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-1 text-rose-200">
                  <span className="font-bold block text-xs flex items-center gap-1.5">
                    <HeartPulse className="w-3.5 h-3.5 text-rose-400" />
                    Medical Criticals:
                  </span>
                  <p className="text-xs">
                    Blood Group: <strong className="text-white">{assignedIncident.medicalCriticals.bloodType || 'O+'}</strong>
                  </p>
                  <p className="text-xs">
                    {assignedIncident.medicalCriticals.medicalNotes || 'Asthmatic, carries inhaler.'}
                  </p>
                </div>

                {/* Emergency Comms Action Buttons */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <span className="text-slate-400 text-[11px] font-bold uppercase tracking-wider block">
                    Verified Emergency Channels
                  </span>

                  <button
                    onClick={() => setActiveCallModal({
                      type: 'GUARDIAN',
                      name: assignedIncident.primaryGuardianContact.name,
                      number: assignedIncident.primaryGuardianContact.mobileNumber
                    })}
                    className="min-h-[44px] w-full px-3.5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-850 text-emerald-400 border border-emerald-500/30 font-bold text-xs flex items-center justify-between transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5" />
                      <span>Call Guardian ({assignedIncident.primaryGuardianContact.relationship})</span>
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">{assignedIncident.primaryGuardianContact.mobileNumber}</span>
                  </button>

                  <button
                    onClick={() => setShowBackupModal(true)}
                    className="min-h-[44px] w-full px-3.5 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                  >
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>Request Tactical / EMS Backup</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* STATE 4: ARRIVED / ON_SCENE */}
      {/* ---------------------------------------------------- */}
      {assignedIncident && operationalState === 'ARRIVED' && (
        <div id="responder-onscene-view" className="p-6 sm:p-8 rounded-3xl bg-slate-900 border-2 border-amber-500/80 shadow-2xl space-y-6 animate-in fade-in">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-amber-500 text-slate-950 font-black">
                <MapPin className="w-7 h-7" />
              </div>
              <div>
                <span className="px-2.5 py-0.5 text-xs font-mono font-bold bg-amber-500/20 text-amber-300 rounded border border-amber-500/40 uppercase tracking-wider">
                  STATUS: ON-SCENE ARRIVED
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">
                  Active Scene Containment: {assignedIncident.learnerName}
                </h2>
              </div>
            </div>

            <div className="text-right self-start sm:self-auto bg-slate-950 px-4 py-2 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-mono block">Time on Scene</span>
              <strong className="text-xl font-bold text-white font-mono">{formatTimer(timerSeconds)}</strong>
            </div>
          </div>

          {/* Quick Scene Action Panel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <strong className="text-white text-sm block">1. Rapid Scene Status Log</strong>
              <textarea
                value={fieldNote}
                onChange={e => setFieldNote(e.target.value)}
                placeholder="Enter scene observations (e.g. Visual contact made with learner, no injuries observed, escorting to safety)..."
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs outline-none focus:border-cyan-500 resize-none"
              />
              <button
                onClick={() => handleUpdateStatus('ARRIVED', fieldNote)}
                disabled={!fieldNote.trim() || isActionLoading}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-white text-xs font-bold transition-all flex items-center gap-2"
              >
                <Send className="w-3.5 h-3.5 text-cyan-400" />
                <span>Transmit Field Note to Command Centre</span>
              </button>
            </div>

            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 flex flex-col justify-between">
              <div className="space-y-1">
                <strong className="text-white text-sm block">2. Containment & Protection</strong>
                <p className="text-xs text-slate-400">
                  Once child is safely identified and contained in protected perimeter, advance status to Scene Secured.
                </p>
              </div>

              <div className="space-y-2">
                <button
                  id="mark-scene-secured-btn"
                  onClick={() => handleUpdateStatus('SCENE_SECURED')}
                  disabled={isActionLoading}
                  className="min-h-[48px] w-full px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>SCENE SECURED & CHILD CONTAINED ✓</span>
                </button>

                <button
                  onClick={() => setShowBackupModal(true)}
                  className="min-h-[44px] w-full px-4 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold transition-all flex items-center justify-center gap-2"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  <span>Request Emergency Paramedic / Backup</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* STATE 5: SCENE_SECURED / READY FOR REPORT */}
      {/* ---------------------------------------------------- */}
      {assignedIncident && (operationalState === 'SCENE_SECURED' || operationalState === 'ASSISTANCE_REQUIRED') && (
        <div id="responder-secured-view" className="p-6 sm:p-8 rounded-3xl bg-slate-900 border-2 border-emerald-500/80 shadow-2xl space-y-6 animate-in fade-in">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-emerald-500 text-slate-950 font-black">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div>
                <span className="px-2.5 py-0.5 text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/40 uppercase tracking-wider">
                  STATUS: SCENE SECURED
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">
                  Child Safe & Protected • Ready for Debrief
                </h2>
              </div>
            </div>

            <button
              id="open-report-modal-btn"
              onClick={() => setShowReportModal(true)}
              className="min-h-[48px] px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-emerald-950"
            >
              <FileCheck className="w-4 h-4" />
              <span>Complete Official Handover Report</span>
            </button>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-2">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
              Handover Protocol Instructions
            </span>
            <p>
              Verify legal guardian identity or school representative credentials prior to releasing child. Complete the official outcome report to fulfill official Case & Child Protection Mandate requirements.
            </p>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 3. MODALS: DECLINE ASSIGNMENT */}
      {/* ==================================================== */}
      {showDeclineModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-rose-500/50 rounded-3xl p-6 space-y-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-bold text-white">Decline Emergency Assignment</h3>
              </div>
              <button
                onClick={() => setShowDeclineModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              A legitimate operational constraint is required. The Command Centre will be immediately alerted to reassign this critical emergency.
            </p>

            <div className="space-y-3 text-xs">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Primary Operational Reason
              </label>
              <select
                value={declineReason}
                onChange={e => setDeclineReason(e.target.value as ResponderDeclineReason)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white outline-none"
              >
                <option value="VEHICLE_UNAVAILABLE">Vehicle / Mechanical Constraint</option>
                <option value="UNSAFE_TO_PROCEED">Active Roadblock / Threat Impassable</option>
                <option value="MEDICAL_OPERATIONAL_INCAPACITY">Crew Medical / Operational Incapacity</option>
                <option value="EQUIPMENT_FAILURE">Comms or Hardware Equipment Failure</option>
                <option value="OTHER_TACTICAL_CONSTRAINT">Other High-Priority Operational Constraint</option>
              </select>

              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Specific Dispatch Note
              </label>
              <input
                type="text"
                value={customDeclineNote}
                onChange={e => setCustomDeclineNote(e.target.value)}
                placeholder="Brief reason details for Command Officer..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowDeclineModal(false)}
                className="min-h-[44px] flex-1 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleDeclineAssignment}
                disabled={isActionLoading}
                className="min-h-[44px] flex-1 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
              >
                Confirm Decline & Reassign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 4. MODALS: REQUEST BACKUP */}
      {/* ==================================================== */}
      {showBackupModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-rose-500/50 rounded-3xl p-6 space-y-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-bold text-white">Request Emergency Backup</h3>
              </div>
              <button
                onClick={() => setShowBackupModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Required Support Units
              </label>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-slate-300">
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="rounded text-rose-500" />
                  <span>Emergency Medical ALS Paramedic (Pediatric)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="rounded text-rose-500" />
                  <span>Secondary National Police Armed Patrol</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded text-rose-500" />
                  <span>Municipal Police Traffic Cordon</span>
                </label>
              </div>

              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Tactical Notes for Incoming Units
              </label>
              <textarea
                value={backupNote}
                onChange={e => setBackupNote(e.target.value)}
                placeholder="Detail reason for escalation (e.g. Learner experiencing acute asthma distress, paramedic oxygen required)..."
                rows={3}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white outline-none resize-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowBackupModal(false)}
                className="min-h-[44px] flex-1 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestBackup}
                disabled={isActionLoading}
                className="min-h-[44px] flex-1 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2"
              >
                <Radio className="w-4 h-4" />
                <span>Broadcast Backup Request</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 5. MODALS: OFFICIAL OUTCOME REPORT */}
      {/* ==================================================== */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-5 shadow-2xl animate-in zoom-in-95 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Official Incident Outcome & Handover Report</h3>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitOutcomeReport} className="space-y-4 text-xs">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Learner Physical Condition *
                  </label>
                  <select
                    value={reportForm.learnerCondition}
                    onChange={e => setReportForm({ ...reportForm, learnerCondition: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white outline-none"
                    required
                  >
                    <option value="UNHARMED_SAFE">Unharmed & Safe</option>
                    <option value="MINOR_FIRST_AID_APPLIED">Minor First Aid Applied On-Scene</option>
                    <option value="PARAMEDIC_CARE_REQUIRED">Paramedic Care Required</option>
                    <option value="HOSPITALIZED_EMERGENCY">Emergency Hospital Evacuation</option>
                    <option value="TRANSPORTED_TO_CAMPUS">Escorted to School Safe Office</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Handover Custody Status *
                  </label>
                  <select
                    value={reportForm.guardianHandoverStatus}
                    onChange={e => setReportForm({ ...reportForm, guardianHandoverStatus: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white outline-none"
                    required
                  >
                    <option value="HANDED_TO_AUTHORITATIVE_GUARDIAN">Handed to Verified Legal Guardian</option>
                    <option value="HANDED_TO_SCHOOL_PRINCIPAL">Handed to School Principal / Staff</option>
                    <option value="POLICE_PROTECTIVE_ESCORT">National Police Protective Custody Escort</option>
                    <option value="PARAMEDIC_EVACUATION">Paramedic Ambulance Evacuation</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Receiving Person Full Name *
                  </label>
                  <input
                    type="text"
                    value={reportForm.handoverPersonName}
                    onChange={e => setReportForm({ ...reportForm, handoverPersonName: e.target.value })}
                    placeholder="e.g. Thandi Dlamini (Mother)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Receiving Contact Number *
                  </label>
                  <input
                    type="text"
                    value={reportForm.handoverPersonContact}
                    onChange={e => setReportForm({ ...reportForm, handoverPersonContact: e.target.value })}
                    placeholder="+27 82 000 0000"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  National Station Occurrence Book (OB) Reference
                </label>
                <input
                  type="text"
                  value={reportForm.caseReferenceNumber}
                  onChange={e => setReportForm({ ...reportForm, caseReferenceNumber: e.target.value })}
                  placeholder="e.g. OB-2026-SUNNYSIDE-4491"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Official Scene Status Summary *
                </label>
                <textarea
                  value={reportForm.sceneStatusSummary}
                  onChange={e => setReportForm({ ...reportForm, sceneStatusSummary: e.target.value })}
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white outline-none resize-none"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="min-h-[44px] flex-1 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isActionLoading}
                  className="min-h-[44px] flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950"
                >
                  <Check className="w-4 h-4" />
                  <span>Submit Report & Close Incident</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 6. MODALS: ENCRYPTED CALL SIMULATION */}
      {/* ==================================================== */}
      {activeCallModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-cyan-500/50 rounded-3xl p-6 space-y-6 text-center shadow-2xl animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 flex items-center justify-center mx-auto animate-pulse">
              <Phone className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 px-2.5 py-0.5 rounded-full border border-cyan-500/40 uppercase">
                Encrypted Tactical Voice Link
              </span>
              <h3 className="text-lg font-bold text-white">{activeCallModal.name}</h3>
              <p className="text-xs text-slate-400 font-mono">{activeCallModal.number}</p>
            </div>

            <div className="text-xs font-mono text-emerald-400 py-1">
              Connected • 00:14 • 400.125 MHz Live
            </div>

            <button
              onClick={() => setActiveCallModal(null)}
              className="min-h-[44px] w-full px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
            >
              End Voice Link
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
