import React, { useState, useEffect } from 'react';
import {
  Layers,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Play,
  ShieldCheck,
  Search,
  Code2,
  Terminal,
  Radio,
  FileCheck,
  Cpu,
  Lock,
  ArrowRight,
  Sparkles,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { api } from '../services/api.js';

interface ProtocolProfile {
  protocolId: string;
  protocolName: string;
  manufacturerOrStandard: string;
  version: string;
  description: string;
  transportSupported: string[];
  packetFramingSummary: string;
  checksumAlgorithm: string;
  downlinkAckFormat: string;
  heartbeatSupported: boolean;
  alarmSosSupported: boolean;
}

interface TestResult {
  id: string;
  name: string;
  requirement: string;
  expected: string;
  actual: string;
  status: 'PASS' | 'FAIL';
  error?: string;
  evidence?: any;
}

interface SuiteResult {
  suiteId: string;
  timestamp: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  allPassed: boolean;
  results: TestResult[];
}

export const ProtocolProfileManager: React.FC = () => {
  const [profiles, setProfiles] = useState<ProtocolProfile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);

  // Test suite state
  const [suiteResult, setSuiteResult] = useState<SuiteResult | null>(null);
  const [runningTests, setRunningTests] = useState(false);
  const [expandedTest, setExpandedTest] = useState<string | null>(null);

  // Packet inspector state
  const [inspectPacket, setInspectPacket] = useState(
    '787822221A080C0B281BCC027AC7EB0C46584900148E01940000000000000101F51DCD0D0A'
  );
  const [contextProtocol, setContextProtocol] = useState<string>('');
  const [inspectResult, setInspectResult] = useState<any | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    setLoadingProfiles(true);
    try {
      const data = await api.listProtocols();
      setProfiles(data);
    } catch (err: any) {
      console.error('Failed to load protocol profiles:', err);
    } finally {
      setLoadingProfiles(false);
    }
  };

  const runTestSuite = async () => {
    setRunningTests(true);
    try {
      const res = await api.runProtocolTestSuite();
      setSuiteResult(res);
      // Auto-expand first failed test or first test
      if (res.results.length > 0) {
        const failed = res.results.find(r => r.status === 'FAIL');
        setExpandedTest(failed ? failed.id : res.results[0].id);
      }
    } catch (err: any) {
      console.error('Failed to run protocol test suite:', err);
    } finally {
      setRunningTests(false);
    }
  };

  const handleInspect = async () => {
    if (!inspectPacket.trim()) return;
    setInspecting(true);
    setInspectError(null);
    try {
      const result = await api.inspectProtocolPacket(
        inspectPacket.trim(),
        contextProtocol || undefined
      );
      setInspectResult(result);
    } catch (err: any) {
      setInspectError(err.message || 'Inspection failed');
    } finally {
      setInspecting(false);
    }
  };

  const samplePackets = [
    {
      label: 'GT012 Binary (0x7878)',
      protocol: 'GT012',
      packet: '787822221A080C0B281BCC027AC7EB0C46584900148E01940000000000000101F51DCD0D0A'
    },
    {
      label: 'ASCII Delimited ($TRK)',
      protocol: 'ASCII',
      packet: '$TRK,DEV-ASCII-001,2026-09-06T07:00:00Z,-25.7500,28.2300,45.2,180,88,0*4A\r\n'
    },
    {
      label: 'Structured JSON',
      protocol: 'JSON',
      packet: '{"deviceId":"DEV-JSON-001","timestamp":"2026-09-06T07:00:00Z","latitude":-25.748,"longitude":28.225,"speed":32,"heading":90,"batteryLevel":95}'
    },
    {
      label: 'Unknown Framing (Reject)',
      protocol: '',
      packet: 'UNKNOWN_CUSTOM_PROTO_FRAME:9999,X,Y,Z#INVALID'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header & Architecture Architecture Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-indigo-500/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
                <Layers className="w-4 h-4 text-indigo-400" />
              </div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Multi-Tracker Protocol Profile Architecture
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] font-mono font-bold">
                MODULAR ENGINE ACTIVE
              </span>
            </div>
            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
              Extensible Strategy-pattern protocol abstraction decoupling GPS packet decoding, CRC-ITU/checksum validation, location/battery extraction, and protocol-specific downlink ACK encoding. ITIS easily accommodates multiple tracker manufacturers without touching gateway core.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={runTestSuite}
              disabled={runningTests}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold font-mono transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20"
            >
              <Play className={`w-3.5 h-3.5 ${runningTests ? 'animate-spin' : ''}`} />
              {runningTests ? 'Executing Acceptance Suite...' : 'Run 7 Acceptance Tests'}
            </button>
            <button
              onClick={loadProfiles}
              disabled={loadingProfiles}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
              title="Refresh profiles"
            >
              <RefreshCw className={`w-4 h-4 ${loadingProfiles ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Acceptance Test Suite Results (if triggered or available) */}
      {suiteResult && (
        <div className="p-5 rounded-2xl bg-slate-900/95 border border-indigo-500/30 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <FileCheck className="w-5 h-5 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">
                Protocol Architecture Acceptance Suite Results
              </h3>
              <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                suiteResult.allPassed
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              }`}>
                {suiteResult.passedTests} / {suiteResult.totalTests} PASSED
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {new Date(suiteResult.timestamp).toLocaleTimeString()}
            </span>
          </div>

          <div className="space-y-2">
            {suiteResult.results.map((test) => {
              const isExpanded = expandedTest === test.id;
              const isPass = test.status === 'PASS';
              return (
                <div
                  key={test.id}
                  className={`rounded-xl border transition-all ${
                    isPass
                      ? 'bg-slate-950/60 border-emerald-500/20 hover:border-emerald-500/40'
                      : 'bg-slate-950/60 border-rose-500/30 hover:border-rose-500/50'
                  }`}
                >
                  <button
                    onClick={() => setExpandedTest(isExpanded ? null : test.id)}
                    className="w-full px-4 py-3 text-left flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5">
                      {isPass ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      )}
                      <div>
                        <span className="text-xs font-bold text-white font-mono mr-2">
                          {test.id}
                        </span>
                        <span className="text-xs text-slate-300">
                          {test.name}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        isPass ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                      }`}>
                        {test.status}
                      </span>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-slate-800/80 space-y-2.5 text-xs">
                      <div>
                        <span className="text-slate-400 font-medium">Requirement: </span>
                        <span className="text-slate-200">{test.requirement}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-mono">
                        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                          <span className="text-indigo-400 font-bold block mb-1">Expected:</span>
                          <span className="text-slate-300 break-all">{test.expected}</span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                          <span className="text-emerald-400 font-bold block mb-1">Actual:</span>
                          <span className="text-slate-300 break-all">{test.actual}</span>
                        </div>
                      </div>
                      {test.evidence && (
                        <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 font-mono text-[10px] text-slate-300 overflow-x-auto">
                          <span className="text-slate-500 font-bold block mb-1">Authoritative Test Evidence:</span>
                          <pre>{JSON.stringify(test.evidence, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Registered Profiles List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-400" />
            Registered Tracker Protocol Profiles ({profiles.length})
          </h3>
          <span className="text-[11px] font-mono text-slate-500">
            Plug-and-play profile registry architecture
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {profiles.map((p) => (
            <div
              key={p.protocolId}
              className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-indigo-500/40 transition-all flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-xs font-mono font-bold">
                    {p.protocolId}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono text-emerald-400 bg-emerald-500/10">
                    {p.manufacturerOrStandard}
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">{p.protocolName}</h4>
                  <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">
                    {p.description}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-[11px] font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Framing:</span>
                  <span className="text-slate-200 font-bold">{p.packetFramingSummary}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Checksum:</span>
                  <span className="text-slate-200">{p.checksumAlgorithm}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Downlink ACK:</span>
                  <span className="text-cyan-300">{p.downlinkAckFormat}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Transports:</span>
                  <span className="text-slate-300">{p.transportSupported.join(', ')}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Protocol Packet Inspector */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Terminal className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="text-sm font-bold text-white">
                Live Protocol Packet Inspector & Framing Laboratory
              </h3>
              <p className="text-[11px] text-slate-400">
                Inspect raw inbound tracker frames, decode payload, verify checksums, and evaluate ACK specificity with zero learner PII leak.
              </p>
            </div>
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap gap-1.5">
            {samplePackets.map((s) => (
              <button
                key={s.label}
                onClick={() => {
                  setInspectPacket(s.packet);
                  setContextProtocol(s.protocol);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono border border-slate-700"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input Area */}
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-mono text-slate-400 font-bold flex justify-between">
              <span>Raw Packet Payload (Hex, Delimited ASCII, or JSON):</span>
              <span>Length: {inspectPacket.length} chars</span>
            </label>
            <textarea
              value={inspectPacket}
              onChange={(e) => setInspectPacket(e.target.value)}
              rows={3}
              placeholder="Paste raw packet hex (7878...) or ASCII ($TRK,...) or JSON ({&quot;deviceId&quot;...})..."
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-indigo-200 focus:outline-none focus:border-indigo-500/50"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400">Context Device Protocol (optional):</span>
              <select
                value={contextProtocol}
                onChange={(e) => setContextProtocol(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200"
              >
                <option value="">Auto-Detect via Framing</option>
                <option value="GT012">GT012 (Concox)</option>
                <option value="ASCII">ASCII</option>
                <option value="JSON">JSON</option>
              </select>
            </div>

            <button
              onClick={handleInspect}
              disabled={inspecting}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold font-mono transition-all flex items-center gap-2"
            >
              <Search className={`w-3.5 h-3.5 ${inspecting ? 'animate-spin' : ''}`} />
              {inspecting ? 'Decoding Frame...' : 'Inspect Frame'}
            </button>
          </div>
        </div>

        {/* Inspection Output */}
        {inspectError && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono">
            {inspectError}
          </div>
        )}

        {inspectResult && (
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 font-mono text-xs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-500 text-[10px] block mb-1">DETECTED PROTOCOL</span>
                <span className="text-sm font-bold text-indigo-300">
                  {inspectResult.detectedProtocol || 'UNKNOWN_PROTOCOL'}
                </span>
                <p className="text-[10px] text-slate-400 mt-1">
                  {inspectResult.detectionReason} (Confidence: {Math.round(inspectResult.detectionConfidence * 100)}%)
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-500 text-[10px] block mb-1">VALIDATION & CHECKSUM</span>
                <div className="flex items-center gap-2">
                  {inspectResult.validation?.validFraming && inspectResult.validation?.validChecksum ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> CRC / Framing Valid
                    </span>
                  ) : (
                    <span className="text-rose-400 font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Invalid / Framing Error
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {inspectResult.validation?.errors?.join(', ') || 'Zero framing violations'}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-500 text-[10px] block mb-1">PROTOCOL-SPECIFIC DOWNLINK ACK</span>
                <span className="text-[11px] font-bold text-cyan-300 break-all">
                  {inspectResult.ack?.ackPayload || 'No ACK Required'}
                </span>
                <p className="text-[10px] text-slate-400 mt-1">
                  Format: {inspectResult.ack?.ackFormat || 'N/A'} (Requires ACK: {String(inspectResult.ack?.requiresAck)})
                </p>
              </div>
            </div>

            {inspectResult.decoded && (
              <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>Decoded Physical Telemetry (Zero Learner PII):</span>
                  <span>Packet Type: {inspectResult.decoded.packetType}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Device ID:</span>
                    <span className="text-white">{inspectResult.decoded.deviceIdentifier || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Coordinates:</span>
                    <span className="text-white">
                      {inspectResult.decoded.extractedLocation 
                        ? `${inspectResult.decoded.extractedLocation.latitude}, ${inspectResult.decoded.extractedLocation.longitude}`
                        : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Speed & Heading:</span>
                    <span className="text-white">
                      {inspectResult.decoded.extractedLocation?.speed || 0} km/h, {inspectResult.decoded.extractedLocation?.heading || 0}°
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Battery:</span>
                    <span className="text-white">
                      {inspectResult.decoded.extractedBattery?.percentage 
                        ? `${inspectResult.decoded.extractedBattery.percentage}%`
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
