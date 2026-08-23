import React, { useState } from 'react';
import { 
  X, 
  UserPlus, 
  Mail, 
  Lock, 
  Building2, 
  Phone, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Check, 
  School as SchoolIcon,
  Shield,
  Layers,
  Radio
} from 'lucide-react';
import { UserRole, AccountStatus, School as SchoolType, CreateUserPayload, PlatformUserItem } from '../types.js';
import { api } from '../services/api.js';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onUserCreated: (user: PlatformUserItem) => void;
  schools: SchoolType[];
}

export const CreateUserModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onUserCreated,
  schools = []
}) => {
  const [firstName, setFirstName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [role, setRole] = useState<UserRole>('PARENT_GUARDIAN');
  const [status, setStatus] = useState<AccountStatus>('ACTIVE');
  
  // Organization / School scope
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(schools[0]?.id || 'sch-001');
  const [customOrg, setCustomOrg] = useState('');
  const [responderCallSign, setResponderCallSign] = useState('POLICE-GP-101');

  // Password fields
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Password Policy Checks
  const hasMinLength = password.length >= 12;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password);
  const isPasswordPolicyMet = hasMinLength && hasUpperCase && hasLowerCase && hasNumber && hasSpecial;
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Form Validations
    if (!firstName.trim() || !surname.trim()) {
      setErrorMsg('First name and surname are required.');
      return;
    }

    if (!email.trim()) {
      setErrorMsg('Email address is required.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMsg('Please provide a valid email address format.');
      return;
    }

    if (!isPasswordPolicyMet) {
      setErrorMsg('Password must be at least 12 characters and include uppercase, lowercase, number, and special character.');
      return;
    }

    if (!passwordsMatch) {
      setErrorMsg('Passwords do not match. Please confirm your password accurately.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Derive Organization/Scope
      let schoolId: string | undefined;
      let organization: string = customOrg.trim();
      let responderUnit: string | undefined;

      if (role === 'SCHOOL_PRINCIPAL' || role === 'SCHOOL_ADMIN_STAFF') {
        schoolId = selectedSchoolId;
        const matchedSchool = schools.find(s => s.id === selectedSchoolId);
        organization = matchedSchool ? matchedSchool.name : 'Registered Partner School';
      } else if (role === 'FIELD_RESPONDER') {
        responderUnit = responderCallSign.trim() || 'POLICE-GP-101';
        organization = customOrg.trim() || 'South African Police Service (SAPS)';
      } else if (role === 'PARENT_GUARDIAN') {
        organization = customOrg.trim() || 'Parent & Legal Guardian Community';
      } else if (role === 'COMMAND_OPERATOR') {
        organization = 'ITIS National Operations Command';
      } else if (role === 'TECHNICIAN') {
        organization = 'ITIS Field Hardware & Telemetry Directorate';
      } else if (role === 'GOVERNMENT_AUDITOR') {
        organization = customOrg.trim() || 'Department of Basic Education (DBE)';
      } else if (role === 'SYSTEM_ADMIN') {
        organization = 'ITIS Infrastructure Operations';
      } else if (role === 'FOUNDER_EXECUTIVE') {
        organization = 'ITIS Sovereign Governance Council';
      }

      const payload: CreateUserPayload = {
        firstName: firstName.trim(),
        surname: surname.trim(),
        email: email.trim().toLowerCase(),
        mobileNumber: mobileNumber.trim() || undefined,
        role,
        password,
        confirmPassword,
        schoolId,
        organization,
        responderUnit,
        status
      };

      const newUser = await api.createUser(payload);
      setSuccessMsg(`User identity created for ${newUser.name}. The user can now log in directly.`);
      
      setTimeout(() => {
        onUserCreated(newUser);
        onClose();
      }, 1200);

    } catch (err: any) {
      setErrorMsg(err.message || 'User creation failed. Please check submitted details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div 
        id="modal-create-user-dialog"
        className="relative w-full max-w-2xl bg-slate-900 border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col"
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <UserPlus className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Create Platform User Identity
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 rounded border border-cyan-500/40">
                  FOUNDER SOVEREIGN
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Authoritative platform identity provisioning with unified automatic portal routing.
              </p>
            </div>
          </div>

          <button
            id="btn-close-create-user-modal"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {/* Informational Guidance Banner */}
          <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-xs text-slate-300 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold text-cyan-300 block">Unified Single Login Flow</span>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                The user logs in at <strong className="text-slate-200">/login</strong> with this email and password. The authoritative server evaluates identity and instantly routes them to their exact permitted portal without manual role selection.
              </p>
            </div>
          </div>

          {/* Feedback Messages */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-500/50 text-red-200 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Creation Error</strong>
                <span>{errorMsg}</span>
              </div>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-200 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Account Successfully Provisioned</strong>
                <span>{successMsg}</span>
              </div>
            </div>
          )}

          {/* User Personal Identity */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>1. User Personal Details</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">
                  First Name <span className="text-cyan-400">*</span>
                </label>
                <input
                  id="input-create-user-first-name"
                  type="text"
                  required
                  placeholder="e.g. Sipho"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">
                  Surname <span className="text-cyan-400">*</span>
                </label>
                <input
                  id="input-create-user-surname"
                  type="text"
                  required
                  placeholder="e.g. Ndlovu"
                  value={surname}
                  onChange={e => setSurname(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                  <Mail className="w-3 h-3 text-cyan-400" />
                  <span>Email Address (Unique Login Identity) <span className="text-cyan-400">*</span></span>
                </label>
                <input
                  id="input-create-user-email"
                  type="email"
                  required
                  placeholder="e.g. s.ndlovu@safetynet.co.za"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-cyan-400" />
                  <span>Mobile Number</span>
                </label>
                <input
                  id="input-create-user-mobile"
                  type="tel"
                  placeholder="e.g. +27 82 123 4567"
                  value={mobileNumber}
                  onChange={e => setMobileNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Role & Organization Scope */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>2. Role Assignment & Institutional Scope</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">
                  Authoritative Role <span className="text-cyan-400">*</span>
                </label>
                <select
                  id="select-create-user-role"
                  value={role}
                  onChange={e => setRole(e.target.value as UserRole)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-500"
                >
                  <option value="PARENT_GUARDIAN">Parent / Legal Guardian (Family Portal)</option>
                  <option value="SCHOOL_PRINCIPAL">School Principal (School Portal)</option>
                  <option value="SCHOOL_ADMIN_STAFF">School Administrative Staff (School Portal)</option>
                  <option value="COMMAND_OPERATOR">Command Operator (National Command Centre)</option>
                  <option value="FIELD_RESPONDER">Field Tactical Responder (SAPS / Paramedic Console)</option>
                  <option value="TECHNICIAN">Technician / Hardware Engineer (IoT Portal)</option>
                  <option value="GOVERNMENT_AUDITOR">Government Auditor (Governance Portal)</option>
                  <option value="SYSTEM_ADMIN">System Administrator (Administration Portal)</option>
                  <option value="FOUNDER_EXECUTIVE">Founder / SuperAdmin Executive (Governance Council)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">
                  Initial Account Status <span className="text-cyan-400">*</span>
                </label>
                <select
                  id="select-create-user-status"
                  value={status}
                  onChange={e => setStatus(e.target.value as AccountStatus)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-500"
                >
                  <option value="ACTIVE">ACTIVE (Authorized to Sign In)</option>
                  <option value="SUSPENDED">SUSPENDED (Access Denied)</option>
                  <option value="DISABLED">DISABLED (Deactivated)</option>
                </select>
              </div>
            </div>

            {/* Role-Specific Scope Configuration */}
            {(role === 'SCHOOL_PRINCIPAL' || role === 'SCHOOL_ADMIN_STAFF') && (
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
                <label className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5">
                  <SchoolIcon className="w-3.5 h-3.5" />
                  <span>Associated Registered School</span>
                </label>
                <select
                  id="select-create-user-school"
                  value={selectedSchoolId}
                  onChange={e => setSelectedSchoolId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-500"
                >
                  {schools.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.emisCode}) — {s.district}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400">
                  Learner access and school rosters will be strictly scoped to this educational institution.
                </p>
              </div>
            )}

            {role === 'FIELD_RESPONDER' && (
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-cyan-300 flex items-center gap-1">
                      <Radio className="w-3.5 h-3.5" />
                      <span>Tactical Call Sign / Unit ID</span>
                    </label>
                    <input
                      id="input-create-user-call-sign"
                      type="text"
                      value={responderCallSign}
                      onChange={e => setResponderCallSign(e.target.value)}
                      placeholder="e.g. POLICE-GP-101"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">
                      Emergency Service Provider
                    </label>
                    <input
                      id="input-create-user-responder-org"
                      type="text"
                      value={customOrg}
                      onChange={e => setCustomOrg(e.target.value)}
                      placeholder="e.g. South African Police Service (SAPS)"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {role !== 'SCHOOL_PRINCIPAL' && role !== 'SCHOOL_ADMIN_STAFF' && role !== 'FIELD_RESPONDER' && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-cyan-400" />
                  <span>Organization / Department (Optional)</span>
                </label>
                <input
                  id="input-create-user-org"
                  type="text"
                  placeholder="e.g. Department of Basic Education / ITIS Network"
                  value={customOrg}
                  onChange={e => setCustomOrg(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>
            )}
          </div>

          {/* Password Credentials */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>3. Password Security Credentials</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-cyan-400" />
                  <span>Create Password <span className="text-cyan-400">*</span></span>
                </label>
                <div className="relative">
                  <input
                    id="input-create-user-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Min 12 chars, upper/lower/num/sym"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-cyan-400" />
                  <span>Confirm Password <span className="text-cyan-400">*</span></span>
                </label>
                <div className="relative">
                  <input
                    id="input-create-user-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Real-Time Password Policy Checklist */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
              <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">
                Password Security Complexity Standards:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                <span className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                  {hasMinLength ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-600 ml-1 mr-1" />}
                  12+ Characters
                </span>

                <span className={`flex items-center gap-1.5 ${hasUpperCase ? 'text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                  {hasUpperCase ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-600 ml-1 mr-1" />}
                  Uppercase (A-Z)
                </span>

                <span className={`flex items-center gap-1.5 ${hasLowerCase ? 'text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                  {hasLowerCase ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-600 ml-1 mr-1" />}
                  Lowercase (a-z)
                </span>

                <span className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                  {hasNumber ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-600 ml-1 mr-1" />}
                  Number (0-9)
                </span>

                <span className={`flex items-center gap-1.5 ${hasSpecial ? 'text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                  {hasSpecial ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-600 ml-1 mr-1" />}
                  Special Character (!@#$)
                </span>

                <span className={`flex items-center gap-1.5 ${passwordsMatch ? 'text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                  {passwordsMatch ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-600 ml-1 mr-1" />}
                  Passwords Match
                </span>
              </div>
            </div>
          </div>

          {/* Modal Footer Buttons */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3 shrink-0">
            <button
              id="btn-cancel-create-user"
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold transition-all"
            >
              Cancel
            </button>

            <button
              id="btn-submit-create-user"
              type="submit"
              disabled={isSubmitting || !isPasswordPolicyMet || !passwordsMatch}
              className="min-h-[44px] px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-lg shadow-cyan-900/30 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Create User Account</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
