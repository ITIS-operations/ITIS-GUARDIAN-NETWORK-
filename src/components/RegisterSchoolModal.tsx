import React, { useState } from 'react';
import { 
  School as SchoolIcon, 
  X, 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  UserCheck, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';
import { api } from '../services/api.js';
import { ActiveUserSession, RegisterSchoolPayload } from '../types.js';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentUser: ActiveUserSession;
}

export const RegisterSchoolModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  currentUser
}) => {
  const [name, setName] = useState('');
  const [emisCode, setEmisCode] = useState('');
  const [principalName, setPrincipalName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [province, setProvince] = useState('Gauteng');
  const [district, setDistrict] = useState('Tshwane South');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('-25.7580');
  const [longitude, setLongitude] = useState('28.2310');
  const [geofenceRadius, setGeofenceRadius] = useState(300);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<any>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      if (!name.trim() || !emisCode.trim() || !principalName.trim() || !contactPhone.trim()) {
        throw new Error('Please fill in all mandatory fields: School Name, EMIS Code, Principal, and Contact Phone.');
      }

      const payload: RegisterSchoolPayload = {
        name: name.trim(),
        emisCode: emisCode.trim().toUpperCase(),
        principalName: principalName.trim(),
        contactEmail: contactEmail.trim() || `${emisCode.toLowerCase()}@school.safety.za`,
        contactPhone: contactPhone.trim(),
        province: province as any,
        district: district.trim() || 'Tshwane South',
        address: address.trim() || 'Official School Physical Address, South Africa',
        geofenceCenter: {
          lat: parseFloat(latitude) || -25.7580,
          lng: parseFloat(longitude) || 28.2310,
          radiusMeters: Number(geofenceRadius) || 300
        },
        staffContext: {
          staffUserId: currentUser.id,
          staffName: currentUser.name,
          staffRole: currentUser.role
        }
      };

      const result = await api.registerSchool(payload);
      setSuccessResult(result);
      onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to register school entity.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setName('');
    setEmisCode('');
    setPrincipalName('');
    setContactEmail('');
    setContactPhone('');
    setAddress('');
    setSuccessResult(null);
    setErrorMessage(null);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto"
      id="register-school-modal-overlay"
    >
      <div 
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150"
        id="register-school-dialog"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Register Authoritative School Campus
              </h2>
              <p className="text-xs text-slate-400">
                Authoritative DBE institutional registration & safety perimeter allocation
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

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 flex items-start gap-2.5 text-rose-200 text-xs">
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
                  School Registered Successfully
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Authoritative school record added to national child safety register with active perimeter geofence.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-left font-mono text-xs space-y-2 max-w-md mx-auto">
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span className="text-slate-500">School ID:</span>
                  <span className="text-cyan-400 font-bold">{successResult.schoolId}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span className="text-slate-500">EMIS Code:</span>
                  <span className="text-purple-400 font-bold">{successResult.emisCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Audit Event:</span>
                  <span className="text-slate-400 truncate ml-2">{successResult.auditEventId}</span>
                </div>
              </div>

              <div className="flex justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
                >
                  Register Another School
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                  }}
                  className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
                >
                  Done & Return to Console
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <SchoolIcon className="w-4 h-4" />
                  DBE Official Identity & Location
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-200 mb-1">
                      Official School Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g. Pretoria Boys High School"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:border-cyan-500 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-200 mb-1">
                      Official EMIS Number <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={emisCode}
                      onChange={e => setEmisCode(e.target.value)}
                      placeholder="e.g. EMIS-70021045"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm font-mono focus:border-cyan-500 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-200 mb-1">
                      Principal / Head of Institution <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={principalName}
                      onChange={e => setPrincipalName(e.target.value)}
                      placeholder="e.g. Mr. G. J. Hassen"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:border-cyan-500 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-200 mb-1">
                      Official Contact Phone <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="tel"
                      value={contactPhone}
                      onChange={e => setContactPhone(e.target.value)}
                      placeholder="e.g. +27 12 460 2246"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm font-mono focus:border-cyan-500 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-200 mb-1">
                      Official Email Address
                    </label>
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={e => setContactEmail(e.target.value)}
                      placeholder="e.g. info@pbhs.co.za"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:border-cyan-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-200 mb-1">
                      Province
                    </label>
                    <select
                      value={province}
                      onChange={e => setProvince(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:border-cyan-500 outline-none"
                    >
                      <option value="Gauteng">Gauteng</option>
                      <option value="Western Cape">Western Cape</option>
                      <option value="KwaZulu-Natal">KwaZulu-Natal</option>
                      <option value="Eastern Cape">Eastern Cape</option>
                      <option value="Free State">Free State</option>
                      <option value="Limpopo">Limpopo</option>
                      <option value="Mpumalanga">Mpumalanga</option>
                      <option value="North West">North West</option>
                      <option value="Northern Cape">Northern Cape</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-200 mb-1">
                    District
                  </label>
                  <input
                    type="text"
                    value={district}
                    onChange={e => setDistrict(e.target.value)}
                    placeholder="e.g. Tshwane South / Johannesburg East"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:border-cyan-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-200 mb-1">
                    Physical Campus Address
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="e.g. 251 Roper Street, Brooklyn, Pretoria"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:border-cyan-500 outline-none"
                  />
                </div>
              </div>

              {/* Geofence Settings */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  Perimeter Geofencing Coordinates
                </h4>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">Latitude</label>
                    <input
                      type="text"
                      value={latitude}
                      onChange={e => setLatitude(e.target.value)}
                      placeholder="-25.7580"
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">Longitude</label>
                    <input
                      type="text"
                      value={longitude}
                      onChange={e => setLongitude(e.target.value)}
                      placeholder="28.2310"
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">Geofence Radius (meters)</label>
                    <input
                      type="number"
                      value={geofenceRadius}
                      onChange={e => setGeofenceRadius(Number(e.target.value))}
                      placeholder="300"
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono"
                    />
                  </div>
                </div>
              </div>

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
                  className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <Building2 className="w-4 h-4" />
                  <span>{isSubmitting ? 'Registering School...' : 'Register School'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
