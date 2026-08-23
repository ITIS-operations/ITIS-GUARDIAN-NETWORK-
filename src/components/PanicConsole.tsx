import React, { useState } from 'react';
import { 
  Radio, 
  AlertTriangle, 
  MapPin, 
  Flame, 
  ShieldAlert, 
  X, 
  CheckCircle2, 
  Volume2, 
  UserCheck 
} from 'lucide-react';
import { HydratedLearnerRecord } from '../types.js';
import { api } from '../services/api.js';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  learners: HydratedLearnerRecord[];
  onTriggerSuccess: () => void;
}

export const PanicConsole: React.FC<Props> = ({
  isOpen,
  onClose,
  learners = [],
  onTriggerSuccess
}) => {
  const safeLearners = Array.isArray(learners) ? learners : [];
  const [selectedLearnerId, setSelectedLearnerId] = useState(safeLearners[0]?.learner?.id || '');
  const [triggerType, setTriggerType] = useState<'APP_PANIC' | 'MANUAL_SOS_BEACON' | 'GEOFENCE_BREACH'>('APP_PANIC');
  const [customNotes, setCustomNotes] = useState('Child pressed emergency distress trigger while in transit along Brooklyn corridor.');
  const [isFiring, setIsFiring] = useState(false);
  const [firedIncident, setFiredIncident] = useState<any>(null);

  if (!isOpen) return null;

  const handleFirePanic = async () => {
    if (!selectedLearnerId) return;
    setIsFiring(true);
    try {
      const inc = await api.triggerPanic({
        learnerId: selectedLearnerId,
        triggerType,
        customNotes
      });
      setFiredIncident(inc);
      onTriggerSuccess();
    } catch (err) {
      console.error('Panic trigger failed:', err);
    } finally {
      setIsFiring(false);
    }
  };

  const selectedLearner = safeLearners.find(l => l?.learner?.id === selectedLearnerId) || safeLearners[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-lg max-h-[92dvh] overflow-y-auto bg-slate-900 border border-rose-500/40 rounded-2xl shadow-2xl p-4 sm:p-6 space-y-4 sm:space-y-5 animate-in zoom-in-95 my-auto">
        
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 sm:p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/30 shrink-0">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-white text-sm sm:text-base truncate">SOS Simulation Console</h3>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">Test rapid responder dispatch and guardian reassurance SLA.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg shrink-0 ml-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        {firedIncident ? (
          <div className="space-y-4 text-center py-4 animate-in fade-in">
            <div className="w-14 h-14 mx-auto rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/40">
              <ShieldAlert className="w-8 h-8 animate-bounce" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-white">Emergency Alarm Broadcasted</h4>
              <p className="text-xs text-slate-300 mt-1 max-w-sm mx-auto">
                Incident <strong className="text-rose-400 font-mono">{firedIncident.id}</strong> dispatched to SAPS and authoritative guardians.
              </p>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-left text-xs font-mono text-slate-300 space-y-1">
              <div>Subject: <span className="text-white">{firedIncident.learnerName}</span></div>
              <div>School: <span className="text-cyan-400">{firedIncident.schoolName}</span></div>
              <div>Guardian Notified: <span className="text-purple-400">{firedIncident.guardianName}</span></div>
              <div>Assigned Unit: <span className="text-emerald-400">{firedIncident.assignedResponder?.name}</span></div>
            </div>

            <button
              onClick={() => {
                setFiredIncident(null);
                onClose();
              }}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
            >
              Close Console
            </button>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Select Learner Subject</label>
              <select
                value={selectedLearnerId}
                onChange={e => setSelectedLearnerId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-sm outline-none font-medium"
              >
                {learners.map(l => (
                  <option key={l.learner.id} value={l.learner.id}>
                    {l.person.firstName} {l.person.lastName} ({l.learner.emisId} • {l.currentAcademicRecord?.grade || 'Grade 10'})
                  </option>
                ))}
              </select>
            </div>

            {selectedLearner && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Authoritative Parent:</span>
                  <span className="text-white font-medium truncate ml-2">
                    {selectedLearner.guardians[0]?.person.firstName} {selectedLearner.guardians[0]?.person.lastName} ({selectedLearner.guardians[0]?.relationship.relationshipType})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Medical Flags:</span>
                  <span className="text-rose-400 truncate ml-2">{selectedLearner.learner.medicalNotes || 'No chronic issues'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Enrolled School:</span>
                  <span className="text-cyan-400 truncate ml-2">{selectedLearner.currentSchool?.name}</span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Trigger Mechanism</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setTriggerType('APP_PANIC')}
                  className={`py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${
                    triggerType === 'APP_PANIC'
                      ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  App Panic Button
                </button>
                <button
                  type="button"
                  onClick={() => setTriggerType('MANUAL_SOS_BEACON')}
                  className={`py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${
                    triggerType === 'MANUAL_SOS_BEACON'
                      ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  NFC/LoRa Beacon
                </button>
                <button
                  type="button"
                  onClick={() => setTriggerType('GEOFENCE_BREACH')}
                  className={`py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${
                    triggerType === 'GEOFENCE_BREACH'
                      ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  Safe Corridor Exit
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Telemetry Alert Note</label>
              <input
                type="text"
                value={customNotes}
                onChange={e => setCustomNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs outline-none"
              />
            </div>

            <div className="pt-2 flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleFirePanic}
                disabled={isFiring}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-950 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Flame className="w-4 h-4" />
                <span>{isFiring ? 'Dispatching...' : 'TRIGGER CRITICAL SOS'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
