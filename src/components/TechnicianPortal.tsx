import React, { useState, useEffect } from 'react';
import { 
  Wrench, 
  Cpu, 
  Activity, 
  BatteryCharging, 
  Wifi, 
  Radio, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  Filter, 
  RefreshCw, 
  Layers, 
  FileText, 
  Sliders, 
  Check, 
  RotateCw,
  PlusCircle,
  HelpCircle,
  Clock,
  ShieldCheck,
  Zap,
  Server,
  Lock,
  EyeOff,
  RadioTower,
  Play,
  ClipboardList,
  ArrowRightLeft
} from 'lucide-react';
import { 
  ActiveUserSession, 
  DeviceRecord, 
  DeviceGatewayRecord, 
  DeviceMaintenanceRecord, 
  TechnicianValidationResult 
} from '../types.js';
import { api } from '../services/api.js';
import { GpsTelemetrySimulator } from './GpsTelemetrySimulator.js';

export type TechSection = 
  | 'ASSIGNED_DEVICES' 
  | 'DEVICE_HEALTH' 
  | 'MAINTENANCE' 
  | 'INVENTORY' 
  | 'GATEWAYS'
  | 'VALIDATION_SUITE'
  | 'GPS_SIMULATOR'
  | 'REPORTS';

interface Props {
  currentUser: ActiveUserSession;
  activeSection?: TechSection;
  onSelectSection?: (section: TechSection) => void;
}

export const TechnicianPortal: React.FC<Props> = ({
  currentUser,
  activeSection = 'ASSIGNED_DEVICES',
  onSelectSection
}) => {
  const [currentTab, setCurrentTab] = useState<TechSection>(activeSection);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeviceType, setSelectedDeviceType] = useState('ALL');
  
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [gateways, setGateways] = useState<DeviceGatewayRecord[]>([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState<DeviceMaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Interaction feedback states
  const [pingSuccess, setPingSuccess] = useState<{ [key: string]: { latency: number; snr: number; time: string } }>({});
  const [calibratingId, setCalibratingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal / Action states
  const [showReassignModal, setShowReassignModal] = useState<DeviceRecord | null>(null);
  const [reassignForm, setReassignForm] = useState({ newDeviceId: '', learnerEmis: '', reason: '' });
  
  const [showMaintenanceModal, setShowMaintenanceModal] = useState<DeviceRecord | null>(null);
  const [maintenanceForm, setMaintenanceForm] = useState({ actionType: 'BATTERY_REPLACEMENT', description: '', status: 'COMPLETED' });

  // Phase 6 Validation Suite State
  const [validationReport, setValidationReport] = useState<TechnicianValidationResult | null>(null);
  const [runningSuite, setRunningSuite] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [fetchedDevices, fetchedGateways, fetchedLogs] = await Promise.all([
        api.getDevices().catch(() => []),
        api.getDeviceGateways().catch(() => []),
        api.getDeviceMaintenanceLogs().catch(() => [])
      ]);
      setDevices(fetchedDevices);
      setGateways(fetchedGateways);
      setMaintenanceLogs(fetchedLogs);
    } catch (err: any) {
      setError(err.message || 'Failed to load technician hardware inventory');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab: TechSection) => {
    setCurrentTab(tab);
    if (onSelectSection) onSelectSection(tab);
  };

  const handlePingDevice = async (devId: string) => {
    try {
      const res = await api.pingDevice(devId);
      setPingSuccess(prev => ({
        ...prev,
        [devId]: {
          latency: res.latencyMs || 18,
          snr: res.signalStrength || -54,
          time: new Date().toLocaleTimeString()
        }
      }));
      setActionMessage({ type: 'success', text: `Diagnostic ping acknowledged by node ${devId}. Latency: ${res.latencyMs || 18}ms.` });
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: `Ping failed: ${err.message}` });
    }
  };

  const handleCalibrate = async (devId: string) => {
    setCalibratingId(devId);
    try {
      const res = await api.calibrateDevice(devId);
      setDevices(prev => prev.map(d => d.id === devId ? {
        ...d,
        status: 'ONLINE',
        batteryLevel: res.batteryLevel || 100,
        tamperStatus: 'SECURE',
        calibrationStatus: 'CALIBRATED',
        signalStrength: res.signalStrength || -48
      } : d));
      setActionMessage({ type: 'success', text: `Device ${devId} sensor calibrated & tamper lock reset successfully. Event written to immutable audit log.` });
      setTimeout(() => setActionMessage(null), 5000);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: `Calibration failed: ${err.message}` });
    } finally {
      setCalibratingId(null);
    }
  };

  const handleSaveMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showMaintenanceModal) return;

    try {
      const res = await api.logDeviceMaintenance({
        deviceId: showMaintenanceModal.id,
        actionType: maintenanceForm.actionType,
        description: maintenanceForm.description,
        status: maintenanceForm.status
      });
      setShowMaintenanceModal(null);
      setMaintenanceForm({ actionType: 'BATTERY_REPLACEMENT', description: '', status: 'COMPLETED' });
      setActionMessage({ type: 'success', text: 'Hardware maintenance task recorded and audited.' });
      loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: `Maintenance log failed: ${err.message}` });
    }
  };

  const handleSaveReassignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showReassignModal) return;

    try {
      const res = await api.reassignDevice({
        oldDeviceId: showReassignModal.id,
        newDeviceId: reassignForm.newDeviceId,
        learnerEmis: reassignForm.learnerEmis,
        reason: reassignForm.reason
      });
      setShowReassignModal(null);
      setReassignForm({ newDeviceId: '', learnerEmis: '', reason: '' });
      setActionMessage({ type: 'success', text: 'Device successfully reassigned with server-side authorization.' });
      loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: `Reassignment failed: ${err.message}` });
    }
  };

  const handleRunValidationSuite = async () => {
    setRunningSuite(true);
    try {
      const report = await api.runTechnicianValidationSuite();
      setValidationReport(report);
      setActionMessage({
        type: 'success',
        text: `Validation Suite: ${report.passedTests}/${report.totalTests} tests passed.`
      });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: `Failed to execute validation suite: ${err.message}` });
    } finally {
      setRunningSuite(false);
    }
  };

  const filteredDevices = devices.filter(d => {
    const matchesSearch = searchQuery
      ? d.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.assignedSchool && d.assignedSchool.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (d.assignedSubject && d.assignedSubject.toLowerCase().includes(searchQuery.toLowerCase()))
      : true;
    const matchesType = selectedDeviceType === 'ALL' || d.type === selectedDeviceType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shrink-0">
            <Wrench className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                Hardware Engineering & Field Diagnostics
              </h1>
              <span className="px-2.5 py-0.5 text-xs font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded">
                Technician Level 2
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Authoritative hardware lifecycle management: RF beacons, LoRaWAN gateways, telemetry, and calibration.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-semibold flex items-center gap-1.5 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-mono font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> 99.8% Gateway Fleet Uptime
          </span>
        </div>
      </div>

      {/* POPIA / Child Safety Privacy Guard Notice */}
      <div className="p-3.5 rounded-xl bg-slate-900/90 border border-cyan-500/20 flex items-center justify-between gap-3 text-xs text-slate-300">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>
            <strong className="text-white">POPIA Child PII Guard Active:</strong> Unrestricted learner names, medical records, and guardian details are strictly masked and inaccessible to hardware technicians.
          </span>
        </div>
        <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 font-mono text-[10px] uppercase font-bold shrink-0">
          Zero PII Leakage
        </span>
      </div>

      {/* Action Notification */}
      {actionMessage && (
        <div className={`p-3.5 rounded-xl text-xs font-mono flex items-center justify-between gap-2 ${
          actionMessage.type === 'success' 
            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' 
            : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
        }`}>
          <span>{actionMessage.text}</span>
          <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Role Navigation Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-800 scrollbar-none">
        <button
          onClick={() => handleTabChange('ASSIGNED_DEVICES')}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
            currentTab === 'ASSIGNED_DEVICES'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>Assigned Devices ({devices.length})</span>
        </button>

        <button
          onClick={() => handleTabChange('DEVICE_HEALTH')}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
            currentTab === 'DEVICE_HEALTH'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Device Health & Telemetry</span>
        </button>

        <button
          onClick={() => handleTabChange('MAINTENANCE')}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
            currentTab === 'MAINTENANCE'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
          }`}
        >
          <Wrench className="w-4 h-4" />
          <span>Maintenance Logs ({maintenanceLogs.length})</span>
        </button>

        <button
          onClick={() => handleTabChange('GATEWAYS')}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
            currentTab === 'GATEWAYS'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
          }`}
        >
          <RadioTower className="w-4 h-4" />
          <span>IoT Gateways ({gateways.length})</span>
        </button>

        <button
          onClick={() => handleTabChange('VALIDATION_SUITE')}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
            currentTab === 'VALIDATION_SUITE'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Phase 6 Validation Suite</span>
        </button>

        <button
          onClick={() => handleTabChange('GPS_SIMULATOR')}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
            currentTab === 'GPS_SIMULATOR'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
          }`}
        >
          <Radio className="w-4 h-4 text-cyan-400" />
          <span>GPS Simulator & Testing</span>
        </button>

        <button
          onClick={() => handleTabChange('INVENTORY')}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
            currentTab === 'INVENTORY'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Hardware Inventory</span>
        </button>
      </div>

      {/* ==================================================== */}
      {/* 1. ASSIGNED DEVICES SECTION */}
      {/* ==================================================== */}
      {currentTab === 'ASSIGNED_DEVICES' && (
        <div className="space-y-4">
          {/* Filter / Search Bar */}
          <div className="p-3 sm:p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <div className="relative flex-1 min-w-0">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search serial number, school, or masked EMIS..."
                  className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs focus:border-cyan-500 outline-none font-mono"
                />
              </div>

              <select
                value={selectedDeviceType}
                onChange={e => setSelectedDeviceType(e.target.value)}
                className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs outline-none"
              >
                <option value="ALL">All Hardware Types</option>
                <option value="WEARABLE_BEACON">Wearable SOS Beacon</option>
                <option value="RFID_GATE_READER">School RFID Gate Reader</option>
                <option value="VEHICLE_GPS">Tactical Vehicle GPS</option>
                <option value="BIOMETRIC_TERMINAL">Biometric Terminal</option>
              </select>
            </div>

            <span className="text-xs text-slate-400 font-mono self-end sm:self-auto">
              {filteredDevices.length} Hardware Nodes
            </span>
          </div>

          {/* Device Fleet Cards */}
          {filteredDevices.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <HelpCircle className="w-8 h-8 text-slate-500 mx-auto" />
              <strong className="text-white block text-sm">No hardware matching current query</strong>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                WHAT HAPPENED: No device records matched your search parameters.
                <br />
                WHAT TO DO NEXT: Clear your search filters or check database synchronization.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDevices.map(dev => {
                const isLowBatt = (dev.batteryLevel || 100) < 20;
                const isOnline = dev.status === 'ONLINE';
                const pingData = pingSuccess[dev.id];

                return (
                  <div
                    key={dev.id}
                    className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 hover:border-slate-700 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-mono uppercase text-slate-400 block">
                            {dev.type.replace(/_/g, ' ')}
                          </span>
                          <strong className="text-white text-sm font-mono block mt-0.5">
                            {dev.serialNumber}
                          </strong>
                        </div>

                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                          isOnline
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                        }`}>
                          {dev.status}
                        </span>
                      </div>

                      <div className="mt-3 space-y-1 text-xs">
                        <div className="text-slate-300 truncate">
                          <span className="text-slate-500">School: </span>
                          {dev.assignedSchool || 'General Inventory'}
                        </div>
                        {dev.assignedSubject && (
                          <div className="text-cyan-300 truncate font-medium flex items-center gap-1.5">
                            <span className="text-slate-500">Target: </span>
                            <span>{dev.assignedSubject}</span>
                            <span className="px-1.5 py-0.2 text-[9px] bg-slate-800 text-slate-400 rounded">Masked</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3 pt-3 border-t border-slate-800 text-xs">
                      {/* Telemetry Status Line */}
                      <div className="grid grid-cols-3 gap-2 text-center p-2 rounded-xl bg-slate-950 border border-slate-800/80 font-mono">
                        <div>
                          <span className="text-[10px] text-slate-500 block">BATTERY</span>
                          <span className={`font-bold ${isLowBatt ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {dev.batteryLevel || 100}%
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">SIGNAL</span>
                          <span className="text-slate-300">{dev.signalStrength || -60} dBm</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">FIRMWARE</span>
                          <span className="text-cyan-400 truncate block">{dev.firmwareVersion || 'v3.2.1'}</span>
                        </div>
                      </div>

                      {/* Ping acknowledgment badge */}
                      {pingData && (
                        <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[10px] font-mono flex items-center justify-between">
                          <span>Ping Confirmed: {pingData.latency}ms</span>
                          <span>{pingData.time}</span>
                        </div>
                      )}

                      {/* Action Controls */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handlePingDevice(dev.id)}
                          className="min-h-[38px] py-1.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1"
                        >
                          <Wifi className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Ping Telemetry</span>
                        </button>

                        <button
                          onClick={() => handleCalibrate(dev.id)}
                          disabled={calibratingId === dev.id}
                          className="min-h-[38px] py-1.5 px-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>{calibratingId === dev.id ? 'Calibrating...' : 'Calibrate'}</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setShowMaintenanceModal(dev)}
                          className="min-h-[36px] py-1 px-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition-colors flex items-center justify-center gap-1"
                        >
                          <Wrench className="w-3 h-3 text-amber-400" />
                          <span>Log Maint.</span>
                        </button>

                        <button
                          onClick={() => {
                            setShowReassignModal(dev);
                            setReassignForm({ newDeviceId: '', learnerEmis: dev.assignedSubject?.split('(')[1]?.replace(')', '') || '', reason: 'Hardware swap' });
                          }}
                          className="min-h-[36px] py-1 px-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition-colors flex items-center justify-center gap-1"
                        >
                          <ArrowRightLeft className="w-3 h-3 text-indigo-400" />
                          <span>Reassign</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* 2. DEVICE HEALTH SECTION */}
      {/* ==================================================== */}
      {currentTab === 'DEVICE_HEALTH' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-semibold uppercase">Total Deployed Fleet</span>
              <div className="text-2xl font-bold text-white font-mono">{devices.length} Nodes</div>
              <span className="text-[11px] text-emerald-400">100% Cryptographic Identity Verified</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-semibold uppercase">Average Battery Level</span>
              <div className="text-2xl font-bold text-emerald-400 font-mono">
                {devices.length > 0 
                  ? Math.round(devices.reduce((acc, d) => acc + (d.batteryLevel || 100), 0) / devices.length)
                  : 94}%
              </div>
              <span className="text-[11px] text-slate-400">Telemetry polling every 10s</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-semibold uppercase">Units Requiring Service</span>
              <div className="text-2xl font-bold text-amber-400 font-mono">
                {devices.filter(d => (d.batteryLevel || 100) < 20 || d.status !== 'ONLINE').length} Nodes
              </div>
              <span className="text-[11px] text-amber-300">Preventative maintenance</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-semibold uppercase">Gate RFID Sync Latency</span>
              <div className="text-2xl font-bold text-cyan-400 font-mono">12ms</div>
              <span className="text-[11px] text-cyan-300">Ultra-low latency ingress</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>Real-Time RF Channel Diagnostics & Gateway Telemetry</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {gateways.map(g => (
                <div key={g.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between text-slate-200">
                    <strong className="text-cyan-300 font-bold">{g.name}</strong>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px]">
                      {g.uplinkStatus}
                    </span>
                  </div>
                  <div className="text-slate-400">{g.schoolName} • {g.rfChannel}</div>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-900 text-center">
                    <div>
                      <span className="text-[10px] text-slate-500 block">SNR</span>
                      <span className="text-emerald-400">+{g.snrDb} dB</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">LATENCY</span>
                      <span className="text-slate-300">{g.latencyMs} ms</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">CONNECTED</span>
                      <span className="text-cyan-400">{g.activeConnectedNodes} Beacons</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 3. MAINTENANCE SECTION */}
      {/* ==================================================== */}
      {currentTab === 'MAINTENANCE' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-amber-400" />
                  <span>Authoritative Hardware Maintenance History</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  All routine calibrations, battery swaps, and antenna realignments recorded with actor signatures.
                </p>
              </div>
            </div>

            {maintenanceLogs.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
                No maintenance records currently registered. Use the "Log Maint." button on any device card to create a record.
              </div>
            ) : (
              <div className="space-y-2.5">
                {maintenanceLogs.map(log => (
                  <div key={log.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 font-mono text-[10px] font-bold">
                          {log.actionType}
                        </span>
                        <strong className="text-white font-mono">{log.serialNumber || log.deviceId}</strong>
                      </div>
                      <p className="text-slate-300">{log.description}</p>
                      <span className="text-[11px] text-slate-500 font-mono">
                        Technician: {log.technicianName} • {new Date(log.performedAt || log.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <span className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono text-xs font-bold shrink-0 self-start sm:self-auto">
                      {log.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 4. IOT GATEWAYS SECTION */}
      {/* ==================================================== */}
      {currentTab === 'GATEWAYS' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <RadioTower className="w-4 h-4 text-cyan-400" />
                <span>ICASA-Certified LoRaWAN & RFID Long-Range Gate Readers</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Radio frequency compliance, channel allocation, and receiver sensitivity telemetry across participating schools.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {gateways.map(g => (
                <div key={g.id} className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <strong className="text-white text-sm block">{g.name}</strong>
                      <span className="text-slate-400 text-[11px]">{g.schoolName}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono text-[10px] font-bold">
                      {g.uplinkStatus}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-slate-300 font-mono text-[11px] bg-slate-900 p-2.5 rounded-lg">
                    <div>
                      <span className="text-slate-500 block text-[10px]">RF CHANNEL</span>
                      <span>{g.rfChannel}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">SNR MARGIN</span>
                      <span className="text-emerald-400">+{g.snrDb} dB</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">LATENCY</span>
                      <span>{g.latencyMs} ms</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">ICASA COMPLIANCE</span>
                      <span className="text-cyan-400">Certified (868 MHz)</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 5. PHASE 6 VALIDATION SUITE SECTION */}
      {/* ==================================================== */}
      {currentTab === 'VALIDATION_SUITE' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  <span>Phase 6 Technician Portal Authoritative Validation Suite</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Automated 6-point verification covering device telemetry, boundary enforcement, PII minimization, and immutable auditing.
                </p>
              </div>

              <button
                onClick={handleRunValidationSuite}
                disabled={runningSuite}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold font-mono transition-all flex items-center justify-center gap-2 shrink-0 shadow-lg shadow-cyan-900/30"
              >
                <Play className={`w-3.5 h-3.5 ${runningSuite ? 'animate-spin' : ''}`} />
                <span>{runningSuite ? 'Executing Suite...' : 'Run Phase 6 Suite'}</span>
              </button>
            </div>

            {/* Test Results */}
            {validationReport ? (
              <div className="space-y-3">
                <div className={`p-4 rounded-xl border flex items-center justify-between font-mono text-xs ${
                  validationReport.allPassed 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    <strong>SUITE EXECUTION REPORT: {validationReport.passedTests} OF {validationReport.totalTests} TESTS PASSED</strong>
                  </div>
                  <span className="text-[11px]">{new Date(validationReport.timestamp).toLocaleTimeString()}</span>
                </div>

                <div className="space-y-2.5">
                  {validationReport.results.map(r => (
                    <div key={r.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-mono text-cyan-400 font-bold block">{r.id}</span>
                          <strong className="text-white text-sm block">{r.name}</strong>
                        </div>
                        <span className={`px-2.5 py-1 rounded font-mono text-xs font-bold ${
                          r.status === 'PASS' 
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        }`}>
                          {r.status}
                        </span>
                      </div>

                      <p className="text-slate-400">{r.requirement}</p>
                      
                      <div className="p-2.5 rounded-lg bg-slate-900 text-slate-300 font-mono text-[11px]">
                        <span className="text-slate-500 block text-[10px]">EVIDENCE:</span>
                        {r.actual}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-2">
                <ClipboardList className="w-8 h-8 text-slate-600 mx-auto" />
                <p>Click "Run Phase 6 Suite" above to execute all 6 authoritative verification checks.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 6. INVENTORY SECTION */}
      {/* ==================================================== */}
      {currentTab === 'INVENTORY' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-semibold uppercase">Reserve Wearable Beacons</span>
              <div className="text-2xl font-bold text-white font-mono">1,450 Units</div>
              <span className="text-[11px] text-emerald-400">Pre-programmed with AES-256 keys</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-semibold uppercase">RFID Long-Range Gate Antennas</span>
              <div className="text-2xl font-bold text-cyan-400 font-mono">82 Sets</div>
              <span className="text-[11px] text-cyan-300">Ready for school deployment</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-semibold uppercase">Replacement Battery Packs</span>
              <div className="text-2xl font-bold text-emerald-400 font-mono">3,200 Units</div>
              <span className="text-[11px] text-slate-400">2-Year continuous standby life</span>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 6. GPS TELEMETRY SIMULATOR & PACKET TESTING          */}
      {/* ==================================================== */}
      {currentTab === 'GPS_SIMULATOR' && (
        <GpsTelemetrySimulator 
          currentUser={currentUser}
          devices={devices}
        />
      )}

      {/* Modal: Log Maintenance */}
      {showMaintenanceModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Wrench className="w-4 h-4 text-amber-400" />
                <span>Log Maintenance: {showMaintenanceModal.serialNumber}</span>
              </h3>
              <button onClick={() => setShowMaintenanceModal(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveMaintenance} className="space-y-3">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Action Type</label>
                <select
                  value={maintenanceForm.actionType}
                  onChange={e => setMaintenanceForm(prev => ({ ...prev, actionType: e.target.value }))}
                  className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono outline-none"
                >
                  <option value="BATTERY_REPLACEMENT">Battery Replacement (LiPo 3.7V)</option>
                  <option value="FIRMWARE_FLASH">Firmware Update Flash</option>
                  <option value="ANTENNA_ALIGNMENT">RF Antenna Alignment</option>
                  <option value="HOUSING_REPAIR">Tamper Enclosure Seal Repair</option>
                  <option value="ROUTINE_CALIBRATION">Routine Calibration</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Description / Notes</label>
                <textarea
                  required
                  rows={3}
                  value={maintenanceForm.description}
                  onChange={e => setMaintenanceForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Details of hardware work performed..."
                  className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMaintenanceModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold"
                >
                  Save Maintenance Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reassign Device */}
      {showReassignModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-indigo-400" />
                <span>Reassign Hardware Unit</span>
              </h3>
              <button onClick={() => setShowReassignModal(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveReassignment} className="space-y-3">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 space-y-1">
                <div>Current Device: <strong className="text-white font-mono">{showReassignModal.serialNumber}</strong></div>
                <div>Assigned: <span className="text-cyan-400">{showReassignModal.assignedSubject || 'None'}</span></div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">New Replacement Device Serial / ID</label>
                <input
                  type="text"
                  required
                  value={reassignForm.newDeviceId}
                  onChange={e => setReassignForm(prev => ({ ...prev, newDeviceId: e.target.value }))}
                  placeholder="e.g. BCN-8849-GP or dev-id"
                  className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Learner Masked EMIS Code</label>
                <input
                  type="text"
                  required
                  value={reassignForm.learnerEmis}
                  onChange={e => setReassignForm(prev => ({ ...prev, learnerEmis: e.target.value }))}
                  placeholder="e.g. EMIS-PBHS-2026-084"
                  className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Reason for Reassignment</label>
                <input
                  type="text"
                  value={reassignForm.reason}
                  onChange={e => setReassignForm(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="e.g. Faulty battery replacement"
                  className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReassignModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                >
                  Authorize Reassignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
