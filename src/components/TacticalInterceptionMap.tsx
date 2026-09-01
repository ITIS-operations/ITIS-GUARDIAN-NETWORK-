import React, { useState, useEffect } from 'react';
import { 
  Navigation, 
  Layers, 
  ZoomIn, 
  ZoomOut, 
  Crosshair, 
  Radio
} from 'lucide-react';
import { IncidentAlert, ResponderUnit } from '../types.js';

interface TacticalMapProps {
  incident: IncidentAlert;
  responders?: ResponderUnit[];
  activeResponder?: ResponderUnit | null;
  onSelectResponder?: (responder: ResponderUnit) => void;
  className?: string;
  height?: string;
}

export const TacticalInterceptionMap: React.FC<TacticalMapProps> = ({
  incident,
  responders = [],
  activeResponder,
  onSelectResponder,
  className = '',
  height = 'h-[440px]'
}) => {
  const [mapMode, setMapMode] = useState<'TACTICAL_DARK' | 'SATELLITE' | 'HIGH_CONTRAST'>('TACTICAL_DARK');
  const [showGeofences, setShowGeofences] = useState(true);
  const [showResponders, setShowResponders] = useState(true);
  const [showTrajectory, setShowTrajectory] = useState(true);
  const [showAccuracyRadius, setShowAccuracyRadius] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });

  // Animated responder progress simulation for demonstration & tracking
  const [interceptionProgress, setInterceptionProgress] = useState(0.35); // 0.0 to 1.0

  useEffect(() => {
    if (incident.status === 'DISPATCHED' || incident.status === 'ACTIVE_ALARM') {
      const timer = setInterval(() => {
        setInterceptionProgress(p => (p >= 0.95 ? 0.95 : p + 0.008));
      }, 2000);
      return () => clearInterval(timer);
    } else if (incident.status === 'ON_SCENE' || incident.status === 'RESOLVED') {
      setInterceptionProgress(1.0);
    }
  }, [incident.status]);

  // Incident target coordinates
  const incidentLat = incident.location?.lat || -25.7589;
  const incidentLng = incident.location?.lng || 28.2321;

  // Map viewport dimensions
  const svgWidth = 800;
  const svgHeight = 440;

  // Convert GPS delta to local SVG coordinate space
  const incidentSvgX = 480;
  const incidentSvgY = 190;

  const responderOriginSvgX = 180;
  const responderOriginSvgY = 320;

  // Current interpolated responder position
  const currentResponderX = responderOriginSvgX + (incidentSvgX - responderOriginSvgX) * interceptionProgress;
  const currentResponderY = responderOriginSvgY + (incidentSvgY - responderOriginSvgY) * interceptionProgress;

  // Pan and drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true);
    setStartPan({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPanOffset({
      x: e.clientX - startPan.x,
      y: e.clientY - startPan.y
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleResetView = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleFocusChild = () => {
    setZoomLevel(1.4);
    setPanOffset({ x: -100, y: 30 });
  };

  const handleFocusResponder = () => {
    setZoomLevel(1.4);
    setPanOffset({ x: 180, y: -100 });
  };

  // Nearby tactical units relative positions
  const nearbyUnits: ResponderUnit[] = responders.length > 0 ? responders : [
    {
      id: 'resp-pol-01',
      callSign: 'EAGLE-01',
      name: 'SAPS Sunnyside Patrol 01',
      unitType: 'NATIONAL_POLICE',
      vehicleId: 'SAPS-GP-9912',
      contactPhone: '+27 12 345 6789',
      currentLocation: {
        lat: -25.762,
        lng: 28.225,
        addressDescription: 'Sunnyside Sector 1'
      },
      status: 'AVAILABLE',
      capabilities: ['ARMED_TACTICAL', 'FIRST_AID']
    },
    {
      id: 'resp-sec-02',
      callSign: 'FALCON-04',
      name: 'Fidelity ADT Armed Tactical 04',
      unitType: 'PRIVATE_SECURITY',
      vehicleId: 'ADT-GP-412',
      contactPhone: '+27 11 999 0000',
      currentLocation: {
        lat: -25.751,
        lng: 28.241,
        addressDescription: 'Hatfield Safe Hub'
      },
      status: 'AVAILABLE',
      capabilities: ['ARMED_TACTICAL']
    },
    {
      id: 'resp-ems-03',
      callSign: 'MEDIC-911',
      name: 'Netcare 911 Trauma ALS',
      unitType: 'PARAMEDIC_EMS',
      vehicleId: 'NC-AMB-88',
      contactPhone: '+27 82 911 0000',
      currentLocation: {
        lat: -25.769,
        lng: 28.238,
        addressDescription: 'Brooklyn Medical Corridor'
      },
      status: 'AVAILABLE',
      capabilities: ['PARAMEDIC_ALS', 'DEFIBRILLATOR']
    }
  ];

  const getUnitIcon = (type: string) => {
    if (type.includes('POLICE') || type.includes('SAPS')) return '🚔';
    if (type.includes('EMS') || type.includes('PARAMEDIC')) return '🚑';
    return '🛡️';
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 select-none ${height} ${className}`}>
      
      {/* 1. MAP HEADER HUD OVERLAY */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        
        {/* Left HUD: Coordinates & Signal Telemetry */}
        <div className="pointer-events-auto flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 text-xs shadow-lg">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <Radio className="w-3.5 h-3.5 text-rose-400" />
            <span className="font-mono font-bold text-white">
              {incidentLat.toFixed(5)}° S, {incidentLng.toFixed(5)}° E
            </span>
          </div>
          <span className="text-slate-600">|</span>
          <span className="text-[11px] font-mono text-emerald-400 font-bold">
            GPS Lock: ±{incident.location?.accuracyMeters || 3.2}m
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-[11px] text-cyan-300 font-mono">
            Direct Distance: {((1 - interceptionProgress) * 1.8).toFixed(2)} km
          </span>
        </div>

        {/* Right HUD: Layer & Map Controls */}
        <div className="pointer-events-auto flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-700/80 shadow-lg text-xs">
          
          <button
            onClick={() => setMapMode(m => m === 'TACTICAL_DARK' ? 'SATELLITE' : m === 'SATELLITE' ? 'HIGH_CONTRAST' : 'TACTICAL_DARK')}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono font-bold text-[11px] flex items-center gap-1 transition-colors"
            title="Switch Map Theme"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>{mapMode === 'TACTICAL_DARK' ? 'TAC-DARK' : mapMode === 'SATELLITE' ? 'SATELLITE' : 'HI-CONTRAST'}</span>
          </button>

          <div className="h-4 w-px bg-slate-700 mx-0.5" />

          <button
            onClick={() => setShowGeofences(v => !v)}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${
              showGeofences ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'text-slate-500 hover:text-slate-300'
            }`}
            title="Toggle Safe Corridors & Geofences"
          >
            GEOFENCES
          </button>

          <button
            onClick={() => setShowResponders(v => !v)}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${
              showResponders ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' : 'text-slate-500 hover:text-slate-300'
            }`}
            title="Toggle Fleet Positions"
          >
            FLEET
          </button>

          <button
            onClick={() => setShowTrajectory(v => !v)}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${
              showTrajectory ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-500 hover:text-slate-300'
            }`}
            title="Toggle Interception Vector"
          >
            VECTOR
          </button>
        </div>
      </div>

      {/* 2. SVG INTERACTIVE TACTICAL CANVAS */}
      <div 
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-full transition-transform duration-75"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
            transformOrigin: 'center center'
          }}
        >
          <defs>
            {/* Dark Grid Pattern */}
            <pattern id="tactical-grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke={mapMode === 'SATELLITE' ? 'rgba(71, 85, 105, 0.2)' : 'rgba(30, 41, 59, 0.6)'} strokeWidth="1" />
              <circle cx="0" cy="0" r="1.5" fill="rgba(56, 189, 248, 0.3)" />
            </pattern>

            {/* Interception Trajectory Gradient */}
            <linearGradient id="trajectory-line" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#f43f5e" />
            </linearGradient>
          </defs>

          {/* Background Map Canvas Base */}
          <rect 
            width={svgWidth} 
            height={svgHeight} 
            fill={mapMode === 'SATELLITE' ? '#0f172a' : mapMode === 'HIGH_CONTRAST' ? '#020617' : '#030712'} 
          />

          {/* Tactical Grid Overlay */}
          <rect width={svgWidth} height={svgHeight} fill="url(#tactical-grid-pattern)" />

          {/* Major Safe Corridor Roads & Pathways */}
          <g id="safe-corridor-network" opacity={showGeofences ? "0.85" : "0.3"}>
            <path
              d="M 60,380 L 260,300 L 440,240 L 560,160 L 740,80"
              fill="none"
              stroke="#1e293b"
              strokeWidth="16"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 60,380 L 260,300 L 440,240 L 560,160 L 740,80"
              fill="none"
              stroke="#0284c7"
              strokeWidth="4"
              strokeDasharray="6,4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            <path
              d="M 320,40 L 440,240 L 520,400"
              fill="none"
              stroke="#1e293b"
              strokeWidth="12"
              strokeLinecap="round"
            />
            <path
              d="M 320,40 L 440,240 L 520,400"
              fill="none"
              stroke="#334155"
              strokeWidth="2"
              strokeLinecap="round"
            />

            {/* Safe Corridor Zone Perimeter Buffer */}
            {showGeofences && (
              <polygon
                points="420,110 600,120 620,240 450,260 390,180"
                fill="rgba(16, 185, 129, 0.08)"
                stroke="#10b981"
                strokeWidth="1.5"
                strokeDasharray="4,4"
              />
            )}
          </g>

          {/* School Campus Zone Hub */}
          <g id="school-campus-hub" transform="translate(560, 140)">
            <rect
              x="-45"
              y="-25"
              width="90"
              height="50"
              rx="8"
              fill="rgba(56, 189, 248, 0.12)"
              stroke="#0284c7"
              strokeWidth="1.5"
            />
            <text x="0" y="4" textAnchor="middle" fill="#38bdf8" fontSize="10" fontWeight="bold" fontFamily="monospace">
              🏫 {incident.schoolName ? incident.schoolName.substring(0, 16) : 'SCHOOL CAMPUS'}
            </text>
            <text x="0" y="16" textAnchor="middle" fill="#94a3b8" fontSize="8" fontFamily="monospace">
              SAFE ZONE GEOFENCE
            </text>
          </g>

          {/* Interception Waypoint Trajectory (Live Route) */}
          {showTrajectory && (
            <g id="interception-trajectory">
              <path
                d={`M ${responderOriginSvgX},${responderOriginSvgY} Q ${(responderOriginSvgX + incidentSvgX)/2 - 30},${(responderOriginSvgY + incidentSvgY)/2 + 20} ${incidentSvgX},${incidentSvgY}`}
                fill="none"
                stroke="url(#trajectory-line)"
                strokeWidth="3.5"
                strokeDasharray="6,4"
                strokeLinecap="round"
              />

              <line
                x1={currentResponderX}
                y1={currentResponderY}
                x2={incidentSvgX}
                y2={incidentSvgY}
                stroke="#f43f5e"
                strokeWidth="1.5"
                strokeDasharray="2,2"
                opacity="0.7"
              />
            </g>
          )}

          {/* Other Patrol Units in Sector */}
          {showResponders && nearbyUnits.map((u, i) => {
            if (u.id === activeResponder?.id) return null;
            const uX = 220 + (i * 190);
            const uY = 100 + (i * 120);

            return (
              <g 
                key={u.id} 
                transform={`translate(${uX}, ${uY})`}
                className="cursor-pointer hover:opacity-100 transition-opacity"
                onClick={() => onSelectResponder?.(u)}
              >
                <circle r="14" fill="#0f172a" stroke="#3b82f6" strokeWidth="1.5" />
                <text x="0" y="4" textAnchor="middle" fontSize="12">
                  {getUnitIcon(u.unitType)}
                </text>
                <rect x="-40" y="18" width="80" height="18" rx="4" fill="#020617" stroke="#1e293b" strokeWidth="1" />
                <text x="0" y="30" textAnchor="middle" fill="#94a3b8" fontSize="8" fontWeight="bold" fontFamily="monospace">
                  {u.vehicleId || u.name.substring(0, 10)}
                </text>
              </g>
            );
          })}

          {/* ACTIVE DISPATCHED RESPONDER PIN */}
          <g id="active-responder-pin" transform={`translate(${currentResponderX}, ${currentResponderY})`}>
            <circle r="22" fill="rgba(56, 189, 248, 0.15)" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3,3" className="animate-spin" />
            <circle r="15" fill="#0284c7" stroke="#ffffff" strokeWidth="2" />
            
            <path d="M 0,-18 L 4,-12 L -4,-12 Z" fill="#38bdf8" />

            <text x="0" y="4" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold">
              🚔
            </text>

            <g transform="translate(0, 24)">
              <rect x="-65" y="0" width="130" height="28" rx="6" fill="#090d16" stroke="#0284c7" strokeWidth="1.5" />
              <text x="0" y="12" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold" fontFamily="monospace">
                {activeResponder?.name ? activeResponder.name.substring(0, 16) : 'SAPS GP-9912 (PATROL 01)'}
              </text>
              <text x="0" y="22" textAnchor="middle" fill="#38bdf8" fontSize="8" fontWeight="bold" fontFamily="monospace">
                ETA: {Math.max(1, Math.round((1 - interceptionProgress) * 4))} MIN • 48 KM/H
              </text>
            </g>
          </g>

          {/* INCIDENT TARGET PIN */}
          <g id="child-distress-beacon" transform={`translate(${incidentSvgX}, ${incidentSvgY})`}>
            {showAccuracyRadius && (
              <>
                <circle r="60" fill="rgba(244, 63, 94, 0.08)" stroke="#f43f5e" strokeWidth="1" strokeDasharray="4,4" />
                <circle r="36" fill="rgba(244, 63, 94, 0.15)" stroke="#f43f5e" strokeWidth="1.5" />
                <circle r="18" fill="rgba(244, 63, 94, 0.3)" className="animate-ping" />
              </>
            )}

            <circle r="14" fill="#e11d48" stroke="#ffffff" strokeWidth="2.5" />
            <text x="0" y="4" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="black">
              🆘
            </text>

            <g transform="translate(0, -22)">
              <rect x="-70" y="-32" width="140" height="32" rx="6" fill="#090d16" stroke="#f43f5e" strokeWidth="1.5" />
              <text x="0" y="-18" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="black">
                {incident.learnerName || 'REGISTERED LEARNER'}
              </text>
              <text x="0" y="-7" textAnchor="middle" fill="#fca5a5" fontSize="8" fontWeight="bold" fontFamily="monospace">
                {incident.location?.addressDescription ? incident.location.addressDescription.substring(0, 22) : 'Distress Origin'}
              </text>
            </g>
          </g>
        </svg>
      </div>

      {/* 3. MAP BOTTOM CONTROLS & ZOOM TOOLBAR */}
      <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-700/80 shadow-lg text-xs">
          <button
            onClick={handleFocusChild}
            className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[11px] font-bold flex items-center gap-1 transition-colors"
          >
            <Crosshair className="w-3.5 h-3.5 text-rose-400" />
            <span>Target Child</span>
          </button>

          <button
            onClick={handleFocusResponder}
            className="px-2.5 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 text-[11px] font-bold flex items-center gap-1 transition-colors"
          >
            <Navigation className="w-3.5 h-3.5 text-blue-400" />
            <span>Target Unit</span>
          </button>

          <button
            onClick={handleResetView}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold transition-colors"
          >
            Fit View
          </button>
        </div>

        <div className="pointer-events-auto flex items-center gap-1 bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-700/80 shadow-lg">
          <button
            onClick={() => setZoomLevel(z => Math.min(2.5, z + 0.25))}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          
          <span className="text-[11px] font-mono text-slate-400 px-1 font-bold">
            {Math.round(zoomLevel * 100)}%
          </span>

          <button
            onClick={() => setZoomLevel(z => Math.max(0.6, z - 0.25))}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
