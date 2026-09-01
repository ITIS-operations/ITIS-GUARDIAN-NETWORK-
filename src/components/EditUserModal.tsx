import React, { useState, useEffect } from 'react';
import { 
  X, 
  UserCheck, 
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
  Radio,
  Trash2
} from 'lucide-react';
import { UserRole, AccountStatus, School as SchoolType, UpdateUserPayload, PlatformUserItem } from '../types.js';
import { api } from '../services/api.js';

interface Props {
  isOpen: boolean;
  user: PlatformUserItem | null;
  onClose: () => void;
  onUserUpdated: (user: PlatformUserItem) => void;
  onUserDeleted: (userId: string) => void;
  schools: SchoolType[];
}

export const EditUserModal: React.FC<Props> = ({
  isOpen,
  user,
  onClose,
  onUserUpdated,
  onUserDeleted,
  schools = []
}) => {
  if (!isOpen || !user) return null;

  const isFounder = user.role === 'FOUNDER_EXECUTIVE';

  const [firstName, setFirstName] = useState(user.firstName || user.name?.split(' ')[0] || '');
  const [surname, setSurname] = useState(user.surname || user.name?.split(' ').slice(1).join(' ') || '');
  const [email, setEmail] = useState(user.email || '');
  const [mobileNumber, setMobileNumber] = useState(user.mobileNumber || '');
  const [role, setRole] = useState<UserRole>(user.role);
  const [status, setStatus] = useState<AccountStatus>(user.status || 'ACTIVE');
  
  // Organization / School scope
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(user.schoolId || schools[0]?.id || 'sch-001');
  const [customOrg, setCustomOrg] = useState(user.organization || '');
  const [responderCallSign, setResponderCallSign] = useState(user.responderUnit || 'POLICE-GP-101');

  // Optional Password fields
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sync state when selected user changes
  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || user.name?.split(' ')[0] || '');
      setSurname(user.surname || user.name?.split(' ').slice(1).join(' ') || '');
      setEmail(user.email || '');
      setMobileNumber(user.mobileNumber || '');
      setRole(user.role);
      setStatus(user.status || 'ACTIVE');
      setSelectedSchoolId(user.schoolId || schools[0]?.id || 'sch-001');
      setCustomOrg(user.organization || '');
      setResponderCallSign(user.responderUnit || 'POLICE-GP-101');
      setNewPassword('');
      setConfirmPassword('');
      setErrorMsg(null);
      setSuccessMsg(null);
      setShowDeleteConfirm(false);
    }
  }, [user]);

  // Password Policy Checks (only active if new password entered)
  const hasMinLength = newPassword.length >= 12;
  const hasUpperCase = /[A-Z]/.test(newPassword);
  const hasLowerCase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(newPassword);
  const isPasswordPolicyMet = hasMinLength && hasUpperCase && hasLowerCase && hasNumber && hasSpecial;
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

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

    if (newPassword.trim()) {
      if (!isPasswordPolicyMet) {
        setErrorMsg('Password must be at least 12 characters and include uppercase, lowercase, number, and special character.');
        return;
      }

      if (!passwordsMatch) {
        setErrorMsg('Passwords do not match. Please confirm your password accurately.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      let assignedSchoolId: string | null = null;
      let assignedResponderUnit: string | null = null;
      let assignedDepartment = 'ITIS Operational Division';
      let assignedOrg = customOrg.trim() || 'ITIS Platform Network';

      if (role === 'SCHOOL_PRINCIPAL' || role === 'SCHOOL_ADMIN_STAFF') {
        assignedSchoolId = selectedSchoolId;
        const matchedSchool = schools.find(s => s.id === selectedSchoolId);
        assignedOrg = matchedSchool?.name || customOrg || 'Registered School Network';
        assignedDepartment = 'School Academic Administration';
      } else if (role === 'COMMAND_OPERATOR') {
        assignedDepartment = 'National Emergency Operations Command';
        assignedOrg = customOrg.trim() || 'ITIS National Command Cluster';
      } else if (role === 'FIELD_RESPONDER') {
        assignedResponderUnit = responderCallSign;
        assignedDepartment = 'Emergency Command & Tactical Dispatch';
        assignedOrg = customOrg.trim() || 'National Emergency Response Cluster';
      } else if (role === 'TECHNICIAN') {
        assignedDepartment = 'Hardware Engineering & Fleet Maintenance';
        assignedOrg = customOrg.trim() || 'ITIS Technical Operations Center';
      } else if (role === 'GOVERNMENT_AUDITOR') {
        assignedDepartment = 'Provincial Education Oversight & Compliance';
        assignedOrg = customOrg.trim() || 'Department of Basic Education';
      } else if (role === 'PARENT_GUARDIAN') {
        assignedDepartment = 'Parent & Legal Guardian Community';
        assignedOrg = 'Parent & Legal Guardian Network';
      } else if (role === 'SYSTEM_ADMIN') {
        assignedDepartment = 'Platform Systems Architecture & Security';
        assignedOrg = 'ITIS Infrastructure Directorate';
      }

      const payload: UpdateUserPayload = {
        firstName: firstName.trim(),
        surname: surname.trim(),
        name: `${firstName.trim()} ${surname.trim()}`,
        email: email.trim(),
        mobileNumber: mobileNumber.trim() || undefined,
        role: isFounder ? 'FOUNDER_EXECUTIVE' : role,
        schoolId: assignedSchoolId,
        responderUnit: assignedResponderUnit,
        department: assignedDepartment,
        organization: assignedOrg,
        status: isFounder ? 'ACTIVE' : status,
        password: newPassword.trim() || undefined
      };

      const updatedUser = await api.updateUser(user.id, payload);
      setSuccessMsg(`User ${updatedUser.name || updatedUser.email} updated successfully.`);
      
      setTimeout(() => {
        onUserUpdated(updatedUser);
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update user account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteOrDeactivate = async (hard: boolean = false) => {
    setErrorMsg(null);
    setIsDeleting(true);
    try {
      const res = await api.deleteUser(user.id, hard);
      setSuccessMsg(res.message || (hard ? 'User permanently deleted.' : 'User deactivated and archived.'));
      setTimeout(() => {
        onUserDeleted(user.id);
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete/deactivate user.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">Edit User Identity</h2>
              <p className="text-xs text-slate-400 font-mono">User ID: {user.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error / Success Feedback */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-red-950/60 border border-red-500/50 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Identity Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                First Name <span className="text-cyan-400">*</span>
              </label>
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                required
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Surname / Last Name <span className="text-cyan-400">*</span>
              </label>
              <input
                type="text"
                value={surname}
                onChange={e => setSurname(e.target.value)}
                required
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Email Address <span className="text-cyan-400">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Mobile / Phone Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="tel"
                  value={mobileNumber}
                  onChange={e => setMobileNumber(e.target.value)}
                  placeholder="+27 82 123 4567"
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            </div>
          </div>

          {/* Role & Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Authoritative System Role
              </label>
              {isFounder ? (
                <div className="px-3.5 py-2 rounded-xl bg-slate-950 border border-amber-500/30 text-amber-300 text-xs font-bold font-mono flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  FOUNDER_EXECUTIVE (Protected)
                </div>
              ) : (
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as UserRole)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="PARENT_GUARDIAN">Parent / Legal Guardian</option>
                  <option value="SCHOOL_PRINCIPAL">School Principal</option>
                  <option value="SCHOOL_ADMIN_STAFF">School Administrative Staff</option>
                  <option value="COMMAND_OPERATOR">Command Operator (National Command Centre)</option>
                  <option value="FIELD_RESPONDER">Field Responder (SAP / EMS)</option>
                  <option value="TECHNICIAN">Hardware Technician</option>
                  <option value="GOVERNMENT_AUDITOR">Government Auditor</option>
                  <option value="SYSTEM_ADMIN">System Administrator</option>
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Account Status
              </label>
              {isFounder ? (
                <div className="px-3.5 py-2 rounded-xl bg-slate-950 border border-emerald-500/30 text-emerald-300 text-xs font-bold font-mono flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  ACTIVE (Locked)
                </div>
              ) : (
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as AccountStatus)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                  <option value="DISABLED">DISABLED</option>
                </select>
              )}
            </div>
          </div>

          {/* Role-Specific Scope Configuration */}
          {(role === 'SCHOOL_PRINCIPAL' || role === 'SCHOOL_ADMIN_STAFF') && (
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300">
                <SchoolIcon className="w-4 h-4" />
                <span>Assigned Educational Institution Scope</span>
              </div>
              <select
                value={selectedSchoolId}
                onChange={e => setSelectedSchoolId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-500"
              >
                {schools.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.emisCode || s.id})
                  </option>
                ))}
              </select>
            </div>
          )}

          {role === 'FIELD_RESPONDER' && (
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                <Radio className="w-4 h-4" />
                <span>Tactical Unit Call Sign / Unit Identifier</span>
              </div>
              <input
                type="text"
                value={responderCallSign}
                onChange={e => setResponderCallSign(e.target.value)}
                placeholder="e.g. POLICE-GP-101 or EMS-AMB-204"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          )}

          {/* Reset Password (Optional) */}
          <div className="pt-3 border-t border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Change Password (Leave blank to keep unchanged)</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Enter new password..."
                    className="w-full px-3.5 py-2 pr-10 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password..."
                    className="w-full px-3.5 py-2 pr-10 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {newPassword.length > 0 && (
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] grid grid-cols-2 md:grid-cols-3 gap-2 text-slate-400">
                <span className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-400' : 'text-slate-500'}`}>
                  <Check className={`w-3.5 h-3.5 ${hasMinLength ? 'text-emerald-400' : 'text-slate-600'}`} />
                  12+ characters
                </span>
                <span className={`flex items-center gap-1.5 ${hasUpperCase ? 'text-emerald-400' : 'text-slate-500'}`}>
                  <Check className={`w-3.5 h-3.5 ${hasUpperCase ? 'text-emerald-400' : 'text-slate-600'}`} />
                  Uppercase letter
                </span>
                <span className={`flex items-center gap-1.5 ${hasLowerCase ? 'text-emerald-400' : 'text-slate-500'}`}>
                  <Check className={`w-3.5 h-3.5 ${hasLowerCase ? 'text-emerald-400' : 'text-slate-600'}`} />
                  Lowercase letter
                </span>
                <span className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-400' : 'text-slate-500'}`}>
                  <Check className={`w-3.5 h-3.5 ${hasNumber ? 'text-emerald-400' : 'text-slate-600'}`} />
                  Number (0-9)
                </span>
                <span className={`flex items-center gap-1.5 ${hasSpecial ? 'text-emerald-400' : 'text-slate-500'}`}>
                  <Check className={`w-3.5 h-3.5 ${hasSpecial ? 'text-emerald-400' : 'text-slate-600'}`} />
                  Special symbol
                </span>
                <span className={`flex items-center gap-1.5 ${passwordsMatch ? 'text-emerald-400' : 'text-slate-500'}`}>
                  <Check className={`w-3.5 h-3.5 ${passwordsMatch ? 'text-emerald-400' : 'text-slate-600'}`} />
                  Passwords match
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            {!isFounder ? (
              <div>
                {!showDeleteConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Deactivate / Delete</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 bg-red-950/80 p-2 rounded-xl border border-red-500/40">
                    <span className="text-[11px] text-red-200">Confirm:</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteOrDeactivate(false)}
                      disabled={isDeleting}
                      className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold"
                    >
                      Archive & Disable
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-2 py-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white text-[10px]"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isDeleting}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-900/30 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
