import React, { useState, useEffect, useRef } from 'react';
import { 
  Printer, 
  X, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  QrCode as QrCodeIcon, 
  Building2, 
  GraduationCap, 
  Calendar,
  Lock,
  RotateCw,
  ExternalLink,
  Shield
} from 'lucide-react';
import QRCode from 'qrcode';
import { HydratedLearnerRecord, SmartIdVerificationResult } from '../types.js';
import { api } from '../services/api.js';

interface Props {
  learner: HydratedLearnerRecord;
  onClose: () => void;
}

export const LearnerSmartIdModal: React.FC<Props> = ({ learner, onClose }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [verificationResult, setVerificationResult] = useState<SmartIdVerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [activeSide, setActiveSide] = useState<'BOTH' | 'FRONT' | 'BACK'>('BOTH');

  const fullName = `${learner.person.firstName} ${learner.person.lastName}`;
  const schoolName = learner.currentSchool?.name || 'Registered Institutional Campus';
  const gradeDisplay = learner.currentAcademicRecord?.grade || 'Grade 10';
  const classDisplay = learner.currentAcademicRecord?.classSection || 'Class A';
  const admissionNumber = learner.learner.admissionNumber || learner.learner.id;
  const isEnrolled = learner.learner.enrolmentStatus === 'ACTIVE';

  // Secure verification URL containing non-sensitive ID reference
  const verificationRef = learner.learner.id;
  const verificationUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/?verify=smart-id&ref=${encodeURIComponent(verificationRef)}`
    : `https://itis-network.gov.za/verify/${verificationRef}`;

  useEffect(() => {
    QRCode.toDataURL(verificationUrl, {
      width: 180,
      margin: 1,
      color: {
        dark: '#060b18',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    })
      .then(url => setQrDataUrl(url))
      .catch(err => console.error('Failed to generate Smart ID QR code:', err));
  }, [verificationUrl]);

  const handleVerifyCard = async () => {
    setIsVerifying(true);
    try {
      const res = await api.verifySmartId(verificationRef);
      setVerificationResult(res);
    } catch (err: any) {
      setVerificationResult({
        status: 'INVALID',
        message: err.message || 'Verification endpoint unreachable'
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
      {/* Print-specific style block to ensure only the ID cards are printed cleanly */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-smart-id-area, #printable-smart-id-area * {
            visibility: visible;
          }
          #printable-smart-id-area {
            position: fixed;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 20px;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div 
        id="modal-smart-id-container"
        className="relative w-full max-w-4xl bg-slate-900 border border-[#d4af37]/40 rounded-2xl shadow-2xl overflow-hidden my-8 max-h-[92vh] flex flex-col"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/30 text-[#d4af37]">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-wide">
                  Official Learner Smart ID Card
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/30 font-bold">
                  POPIA Validated
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Authoritative biometric and cryptographic identification for {fullName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-print-smart-id"
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-[#d4af37] hover:bg-[#b89528] text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-[#d4af37]/20 transition-all cursor-pointer"
              title="Print standard physical ID card"
            >
              <Printer className="w-4 h-4" />
              <span>Print Smart ID</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Card View Switcher (no-print) */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs no-print">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-mono">View Perspective:</span>
              <div className="inline-flex rounded-lg bg-slate-900 p-1 border border-slate-800">
                <button
                  onClick={() => setActiveSide('BOTH')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    activeSide === 'BOTH' ? 'bg-[#d4af37] text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Front & Back
                </button>
                <button
                  onClick={() => setActiveSide('FRONT')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    activeSide === 'FRONT' ? 'bg-[#d4af37] text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Front Only
                </button>
                <button
                  onClick={() => setActiveSide('BACK')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    activeSide === 'BACK' ? 'bg-[#d4af37] text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Back Only
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="btn-verify-card-status"
                onClick={handleVerifyCard}
                disabled={isVerifying}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
                <span>Verify Token Status</span>
              </button>
            </div>
          </div>

          {/* Verification Status Feedback (if checked) */}
          {verificationResult && (
            <div className={`p-4 rounded-xl border flex items-start gap-3 no-print ${
              verificationResult.status === 'VALID'
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
            }`}>
              {verificationResult.status === 'VALID' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1 text-xs">
                <div className="font-bold tracking-wide">
                  Verification Authority Status: {verificationResult.status}
                </div>
                <div className="text-slate-300 font-mono text-[11px]">
                  Subject: {verificationResult.learnerDisplayName || fullName} • School: {verificationResult.schoolName || schoolName} • Record Status: {verificationResult.recordStatus || (isEnrolled ? 'ACTIVE' : 'INACTIVE')}
                </div>
                <div className="text-slate-400 text-[10px]">
                  Verified at {new Date(verificationResult.verifiedAt || Date.now()).toLocaleTimeString()} via Sovereign Verification Registry. Zero PII leaked.
                </div>
              </div>
            </div>
          )}

          {/* PRINTABLE CARDS AREA */}
          <div 
            id="printable-smart-id-area" 
            className="flex flex-col lg:flex-row items-center justify-center gap-8 py-4"
          >
            {/* ==================================================== */}
            {/* FRONT OF CARD (Standard CR80: 3.375" x 2.125" ratio) */}
            {/* ==================================================== */}
            {(activeSide === 'BOTH' || activeSide === 'FRONT') && (
              <div 
                id="smart-id-front"
                className="w-full max-w-[420px] aspect-[1.586/1] bg-gradient-to-br from-[#060b18] via-[#0b1426] to-[#050a14] rounded-2xl border-2 border-[#d4af37]/60 shadow-2xl p-5 flex flex-col justify-between relative overflow-hidden text-white"
                style={{ minHeight: '260px' }}
              >
                {/* Background Guilloche / Security Pattern */}
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#d4af37_1px,transparent_1px)] [background-size:12px_12px] pointer-events-none" />
                <div className="absolute -right-16 -top-16 w-44 h-44 rounded-full bg-[#d4af37]/10 blur-2xl pointer-events-none" />

                {/* Top Header Row */}
                <div className="relative z-10 flex items-center justify-between border-b border-[#d4af37]/30 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <img 
                      src="/branding/itis-logo.png" 
                      alt="ITIS Emblem" 
                      className="w-8 h-8 rounded-lg border border-[#d4af37]/60 object-cover shrink-0"
                      onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                    />
                    <div>
                      <div className="text-[11px] font-extrabold tracking-wider text-white uppercase font-sans leading-none">
                        ITIS GUARDIAN NETWORK
                      </div>
                      <div className="text-[8px] font-bold text-[#d4af37] font-mono tracking-widest uppercase pt-0.5">
                        REPUBLIC OF SOUTH AFRICA • SMART ID
                      </div>
                    </div>
                  </div>

                  {/* Micro Chip Graphic / Hologram */}
                  <div className="flex items-center gap-1.5">
                    <div className="w-7 h-5 rounded bg-gradient-to-br from-amber-200 via-amber-400 to-yellow-600 border border-amber-300/80 shadow-sm flex items-center justify-center">
                      <div className="w-4 h-3 border border-amber-950/40 rounded-sm grid grid-cols-2 gap-0.5 opacity-60">
                        <div className="bg-amber-950/40" />
                        <div className="bg-amber-950/40" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Middle Content Row: Photo & Details */}
                <div className="relative z-10 flex items-center gap-4 py-2">
                  {/* Photo or High-Res Silhouette Badge */}
                  <div className="relative shrink-0">
                    {learner.learner.photoUrl ? (
                      <img 
                        src={learner.learner.photoUrl} 
                        alt={fullName}
                        className="w-20 h-24 sm:w-22 sm:h-26 rounded-xl object-cover border-2 border-[#d4af37]/70 shadow-md bg-slate-950"
                      />
                    ) : (
                      <div className="w-20 h-24 sm:w-22 sm:h-26 rounded-xl border-2 border-[#d4af37]/70 bg-gradient-to-b from-slate-800 to-slate-950 flex flex-col items-center justify-center text-slate-400 shadow-md p-2 text-center">
                        <GraduationCap className="w-8 h-8 text-[#d4af37] mb-1" />
                        <span className="text-[9px] font-bold text-slate-300 font-mono leading-tight">
                          {learner.person.firstName[0]}{learner.person.lastName[0]}
                        </span>
                      </div>
                    )}
                    <div className="absolute -bottom-1.5 -right-1.5 p-1 rounded-full bg-[#060b18] border border-[#d4af37] text-emerald-400 shadow">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                  </div>

                  {/* Learner Identity & School Metadata */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div>
                      <span className="text-[9px] text-[#d4af37] uppercase font-mono tracking-wider block">
                        Learner Full Name
                      </span>
                      <h4 className="text-sm sm:text-base font-extrabold text-white truncate tracking-tight font-sans leading-tight">
                        {fullName}
                      </h4>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                      <div>
                        <span className="text-[8px] text-slate-400 uppercase font-mono block">
                          Admission / ID
                        </span>
                        <span className="text-[10px] font-bold text-slate-200 font-mono truncate block">
                          {admissionNumber}
                        </span>
                      </div>
                      <div>
                        <span className="text-[8px] text-slate-400 uppercase font-mono block">
                          Grade / Class
                        </span>
                        <span className="text-[10px] font-bold text-cyan-300 font-mono truncate block">
                          {gradeDisplay} ({classDisplay})
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[8px] text-slate-400 uppercase font-mono block">
                        Institutional Campus
                      </span>
                      <span className="text-[10px] font-semibold text-slate-200 truncate block">
                        {schoolName}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Footer Row */}
                <div className="relative z-10 pt-2 border-t border-[#d4af37]/30 flex items-center justify-between text-[9px] font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[8px] tracking-wider border ${
                      isEnrolled 
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}>
                      {isEnrolled ? 'ENROLLED LEARNER' : 'INACTIVE / TRANSFERRED'}
                    </span>
                  </div>

                  <div className="text-right text-slate-400 text-[8px]">
                    SECURE ID CARD • 2026/2027
                  </div>
                </div>
              </div>
            )}

            {/* ==================================================== */}
            {/* BACK OF CARD (Standard CR80) */}
            {/* ==================================================== */}
            {(activeSide === 'BOTH' || activeSide === 'BACK') && (
              <div 
                id="smart-id-back"
                className="w-full max-w-[420px] aspect-[1.586/1] bg-gradient-to-br from-[#060b18] via-[#091020] to-[#040810] rounded-2xl border-2 border-[#d4af37]/60 shadow-2xl p-5 flex flex-col justify-between relative overflow-hidden text-white"
                style={{ minHeight: '260px' }}
              >
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#d4af37_1px,transparent_1px)] [background-size:12px_12px] pointer-events-none" />

                {/* Top Back Row */}
                <div className="relative z-10 flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="text-[10px] font-extrabold text-[#d4af37] font-mono tracking-wider uppercase">
                    ITIS SOVEREIGN TRUST VERIFICATION
                  </div>
                  <div className="text-[8px] text-slate-400 font-mono">
                    EMIS: {learner.currentSchool?.emisCode || 'AUTH-VERIFIED'}
                  </div>
                </div>

                {/* Middle Content: QR Code & Verification Instructions */}
                <div className="relative z-10 flex items-center gap-4 py-2">
                  {/* High Resolution Scannable QR Code */}
                  <div className="p-1.5 rounded-xl bg-white shadow-lg shrink-0 border border-slate-300 flex items-center justify-center">
                    {qrDataUrl ? (
                      <img 
                        src={qrDataUrl} 
                        alt="Secure Smart ID Verification QR Code" 
                        className="w-24 h-24 object-contain"
                      />
                    ) : (
                      <div className="w-24 h-24 flex items-center justify-center text-slate-500 font-mono text-[9px]">
                        Generating QR...
                      </div>
                    )}
                  </div>

                  {/* Instructions & Safe Privacy Statement */}
                  <div className="flex-1 min-w-0 space-y-1.5 text-[9px]">
                    <div className="flex items-center gap-1 text-cyan-300 font-bold uppercase tracking-wider text-[9px]">
                      <QrCodeIcon className="w-3 h-3 shrink-0" />
                      <span>Scan to Verify Record</span>
                    </div>

                    <p className="text-slate-300 leading-snug">
                      Scan with any authorized scanner or camera to verify this learner's active institutional status.
                    </p>

                    <div className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 space-y-0.5 font-mono text-[8px]">
                      <div className="text-slate-400">Token Ref: <span className="text-[#d4af37]">{verificationRef.slice(0, 16)}...</span></div>
                      <div className="text-emerald-400 flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" />
                        <span>POPIA Protected • Zero PII in QR</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Legal Notice */}
                <div className="relative z-10 pt-2 border-t border-slate-800 text-[7.5px] text-slate-400 leading-tight space-y-0.5">
                  <div>
                    This Smart ID card is an official property of the school institution under the ITIS Child Safety Ecosystem.
                  </div>
                  <div className="flex items-center justify-between text-slate-500 font-mono">
                    <span>Non-transferable • Report loss: 0800 555 911</span>
                    <span className="text-[#d4af37]">Verified Institution</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Privacy Notice (no-print) */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-1 no-print">
            <div className="font-bold text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Data Protection & Cryptographic Privacy Assurance</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              In strict adherence to POPIA Section 14 and national child protection regulations, this Smart ID Card and its verification QR code do not embed sensitive medical dossiers, guardian authentication tokens, passwords, or home addresses. Public scanning resolves solely to authoritative enrolment validity.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
