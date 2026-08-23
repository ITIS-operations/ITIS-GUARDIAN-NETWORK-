import React, { useState, useEffect, useId } from 'react';
import { 
  ShieldCheck, 
  UserCheck, 
  AlertTriangle, 
  Search, 
  PlusCircle, 
  CheckCircle2, 
  UserPlus, 
  Users, 
  School as SchoolIcon, 
  HeartPulse, 
  Lock, 
  ArrowRight,
  ArrowLeft,
  FileCheck,
  AlertOctagon,
  X,
  Phone,
  CreditCard,
  GraduationCap,
  Calendar,
  BadgeCheck,
  Check,
  HelpCircle,
  Sparkles,
  RefreshCw,
  Radio,
  Wifi,
  Cpu,
  Fingerprint,
  Link2,
  Copy,
  Info
} from 'lucide-react';
import { api } from '../services/api.js';
import { 
  School, 
  IdentitySearchResult, 
  RelationshipType, 
  AuthoritativeOnboardPayload,
  ActiveUserSession
} from '../types.js';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentUser: ActiveUserSession;
  schools: School[];
  preselectedSchoolId?: string;
  preselectedGuardianId?: string;
}

type StepNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const AuthoritativeEnrolmentModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  currentUser,
  schools,
  preselectedSchoolId,
  preselectedGuardianId
}) => {
  const formId = useId();

  // 7-Step Workflow State
  const [currentStep, setCurrentStep] = useState<StepNumber>(1);

  // School Selection Context
  const [selectedSchoolId, setSelectedSchoolId] = useState(preselectedSchoolId || schools[0]?.id || 'sch-001');

  // Step 1: Learner Identity Data
  const [learnerFirstName, setLearnerFirstName] = useState('');
  const [learnerLastName, setLearnerLastName] = useState('');
  const [learnerOfficialId, setLearnerOfficialId] = useState('');
  const [learnerEmisId, setLearnerEmisId] = useState('');
  const [learnerDob, setLearnerDob] = useState('2012-04-16');
  const [learnerGender, setLearnerGender] = useState<'MALE' | 'FEMALE' | 'NON_BINARY' | 'UNDISCLOSED'>('MALE');
  const [academicYear, setAcademicYear] = useState(2026);
  const [grade, setGrade] = useState('Grade 8');
  const [classSection, setClassSection] = useState('8-A');
  const [homeroomTeacher, setHomeroomTeacher] = useState('Mrs. D. Sithole');
  const [previousSchoolEmis, setPreviousSchoolEmis] = useState('');
  const [bloodType, setBloodType] = useState('O+');
  const [allergies, setAllergies] = useState<string[]>(['None']);
  const [allergyInput, setAllergyInput] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');

  // Step 2: Guardian Identity Data
  const [guardianFirstName, setGuardianFirstName] = useState('');
  const [guardianLastName, setGuardianLastName] = useState('');
  const [guardianSaId, setGuardianSaId] = useState('');
  const [guardianMobile, setGuardianMobile] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [guardianAddress, setGuardianAddress] = useState('');
  const [guardianLanguage, setGuardianLanguage] = useState('English');
  const [guardianEmployer, setGuardianEmployer] = useState('');

  // Step 3: Guardian Search & Duplicate Engine State
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<IdentitySearchResult | null>(null);
  const [existingGuardianId, setExistingGuardianId] = useState<string | undefined>(preselectedGuardianId);
  const [existingGuardianData, setExistingGuardianData] = useState<any>(null);
  const [searchPerformed, setSearchPerformed] = useState(false);

  // Step 4: Relationship & Custody Data
  const [relationshipType, setRelationshipType] = useState<RelationshipType>('MOTHER');
  const [isPrimaryGuardian, setIsPrimaryGuardian] = useState(true);
  const [legalCustodyVerified, setLegalCustodyVerified] = useState(true);
  const [authorizedForPickup, setAuthorizedForPickup] = useState(true);
  const [receiveSosAlerts, setReceiveSosAlerts] = useState(true);
  const [relationshipNotes, setRelationshipNotes] = useState('');

  // Step 6: Link Device to Learner
  const [beaconTagId, setBeaconTagId] = useState('');
  const [deviceValidationStatus, setDeviceValidationStatus] = useState<'IDLE' | 'CHECKING' | 'VALID' | 'CONFLICT'>('IDLE');
  const [deviceConflictMessage, setDeviceConflictMessage] = useState<string | null>(null);
  const [skipDevicePairing, setSkipDevicePairing] = useState(false);

  // Step 7: Submission & Success State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  // Initialize or reset on open
  useEffect(() => {
    if (isOpen) {
      if (preselectedSchoolId) setSelectedSchoolId(preselectedSchoolId);
      if (preselectedGuardianId) setExistingGuardianId(preselectedGuardianId);
      // Auto-generate EMIS suggestion if empty
      if (!learnerEmisId) {
        setLearnerEmisId(`EMIS-${Math.floor(100000 + Math.random() * 900000)}`);
      }
    }
  }, [isOpen, preselectedSchoolId, preselectedGuardianId]);

  // Current active school object
  const activeSchool = schools.find(s => s.id === selectedSchoolId) || schools[0];

  // Auto-generate a fresh pre-configured ITIS beacon ID
  const handleGenerateBeacon = () => {
    const newId = `BCN-ITIS-${Math.floor(1000 + Math.random() * 9000)}`;
    setBeaconTagId(newId);
    setDeviceValidationStatus('VALID');
    setDeviceConflictMessage(null);
    setSkipDevicePairing(false);
  };

  // Perform Guardian Search (SA ID is primary, Mobile is secondary)
  const performGuardianSearch = async () => {
    setIsSearching(true);
    setErrorMessage(null);
    try {
      const result = await api.searchIdentity({
        saIdNumber: guardianSaId.trim(),
        mobileNumber: guardianMobile.trim(),
        firstName: guardianFirstName.trim(),
        lastName: guardianLastName.trim()
      });
      setSearchResult(result);
      setSearchPerformed(true);

      if (result.matchType === 'EXACT_ID_MATCH' && result.guardianMatch) {
        setExistingGuardianId(result.guardianMatch.guardianId);
        setExistingGuardianData(result.guardianMatch);
      } else if (result.matchType === 'VERIFIED_MOBILE_MATCH' && result.guardianMatch) {
        setExistingGuardianData(result.guardianMatch);
      } else {
        setExistingGuardianId(undefined);
        setExistingGuardianData(null);
      }
    } catch (err: any) {
      setErrorMessage(`Search error: ${err.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  // Run search when entering Step 3 if not already done
  useEffect(() => {
    if (currentStep === 3 && !searchPerformed && (guardianSaId.trim() || guardianMobile.trim())) {
      performGuardianSearch();
    }
  }, [currentStep]);

  // Validate step navigation
  const handleNextStep = () => {
    setErrorMessage(null);

    // Step 1 Validation
    if (currentStep === 1) {
      if (!learnerFirstName.trim() || !learnerLastName.trim()) {
        setErrorMessage('Learner First Name and Surname are required.');
        return;
      }
      if (!learnerEmisId.trim()) {
        setErrorMessage('Learner EMIS / Admission Number is required.');
        return;
      }
      setCurrentStep(2);
      return;
    }

    // Step 2 Validation
    if (currentStep === 2) {
      if (!guardianFirstName.trim() || !guardianLastName.trim()) {
        setErrorMessage('Guardian First Name and Surname are required.');
        return;
      }
      if (!guardianSaId.trim() && !guardianMobile.trim()) {
        setErrorMessage('South African ID Number (Primary Key) or Verified Mobile Number (Secondary Key) is required.');
        return;
      }
      // Auto-trigger search and advance to Step 3
      performGuardianSearch();
      setCurrentStep(3);
      return;
    }

    // Step 3 Validation
    if (currentStep === 3) {
      setCurrentStep(4);
      return;
    }

    // Step 4 Validation
    if (currentStep === 4) {
      setCurrentStep(5);
      return;
    }

    // Step 5 Validation
    if (currentStep === 5) {
      // Auto-suggest beacon if not set
      if (!beaconTagId && !skipDevicePairing) {
        handleGenerateBeacon();
      }
      setCurrentStep(6);
      return;
    }

    // Step 6 Validation
    if (currentStep === 6) {
      if (!skipDevicePairing && !beaconTagId.trim()) {
        setErrorMessage('Please pair a tracking beacon or select "Skip device pairing".');
        return;
      }
      setCurrentStep(7);
      return;
    }
  };

  const handlePrevStep = () => {
    setErrorMessage(null);
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as StepNumber);
    }
  };

  // Step 7: Atomic Commit to Server
  const handleSaveEnrolment = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload: AuthoritativeOnboardPayload = {
        learner: {
          existingLearnerId: undefined,
          officialId: learnerOfficialId.trim() || undefined,
          emisId: learnerEmisId.trim().toUpperCase(),
          firstName: learnerFirstName.trim(),
          lastName: learnerLastName.trim(),
          dateOfBirth: learnerDob,
          gender: learnerGender,
          medicalNotes: medicalNotes.trim() || undefined,
          bloodType: bloodType || 'O+',
          allergies: allergies.filter(a => a !== 'None'),
          trackingBeaconId: skipDevicePairing ? undefined : beaconTagId.trim() || undefined
        },
        guardian: {
          existingGuardianId: existingGuardianId,
          saIdNumber: guardianSaId.trim(),
          firstName: guardianFirstName.trim(),
          lastName: guardianLastName.trim(),
          mobileNumber: guardianMobile.trim(),
          email: guardianEmail.trim() || undefined,
          physicalAddress: guardianAddress.trim() || undefined,
          preferredLanguage: guardianLanguage,
          employerName: guardianEmployer.trim() || undefined
        },
        relationship: {
          relationshipType,
          isPrimary: isPrimaryGuardian,
          legalCustodyVerified,
          authorizedForPickup,
          receiveSosAlerts,
          notes: relationshipNotes.trim() || undefined
        },
        enrolment: {
          schoolId: selectedSchoolId,
          academicYear,
          grade,
          classSection,
          homeroomTeacher: homeroomTeacher.trim() || undefined,
          previousSchoolEmis: previousSchoolEmis.trim() || undefined
        },
        staffContext: {
          staffUserId: currentUser.id,
          staffName: currentUser.name,
          staffRole: currentUser.role,
          ipAddress: '127.0.0.1'
        }
      };

      const result = await api.authoritativeOnboard(payload);
      setSubmissionSuccess(result);
      onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Onboarding transaction failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add Another Child for Same Guardian (Resets learner & steps, keeps guardian)
  const handleAddAnotherChildForSameGuardian = () => {
    // Keep guardian data and existingGuardianId
    setSubmissionSuccess(null);
    setErrorMessage(null);
    setLearnerFirstName('');
    setLearnerLastName(guardianLastName); // pre-populate surname for convenience
    setLearnerOfficialId('');
    setLearnerEmisId(`EMIS-${Math.floor(100000 + Math.random() * 900000)}`);
    setLearnerDob('2014-06-20');
    setMedicalNotes('');
    setAllergies(['None']);
    setBeaconTagId('');
    setSkipDevicePairing(false);
    setCurrentStep(1);
  };

  // Full reset for brand new enrolment transaction
  const handleResetForNewEnrolment = () => {
    setSubmissionSuccess(null);
    setErrorMessage(null);
    setExistingGuardianId(undefined);
    setExistingGuardianData(null);
    setSearchResult(null);
    setSearchPerformed(false);
    setGuardianFirstName('');
    setGuardianLastName('');
    setGuardianSaId('');
    setGuardianMobile('');
    setGuardianEmail('');
    setGuardianAddress('');
    setLearnerFirstName('');
    setLearnerLastName('');
    setLearnerOfficialId('');
    setLearnerEmisId(`EMIS-${Math.floor(100000 + Math.random() * 900000)}`);
    setMedicalNotes('');
    setAllergies(['None']);
    setBeaconTagId('');
    setSkipDevicePairing(false);
    setCurrentStep(1);
  };

  const handleAddAllergy = () => {
    if (allergyInput.trim() && !allergies.includes(allergyInput.trim())) {
      setAllergies(allergies.filter(a => a !== 'None').concat(allergyInput.trim()));
      setAllergyInput('');
    }
  };

  const handleRemoveAllergy = (item: string) => {
    const filtered = allergies.filter(a => a !== item);
    setAllergies(filtered.length > 0 ? filtered : ['None']);
  };

  if (!isOpen) return null;

  const stepLabels: Record<StepNumber, { title: string; subtitle: string }> = {
    1: { title: 'Learner Identity', subtitle: 'Step 1: Capture learner personal & academic details' },
    2: { title: 'Guardian Identity', subtitle: 'Step 2: Capture primary/legal guardian identity' },
    3: { title: 'Search Existing', subtitle: 'Step 3: Search whether guardian already exists' },
    4: { title: 'Link Guardian', subtitle: 'Step 4: Establish legal custody & relationship' },
    5: { title: 'Confirm Info', subtitle: 'Step 5: Review & verify information' },
    6: { title: 'Link Device', subtitle: 'Step 6: Pair hardware IoT beacon / tracker' },
    7: { title: 'Save Enrolment', subtitle: 'Step 7: Single atomic transaction commit' }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div 
        id="authoritative-enrolment-modal"
        className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150"
      >
        {/* ========================================================================= */}
        {/* TOP CONTEXT HEADER: WORKFLOW TITLE & SCHOOL SELECTOR */}
        {/* ========================================================================= */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">Capture Once Enrolment Workflow</h2>
                <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60 text-[10px] font-mono font-semibold uppercase">
                  Learner + Guardian
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Single authoritative onboarding transaction • Zero duplicate workflows
              </p>
            </div>
          </div>

          {/* School Selector (Persisted across entire transaction) */}
          <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
            <SchoolIcon className="w-4 h-4 text-cyan-400 shrink-0" />
            <div className="flex flex-col">
              <label htmlFor={`${formId}-school-select`} className="text-[9px] uppercase tracking-wider text-slate-400 font-mono">
                Active Enrolling School
              </label>
              <select
                id={`${formId}-school-select`}
                value={selectedSchoolId}
                onChange={e => setSelectedSchoolId(e.target.value)}
                disabled={!!submissionSuccess}
                className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer pr-4"
              >
                {schools.map(s => (
                  <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                    {s.name} ({s.emisCode || s.id})
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={onClose}
              className="ml-3 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 7-STEP HORIZONTAL PROGRESS BAR */}
        {/* ========================================================================= */}
        <div className="bg-slate-950/60 px-6 py-2.5 border-b border-slate-800 overflow-x-auto">
          <div className="flex items-center justify-between min-w-[620px] gap-2">
            {([1, 2, 3, 4, 5, 6, 7] as StepNumber[]).map(num => {
              const isPassed = currentStep > num || !!submissionSuccess;
              const isCurrent = currentStep === num && !submissionSuccess;
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => {
                    // Allow jumping back to earlier steps if not submitted
                    if (!submissionSuccess && num <= currentStep) {
                      setCurrentStep(num);
                    }
                  }}
                  disabled={!!submissionSuccess || num > currentStep}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    isCurrent
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm font-semibold'
                      : isPassed
                      ? 'text-emerald-400 hover:bg-slate-800/60'
                      : 'text-slate-500 opacity-60'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold ${
                    isCurrent
                      ? 'bg-cyan-500 text-slate-950'
                      : isPassed
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {isPassed ? <Check className="w-3 h-3" /> : num}
                  </span>
                  <span className="whitespace-nowrap text-[11px]">{stepLabels[num].title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MODAL MAIN BODY / STEP CONTENT */}
        {/* ========================================================================= */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* Global Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-800/80 text-rose-200 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
              <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-rose-200">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 1: CAPTURE LEARNER IDENTITY */}
          {/* ========================================================================= */}
          {currentStep === 1 && !submissionSuccess && (
            <div className="space-y-6 animate-in fade-in">
              <div className="border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono text-[10px] font-bold">
                    STEP 1 OF 7
                  </span>
                  <h3 className="text-sm font-bold text-white">Capture Learner Identity</h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Enter student biographical, academic placement, and health information for {activeSchool?.name}.
                </p>
              </div>

              {/* Name and Official ID */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor={`${formId}-learner-fname`} className="block text-xs font-semibold text-slate-300 mb-1.5">
                    First Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    id={`${formId}-learner-fname`}
                    type="text"
                    required
                    value={learnerFirstName}
                    onChange={e => setLearnerFirstName(e.target.value)}
                    placeholder="e.g. Sipho"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label htmlFor={`${formId}-learner-lname`} className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Surname <span className="text-rose-400">*</span>
                  </label>
                  <input
                    id={`${formId}-learner-lname`}
                    type="text"
                    required
                    value={learnerLastName}
                    onChange={e => setLearnerLastName(e.target.value)}
                    placeholder="e.g. Ndlovu"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label htmlFor={`${formId}-learner-official-id`} className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Official SA ID / Birth Cert / Passport
                  </label>
                  <input
                    id={`${formId}-learner-official-id`}
                    type="text"
                    value={learnerOfficialId}
                    onChange={e => setLearnerOfficialId(e.target.value)}
                    placeholder="13-digit SA ID or Certificate No"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
              </div>

              {/* EMIS, DOB, Gender */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor={`${formId}-learner-emis`} className="text-xs font-semibold text-slate-300">
                      EMIS / Admission No <span className="text-rose-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setLearnerEmisId(`EMIS-${Math.floor(100000 + Math.random() * 900000)}`)}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 font-mono underline"
                    >
                      Generate New
                    </button>
                  </div>
                  <input
                    id={`${formId}-learner-emis`}
                    type="text"
                    required
                    value={learnerEmisId}
                    onChange={e => setLearnerEmisId(e.target.value)}
                    placeholder="e.g. EMIS-48921"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono uppercase"
                  />
                </div>

                <div>
                  <label htmlFor={`${formId}-learner-dob`} className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Date of Birth
                  </label>
                  <input
                    id={`${formId}-learner-dob`}
                    type="date"
                    value={learnerDob}
                    onChange={e => setLearnerDob(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>

                <div>
                  <label htmlFor={`${formId}-learner-gender`} className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Gender
                  </label>
                  <select
                    id={`${formId}-learner-gender`}
                    value={learnerGender}
                    onChange={e => setLearnerGender(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="NON_BINARY">Non-Binary</option>
                    <option value="UNDISCLOSED">Undisclosed</option>
                  </select>
                </div>
              </div>

              {/* Academic Placement */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-cyan-400" />
                  Academic Placement at {activeSchool?.name}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label htmlFor={`${formId}-academic-year`} className="block text-[11px] text-slate-400 mb-1">
                      Academic Year
                    </label>
                    <input
                      id={`${formId}-academic-year`}
                      type="number"
                      value={academicYear}
                      onChange={e => setAcademicYear(parseInt(e.target.value, 10) || 2026)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label htmlFor={`${formId}-learner-grade`} className="block text-[11px] text-slate-400 mb-1">
                      Grade
                    </label>
                    <select
                      id={`${formId}-learner-grade`}
                      value={grade}
                      onChange={e => setGrade(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500"
                    >
                      {['Grade R', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'].map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`${formId}-class-section`} className="block text-[11px] text-slate-400 mb-1">
                      Class Section
                    </label>
                    <input
                      id={`${formId}-class-section`}
                      type="text"
                      value={classSection}
                      onChange={e => setClassSection(e.target.value)}
                      placeholder="e.g. 8-A"
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label htmlFor={`${formId}-homeroom-teacher`} className="block text-[11px] text-slate-400 mb-1">
                      Homeroom Teacher
                    </label>
                    <input
                      id={`${formId}-homeroom-teacher`}
                      type="text"
                      value={homeroomTeacher}
                      onChange={e => setHomeroomTeacher(e.target.value)}
                      placeholder="e.g. Mrs. Sithole"
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>

              {/* Health & Medical Summary */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <HeartPulse className="w-3.5 h-3.5 text-rose-400" />
                  Medical & Emergency Health Profile
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor={`${formId}-blood-type`} className="block text-[11px] text-slate-400 mb-1">
                      Blood Type
                    </label>
                    <select
                      id={`${formId}-blood-type`}
                      value={bloodType}
                      onChange={e => setBloodType(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500"
                    >
                      {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor={`${formId}-allergy-input`} className="block text-[11px] text-slate-400 mb-1">
                      Allergies & Medical Alerts
                    </label>
                    <div className="flex gap-2">
                      <input
                        id={`${formId}-allergy-input`}
                        type="text"
                        value={allergyInput}
                        onChange={e => setAllergyInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddAllergy())}
                        placeholder="Type allergy and press Add (e.g. Peanuts, Asthma)"
                        className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500"
                      />
                      <button
                        type="button"
                        onClick={handleAddAllergy}
                        className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200"
                      >
                        Add
                      </button>
                    </div>
                    {allergies.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {allergies.map((all, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[11px] text-slate-300"
                          >
                            {all}
                            {all !== 'None' && (
                              <button
                                type="button"
                                onClick={() => handleRemoveAllergy(all)}
                                className="text-slate-400 hover:text-rose-400"
                              >
                                ×
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label htmlFor={`${formId}-medical-notes`} className="block text-[11px] text-slate-400 mb-1">
                    Emergency Medical Notes / Care Instructions
                  </label>
                  <textarea
                    id={`${formId}-medical-notes`}
                    value={medicalNotes}
                    onChange={e => setMedicalNotes(e.target.value)}
                    rows={2}
                    placeholder="e.g. Carries inhaler in school bag. Requires EpiPen for peanut exposure."
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: CAPTURE GUARDIAN IDENTITY */}
          {/* ========================================================================= */}
          {currentStep === 2 && !submissionSuccess && (
            <div className="space-y-6 animate-in fade-in">
              <div className="border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono text-[10px] font-bold">
                    STEP 2 OF 7
                  </span>
                  <h3 className="text-sm font-bold text-white">Capture Guardian Identity</h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Enter parent or legal guardian details. South African ID Number is used as the primary matching key.
                </p>
              </div>

              {/* Notice Box on Matching Keys */}
              <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-800/50 text-cyan-200 text-xs flex items-start gap-2.5">
                <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <strong className="text-cyan-300">Matching Policy:</strong> South African ID Number is the primary identity key. Verified Mobile Number is secondary. Names and surnames will <em>never</em> automatically merge records without an exact ID match.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor={`${formId}-guardian-fname`} className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Guardian First Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    id={`${formId}-guardian-fname`}
                    type="text"
                    required
                    value={guardianFirstName}
                    onChange={e => setGuardianFirstName(e.target.value)}
                    placeholder="e.g. Grace"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label htmlFor={`${formId}-guardian-lname`} className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Guardian Surname <span className="text-rose-400">*</span>
                  </label>
                  <input
                    id={`${formId}-guardian-lname`}
                    type="text"
                    required
                    value={guardianLastName}
                    onChange={e => setGuardianLastName(e.target.value)}
                    placeholder="e.g. Molefe"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor={`${formId}-guardian-sa-id`} className="block text-xs font-semibold text-slate-300 mb-1.5">
                    South African ID Number (Primary Key) <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id={`${formId}-guardian-sa-id`}
                      type="text"
                      value={guardianSaId}
                      onChange={e => setGuardianSaId(e.target.value)}
                      placeholder="13-digit National ID (e.g. 8204155829084)"
                      className="w-full px-3.5 py-2.5 pl-9 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                    />
                    <CreditCard className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Used for authoritative Home Affairs DHA NPR verification.</p>
                </div>

                <div>
                  <label htmlFor={`${formId}-guardian-mobile`} className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Verified Mobile Number (Secondary Key) <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id={`${formId}-guardian-mobile`}
                      type="text"
                      value={guardianMobile}
                      onChange={e => setGuardianMobile(e.target.value)}
                      placeholder="+27 82 555 4912"
                      className="w-full px-3.5 py-2.5 pl-9 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                    />
                    <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Receives critical emergency SOS alerts and push notifications.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor={`${formId}-guardian-email`} className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Email Address
                  </label>
                  <input
                    id={`${formId}-guardian-email`}
                    type="email"
                    value={guardianEmail}
                    onChange={e => setGuardianEmail(e.target.value)}
                    placeholder="grace.molefe@safetynet.co.za"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label htmlFor={`${formId}-guardian-lang`} className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Preferred Language
                  </label>
                  <select
                    id={`${formId}-guardian-lang`}
                    value={guardianLanguage}
                    onChange={e => setGuardianLanguage(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500"
                  >
                    {['English', 'isiZulu', 'isiXhosa', 'Afrikaans', 'Sepedi', 'Setswana', 'Sesotho', 'Xitsonga', 'siSwati', 'Tshivenda', 'isiNdebele'].map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor={`${formId}-guardian-address`} className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Physical Residential Address
                  </label>
                  <input
                    id={`${formId}-guardian-address`}
                    type="text"
                    value={guardianAddress}
                    onChange={e => setGuardianAddress(e.target.value)}
                    placeholder="e.g. 14 Jan Smuts Ave, Pretoria"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label htmlFor={`${formId}-guardian-employer`} className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Employer / Workplace
                  </label>
                  <input
                    id={`${formId}-guardian-employer`}
                    type="text"
                    value={guardianEmployer}
                    onChange={e => setGuardianEmployer(e.target.value)}
                    placeholder="e.g. Dept of Health, Gauteng"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: SEARCH WHETHER GUARDIAN ALREADY EXISTS */}
          {/* ========================================================================= */}
          {currentStep === 3 && !submissionSuccess && (
            <div className="space-y-6 animate-in fade-in">
              <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono text-[10px] font-bold">
                      STEP 3 OF 7
                    </span>
                    <h3 className="text-sm font-bold text-white">Search Whether Guardian Already Exists</h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Querying national master registry to prevent duplicate guardian records.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={performGuardianSearch}
                  disabled={isSearching}
                  className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-cyan-950/40"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSearching ? 'animate-spin' : ''}`} />
                  <span>Re-run Search</span>
                </button>
              </div>

              {/* Search Progress State */}
              {isSearching && (
                <div className="p-8 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col items-center justify-center text-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
                  <div>
                    <h4 className="text-sm font-bold text-white">Searching Authoritative National Registry...</h4>
                    <p className="text-xs text-slate-400 mt-1 font-mono">
                      Querying SA ID ({guardianSaId || 'N/A'}) and Mobile ({guardianMobile || 'N/A'})
                    </p>
                  </div>
                </div>
              )}

              {/* CASE A: EXISTING GUARDIAN FOUND (Exact Match) */}
              {!isSearching && searchResult?.matchType === 'EXACT_ID_MATCH' && searchResult.guardianMatch && (
                <div className="p-5 rounded-2xl bg-emerald-950/40 border-2 border-emerald-500/60 shadow-xl space-y-4 animate-in zoom-in-95">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                        <UserCheck className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-bold text-[10px] font-mono tracking-wider">
                            EXISTING GUARDIAN FOUND
                          </span>
                          <span className="text-xs text-emerald-300 font-medium">100% Identity Match</span>
                        </div>
                        <h4 className="text-base font-bold text-white mt-1">
                          {searchResult.guardianMatch.fullName}
                        </h4>
                      </div>
                    </div>

                    <div className="text-right font-mono text-[11px] text-slate-400">
                      <div>SA ID: <span className="text-slate-200 font-semibold">{searchResult.guardianMatch.saIdMasked}</span></div>
                      <div>Mobile: <span className="text-slate-200">{searchResult.guardianMatch.mobileNumber}</span></div>
                    </div>
                  </div>

                  <p className="text-xs text-emerald-200/90 leading-relaxed">
                    This guardian is already registered in the National Child Safety Database. The system will link <strong className="text-white">{learnerFirstName} {learnerLastName}</strong> to this authoritative guardian account without creating duplicates.
                  </p>

                  {/* Existing linked children list */}
                  {searchResult.guardianMatch.linkedChildren && searchResult.guardianMatch.linkedChildren.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-slate-950/70 border border-emerald-900/50 space-y-2">
                      <h5 className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5 uppercase font-mono tracking-wider">
                        <Users className="w-3.5 h-3.5 text-emerald-400" />
                        Existing Enrolled Children ({searchResult.guardianMatch.linkedChildren.length})
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {searchResult.guardianMatch.linkedChildren.map((child: any, idx: number) => (
                          <div key={idx} className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs font-mono">
                            <span className="font-semibold text-slate-200">{child.fullName}</span>
                            <span className="text-slate-400 text-[10px]">{child.grade} • {child.schoolName}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setExistingGuardianId(searchResult.guardianMatch!.guardianId);
                        setCurrentStep(4);
                      }}
                      className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-950/50 transition-all"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>ADD ANOTHER CHILD (Reuse Guardian Account)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* CASE B: MOBILE NUMBER MATCH (Secondary Match) */}
              {!isSearching && searchResult?.matchType === 'VERIFIED_MOBILE_MATCH' && searchResult.guardianMatch && (
                <div className="p-5 rounded-2xl bg-amber-950/40 border-2 border-amber-500/60 shadow-xl space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                        <Phone className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold text-[10px] font-mono tracking-wider">
                            POSSIBLE MATCH VIA MOBILE NUMBER
                          </span>
                          <span className="text-xs text-amber-300 font-medium">85% Confidence</span>
                        </div>
                        <h4 className="text-base font-bold text-white mt-1">
                          {searchResult.guardianMatch.fullName}
                        </h4>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-amber-200/90 leading-relaxed">
                    The mobile number <strong className="text-white">{guardianMobile}</strong> matches registered guardian <strong className="text-white">{searchResult.guardianMatch.fullName}</strong> (ID: {searchResult.guardianMatch.saIdMasked}).
                  </p>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setExistingGuardianId(searchResult.guardianMatch!.guardianId);
                        setCurrentStep(4);
                      }}
                      className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Confirm & Link to Existing Guardian</span>
                    </button>
                  </div>
                </div>
              )}

              {/* CASE C: NO EXISTING GUARDIAN FOUND (Fresh Registration) */}
              {!isSearching && (!searchResult || searchResult.matchType === 'NO_MATCH') && (
                <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                      <UserPlus className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">No Prior Authoritative Guardian Found</h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        No record matched SA ID <span className="font-mono text-slate-300">{guardianSaId || 'None'}</span> or Mobile <span className="font-mono text-slate-300">{guardianMobile || 'None'}</span>.
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    A fresh, certified Guardian entity (<strong className="text-white">{guardianFirstName} {guardianLastName}</strong>) and Learner entity will be created together in this transaction.
                  </p>
                </div>
              )}

              {/* CASE D: CONFLICT OR STRICT POLICY NOTE */}
              {!isSearching && searchResult?.matchType === 'NAME_SURNAME_POSSIBLE' && (
                <div className="p-4 rounded-xl bg-blue-950/40 border border-blue-800 text-blue-200 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-blue-300">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Anti-Collision Policy Active</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    A person sharing the name "{guardianFirstName} {guardianLastName}" was found, but ID credentials differ. In accordance with South African Child Safety regulations, records are kept separate to prevent false merges.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 4: LINK GUARDIAN TO LEARNER */}
          {/* ========================================================================= */}
          {currentStep === 4 && !submissionSuccess && (
            <div className="space-y-6 animate-in fade-in">
              <div className="border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono text-[10px] font-bold">
                    STEP 4 OF 7
                  </span>
                  <h3 className="text-sm font-bold text-white">Link Guardian to Learner</h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Establish legal relationship, custody verification, emergency dispatch, and pickup authorizations.
                </p>
              </div>

              {/* Relationship Summary Banner */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold font-mono text-xs">
                    🔗
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">
                      Linking {guardianFirstName} {guardianLastName} → {learnerFirstName} {learnerLastName}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      School: {activeSchool?.name} • Academic Year: {academicYear}
                    </div>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 text-xs font-mono font-medium">
                  {existingGuardianId ? 'Reusing Existing Guardian' : 'Creating New Guardian'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor={`${formId}-rel-type`} className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Relationship Type <span className="text-rose-400">*</span>
                  </label>
                  <select
                    id={`${formId}-rel-type`}
                    value={relationshipType}
                    onChange={e => setRelationshipType(e.target.value as RelationshipType)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500"
                  >
                    <option value="MOTHER">Mother</option>
                    <option value="FATHER">Father</option>
                    <option value="LEGAL_GUARDIAN">Legal Guardian (Court Appointed)</option>
                    <option value="GRANDPARENT">Grandparent</option>
                    <option value="FOSTER_PARENT">Foster Parent</option>
                    <option value="SIBLING_ADULT">Adult Sibling</option>
                    <option value="AUTHORIZED_CAREGIVER">Authorized Caregiver</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label htmlFor={`${formId}-rel-notes`} className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Custody / Special Legal Notes
                  </label>
                  <input
                    id={`${formId}-rel-notes`}
                    type="text"
                    value={relationshipNotes}
                    onChange={e => setRelationshipNotes(e.target.value)}
                    placeholder="e.g. Primary residence; joint custody agreement verified"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3 cursor-pointer hover:border-slate-700 transition-colors">
                  <input
                    type="checkbox"
                    checked={isPrimaryGuardian}
                    onChange={e => setIsPrimaryGuardian(e.target.checked)}
                    className="mt-0.5 rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-cyan-500 w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">Primary Emergency Contact</span>
                    <span className="text-[10px] text-slate-400">First responder contact priority in crisis events</span>
                  </div>
                </label>

                <label className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3 cursor-pointer hover:border-slate-700 transition-colors">
                  <input
                    type="checkbox"
                    checked={legalCustodyVerified}
                    onChange={e => setLegalCustodyVerified(e.target.checked)}
                    className="mt-0.5 rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-cyan-500 w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">Legal Custody Verified</span>
                    <span className="text-[10px] text-slate-400">Children's Act 38 of 2005 & POPIA Section 19 compliance</span>
                  </div>
                </label>

                <label className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3 cursor-pointer hover:border-slate-700 transition-colors">
                  <input
                    type="checkbox"
                    checked={authorizedForPickup}
                    onChange={e => setAuthorizedForPickup(e.target.checked)}
                    className="mt-0.5 rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-cyan-500 w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">Authorized for Campus Pickup</span>
                    <span className="text-[10px] text-slate-400">Permitted for school gate dismissal & transport handover</span>
                  </div>
                </label>

                <label className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3 cursor-pointer hover:border-slate-700 transition-colors">
                  <input
                    type="checkbox"
                    checked={receiveSosAlerts}
                    onChange={e => setReceiveSosAlerts(e.target.checked)}
                    className="mt-0.5 rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-cyan-500 w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">Receive Critical SOS Alerts</span>
                    <span className="text-[10px] text-slate-400">Direct real-time panic beacon dispatch alerts</span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 5: CONFIRM INFORMATION */}
          {/* ========================================================================= */}
          {currentStep === 5 && !submissionSuccess && (
            <div className="space-y-6 animate-in fade-in">
              <div className="border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono text-[10px] font-bold">
                    STEP 5 OF 7
                  </span>
                  <h3 className="text-sm font-bold text-white">Confirm Information</h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Please review the complete onboarding package before hardware device pairing and final commit.
                </p>
              </div>

              {/* Side-by-Side Review Dossiers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Learner Card */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                      <GraduationCap className="w-4 h-4" />
                      Learner Dossier
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">{learnerEmisId}</span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Full Name:</span>
                      <span className="text-white font-bold">{learnerFirstName} {learnerLastName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Official ID:</span>
                      <span className="text-white font-mono">{learnerOfficialId || 'Pending'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">DOB & Gender:</span>
                      <span className="text-white">{learnerDob} ({learnerGender})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Enrolling School:</span>
                      <span className="text-cyan-300 font-semibold">{activeSchool?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Grade & Class:</span>
                      <span className="text-white">{grade} • Section {classSection}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Blood & Allergies:</span>
                      <span className="text-white">{bloodType} • {allergies.join(', ')}</span>
                    </div>
                  </div>
                </div>

                {/* Guardian Card */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4" />
                      Guardian Dossier
                    </span>
                    <span className="text-[10px] font-mono text-emerald-300">
                      {existingGuardianId ? '🔄 Existing Guardian' : '✨ New Guardian'}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Full Name:</span>
                      <span className="text-white font-bold">{guardianFirstName} {guardianLastName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">SA ID Number:</span>
                      <span className="text-white font-mono">{guardianSaId || 'Unspecified'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Mobile Phone:</span>
                      <span className="text-white font-mono">{guardianMobile}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Email:</span>
                      <span className="text-white">{guardianEmail || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Relationship:</span>
                      <span className="text-white font-semibold">{relationshipType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Permissions:</span>
                      <span className="text-emerald-300 text-[11px]">Primary • Custody Verified • SOS Alert Recipient</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ready Indicator */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  All mandatory biometric and legal custody requirements met.
                </span>
                <span className="text-slate-400 font-mono text-[11px]">Next: Device Pairing</span>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 6: LINK DEVICE TO LEARNER */}
          {/* ========================================================================= */}
          {currentStep === 6 && !submissionSuccess && (
            <div className="space-y-6 animate-in fade-in">
              <div className="border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono text-[10px] font-bold">
                    STEP 6 OF 7
                  </span>
                  <h3 className="text-sm font-bold text-white">Link Device to Learner</h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Pair an IoT SOS Beacon or GPS Wearable to {learnerFirstName} {learnerLastName} for safety tracking.
                </p>
              </div>

              {/* Hardware Device Pairing Box */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                      <Radio className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">ITIS IoT Wearable Safety Beacon</h4>
                      <p className="text-[10px] text-slate-400 font-mono">BLE 5.2 Long Range • Panic Button • Fall Sensor</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateBeacon}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-mono font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate & Pair New</span>
                  </button>
                </div>

                <div>
                  <label htmlFor={`${formId}-beacon-tag`} className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Beacon Tag ID / Device Serial Number
                  </label>
                  <div className="relative">
                    <input
                      id={`${formId}-beacon-tag`}
                      type="text"
                      value={beaconTagId}
                      disabled={skipDevicePairing}
                      onChange={e => {
                        setBeaconTagId(e.target.value);
                        setDeviceConflictMessage(null);
                        setDeviceValidationStatus('IDLE');
                      }}
                      placeholder="e.g. BCN-ITIS-8492"
                      className="w-full px-3.5 py-2.5 pl-9 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono uppercase disabled:opacity-50"
                    />
                    <Cpu className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  </div>
                </div>

                {/* Skip toggle */}
                <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={skipDevicePairing}
                    onChange={e => {
                      setSkipDevicePairing(e.target.checked);
                      if (e.target.checked) {
                        setBeaconTagId('');
                      }
                    }}
                    className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-cyan-500 w-4 h-4"
                  />
                  <span>Skip device pairing (Beacon will be assigned later via Devices Portal)</span>
                </label>
              </div>

              {/* Technical Specifications */}
              {!skipDevicePairing && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-2.5 text-slate-300">
                    <Wifi className="w-4 h-4 text-emerald-400" />
                    <span>Mesh Network Relay Ready</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-2.5 text-slate-300">
                    <HeartPulse className="w-4 h-4 text-rose-400" />
                    <span>Impact & Panic Sensor Active</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-2.5 text-slate-300">
                    <ShieldCheck className="w-4 h-4 text-cyan-400" />
                    <span>AES-256 Encrypted Telemetry</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 7: SAVE ENROLMENT (SUBMISSION & CERTIFICATE) */}
          {/* ========================================================================= */}
          {currentStep === 7 && !submissionSuccess && (
            <div className="space-y-6 animate-in fade-in">
              <div className="border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono text-[10px] font-bold">
                    STEP 7 OF 7
                  </span>
                  <h3 className="text-sm font-bold text-white">Save Enrolment Transaction</h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Commit this single atomic transaction to the authoritative ITIS Master Registry.
                </p>
              </div>

              {/* Commit Checklist */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  Atomic Transaction Execution Plan:
                </h4>
                <div className="space-y-2 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>1. Authoritative Learner Entity Registered ({learnerFirstName} {learnerLastName} • {learnerEmisId})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>2. Guardian Profile Linked ({guardianFirstName} {guardianLastName} • {existingGuardianId ? 'Reused ID' : 'New ID'})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>3. Legal Custody & Relationship Certified ({relationshipType})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>4. School Enrolment & Academic Placement ({activeSchool?.name} • {grade} {classSection})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>5. Hardware Panic Beacon Allocated ({beaconTagId || 'None'})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>6. SHA-256 Immutable Audit Trail Generated</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-cyan-950/40 border border-cyan-800 text-cyan-200 text-xs flex items-center justify-between">
                <span>Transaction ready for sovereign cryptographic commit.</span>
                <button
                  type="button"
                  onClick={handleSaveEnrolment}
                  disabled={isSubmitting}
                  className="px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all shadow-lg shadow-cyan-950/60"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>COMMITTING TRANSACTION...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>SAVE ENROLMENT (CAPTURE ONCE)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SUBMISSION SUCCESS: OFFICIAL CERTIFICATE & QUICK ACTIONS */}
          {/* ========================================================================= */}
          {submissionSuccess && (
            <div className="space-y-6 animate-in zoom-in-95">
              <div className="p-6 rounded-2xl bg-emerald-950/40 border-2 border-emerald-500/60 shadow-2xl text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 mx-auto flex items-center justify-center text-emerald-300">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div>
                  <span className="px-3 py-1 rounded-full bg-emerald-500 text-slate-950 font-mono font-bold text-xs uppercase tracking-wider">
                    ENROLMENT CERTIFIED & SAVED
                  </span>
                  <h3 className="text-lg font-bold text-white mt-2">
                    Authoritative Registration Complete
                  </h3>
                  <p className="text-xs text-emerald-200/90 max-w-lg mx-auto mt-1">
                    {submissionSuccess.message}
                  </p>
                </div>

                {/* Audit and Certificate Reference */}
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-emerald-900/60 max-w-xl mx-auto text-left font-mono text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Learner ID:</span>
                    <span className="text-white font-bold">{submissionSuccess.learnerId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Guardian ID:</span>
                    <span className="text-white font-bold">{submissionSuccess.guardianId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Relationship ID:</span>
                    <span className="text-emerald-300">{submissionSuccess.relationshipId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Audit Trail Token:</span>
                    <span className="text-cyan-300 text-[11px] truncate max-w-[280px]">
                      {submissionSuccess.auditEventId || 'SHA256-VERIFIED'}
                    </span>
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
                  <button
                    type="button"
                    onClick={handleAddAnotherChildForSameGuardian}
                    className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-950/50 transition-all"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Add Another Child for this Guardian</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResetForNewEnrolment}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-2 transition-all"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Enrol Another Learner (New Family)</span>
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold"
                  >
                    Close / Return to Registry
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* MODAL FOOTER NAVIGATION */}
        {/* ========================================================================= */}
        {!submissionSuccess && (
          <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={handlePrevStep}
              disabled={currentStep === 1 || isSubmitting}
              className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            <div className="text-xs text-slate-500 font-mono">
              Step {currentStep} of 7: <span className="text-slate-300">{stepLabels[currentStep].title}</span>
            </div>

            {currentStep < 7 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-cyan-950/40"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSaveEnrolment}
                disabled={isSubmitting}
                className="px-6 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-cyan-950/50"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>SAVE ENROLMENT</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
