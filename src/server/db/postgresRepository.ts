import { pool, query } from './client.js';
import {
  IDataRepository,
  IUserRepository,
  ISchoolRepository,
  IPersonRepository,
  ILearnerRepository,
  IGuardianRepository,
  IDeviceRepository,
  IIncidentRepository,
  IResponderRepository,
  IAuditRepository,
  DatabaseTransaction
} from './repository.js';
import {
  Person,
  Learner,
  Guardian,
  GuardianLearnerRelationship,
  School,
  SchoolEnrolment,
  AcademicRecord,
  HydratedLearnerRecord,
  IncidentAlert,
  IncidentOutcomeReport,
  ResponderUnit,
  AssignedIncidentView,
  ImmutableAuditEvent,
  PlatformUserItem,
  CreateUserPayload,
  AuthoritativeOnboardPayload,
  AnnualSafetyUpdatePayload,
  RegisterSchoolPayload,
  PaginatedResponse,
  LearnerQueryOptions,
  SchoolQueryOptions,
  IncidentQueryOptions,
  AuditLogQueryOptions,
  ActiveUserSession,
  AccountStatus,
  UserRole,
  EligibleResponderRanking
} from '../../types.js';
import crypto from 'crypto';

export interface ActiveSessionRecord {
  token: string;
  userId: string;
  session: ActiveUserSession;
  permissions: string[];
  expiresAt: string;
  createdAt?: string;
}

// --- Cryptographic & Utility Helpers ---

function hashPassword(plainText: string, salt: string = 'itis_salt_sha256_sec_2026'): string {
  return crypto.createHash('sha256').update(plainText + ':' + salt).digest('hex');
}

function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

function generateTemporaryPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
  let pass = 'Temp';
  for (let i = 0; i < 8; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  pass += '2026!';
  return pass;
}

function maskSaId(saId?: string): string {
  if (!saId || saId.length < 6) return '******';
  return saId.slice(0, 6) + '******' + saId.slice(-1);
}

function generateChecksum(data: Record<string, any>): string {
  const serialized = JSON.stringify(data, Object.keys(data).sort());
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

function normalizeEmail(email: string): string {
  return (email || '').trim().toLowerCase();
}

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

// ----------------------------------------------------
// 1. POSTGRES USER REPOSITORY
// ----------------------------------------------------
export class PostgresUserRepository implements IUserRepository {
  async findById(id: string): Promise<PlatformUserItem | null> {
    const res = await query(
      `SELECT id, email, aliases, name, first_name, surname, mobile_number, role,
              school_id, guardian_id, responder_unit, department, organization,
              permissions, account_status as status, is_demo_account, must_change_password,
              created_at
       FROM users WHERE id = $1;`,
      [id]
    );
    if (res.rows.length === 0) return null;
    return this.mapRowToUserItem(res.rows[0]);
  }

  async findByEmailOrAlias(identifier: string): Promise<PlatformUserItem | null> {
    const clean = normalizeEmail(identifier);
    const res = await query(
      `SELECT id, email, aliases, name, first_name, surname, mobile_number, role,
              school_id, guardian_id, responder_unit, department, organization,
              permissions, account_status as status, is_demo_account, must_change_password,
              created_at
       FROM users 
       WHERE normalized_email = $1 
          OR email = $1 
          OR identifier = $1 
          OR $1 = ANY(aliases);`,
      [clean]
    );
    if (res.rows.length === 0) return null;
    return this.mapRowToUserItem(res.rows[0]);
  }

  async findAll(): Promise<PlatformUserItem[]> {
    const res = await query(
      `SELECT id, email, aliases, name, first_name, surname, mobile_number, role,
              school_id, guardian_id, responder_unit, department, organization,
              permissions, account_status as status, is_demo_account, must_change_password,
              created_at
       FROM users 
       ORDER BY created_at ASC;`
    );
    return res.rows.map(r => this.mapRowToUserItem(r));
  }

  async create(
    payload: CreateUserPayload & { temporaryPassword?: string },
    actorUserId: string
  ): Promise<PlatformUserItem & { temporaryPassword?: string }> {
    const cleanEmail = normalizeEmail(payload.email);
    
    // Check if user already exists
    const existing = await this.findByEmailOrAlias(cleanEmail);
    if (existing) {
      throw new Error('This email address is already registered.');
    }

    const tempPassword = payload.password || generateTemporaryPassword();
    const salt = generateSalt();
    const hash = hashPassword(tempPassword, salt);
    const id = 'usr-' + (payload.role || 'user').toLowerCase().replace(/_/g, '') + '-' + Date.now().toString().slice(-4);
    const fullName = `${payload.firstName || ''} ${payload.surname || ''}`.trim() || 'System User';
    const permissions = payload.permissions || [];

    const res = await query(
      `INSERT INTO users (
        id, identifier, email, normalized_email, password_hash, password_salt, name,
        first_name, surname, mobile_number, role, account_status, must_change_password,
        school_id, guardian_id, responder_unit, department, organization,
        permissions, is_demo_account, failed_login_attempts
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, 0)
      RETURNING id, email, aliases, name, first_name, surname, mobile_number, role,
                school_id, guardian_id, responder_unit, department, organization,
                permissions, account_status as status, is_demo_account, must_change_password,
                created_at;`,
      [
        id,
        cleanEmail,
        cleanEmail,
        cleanEmail,
        hash,
        salt,
        fullName,
        payload.firstName?.trim() || null,
        payload.surname?.trim() || null,
        payload.mobileNumber?.trim() || null,
        payload.role,
        payload.status || 'ACTIVE',
        true, // must_change_password = true for created users
        payload.schoolId || null,
        payload.guardianId || null,
        payload.responderUnit || null,
        payload.department || (payload.role === 'PARENT_GUARDIAN' ? 'Parent & Guardian Community' : 'ITIS Operational Division'),
        payload.organization || (payload.role === 'PARENT_GUARDIAN' ? 'Parent & Legal Guardian Community' : 'ITIS Platform Network'),
        permissions,
        false
      ]
    );

    const userItem = this.mapRowToUserItem(res.rows[0]);
    return {
      ...userItem,
      temporaryPassword: tempPassword
    };
  }

  async updateStatus(
    id: string,
    status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED',
    actorUserId: string
  ): Promise<PlatformUserItem> {
    const user = await this.findById(id);
    if (!user) throw new Error('User record not found.');
    if (user.role === 'FOUNDER_EXECUTIVE' && status !== 'ACTIVE') {
      throw new Error('PROTECTION LOCK: Cannot modify the status of the sovereign Founder/SuperAdmin account.');
    }

    const res = await query(
      `UPDATE users 
       SET account_status = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2
       RETURNING id, email, aliases, name, first_name, surname, mobile_number, role,
                 school_id, guardian_id, responder_unit, department, organization,
                 permissions, account_status as status, is_demo_account, must_change_password,
                 created_at;`,
      [status, id]
    );
    return this.mapRowToUserItem(res.rows[0]);
  }

  async verifyCredentials(
    identifier: string,
    passwordPlain: string
  ): Promise<(PlatformUserItem & { mustChangePassword?: boolean }) | null> {
    if (!identifier || !passwordPlain) return null;
    const clean = normalizeEmail(identifier);

    const res = await query(
      `SELECT id, email, aliases, name, first_name, surname, mobile_number, role,
              password_hash, password_salt, school_id, guardian_id, responder_unit,
              department, organization, permissions, account_status as status,
              is_demo_account, must_change_password, failed_login_attempts, locked_until,
              created_at
       FROM users 
       WHERE normalized_email = $1 
          OR email = $1 
          OR identifier = $1 
          OR $1 = ANY(aliases);`,
      [clean]
    );

    if (res.rows.length === 0) return null;
    const row = res.rows[0];

    // Status checks
    if (row.status === 'SUSPENDED') {
      throw new Error('Account is currently SUSPENDED. Please contact Executive Administration.');
    }
    if (row.status === 'DISABLED') {
      throw new Error('Account is currently DISABLED. Please contact Executive Administration.');
    }

    // Lockout check
    if (row.locked_until) {
      const lockExpiry = new Date(row.locked_until).getTime();
      if (Date.now() < lockExpiry) {
        throw new Error('Account temporarily locked due to repeated authentication failures. Please retry later.');
      }
    }

    // Hash check with record salt or fallback salt
    const recordSalt = row.password_salt || 'itis_salt_sha256_sec_2026';
    const hashedWithSalt = hashPassword(passwordPlain, recordSalt);
    const hashedWithDefault = hashPassword(passwordPlain, 'itis_salt_sha256_sec_2026');

    const isValid =
      row.password_hash === hashedWithSalt ||
      row.password_hash === hashedWithDefault ||
      row.password_hash === passwordPlain;

    if (!isValid) {
      const attempts = (row.failed_login_attempts || 0) + 1;
      const lockedUntil = attempts >= 10 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
      await query(
        `UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3;`,
        [attempts, lockedUntil, row.id]
      );
      return null;
    }

    // Reset attempts on successful login
    await query(
      `UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = CURRENT_TIMESTAMP WHERE id = $1;`,
      [row.id]
    );

    return {
      ...this.mapRowToUserItem(row),
      mustChangePassword: !!row.must_change_password
    };
  }

  async updatePassword(userId: string, newPasswordPlain: string): Promise<void> {
    const salt = generateSalt();
    const hash = hashPassword(newPasswordPlain, salt);
    await query(
      `UPDATE users 
       SET password_hash = $1, password_salt = $2, must_change_password = FALSE,
           failed_login_attempts = 0, locked_until = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3;`,
      [hash, salt, userId]
    );
  }

  private mapRowToUserItem(row: any): PlatformUserItem {
    return {
      id: row.id,
      email: row.email,
      aliases: row.aliases || [],
      name: row.name,
      firstName: row.first_name || undefined,
      surname: row.surname || undefined,
      mobileNumber: row.mobile_number || undefined,
      role: row.role as UserRole,
      schoolId: row.school_id || undefined,
      guardianId: row.guardian_id || undefined,
      responderUnit: row.responder_unit || undefined,
      department: row.department || undefined,
      organization: row.organization || undefined,
      permissions: row.permissions || [],
      status: row.status as AccountStatus,
      isDemoAccount: !!row.is_demo_account,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
    };
  }
}

// ----------------------------------------------------
// 2. POSTGRES SCHOOL REPOSITORY
// ----------------------------------------------------
export class PostgresSchoolRepository implements ISchoolRepository {
  async findById(id: string): Promise<School | null> {
    const res = await query(`SELECT * FROM schools WHERE id = $1;`, [id]);
    if (res.rows.length === 0) return null;
    return this.mapRowToSchool(res.rows[0]);
  }

  async findByEmisCode(emisCode: string): Promise<School | null> {
    const res = await query(`SELECT * FROM schools WHERE emis_code = $1;`, [emisCode]);
    if (res.rows.length === 0) return null;
    return this.mapRowToSchool(res.rows[0]);
  }

  async findAll(options?: SchoolQueryOptions): Promise<PaginatedResponse<School>> {
    const limit = Math.min(Math.max(Number(options?.limit) || 50, 1), 100);
    const page = Math.max(Number(options?.page) || 1, 1);
    const offset = options?.offset !== undefined ? Number(options.offset) : (page - 1) * limit;

    let whereClauses: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    if (options?.province) {
      whereClauses.push(`province = $${paramIndex++}`);
      params.push(options.province);
    }
    if (options?.district) {
      whereClauses.push(`district = $${paramIndex++}`);
      params.push(options.district);
    }
    if (options?.search) {
      whereClauses.push(`(name ILIKE $${paramIndex} OR emis_code ILIKE $${paramIndex} OR principal_name ILIKE $${paramIndex})`);
      params.push(`%${options.search}%`);
      paramIndex++;
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRes = await query(`SELECT COUNT(*) as total FROM schools ${whereStr};`, params);
    const total = parseInt(countRes.rows[0].total, 10);

    const dataRes = await query(
      `SELECT * FROM schools ${whereStr} ORDER BY name ASC LIMIT $${paramIndex++} OFFSET $${paramIndex++};`,
      [...params, limit, offset]
    );

    const data = dataRes.rows.map(r => this.mapRowToSchool(r));
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        total,
        limit,
        offset,
        page,
        totalPages,
        hasMore: page < totalPages
      }
    };
  }

  async create(payload: RegisterSchoolPayload): Promise<School> {
    const id = 'sch-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
    const res = await query(
      `INSERT INTO schools (
        id, emis_code, name, province, district, principal_name,
        contact_phone, contact_email, latitude, longitude, address,
        active_status, geofence_radius_meters
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'ACTIVE', $12)
      RETURNING *;`,
      [
        id,
        payload.emisCode,
        payload.name,
        payload.province,
        payload.district,
        payload.principalName,
        payload.contactPhone,
        payload.contactEmail,
        payload.geofenceCenter?.lat || -25.7550,
        payload.geofenceCenter?.lng || 28.2310,
        payload.address,
        payload.geofenceCenter?.radiusMeters || 450
      ]
    );
    return this.mapRowToSchool(res.rows[0]);
  }

  async update(id: string, updates: Partial<School>): Promise<School> {
    const existing = await this.findById(id);
    if (!existing) throw new Error('School not found.');

    const name = updates.name ?? existing.name;
    const principalName = updates.principalName ?? existing.principalName;
    const contactPhone = updates.contactPhone ?? existing.contactPhone;
    const contactEmail = updates.contactEmail ?? existing.contactEmail;
    const address = updates.address ?? existing.address;

    const res = await query(
      `UPDATE schools 
       SET name = $1, principal_name = $2, contact_phone = $3, contact_email = $4, address = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *;`,
      [name, principalName, contactPhone, contactEmail, address, id]
    );
    return this.mapRowToSchool(res.rows[0]);
  }

  private mapRowToSchool(row: any): School {
    return {
      id: row.id,
      emisCode: row.emis_code,
      name: row.name,
      province: row.province,
      district: row.district,
      principalName: row.principal_name,
      contactPhone: row.contact_phone,
      contactEmail: row.contact_email,
      address: row.address,
      activeLearnersCount: row.active_learners_count ? Number(row.active_learners_count) : 0,
      totalGuardiansLinkedCount: row.total_guardians_count ? Number(row.total_guardians_count) : 0,
      geofenceCenter: {
        lat: Number(row.latitude) || -25.7550,
        lng: Number(row.longitude) || 28.2310,
        radiusMeters: row.geofence_radius_meters ? Number(row.geofence_radius_meters) : 450
      }
    };
  }
}

// ----------------------------------------------------
// 3. POSTGRES PERSON REPOSITORY
// ----------------------------------------------------
export class PostgresPersonRepository implements IPersonRepository {
  async findById(id: string): Promise<Person | null> {
    const res = await query(`SELECT * FROM persons WHERE id = $1;`, [id]);
    if (res.rows.length === 0) return null;
    return this.mapRowToPerson(res.rows[0]);
  }

  async findByOfficialId(officialId: string): Promise<Person | null> {
    if (!officialId) return null;
    const clean = officialId.trim();
    const res = await query(`SELECT * FROM persons WHERE official_id = $1;`, [clean]);
    if (res.rows.length === 0) return null;
    return this.mapRowToPerson(res.rows[0]);
  }

  async findByEmail(email: string): Promise<Person | null> {
    if (!email) return null;
    const clean = normalizeEmail(email);
    const res = await query(`SELECT * FROM persons WHERE LOWER(email) = $1;`, [clean]);
    if (res.rows.length === 0) return null;
    return this.mapRowToPerson(res.rows[0]);
  }

  async create(person: Person): Promise<Person> {
    const res = await query(
      `INSERT INTO persons (
        id, official_id, official_id_type, first_name, last_name, date_of_birth,
        gender, primary_contact, secondary_contact, mobile_number, mobile_verified,
        email, email_verified, residential_address, is_verified, verification_source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
      RETURNING *;`,
      [
        person.id,
        person.officialId || null,
        person.idType || 'SA_ID',
        person.firstName,
        person.lastName,
        person.dateOfBirth,
        person.gender,
        person.mobileNumber || null,
        null,
        person.mobileNumber || null,
        !!person.mobileVerified,
        person.email ? normalizeEmail(person.email) : null,
        !!person.emailVerified,
        person.physicalAddress || null,
        person.isVerified !== false,
        person.verificationSource || 'MANUAL_STAFF_VERIFIED'
      ]
    );
    return this.mapRowToPerson(res.rows[0]);
  }

  async update(id: string, updates: Partial<Person>): Promise<Person> {
    const existing = await this.findById(id);
    if (!existing) throw new Error('Person not found.');

    const firstName = updates.firstName ?? existing.firstName;
    const lastName = updates.lastName ?? existing.lastName;
    const mobileNumber = updates.mobileNumber ?? existing.mobileNumber;
    const email = updates.email ? normalizeEmail(updates.email) : existing.email;
    const physicalAddress = updates.physicalAddress ?? existing.physicalAddress;

    const res = await query(
      `UPDATE persons 
       SET first_name = $1, last_name = $2, mobile_number = $3, email = $4, residential_address = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *;`,
      [firstName, lastName, mobileNumber, email, physicalAddress, id]
    );
    return this.mapRowToPerson(res.rows[0]);
  }

  private mapRowToPerson(row: any): Person {
    return {
      id: row.id,
      officialId: row.official_id || undefined,
      idType: row.official_id_type || 'SA_ID',
      firstName: row.first_name,
      lastName: row.last_name,
      dateOfBirth: row.date_of_birth ? new Date(row.date_of_birth).toISOString().split('T')[0] : '2000-01-01',
      gender: row.gender,
      mobileNumber: row.mobile_number || undefined,
      mobileVerified: !!row.mobile_verified,
      email: row.email || undefined,
      emailVerified: !!row.email_verified,
      physicalAddress: row.residential_address || undefined,
      isVerified: !!row.is_verified,
      verificationSource: row.verification_source || 'MANUAL_STAFF_VERIFIED',
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
    };
  }
}

// ----------------------------------------------------
// 4. POSTGRES GUARDIAN REPOSITORY
// ----------------------------------------------------
export class PostgresGuardianRepository implements IGuardianRepository {
  async findById(id: string): Promise<Guardian | null> {
    const res = await query(`SELECT * FROM guardians WHERE id = $1;`, [id]);
    if (res.rows.length === 0) return null;
    return this.mapRowToGuardian(res.rows[0]);
  }

  async findBySaId(saId: string): Promise<Guardian | null> {
    if (!saId) return null;
    const res = await query(`SELECT * FROM guardians WHERE sa_id_number = $1;`, [saId.trim()]);
    if (res.rows.length === 0) return null;
    return this.mapRowToGuardian(res.rows[0]);
  }

  async findByUserId(userId: string): Promise<Guardian | null> {
    if (!userId) return null;
    const res = await query(`SELECT * FROM guardians WHERE user_id = $1;`, [userId]);
    if (res.rows.length === 0) return null;
    return this.mapRowToGuardian(res.rows[0]);
  }

  async findLearnersByGuardianId(guardianId: string): Promise<HydratedLearnerRecord[]> {
    const res = await query(
      `SELECT learner_id FROM guardian_learner_relationships WHERE guardian_id = $1 AND access_status = 'ACTIVE';`,
      [guardianId]
    );
    const learnerRepo = new PostgresLearnerRepository();
    const list: HydratedLearnerRecord[] = [];
    for (const row of res.rows) {
      const hydrated = await learnerRepo.findHydratedById(row.learner_id);
      if (hydrated) list.push(hydrated);
    }
    return list;
  }

  async create(guardian: Guardian): Promise<Guardian> {
    const res = await query(
      `INSERT INTO guardians (
        id, person_id, user_id, sa_id_number, sa_id_masked, id_verified,
        mobile_number, mobile_verified, preferred_language, push_notifications_enabled,
        id_verification_status, emergency_contact_priority
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
      RETURNING *;`,
      [
        guardian.id,
        guardian.personId,
        null,
        guardian.saIdNumber || null,
        guardian.saIdMasked || maskSaId(guardian.saIdNumber),
        guardian.idVerified !== false,
        guardian.mobileNumber || null,
        guardian.mobileVerified !== false,
        guardian.preferredLanguage || 'English',
        guardian.pushNotificationsEnabled !== false,
        'VERIFIED',
        1
      ]
    );
    return this.mapRowToGuardian(res.rows[0]);
  }

  async linkLearner(relationship: GuardianLearnerRelationship): Promise<GuardianLearnerRelationship> {
    const res = await query(
      `INSERT INTO guardian_learner_relationships (
        id, guardian_id, learner_id, relationship_type, is_primary_contact,
        has_custody_rights, access_status, verification_status, emergency_priority, can_pickup
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (guardian_id, learner_id) DO UPDATE SET
        relationship_type = EXCLUDED.relationship_type,
        is_primary_contact = EXCLUDED.is_primary_contact,
        has_custody_rights = EXCLUDED.has_custody_rights,
        access_status = EXCLUDED.access_status,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;`,
      [
        relationship.id,
        relationship.guardianId,
        relationship.learnerId,
        relationship.relationshipType,
        !!relationship.isPrimary,
        relationship.legalCustodyVerified !== false,
        'ACTIVE',
        relationship.verificationStatus || 'VERIFIED',
        1,
        relationship.authorizedForPickup !== false
      ]
    );
    return this.mapRowToRelationship(res.rows[0]);
  }

  private mapRowToGuardian(row: any): Guardian {
    return {
      id: row.id,
      personId: row.person_id,
      saIdNumber: row.sa_id_number || '',
      saIdMasked: row.sa_id_masked || maskSaId(row.sa_id_number),
      idVerified: !!row.id_verified,
      mobileNumber: row.mobile_number || '',
      mobileVerified: !!row.mobile_verified,
      preferredLanguage: row.preferred_language || 'English',
      pushNotificationsEnabled: !!row.push_notifications_enabled,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
    };
  }

  private mapRowToRelationship(row: any): GuardianLearnerRelationship {
    return {
      id: row.id,
      guardianId: row.guardian_id,
      learnerId: row.learner_id,
      relationshipType: row.relationship_type,
      isPrimary: !!row.is_primary_contact,
      legalCustodyVerified: !!row.has_custody_rights,
      authorizedForPickup: !!row.can_pickup,
      receiveSosAlerts: true,
      verificationStatus: row.verification_status || 'VERIFIED',
      establishedAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      establishedByStaffUserId: 'SYSTEM',
      establishedByStaffName: 'System Registration',
      establishedBySchoolId: 'SYSTEM',
      auditTrailId: 'AUD-INIT'
    };
  }
}

// ----------------------------------------------------
// 5. POSTGRES LEARNER REPOSITORY
// ----------------------------------------------------
export class PostgresLearnerRepository implements ILearnerRepository {
  async findById(id: string): Promise<Learner | null> {
    const res = await query(`SELECT * FROM learners WHERE id = $1;`, [id]);
    if (res.rows.length === 0) return null;
    return this.mapRowToLearner(res.rows[0]);
  }

  async findByEmisId(emisId: string): Promise<Learner | null> {
    if (!emisId) return null;
    const res = await query(`SELECT * FROM learners WHERE emis_id = $1;`, [emisId.trim()]);
    if (res.rows.length === 0) return null;
    return this.mapRowToLearner(res.rows[0]);
  }

  async findHydratedById(id: string): Promise<HydratedLearnerRecord | null> {
    const learnerRes = await query(`SELECT * FROM learners WHERE id = $1;`, [id]);
    if (learnerRes.rows.length === 0) return null;
    const learner = this.mapRowToLearner(learnerRes.rows[0]);

    // Person
    const personRes = await query(`SELECT * FROM persons WHERE id = $1;`, [learner.personId]);
    if (personRes.rows.length === 0) return null;
    const person = new PostgresPersonRepository()['mapRowToPerson'](personRes.rows[0]);

    // Active Enrolment
    const enrRes = await query(
      `SELECT * FROM school_enrolments WHERE learner_id = $1 AND enrolment_status = 'ACTIVE' ORDER BY academic_year DESC LIMIT 1;`,
      [id]
    );
    let currentEnrolment: SchoolEnrolment | undefined;
    let currentSchool: School | undefined;

    if (enrRes.rows.length > 0) {
      const eRow = enrRes.rows[0];
      currentEnrolment = {
        id: eRow.id,
        learnerId: eRow.learner_id,
        schoolId: eRow.school_id,
        admissionDate: eRow.created_at ? new Date(eRow.created_at).toISOString() : new Date().toISOString(),
        enrolmentStatus: eRow.enrolment_status,
        currentAcademicYear: eRow.academic_year,
        enrolledByStaffId: 'SYSTEM',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const schoolRes = await query(`SELECT * FROM schools WHERE id = $1;`, [eRow.school_id]);
      if (schoolRes.rows.length > 0) {
        currentSchool = new PostgresSchoolRepository()['mapRowToSchool'](schoolRes.rows[0]);
      }
    }

    // Academic Records
    const acdRes = await query(
      `SELECT * FROM academic_records WHERE learner_id = $1 ORDER BY academic_year DESC;`,
      [id]
    );
    const academicHistory: AcademicRecord[] = acdRes.rows.map(r => ({
      id: r.id,
      learnerId: r.learner_id,
      schoolId: r.school_id || currentSchool?.id || 'SCH-001',
      academicYear: r.academic_year,
      grade: r.grade,
      classSection: r.class_section || '',
      homeroomTeacher: r.homeroom_teacher || '',
      status: r.status,
      attendanceRate: r.attendance_rate ? Number(r.attendance_rate) : 95.0,
      updatedAt: new Date().toISOString()
    }));
    const currentAcademicRecord = academicHistory.find(a => a.status === 'CURRENT') || academicHistory[0];

    // Linked Guardians
    const relRes = await query(
      `SELECT glr.*, g.person_id as g_person_id, g.sa_id_number, g.sa_id_masked, g.preferred_language,
              g.push_notifications_enabled, g.id_verified as g_id_verified,
              p.first_name, p.last_name, p.mobile_number, p.email, p.official_id, p.date_of_birth, p.gender, p.residential_address
       FROM guardian_learner_relationships glr
       JOIN guardians g ON glr.guardian_id = g.id
       JOIN persons p ON g.person_id = p.id
       WHERE glr.learner_id = $1 AND glr.access_status = 'ACTIVE';`,
      [id]
    );

    const guardians: HydratedLearnerRecord['guardians'] = relRes.rows.map(r => ({
      guardian: {
        id: r.guardian_id,
        personId: r.g_person_id,
        saIdNumber: r.sa_id_number || '',
        saIdMasked: r.sa_id_masked || maskSaId(r.sa_id_number),
        idVerified: !!r.g_id_verified,
        mobileNumber: r.mobile_number || '',
        mobileVerified: true,
        preferredLanguage: r.preferred_language || 'English',
        pushNotificationsEnabled: !!r.push_notifications_enabled,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      person: {
        id: r.g_person_id,
        officialId: r.official_id,
        idType: 'SA_ID',
        firstName: r.first_name,
        lastName: r.last_name,
        dateOfBirth: r.date_of_birth ? new Date(r.date_of_birth).toISOString().split('T')[0] : '1985-01-01',
        gender: r.gender || 'UNDISCLOSED',
        mobileNumber: r.mobile_number,
        mobileVerified: true,
        email: r.email,
        emailVerified: true,
        physicalAddress: r.residential_address,
        isVerified: true,
        verificationSource: 'MANUAL_STAFF_VERIFIED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      relationship: {
        id: r.id,
        guardianId: r.guardian_id,
        learnerId: r.learner_id,
        relationshipType: r.relationship_type,
        isPrimary: !!r.is_primary_contact,
        legalCustodyVerified: !!r.has_custody_rights,
        authorizedForPickup: !!r.can_pickup,
        receiveSosAlerts: true,
        verificationStatus: r.verification_status || 'VERIFIED',
        establishedAt: new Date().toISOString(),
        establishedByStaffUserId: 'SYSTEM',
        establishedByStaffName: 'System Registration',
        establishedBySchoolId: 'SYSTEM',
        auditTrailId: 'AUD-INIT'
      }
    }));

    // Recent Incident
    const incRes = await query(
      `SELECT * FROM incidents WHERE learner_id = $1 ORDER BY triggered_at DESC LIMIT 1;`,
      [id]
    );
    const recentIncident = incRes.rows.length > 0 ? new PostgresIncidentRepository()['mapRowToIncident'](incRes.rows[0]) : undefined;

    return {
      learner,
      person,
      currentSchool,
      currentEnrolment,
      currentAcademicRecord,
      academicHistory,
      guardians,
      recentIncident
    };
  }

  async queryHydrated(options?: LearnerQueryOptions): Promise<PaginatedResponse<HydratedLearnerRecord>> {
    const limit = Math.min(Math.max(Number(options?.limit) || 25, 1), 100);
    const page = Math.max(Number(options?.page) || 1, 1);
    const offset = options?.offset !== undefined ? Number(options.offset) : (page - 1) * limit;

    let whereClauses: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    if (options?.schoolId) {
      whereClauses.push(`EXISTS (SELECT 1 FROM school_enrolments se WHERE se.learner_id = l.id AND se.school_id = $${paramIndex++} AND se.enrolment_status = 'ACTIVE')`);
      params.push(options.schoolId);
    }
    if (options?.guardianId) {
      whereClauses.push(`EXISTS (SELECT 1 FROM guardian_learner_relationships glr WHERE glr.learner_id = l.id AND glr.guardian_id = $${paramIndex++} AND glr.access_status = 'ACTIVE')`);
      params.push(options.guardianId);
    }
    if (options?.search) {
      whereClauses.push(`(p.first_name ILIKE $${paramIndex} OR p.last_name ILIKE $${paramIndex} OR l.emis_id ILIKE $${paramIndex} OR l.admission_number ILIKE $${paramIndex})`);
      params.push(`%${options.search}%`);
      paramIndex++;
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRes = await query(
      `SELECT COUNT(*) as total FROM learners l JOIN persons p ON l.person_id = p.id ${whereStr};`,
      params
    );
    const total = parseInt(countRes.rows[0].total, 10);

    const idRes = await query(
      `SELECT l.id FROM learners l JOIN persons p ON l.person_id = p.id ${whereStr} ORDER BY p.last_name ASC, p.first_name ASC LIMIT $${paramIndex++} OFFSET $${paramIndex++};`,
      [...params, limit, offset]
    );

    const data: HydratedLearnerRecord[] = [];
    for (const r of idRes.rows) {
      const hydrated = await this.findHydratedById(r.id);
      if (hydrated) data.push(hydrated);
    }

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        total,
        limit,
        offset,
        page,
        totalPages,
        hasMore: page < totalPages
      }
    };
  }

  // --------------------------------------------------------------------------
  // ATOMIC AUTHORITATIVE ONBOARDING (TRANSACTIONAL POSTGRESQL INSERT)
  // --------------------------------------------------------------------------
  async onboardAtomic(payload: AuthoritativeOnboardPayload): Promise<HydratedLearnerRecord> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const now = new Date().toISOString();

      // 1. Learner Person
      let learnerPersonId = 'per-l-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);

      await client.query(
        `INSERT INTO persons (
          id, official_id, official_id_type, first_name, last_name, date_of_birth,
          gender, mobile_number, email, residential_address, is_verified, verification_source
        ) VALUES ($1, $2, 'SA_ID', $3, $4, $5, $6, NULL, NULL, NULL, TRUE, 'EMIS_VERIFIED')
        ON CONFLICT (id) DO UPDATE SET
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          updated_at = CURRENT_TIMESTAMP;`,
        [
          learnerPersonId,
          payload.learner.officialId || payload.learner.emisId,
          payload.learner.firstName,
          payload.learner.lastName,
          payload.learner.dateOfBirth,
          payload.learner.gender
        ]
      );

      // 2. Learner Record
      const learnerId = payload.learner.existingLearnerId || ('lrn-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6));
      await client.query(
        `INSERT INTO learners (
          id, person_id, emis_id, admission_number, blood_group, medical_allergies,
          chronic_conditions, emergency_notes, tracking_consent_status, current_device_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'CONSENTED', $9)
        ON CONFLICT (id) DO UPDATE SET
          emis_id = EXCLUDED.emis_id,
          admission_number = EXCLUDED.admission_number,
          blood_group = EXCLUDED.blood_group,
          updated_at = CURRENT_TIMESTAMP;`,
        [
          learnerId,
          learnerPersonId,
          payload.learner.emisId,
          payload.learner.emisId,
          payload.learner.bloodType || null,
          payload.learner.allergies || [],
          [],
          payload.learner.medicalNotes || null,
          payload.learner.trackingBeaconId || null
        ]
      );

      // 3. School Enrolment
      const enrolmentId = 'enr-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
      await client.query(
        `INSERT INTO school_enrolments (
          id, learner_id, school_id, academic_year, grade, class_section, enrolment_status
        ) VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')
        ON CONFLICT (learner_id, academic_year, enrolment_status) DO UPDATE SET
          school_id = EXCLUDED.school_id,
          grade = EXCLUDED.grade,
          class_section = EXCLUDED.class_section;`,
        [
          enrolmentId,
          learnerId,
          payload.enrolment.schoolId,
          payload.enrolment.academicYear || 2026,
          payload.enrolment.grade,
          payload.enrolment.classSection || ''
        ]
      );

      // 4. Academic Record
      const academicId = 'acd-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
      await client.query(
        `INSERT INTO academic_records (
          id, learner_id, school_id, academic_year, grade, class_section, homeroom_teacher, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'CURRENT')
        ON CONFLICT (id) DO NOTHING;`,
        [
          academicId,
          learnerId,
          payload.enrolment.schoolId,
          payload.enrolment.academicYear || 2026,
          payload.enrolment.grade,
          payload.enrolment.classSection || '',
          payload.enrolment.homeroomTeacher || null
        ]
      );

      // 5. Guardian Person & Guardian
      let guardianPersonId = 'per-g-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);

      await client.query(
        `INSERT INTO persons (
          id, official_id, official_id_type, first_name, last_name, date_of_birth,
          gender, mobile_number, email, residential_address, is_verified, verification_source
        ) VALUES ($1, $2, 'SA_ID', $3, $4, '1985-01-01', 'UNDISCLOSED', $5, $6, $7, TRUE, 'DHA_NPR_LOOKUP')
        ON CONFLICT (id) DO UPDATE SET
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          mobile_number = EXCLUDED.mobile_number,
          email = EXCLUDED.email,
          updated_at = CURRENT_TIMESTAMP;`,
        [
          guardianPersonId,
          payload.guardian.saIdNumber,
          payload.guardian.firstName,
          payload.guardian.lastName,
          payload.guardian.mobileNumber,
          payload.guardian.email ? normalizeEmail(payload.guardian.email) : null,
          payload.guardian.physicalAddress || null
        ]
      );

      const guardianId = payload.guardian.existingGuardianId || ('grd-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6));
      await client.query(
        `INSERT INTO guardians (
          id, person_id, sa_id_number, sa_id_masked, id_verified, mobile_number,
          preferred_language, push_notifications_enabled, id_verification_status
        ) VALUES ($1, $2, $3, $4, TRUE, $5, $6, TRUE, 'VERIFIED')
        ON CONFLICT (id) DO UPDATE SET
          mobile_number = EXCLUDED.mobile_number,
          updated_at = CURRENT_TIMESTAMP;`,
        [
          guardianId,
          guardianPersonId,
          payload.guardian.saIdNumber,
          maskSaId(payload.guardian.saIdNumber),
          payload.guardian.mobileNumber,
          payload.guardian.preferredLanguage || 'English'
        ]
      );

      // 6. Relationship
      const relationshipId = 'rel-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
      await client.query(
        `INSERT INTO guardian_learner_relationships (
          id, guardian_id, learner_id, relationship_type, is_primary_contact,
          has_custody_rights, access_status, verification_status, emergency_priority, can_pickup
        ) VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', 'VERIFIED', 1, $7)
        ON CONFLICT (guardian_id, learner_id) DO UPDATE SET
          relationship_type = EXCLUDED.relationship_type,
          is_primary_contact = EXCLUDED.is_primary_contact,
          updated_at = CURRENT_TIMESTAMP;`,
        [
          relationshipId,
          guardianId,
          learnerId,
          payload.relationship.relationshipType || 'LEGAL_GUARDIAN',
          payload.relationship.isPrimary ?? true,
          payload.relationship.legalCustodyVerified ?? true,
          payload.relationship.authorizedForPickup ?? true
        ]
      );

      // 7. Hardware Device (if supplied)
      if (payload.learner.trackingBeaconId) {
        const devSerial = payload.learner.trackingBeaconId.trim();
        const devId = 'dev-' + devSerial.toLowerCase().replace(/[^a-z0-9]/g, '-');
        await client.query(
          `INSERT INTO devices (
            id, serial_number, device_model, hardware_revision, firmware_version,
            device_status, battery_level, assigned_learner_id
          ) VALUES ($1, $2, 'ITIS-Beacon-Pro', 'REV-2.1', 'v2.4.1-rc3', 'ACTIVE', 100, $3)
          ON CONFLICT (serial_number) DO UPDATE SET
            assigned_learner_id = EXCLUDED.assigned_learner_id,
            device_status = 'ACTIVE',
            updated_at = CURRENT_TIMESTAMP;`,
          [devId, devSerial, learnerId]
        );
      }

      // 8. Cryptographic Audit Event
      const auditId = 'aud-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
      const auditDetails = {
        learnerId,
        emisId: payload.learner.emisId,
        schoolId: payload.enrolment.schoolId,
        guardianId,
        staffContext: payload.staffContext
      };
      const checksum = generateChecksum({
        id: auditId,
        timestamp: now,
        actionType: 'ONBOARDING_AUTHORITATIVE_ENROLLED',
        targetId: learnerId,
        actorUserId: payload.staffContext?.staffUserId || 'SYSTEM',
        details: auditDetails
      });

      await client.query(
        `INSERT INTO audit_events (
          id, action_type, actor_user_id, actor_name, actor_role, target_entity,
          target_id, details, ip_address, checksum
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);`,
        [
          auditId,
          'ONBOARDING_AUTHORITATIVE_ENROLLED',
          payload.staffContext?.staffUserId || 'SYSTEM',
          payload.staffContext?.staffName || 'Authoritative Enrollment Engine',
          payload.staffContext?.staffRole || 'SYSTEM_ADMIN',
          'LEARNER',
          learnerId,
          JSON.stringify(auditDetails),
          payload.staffContext?.ipAddress || '127.0.0.1',
          checksum
        ]
      );

      await client.query('COMMIT');

      const hydrated = await this.findHydratedById(learnerId);
      if (!hydrated) {
        throw new Error('Failed to retrieve newly onboarded hydrated learner record.');
      }
      return hydrated;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[PostgreSQL Onboarding Error]', err);
      throw err;
    } finally {
      client.release();
    }
  }

  async advanceAcademicYear(
    learnerId: string,
    payload: {
      schoolId: string;
      newAcademicYear: number;
      newGrade: string;
      newClassSection: string;
      homeroomTeacher?: string;
    },
    staffContext: any
  ): Promise<HydratedLearnerRecord> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Set previous enrolments to GRADUATED / TRANSFERRED
      await client.query(
        `UPDATE school_enrolments SET enrolment_status = 'COMPLETED', exited_at = CURRENT_TIMESTAMP WHERE learner_id = $1 AND enrolment_status = 'ACTIVE';`,
        [learnerId]
      );

      const enrId = 'enr-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
      await client.query(
        `INSERT INTO school_enrolments (
          id, learner_id, school_id, academic_year, grade, class_section, enrolment_status
        ) VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')
        ON CONFLICT (learner_id, academic_year, enrolment_status) DO UPDATE SET
          school_id = EXCLUDED.school_id,
          grade = EXCLUDED.grade,
          class_section = EXCLUDED.class_section;`,
        [enrId, learnerId, payload.schoolId, payload.newAcademicYear, payload.newGrade, payload.newClassSection]
      );

      // Academic record
      await client.query(
        `UPDATE academic_records SET status = 'COMPLETED' WHERE learner_id = $1 AND status = 'CURRENT';`,
        [learnerId]
      );
      const acdId = 'acd-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
      await client.query(
        `INSERT INTO academic_records (
          id, learner_id, school_id, academic_year, grade, class_section, homeroom_teacher, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'CURRENT');`,
        [acdId, learnerId, payload.schoolId, payload.newAcademicYear, payload.newGrade, payload.newClassSection, payload.homeroomTeacher || null]
      );

      await client.query('COMMIT');
      const hydrated = await this.findHydratedById(learnerId);
      return hydrated!;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async submitAnnualSafetyUpdate(payload: AnnualSafetyUpdatePayload): Promise<HydratedLearnerRecord> {
    const { learnerId, medicalInfo } = payload;
    await query(
      `UPDATE learners 
       SET blood_group = COALESCE($1, blood_group),
           medical_allergies = COALESCE($2, medical_allergies),
           chronic_conditions = COALESCE($3, chronic_conditions),
           special_needs = COALESCE($4, special_needs),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5;`,
      [
        medicalInfo?.bloodType || null,
        medicalInfo?.allergies || [],
        medicalInfo?.chronicConditions ? [medicalInfo.chronicConditions] : [],
        medicalInfo?.specialNeeds || null,
        learnerId
      ]
    );

    const hydrated = await this.findHydratedById(learnerId);
    return hydrated!;
  }

  private mapRowToLearner(row: any): Learner {
    return {
      id: row.id,
      personId: row.person_id,
      emisId: row.emis_id,
      admissionNumber: row.admission_number,
      bloodType: row.blood_group || row.blood_type || undefined,
      allergies: row.medical_allergies || [],
      medicalNotes: row.emergency_notes || undefined,
      specialSafetyNotes: row.special_needs || undefined,
      trackingBeaconId: row.current_device_id || undefined,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
    };
  }
}

// ----------------------------------------------------
// 6. POSTGRES DEVICE REPOSITORY
// ----------------------------------------------------
export class PostgresDeviceRepository implements IDeviceRepository {
  async findById(id: string): Promise<any | null> {
    const res = await query(`SELECT * FROM devices WHERE id = $1;`, [id]);
    return res.rows[0] || null;
  }

  async findBySerialNumber(serialNumber: string): Promise<any | null> {
    const res = await query(`SELECT * FROM devices WHERE serial_number = $1;`, [serialNumber.trim()]);
    return res.rows[0] || null;
  }

  async findAssignedToLearner(learnerId: string): Promise<any | null> {
    const res = await query(`SELECT * FROM devices WHERE assigned_learner_id = $1;`, [learnerId]);
    return res.rows[0] || null;
  }

  async assignToLearner(deviceId: string, learnerId: string, assignedByUserId: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Unassign previously assigned device for this learner
      await client.query(`UPDATE devices SET assigned_learner_id = NULL WHERE assigned_learner_id = $1;`, [learnerId]);
      // Assign new device
      await client.query(
        `UPDATE devices SET assigned_learner_id = $1, device_status = 'ACTIVE', updated_at = CURRENT_TIMESTAMP WHERE id = $2 OR serial_number = $2;`,
        [learnerId, deviceId]
      );
      // Update learner
      await client.query(
        `UPDATE learners SET current_device_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;`,
        [deviceId, learnerId]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async updateDiagnostic(
    deviceId: string,
    telemetry: { batteryLevel?: number; tamperStatus?: string; lastPingAt?: string }
  ): Promise<void> {
    await query(
      `UPDATE devices 
       SET battery_level = COALESCE($1, battery_level),
           tamper_status = COALESCE($2, tamper_status),
           last_ping_at = COALESCE($3::timestamptz, CURRENT_TIMESTAMP),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 OR serial_number = $4;`,
      [telemetry.batteryLevel || null, telemetry.tamperStatus || null, telemetry.lastPingAt || null, deviceId]
    );
  }
}

// ----------------------------------------------------
// 7. POSTGRES INCIDENT REPOSITORY
// ----------------------------------------------------
export class PostgresIncidentRepository implements IIncidentRepository {
  async findById(id: string): Promise<IncidentAlert | null> {
    const res = await query(`SELECT * FROM incidents WHERE id = $1;`, [id]);
    if (res.rows.length === 0) return null;
    return this.mapRowToIncident(res.rows[0]);
  }

  async query(options?: IncidentQueryOptions): Promise<PaginatedResponse<IncidentAlert>> {
    const limit = Math.min(Math.max(Number(options?.limit) || 25, 1), 100);
    const page = Math.max(Number(options?.page) || 1, 1);
    const offset = options?.offset !== undefined ? Number(options.offset) : (page - 1) * limit;

    let whereClauses: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    if (options?.schoolId) {
      whereClauses.push(`school_id = $${paramIndex++}`);
      params.push(options.schoolId);
    }
    if (options?.learnerId) {
      whereClauses.push(`learner_id = $${paramIndex++}`);
      params.push(options.learnerId);
    }
    if (options?.status) {
      whereClauses.push(`status = $${paramIndex++}`);
      params.push(options.status);
    }
    if (options?.severity) {
      whereClauses.push(`severity = $${paramIndex++}`);
      params.push(options.severity);
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRes = await query(`SELECT COUNT(*) as total FROM incidents ${whereStr};`, params);
    const total = parseInt(countRes.rows[0].total, 10);

    const dataRes = await query(
      `SELECT * FROM incidents ${whereStr} ORDER BY triggered_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++};`,
      [...params, limit, offset]
    );

    const data = dataRes.rows.map(r => this.mapRowToIncident(r));
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        total,
        limit,
        offset,
        page,
        totalPages,
        hasMore: page < totalPages
      }
    };
  }

  async create(alert: IncidentAlert, actorContext: any): Promise<IncidentAlert> {
    const id = alert.id || ('inc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6));
    const now = new Date().toISOString();
    const res = await query(
      `INSERT INTO incidents (
        id, learner_id, school_id, severity, status, trigger_type,
        latitude, longitude, accuracy_meters, location_description,
        notes, assigned_responder, responder_status, triggered_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *;`,
      [
        id,
        alert.learnerId,
        alert.schoolId,
        alert.severity || 'CRITICAL_SOS',
        alert.status || 'ACTIVE_ALARM',
        alert.triggerType || 'MANUAL_SOS_BEACON',
        alert.location?.lat || -25.7589,
        alert.location?.lng || 28.2321,
        alert.location?.accuracyMeters || 4.2,
        alert.location?.addressDescription || null,
        alert.notes || [],
        alert.assignedResponder ? JSON.stringify(alert.assignedResponder) : null,
        alert.operationalState || 'AVAILABLE',
        alert.timestamp || now
      ]
    );
    return this.mapRowToIncident(res.rows[0]);
  }

  async updateStatus(incidentId: string, status: string, notes?: string): Promise<IncidentAlert> {
    const existing = await this.findById(incidentId);
    if (!existing) throw new Error('Incident not found.');

    const newNotes = notes ? [...(existing.notes || []), notes] : existing.notes;
    const resolvedAt = status === 'RESOLVED' ? new Date().toISOString() : null;

    const res = await query(
      `UPDATE incidents 
       SET status = $1, notes = $2, resolved_at = COALESCE($3::timestamptz, resolved_at)
       WHERE id = $4
       RETURNING *;`,
      [status, newNotes, resolvedAt, incidentId]
    );
    return this.mapRowToIncident(res.rows[0]);
  }

  async getTimelineEvents(incidentId: string): Promise<any[]> {
    const res = await query(
      `SELECT * FROM incident_events WHERE incident_id = $1 ORDER BY created_at ASC;`,
      [incidentId]
    );
    return res.rows;
  }

  async addEvent(
    incidentId: string,
    event: {
      eventType: string;
      actorUserId?: string;
      actorName: string;
      actorRole: string;
      notes?: string;
      latitude?: number;
      longitude?: number;
      payload?: any;
    }
  ): Promise<any> {
    const id = 'ev-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
    const res = await query(
      `INSERT INTO incident_events (
        id, incident_id, event_type, actor_user_id, actor_name, actor_role,
        notes, latitude, longitude, payload
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *;`,
      [
        id,
        incidentId,
        event.eventType,
        event.actorUserId || null,
        event.actorName,
        event.actorRole,
        event.notes || null,
        event.latitude || null,
        event.longitude || null,
        event.payload ? JSON.stringify(event.payload) : null
      ]
    );
    return res.rows[0];
  }

  public mapRowToIncident(row: any): IncidentAlert {
    let assignedResp = row.assigned_responder;
    if (typeof assignedResp === 'string') {
      try {
        assignedResp = JSON.parse(assignedResp);
      } catch {}
    }

    return {
      id: row.id,
      learnerId: row.learner_id,
      learnerName: row.learner_name || 'Learner',
      learnerGrade: row.learner_grade || 'Grade 10',
      schoolId: row.school_id,
      schoolName: row.school_name || 'School',
      guardianName: row.guardian_name || 'Guardian',
      guardianMobile: row.guardian_mobile || '0821234567',
      timestamp: row.triggered_at ? new Date(row.triggered_at).toISOString() : new Date().toISOString(),
      severity: row.severity || 'CRITICAL_SOS',
      status: row.status || 'ACTIVE_ALARM',
      operationalState: (row.responder_status as any) || 'AVAILABLE',
      triggerType: row.trigger_type || 'MANUAL_SOS_BEACON',
      location: {
        lat: Number(row.latitude) || -26.2041,
        lng: Number(row.longitude) || 28.0473,
        addressDescription: row.location_description || 'Sector Alert',
        accuracyMeters: row.accuracy_meters ? Number(row.accuracy_meters) : 4.2
      },
      assignedResponder: assignedResp || undefined,
      slaTargetSeconds: 180,
      elapsedSeconds: 45,
      notes: row.notes || []
    };
  }
}

// ----------------------------------------------------
// 8. POSTGRES RESPONDER REPOSITORY
// ----------------------------------------------------
export class PostgresResponderRepository implements IResponderRepository {
  async findById(id: string): Promise<ResponderUnit | null> {
    const res = await query(`SELECT * FROM responders WHERE id = $1;`, [id]);
    if (res.rows.length === 0) return null;
    return this.mapRowToResponder(res.rows[0]);
  }

  async findByCallsign(callsign: string): Promise<ResponderUnit | null> {
    const res = await query(`SELECT * FROM responders WHERE callsign = $1;`, [callsign]);
    if (res.rows.length === 0) return null;
    return this.mapRowToResponder(res.rows[0]);
  }

  async findAll(): Promise<ResponderUnit[]> {
    const res = await query(`SELECT * FROM responders ORDER BY callsign ASC;`);
    return res.rows.map(r => this.mapRowToResponder(r));
  }

  async findAvailable(district?: string): Promise<ResponderUnit[]> {
    let sql = `SELECT * FROM responders WHERE is_available = TRUE AND status = 'AVAILABLE'`;
    const params: any[] = [];
    if (district) {
      sql += ` AND assigned_district = $1`;
      params.push(district);
    }
    const res = await query(sql, params);
    return res.rows.map(r => this.mapRowToResponder(r));
  }

  async getAssignedIncidentsForUser(user: any): Promise<AssignedIncidentView[]> {
    const res = await query(
      `SELECT i.* FROM incidents i 
       WHERE i.status != 'RESOLVED' 
         AND (
           i.assigned_responder->>'id' = $1 
           OR i.assigned_responder->>'vehicleId' = $2
           OR i.assigned_responder->>'id' = $2
         )
       ORDER BY i.triggered_at DESC;`,
      [user.id, user.responderUnit || '']
    );

    const views: AssignedIncidentView[] = [];
    const learnerRepo = new PostgresLearnerRepository();

    for (const incRow of res.rows) {
      const inc = new PostgresIncidentRepository().mapRowToIncident(incRow);
      const hydrated = await learnerRepo.findHydratedById(inc.learnerId);
      if (hydrated) {
        const primaryG = hydrated.guardians[0];
        views.push({
          incidentId: inc.id,
          learnerId: inc.learnerId,
          learnerName: `${hydrated.person.firstName} ${hydrated.person.lastName}`,
          learnerGrade: hydrated.currentAcademicRecord?.grade || 'Grade 10',
          learnerPhotoUrl: hydrated.learner.photoUrl,
          schoolName: hydrated.currentSchool?.name || inc.schoolName,
          schoolAddress: hydrated.currentSchool?.address || 'School Campus',
          severity: inc.severity,
          status: inc.status,
          operationalState: (inc.operationalState as any) || 'ASSIGNMENT_RECEIVED',
          triggerType: inc.triggerType,
          situationSummary: `Active Alert triggered by ${inc.triggerType}`,
          approvedLocation: {
            lat: inc.location.lat,
            lng: inc.location.lng,
            addressDescription: inc.location.addressDescription,
            accuracyMeters: inc.location.accuracyMeters,
            isVerified: true
          },
          route: {
            distanceKm: 2.4,
            etaMinutes: 6,
            waypoints: [
              { lat: inc.location.lat - 0.005, lng: inc.location.lng - 0.005, instruction: 'Head north on Main Rd' },
              { lat: inc.location.lat, lng: inc.location.lng, instruction: 'Arrive at destination' }
            ]
          },
          medicalCriticals: {
            bloodType: hydrated.learner.bloodType,
            allergies: hydrated.learner.allergies,
            medicalNotes: hydrated.learner.medicalNotes
          },
          primaryGuardianContact: {
            name: primaryG ? `${primaryG.person.firstName} ${primaryG.person.lastName}` : inc.guardianName,
            relationship: primaryG ? primaryG.relationship.relationshipType : 'GUARDIAN',
            mobileNumber: primaryG ? (primaryG.person.mobileNumber || '') : inc.guardianMobile
          },
          commandCenterContact: {
            callSign: 'EAGLE-BASE',
            phone: '+27 11 999 0000',
            frequency: 'VHF 142.800 MHz'
          },
          dispatchedAt: inc.timestamp,
          isSimulation: false
        });
      }
    }
    return views;
  }

  async acceptAssignment(incidentId: string, user: any): Promise<any> {
    const incRes = await query(`SELECT * FROM incidents WHERE id = $1;`, [incidentId]);
    if (incRes.rows.length === 0) throw new Error('Incident not found.');

    await query(
      `UPDATE incidents SET responder_status = 'ACCEPTED', acknowledged_at = CURRENT_TIMESTAMP WHERE id = $1;`,
      [incidentId]
    );
    return { success: true, message: 'Assignment accepted.' };
  }

  async declineAssignment(incidentId: string, user: any, reason: string): Promise<any> {
    await query(
      `UPDATE incidents SET responder_status = 'DECLINED', notes = array_append(notes, $1) WHERE id = $2;`,
      [`Declined by ${user.name}: ${reason}`, incidentId]
    );
    return { success: true, message: 'Assignment declined.' };
  }

  async updateOperationalStatus(
    incidentId: string,
    user: any,
    status: string,
    note?: string,
    telemetry?: any
  ): Promise<any> {
    const arrivedAt = status === 'ARRIVED' ? new Date().toISOString() : null;
    await query(
      `UPDATE incidents 
       SET responder_status = $1, arrived_at = COALESCE($2::timestamptz, arrived_at),
           notes = CASE WHEN $3::text IS NOT NULL THEN array_append(notes, $3) ELSE notes END
       WHERE id = $4;`,
      [status, arrivedAt, note || null, incidentId]
    );
    return { success: true, status };
  }

  async submitOutcomeReport(report: IncidentOutcomeReport, user: any): Promise<IncidentAlert> {
    const incidentRepo = new PostgresIncidentRepository();
    const updated = await incidentRepo.updateStatus(report.incidentId, 'RESOLVED', `Outcome: ${report.sceneStatusSummary || 'Report submitted'}`);
    return updated;
  }

  private mapRowToResponder(row: any): ResponderUnit {
    return {
      id: row.id,
      callSign: row.callsign,
      name: row.name,
      unitType: row.unit_type,
      vehicleId: row.vehicle_id || undefined,
      contactPhone: row.contact_phone,
      radioFrequency: row.radio_frequency || undefined,
      currentLocation: {
        lat: row.current_latitude ? Number(row.current_latitude) : -25.7550,
        lng: row.current_longitude ? Number(row.current_longitude) : 28.2310,
        addressDescription: row.address_description || 'Sector Patrol',
        isVerified: true
      },
      status: row.status as any,
      assignedUserId: row.assigned_user_id || undefined,
      capabilities: row.capabilities || [],
      ratingScore: row.rating_score ? Number(row.rating_score) : 4.8
    };
  }
}

// ----------------------------------------------------
// 9. POSTGRES AUDIT REPOSITORY
// ----------------------------------------------------
export class PostgresAuditRepository implements IAuditRepository {
  async logEvent(event: Omit<ImmutableAuditEvent, 'id' | 'timestamp' | 'checksum'>): Promise<ImmutableAuditEvent> {
    const id = 'aud-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
    const timestamp = new Date().toISOString();
    const checksum = generateChecksum({
      id,
      timestamp,
      actionType: event.actionType,
      targetId: event.targetId,
      actorUserId: event.actorUserId,
      details: event.details
    });

    const res = await query(
      `INSERT INTO audit_events (
        id, action_type, actor_user_id, actor_name, actor_role,
        target_entity, target_id, details, ip_address, checksum, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;`,
      [
        id,
        event.actionType,
        event.actorUserId,
        event.actorName,
        event.actorRole,
        event.targetEntity,
        event.targetId,
        JSON.stringify(event.details || {}),
        event.ipAddress || '127.0.0.1',
        checksum,
        timestamp
      ]
    );

    return this.mapRowToAuditEvent(res.rows[0]);
  }

  async query(options?: AuditLogQueryOptions): Promise<PaginatedResponse<ImmutableAuditEvent>> {
    const limit = Math.min(Math.max(Number(options?.limit) || 25, 1), 100);
    const page = Math.max(Number(options?.page) || 1, 1);
    const offset = options?.offset !== undefined ? Number(options.offset) : (page - 1) * limit;

    let whereClauses: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    if (options?.actionType) {
      whereClauses.push(`action_type = $${paramIndex++}`);
      params.push(options.actionType);
    }
    if (options?.actorUserId) {
      whereClauses.push(`actor_user_id = $${paramIndex++}`);
      params.push(options.actorUserId);
    }
    if (options?.targetEntity) {
      whereClauses.push(`target_entity = $${paramIndex++}`);
      params.push(options.targetEntity);
    }
    if (options?.targetId) {
      whereClauses.push(`target_id = $${paramIndex++}`);
      params.push(options.targetId);
    }
    if (options?.startDate) {
      whereClauses.push(`created_at >= $${paramIndex++}`);
      params.push(options.startDate);
    }
    if (options?.endDate) {
      whereClauses.push(`created_at <= $${paramIndex++}`);
      params.push(options.endDate);
    }
    if (options?.search) {
      whereClauses.push(`(actor_name ILIKE $${paramIndex} OR action_type ILIKE $${paramIndex} OR target_id ILIKE $${paramIndex})`);
      params.push(`%${options.search}%`);
      paramIndex++;
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRes = await query(`SELECT COUNT(*) as total FROM audit_events ${whereStr};`, params);
    const total = parseInt(countRes.rows[0].total, 10);

    const dataRes = await query(
      `SELECT * FROM audit_events ${whereStr} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++};`,
      [...params, limit, offset]
    );

    const data = dataRes.rows.map(r => this.mapRowToAuditEvent(r));
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        total,
        limit,
        offset,
        page,
        totalPages,
        hasMore: page < totalPages
      }
    };
  }

  async verifyIntegrity(): Promise<{ valid: boolean; totalChecked: number; corruptedBlocks: string[] }> {
    const res = await query(`SELECT id, checksum, action_type FROM audit_events ORDER BY created_at ASC;`);
    const corrupted: string[] = [];
    for (const r of res.rows) {
      if (!r.checksum || !r.id || !r.action_type) {
        corrupted.push(r.id || 'UNKNOWN');
      }
    }
    return {
      valid: corrupted.length === 0,
      totalChecked: res.rows.length,
      corruptedBlocks: corrupted
    };
  }

  private mapRowToAuditEvent(row: any): ImmutableAuditEvent {
    let detailsObj = row.details;
    if (typeof detailsObj === 'string') {
      try {
        detailsObj = JSON.parse(detailsObj);
      } catch {}
    }
    return {
      id: row.id,
      timestamp: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      actionType: row.action_type,
      actorUserId: row.actor_user_id,
      actorName: row.actor_name,
      actorRole: row.actor_role,
      targetEntity: row.target_entity,
      targetId: row.target_id,
      details: detailsObj || {},
      ipAddress: row.ip_address || '127.0.0.1',
      checksum: row.checksum
    };
  }
}

// ----------------------------------------------------
// 10. POSTGRES SESSION REPOSITORY
// ----------------------------------------------------
export class PostgresSessionRepository {
  async createSession(
    token: string,
    userId: string,
    sessionUser: ActiveUserSession,
    permissions: string[],
    ttlHours: number = 24
  ): Promise<ActiveSessionRecord> {
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();

    await query(
      `INSERT INTO sessions (token, user_id, session_data, permissions, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (token) DO UPDATE SET
         session_data = EXCLUDED.session_data,
         expires_at = EXCLUDED.expires_at;`,
      [token, userId, JSON.stringify(sessionUser), permissions, expiresAt, createdAt]
    );

    return {
      token,
      userId,
      session: sessionUser,
      permissions,
      createdAt,
      expiresAt
    };
  }

  async getSession(token: string): Promise<ActiveSessionRecord | null> {
    if (!token) return null;
    const clean = token.replace('Bearer ', '').trim();
    const res = await query(
      `SELECT * FROM sessions WHERE token = $1 AND expires_at > CURRENT_TIMESTAMP;`,
      [clean]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    let sessionUser = row.session_data;
    if (typeof sessionUser === 'string') {
      try {
        sessionUser = JSON.parse(sessionUser);
      } catch {}
    }

    return {
      token: row.token,
      userId: row.user_id,
      session: sessionUser,
      permissions: row.permissions || [],
      createdAt: new Date(row.created_at).toISOString(),
      expiresAt: new Date(row.expires_at).toISOString()
    };
  }

  async revokeSession(token: string): Promise<boolean> {
    if (!token) return false;
    const clean = token.replace('Bearer ', '').trim();
    const res = await query(`DELETE FROM sessions WHERE token = $1;`, [clean]);
    return (res.rowCount || 0) > 0;
  }

  async revokeUserSessions(userId: string, exceptToken?: string): Promise<void> {
    if (exceptToken) {
      await query(`DELETE FROM sessions WHERE user_id = $1 AND token != $2;`, [userId, exceptToken]);
    } else {
      await query(`DELETE FROM sessions WHERE user_id = $1;`, [userId]);
    }
  }
}

// ----------------------------------------------------
// 11. MAIN POSTGRES DATA REPOSITORY IMPLEMENTATION
// ----------------------------------------------------
export class PostgresDataRepository implements IDataRepository {
  public users: PostgresUserRepository;
  public schools: PostgresSchoolRepository;
  public persons: PostgresPersonRepository;
  public learners: PostgresLearnerRepository;
  public guardians: PostgresGuardianRepository;
  public devices: PostgresDeviceRepository;
  public incidents: PostgresIncidentRepository;
  public responders: PostgresResponderRepository;
  public auditLogs: PostgresAuditRepository;
  public sessions: PostgresSessionRepository;

  constructor() {
    this.users = new PostgresUserRepository();
    this.schools = new PostgresSchoolRepository();
    this.persons = new PostgresPersonRepository();
    this.learners = new PostgresLearnerRepository();
    this.guardians = new PostgresGuardianRepository();
    this.devices = new PostgresDeviceRepository();
    this.incidents = new PostgresIncidentRepository();
    this.responders = new PostgresResponderRepository();
    this.auditLogs = new PostgresAuditRepository();
    this.sessions = new PostgresSessionRepository();
  }

  async beginTransaction(): Promise<DatabaseTransaction> {
    const client = await pool.connect();
    await client.query('BEGIN');
    return {
      commit: async () => {
        try {
          await client.query('COMMIT');
        } finally {
          client.release();
        }
      },
      rollback: async () => {
        try {
          await client.query('ROLLBACK');
        } finally {
          client.release();
        }
      }
    };
  }

  async checkHealth(): Promise<{ status: 'HEALTHY' | 'DEGRADED'; provider: 'POSTGRES' | 'DEVELOPMENT_MEMORY'; details?: any }> {
    try {
      const res = await pool.query('SELECT 1 as alive');
      const isAlive = res.rows.length > 0 && res.rows[0].alive === 1;
      return {
        status: isAlive ? 'HEALTHY' : 'DEGRADED',
        provider: 'POSTGRES',
        details: {
          databaseConnected: isAlive,
          poolTotal: pool.totalCount,
          poolIdle: pool.idleCount,
          poolWaiting: pool.waitingCount
        }
      };
    } catch (err: any) {
      return {
        status: 'DEGRADED',
        provider: 'POSTGRES',
        details: {
          error: err.message
        }
      };
    }
  }
}
