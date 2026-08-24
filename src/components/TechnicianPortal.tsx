import React, { useState } from 'react';
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
  Server
} from 'lucide-react';
import { ActiveUserSession } from '../types.js';

export type TechSection = 
  | 'ASSIGNED_DEVICES' 
  | 'DEVICE_HEALTH' 
  | 'MAINTENANCE' 
  | 'INVENTORY' 
  | 'SERVICE_REQUESTS' 
  | 'REPORTS';

interface Props {
  currentUser: ActiveUserSession;
  activeSection?: TechSection;
  onSelectSection?: (section: TechSection) => void;
}

interface DeviceRecord {
  id: string;
  serialNumber: string;
  type: 'WEARABLE_BEACON' | 'RFID_GATE_READER' | 'VEHICLE_GPS' | 'BIOMETRIC_TERMINAL';
  assignedSchool: string;
  assignedSubject?: string;
  batteryLevel: number;
  signalStrength: number; // dBm e.g. -68
  firmwareVersion: string;
  status: 'ONLINE' | 'LOW_BATTERY' | 'OFFLINE' | 'MAINTENANCE_REQUIRED';
  lastHeartbeat: string;
}

export const TechnicianPortal: React.FC<Props> = ({
  currentUser,
  activeSection = 'ASSIGNED_DEVICES',
  onSelectSection
}) => {
  const [currentTab, setCurrentTab] = useState<TechSection>(activeSection);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeviceType, setSelectedDeviceType] = useState('ALL');
  const [pingSuccess, setPingSuccess] = useState<string | null>(null);
  const [calibratingId, setCalibratingId] = useState<string | null>(null);

  const [devices, setDevices] = useState<DeviceRecord[]>([
    {
      id: 'dev-001',
      serialNumber: 'BCN-8849-GP',
      type: 'WEARABLE_BEACON',
      assignedSchool: 'Pretoria Boys High School',
      assignedSubject: 'Katlego Molefe (EMIS-PBHS-2026-084)',
      batteryLevel: 94,
      signalStrength: -58,
      firmwareVersion: 'v3.2.1-sec',
      status: 'ONLINE',
      lastHeartbeat: '12 seconds ago'
    },
    {
      id: 'dev-002',
      serialNumber: 'BCN-9912-GP',
      type: 'WEARABLE_BEACON',
      assignedSchool: 'Pretoria Boys High School',
      assignedSubject: 'Sipho Ndlovu (EMIS-PBHS-2026-112)',
      batteryLevel: 88,
      signalStrength: -62,
      firmwareVersion: 'v3.2.1-sec',
      status: 'ONLINE',
      lastHeartbeat: '25 seconds ago'
    },
    {
      id: 'dev-003',
      serialNumber: 'GATE-NORTH-01',
      type: 'RFID_GATE_READER',
      assignedSchool: 'Pretoria Boys High School (North Gate)',
      batteryLevel: 100, // Mains powered
      signalStrength: -45,
      firmwareVersion: 'v4.0.8-rfid',
      status: 'ONLINE',
      lastHeartbeat: '3 seconds ago'
    },
    {
      id: 'dev-004',
      serialNumber: 'BCN-3301-WC',
      type: 'WEARABLE_BEACON',
      assignedSchool: 'Bishops Diocesan College',
      assignedSubject: 'Liam Van Der Merwe (EMIS-BDC-2026-019)',
      batteryLevel: 14,
      signalStrength: -82,
      firmwareVersion: 'v3.1.9-sec',
      status: 'LOW_BATTERY',
      lastHeartbeat: '1 minute ago'
    },
    {
      id: 'dev-005',
      serialNumber: 'VEH-SAPS-09',
      type: 'VEHICLE_GPS',
      assignedSchool: 'SAPS Sunnyside Sector 2',
      assignedSubject: 'Unit B Interceptor (SAPS-GP-9912)',
      batteryLevel: 99,
      signalStrength: -50,
      firmwareVersion: 'v2.8.4-saps',
      status: 'ONLINE',
      lastHeartbeat: '5 seconds ago'
    }
  ]);

  const handleTabChange = (tab: TechSection) => {
    setCurrentTab(tab);
    if (onSelectSection) onSelectSection(tab);
  };

  const handlePingDevice = (devId: string) => {
    setPingSuccess(devId);
    setTimeout(() => setPingSuccess(null), 2500);
  };

  const handleCalibrate = (devId: string) => {
    setCalibratingId(devId);
    setTimeout(() => {
      setCalibratingId(null);
      setDevices(prev => prev.map(d => d.id === devId ? { ...d, status: 'ONLINE', signalStrength: -48 } : d));
    }, 1500);
  };

  const filteredDevices = devices.filter(d => {
    const matchesSearch = searchQuery
      ? d.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.assignedSchool.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
              Diagnostics and device monitoring for optional school check-in gateways, support beacons, and vehicle units.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-mono font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> 98.4% Gateway Fleet Uptime
          </span>
        </div>
      </div>

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
          <span>Assigned Devices</span>
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
          <span>Device Health</span>
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
          <span>Maintenance</span>
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
          <span>Inventory</span>
        </button>

        <button
          onClick={() => handleTabChange('SERVICE_REQUESTS')}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
            currentTab === 'SERVICE_REQUESTS'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
          }`}
        >
          <RotateCw className="w-4 h-4" />
          <span>Service Requests</span>
        </button>

        <button
          onClick={() => handleTabChange('REPORTS')}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
            currentTab === 'REPORTS'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Reports</span>
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
                  placeholder="Search serial number, school, or learner..."
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
              </select>
            </div>

            <span className="text-xs text-slate-400 font-mono self-end sm:self-auto">
              {filteredDevices.length} Active Nodes
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
                WHAT TO DO NEXT: Clear your search filters or scan a new beacon barcode to register it.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDevices.map(dev => {
                const isLowBatt = dev.batteryLevel < 20;
                const isOnline = dev.status === 'ONLINE';

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
                          {dev.assignedSchool}
                        </div>
                        {dev.assignedSubject && (
                          <div className="text-cyan-300 truncate font-medium">
                            <span className="text-slate-500">Subject: </span>
                            {dev.assignedSubject}
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
                            {dev.batteryLevel}%
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">SIGNAL</span>
                          <span className="text-slate-300">{dev.signalStrength} dBm</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">FIRMWARE</span>
                          <span className="text-cyan-400 truncate block">{dev.firmwareVersion}</span>
                        </div>
                      </div>

                      {/* Action Controls */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handlePingDevice(dev.id)}
                          className="flex-1 min-h-[40px] py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Wifi className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{pingSuccess === dev.id ? 'Ping Acknowledged ✓' : 'Ping Telemetry'}</span>
                        </button>

                        <button
                          onClick={() => handleCalibrate(dev.id)}
                          disabled={calibratingId === dev.id}
                          className="flex-1 min-h-[40px] py-2 px-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>{calibratingId === dev.id ? 'Calibrating...' : 'Calibrate'}</span>
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
              <div className="text-2xl font-bold text-white font-mono">{devices.length} Units</div>
              <span className="text-[11px] text-emerald-400">100% Signal Coverage</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-semibold uppercase">Average Battery Level</span>
              <div className="text-2xl font-bold text-emerald-400 font-mono">87.8%</div>
              <span className="text-[11px] text-slate-400">Telemetry polling every 10s</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-semibold uppercase">Units Requiring Service</span>
              <div className="text-2xl font-bold text-amber-400 font-mono">1 Unit</div>
              <span className="text-[11px] text-amber-300">Low battery flagged</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-semibold uppercase">Gate RFID Synchronization</span>
              <div className="text-2xl font-bold text-cyan-400 font-mono">0.04s</div>
              <span className="text-[11px] text-cyan-300">Ultra-low latency ingress</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>Real-Time RF Channel Diagnostics & Gateway Status</span>
            </h3>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-300">
                <span>GATE-NORTH-01 (Pretoria Boys High): 868.1 MHz Channel 04</span>
                <span className="text-emerald-400">OPERATIONAL • SNR +28dB</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>GATE-SOUTH-02 (Pretoria Boys High): 868.3 MHz Channel 06</span>
                <span className="text-emerald-400">OPERATIONAL • SNR +31dB</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>GATE-MAIN-01 (Bishops Diocesan): 868.5 MHz Channel 08</span>
                <span className="text-emerald-400">OPERATIONAL • SNR +26dB</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 3. MAINTENANCE SECTION */}
      {/* ==================================================== */}
      {currentTab === 'MAINTENANCE' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Wrench className="w-4 h-4 text-amber-400" />
                <span>Scheduled Routine Maintenance Tasks</span>
              </h3>
              <button className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all">
                + Schedule Routine Job
              </button>
            </div>

            <div className="space-y-2.5">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <strong className="text-white block">Pretoria Boys High North Ingress Gate - Antenna Alignment</strong>
                  <span className="text-slate-400">Quarterly preventative calibration • Due in 12 days</span>
                </div>
                <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 font-mono">Routine Pending</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <strong className="text-white block">Beacon Battery Replacement Batch #4 (Cape Town Corridor)</strong>
                  <span className="text-slate-400">Lithium-Polymer 3.7V Swap • Due in 3 days</span>
                </div>
                <span className="px-2.5 py-1 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">Priority High</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 4. INVENTORY SECTION */}
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
      {/* 5. SERVICE REQUESTS SECTION */}
      {/* ==================================================== */}
      {currentTab === 'SERVICE_REQUESTS' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <RotateCw className="w-4 h-4 text-cyan-400" />
              <span>School Administration Hardware Support Tickets</span>
            </h3>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-mono text-[10px]">TICKET #SR-881</span>
                  <strong className="text-white">Pretoria Boys High — Additional Beacon Tag for Grade 8 Intake</strong>
                </div>
                <p className="text-slate-400">Requested by School Admin • Assigned to Technician Lead</p>
              </div>
              <span className="px-3 py-1 rounded-xl bg-cyan-600 text-white font-bold">In Progress</span>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 6. REPORTS SECTION */}
      {/* ==================================================== */}
      {currentTab === 'REPORTS' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              <span>Hardware Reliability & SLA Compliance Audit</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <strong className="text-white block">Monthly Hardware Availability Report (August 2026)</strong>
                <p className="text-slate-400">
                  Comprehensive breakdown of 99.98% beacon heartbeat reception across active school zones in Gauteng and Western Cape.
                </p>
                <button className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1">
                  Download Certified PDF →
                </button>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <strong className="text-white block">RFID Gate Calibration Log (ICASA Certified)</strong>
                <p className="text-slate-400">
                  Radio frequency emission certificates confirming compliance with national South African wireless communication standards.
                </p>
                <button className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1">
                  Download ICASA Compliance Cert →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
