import {
  AuthoritativeOnboardPayload,
  AnnualSafetyUpdatePayload,
  RegisterSchoolPayload,
  IdentitySearchResult,
  HydratedLearnerRecord,
  School,
  Guardian,
  IncidentAlert,
  ImmutableAuditEvent,
  ActiveUserSession,
  UserRole,
  AssignedIncidentView,
  EligibleResponderRanking,
  ResponderUnit,
  ResponderOperationalState,
  IncidentOutcomeReport,
  PlatformUserItem,
  CreateUserPayload,
  AccountStatus
} from '../types.js';

const API_BASE = '/api';

const TOKEN_KEY = 'itis_auth_session_token';

async function safeFetchJson<T>(res: Response, fallbackError: string): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.toLowerCase().includes('application/json');

  if (!res.ok) {
    if (isJson) {
      try {
        const errorData = await res.json();
        throw new Error(errorData.error || errorData.message || fallbackError);
      } catch (err: any) {
        if (err.message && err.message !== fallbackError && !err.message.includes('JSON')) {
          throw err;
        }
      }
    }

    if (res.status === 404) {
      throw new Error('Authentication service endpoint not found (HTTP 404). Please verify backend server routing.');
    } else if (res.status === 401) {
      throw new Error('Invalid registered credentials. Access Denied.');
    } else if (res.status === 403) {
      throw new Error('Access Denied. Insufficient clearance or permission.');
    } else if (res.status >= 500) {
      throw new Error(`Server error encountered (HTTP ${res.status}). Please try again shortly.`);
    } else {
      throw new Error(`${fallbackError} (HTTP ${res.status})`);
    }
  }

  if (!isJson) {
    throw new Error(`Invalid server response format (expected application/json, received ${contentType || 'non-JSON'}).`);
  }

  return res.json();
}

export const api = {
  // Token helper
  getToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  setToken(token: string) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {}
  },

  clearToken() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {}
  },

  getAuthHeaders(): Record<string, string> {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },

  // Server-Authoritative Identity & RBAC Authentication
  async login(credentials: { email: string; password: string }): Promise<{
    user: ActiveUserSession;
    token: string;
    permissions: string[];
    scope: { schoolId?: string; guardianId?: string; responderUnit?: string; department?: string };
  }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });

    const data = await safeFetchJson<{
      user: ActiveUserSession;
      token: string;
      permissions: string[];
      scope: { schoolId?: string; guardianId?: string; responderUnit?: string; department?: string };
    }>(res, 'Authentication failed');

    if (data.token) {
      this.setToken(data.token);
    }
    return data;
  },

  async getSession(): Promise<{ user: ActiveUserSession; permissions: string[] } | null> {
    const token = this.getToken();
    if (!token) return null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(`${API_BASE}/auth/session`, {
        headers: this.getAuthHeaders(),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        if (res.status === 401) {
          this.clearToken();
        }
        return null;
      }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.toLowerCase().includes('application/json')) {
        return null;
      }

      return res.json();
    } catch {
      return null;
    }
  },

  async logout(): Promise<void> {
    const token = this.getToken();
    try {
      if (token) {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this.getAuthHeaders()
          },
          body: JSON.stringify({ token })
        });
      }
    } catch (err) {
      console.warn('Logout notification error:', err);
    } finally {
      this.clearToken();
    }
  },

  // Health
  async getHealth() {
    try {
      const res = await fetch(`${API_BASE}/health`);
      return safeFetchJson(res, 'Health check failed');
    } catch {
      return { status: 'unavailable' };
    }
  },

  // Authoritative Identity Search & Duplicate Detection
  async searchIdentity(params: {
    saIdNumber?: string;
    mobileNumber?: string;
    emisId?: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
  }): Promise<IdentitySearchResult> {
    const res = await fetch(`${API_BASE}/enrolment/search-identity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    return safeFetchJson<IdentitySearchResult>(res, 'Identity search failed');
  },

  // Authoritative Controlled Onboarding (Single Atomic Transaction)
  async authoritativeOnboard(payload: AuthoritativeOnboardPayload) {
    const res = await fetch(`${API_BASE}/enrolment/authoritative-onboard`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
      body: JSON.stringify(payload)
    });
    return safeFetchJson(res, 'Onboarding transaction failed');
  },

  // Live Enrolment & Duplicate Prevention Validation Test Runner
  async runEnrolmentValidationSuite(): Promise<any> {
    const res = await fetch(`${API_BASE}/enrolment/run-validation-suite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      }
    });
    return safeFetchJson(res, 'Enrolment validation test execution failed');
  },

  // Advance Grade / Academic Record (Decoupled from Learner Entity)
  async advanceGrade(params: {
    learnerId: string;
    schoolId: string;
    newYear: number;
    newGrade: string;
    newClassSection: string;
    homeroomTeacher?: string;
    staffContext?: { staffUserId: string; staffName: string; staffRole: string };
  }) {
    const res = await fetch(`${API_BASE}/enrolment/advance-grade`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
      body: JSON.stringify(params)
    });
    return safeFetchJson(res, 'Grade advancement failed');
  },

  // Annual Learner Safety & Information Update (Never duplicates Person/Learner ID)
  async annualLearnerSafetyUpdate(payload: AnnualSafetyUpdatePayload) {
    const res = await fetch(`${API_BASE}/enrolment/annual-safety-update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
      body: JSON.stringify(payload)
    });
    return safeFetchJson(res, 'Annual safety update failed');
  },

  // Authoritative School Registration (Admins & Founders)
  async registerSchool(payload: RegisterSchoolPayload): Promise<School> {
    const res = await fetch(`${API_BASE}/schools`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
      body: JSON.stringify(payload)
    });
    return safeFetchJson<School>(res, 'School registration failed');
  },

  // Learners
  async getLearners(params?: { schoolId?: string; guardianId?: string; search?: string }): Promise<HydratedLearnerRecord[]> {
    try {
      const query = new URLSearchParams();
      if (params?.schoolId) query.set('schoolId', params.schoolId);
      if (params?.guardianId) query.set('guardianId', params.guardianId);
      if (params?.search) query.set('search', params.search);
      const res = await fetch(`${API_BASE}/learners?${query.toString()}`, {
        headers: this.getAuthHeaders()
      });
      if (!res.ok) return [];
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.toLowerCase().includes('application/json')) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  async getLearnerById(id: string): Promise<HydratedLearnerRecord> {
    const res = await fetch(`${API_BASE}/learners/${id}`, {
      headers: this.getAuthHeaders()
    });
    return safeFetchJson<HydratedLearnerRecord>(res, 'Learner not found or unauthorized');
  },

  // Schools
  async getSchools(): Promise<School[]> {
    try {
      const res = await fetch(`${API_BASE}/schools`, {
        headers: this.getAuthHeaders()
      });
      if (!res.ok) return [];
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.toLowerCase().includes('application/json')) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  // Guardians
  async getGuardians(): Promise<Array<{ guardian: Guardian; person: any; linkedChildren: any[] }>> {
    try {
      const res = await fetch(`${API_BASE}/guardians`, {
        headers: this.getAuthHeaders()
      });
      if (!res.ok) return [];
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.toLowerCase().includes('application/json')) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  // Incidents & Panic
  async getIncidents(): Promise<IncidentAlert[]> {
    try {
      const res = await fetch(`${API_BASE}/incidents`, {
        headers: this.getAuthHeaders()
      });
      if (!res.ok) return [];
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.toLowerCase().includes('application/json')) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  async triggerPanic(params: {
    learnerId: string;
    triggerType?: string;
    customNotes?: string;
    location?: { lat: number; lng: number; addressDescription: string; accuracyMeters: number };
  }): Promise<IncidentAlert> {
    const res = await fetch(`${API_BASE}/incidents/panic-trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
      body: JSON.stringify(params)
    });
    return safeFetchJson<IncidentAlert>(res, 'Panic trigger failed');
  },

  async dispatchResponder(params: {
    incidentId: string;
    responderId?: string;
    responderName?: string;
    unitType?: string;
    vehicleId?: string;
    etaMinutes?: number;
    note?: string;
    isHumanDispatch?: boolean;
  }): Promise<IncidentAlert> {
    const res = await fetch(`${API_BASE}/incidents/dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
      body: JSON.stringify(params)
    });
    return safeFetchJson<IncidentAlert>(res, 'Tactical dispatch failed');
  },

  async updateIncidentStatus(id: string, status: string, note?: string): Promise<IncidentAlert> {
    const res = await fetch(`${API_BASE}/incidents/${id}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
      body: JSON.stringify({ status, note })
    });
    return safeFetchJson<IncidentAlert>(res, 'Status update failed');
  },

  // RBAC & Security Matrix
  async getRbacMatrix(): Promise<{ matrix: any; version?: string }> {
    const res = await fetch(`${API_BASE}/rbac/matrix`, {
      headers: this.getAuthHeaders()
    });
    return safeFetchJson<{ matrix: any; version?: string }>(res, 'Failed to retrieve RBAC matrix');
  },

  async getMyClearance(): Promise<any> {
    const res = await fetch(`${API_BASE}/rbac/my-clearance`, {
      headers: this.getAuthHeaders()
    });
    return safeFetchJson<any>(res, 'Failed to fetch user clearance');
  },

  async runSecuritySuite(): Promise<any> {
    const res = await fetch(`${API_BASE}/rbac/run-security-suite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      }
    });
    return safeFetchJson<any>(res, 'Failed to run security test suite');
  },

  // Platform User Governance (Founder Only)
  async getUsers(): Promise<PlatformUserItem[]> {
    try {
      const res = await fetch(`${API_BASE}/users`, {
        headers: this.getAuthHeaders()
      });
      if (!res.ok) return [];
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.toLowerCase().includes('application/json')) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  async createUser(payload: CreateUserPayload): Promise<PlatformUserItem> {
    const res = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
      body: JSON.stringify(payload)
    });
    return safeFetchJson<PlatformUserItem>(res, 'User creation failed');
  },

  async updateUserStatus(userId: string, status: AccountStatus): Promise<{ success: boolean; user: PlatformUserItem }> {
    const res = await fetch(`${API_BASE}/users/${userId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
      body: JSON.stringify({ status })
    });
    return safeFetchJson<{ success: boolean; user: PlatformUserItem }>(res, 'Status update failed');
  },

  async deactivateUser(userId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/users/${userId}/deactivate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      }
    });
    return safeFetchJson<any>(res, 'User deactivation failed');
  },

  // Audit Logs
  async getAuditLogs(): Promise<ImmutableAuditEvent[]> {
    try {
      const res = await fetch(`${API_BASE}/audit-logs`, {
        headers: this.getAuthHeaders()
      });
      if (!res.ok) return [];
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.toLowerCase().includes('application/json')) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  // ----------------------------------------------------
  // PHASE RESPONDER-04: "UBER FOR EMERGENCY RESPONSE"
  // ----------------------------------------------------
  async getAssignedIncident(): Promise<AssignedIncidentView | null> {
    try {
      const res = await fetch(`${API_BASE}/responder/assigned-incident`, {
        headers: this.getAuthHeaders()
      });
      if (!res.ok) return null;
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.toLowerCase().includes('application/json')) return null;
      const data = await res.json();
      return data.assignment || null;
    } catch {
      return null;
    }
  },

  async getEligibleRespondersRanking(incidentId: string): Promise<EligibleResponderRanking[]> {
    try {
      const res = await fetch(`${API_BASE}/responder/eligible-ranking/${incidentId}`, {
        headers: this.getAuthHeaders()
      });
      if (!res.ok) return [];
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.toLowerCase().includes('application/json')) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  async getResponderUnits(): Promise<ResponderUnit[]> {
    try {
      const res = await fetch(`${API_BASE}/responder/units`, {
        headers: this.getAuthHeaders()
      });
      if (!res.ok) return [];
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.toLowerCase().includes('application/json')) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  async acceptAssignment(incidentId: string): Promise<{ success: boolean; assignment: AssignedIncidentView }> {
    const res = await fetch(`${API_BASE}/responder/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
      body: JSON.stringify({ incidentId })
    });
    return safeFetchJson<{ success: boolean; assignment: AssignedIncidentView }>(res, 'Failed to accept assignment');
  },

  async declineAssignment(incidentId: string, reason: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/responder/decline`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
      body: JSON.stringify({ incidentId, reason })
    });
    return safeFetchJson<{ success: boolean; message: string }>(res, 'Failed to decline assignment');
  },

  async updateResponderStatus(
    incidentId: string,
    operationalState: ResponderOperationalState,
    note?: string,
    telemetry?: { lat: number; lng: number }
  ): Promise<{ success: boolean; assignment: AssignedIncidentView }> {
    const res = await fetch(`${API_BASE}/responder/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
      body: JSON.stringify({ incidentId, operationalState, note, telemetry })
    });
    return safeFetchJson<{ success: boolean; assignment: AssignedIncidentView }>(res, 'Failed to update tactical status');
  },

  async submitOutcomeReport(report: IncidentOutcomeReport): Promise<{ success: boolean; incident: IncidentAlert }> {
    const res = await fetch(`${API_BASE}/responder/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
      body: JSON.stringify(report)
    });
    return safeFetchJson<{ success: boolean; incident: IncidentAlert }>(res, 'Failed to submit incident outcome report');
  },

  async updateFounderPassword(payload: { newPassword: string; confirmPassword: string }): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/founder/update-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
      body: JSON.stringify(payload)
    });
    return safeFetchJson<{ success: boolean; message: string }>(res, 'Failed to update Founder password');
  }
};
