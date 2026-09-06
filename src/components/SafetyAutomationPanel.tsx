import React, { useState, useEffect, useMemo } from 'react';
import {
  SafetyAutomationConfig,
  SafetyAlertRecord,
  SafetyAutomationTestSuiteResult,
  SafetyRuleConfig,
  SafetyAutomationEventType,
  ActiveUserSession,
  IncidentAlert,
  HydratedLearnerRecord
} from '../types.js';
import { api } from '../services/api.js';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  Sliders,
  Bell,
  Clock,
  Battery,
  MapPin,
  Lock,
  Eye,
  Check,
  X,
  ExternalLink,
  Info,
  Layers,
  Radio,
  WifiOff,
  Navigation,
  BatteryLow,
  Zap,
  UserCheck
} from 'lucide-react';

interface Props {
  currentUser?: ActiveUserSession | null;
  incidents?: IncidentAlert[];
  learners?: HydratedLearnerRecord[];
  onSelectIncident?: (incidentId: string) => void;
}

export const SafetyAutomationPanel: React.FC<Props> = ({
  currentUser,
  incidents = [],
  learners = [],
  onSelectIncident
}) => {
  const [config, setConfig] = useState<SafetyAutomationConfig | null>(null);
  const [alerts, setAlerts] = useState<SafetyAlertRecord[]>([]);
  const [testSuiteResults, setTestSuiteResults] = useState<SafetyAutomationTestSuiteResult | null>(null);
  const [activeTab, setActiveTab] = useState<'QUEUE' | 'RULES' | 'TEST_SUITE' | 'SIMULATE'>('QUEUE');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Quick offline test form state
  const [testDeviceId, setTestDeviceId] = useState('DEV-ZA-GT012-001');
  const [testSilenceMinutes, setTestSilenceMinutes] = useState(20);
  const [evalResult, setEvalResult] = useState<any>(null);

  const canConfigure = useMemo(() => {
    return currentUser?.role === 'SYSTEM_ADMIN' || currentUser?.role === 'FOUNDER_EXECUTIVE';
  }, [currentUser]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [configData, alertsData] = await Promise.all([
        api.getSafetyAutomationConfig().catch(() => null),
        api.getSafetyAlerts().catch(() => [])
      ]);
      if (configData) setConfig(configData);
      setAlerts(alertsData);
    } catch (err: any) {
      console.warn('Failed to load safety automation data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleRule = async (rule: SafetyRuleConfig) => {
    if (!canConfigure) {
      setActionError('Access Denied: Only System Administrators or Executive Founders can modify automation rules.');
      setTimeout(() => setActionError(null), 4000);
      return;
    }
    try {
      const updated = await api.updateSafetyAutomationRule(rule.ruleId, {
        enabled: !rule.enabled
      });
      setActionSuccess(`✓ Rule "${rule.name}" ${updated.enabled ? 'ENABLED' : 'DISABLED'}`);
      setTimeout(() => setActionSuccess(null), 3000);
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to update rule');
      setTimeout(() => setActionError(null), 4000);
    }
  };

  const handleUpdateCooldown = async (rule: SafetyRuleConfig, newCooldown: number) => {
    if (!canConfigure) return;
    try {
      await api.updateSafetyAutomationRule(rule.ruleId, {
        cooldownSeconds: newCooldown
      });
      setActionSuccess(`✓ Updated cooldown for "${rule.name}" to ${newCooldown}s`);
      setTimeout(() => setActionSuccess(null), 3000);
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to update cooldown');
    }
  };

  const handleReviewAlert = async (alertId: string, status: 'ACKNOWLEDGED' | 'DISMISSED' | 'RESOLVED') => {
    try {
      await api.reviewSafetyAlert(alertId, status, `Reviewed by ${currentUser?.name || 'Operator'}`);
      setActionSuccess(`✓ Alert ${status.toLowerCase()} successfully`);
      setTimeout(() => setActionSuccess(null), 3000);
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to review alert');
      setTimeout(() => setActionError(null), 4000);
    }
  };

  const handleRunAcceptanceTests = async () => {
    try {
      setIsRunningTests(true);
      setActionError(null);
      const results = await api.runSafetyAutomationTestSuite();
      setTestSuiteResults(results);
      setActionSuccess(`✓ All ${results.totalTests} acceptance tests evaluated (${results.passedTests} passed)`);
      setTimeout(() => setActionSuccess(null), 5000);
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to run acceptance test suite');
    } finally {
      setIsRunningTests(false);
    }
  };

  const handleTestOfflineEval = async () => {
    try {
      setActionError(null);
      const pastTime = new Date(Date.now() - testSilenceMinutes * 60 * 1000).toISOString();
      const res = await api.evaluateDeviceOffline(testDeviceId, pastTime);
      setEvalResult(res.result);
      setActionSuccess(`✓ Offline evaluation completed for ${testDeviceId}`);
      setTimeout(() => setActionSuccess(null), 3000);
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Offline evaluation failed');
    }
  };

  const filteredAlerts = useMemo(() => {
    if (statusFilter === 'ALL') return alerts;
    return alerts.filter(a => a.status === statusFilter);
  }, [alerts, statusFilter]);

  const pendingCount = useMemo(() => {
    return alerts.filter(a => a.status === 'PENDING_REVIEW').length;
  }, [alerts]);

  const getEventIcon = (eventType: SafetyAutomationEventType) => {
    switch (eventType) {
      case 'DEVICE_OFFLINE':
      case 'PROLONGED_SILENCE':
        return <WifiOff className="w-4 h-4 text-amber-400" />;
      case 'EMERGENCY_SOS':
        return <AlertTriangle className="w-4 h-4 text-rose-400" />;
      case 'GEOFENCE_EXIT':
      case 'GEOFENCE_ENTRY':
        return <MapPin className="w-4 h-4 text-cyan-400" />;
      case 'UNEXPECTED_ROUTE_DEVIATION':
        return <Navigation className="w-4 h-4 text-orange-400" />;
      case 'LOW_BATTERY':
        return <BatteryLow className="w-4 h-4 text-yellow-400" />;
      case 'TRACKER_TAMPER':
        return <Zap className="w-4 h-4 text-red-400" />;
      case 'UNUSUAL_STATIONARY':
        return <Clock className="w-4 h-4 text-indigo-400" />;
      default:
        return <Radio className="w-4 h-4 text-slate-400" />;
    }
  };

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
      case 'CRITICAL_SOS':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'HIGH':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'MEDIUM':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'PENDING_REVIEW':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse';
      case 'ESCALATED':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'ACKNOWLEDGED':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
      case 'RESOLVED':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'DISMISSED':
        return 'bg-slate-800 text-slate-400 border-slate-700';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div id="safety-automation-panel" className="space-y-4">
      {/* 1. STRICT SAFETY MANDATE BANNER */}
      <div className="bg-slate-900 border-l-4 border-amber-400 rounded-xl p-4 shadow-sm border border-slate-800">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-amber-400/10 text-amber-400 shrink-0 mt-0.5">
            <Lock className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-slate-100 uppercase tracking-wide">
                Controlled Safety Automation Layer
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400/20 text-amber-300 border border-amber-400/40">
                REAL DISPATCH SUPPRESSED
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              <span className="text-amber-300 font-semibold">Strict Operational Constraint:</span> Under no circumstances does this automation layer dispatch real-world emergency services (SAPS, EMS, or private security). All detected conditions populate internal command queues and require explicit human commanding officer authorization.
            </p>
          </div>
          <button
            onClick={loadData}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Action notifications */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="p-3 bg-rose-950/60 border border-rose-500/40 text-rose-300 rounded-xl text-xs font-semibold flex items-center gap-2">
          <XCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* 2. SUB-TABS NAVIGATION */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            id="tab-safety-queue"
            onClick={() => setActiveTab('QUEUE')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'QUEUE'
                ? 'bg-amber-400 text-slate-950 shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Safety Alerts Queue</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-600 text-white">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            id="tab-safety-rules"
            onClick={() => setActiveTab('RULES')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'RULES'
                ? 'bg-amber-400 text-slate-950 shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Configurable Rules ({config?.rules?.length ?? 9})</span>
          </button>

          <button
            id="tab-safety-tests"
            onClick={() => setActiveTab('TEST_SUITE')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'TEST_SUITE'
                ? 'bg-amber-400 text-slate-950 shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>10 Acceptance Tests</span>
            {testSuiteResults?.allPassed && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            )}
          </button>

          <button
            id="tab-safety-eval"
            onClick={() => setActiveTab('SIMULATE')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'SIMULATE'
                ? 'bg-amber-400 text-slate-950 shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Condition Tester</span>
          </button>
        </div>

        <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-slate-500" />
          <span>Deduplication Cooldowns Active</span>
        </div>
      </div>

      {/* 3. TAB 1: SAFETY ALERTS QUEUE */}
      {activeTab === 'QUEUE' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400">Filter Queue:</span>
              {(['ALL', 'PENDING_REVIEW', 'ESCALATED', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                    statusFilter === st
                      ? 'bg-slate-800 text-amber-300 border border-amber-400/40'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-300 border border-slate-800'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>
            <div className="text-xs text-slate-400">
              Showing <span className="text-slate-200 font-bold">{filteredAlerts.length}</span> alert(s)
            </div>
          </div>

          {filteredAlerts.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-8 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-semibold text-slate-300">No safety alerts in this view</p>
              <p className="text-xs text-slate-500 mt-1">
                All GPS tracker telemetry streams are within configured safety bounds or filtered.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredAlerts.map(alert => (
                <div
                  key={alert.id}
                  id={`alert-card-${alert.id}`}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-slate-800 border border-slate-700 mt-0.5">
                        {getEventIcon(alert.eventType)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-slate-100">{alert.title}</h4>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getSeverityBadgeClass(alert.severity)}`}>
                            {alert.severity}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadgeClass(alert.status)}`}>
                            {alert.status.replace('_', ' ')}
                          </span>
                          {alert.suppressedDuplicatesCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700">
                              +{alert.suppressedDuplicatesCount} suppressed duplicates
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">{alert.description}</p>

                        <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-400 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Radio className="w-3 h-3 text-slate-500" />
                            <span>Device: <strong className="text-slate-200">{alert.trackerDeviceId}</strong></span>
                          </span>
                          {alert.learnerName && (
                            <span className="flex items-center gap-1">
                              <UserCheck className="w-3 h-3 text-slate-500" />
                              <span>Learner: <strong className="text-slate-200">{alert.learnerName}</strong></span>
                            </span>
                          )}
                          {alert.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-500" />
                              <span>{alert.location.lat.toFixed(4)}, {alert.location.lng.toFixed(4)}</span>
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            <span>{new Date(alert.telemetrySnapshot?.timestamp || alert.createdAt).toLocaleTimeString()}</span>
                          </span>
                          {alert.telemetrySnapshot.batteryLevel !== undefined && (
                            <span className="flex items-center gap-1">
                              <Battery className="w-3 h-3 text-slate-500" />
                              <span>{alert.telemetrySnapshot.batteryLevel}%</span>
                            </span>
                          )}
                        </div>

                        {alert.escalatedIncidentId && (
                          <div className="mt-2.5 p-2 rounded-lg bg-rose-950/30 border border-rose-500/30 flex items-center justify-between">
                            <span className="text-xs text-rose-300">
                              Correlated Internal Incident: <strong>{alert.escalatedIncidentId}</strong>
                            </span>
                            {onSelectIncident && (
                              <button
                                onClick={() => onSelectIncident(alert.escalatedIncidentId!)}
                                className="text-xs text-rose-400 hover:text-rose-200 font-bold flex items-center gap-1"
                              >
                                <span>Open Case</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Operational Review Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {alert.status === 'PENDING_REVIEW' && (
                        <>
                          <button
                            id={`btn-ack-${alert.id}`}
                            onClick={() => handleReviewAlert(alert.id, 'ACKNOWLEDGED')}
                            className="px-2.5 py-1.5 rounded-lg bg-cyan-600/20 text-cyan-300 hover:bg-cyan-600/30 border border-cyan-500/40 text-xs font-semibold transition-colors flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Acknowledge</span>
                          </button>
                          <button
                            id={`btn-dismiss-${alert.id}`}
                            onClick={() => handleReviewAlert(alert.id, 'DISMISSED')}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700 text-xs font-semibold transition-colors flex items-center gap-1"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Dismiss</span>
                          </button>
                        </>
                      )}
                      {alert.status === 'ACKNOWLEDGED' && (
                        <button
                          onClick={() => handleReviewAlert(alert.id, 'RESOLVED')}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/40 text-xs font-semibold transition-colors flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Mark Resolved</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. TAB 2: CONFIGURABLE RULES MATRIX */}
      {activeTab === 'RULES' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>
              All thresholds are stored in configuration structures without hardcoded universal values.
            </span>
            {!canConfigure && (
              <span className="text-amber-400 flex items-center gap-1 font-semibold">
                <Lock className="w-3 h-3" />
                <span>Read-Only (Admin configuration authorization required)</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {config?.rules?.map((rule: SafetyRuleConfig) => (
              <div
                key={rule.ruleId}
                id={`rule-card-${rule.ruleId}`}
                className={`bg-slate-900 border rounded-xl p-4 transition-all ${
                  rule.enabled ? 'border-slate-800' : 'border-slate-800/60 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-slate-800 text-slate-300">
                      {getEventIcon(rule.eventType)}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-100">{rule.name}</h4>
                      <span className="text-[10px] text-slate-500 font-mono">{rule.eventType}</span>
                    </div>
                  </div>
                  <button
                    disabled={!canConfigure}
                    onClick={() => handleToggleRule(rule)}
                    className={`px-2 py-0.5 rounded text-[10px] font-black transition-colors ${
                      rule.enabled
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-slate-800 text-slate-500 border border-slate-700'
                    }`}
                  >
                    {rule.enabled ? 'ACTIVE' : 'DISABLED'}
                  </button>
                </div>

                <p className="text-[11px] text-slate-400 mt-2 line-clamp-2">{rule.description}</p>

                {/* Threshold specifications */}
                <div className="mt-3 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1.5 text-[11px]">
                  <div className="flex justify-between text-slate-400">
                    <span>Severity:</span>
                    <strong className="text-slate-200">{rule.severity}</strong>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Cooldown:</span>
                    <div className="flex items-center gap-1">
                      <strong className="text-amber-300">{rule.cooldownSeconds}s</strong>
                      {canConfigure && (
                        <button
                          onClick={() => {
                            const val = prompt('Set cooldown in seconds:', String(rule.cooldownSeconds));
                            if (val && !isNaN(Number(val))) {
                              handleUpdateCooldown(rule, Number(val));
                            }
                          }}
                          className="text-[10px] text-cyan-400 hover:underline"
                        >
                          edit
                        </button>
                      )}
                    </div>
                  </div>

                  {rule.thresholds.offlineSilenceSeconds !== undefined && (
                    <div className="flex justify-between text-slate-400">
                      <span>Offline Silence:</span>
                      <strong className="text-slate-200">{rule.thresholds.offlineSilenceSeconds}s ({Math.round(rule.thresholds.offlineSilenceSeconds / 60)}m)</strong>
                    </div>
                  )}

                  {rule.thresholds.stationaryMinutes !== undefined && (
                    <div className="flex justify-between text-slate-400">
                      <span>Stationary Dwell:</span>
                      <strong className="text-slate-200">{rule.thresholds.stationaryMinutes} minutes</strong>
                    </div>
                  )}

                  {rule.thresholds.routeDeviationMeters !== undefined && (
                    <div className="flex justify-between text-slate-400">
                      <span>Deviation Buffer:</span>
                      <strong className="text-slate-200">{rule.thresholds.routeDeviationMeters} meters</strong>
                    </div>
                  )}

                  {rule.thresholds.lowBatteryPercent !== undefined && (
                    <div className="flex justify-between text-slate-400">
                      <span>Battery Warning:</span>
                      <strong className="text-slate-200">{rule.thresholds.lowBatteryPercent}%</strong>
                    </div>
                  )}

                  <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-800/80">
                    <span>Auto-escalate to Incident:</span>
                    <strong className={rule.autoEscalateToIncident ? 'text-rose-400' : 'text-slate-400'}>
                      {rule.autoEscalateToIncident ? 'YES (Internal)' : 'NO'}
                    </strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. TAB 3: 10 ACCEPTANCE TEST SUITE */}
      {activeTab === 'TEST_SUITE' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-100">10 Authoritative Acceptance Tests</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Evaluates offline detection, duplicate suppression, incident correlation, geofence, RBAC, and zero regression.
              </p>
            </div>
            <button
              id="btn-run-acceptance-tests"
              onClick={handleRunAcceptanceTests}
              disabled={isRunningTests}
              className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              <Play className={`w-4 h-4 ${isRunningTests ? 'animate-spin' : ''}`} />
              <span>{isRunningTests ? 'Executing Test Suite...' : 'Run 10 Acceptance Tests'}</span>
            </button>
          </div>

          {testSuiteResults && (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
                  <span className="text-[11px] text-slate-400">Total Tests</span>
                  <p className="text-lg font-black text-slate-100 mt-0.5">{testSuiteResults.totalTests}</p>
                </div>
                <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-3 text-center">
                  <span className="text-[11px] text-emerald-400 font-semibold">Passed</span>
                  <p className="text-lg font-black text-emerald-300 mt-0.5">{testSuiteResults.passedTests}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
                  <span className="text-[11px] text-slate-400">Failed</span>
                  <p className="text-lg font-black text-slate-100 mt-0.5">{testSuiteResults.failedTests}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
                  <span className="text-[11px] text-slate-400">Suite Status</span>
                  <p className={`text-sm font-black mt-1 ${testSuiteResults.allPassed ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {testSuiteResults.allPassed ? '✓ ALL PASSED' : 'FAILURES DETECTED'}
                  </p>
                </div>
              </div>

              {/* 10 Detailed Test Results */}
              <div className="space-y-2">
                {testSuiteResults.results.map((res, idx) => (
                  <div
                    key={res.id}
                    id={`test-result-${res.id}`}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5">
                          {res.status === 'PASS' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-400" />
                          )}
                        </div>
                        <div>
                          <h5 className="text-xs font-bold text-slate-100">{res.name}</h5>
                          <p className="text-[11px] text-slate-400 mt-0.5">{res.requirement}</p>
                          <div className="mt-1 text-[11px] font-mono text-emerald-300/90 bg-emerald-950/40 px-2 py-1 rounded border border-emerald-500/20">
                            {res.actual}
                          </div>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black shrink-0 ${
                        res.status === 'PASS'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      }`}>
                        {res.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. TAB 4: CONDITION TESTER */}
      {activeTab === 'SIMULATE' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div>
            <h4 className="text-sm font-bold text-slate-100">Simulate & Evaluate Tracker Offline State</h4>
            <p className="text-xs text-slate-400 mt-1">
              Test how the safety automation layer handles silence durations against registered devices.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Target Device ID</label>
              <input
                type="text"
                value={testDeviceId}
                onChange={e => setTestDeviceId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 font-mono focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Simulated Silence Duration (Minutes)</label>
              <input
                type="number"
                min={1}
                max={180}
                value={testSilenceMinutes}
                onChange={e => setTestSilenceMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 font-mono focus:border-amber-400 focus:outline-none"
              />
            </div>
          </div>

          <button
            onClick={handleTestOfflineEval}
            className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black flex items-center gap-1.5 transition-all"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Trigger Offline Condition Evaluation</span>
          </button>

          {evalResult && (
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1">
              <div className="text-amber-300 font-bold">Evaluation Outcome:</div>
              <div>Alerts Triggered: <strong className="text-slate-100">{evalResult.alertsTriggered?.length || 0}</strong></div>
              <div>Alerts Suppressed (Cooldown): <strong className="text-slate-100">{evalResult.alertsSuppressed?.length || 0}</strong></div>
              <div>Correlated Incidents: <strong className="text-slate-100">{evalResult.correlatedIncidents?.length || 0}</strong></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
