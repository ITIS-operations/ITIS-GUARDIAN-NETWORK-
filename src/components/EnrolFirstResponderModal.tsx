import React, { useState } from 'react';
import { 
  Shield, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  UserCheck, 
  Radio, 
  Car, 
  MapPin, 
  Building, 
  Phone, 
  Mail, 
  KeyRound, 
  Lock,
  BadgeCheck,
  Zap,
  Info
} from 'lucide-react';
import { api } from '../services/api.js';
import { ResponderUnit, EnrolFirstResponderPayload } from '../types.js';

interface Props {
  onClose: () => void;
  onSuccess: (responder: ResponderUnit) => void;
  founderName?: string;
}

const AVAILABLE_CAPABILITIES = [
  'Rapid Intercept',
  'Armed Visual Deterrence',
  'First Aid',
  'Tactical Medical (Paramedic)',
  'Perimeter Sweep',
  'K9 Support',
  'Crisis De-escalation',
  'Night Patrol'
];

export const EnrolFirstResponderModal: React.FC<Props> = ({ onClose, onSuccess, founderName }) => {
  const [formData, setFormData] = useState<EnrolFirstResponderPayload>({
    firstName: '',
    lastName: '',
    email: '',
    mobileNumber: '',
    callSign: '',
    unitType: 'PRIVATE_SECURITY',
    organizationName: '',
    serviceArea: 'Tshwane South',
    vehicleId: '',
    radioFrequency: 'VHF TAC-01 (154.250 MHz)',
    capabilities: ['Rapid Intercept', 'First Aid'],
    status: 'AVAILABLE',
    verificationStatus: 'VERIFIED',
    profilePhotoUrl: '',
    password: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleCapabilityToggle = (cap: string) => {
    const current = formData.capabilities || [];
    if (current.includes(cap)) {
      setFormData({
        ...formData,
        capabilities: current.filter(c => c !== cap)
      });
    } else {
      setFormData({
        ...formData,
        capabilities: [...current, cap]
      });
    }
  };

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
    let pwd = 'ITIS-';
    for (let i = 0; i < 8; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, password: pwd }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setErrorMsg('Primary officer first and last names are required.');
      return;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setErrorMsg('A valid officer contact email is required.');
      return;
    }
    if (!formData.mobileNumber.trim()) {
      setErrorMsg('Officer mobile contact number is required.');
      return;
    }
    if (!formData.callSign.trim()) {
      setErrorMsg('Tactical unit call sign is required (e.g., BRAVO-2, SAPS-PTA-01).');
      return;
    }
    if (!formData.organizationName.trim()) {
      setErrorMsg('Response organisation or security provider name is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.enrolFirstResponder({
        ...formData,
        callSign: formData.callSign.trim().toUpperCase(),
        email: formData.email.trim().toLowerCase(),
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        mobileNumber: formData.mobileNumber.trim(),
        organizationName: formData.organizationName.trim(),
        vehicleId: formData.vehicleId?.trim() || `VEH-${formData.callSign.trim().toUpperCase()}`
      });

      if (res.success) {
        setSuccessMsg(`First Responder unit ${res.responder.callSign} (${res.responder.name}) enrolled successfully!`);
        setTimeout(() => {
          onSuccess(res.responder);
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to enrol First Responder unit.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
      <div 
        id="modal-enrol-responder"
        className="relative w-full max-w-3xl bg-slate-900 border border-[#d4af37]/40 rounded-2xl shadow-2xl overflow-hidden my-6 max-h-[94vh] flex flex-col"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/30 text-[#d4af37]">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-wide">
                  Enrol First Responder Unit
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/30 font-bold">
                  Founder Authority
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Register verified emergency response personnel and tactical units into the national network
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
          {errorMsg && (
            <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-500/50 text-rose-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Enrolment Error: </span>
                {errorMsg}
              </div>
            </div>
          )}

          {successMsg && (
            <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-500/50 text-emerald-200 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Enrolment Successful: </span>
                {successMsg}
              </div>
            </div>
          )}

          {/* Section 1: Officer Identity */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-800">
              <UserCheck className="w-4 h-4 text-[#d4af37]" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                1. Officer &amp; Personal Identification
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  First Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sipho"
                  value={formData.firstName}
                  onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Last Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dlamini"
                  value={formData.lastName}
                  onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Official Email <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    placeholder="officer@responder.co.za"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-[#d4af37]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Mobile Contact Number <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="tel"
                    required
                    placeholder="+27 82 555 1234"
                    value={formData.mobileNumber}
                    onChange={e => setFormData({ ...formData, mobileNumber: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-[#d4af37]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Tactical Unit Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-800">
              <Radio className="w-4 h-4 text-[#d4af37]" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                2. Tactical Unit &amp; Service Provider
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Tactical Call Sign <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BRAVO-1, SAPS-TAC-04"
                  value={formData.callSign}
                  onChange={e => setFormData({ ...formData, callSign: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono font-bold uppercase placeholder:text-slate-500 focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Unit Type <span className="text-rose-400">*</span>
                </label>
                <select
                  value={formData.unitType}
                  onChange={e => setFormData({ ...formData, unitType: e.target.value as ResponderUnit['unitType'] })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-[#d4af37]"
                >
                  <option value="PRIVATE_SECURITY">Private Security Provider</option>
                  <option value="SAPS">South African Police Service (SAPS)</option>
                  <option value="METRO_POLICE">Metro Police Department (TMPD / JMPD)</option>
                  <option value="PARAMEDIC_EMS">Emergency Medical Services (EMS)</option>
                  <option value="COMMUNITY_CPF">Community Policing Forum (CPF)</option>
                  <option value="SCHOOL_SECURITY">Designated Campus Security Officer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Organisation / Company Name <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Building className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Fidelity ADT / SAPS Pretoria"
                    value={formData.organizationName}
                    onChange={e => setFormData({ ...formData, organizationName: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-[#d4af37]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Service Area / District
                </label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <select
                    value={formData.serviceArea}
                    onChange={e => setFormData({ ...formData, serviceArea: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-[#d4af37]"
                  >
                    <option value="Tshwane South">Tshwane South (Centurion / Pretoria)</option>
                    <option value="Tshwane North">Tshwane North</option>
                    <option value="Johannesburg Central">Johannesburg Central</option>
                    <option value="Johannesburg North">Johannesburg North (Sandton / Randburg)</option>
                    <option value="Ekurhuleni North">Ekurhuleni North</option>
                    <option value="Ekurhuleni South">Ekurhuleni South</option>
                    <option value="Cape Town Metro">Cape Town Metro</option>
                    <option value="eThekwini Central">eThekwini Central</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Vehicle Registration / ID
                </label>
                <div className="relative">
                  <Car className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="e.g. GP 445-920"
                    value={formData.vehicleId}
                    onChange={e => setFormData({ ...formData, vehicleId: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-[#d4af37]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Radio Channel / Frequency
                </label>
                <input
                  type="text"
                  placeholder="e.g. VHF TAC-01 (154.250 MHz)"
                  value={formData.radioFrequency}
                  onChange={e => setFormData({ ...formData, radioFrequency: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-[#d4af37]"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Operational Capabilities & Status */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-800">
              <Zap className="w-4 h-4 text-[#d4af37]" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                3. Tactical Capabilities &amp; Verification
              </h4>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Certified Operational Capabilities
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {AVAILABLE_CAPABILITIES.map(cap => {
                  const isChecked = formData.capabilities?.includes(cap);
                  return (
                    <button
                      type="button"
                      key={cap}
                      onClick={() => handleCapabilityToggle(cap)}
                      className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all text-left flex items-center justify-between cursor-pointer ${
                        isChecked
                          ? 'bg-[#d4af37]/20 border-[#d4af37] text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <span className="truncate">{cap}</span>
                      {isChecked && <CheckCircle2 className="w-3 h-3 text-[#d4af37] shrink-0 ml-1" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Initial Operational State
                </label>
                <select
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-[#d4af37]"
                >
                  <option value="AVAILABLE">AVAILABLE (Sector Ready)</option>
                  <option value="OFF_DUTY">OFF_DUTY (Standby / Shift Rest)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Verification Audit Status
                </label>
                <select
                  value={formData.verificationStatus}
                  onChange={e => setFormData({ ...formData, verificationStatus: e.target.value as 'VERIFIED' | 'PENDING_VERIFICATION' | 'UNDER_REVIEW' })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-[#d4af37]"
                >
                  <option value="VERIFIED">VERIFIED (Founder Attested)</option>
                  <option value="PENDING_VERIFICATION">PENDING_VERIFICATION</option>
                  <option value="UNDER_REVIEW">UNDER_REVIEW</option>
                </select>
              </div>
            </div>

            {/* Enrolment Metadata Banner */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <div className="flex items-center gap-2">
                <BadgeCheck className="w-4 h-4 text-[#d4af37]" />
                <span>Enrolled By: <strong className="text-white">{founderName || 'Founder Executive'}</strong></span>
              </div>
              <div>
                Date: <strong className="text-slate-200">{new Date().toLocaleDateString()}</strong>
              </div>
            </div>
          </div>

          {/* Section 4: Initial Login Credentials */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-800">
              <KeyRound className="w-4 h-4 text-[#d4af37]" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                4. Field Officer Login Credentials
              </h4>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-300">
                  Temporary Secure Password (Optional)
                </label>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="text-[11px] text-[#d4af37] hover:underline flex items-center gap-1 cursor-pointer font-mono"
                >
                  <Zap className="w-3 h-3" />
                  Auto-generate
                </button>
              </div>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Leave blank for auto-generated secure token, or specify password"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono placeholder:text-slate-500 focus:outline-none focus:border-[#d4af37]"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                <Info className="w-3 h-3 text-slate-400 shrink-0" />
                Officer will sign in using email or call sign. Passwords are cryptographically salted and hashed with PBKDF2.
              </p>
            </div>
          </div>

          {/* Regulatory Disclaimer */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-[10.5px] text-slate-400 space-y-1">
            <div className="font-bold text-slate-300 flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-[#d4af37]" />
              <span>Operational Authority &amp; Accreditation Notice</span>
            </div>
            <p className="leading-relaxed">
              Enrolment into the ITIS Guardian Network grants tactical unit visibility and dispatch authorization in accordance with national child safety protocols. Does not substitute or bypass statutory law enforcement or private security regulatory accreditations (PSiRA).
            </p>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="btn-submit-enrol-responder"
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-[#d4af37] hover:bg-[#b89528] text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-[#d4af37]/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <UserCheck className="w-4 h-4" />
              <span>{isSubmitting ? 'Enrolling Unit...' : 'Authorize & Enrol Responder'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
