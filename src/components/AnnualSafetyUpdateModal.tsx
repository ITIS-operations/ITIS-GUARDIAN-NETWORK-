import React, { useState, useEffect } from 'react';
import { 
  HeartPulse, 
  X, 
  GraduationCap, 
  ShieldCheck, 
  UserCheck, 
  Phone, 
  CheckCircle2, 
  AlertTriangle, 
  Check, 
  School as SchoolIcon,
  Calendar,
  CreditCard,
  FileCheck
} from 'lucide-react';
import { api } from '../services/api.js';
import { 
  HydratedLearnerRecord, 
  ActiveUserSession, 
  School, 
  AnnualSafetyUpdatePayload 
} from '../types.js';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  learner: HydratedLearnerRecord | null;
  schools: School[];
  currentUser: ActiveUserSession;
}

export const AnnualSafetyUpdateModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  learner,
  schools,
  currentUser
}) => {
  if (!isOpen || !learner) return null;

  const currentAcademic = learner.currentAcademicRecord;
  const primaryGuardian = learner.guardians.find(g => g.relationship.isPrimary) || learner.guardians[0];

  // Academic Placement State
  const [academicYear, setAcademicYear] = useState<number>((currentAcademic?.academicYear || 2026) + 1);
  const [grade, setGrade] = useState<string>(
    currentAcademic?.grade === 'Grade 8' ? 'Grade 9' :
    currentAcademic?.grade === 'Grade 9' ? 'Grade 10' :
    currentAcademic?.grade === 'Grade 10' ? 'Grade 11' :
    currentAcademic?.grade === 'Grade 11' ? 'Grade 12' : 'Grade 12'
  );
  const [classSection, setClassSection] = useState<string>(currentAcademic?.classSection || '11-A');
  const [homeroomTeacher, setHomeroomTeacher] = useState<string>(currentAcademic?.homeroomTeacher || 'Mrs. S. Khumalo');
  const [schoolId, setSchoolId] = useState<string>(learner.currentEnrolment?.schoolId || schools[0]?.id || 'sch-001');

  // Medical & First Responder State
  const [bloodType, setBloodType] = useState<string>(learner.learner.bloodType || 'O+');
  const [medicalNotes, setMedicalNotes] = useState<string>(learner.learner.medicalNotes || '');
  const [allergies, setAllergies] = useState<string[]>(
    learner.learner.allergies?.length ? learner.learner.allergies : ['None']
  );
  const [allergyInput, setAllergyInput] = useState('');

  // Primary Contact Verification State
  const [guardianMobile, setGuardianMobile] = useState<string>(primaryGuardian?.guardian.mobileNumber || '');
  const [guardianAddress, setGuardianAddress] = useState<string>(primaryGuardian?.person.physicalAddress || '');
  const [isPrimaryGuardian, setIsPrimaryGuardian] = useState<boolean>(primaryGuardian?.relationship.isPrimary ?? true);
  const [authorizedForPickup, setAuthorizedForPickup] = useState<boolean>(primaryGuardian?.relationship.authorizedForPickup ?? true);
  const [receiveSosAlerts, setReceiveSosAlerts] = useState<boolean>(primaryGuardian?.relationship.receiveSosAlerts ?? true);
  const [verificationNotes, setVerificationNotes] = useState<string>('Annual school safety & demographic update verified by administration.');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<any>(null);

  const handleAddAllergy = (name?: string) => {
    const clean = (name || allergyInput).trim();
    if (!clean) return;
    if (allergies.includes('None')) {
      setAllergies([clean]);
    } else if (!allergies.includes(clean)) {
      setAllergies([...allergies, clean]);
    }
    setAllergyInput('');
  };

  const handleRemoveAllergy = (item: string) => {
    const updated = allergies.filter(a => a !== item);
    setAllergies(updated.length ? updated : ['None']);
  };

  const commonAllergies = ['None', 'Peanuts', 'Asthma / Respiratory', 'Penicillin', 'Bee Stings', 'Dairy / Lactose'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const payload: AnnualSafetyUpdatePayload = {
        learnerId: learner.learner.id,
        schoolId,
        academicYear,
        grade,
        classSection: classSection.trim() || 'A',
        physicalAddress: guardianAddress.trim() || undefined,
        emergencyContacts: primaryGuardian ? [{
          name: `${primaryGuardian.person.firstName} ${primaryGuardian.person.lastName}`,
          relationship: primaryGuardian.relationship.relationshipType,
          mobileNumber: guardianMobile.trim() || primaryGuardian.guardian.mobileNumber,
          isPrimary: isPrimaryGuardian
        }] : undefined,
        medicalInfo: {
          bloodType,
          allergies: allergies.filter(a => a !== 'None'),
          chronicConditions: medicalNotes.trim() || undefined,
        },
        consentAndAcknowledgements: {
          emergencyMedicalTreatmentApproved: true,
          campusExcursionConsent: true,
          photoVideoConsent: true,
          digitalSafetyPolicySigned: true,
          signatureDate: new Date().toISOString().split('T')[0]
        },
        staffContext: {
          staffUserId: currentUser.id,
          staffName: currentUser.name,
          staffRole: currentUser.role
        }
      };

      const result = await api.annualLearnerSafetyUpdate(payload);
      setSuccessResult(result);
      onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit annual safety update.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentSchool = schools.find(s => s.id === schoolId) || schools[0];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto"
      id="annual-safety-update-modal-overlay"
    >
      <div 
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150"
        id="annual-safety-update-dialog"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Annual Learner Safety & Info Update
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-mono uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded">
                  Year {academicYear}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Update academic placement, emergency medical profile, and contact details without duplicating records
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 flex items-start gap-2.5 text-rose-200">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {successResult ? (
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/15 border-2 border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-1">
                <h3 className="text-xl font-bold text-white">
                  Annual Safety Update Certified
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  {learner.person.firstName} {learner.person.lastName}'s authoritative profile and emergency first responder data have been updated for academic year {academicYear}.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-left font-mono text-xs space-y-2 max-w-md mx-auto">
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span className="text-slate-500">Learner:</span>
                  <span className="text-white font-bold">{learner.person.firstName} {learner.person.lastName}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span className="text-slate-500">Placement:</span>
                  <span className="text-cyan-400 font-bold">{grade} ({classSection}) • {academicYear}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span className="text-slate-500">Academic Record ID:</span>
                  <span className="text-emerald-400 font-bold">{successResult.academicRecordId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Audit Event:</span>
                  <span className="text-slate-400 truncate ml-2">{successResult.auditEventId}</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-all shadow-lg"
                >
                  Done & Return to Roster
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Learner Static Identity Summary */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={learner.learner.photoUrl || "https://images.unsplash.com/photo-1544717305-2782549b5136?w=150&auto=format&fit=crop&q=80"}
                    alt=""
                    className="w-11 h-11 rounded-xl object-cover border border-slate-700 shrink-0"
                  />
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      {learner.person.firstName} {learner.person.lastName}
                    </h4>
                    <span className="text-xs text-cyan-400 font-mono">
                      EMIS: {learner.learner.emisId} • DOB: {learner.person.dateOfBirth}
                    </span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-slate-300 font-mono text-[11px]">
                  Existing Record Retained
                </span>
              </div>

              {/* 1. Academic Year & Grade Placement */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4" />
                  1. Academic Year & Placement
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-200 mb-1">
                      Enrolling School Campus
                    </label>
                    <select
                      value={schoolId}
                      onChange={e => setSchoolId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs outline-none"
                    >
                      {schools.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.emisCode})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-200 mb-1">
                      New Academic Year
                    </label>
                    <input
                      type="number"
                      value={academicYear}
                      onChange={e => setAcademicYear(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-200 mb-1">
                      Advancing Grade
                    </label>
                    <select
                      value={grade}
                      onChange={e => setGrade(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
                    >
                      <option value="Grade 7">Grade 7</option>
                      <option value="Grade 8">Grade 8</option>
                      <option value="Grade 9">Grade 9</option>
                      <option value="Grade 10">Grade 10</option>
                      <option value="Grade 11">Grade 11</option>
                      <option value="Grade 12">Grade 12 (Matric)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-200 mb-1">
                      Class Section / Room
                    </label>
                    <input
                      type="text"
                      value={classSection}
                      onChange={e => setClassSection(e.target.value)}
                      placeholder="e.g. 11-A"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono"
                      required
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block font-semibold text-slate-200 mb-1">
                      Homeroom Educator
                    </label>
                    <input
                      type="text"
                      value={homeroomTeacher}
                      onChange={e => setHomeroomTeacher(e.target.value)}
                      placeholder="e.g. Mrs. S. Khumalo"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* 2. Medical & Emergency First Responder Profile */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                  <HeartPulse className="w-4 h-4" />
                  2. Emergency First Responder Profile
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-200 mb-1">Blood Type</label>
                    <select
                      value={bloodType}
                      onChange={e => setBloodType(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono"
                    >
                      <option value="O+">O+ (Universal Positive)</option>
                      <option value="O-">O- (Universal Donor)</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block font-semibold text-slate-200 mb-1">Known Allergies / Triggers</label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {commonAllergies.map(chip => {
                        const isSelected = allergies.includes(chip);
                        return (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => isSelected ? handleRemoveAllergy(chip) : handleAddAllergy(chip)}
                            className={`px-2 py-0.5 rounded-lg text-xs font-medium transition-all ${
                              isSelected
                                ? 'bg-rose-600 text-white'
                                : 'bg-slate-900 border border-slate-700 text-slate-300'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 inline mr-1" />}
                            {chip}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={allergyInput}
                        onChange={e => setAllergyInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddAllergy(); } }}
                        placeholder="Add other allergy..."
                        className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddAllergy()}
                        className="px-3 py-1.5 bg-slate-800 text-slate-200 text-xs rounded-lg"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-200 mb-1">
                    Medical Notes / Chronic Conditions
                  </label>
                  <input
                    type="text"
                    value={medicalNotes}
                    onChange={e => setMedicalNotes(e.target.value)}
                    placeholder="e.g. Asthma, carries Ventolin inhaler."
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
                  />
                </div>
              </div>

              {/* 3. Primary Contact Verification */}
              {primaryGuardian && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4" />
                    3. Guardian Contact & Authority Confirmation ({primaryGuardian.person.firstName} {primaryGuardian.person.lastName})
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-200 mb-1">Emergency Mobile Number</label>
                      <input
                        type="tel"
                        value={guardianMobile}
                        onChange={e => setGuardianMobile(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-200 mb-1">Residential Address</label>
                      <input
                        type="text"
                        value={guardianAddress}
                        onChange={e => setGuardianAddress(e.target.value)}
                        placeholder="Current residential address"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={authorizedForPickup}
                        onChange={e => setAuthorizedForPickup(e.target.checked)}
                        className="rounded text-cyan-500"
                      />
                      <span className="text-slate-200">Authorised for Campus Pickup</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={receiveSosAlerts}
                        onChange={e => setReceiveSosAlerts(e.target.checked)}
                        className="rounded text-cyan-500"
                      />
                      <span className="text-slate-200">Receive Instant SOS Dispatch</span>
                    </label>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>{isSubmitting ? 'Certifying Update...' : 'Certify Annual Update'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
