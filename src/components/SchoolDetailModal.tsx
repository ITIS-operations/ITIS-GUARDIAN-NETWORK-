import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  X, 
  Users, 
  Shield, 
  MapPin, 
  Phone, 
  Mail, 
  User, 
  Search, 
  Printer, 
  Radio, 
  Car, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Compass, 
  Zap, 
  ChevronRight,
  ShieldAlert,
  GraduationCap,
  Sparkles,
  Info
} from 'lucide-react';
import { School, HydratedLearnerRecord, NearbyResponderItem } from '../types.js';
import { api } from '../services/api.js';
import { LearnerSmartIdModal } from './LearnerSmartIdModal.js';

interface Props {
  school: School;
  onClose: () => void;
}

export const SchoolDetailModal: React.FC<Props> = ({ school, onClose }) => {
  const [activeTab, setActiveTab] = useState<'LEARNERS' | 'RESPONDERS' | 'GEOFENCE'>('LEARNERS');
  
  // Learners state
  const [learners, setLearners] = useState<HydratedLearnerRecord[]>([]);
  const [learnersLoading, setLearnersLoading] = useState(true);
  const [learnerSearch, setLearnerSearch] = useState('');
  const [selectedLearnerForId, setSelectedLearnerForId] = useState<HydratedLearnerRecord | null>(null);

  // Nearby Responders state
  const [nearbyResponders, setNearbyResponders] = useState<NearbyResponderItem[]>([]);
  const [respondersLoading, setRespondersLoading] = useState(true);
  const [responderDisclaimer, setResponderDisclaimer] = useState<string>('');

  // School detail stats
  const [schoolStats, setSchoolStats] = useState<{ enrolledLearnersCount?: number } | null>(null);

  useEffect(() => {
    // Load enrolled learners for this school
    const loadLearners = async () => {
      setLearnersLoading(true);
      try {
        const res = await api.getPaginatedLearners({ schoolId: school.id, limit: 100 });
        setLearners(res.data);
      } catch (err) {
        console.error('Failed to load enrolled learners for school:', err);
      } finally {
        setLearnersLoading(false);
      }
    };

    // Load nearby first responders for this school
    const loadNearbyResponders = async () => {
      setRespondersLoading(true);
      try {
        const res = await api.getSchoolNearbyResponders(school.id);
        setNearbyResponders(res.responders || []);
        setResponderDisclaimer(res.disclaimer || '');
      } catch (err) {
        console.error('Failed to load nearby responders:', err);
      } finally {
        setRespondersLoading(false);
      }
    };

    // Load school detail with count
    const loadSchoolDetail = async () => {
      try {
        const detail = await api.getSchoolById(school.id);
        setSchoolStats({ enrolledLearnersCount: detail.enrolledLearnersCount });
      } catch {
        // non-blocking fallback
      }
    };

    loadLearners();
    loadNearbyResponders();
    loadSchoolDetail();
  }, [school.id]);

  const filteredLearners = learners.filter(l => {
    const q = learnerSearch.toLowerCase().trim();
    if (!q) return true;
    const name = `${l.person.firstName} ${l.person.lastName}`.toLowerCase();
    const adm = (l.learner.admissionNumber || '').toLowerCase();
    const grade = (l.currentAcademicRecord?.grade || '').toLowerCase();
    return name.includes(q) || adm.includes(q) || grade.includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
      <div 
        id="modal-school-detail-container"
        className="relative w-full max-w-5xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-6 max-h-[94vh] flex flex-col"
      >
        {/* Modal Header */}
        <div className="px-6 py-5 bg-slate-950 border-b border-slate-800 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/30 text-[#d4af37] shrink-0 mt-0.5">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-wide">
                  {school.name}
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-800 text-slate-300 border border-slate-700">
                  EMIS: {school.emisCode}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Safe Campus Active
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#d4af37]" />
                  {school.district}, {school.province}
                </span>
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  Principal: {school.principalName}
                </span>
                {school.contactPhone && (
                  <span className="flex items-center gap-1 font-mono">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    {school.contactPhone}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Operational Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-slate-800 border-b border-slate-800 text-xs">
          <div className="p-3.5 bg-slate-900 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono text-slate-400">Enrolled Learners</div>
              <div className="text-sm font-bold text-white font-mono">
                {schoolStats?.enrolledLearnersCount ?? learners.length} Active
              </div>
            </div>
          </div>

          <div className="p-3.5 bg-slate-900 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono text-slate-400">Nearby Responders</div>
              <div className="text-sm font-bold text-emerald-300 font-mono">
                {nearbyResponders.filter(r => r.status === 'AVAILABLE').length} Available
              </div>
            </div>
          </div>

          <div className="p-3.5 bg-slate-900 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono text-slate-400">Safeguard Radius</div>
              <div className="text-sm font-bold text-white font-mono">
                {school.geofenceCenter?.radiusMeters || 500}m Geofence
              </div>
            </div>
          </div>

          <div className="p-3.5 bg-slate-900 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#d4af37]/10 text-[#d4af37]">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono text-slate-400">Tactical Channel</div>
              <div className="text-sm font-bold text-[#d4af37] font-mono truncate">
                TETRA TAC-04
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 bg-slate-950/80 border-b border-slate-800 flex items-center gap-2">
          <button
            id="tab-school-learners"
            onClick={() => setActiveTab('LEARNERS')}
            className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'LEARNERS'
                ? 'border-[#d4af37] text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Enrolled Learners ({learners.length})</span>
          </button>

          <button
            id="tab-school-responders"
            onClick={() => setActiveTab('RESPONDERS')}
            className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'RESPONDERS'
                ? 'border-[#d4af37] text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Nearby First Responders ({nearbyResponders.length})</span>
          </button>

          <button
            id="tab-school-geofence"
            onClick={() => setActiveTab('GEOFENCE')}
            className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'GEOFENCE'
                ? 'border-[#d4af37] text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Campus Geofence &amp; Safeguard Zone</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* TAB 1: ENROLLED LEARNERS */}
          {activeTab === 'LEARNERS' && (
            <div className="space-y-4">
              {/* Search & Filter Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search by learner name, admission #..."
                    value={learnerSearch}
                    onChange={e => setLearnerSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-[#d4af37]"
                  />
                </div>

                <div className="text-xs text-slate-400 font-mono">
                  Showing {filteredLearners.length} of {learners.length} enrolled
                </div>
              </div>

              {/* Learners List / Table */}
              {learnersLoading ? (
                <div className="py-12 text-center text-slate-500 text-xs font-mono">
                  Loading enrolled learners registry...
                </div>
              ) : filteredLearners.length === 0 ? (
                <div className="py-12 text-center rounded-2xl bg-slate-950 border border-slate-800 p-6 space-y-2">
                  <GraduationCap className="w-8 h-8 text-slate-600 mx-auto" />
                  <div className="text-sm font-bold text-slate-300">No Enrolled Learners Found</div>
                  <p className="text-xs text-slate-500">
                    {learnerSearch ? 'No learner matches your search query.' : 'No learners currently assigned to this campus.'}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/90 text-slate-400 font-mono uppercase text-[10px] border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Learner Identity</th>
                        <th className="py-3 px-3">Admission / ID</th>
                        <th className="py-3 px-3">Grade &amp; Section</th>
                        <th className="py-3 px-3">Enrolment Status</th>
                        <th className="py-3 px-3">Authorised Guardian</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredLearners.map(item => {
                        const learnerFullName = `${item.person.firstName} ${item.person.lastName}`;
                        const primaryGuardian = item.guardians?.[0];
                        const guardianName = primaryGuardian?.person 
                          ? `${primaryGuardian.person.firstName} ${primaryGuardian.person.lastName}`
                          : 'Linked Guardian';

                        return (
                          <tr key={item.learner.id} className="hover:bg-slate-900/50 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                {item.learner.photoUrl ? (
                                  <img 
                                    src={item.learner.photoUrl} 
                                    alt={learnerFullName}
                                    className="w-8 h-8 rounded-lg object-cover border border-slate-700 shrink-0"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold font-mono text-xs shrink-0">
                                    {item.person.firstName[0]}{item.person.lastName[0]}
                                  </div>
                                )}
                                <div>
                                  <div className="font-bold text-white text-xs">{learnerFullName}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    DOB: {item.person.dateOfBirth || 'Verified'}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-3 font-mono font-medium text-slate-300">
                              {item.learner.admissionNumber || item.learner.id}
                            </td>

                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono text-[10px] border border-slate-700">
                                {item.currentAcademicRecord?.grade || 'Grade 10'} • {item.currentAcademicRecord?.classSection || 'Sec A'}
                              </span>
                            </td>

                            <td className="py-3 px-3">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                {item.learner.enrolmentStatus || 'ACTIVE'}
                              </span>
                            </td>

                            <td className="py-3 px-3">
                              <div className="text-slate-300 text-xs">{guardianName}</div>
                              {primaryGuardian?.person?.mobileNumber && (
                                <div className="text-[10px] text-slate-500 font-mono">
                                  {primaryGuardian.person.mobileNumber}
                                </div>
                              )}
                            </td>

                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => setSelectedLearnerForId(item)}
                                className="px-3 py-1.5 rounded-lg bg-[#d4af37]/15 hover:bg-[#d4af37]/25 text-[#d4af37] border border-[#d4af37]/30 text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer"
                                title="Generate and Print Smart ID Card"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Print Smart ID</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: NEARBY FIRST RESPONDERS */}
          {activeTab === 'RESPONDERS' && (
            <div className="space-y-4">
              {/* Important Governance Notice Banner */}
              <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-3">
                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-amber-300">
                    Operational Situational Awareness Notice
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    {responderDisclaimer || 'Nearby responder display is for operational situational awareness only. In accordance with platform protocols, automatic dispatch is strictly governed by the Command Centre incident lifecycle.'}
                  </p>
                </div>
              </div>

              {respondersLoading ? (
                <div className="py-12 text-center text-slate-500 text-xs font-mono">
                  Calculating nearby tactical responder coordinates...
                </div>
              ) : nearbyResponders.length === 0 ? (
                <div className="py-12 text-center rounded-2xl bg-slate-950 border border-slate-800 p-6 space-y-2">
                  <Shield className="w-8 h-8 text-slate-600 mx-auto" />
                  <div className="text-sm font-bold text-slate-300">No Tactical Units Active Nearby</div>
                  <p className="text-xs text-slate-500">
                    No authorised First Responders currently reporting active coordinates within this district perimeter.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {nearbyResponders.map(resp => {
                    const isAvailable = resp.status === 'AVAILABLE';
                    const isLive = resp.locationFreshness === 'LIVE';
                    const isStale = resp.locationFreshness === 'STALE';

                    return (
                      <div 
                        key={resp.id}
                        className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all space-y-3"
                      >
                        {/* Top row */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-sm font-sans">
                                {resp.name}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[#d4af37] font-mono font-bold text-[10px]">
                                {resp.callSign}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              {resp.organization}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="text-base font-extrabold text-white font-mono">
                              {resp.distanceDisplay}
                            </div>
                            <div className="text-[9.5px] uppercase font-mono text-slate-400">
                              Proximity
                            </div>
                          </div>
                        </div>

                        {/* Status & Freshness Row */}
                        <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
                          <span className={`px-2 py-0.5 rounded-full font-bold uppercase border ${
                            isAvailable 
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}>
                            {resp.status}
                          </span>

                          <span className={`px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                            isLive 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : isStale
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : 'bg-slate-800 text-slate-500 border-slate-700'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : isStale ? 'bg-amber-400' : 'bg-slate-500'}`} />
                            {isLive ? 'Location updated recently' : isStale ? 'Location is stale' : 'Location unavailable'}
                          </span>

                          {resp.vehicleId && (
                            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1">
                              <Car className="w-3 h-3 text-slate-500" />
                              {resp.vehicleId}
                            </span>
                          )}
                        </div>

                        {/* Capabilities */}
                        {resp.capabilities && resp.capabilities.length > 0 && (
                          <div className="pt-2 border-t border-slate-900 flex flex-wrap gap-1">
                            {resp.capabilities.map(cap => (
                              <span key={cap} className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 text-[10px] border border-slate-800">
                                {cap}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CAMPUS GEOFENCE & SAFEGUARD ZONE */}
          {activeTab === 'GEOFENCE' && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                <div className="flex items-center gap-2">
                  <Compass className="w-5 h-5 text-[#d4af37]" />
                  <h4 className="text-sm font-bold text-white tracking-wide">
                    Authoritative Campus Safe Zone Geofence
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-mono">Geofence Latitude</div>
                    <div className="text-sm font-bold text-white font-mono mt-0.5">
                      {school.geofenceCenter?.lat ? Number(school.geofenceCenter.lat).toFixed(6) : '-25.758900'}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-mono">Geofence Longitude</div>
                    <div className="text-sm font-bold text-white font-mono mt-0.5">
                      {school.geofenceCenter?.lng ? Number(school.geofenceCenter.lng).toFixed(6) : '28.232100'}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-mono">Safeguard Perimeter</div>
                    <div className="text-sm font-bold text-emerald-400 font-mono mt-0.5">
                      {school.geofenceCenter?.radiusMeters || 500} Meters Radius
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 space-y-2">
                  <div className="font-bold text-white flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-[#d4af37]" />
                    <span>Active Safety Automation Trigger Policies</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    Automatic perimeter breach notifications and SOS beacons generated within this safe campus zone trigger high-priority escalations directly into the Command Centre. First Responders within a 5 km tactical radius are automatically calculated for situational awareness.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sub-modal: Printable Learner Smart ID Card */}
      {selectedLearnerForId && (
        <LearnerSmartIdModal
          learner={selectedLearnerForId}
          onClose={() => setSelectedLearnerForId(null)}
        />
      )}
    </div>
  );
};
