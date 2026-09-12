import React, { useState, useEffect } from 'react';
import {
  Activity,
  Radio,
  RadioTower,
  Server,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Cpu,
  Lock,
  Clock,
  Layers,
  BarChart3,
  Play,
  FileCheck
} from 'lucide-react';
import { api } from '../services/api.js';
import {
  ActiveUserSession,
  OperationalTelemetryDiagnostics,
  TelemetryDiagnosticsTestSuiteResult
} from '../types.js';

interface Props {
  currentUser: ActiveUserSession;
}

export const TelemetryDiagnosticsDashboard: React.FC<Props> = ({ currentUser }) => {
  const [diagnostics, setDiagnostics] = useState<OperationalTelemetryDiagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Test Suite State
  const [runningSuite, setRunningSuite] = useState(false);
  const [testResult, setTestResult] = useState<TelemetryDiagnosticsTestSuiteResult | null>(null);
  const [showTestModal, setShowTestModal] = useState(false);

  const fetchDiagnostics = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const data = await api.getTelemetryDiagnostics();
      setDiagnostics(data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load telemetry diagnostics:', err);
      setError(err.message || 'Failed to fetch operational telemetry diagnostics');
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  // Polling interval
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchDiagnostics(false);
    }, 6000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleRunSuite = async () => {
    setRunningSuite(true);
    try {
      const res = await api.runTelemetryDiagnosticsSuite();
      setTestResult(res);
      setShowTestModal(true);
      // Refresh diagnostics to show any simulated packet updates
      await fetchDiagnostics(false);
    } catch (err: any) {
      setError(`Failed to execute acceptance suite: ${err.message}`);
    } finally {
      setRunningSuite(false);
    }
  };

  if (loading && !diagnostics) {
    return (
      <div id="telemetry-diagnostics-loading" className="p-8 flex flex-col items-center justify-center min-h-[360px] text-slate-400 gap-3">
        <RefreshCw className="w-7 h-7 animate-spin text-cyan-400" />
        <span className="text-sm font-medium">Connecting to Telemetry Diagnostics Engine...</span>
      </div>
    );
  }

  if (error && !diagnostics) {
    return (
      <div id="telemetry-diagnostics-error" className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex flex-col gap-3">
        <div className="flex items-center gap-2 font-bold">
          <AlertTriangle className="w-5 h-5 text-rose-400" />
          <span>Access / Ingestion Error</span>
        </div>
        <p className="text-sm text-slate-300">{error}</p>
        <div>
          <button
            id="retry-diagnostics-btn"
            onClick={() => fetchDiagnostics(true)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold"
          >
            Retry Diagnostics Connection
          </button>
        </div>
      </div>
    );
  }

  const { gatewayStatus, fleetHealth, metrics, recentEvents, retentionReadiness, accessMetadata } = diagnostics!;

  return (
    <div id="telemetry-diagnostics-container" className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-bold text-white tracking-wide">
              Operational Telemetry Diagnostics & Observability
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
              Live Ring Buffer
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time ingestion health, device fleet telemetry integrity, and controlled diagnostic logs for authorized ITIS personnel.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="toggle-autorefresh-btn"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors flex items-center gap-1.5 ${
              autoRefresh
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-slate-900 border-slate-700 text-slate-400'
            }`}
            title="Toggle 6-second auto polling"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{autoRefresh ? 'Live Auto-Poll (6s)' : 'Auto-Poll Paused'}</span>
          </button>

          <button
            id="manual-refresh-diagnostics-btn"
            onClick={() => fetchDiagnostics(true)}
            disabled={refreshing}
            className="min-h-[44px] px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            id="run-diagnostics-suite-btn"
            onClick={handleRunSuite}
            disabled={runningSuite}
            className="min-h-[44px] px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
          >
            {runningSuite ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>Run Acceptance Suite (6 Tests)</span>
          </button>
        </div>
      </div>

      {/* Security & Access Notice Banner */}
      <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          <Lock className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>
            <strong className="text-white">Security & Audit Boundary:</strong>{' '}
            Access scope is restricted to <span className="text-cyan-300 font-mono font-semibold">{accessMetadata.scope}</span>.
            PII masked: <span className="text-emerald-400 font-semibold">{accessMetadata.piiMasked ? 'YES (Role Policy)' : 'SYSTEM'}</span>.
            Zero credentials exposed: <span className="text-emerald-400 font-semibold">TRUE</span>.
          </span>
        </div>
        <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px] self-end md:self-auto">
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
          <span>Audited Session #{accessMetadata.actorUserId.slice(0, 8)}</span>
        </div>
      </div>

      {/* SECTION 1: TELEMETRY GATEWAY STATUS */}
      <div id="section-telemetry-gateway-status" className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <RadioTower className="w-4 h-4 text-cyan-400" />
            <span>Telemetry Gateway Status</span>
          </h3>
          <span className="text-[11px] font-mono text-slate-500">
            Pipeline: {gatewayStatus.pipelineHealth}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Pipeline Health */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-slate-400">Pipeline Health</span>
            <div className="mt-2 flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${
                gatewayStatus.pipelineHealth === 'HEALTHY' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`} />
              <span className="text-sm font-bold text-white tracking-wide">
                {gatewayStatus.pipelineHealth}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1">Real-time Stream</span>
          </div>

          {/* Simulator Status */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-slate-400">Simulator Status</span>
            <div className="mt-2 flex items-center gap-2">
              <Radio className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-bold text-white">
                {gatewayStatus.simulatorStatus}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1">Multi-Protocol Engine</span>
          </div>

          {/* TCP Readiness */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-slate-400">TCP Readiness</span>
            <div className="mt-2 flex items-center gap-2">
              <Server className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-bold text-white">
                {gatewayStatus.tcpReadiness}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1">Port {gatewayStatus.serverEnvironment.configuredTcpPort} (Sandboxed)</span>
          </div>

          {/* UDP Readiness */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-slate-400">UDP Readiness</span>
            <div className="mt-2 flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-bold text-white">
                {gatewayStatus.udpReadiness}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1">Port {gatewayStatus.serverEnvironment.configuredUdpPort} (Datagram)</span>
          </div>

          {/* Future Server Connection Status */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between col-span-2 sm:col-span-1">
            <span className="text-[11px] font-medium text-slate-400">Future Server Connection</span>
            <div className="mt-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-bold text-white">
                {gatewayStatus.futureServerConnectionStatus}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1">Independent Layer</span>
          </div>
        </div>
      </div>

      {/* SECTION 2: DEVICE FLEET HEALTH */}
      <div id="section-device-fleet-health" className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span>Device Fleet Health</span>
          </h3>
          <span className="text-[11px] font-mono text-slate-500">
            Total Monitored: {fleetHealth.totalDevices} Devices
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Total Devices */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-slate-400">Total Devices</span>
            <span className="text-2xl font-black text-white mt-1.5">{fleetHealth.totalDevices}</span>
            <span className="text-[10px] text-slate-500 mt-1">Fleet Inventory</span>
          </div>

          {/* Online */}
          <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Online
            </span>
            <span className="text-2xl font-black text-emerald-300 mt-1.5">{fleetHealth.online}</span>
            <span className="text-[10px] text-emerald-400/60 mt-1">Transmitting</span>
          </div>

          {/* Degraded */}
          <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-amber-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Degraded
            </span>
            <span className="text-2xl font-black text-amber-300 mt-1.5">{fleetHealth.degraded}</span>
            <span className="text-[10px] text-amber-400/60 mt-1">Low Batt / Latency</span>
          </div>

          {/* Offline */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-500" />
              Offline
            </span>
            <span className="text-2xl font-black text-slate-300 mt-1.5">{fleetHealth.offline}</span>
            <span className="text-[10px] text-slate-500 mt-1">No Heartbeat</span>
          </div>

          {/* Suspended */}
          <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/20 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-indigo-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-400" />
              Suspended
            </span>
            <span className="text-2xl font-black text-indigo-300 mt-1.5">{fleetHealth.suspended}</span>
            <span className="text-[10px] text-indigo-400/60 mt-1">Admin Hold</span>
          </div>

          {/* Retired */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-700" />
              Retired
            </span>
            <span className="text-2xl font-black text-slate-400 mt-1.5">{fleetHealth.retired}</span>
            <span className="text-[10px] text-slate-600 mt-1">Decommissioned</span>
          </div>
        </div>
      </div>

      {/* SECTION 3: TELEMETRY METRICS & RETENTION READINESS */}
      <div id="section-telemetry-metrics" className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            <span>Telemetry Metrics (Pre-Aggregated)</span>
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
              Retention Mode: {retentionReadiness.metricsEngineMode}
            </span>
            <span className="text-[11px] text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Zero Table Scans
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Packets Received */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-[11px] font-medium text-slate-400">Packets Received</span>
            <p className="text-xl font-black text-white mt-1.5 font-mono">{metrics.packetsReceived.toLocaleString()}</p>
            <span className="text-[10px] text-slate-500 mt-1 block">Total Ingest Stream</span>
          </div>

          {/* Packets Accepted */}
          <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
            <span className="text-[11px] font-medium text-emerald-400">Packets Accepted</span>
            <p className="text-xl font-black text-emerald-300 mt-1.5 font-mono">{metrics.packetsAccepted.toLocaleString()}</p>
            <span className="text-[10px] text-emerald-400/60 mt-1 block">Valid & Forwarded</span>
          </div>

          {/* Packets Rejected */}
          <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20">
            <span className="text-[11px] font-medium text-rose-400">Packets Rejected</span>
            <p className="text-xl font-black text-rose-300 mt-1.5 font-mono">{metrics.packetsRejected.toLocaleString()}</p>
            <span className="text-[10px] text-rose-400/60 mt-1 block">Malformed / Rogue</span>
          </div>

          {/* CRC Failures */}
          <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
            <span className="text-[11px] font-medium text-amber-400">CRC Failures</span>
            <p className="text-xl font-black text-amber-300 mt-1.5 font-mono">{metrics.crcFailures.toLocaleString()}</p>
            <span className="text-[10px] text-amber-400/60 mt-1 block">Checksum Invalid</span>
          </div>

          {/* Duplicates Suppressed */}
          <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
            <span className="text-[11px] font-medium text-indigo-400">Duplicates Suppressed</span>
            <p className="text-xl font-black text-indigo-300 mt-1.5 font-mono">{metrics.duplicatesSuppressed.toLocaleString()}</p>
            <span className="text-[10px] text-indigo-400/60 mt-1 block">Sliding Cache Hit</span>
          </div>

          {/* Unknown Devices */}
          <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20">
            <span className="text-[11px] font-medium text-purple-400">Unknown Devices</span>
            <p className="text-xl font-black text-purple-300 mt-1.5 font-mono">{metrics.unknownDevices.toLocaleString()}</p>
            <span className="text-[10px] text-purple-400/60 mt-1 block">Unregistered Node</span>
          </div>
        </div>
      </div>

      {/* SECTION 4: RECENT EVENTS (CONTROLLED DIAGNOSTICS) */}
      <div id="section-recent-events" className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>Recent Diagnostics Events</span>
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
              {recentEvents.length} in buffer (Max 200)
            </span>
          </div>
          <span className="text-[11px] text-slate-500">
            Zero Passwords / Secrets / Tokens Exposed
          </span>
        </div>

        <div className="border border-slate-800 rounded-2xl bg-slate-900/40 overflow-hidden">
          {recentEvents.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No recent diagnostic events captured in current ring buffer. Ingest telemetry packets or run the acceptance suite to populate live events.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 text-slate-400 sticky top-0 border-b border-slate-800 text-[11px] uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">Time</th>
                    <th className="py-3 px-4">Event Type</th>
                    <th className="py-3 px-4">Transport / Proto</th>
                    <th className="py-3 px-4">Device Identifier</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Diagnostic Code</th>
                    <th className="py-3 px-4">Sanitized Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {recentEvents.map((evt) => {
                    const isOk = evt.status === 'ACCEPTED' || evt.status === 'PROCESSED';
                    const isWarn = evt.status === 'SUPPRESSED' || evt.status === 'ALERT';
                    const isError = evt.status === 'REJECTED';

                    return (
                      <tr key={evt.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-4 text-slate-400 whitespace-nowrap text-[11px]">
                          {new Date(evt.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-2.5 px-4 font-sans font-medium text-slate-200 whitespace-nowrap">
                          {evt.eventType}
                        </td>
                        <td className="py-2.5 px-4 text-slate-400 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                            {evt.transport} / {evt.protocol}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-cyan-300 font-semibold whitespace-nowrap">
                          {evt.deviceIdentifier}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isOk
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : isWarn
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          }`}>
                            {evt.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-300 whitespace-nowrap">
                          {evt.diagnosticCode}
                        </td>
                        <td className="py-2.5 px-4 font-sans text-slate-400 max-w-[320px] truncate text-[11px]" title={evt.summary}>
                          {evt.summary}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ACCEPTANCE TEST SUITE MODAL */}
      {showTestModal && testResult && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">
                  Telemetry Diagnostics Acceptance Suite Results
                </h3>
              </div>
              <button
                onClick={() => setShowTestModal(false)}
                className="text-slate-400 hover:text-white text-sm px-2 py-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4">
              <div className={`p-4 rounded-xl flex items-center justify-between ${
                testResult.allPassed
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
              }`}>
                <div>
                  <h4 className="font-bold text-sm">
                    {testResult.allPassed ? 'ALL 6 ACCEPTANCE TESTS PASSED' : 'SUITE FAILURES DETECTED'}
                  </h4>
                  <p className="text-xs opacity-80 mt-0.5">
                    Verified against authoritative telemetry gateway & RBAC security requirements.
                  </p>
                </div>
                <div className="text-right font-mono">
                  <span className="text-xl font-black">{testResult.passedTests}</span>
                  <span className="text-xs opacity-70"> / {testResult.totalTests} Passed</span>
                </div>
              </div>

              <div className="space-y-2.5">
                {testResult.results.map((test) => (
                  <div
                    key={test.id}
                    className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-semibold text-xs text-white">
                        {test.status === 'PASS' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                        )}
                        <span>{test.name}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        test.status === 'PASS'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-rose-500/15 text-rose-400'
                      }`}>
                        {test.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 pl-6 space-y-0.5">
                      <div><strong className="text-slate-500">Requirement:</strong> {test.requirement}</div>
                      <div><strong className="text-slate-500">Actual:</strong> {test.actual}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowTestModal(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold"
              >
                Close Results
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
