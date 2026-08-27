import { query } from './client.js';
import crypto from 'crypto';

function hashPassword(plainText: string, salt: string = 'itis_salt_sha256_sec_2026'): string {
  return crypto.createHash('sha256').update(plainText + ':' + salt).digest('hex');
}

function maskSaId(id?: string): string {
  if (!id || id.length < 8) return id || '—';
  const clean = id.trim();
  if (clean.length === 13) {
    return `${clean.slice(0, 6)}*****${clean.slice(11)}`;
  }
  return `${clean.slice(0, 3)}****${clean.slice(-2)}`;
}

export async function seedAuthoritativeDataToPostgres(): Promise<void> {
  console.log('[Seed] Ensuring baseline authoritative reference data in PostgreSQL...');

  const defaultSalt = 'itis_salt_sha256_sec_2026';
  const defaultPassHash = hashPassword('Password123!', defaultSalt);

  // 1. Schools
  const schools = [
    {
      id: 'sch-001',
      emisCode: 'EMIS-70012490',
      name: 'Pretoria Boys High School',
      district: 'Tshwane South (D4)',
      province: 'GAUTENG',
      address: 'Roper St & Brooklyn Rd, Brooklyn, Pretoria, 0181',
      principalName: 'Dr. Gregory Hassenkamp',
      contactPhone: '+27 12 460 2246',
      contactEmail: 'admin@pbhs.co.za',
      lat: -25.7601,
      lng: 28.2355,
      radius: 450
    },
    {
      id: 'sch-002',
      emisCode: 'EMIS-70088120',
      name: 'Soweto Community High School',
      district: 'Johannesburg West (D12)',
      province: 'GAUTENG',
      address: 'Vilakazi St & Moema St, Orlando West, Soweto, 1804',
      principalName: 'Mrs. Nomvula Sithole',
      contactPhone: '+27 11 936 4100',
      contactEmail: 'safety@sowetohigh.edu.za',
      lat: -26.2372,
      lng: 27.9056,
      radius: 500
    },
    {
      id: 'sch-003',
      emisCode: 'EMIS-10029381',
      name: 'Cape Town Central Secondary',
      district: 'Metro Central',
      province: 'WESTERN_CAPE',
      address: 'Hatfield St, Gardens, Cape Town, 8001',
      principalName: 'Mr. David Van Der Merwe',
      contactPhone: '+27 21 461 7000',
      contactEmail: 'admin@capetownsec.edu.za',
      lat: -33.9315,
      lng: 18.4172,
      radius: 400
    }
  ];

  for (const s of schools) {
    await query(
      `INSERT INTO schools (id, emis_code, name, district, province, address, principal_name, contact_phone, contact_email, latitude, longitude, geofence_radius_meters)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (id) DO UPDATE SET
         emis_code = EXCLUDED.emis_code,
         name = EXCLUDED.name,
         principal_name = EXCLUDED.principal_name;`,
      [s.id, s.emisCode, s.name, s.district, s.province, s.address, s.principalName, s.contactPhone, s.contactEmail, s.lat, s.lng, s.radius]
    );
  }

  // 2. Persons
  const persons = [
    {
      id: 'per-g-001',
      officialId: '8204155192084',
      idType: 'SA_ID',
      firstName: 'Grace',
      lastName: 'Molefe',
      dob: '1982-04-15',
      gender: 'FEMALE',
      mobile: '+27821234567',
      email: 'grace.molefe@safetynet.co.za',
      address: '42 Lynnwood Rd, Hatfield, Pretoria'
    },
    {
      id: 'per-l-001',
      officialId: '0905125890081',
      idType: 'SA_ID',
      firstName: 'Thabo',
      lastName: 'Molefe',
      dob: '2009-05-12',
      gender: 'MALE',
      mobile: null,
      email: null,
      address: '42 Lynnwood Rd, Hatfield, Pretoria'
    },
    {
      id: 'per-l-002',
      officialId: '1109235890082',
      idType: 'SA_ID',
      firstName: 'Kgomotso',
      lastName: 'Molefe',
      dob: '2011-09-23',
      gender: 'FEMALE',
      mobile: null,
      email: null,
      address: '42 Lynnwood Rd, Hatfield, Pretoria'
    },
    {
      id: 'per-g-002',
      officialId: '7811055890089',
      idType: 'SA_ID',
      firstName: 'Sipho',
      lastName: 'Dlamini',
      dob: '1978-11-05',
      gender: 'MALE',
      mobile: '+27839876543',
      email: 'sipho.dlamini@transnet.co.za',
      address: '109 Vilakazi St, Orlando West, Soweto'
    },
    {
      id: 'per-l-003',
      officialId: '0812045890084',
      idType: 'SA_ID',
      firstName: 'Zola',
      lastName: 'Dlamini',
      dob: '2008-12-04',
      gender: 'FEMALE',
      mobile: null,
      email: null,
      address: '109 Vilakazi St, Orlando West, Soweto'
    }
  ];

  for (const p of persons) {
    await query(
      `INSERT INTO persons (id, official_id, official_id_type, first_name, last_name, date_of_birth, gender, mobile_number, email, residential_address, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE)
       ON CONFLICT (id) DO UPDATE SET
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name;`,
      [p.id, p.officialId, p.idType, p.firstName, p.lastName, p.dob, p.gender, p.mobile, p.email, p.address]
    );
  }

  // 3. Learners
  const learners = [
    {
      id: 'lrn-001',
      personId: 'per-l-001',
      emisId: 'LRN-2025-PBHS-0481',
      admNumber: 'PBHS-9842',
      bloodType: 'O+',
      allergies: ['Peanuts', 'Bee Stings'],
      chronic: ['Asthma'],
      device: 'BCN-ITIS-9941'
    },
    {
      id: 'lrn-002',
      personId: 'per-l-002',
      emisId: 'LRN-2026-PBHS-0899',
      admNumber: 'PBHS-10442',
      bloodType: 'O+',
      allergies: [],
      chronic: [],
      device: 'BCN-ITIS-9942'
    },
    {
      id: 'lrn-003',
      personId: 'per-l-003',
      emisId: 'LRN-2025-SOW-0199',
      admNumber: 'SOW-5512',
      bloodType: 'A+',
      allergies: [],
      chronic: [],
      device: 'BCN-ITIS-8819'
    }
  ];

  for (const l of learners) {
    await query(
      `INSERT INTO learners (id, person_id, emis_id, admission_number, blood_group, medical_allergies, chronic_conditions, current_device_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         emis_id = EXCLUDED.emis_id,
         admission_number = EXCLUDED.admission_number;`,
      [l.id, l.personId, l.emisId, l.admNumber, l.bloodType, l.allergies, l.chronic, l.device]
    );
  }

  // 4. Guardians
  const guardians = [
    {
      id: 'grd-001',
      personId: 'per-g-001',
      saId: '8204155192084',
      mobile: '+27821234567',
      lang: 'English / Sesotho'
    },
    {
      id: 'grd-002',
      personId: 'per-g-002',
      saId: '7811055890089',
      mobile: '+27839876543',
      lang: 'isiZulu / English'
    }
  ];

  for (const g of guardians) {
    await query(
      `INSERT INTO guardians (id, person_id, sa_id_number, sa_id_masked, mobile_number, preferred_language)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         mobile_number = EXCLUDED.mobile_number;`,
      [g.id, g.personId, g.saId, maskSaId(g.saId), g.mobile, g.lang]
    );
  }

  // 5. Guardian-Learner Relationships
  const relationships = [
    { id: 'rel-001', guardianId: 'grd-001', learnerId: 'lrn-001', type: 'MOTHER' },
    { id: 'rel-002', guardianId: 'grd-001', learnerId: 'lrn-002', type: 'MOTHER' },
    { id: 'rel-003', guardianId: 'grd-002', learnerId: 'lrn-003', type: 'FATHER' }
  ];

  for (const r of relationships) {
    await query(
      `INSERT INTO guardian_learner_relationships (id, guardian_id, learner_id, relationship_type, is_primary_contact, has_custody_rights, access_status, verification_status)
       VALUES ($1, $2, $3, $4, TRUE, TRUE, 'ACTIVE', 'VERIFIED')
       ON CONFLICT (guardian_id, learner_id) DO NOTHING;`,
      [r.id, r.guardianId, r.learnerId, r.type]
    );
  }

  // 6. School Enrolments
  const enrolments = [
    { id: 'enr-001', learnerId: 'lrn-001', schoolId: 'sch-001', year: 2026, grade: 'Grade 10', section: '10-A' },
    { id: 'enr-002', learnerId: 'lrn-002', schoolId: 'sch-001', year: 2026, grade: 'Grade 8', section: '8-B' },
    { id: 'enr-003', learnerId: 'lrn-003', schoolId: 'sch-002', year: 2026, grade: 'Grade 11', section: '11-C' }
  ];

  for (const e of enrolments) {
    await query(
      `INSERT INTO school_enrolments (id, learner_id, school_id, academic_year, grade, class_section, enrolment_status)
       VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')
       ON CONFLICT (learner_id, academic_year, enrolment_status) DO NOTHING;`,
      [e.id, e.learnerId, e.schoolId, e.year, e.grade, e.section]
    );
  }

  // 7. Academic Records
  const academics = [
    { id: 'acd-001-2025', learnerId: 'lrn-001', schoolId: 'sch-001', year: 2025, grade: 'Grade 9', section: '9-C', teacher: 'Mr. J. Botha', status: 'COMPLETED' },
    { id: 'acd-001-2026', learnerId: 'lrn-001', schoolId: 'sch-001', year: 2026, grade: 'Grade 10', section: '10-A', teacher: 'Mrs. S. Khumalo', status: 'CURRENT' },
    { id: 'acd-002-2026', learnerId: 'lrn-002', schoolId: 'sch-001', year: 2026, grade: 'Grade 8', section: '8-B', teacher: 'Mr. P. Dlamini', status: 'CURRENT' }
  ];

  for (const a of academics) {
    await query(
      `INSERT INTO academic_records (id, learner_id, school_id, academic_year, grade, class_section, homeroom_teacher, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO NOTHING;`,
      [a.id, a.learnerId, a.schoolId, a.year, a.grade, a.section, a.teacher, a.status]
    );
  }

  // 8. Devices
  const devices = [
    { id: 'dev-001', serial: 'BCN-ITIS-9941', model: 'ITIS-Beacon-Pro', learnerId: 'lrn-001' },
    { id: 'dev-002', serial: 'BCN-ITIS-9942', model: 'ITIS-Beacon-Pro', learnerId: 'lrn-002' },
    { id: 'dev-003', serial: 'BCN-ITIS-8819', model: 'ITIS-Beacon-Pro', learnerId: 'lrn-003' }
  ];

  for (const d of devices) {
    await query(
      `INSERT INTO devices (id, serial_number, device_model, hardware_revision, firmware_version, assigned_learner_id, battery_level)
       VALUES ($1, $2, $3, 'REV-2.1', 'v2.4.1-rc3', $4, 100)
       ON CONFLICT (serial_number) DO NOTHING;`,
      [d.id, d.serial, d.model, d.learnerId]
    );
  }

  // 9. Responders
  const responders = [
    {
      id: 'resp-saps-01',
      callsign: 'SAPS-GP-01',
      name: 'National Police Sunnyside Sector 2 Unit 01',
      unitType: 'NATIONAL_POLICE',
      vehicleId: 'POLICE-GP-9912',
      primaryOfficer: 'Capt. D. Sithole',
      phone: '+27 12 353 6600',
      freq: '142.850 MHz',
      lat: -25.7550,
      lng: 28.2310,
      district: 'Tshwane South'
    },
    {
      id: 'resp-metro-02',
      callsign: 'METRO-JHB-04',
      name: 'Johannesburg Metro Police Safety Unit 4',
      unitType: 'METRO_POLICE',
      vehicleId: 'JMPD-0412',
      primaryOfficer: 'Sgt. M. Khumalo',
      phone: '+27 11 375 5911',
      freq: '143.125 MHz',
      lat: -26.2350,
      lng: 27.9010,
      district: 'Johannesburg West'
    },
    {
      id: 'resp-sec-03',
      callsign: 'FIDELITY-TSH-09',
      name: 'Fidelity ADT Armed Response Unit 9',
      unitType: 'PRIVATE_SECURITY',
      vehicleId: 'FDT-994',
      primaryOfficer: 'Officer J. Van Zyl',
      phone: '+27 86 121 2100',
      freq: '148.500 MHz',
      lat: -25.7620,
      lng: 28.2400,
      district: 'Tshwane South'
    }
  ];

  for (const resp of responders) {
    await query(
      `INSERT INTO responders (id, callsign, name, unit_type, organization_name, vehicle_id, primary_officer_name, contact_phone, radio_frequency, current_latitude, current_longitude, assigned_district)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         callsign = EXCLUDED.callsign;`,
      [resp.id, resp.callsign, resp.name, resp.unitType, resp.name, resp.vehicleId, resp.primaryOfficer, resp.phone, resp.freq, resp.lat, resp.lng, resp.district]
    );
  }

  // 10. Incidents
  const incCheck = await query(`SELECT id FROM incidents WHERE id = 'inc-001';`);
  if (incCheck.rows.length === 0) {
    await query(
      `INSERT INTO incidents (
        id, learner_id, school_id, device_id, severity, status, trigger_type,
        latitude, longitude, accuracy_meters, location_description, notes,
        assigned_responder, responder_status
      ) VALUES (
        'inc-001', 'lrn-001', 'sch-001', 'dev-001', 'CRITICAL', 'ACTIVE', 'MANUAL_SOS_BEACON',
        -25.7589, 28.2321, 4.2, 'Brooklyn Safe Zone - 220m from South Gate',
        ARRAY['Distress beacon activated on verified Safe Corridor Route 4B', 'Identity confirmed against authoritative student directory', 'Command Officer authorized National Police Rapid Response dispatch', 'Guardian Grace Molefe alerted via instant priority notification'],
        $1, 'DISPATCHED'
      );`,
      [
        JSON.stringify({
          id: 'resp-saps-01',
          name: 'National Police Sunnyside Sector 2 Unit 01',
          unitType: 'NATIONAL_POLICE',
          vehicleId: 'POLICE-GP-9912',
          etaMinutes: 2,
          distanceKm: 0.6
        })
      ]
    );
  }

  // 11. Registered System Users across all roles
  const users = [
    {
      id: 'usr-parent-01',
      email: 'grace.molefe@safetynet.co.za',
      aliases: ['parent@safetynet.co.za', 'parent@itis.safety.za'],
      name: 'Grace Molefe',
      firstName: 'Grace',
      surname: 'Molefe',
      mobile: '+27 82 123 4567',
      role: 'PARENT_GUARDIAN',
      guardianId: 'grd-001',
      dept: 'Parent & Legal Guardian Community',
      org: 'Pretoria Boys High School Parent Body',
      permissions: ['GUARDIAN_CHILDREN_VIEW', 'GUARDIAN_LOCATION_VIEW', 'GUARDIAN_ALERTS_RECEIVE', 'GUARDIAN_PROFILE_UPDATE', 'EMERGENCY_INCIDENTS_VIEW_SCOPED']
    },
    {
      id: 'usr-principal-01',
      email: 'admin@pbhs.co.za',
      aliases: ['principal@pbhs.co.za', 'principal@itis.safety.za'],
      name: 'Dr. Gregory Hassenkamp',
      firstName: 'Gregory',
      surname: 'Hassenkamp',
      mobile: '+27 12 460 2246',
      role: 'SCHOOL_PRINCIPAL',
      schoolId: 'sch-001',
      dept: 'Pretoria Boys High School Administration',
      org: 'Pretoria Boys High School',
      permissions: ['SCHOOL_RECORDS_MANAGE', 'LEARNERS_VIEW_SCOPED', 'ATTENDANCE_MANAGE', 'EMERGENCY_INCIDENTS_VIEW_SCOPED']
    },
    {
      id: 'usr-schooladmin-02',
      email: 'safety@sowetohigh.edu.za',
      aliases: ['schooladmin@sowetohigh.edu.za', 'school@itis.safety.za'],
      name: 'Mrs. Nomvula Sithole',
      firstName: 'Nomvula',
      surname: 'Sithole',
      mobile: '+27 11 938 1122',
      role: 'SCHOOL_ADMIN_STAFF',
      schoolId: 'sch-002',
      dept: 'Soweto Community High Registrar',
      org: 'Soweto Community High School',
      permissions: ['SCHOOL_RECORDS_MANAGE', 'LEARNERS_VIEW_SCOPED', 'ATTENDANCE_MANAGE', 'EMERGENCY_INCIDENTS_VIEW_SCOPED']
    },
    {
      id: 'usr-command-01',
      email: 'command@itis.safety.za',
      aliases: ['operator@itis.safety.za', 'control@itis.safety.za'],
      name: 'Command Officer Sipho Ndlovu',
      firstName: 'Sipho',
      surname: 'Ndlovu',
      mobile: '+27 12 358 7099',
      role: 'COMMAND_OPERATOR',
      dept: '24/7 National Operations Command',
      org: 'ITIS National Command Centre',
      permissions: ['EMERGENCY_INCIDENTS_VIEW_ALL', 'SOS_VERIFY_ASSESS', 'RESPONDER_DISPATCH_AUTHORIZE', 'RESPONDER_STATUS_UPDATE', 'INCIDENT_RESOLVE_CLOSE', 'LEARNERS_VIEW_SCOPED', 'AUDIT_LOGS_VIEW']
    },
    {
      id: 'usr-tech-01',
      email: 'thabo.tech@itis.safety.za',
      aliases: ['tech@itis.safety.za', 'hardware@itis.safety.za'],
      name: 'Thabo Sithole (Hardware Lead)',
      firstName: 'Thabo',
      surname: 'Sithole',
      mobile: '+27 83 991 0022',
      role: 'TECHNICIAN',
      dept: 'Field Hardware & IoT Telemetry Directorate',
      org: 'ITIS Infrastructure Division',
      permissions: ['HARDWARE_DEVICES_VIEW', 'HARDWARE_DIAGNOSE', 'HARDWARE_MAINTENANCE_UPDATE', 'FIRMWARE_DEPLOY']
    },
    {
      id: 'usr-sysadmin-01',
      email: 'sysadmin@itis.safety.za',
      aliases: ['admin@itis.safety.za', 'system@itis.safety.za'],
      name: 'Sovereign Administrator',
      firstName: 'Sovereign',
      surname: 'Administrator',
      mobile: '+27 12 000 1100',
      role: 'SYSTEM_ADMIN',
      dept: 'Core Infrastructure Operations',
      org: 'ITIS Systems Directorate',
      permissions: ['OPERATIONAL_RECORDS_MANAGE', 'SCHOOLS_REGISTER', 'SCHOOL_RECORDS_MANAGE', 'LEARNERS_REGISTER', 'LEARNERS_VIEW_ALL', 'GUARDIANS_REGISTER', 'GUARDIAN_RELATIONSHIPS_MANAGE', 'ENROLMENT_MANAGE', 'ATTENDANCE_MANAGE', 'HARDWARE_DEVICES_VIEW', 'HARDWARE_DIAGNOSE', 'AUDIT_LOGS_VIEW']
    },
    {
      id: 'usr-resp-01',
      email: 'officer.kruger@tactical.co.za',
      aliases: ['responder@itis.safety.za', 'tactical@itis.safety.za'],
      name: 'Capt. Daniel Kruger',
      firstName: 'Daniel',
      surname: 'Kruger',
      mobile: '+27 82 449 0192',
      role: 'FIELD_RESPONDER',
      responderUnit: 'SAPS-GP-01',
      dept: 'Tactical Rapid Response Division',
      org: 'National Police / Metro Safety Taskforce',
      permissions: ['ASSIGNED_INCIDENT_VIEW', 'TACTICAL_NAVIGATION_ACCESS', 'SCENE_ARRIVAL_CONFIRM', 'CHILD_SAFE_CUSTODY_TRANSFER', 'STATUS_REPORT_SUBMIT', 'DIRECT_CALL_COMMAND_DISPATCH']
    },
    {
      id: 'usr-auditor-01',
      email: 'auditor@dbe.gov.za',
      aliases: ['compliance@dbe.gov.za', 'inspector@dbe.gov.za'],
      name: 'Advocate N. Mthembu (Senior Safety Inspector)',
      firstName: 'Nomsa',
      surname: 'Mthembu',
      mobile: '+27 12 357 3000',
      role: 'GOVERNMENT_AUDITOR',
      dept: 'National Child Safety Inspectorate',
      org: 'Department of Basic Education',
      permissions: ['COMPLIANCE_REPORTS_EXPORT', 'NATIONAL_CHILD_PROTECTION_VIEW', 'SCHOOL_SAFETY_RATING_AUDIT', 'DATA_RETENTION_VERIFY', 'EXECUTIVE_METRICS_VIEW', 'STRATEGIC_DASHBOARD_VIEW', 'AUDIT_LOGS_VIEW']
    }
  ];

  for (const u of users) {
    const check = await query(`SELECT id FROM users WHERE id = $1;`, [u.id]);
    if (check.rows.length === 0) {
      await query(
        `INSERT INTO users (
          id, identifier, email, normalized_email, password_hash, password_salt, name,
          first_name, surname, mobile_number, role, account_status, must_change_password,
          school_id, guardian_id, responder_unit, department, organization,
          permissions, is_demo_account, aliases
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'ACTIVE', FALSE, $12, $13, $14, $15, $16, $17, TRUE, $18);`,
        [
          u.id,
          u.email,
          u.email,
          u.email.toLowerCase(),
          defaultPassHash,
          defaultSalt,
          u.name,
          u.firstName,
          u.surname,
          u.mobile,
          u.role,
          (u as any).schoolId || null,
          (u as any).guardianId || null,
          (u as any).responderUnit || null,
          u.dept,
          u.org,
          u.permissions,
          u.aliases || []
        ]
      );
    }
  }

  console.log('[Seed] Authoritative reference data seeded successfully.');
}
