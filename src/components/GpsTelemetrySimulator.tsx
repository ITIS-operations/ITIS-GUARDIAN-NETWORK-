import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  Cpu, 
  Send, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ShieldCheck, 
  Activity, 
  Battery, 
  Navigation, 
  Layers, 
  FileCode, 
  RefreshCw, 
  Copy, 
  Check, 
  Sliders, 
  Terminal,
  Play
} from 'lucide-react';
import { 
  ActiveUserSession, 
  DeviceRecord, 
  TelemetrySimulationResult,
  TelemetrySimulatorTestSuiteResult 
} from '../types.js';
import { api } from '../services/api.js';

interface Props {
  currentUser: ActiveUserSession;
  devices: DeviceRecord[];
}

export const GpsTelemetrySimulator: React.FC<Props> = ({ currentUser, devices }) => {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(devices[0]?.id || 'GT012-TRK-8812');
  const [protocolProfile, setProtocolProfile] = useState<'GT012' | 'SIMULATED_TEST_PROTOCOL'>('GT012');
  const [rawPacket, setRawPacket] = useState<string>('');
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; protocol: string; packetType: string; description: string; rawPacketHex: string }>>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationResult, setSimulationResult] = useState<TelemetrySimulationResult | null>(null);
  const [copiedAck, setCopiedAck] = useState<boolean>(false);

  // Test suite state
  const [suiteRunning, setSuiteRunning] = useState<boolean>(false);
  const [suiteResult, setSuiteResult] = useState<TelemetrySimulatorTestSuiteResult | null>(null);

  useEffect(() => {
    loadTemplates(selectedDeviceId);
  }, [selectedDeviceId]);

  const loadTemplates = async (devId: string) => {
    try {
      const tmpls = await api.getTelemetryTemplates(devId);
      setTemplates(tmpls);
      if (tmpls.length > 0 && !rawPacket) {
        setSelectedTemplateId(tmpls[0].id);
        setRawPacket(tmpls[0].rawPacketHex);
        setProtocolProfile(tmpls[0].protocol === 'SIMULATED_TEST_PROTOCOL' ? 'SIMULATED_TEST_PROTOCOL' : 'GT012');
      }
    } catch (err) {
      console.error('Failed to load telemetry templates:', err);
    }
  };

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const tmpl = templates.find(t => t.id === templateId);
    if (tmpl) {
      setRawPacket(tmpl.rawPacketHex);
      setProtocolProfile(tmpl.protocol === 'SIMULATED_TEST_PROTOCOL' ? 'SIMULATED_TEST_PROTOCOL' : 'GT012');
    }
  };

  const handleSendSimulation = async () => {
    if (!rawPacket.trim()) return;
    setIsSimulating(true);
    try {
      const result = await api.simulateTelemetry({
        rawPacket: rawPacket.trim(),
        targetDeviceId: selectedDeviceId,
        protocolFormat: protocolProfile
      });
      setSimulationResult(result);
    } catch (err: any) {
      setSimulationResult({
        status: 'PACKET_REJECTED',
        diagnosticCode: 'MALFORMED_PACKET',
        protocolName: protocolProfile,
        packetType: 'UNKNOWN',
        validationResult: {
          validFraming: false,
          validCrc: false,
          validCoordinates: false,
          validBattery: false,
          validSpeed: false,
          validHeading: false,
          validTimestamp: false,
          reason: err.message
        },
        processingTimestamp: new Date().toISOString(),
        error: err.message
      });
    } finally {
      setIsSimulating(false);
    }
  };

  const handleRunAcceptanceSuite = async () => {
    setSuiteRunning(true);
    try {
      const res = await api.runTelemetrySimulatorSuite();
      setSuiteResult(res);
    } catch (err) {
      console.error('Failed to run telemetry acceptance suite:', err);
    } finally {
      setSuiteRunning(false);
    }
  };

  const handleCopyAck = () => {
    if (simulationResult?.ackHex) {
      navigator.clipboard.writeText(simulationResult.ackHex);
      setCopiedAck(true);
      setTimeout(() => setCopiedAck(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Acceptance Suite Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Radio className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white tracking-wide">GPS Telemetry Simulator & Packet Testing</h2>
            <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px] font-mono font-bold uppercase">
              GT012 / Concox Binary
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Authoritative testing sandbox. Ingests raw binary hex and JSON packets through the authentic protocol validation pipeline without physical hardware.
          </p>
        </div>

        <button
          onClick={handleRunAcceptanceSuite}
          disabled={suiteRunning}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold font-mono flex items-center justify-center gap-2 shadow-sm transition-all shrink-0 disabled:opacity-50"
        >
          {suiteRunning ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          <span>{suiteRunning ? 'Running 8 Tests...' : 'Run Acceptance Test Suite (8/8)'}</span>
        </button>
      </div>

      {/* Acceptance Test Suite Results Banner if executed */}
      {suiteResult && (
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {suiteResult.allPassed ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-400" />
              )}
              <h3 className="text-sm font-bold text-white">
                Prompt 8 Acceptance Suite Results: {suiteResult.passedTests} / {suiteResult.totalTests} Passed
              </h3>
            </div>
            <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${
              suiteResult.allPassed 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
            }`}>
              {suiteResult.allPassed ? 'ALL CRITERIA VERIFIED' : 'TESTS FAILED'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {suiteResult.results.map(test => (
              <div 
                key={test.id}
                className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                  test.status === 'PASS' 
                    ? 'bg-slate-950/70 border-emerald-500/20' 
                    : 'bg-rose-950/20 border-rose-500/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-300">{test.name}</span>
                  <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    test.status === 'PASS' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                  }`}>
                    {test.status}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">{test.requirement}</p>
                <p className="text-[11px] font-mono text-cyan-300/90 truncate">{test.actual}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Simulator Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Simulator Controls & Input */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <span>Simulation Parameters</span>
            </h3>

            {/* Target Device Selector & Protocol Profile */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono text-slate-300 mb-1.5">
                  Target Registered Device
                </label>
                <select
                  value={selectedDeviceId}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  {devices.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.id} ({d.serialNumber || 'GT012'}) — {d.status}
                    </option>
                  ))}
                  <option value="GT012-TRK-8812">GT012-TRK-8812 (Authoritative Test Device)</option>
                  <option value="UNKNOWN-DEVICE-TEST">UNKNOWN-DEVICE-TEST (Unregistered Reject Test)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-300 mb-1.5">
                  Protocol Profile
                </label>
                <select
                  value={protocolProfile}
                  onChange={(e) => setProtocolProfile(e.target.value as any)}
                  className="w-full min-h-[44px] px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="GT012">GT012 Binary Concox (0x7878 / CRC-ITU)</option>
                  <option value="SIMULATED_TEST_PROTOCOL">SIMULATED_TEST_PROTOCOL (JSON/ASCII)</option>
                </select>
              </div>
            </div>

            {/* Preset Test Templates */}
            <div>
              <label className="block text-[11px] font-mono text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Preset Test Packet Templates</span>
                <span className="text-[10px] text-slate-500">Includes CRC & exact framing</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {templates.map(tmpl => (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => handleSelectTemplate(tmpl.id)}
                    className={`p-2.5 text-left rounded-xl border text-xs transition-all flex flex-col justify-between ${
                      selectedTemplateId === tmpl.id
                        ? 'bg-cyan-500/10 border-cyan-500 text-white shadow-sm'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-bold text-[11px]">{tmpl.name}</span>
                      <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-slate-800 text-slate-300">
                        {tmpl.packetType}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 line-clamp-1">{tmpl.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Raw Packet Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-mono text-slate-300 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Raw Packet Input (Hex / JSON)</span>
                </label>
                <span className="text-[10px] font-mono text-slate-400">
                  {rawPacket.replace(/\s+/g, '').length / 2} bytes
                </span>
              </div>
              <textarea
                value={rawPacket}
                onChange={(e) => setRawPacket(e.target.value)}
                rows={5}
                placeholder="Paste GT012 hex string (e.g. 7878...0D0A) or JSON packet..."
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500 resize-y"
              />
            </div>

            {/* Send Simulation Button */}
            <button
              onClick={handleSendSimulation}
              disabled={isSimulating || !rawPacket.trim()}
              className="w-full min-h-[44px] px-4 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 text-slate-950 font-bold font-mono text-xs flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
            >
              {isSimulating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>{isSimulating ? 'Processing Telemetry Pipeline...' : 'Send Simulated Packet to Ingestion Engine'}</span>
            </button>
          </div>
        </div>

        {/* Right Column: Processing Diagnostic Result */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 min-h-[480px]">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span>Packet Processing Result</span>
              </span>
              {simulationResult && (
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  simulationResult.status === 'SIMULATION_SUCCESS'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}>
                  {simulationResult.status}
                </span>
              )}
            </h3>

            {!simulationResult ? (
              <div className="h-80 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
                <Terminal className="w-8 h-8 mb-2 opacity-40 text-cyan-400" />
                <p className="font-mono text-slate-400">No simulation executed yet.</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Select a preset template and click &quot;Send Simulated Packet&quot; to inspect authoritative parsing diagnostics.
                </p>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                {/* Status & Diagnostic Code */}
                <div className={`p-3.5 rounded-xl border ${
                  simulationResult.status === 'SIMULATION_SUCCESS'
                    ? 'bg-emerald-500/5 border-emerald-500/20'
                    : 'bg-rose-500/5 border-rose-500/20'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono font-bold text-slate-300">Diagnostic Code</span>
                    <span className={`font-mono font-bold text-xs ${
                      simulationResult.status === 'SIMULATION_SUCCESS' ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {simulationResult.diagnosticCode}
                    </span>
                  </div>
                  {simulationResult.error && (
                    <p className="text-[11px] text-rose-300 mt-1 font-mono">{simulationResult.error}</p>
                  )}
                  {simulationResult.isDuplicate && (
                    <p className="text-[11px] text-amber-300 mt-1 font-mono">
                      Duplicate packet detected via cryptographic fingerprint. Telemetry deduplicated safely.
                    </p>
                  )}
                </div>

                {/* Identity & Registry Status */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">Protocol Identified:</span>
                    <span className="font-mono font-bold text-white">{simulationResult.protocolName}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">Packet Type:</span>
                    <span className="font-mono font-bold text-cyan-300">{simulationResult.packetType}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">Device Identifier:</span>
                    <span className="font-mono text-white">{simulationResult.deviceIdentifier || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">Registry Status:</span>
                    <span className={`font-mono font-bold ${
                      simulationResult.deviceRegistryStatus === 'ACTIVE' || simulationResult.deviceRegistryStatus === 'ASSIGNED'
                        ? 'text-emerald-400'
                        : simulationResult.deviceRegistryStatus === 'SUSPENDED'
                        ? 'text-amber-400'
                        : 'text-slate-400'
                    }`}>
                      {simulationResult.deviceRegistryStatus || 'UNREGISTERED'}
                    </span>
                  </div>
                </div>

                {/* Extracted Location & Telemetry */}
                {simulationResult.extractedLocation && (
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center gap-1.5 text-cyan-400 font-mono font-bold text-[11px] mb-1">
                      <Navigation className="w-3.5 h-3.5" />
                      <span>Extracted GPS Coordinates</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-500 block">Latitude</span>
                        <span className="font-mono font-bold text-white">
                          {simulationResult.extractedLocation.latitude.toFixed(6)}°
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Longitude</span>
                        <span className="font-mono font-bold text-white">
                          {simulationResult.extractedLocation.longitude.toFixed(6)}°
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Speed</span>
                        <span className="font-mono text-slate-300">
                          {simulationResult.extractedLocation.speed ?? 0} km/h
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Course / Heading</span>
                        <span className="font-mono text-slate-300">
                          {simulationResult.extractedLocation.heading ?? 0}°
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Battery & Hardware Status */}
                {simulationResult.extractedBattery && (
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Battery className="w-4 h-4 text-emerald-400" />
                      <span className="text-slate-400 text-[11px]">Device Battery</span>
                    </div>
                    <span className="font-mono font-bold text-white text-xs">
                      {simulationResult.extractedBattery.percentage}% (Level {simulationResult.extractedBattery.voltageLevel ?? 5})
                    </span>
                  </div>
                )}

                {/* Hardware Protocol ACK Response */}
                {simulationResult.requiresAck && simulationResult.ackHex && (
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono text-slate-400">GT012 Downlink ACK (10 Bytes)</span>
                      <button
                        onClick={handleCopyAck}
                        className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                      >
                        {copiedAck ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedAck ? 'Copied' : 'Copy Hex'}</span>
                      </button>
                    </div>
                    <div className="p-2 rounded bg-slate-900 font-mono text-[11px] text-emerald-300 break-all">
                      {simulationResult.ackHex}
                    </div>
                  </div>
                )}

                <div className="text-[10px] font-mono text-slate-500 text-right">
                  Processed at: {new Date(simulationResult.processingTimestamp).toLocaleTimeString()}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
