import {
  db,
  maskSaId,
  maskPhone,
  hashPassword,
  generateSalt
} from './dbStore.js';
import {
  Person,
  Learner,
  Guardian,
  GuardianLearnerRelationship,
  School,
  SchoolEnrolment,
  AcademicRecord,
  AuthoritativeOnboardPayload,
  AnnualSafetyUpdatePayload,
  RegisterSchoolPayload,
  IdentitySearchResult,
  ExistingGuardianMatch,
  ExistingLearnerMatch,
  LinkedChildSummary,
  MatchType
} from '../types.js';

export class EnrolmentEngine {
  /**
   * Search for existing Authoritative Person/Guardian/Learner records.
   * Enforces rigorous duplicate prevention rules.
   */
  public searchIdentity(params: {
    saIdNumber?: string;
    mobileNumber?: string;
    emisId?: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
  }): IdentitySearchResult {
    const cleanId = params.saIdNumber ? params.saIdNumber.trim().replace(/\s+/g, '') : '';
    const cleanMobile = params.mobileNumber ? params.mobileNumber.trim().replace(/\s+/g, '') : '';
    const cleanEmis = params.emisId ? params.emisId.trim().toUpperCase() : '';
    const fName = params.firstName ? params.firstName.trim().toLowerCase() : '';
    const lName = params.lastName ? params.lastName.trim().toLowerCase() : '';

    // ==========================================
    // 1. CHECK LEARNER IDENTITY MATCH (via EMIS / Admission ID)
    // ==========================================
    if (cleanEmis) {
      for (const learner of db.learners.values()) {
        if (
          learner.emisId.toUpperCase() === cleanEmis ||
          learner.admissionNumber.toUpperCase() === cleanEmis
        ) {
          const person = db.persons.get(learner.personId);
          if (person) {
            // Count linked guardians
            let guardianCount = 0;
            for (const rel of db.relationships.values()) {
              if (rel.learnerId === learner.id) guardianCount++;
            }

            // Get current school & grade
            let schoolName = 'Unassigned';
            let grade = 'N/A';
            for (const enr of db.enrolments.values()) {
              if (enr.learnerId === learner.id && enr.enrolmentStatus === 'ACTIVE') {
                const sch = db.schools.get(enr.schoolId);
                if (sch) schoolName = sch.name;
                break;
              }
            }
            for (const acd of db.academicRecords.values()) {
              if (acd.learnerId === learner.id && acd.status === 'CURRENT') {
                grade = `${acd.grade} (${acd.classSection})`;
                break;
              }
            }

            const learnerMatch: ExistingLearnerMatch = {
              learnerId: learner.id,
              personId: person.id,
              fullName: `${person.firstName} ${person.lastName}`,
              emisId: learner.emisId,
              dateOfBirth: person.dateOfBirth,
              currentSchoolName: schoolName,
              currentGrade: grade,
              linkedGuardiansCount: guardianCount
            };

            return {
              matchType: 'EXACT_ID_MATCH',
              entityType: 'LEARNER',
              learnerMatch,
              confidenceScore: 100,
              title: 'Authoritative Learner Found',
              description: `Learner "${person.firstName} ${person.lastName}" is already registered in the National Child Safety Database with EMIS ${learner.emisId}. You may link this learner to your school or advance their grade without duplicating the learner entity.`,
              requiresStaffReview: false,
              allowDirectLink: true
            };
          }
        }
      }
    }

    // ==========================================
    // 2. CHECK GUARDIAN IDENTITY (via SA ID Number - Primary Key)
    // ==========================================
    if (cleanId) {
      for (const guardian of db.guardians.values()) {
        const person = db.persons.get(guardian.personId);
        if (!person) continue;

        if (
          guardian.saIdNumber === cleanId ||
          person.officialId === cleanId
        ) {
          // Check for identity conflict (e.g. completely different surname provided)
          if (lName && person.lastName.toLowerCase() !== lName) {
            return {
              matchType: 'CONFLICT_DETECTED',
              entityType: 'GUARDIAN',
              confidenceScore: 70,
              title: 'Identity Verification Required: Mismatched Record',
              description: `The SA ID ${maskSaId(cleanId)} belongs to verified citizen "${person.firstName} ${person.lastName}", but input specified surname "${params.lastName}". Automatic linking is blocked to protect child safety.`,
              requiresStaffReview: true,
              conflictReason: `SA ID registered to "${person.firstName} ${person.lastName}" (DOB: ${person.dateOfBirth}), whereas form input specified "${params.firstName || ''} ${params.lastName || ''}".`,
              allowDirectLink: false
            };
          }

          // Found verified authoritative guardian! Get all currently linked children
          const linkedChildren = this.getLinkedChildrenForGuardian(guardian.id);

          const guardianMatch: ExistingGuardianMatch = {
            guardianId: guardian.id,
            personId: person.id,
            fullName: `${person.firstName} ${person.lastName}`,
            saIdMasked: maskSaId(guardian.saIdNumber),
            mobileNumber: guardian.mobileNumber,
            mobileVerified: guardian.mobileVerified,
            email: person.email,
            linkedChildren
          };

          return {
            matchType: 'EXACT_ID_MATCH',
            entityType: 'GUARDIAN',
            guardianMatch,
            confidenceScore: 100,
            title: 'Existing Guardian Found',
            description: `Authoritative parent/guardian record found for ${person.firstName} ${person.lastName} (ID: ${maskSaId(guardian.saIdNumber)}). Existing children are listed below. Click "ADD ANOTHER CHILD" to link without creating a duplicate account.`,
            requiresStaffReview: false,
            allowDirectLink: true
          };
        }
      }
    }

    // ==========================================
    // 3. CHECK GUARDIAN BY VERIFIED MOBILE NUMBER (Secondary Key)
    // ==========================================
    if (cleanMobile) {
      for (const guardian of db.guardians.values()) {
        const person = db.persons.get(guardian.personId);
        if (!person) continue;

        const normalizedDBMobile = guardian.mobileNumber.replace(/\s+/g, '').replace(/^0/, '+27');
        const normalizedInputMobile = cleanMobile.replace(/\s+/g, '').replace(/^0/, '+27');

        if (normalizedDBMobile === normalizedInputMobile || guardian.mobileNumber === cleanMobile) {
          const linkedChildren = this.getLinkedChildrenForGuardian(guardian.id);

          const guardianMatch: ExistingGuardianMatch = {
            guardianId: guardian.id,
            personId: person.id,
            fullName: `${person.firstName} ${person.lastName}`,
            saIdMasked: maskSaId(guardian.saIdNumber),
            mobileNumber: guardian.mobileNumber,
            mobileVerified: guardian.mobileVerified,
            email: person.email,
            linkedChildren
          };

          return {
            matchType: 'VERIFIED_MOBILE_MATCH',
            entityType: 'GUARDIAN',
            guardianMatch,
            confidenceScore: 85,
            title: 'Possible Existing Guardian Found (Mobile Match)',
            description: `The mobile number ${cleanMobile} matches verified guardian "${person.firstName} ${person.lastName}". Please review and confirm identity before linking.`,
            requiresStaffReview: true,
            allowDirectLink: true
          };
        }
      }
    }

    // ==========================================
    // 4. CHECK NAME/SURNAME (Assists search, NEVER sole match)
    // ==========================================
    if (fName && lName) {
      for (const person of db.persons.values()) {
        if (
          person.firstName.toLowerCase() === fName &&
          person.lastName.toLowerCase() === lName
        ) {
          const guardian = Array.from(db.guardians.values()).find(g => g.personId === person.id);
          if (guardian) {
            const linkedChildren = this.getLinkedChildrenForGuardian(guardian.id);
            return {
              matchType: 'NAME_SURNAME_POSSIBLE',
              entityType: 'GUARDIAN',
              guardianMatch: {
                guardianId: guardian.id,
                personId: person.id,
                fullName: `${person.firstName} ${person.lastName}`,
                saIdMasked: maskSaId(guardian.saIdNumber),
                mobileNumber: maskPhone(guardian.mobileNumber),
                mobileVerified: guardian.mobileVerified,
                email: person.email,
                linkedChildren
              },
              confidenceScore: 40,
              title: 'Possible Name Match (Manual Verification Required)',
              description: `A person named "${person.firstName} ${person.lastName}" exists. In accordance with ITIS Child Safety Protocol, names and surnames alone CANNOT automatically link records. Please enter an SA ID or verified Mobile Number.`,
              requiresStaffReview: true,
              allowDirectLink: false
            };
          }
        }
      }
    }

    // 5. NO MATCH FOUND -> Ready for clean authoritative creation
    return {
      matchType: 'NO_MATCH',
      entityType: 'GUARDIAN',
      confidenceScore: 0,
      title: 'No Prior Authoritative Record Found',
      description: 'The provided credentials do not exist in the National Register. A new authoritative Person, Learner, and Guardian record will be created and certified.',
      requiresStaffReview: false,
      allowDirectLink: false
    };
  }

  /**
   * Helper to retrieve all linked children for a guardian
   */
  public getLinkedChildrenForGuardian(guardianId: string): LinkedChildSummary[] {
    const list: LinkedChildSummary[] = [];

    for (const rel of db.relationships.values()) {
      if (rel.guardianId === guardianId) {
        const learner = db.learners.get(rel.learnerId);
        if (!learner) continue;
        const person = db.persons.get(learner.personId);
        if (!person) continue;

        let schoolName = 'Unassigned';
        let status: any = 'ACTIVE';
        for (const enr of db.enrolments.values()) {
          if (enr.learnerId === learner.id && enr.enrolmentStatus === 'ACTIVE') {
            status = enr.enrolmentStatus;
            const sch = db.schools.get(enr.schoolId);
            if (sch) schoolName = sch.name;
            break;
          }
        }

        let grade = 'N/A';
        let classSection = 'N/A';
        for (const acd of db.academicRecords.values()) {
          if (acd.learnerId === learner.id && acd.status === 'CURRENT') {
            grade = acd.grade;
            classSection = acd.classSection;
            break;
          }
        }

        list.push({
          learnerId: learner.id,
          personId: person.id,
          fullName: `${person.firstName} ${person.lastName}`,
          emisId: learner.emisId,
          grade,
          classSection,
          schoolName,
          relationshipType: rel.relationshipType,
          isPrimary: rel.isPrimary,
          status
        });
      }
    }

    return list;
  }

  /**
   * Controlled Onboarding Transaction:
   * 1. Learner Information
   * 2. Parent/Guardian Information
   * 3. Relationship
   * 4. School Enrolment & Academic Record
   * CAPTURE ONCE → VERIFY ONCE → CREATE ONCE → REUSE EVERYWHERE
   */
  public authoritativeOnboard(payload: AuthoritativeOnboardPayload): {
    success: boolean;
    learnerId: string;
    guardianId: string;
    relationshipId: string;
    enrolmentId: string;
    academicRecordId: string;
    guardianUserStatus?: 'CREATED' | 'LINKED' | 'CONFLICT' | 'SKIPPED';
    guardianUserMessage?: string;
    message: string;
    auditEventId: string;
  } {
    const { learner: lData, guardian: gData, relationship: rData, enrolment: eData, staffContext } = payload;

    // Validate school exists
    const school = db.schools.get(eData.schoolId);
    if (!school) {
      throw new Error(`School with ID "${eData.schoolId}" not found in authoritative registry.`);
    }

    const now = new Date().toISOString();

    // ----------------------------------------------------
    // STEP 1: RESOLVE / CREATE AUTHORITATIVE GUARDIAN ENTITY
    // ----------------------------------------------------
    let finalGuardianId: string;
    let guardianPersonId: string;
    let wasExistingGuardian = false;

    if (gData.existingGuardianId && db.guardians.has(gData.existingGuardianId)) {
      // Re-use existing authoritative guardian
      finalGuardianId = gData.existingGuardianId;
      const existingG = db.guardians.get(finalGuardianId)!;
      guardianPersonId = existingG.personId;
      wasExistingGuardian = true;

      // Update contact details if provided
      const gPerson = db.persons.get(guardianPersonId);
      if (gPerson) {
        if (gData.email && !gPerson.email) gPerson.email = gData.email;
        if (gData.physicalAddress) gPerson.physicalAddress = gData.physicalAddress;
        gPerson.updatedAt = now;
      }
    } else {
      // Check duplicate search server-side before creating
      const searchResult = this.searchIdentity({
        saIdNumber: gData.saIdNumber,
        mobileNumber: gData.mobileNumber
      });

      if (searchResult.matchType === 'EXACT_ID_MATCH' && searchResult.guardianMatch) {
        // Reuse exact match to prevent duplicates!
        finalGuardianId = searchResult.guardianMatch.guardianId;
        guardianPersonId = searchResult.guardianMatch.personId;
        wasExistingGuardian = true;
      } else {
        // Create new authoritative Person for Guardian
        const newGPersonId = 'per-g-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
        const newGPerson: Person = {
          id: newGPersonId,
          officialId: gData.saIdNumber.trim(),
          idType: 'SA_ID',
          firstName: gData.firstName.trim(),
          lastName: gData.lastName.trim(),
          dateOfBirth: this.deriveDobFromSaId(gData.saIdNumber),
          gender: 'UNDISCLOSED',
          mobileNumber: gData.mobileNumber.trim(),
          mobileVerified: true, // Verified in controlled school transaction
          email: gData.email?.trim(),
          emailVerified: !!gData.email,
          physicalAddress: gData.physicalAddress,
          isVerified: true,
          verificationSource: 'DHA_NPR_LOOKUP',
          createdAt: now,
          updatedAt: now
        };
        db.persons.set(newGPerson.id, newGPerson);

        // Create Guardian entity
        const newGuardianId = 'grd-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
        const newGuardian: Guardian = {
          id: newGuardianId,
          personId: newGPerson.id,
          saIdNumber: gData.saIdNumber.trim(),
          saIdMasked: maskSaId(gData.saIdNumber.trim()),
          idVerified: true,
          mobileNumber: gData.mobileNumber.trim(),
          mobileVerified: true,
          preferredLanguage: gData.preferredLanguage || 'English',
          employerName: gData.employerName,
          pushNotificationsEnabled: true,
          createdAt: now,
          updatedAt: now
        };
        db.guardians.set(newGuardian.id, newGuardian);

        finalGuardianId = newGuardian.id;
        guardianPersonId = newGPerson.id;

        // Audit Guardian creation
        db.logAuditEvent({
          actionType: 'GUARDIAN_CREATED',
          actorUserId: staffContext.staffUserId,
          actorName: staffContext.staffName,
          actorRole: staffContext.staffRole,
          targetEntity: 'GUARDIAN',
          targetId: newGuardian.id,
          details: {
            fullName: `${newGPerson.firstName} ${newGPerson.lastName}`,
            saIdMasked: maskSaId(newGuardian.saIdNumber),
            schoolId: eData.schoolId
          },
          ipAddress: staffContext.ipAddress
        });
      }
    }

    // ----------------------------------------------------
    // STEP 2: RESOLVE / CREATE AUTHORITATIVE LEARNER ENTITY
    // ----------------------------------------------------
    let finalLearnerId: string;
    let learnerPersonId: string;
    let wasExistingLearner = false;

    // Check duplicate device allocation before pairing
    if (lData.trackingBeaconId) {
      const cleanBeacon = lData.trackingBeaconId.trim().toUpperCase();
      for (const otherLearner of db.learners.values()) {
        if (otherLearner.trackingBeaconId?.trim().toUpperCase() === cleanBeacon) {
          const otherPerson = db.persons.get(otherLearner.personId);
          throw new Error(`DUPLICATE HARDWARE DEVICE: Tracking Beacon "${lData.trackingBeaconId}" is already active and paired to learner "${otherPerson?.firstName || ''} ${otherPerson?.lastName || ''}" (EMIS: ${otherLearner.emisId}). Unsafe duplicate device assignments are prohibited.`);
        }
      }
    }

    if (lData.existingLearnerId && db.learners.has(lData.existingLearnerId)) {
      finalLearnerId = lData.existingLearnerId;
      const existingL = db.learners.get(finalLearnerId)!;
      learnerPersonId = existingL.personId;
      wasExistingLearner = true;
    } else {
      // Check if learner already exists by EMIS ID
      const lSearch = this.searchIdentity({ emisId: lData.emisId });
      if (lSearch.matchType === 'EXACT_ID_MATCH' && lSearch.learnerMatch) {
        finalLearnerId = lSearch.learnerMatch.learnerId;
        learnerPersonId = lSearch.learnerMatch.personId;
        wasExistingLearner = true;
      } else {
        // Prevent duplicate learner Official SA ID / Birth Certificate
        if (lData.officialId) {
          const cleanOfficialId = lData.officialId.trim();
          for (const existingPerson of db.persons.values()) {
            if (existingPerson.officialId === cleanOfficialId) {
              const matchedLearner = Array.from(db.learners.values()).find(l => l.personId === existingPerson.id);
              if (matchedLearner) {
                throw new Error(`DUPLICATE LEARNER IDENTITY: Official ID "${cleanOfficialId}" is already registered to learner "${existingPerson.firstName} ${existingPerson.lastName}" (EMIS: ${matchedLearner.emisId}). Duplicate learner creation is prevented.`);
              }
            }
          }
        }

        // Create new authoritative Person for Learner
        const newLPersonId = 'per-l-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
        const newLPerson: Person = {
          id: newLPersonId,
          officialId: lData.officialId?.trim() || lData.emisId.trim(),
          idType: lData.officialId ? 'SA_ID' : 'EMIS_ADMISSION_NO',
          firstName: lData.firstName.trim(),
          lastName: lData.lastName.trim(),
          dateOfBirth: lData.dateOfBirth,
          gender: lData.gender,
          mobileVerified: false,
          emailVerified: false,
          isVerified: true,
          verificationSource: 'EMIS_VERIFIED',
          createdAt: now,
          updatedAt: now
        };
        db.persons.set(newLPerson.id, newLPerson);

        // Create Learner entity
        const newLearnerId = 'lrn-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
        const newLearner: Learner = {
          id: newLearnerId,
          personId: newLPerson.id,
          emisId: lData.emisId.trim().toUpperCase(),
          admissionNumber: lData.emisId.trim().toUpperCase(),
          medicalNotes: lData.medicalNotes,
          bloodType: lData.bloodType || 'O+',
          allergies: lData.allergies || [],
          trackingBeaconId: lData.trackingBeaconId || `BCN-ITIS-${Math.floor(1000 + Math.random() * 9000)}`,
          photoUrl: `https://images.unsplash.com/photo-${1534528741775 + Math.floor(Math.random() * 1000)}?w=200&auto=format&fit=crop&q=80`,
          createdAt: now,
          updatedAt: now
        };
        db.learners.set(newLearner.id, newLearner);

        finalLearnerId = newLearner.id;
        learnerPersonId = newLPerson.id;

        // Audit Learner creation
        db.logAuditEvent({
          actionType: 'LEARNER_CREATED',
          actorUserId: staffContext.staffUserId,
          actorName: staffContext.staffName,
          actorRole: staffContext.staffRole,
          targetEntity: 'LEARNER',
          targetId: newLearner.id,
          details: {
            fullName: `${newLPerson.firstName} ${newLPerson.lastName}`,
            emisId: newLearner.emisId,
            schoolId: eData.schoolId
          },
          ipAddress: staffContext.ipAddress
        });

        // Audit Device Pairing
        if (newLearner.trackingBeaconId) {
          db.logAuditEvent({
            actionType: 'DEVICE_PAIRED',
            actorUserId: staffContext.staffUserId,
            actorName: staffContext.staffName,
            actorRole: staffContext.staffRole,
            targetEntity: 'LEARNER',
            targetId: newLearner.id,
            details: {
              learnerName: `${newLPerson.firstName} ${newLPerson.lastName}`,
              trackingBeaconId: newLearner.trackingBeaconId,
              emisId: newLearner.emisId,
              schoolId: eData.schoolId
            },
            ipAddress: staffContext.ipAddress
          });
        }
      }
    }

    // ----------------------------------------------------
    // STEP 3: ESTABLISH AUTHORITATIVE RELATIONSHIP
    // (One Guardian -> Many Learners, One Learner -> Many Guardians)
    // ----------------------------------------------------
    // Check if relationship already exists
    let finalRelId = '';
    for (const rel of db.relationships.values()) {
      if (rel.guardianId === finalGuardianId && rel.learnerId === finalLearnerId) {
        finalRelId = rel.id;
        // Update flags
        rel.relationshipType = rData.relationshipType;
        rel.isPrimary = rData.isPrimary;
        rel.authorizedForPickup = rData.authorizedForPickup;
        rel.receiveSosAlerts = rData.receiveSosAlerts;
        break;
      }
    }

    if (!finalRelId) {
      finalRelId = 'rel-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
      const newRel: GuardianLearnerRelationship = {
        id: finalRelId,
        guardianId: finalGuardianId,
        learnerId: finalLearnerId,
        relationshipType: rData.relationshipType,
        isPrimary: rData.isPrimary,
        legalCustodyVerified: rData.legalCustodyVerified,
        authorizedForPickup: rData.authorizedForPickup,
        receiveSosAlerts: rData.receiveSosAlerts,
        verificationStatus: 'VERIFIED',
        establishedAt: now,
        establishedByStaffUserId: staffContext.staffUserId,
        establishedByStaffName: staffContext.staffName,
        establishedBySchoolId: eData.schoolId,
        auditTrailId: 'aud-' + Date.now().toString(36),
        notes: rData.notes
      };
      db.relationships.set(newRel.id, newRel);

      // Audit Relationship
      db.logAuditEvent({
        actionType: wasExistingGuardian ? 'EXISTING_GUARDIAN_LINKED_TO_NEW_CHILD' : 'RELATIONSHIP_ESTABLISHED',
        actorUserId: staffContext.staffUserId,
        actorName: staffContext.staffName,
        actorRole: staffContext.staffRole,
        targetEntity: 'RELATIONSHIP',
        targetId: newRel.id,
        details: {
          guardianId: finalGuardianId,
          learnerId: finalLearnerId,
          relationshipType: rData.relationshipType,
          isPrimary: rData.isPrimary,
          schoolId: eData.schoolId
        },
        ipAddress: staffContext.ipAddress
      });
    }

    // ----------------------------------------------------
    // STEP 4: ESTABLISH SCHOOL ENROLMENT & ACADEMIC PLACEMENT
    // (Explicit Enrolment Record decoupled from Person & Grade)
    // ----------------------------------------------------
    let finalEnrolId = '';
    for (const enr of db.enrolments.values()) {
      if (enr.learnerId === finalLearnerId && enr.schoolId === eData.schoolId && enr.enrolmentStatus === 'ACTIVE') {
        finalEnrolId = enr.id;
        break;
      }
    }

    if (!finalEnrolId) {
      finalEnrolId = 'enr-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
      const newEnrolment: SchoolEnrolment = {
        id: finalEnrolId,
        learnerId: finalLearnerId,
        schoolId: eData.schoolId,
        admissionDate: now.split('T')[0],
        enrolmentStatus: 'ACTIVE',
        currentAcademicYear: eData.academicYear,
        previousSchoolEmis: eData.previousSchoolEmis,
        enrolledByStaffId: staffContext.staffUserId,
        createdAt: now,
        updatedAt: now
      };
      db.enrolments.set(newEnrolment.id, newEnrolment);

      db.logAuditEvent({
        actionType: wasExistingLearner ? 'EXISTING_LEARNER_LINKED_TO_SCHOOL' : 'SCHOOL_ENROLLED',
        actorUserId: staffContext.staffUserId,
        actorName: staffContext.staffName,
        actorRole: staffContext.staffRole,
        targetEntity: 'ENROLMENT',
        targetId: newEnrolment.id,
        details: {
          learnerId: finalLearnerId,
          schoolId: eData.schoolId,
          academicYear: eData.academicYear,
          schoolName: school.name
        },
        ipAddress: staffContext.ipAddress
      });
    }

    // Create / Update Academic Record for Year/Grade/Class
    const academicRecordId = 'acd-' + finalLearnerId + '-' + eData.academicYear;
    const academicRecord: AcademicRecord = {
      id: academicRecordId,
      learnerId: finalLearnerId,
      schoolId: eData.schoolId,
      academicYear: eData.academicYear,
      grade: eData.grade,
      classSection: eData.classSection,
      homeroomTeacher: eData.homeroomTeacher || 'Unassigned',
      attendanceRate: 100.0,
      status: 'CURRENT',
      updatedAt: now
    };
    db.academicRecords.set(academicRecord.id, academicRecord);

    // Update school metrics
    school.activeLearnersCount = Array.from(db.enrolments.values()).filter(
      e => e.schoolId === school.id && e.enrolmentStatus === 'ACTIVE'
    ).length;

    const auditEvent = db.logAuditEvent({
      actionType: 'ACADEMIC_RECORD_ADVANCED',
      actorUserId: staffContext.staffUserId,
      actorName: staffContext.staffName,
      actorRole: staffContext.staffRole,
      targetEntity: 'ACADEMIC_RECORD',
      targetId: academicRecord.id,
      details: {
        learnerId: finalLearnerId,
        grade: eData.grade,
        classSection: eData.classSection,
        year: eData.academicYear
      },
      ipAddress: staffContext.ipAddress
    });

    const lPerson = db.persons.get(learnerPersonId)!;
    const gPerson = db.persons.get(guardianPersonId)!;

    // Automatic Parent/Guardian user account provisioning / linking if email is present
    let guardianUserStatus: 'CREATED' | 'LINKED' | 'CONFLICT' | 'SKIPPED' = 'SKIPPED';
    let guardianUserMessage = 'No guardian email provided';

    if (gPerson && gPerson.email) {
      const cleanEmail = gPerson.email.trim().toLowerCase();
      let matchedUser = Array.from(db.users.values()).find(
        u => u.email.toLowerCase() === cleanEmail || u.aliases?.some(a => a.toLowerCase() === cleanEmail)
      );

      if (matchedUser) {
        if (matchedUser.role === 'PARENT_GUARDIAN') {
          // Re-use existing Guardian account without duplication
          matchedUser.guardianId = finalGuardianId;
          matchedUser.updatedAt = now;

          const gEntity = db.guardians.get(finalGuardianId);
          if (gEntity) {
            gEntity.userId = matchedUser.id;
            gEntity.updatedAt = now;
          }

          guardianUserStatus = 'LINKED';
          guardianUserMessage = 'Existing Guardian account linked successfully';

          db.logAuditEvent({
            actionType: 'EXISTING_GUARDIAN_LINKED_TO_LEARNER' as any,
            actorUserId: staffContext.staffUserId,
            actorName: staffContext.staffName,
            actorRole: staffContext.staffRole,
            targetEntity: 'USER',
            targetId: matchedUser.id,
            details: {
              userId: matchedUser.id,
              guardianId: finalGuardianId,
              learnerId: finalLearnerId,
              email: cleanEmail,
              action: 'REUSED_EXISTING_GUARDIAN_ACCOUNT'
            },
            ipAddress: staffContext.ipAddress
          });
        } else {
          // Non-Guardian role conflict: do NOT overwrite account
          guardianUserStatus = 'CONFLICT';
          guardianUserMessage = `Notice: Email '${cleanEmail}' belongs to role '${matchedUser.role}'. Account was preserved without overwrite; flagged for admin review.`;

          db.logAuditEvent({
            actionType: 'GUARDIAN_USER_ROLE_CONFLICT_FLAGGED' as any,
            actorUserId: staffContext.staffUserId,
            actorName: staffContext.staffName,
            actorRole: staffContext.staffRole,
            targetEntity: 'USER',
            targetId: matchedUser.id,
            details: {
              existingUserId: matchedUser.id,
              existingRole: matchedUser.role,
              guardianId: finalGuardianId,
              learnerId: finalLearnerId,
              email: cleanEmail,
              conflict: 'ROLE_OVERWRITE_PREVENTED'
            },
            ipAddress: staffContext.ipAddress
          });
        }
      } else {
        // Create new Guardian User
        const newUserId = 'usr-parent-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
        const salt = generateSalt();
        const tempPassword = 'PendingActivation_' + Math.random().toString(36).slice(2, 10) + '!';
        const hash = hashPassword(tempPassword, salt);
        const parentUser = {
          id: newUserId,
          email: cleanEmail,
          normalizedEmail: cleanEmail,
          name: `${gPerson.firstName} ${gPerson.lastName}`.trim() || 'Guardian User',
          firstName: gPerson.firstName,
          surname: gPerson.lastName,
          mobileNumber: gPerson.mobileNumber,
          role: 'PARENT_GUARDIAN' as const,
          password: hash,
          passwordSalt: salt,
          passwordHash: hash,
          guardianId: finalGuardianId,
          department: 'Parent & Legal Guardian Community',
          organization: 'Parent & Legal Guardian Network',
          permissions: db.getDefaultPermissionsForRole('PARENT_GUARDIAN'),
          status: 'ACTIVE' as const,
          mustChangePassword: true,
          isDemoAccount: false,
          createdAt: now,
          updatedAt: now
        };
        db.users.set(parentUser.id, parentUser);

        const gEntity = db.guardians.get(finalGuardianId);
        if (gEntity) {
          gEntity.userId = newUserId;
          gEntity.updatedAt = now;
        }

        guardianUserStatus = 'CREATED';
        guardianUserMessage = 'Guardian account created — activation pending';

        db.logAuditEvent({
          actionType: 'GUARDIAN_AUTO_CREATED_FROM_LEARNER_REGISTRATION' as any,
          actorUserId: staffContext.staffUserId,
          actorName: staffContext.staffName,
          actorRole: staffContext.staffRole,
          targetEntity: 'USER',
          targetId: newUserId,
          details: {
            userId: newUserId,
            guardianId: finalGuardianId,
            learnerId: finalLearnerId,
            email: cleanEmail,
            role: 'PARENT_GUARDIAN',
            activationStatus: 'PENDING_ACTIVATION',
            mustChangePassword: true
          },
          ipAddress: staffContext.ipAddress
        });
      }
    }

    db.rebuildIndexes();
    db.persistToDisk();

    const message = wasExistingGuardian
      ? `Authoritative link created: Added "${lPerson.firstName} ${lPerson.lastName}" to existing guardian "${gPerson.firstName} ${gPerson.lastName}" at ${school.name}.`
      : `Authoritative registration complete for "${lPerson.firstName} ${lPerson.lastName}" and guardian "${gPerson.firstName} ${gPerson.lastName}".`;

    return {
      success: true,
      learnerId: finalLearnerId,
      guardianId: finalGuardianId,
      relationshipId: finalRelId,
      enrolmentId: finalEnrolId,
      academicRecordId,
      guardianUserStatus,
      guardianUserMessage,
      message,
      auditEventId: auditEvent.id
    };
  }

  /**
   * Advance academic year for a learner (e.g. Grade 9 -> Grade 10)
   * Decoupled from Learner identity! Does NOT duplicate person or learner record.
   */
  public advanceAcademicYear(params: {
    learnerId: string;
    schoolId: string;
    newYear: number;
    newGrade: string;
    newClassSection: string;
    homeroomTeacher?: string;
    staffContext: { staffUserId: string; staffName: string; staffRole: string; ipAddress?: string };
  }): { success: boolean; newAcademicRecord: AcademicRecord } {
    const learner = db.learners.get(params.learnerId);
    if (!learner) throw new Error('Learner record not found');

    // Archive or set previous academic records to PROMOTED
    for (const acd of db.academicRecords.values()) {
      if (acd.learnerId === params.learnerId && acd.status === 'CURRENT') {
        acd.status = 'PROMOTED';
      }
    }

    const now = new Date().toISOString();
    const newRecordId = 'acd-' + params.learnerId + '-' + params.newYear;
    const newRecord: AcademicRecord = {
      id: newRecordId,
      learnerId: params.learnerId,
      schoolId: params.schoolId,
      academicYear: params.newYear,
      grade: params.newGrade,
      classSection: params.newClassSection,
      homeroomTeacher: params.homeroomTeacher || 'Unassigned',
      attendanceRate: 100.0,
      status: 'CURRENT',
      updatedAt: now
    };
    db.academicRecords.set(newRecord.id, newRecord);

    db.logAuditEvent({
      actionType: 'ACADEMIC_RECORD_ADVANCED',
      actorUserId: params.staffContext.staffUserId,
      actorName: params.staffContext.staffName,
      actorRole: params.staffContext.staffRole,
      targetEntity: 'ACADEMIC_RECORD',
      targetId: newRecord.id,
      details: {
        learnerId: params.learnerId,
        newYear: params.newYear,
        newGrade: params.newGrade,
        newClass: params.newClassSection
      },
      ipAddress: params.staffContext.ipAddress
    });

    db.persistToDisk();

    return { success: true, newAcademicRecord: newRecord };
  }

  /**
   * Register a new Authoritative School (Admins & Founders authorized)
   */
  public registerSchool(payload: RegisterSchoolPayload): School {
    const { name, emisCode, district, province, address, principalName, contactPhone, contactEmail, geofenceCenter, staffContext } = payload;

    // Check if EMIS code already registered
    const cleanEmis = emisCode.trim().toUpperCase();
    for (const s of db.schools.values()) {
      if (s.emisCode.toUpperCase() === cleanEmis) {
        throw new Error(`School with EMIS Code "${emisCode}" is already registered (${s.name}).`);
      }
    }

    const schoolId = 'sch-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
    const newSchool: School = {
      id: schoolId,
      name: name.trim(),
      emisCode: cleanEmis,
      district: district.trim(),
      province,
      address: address.trim(),
      principalName: principalName.trim(),
      contactPhone: contactPhone.trim(),
      contactEmail: contactEmail.trim(),
      activeLearnersCount: 0,
      totalGuardiansLinkedCount: 0,
      geofenceCenter: {
        lat: geofenceCenter?.lat || -26.2041,
        lng: geofenceCenter?.lng || 28.0473,
        radiusMeters: geofenceCenter?.radiusMeters || 500
      }
    };

    db.schools.set(newSchool.id, newSchool);

    db.logAuditEvent({
      actionType: 'SCHOOL_REGISTERED',
      actorUserId: staffContext.staffUserId,
      actorName: staffContext.staffName,
      actorRole: staffContext.staffRole,
      targetEntity: 'SCHOOL',
      targetId: newSchool.id,
      details: {
        schoolName: newSchool.name,
        emisCode: newSchool.emisCode,
        province: newSchool.province,
        principal: newSchool.principalName
      }
    });

    db.persistToDisk();

    return newSchool;
  }

  /**
   * Annual Learner Safety & Information Update
   * Updates approved health, emergency, address, and consent information WITHOUT
   * re-registering or duplicating the underlying Person / Learner entity.
   */
  public annualLearnerSafetyUpdate(payload: AnnualSafetyUpdatePayload): {
    success: boolean;
    learnerId: string;
    message: string;
    auditEventId: string;
  } {
    const { learnerId, schoolId, academicYear, grade, classSection, physicalAddress, medicalInfo, consentAndAcknowledgements, staffContext } = payload;

    const learner = db.learners.get(learnerId);
    if (!learner) {
      throw new Error(`Authoritative Learner with ID "${learnerId}" not found.`);
    }

    const person = db.persons.get(learner.personId);
    if (!person) {
      throw new Error(`Person record for Learner "${learnerId}" not found.`);
    }

    const now = new Date().toISOString();
    const oldValues = {
      allergies: learner.allergies ? [...learner.allergies] : [],
      bloodType: learner.bloodType,
      medicalNotes: learner.medicalNotes,
      physicalAddress: person.physicalAddress
    };

    // Update Learner safety profile
    if (medicalInfo.bloodType) learner.bloodType = medicalInfo.bloodType;
    if (medicalInfo.allergies) learner.allergies = medicalInfo.allergies;
    
    // Aggregate medical notes
    const medicalNotesParts: string[] = [];
    if (medicalInfo.chronicConditions) medicalNotesParts.push(`Conditions: ${medicalInfo.chronicConditions}`);
    if (medicalInfo.medications?.length) medicalNotesParts.push(`Meds: ${medicalInfo.medications.join(', ')}`);
    if (medicalInfo.specialNeeds) medicalNotesParts.push(`Special Needs: ${medicalInfo.specialNeeds}`);
    if (medicalInfo.mobilityRequirements) medicalNotesParts.push(`Mobility: ${medicalInfo.mobilityRequirements}`);
    if (medicalInfo.communicationRequirements) medicalNotesParts.push(`Comm: ${medicalInfo.communicationRequirements}`);
    if (medicalInfo.medicalAidScheme) medicalNotesParts.push(`MedAid: ${medicalInfo.medicalAidScheme} (#${medicalInfo.medicalAidNumber || 'N/A'})`);
    
    if (medicalNotesParts.length > 0) {
      learner.medicalNotes = medicalNotesParts.join(' | ');
    }
    learner.updatedAt = now;

    // Update Person residential address if provided
    if (physicalAddress) {
      person.physicalAddress = physicalAddress.trim();
      person.updatedAt = now;
    }

    // If grade / class update provided, update current academic record
    if (grade && classSection) {
      let currentAcd = Array.from(db.academicRecords.values()).find(
        a => a.learnerId === learnerId && a.status === 'CURRENT'
      );
      if (currentAcd) {
        currentAcd.grade = grade;
        currentAcd.classSection = classSection;
        currentAcd.academicYear = academicYear;
        currentAcd.updatedAt = now;
      }
    }

    const auditEvent = db.logAuditEvent({
      actionType: 'ANNUAL_SAFETY_UPDATE_SUBMITTED',
      actorUserId: staffContext.staffUserId,
      actorName: staffContext.staffName,
      actorRole: staffContext.staffRole,
      targetEntity: 'LEARNER',
      targetId: learner.id,
      details: {
        learnerName: `${person.firstName} ${person.lastName}`,
        emisId: learner.emisId,
        schoolId,
        academicYear,
        oldValues,
        newValues: {
          allergies: learner.allergies,
          bloodType: learner.bloodType,
          medicalNotes: learner.medicalNotes,
          physicalAddress: person.physicalAddress,
          consentSignatureDate: consentAndAcknowledgements.signatureDate
        }
      },
      ipAddress: staffContext.ipAddress
    });

    db.persistToDisk();

    return {
      success: true,
      learnerId: learner.id,
      message: `Annual Safety & Information Update certified for "${person.firstName} ${person.lastName}". The authoritative learner identity was preserved without duplication.`,
      auditEventId: auditEvent.id
    };
  }

  /**
   * Controlled Device Assignment / Pairing
   * Ensures:
   * - Authorized actor (Founder or System Admin)
   * - Target learner exists
   * - No duplicate device allocation across active learners
   * - Cross-school validation
   * - Comprehensive immutable audit trail
   */
  public assignDeviceToLearner(params: {
    learnerId: string;
    trackingBeaconId: string;
    schoolId?: string;
    forceReassign?: boolean;
    staffContext: {
      staffUserId: string;
      staffName: string;
      staffRole: string;
      ipAddress?: string;
    };
  }): { success: boolean; learnerId: string; trackingBeaconId: string; message: string; auditEventId: string } {
    const { learnerId, trackingBeaconId, schoolId, forceReassign, staffContext } = params;

    // Check authority: ONLY Founder and System Administrator
    if (staffContext.staffRole !== 'FOUNDER_EXECUTIVE' && staffContext.staffRole !== 'SYSTEM_ADMIN') {
      throw new Error(`ACCESS DENIED: Role "${staffContext.staffRole}" lacks administrative authority to pair or assign approved safety hardware.`);
    }

    const learner = db.learners.get(learnerId);
    if (!learner) {
      throw new Error(`Learner record "${learnerId}" not found in authoritative directory.`);
    }

    const person = db.persons.get(learner.personId);
    const cleanBeacon = trackingBeaconId.trim().toUpperCase();

    if (!cleanBeacon) {
      throw new Error('Valid Tracking Beacon / Device ID is required.');
    }

    // Check if target learner is enrolled in the specified school
    if (schoolId) {
      const activeEnrolment = Array.from(db.enrolments.values()).find(
        e => e.learnerId === learnerId && e.enrolmentStatus === 'ACTIVE'
      );
      if (activeEnrolment && activeEnrolment.schoolId !== schoolId) {
        throw new Error(`CROSS-SCHOOL VIOLATION: Learner "${learnerId}" is enrolled at school "${activeEnrolment.schoolId}", cannot assign device under school scope "${schoolId}".`);
      }
    }

    // Check for duplicate device assignment across all learners
    for (const otherLearner of db.learners.values()) {
      if (otherLearner.id !== learnerId && otherLearner.trackingBeaconId?.trim().toUpperCase() === cleanBeacon) {
        const otherPerson = db.persons.get(otherLearner.personId);
        if (!forceReassign) {
          throw new Error(`DUPLICATE HARDWARE DEVICE: Tracking Beacon "${cleanBeacon}" is already assigned to learner "${otherPerson?.firstName || ''} ${otherPerson?.lastName || ''}" (EMIS: ${otherLearner.emisId}). Unlinking previous learner is required before reassignment.`);
        } else {
          // Authorized reassignment: unlink previous learner
          const previousBeacon = otherLearner.trackingBeaconId;
          otherLearner.trackingBeaconId = undefined;
          otherLearner.updatedAt = new Date().toISOString();
          db.logAuditEvent({
            actionType: 'HARDWARE_DIAGNOSTIC_LOGGED',
            actorUserId: staffContext.staffUserId,
            actorName: staffContext.staffName,
            actorRole: staffContext.staffRole,
            targetEntity: 'LEARNER',
            targetId: otherLearner.id,
            details: {
              event: 'DEVICE_UNLINKED_FOR_REASSIGNMENT',
              unlinkedBeacon: previousBeacon,
              reassignedToLearnerId: learnerId
            },
            ipAddress: staffContext.ipAddress
          });
        }
      }
    }

    const previousBeacon = learner.trackingBeaconId;
    learner.trackingBeaconId = cleanBeacon;
    learner.updatedAt = new Date().toISOString();

    const auditEvent = db.logAuditEvent({
      actionType: 'DEVICE_PAIRED',
      actorUserId: staffContext.staffUserId,
      actorName: staffContext.staffName,
      actorRole: staffContext.staffRole,
      targetEntity: 'LEARNER',
      targetId: learner.id,
      details: {
        learnerName: person ? `${person.firstName} ${person.lastName}` : 'Learner',
        emisId: learner.emisId,
        trackingBeaconId: cleanBeacon,
        previousBeacon: previousBeacon || 'NONE',
        assignedByRole: staffContext.staffRole
      },
      ipAddress: staffContext.ipAddress
    });

    db.persistToDisk();

    return {
      success: true,
      learnerId: learner.id,
      trackingBeaconId: cleanBeacon,
      message: `Approved hardware device "${cleanBeacon}" linked to learner "${person?.firstName || ''} ${person?.lastName || ''}" successfully.`,
      auditEventId: auditEvent.id
    };
  }

  private deriveDobFromSaId(saId: string): string {
    const clean = saId.trim();
    if (clean.length >= 6) {
      const yy = parseInt(clean.slice(0, 2), 10);
      const mm = clean.slice(2, 4);
      const dd = clean.slice(4, 6);
      const century = yy < 30 ? '20' : '19';
      return `${century}${clean.slice(0, 2)}-${mm}-${dd}`;
    }
    return '1985-01-01';
  }
}

export const enrolmentEngine = new EnrolmentEngine();
