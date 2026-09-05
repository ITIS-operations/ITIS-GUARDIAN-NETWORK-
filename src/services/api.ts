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
  UpdateUserPayload,
  RegisterUserPayload,
  AccountStatus,
  PaginatedResponse,
  LearnerQueryOptions,
  SchoolQueryOptions,
  IncidentQueryOptions,
  AuditLogQueryOptions,
  DeviceRecord,
  DeviceGatewayRecord,
  DeviceMaintenanceRecord,
  TechnicianValidationResult,
  ExecutiveOverviewData,
  FounderValidationResult,
  TelemetrySimulationRequest,
  TelemetrySimulationResult,
  TelemetrySimulatorTestSuiteResult,
  TelemetryGatewayStatus,
  TelemetryGatewayTestSuiteResult,
  TelemetryPersistenceTestSuiteResult,
  MapDeviceLatestLocation,
  MapLearnerCurrentLocation,
  MapLocationHistoryResponse,
  IncidentTacticalLocationContext,
  DeviceHealthStatus,
  MapPollUpdateResponse,
  LiveLocationTestSuiteResult
} from '../types.js';

const API_BASE = '/api';

const TOKEN_KEY = 'itis_auth_session_token';

// Client-side Reference Cache with TTL
let cachedSchools: { data: School[]; timestamp: number } | null = null;
const SCHOOLS_CACHE_TTL_MS = 60 * 1000; // 1 minute

// In-memory token fallback if storage is restricted
let inMemoryToken: string | null = null;

async function safeFetchJson<T>(res: Response, fallbackError: string): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.toLowerCase().includes('application/json');

  if (!isJson) {
    if (res.status === 404) {
      throw new Error('API service endpoint not found (HTTP 404). Please verify server routing.');
    } else if (res.status === 401) {
      throw new Error('Your session has expired or authentication is no longer valid. Please sign in again.');
    } else if (res.status === 403) {
      throw new Error('You do not have permission to perform this action (HTTP 403).');
    } else if (res.status === 409) {
      throw new Error('Identity or resource conflict detected (HTTP 409).');
    } else if (res.status >= 500) {
      throw new Error('The ITIS service is temporarily unavailable. Please try again.');
    }
    throw new Error('Server returned an unexpected response. Please check the API route.');
  }

  if (!res.ok) {
    try {
      const errorData = await res.json();
      const rawError = errorData.error || errorData.message || '';
      
      if (res.status === 401) {
        throw new Error('Your session has expired or authentication is no longer valid. Please sign in again.');
      }
      if (res.status === 403) {
        if (rawError.includes('ENROLMENT_MANAGE') || rawError.includes('Learner') || rawError.includes('clearance') || rawError.includes('permission')) {
          throw new Error('You do not have permission to create learner enrollments.');
        }
        throw new Error(rawError || 'You do not have permission to perform this action.');
      }
      if (res.status === 503) {
        throw new Error('The ITIS service is temporarily unavailable. Please try again.');
      }

      throw new Error(rawError || `${fallbackError} (HTTP ${res.status})`);
    } catch (err: any) {
      if (err.message && !err.message.includes('JSON')) {
        throw err;
      }
      if (res.status === 401) {
        throw new Error('Your session has expired or authentication is no longer valid. Please sign in again.');
      }
      if (res.status === 403) {
        throw new Error('You do not have permission to create learner enrollments.');
      }
      if (res.status === 503) {
        throw new Error('The ITIS service is temporarily unavailable. Please try again.');
      }
      throw new Error(`${fallbackError} (HTTP ${res.status})`);
    }
  }

  return res.json();
}

export const api = {
  // Token helper
  getToken(): string | null {
    try {
      const local = localStorage.getItem(TOKEN_KEY);
      if (local) {
        inMemoryToken = local;
        return local;
      }
      const session = sessionStorage.getItem(TOKEN_KEY);
      if (session) {
        inMemoryToken = session;
        return session;
      }
    } catch {}
    return inMemoryToken;
  },

  setToken(token: string) {
    inMemoryToken = token;
    try {
      localStorage.setItem(TOKEN_KEY, token);
      sessionStorage.setItem(TOKEN_KEY, token);
    } catch {}
  },

  clearToken() {
    inMemoryToken = null;
    try {
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {}
  },

  getAuthHeaders(tokenOverride?: string): Record<string, string> {
    const token = tokenOverride || this.getToken();
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

  // Authoritative Self-Registration for Users (Guardians, School Staff, Responders, etc.)
  async register(payload: RegisterUserPayload): Promise<{
    user: ActiveUserSession;
    token: string;
    permissions: string[];
    scope: { schoolId?: string; guardianId?: string; responderUnit?: string; department?: string };
  }> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await safeFetchJson<{
      user: ActiveUserSession;
      token: string;
      permissions: string[];
      scope: { schoolId?: string; guardianId?: string; responderUnit?: string; department?: string };
    }>(res, 'Registration failed');

    if (data.token) {
      this.setToken(data.token);
    }
    return data;
  },

  async changePassword(payload: { newPassword: string; confirmPassword: string }): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
      body: JSON.stringify(payload)
    });
    return safeFetchJson<{ success: boolean; message: string }>(res, 'Failed to update password');
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
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
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

  // Learners (Paginated & Filtered for 3,000,000+ Scale)
  async getPaginatedLearners(
    options?: LearnerQueryOptions,
    signal?: AbortSignal
  ): Promise<PaginatedResponse<HydratedLearnerRecord>> {
    const query = new URLSearchParams();
    query.set('paginated', 'true');
    if (options?.schoolId) query.set('schoolId', options.schoolId);
    if (options?.guardianId) query.set('guardianId', options.guardianId);
    if (options?.search) query.set('search', options.search);
    if (options?.grade) query.set('grade', options.grade);
    if (options?.page) query.set('page', String(options.page));
    if (options?.limit) query.set('limit', String(options.limit));
    if (options?.offset !== undefined) query.set('offset', String(options.offset));

    const res = await fetch(`${API_BASE}/learners?${query.toString()}`, {
      headers: this.getAuthHeaders(),
      signal
    });

    if (!res.ok) {
      return {
        data: [],
        pagination: { total: 0, limit: options?.limit || 25, offset: 0, page: options?.page || 1, totalPages: 0, hasMore: false }
      };
    }

    const json = await res.json();
    return json && json.data ? json : {
      data: Array.isArray(json) ? json : [],
      pagination: { total: (json?.length || 0), limit: options?.limit || 25, offset: 0, page: options?.page || 1, totalPages: 1, hasMore: false }
    };
  },

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
      return Array.isArray(data) ? data : data?.data || [];
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

  // Schools (with caching for rapid responses)
  async getSchools(forceRefresh: boolean = false): Promise<School[]> {
    if (!forceRefresh && cachedSchools && Date.now() - cachedSchools.timestamp < SCHOOLS_CACHE_TTL_MS) {
      return cachedSchools.data;
    }

    try {
      const res = await fetch(`${API_BASE}/schools`, {
        headers: this.getAuthHeaders()
      });
      if (!res.ok) return cachedSchools?.data || [];
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.toLowerCase().includes('application/json')) return cachedSchools?.data || [];
      const data = await res.json();
      const list = Array.isArray(data) ? data : data?.data || [];
      cachedSchools = { data: list, timestamp: Date.now() };
      return list;
    } catch {
      return cachedSchools?.data || [];
    }
  },

  async getPaginatedSchools(options?: SchoolQueryOptions, signal?: AbortSignal): Promise<PaginatedResponse<School>> {
    const query = new URLSearchParams();
    query.set('paginated', 'true');
    if (options?.search) query.set('search', options.search);
    if (options?.province) query.set('province', options.province);
    if (options?.district) query.set('district', options.district);
    if (options?.page) query.set('page', String(options.page));
    if (options?.limit) query.set('limit', String(options.limit));

    const res = await fetch(`${API_BASE}/schools?${query.toString()}`, {
      headers: this.getAuthHeaders(),
      signal
    });

    if (!res.ok) {
      return {
        data: [],
        pagination: { total: 0, limit: options?.limit || 25, offset: 0, page: options?.page || 1, totalPages: 0, hasMore: false }
      };
    }
    return res.json();
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
  async getPaginatedIncidents(options?: IncidentQueryOptions, signal?: AbortSignal): Promise<PaginatedResponse<IncidentAlert>> {
    const query = new URLSearchParams();
    query.set('paginated', 'true');
    if (options?.activeOnly) query.set('activeOnly', 'true');
    if (options?.status) query.set('status', options.status);
    if (options?.severity) query.set('severity', options.severity);
    if (options?.schoolId) query.set('schoolId', options.schoolId);
    if (options?.page) query.set('page', String(options.page));
    if (options?.limit) query.set('limit', String(options.limit));

    const res = await fetch(`${API_BASE}/incidents?${query.toString()}`, {
      headers: this.getAuthHeaders(),
      signal
    });

    if (!res.ok) {
      return {
        data: [],
        pagination: { total: 0, limit: options?.limit || 25, offset: 0, page: options?.page || 1, totalPages: 0, hasMore: false }
      };
    }
    return res.json();
  },

  async getIncidentDeltaEvents(sinceTimestamp?: string): Promise<{ events: any[]; latestTimestamp: string }> {
    const query = new URLSearchParams();
    if (sinceTimestamp) query.set('since', sinceTimestamp);
    try {
      const res = await fetch(`${API_BASE}/incidents/events?${query.toString()}`, {
        headers: this.getAuthHeaders()
      });
      if (!res.ok) return { events: [], latestTimestamp: new Date().toISOString() };
      return res.json();
    } catch {
      return { events: [], latestTimestamp: new Date().toISOString() };
    }
  },

  async getIncidents(): Promise<IncidentAlert[]> {
    try {
      const res = await fetch(`${API_BASE}/incidents`, {
        headers: this.getAuthHeaders()
      });
      if (!res.ok) return [];
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.toLowerCase().includes('application/json')) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : data?.data || [];
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

  // Multi-Officer Incident Coordination
  async claimIncident(id: string): Promise<{ success: boolean; incident: IncidentAlert }> {
    const res = await fetch(`${API_BASE}/incidents/${id}/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      }
    });
    return safeFetchJson<{ success: boolean; incident: IncidentAlert }>(res, 'Failed to claim incident');
  },

  async releaseIncident(id: string, reason?: string): Promise<{ success: boolean; incident: IncidentAlert }> {
    const res = await fetch(`${API_BASE}/incidents/${id}/release`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
      body: JSON.stringify({ reason })
    });
    return safeFetchJson<{ success: boolean; incident: IncidentAlert }>(res, 'Failed to release incident');
  },

  async handoverIncident(id: string, targetOfficer: { id: string; name: string; role?: string }, reason: string): Promise<{ success: boolean; incident: IncidentAlert }> {
    const res = await fetch(`${API_BASE}/incidents/${id}/handover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
      body: JSON.stringify({
        targetOfficerId: targetOfficer.id,
        targetOfficerName: targetOfficer.name,
        targetOfficerRole: targetOfficer.role || 'COMMAND_OPERATOR',
        reason
      })
    });
    return safeFetchJson<{ success: boolean; incident: IncidentAlert }>(res, 'Failed to transfer incident command');
  },

  async joinIncidentMonitoring(id: string): Promise<{ success: boolean; incident: IncidentAlert }> {
    const res = await fetch(`${API_BASE}/incidents/${id}/monitor/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      }
    });
    return safeFetchJson<{ success: boolean; incident: IncidentAlert }>(res, 'Failed to join incident monitoring');
  },

  async leaveIncidentMonitoring(id: string): Promise<{ success: boolean; incident: IncidentAlert }> {
    const res = await fetch(`${API_BASE}/incidents/${id}/monitor/leave`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      }
    });
    return safeFetchJson<{ success: boolean; incident: IncidentAlert }>(res, 'Failed to leave incident monitoring');
  },

  async addIncidentTacticalNote(id: string, note: string): Promise<{ success: boolean; incident: IncidentAlert }> {
    const res = await fetch(`${API_BASE}/incidents/${id}/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
      body: JSON.stringify({ note })
    });
    return safeFetchJson<{ success: boolean; incident: IncidentAlert }>(res, 'Failed to add tactical note');
  },

  async getIncidentTimeline(id: string): Promise<any[]> {
    try {
      const res = await fetch(`${API_BASE}/incidents/${id}/timeline`, {
        headers: this.getAuthHeaders()
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.events || [];
    } catch {
      return [];
    }
  },

  async getCommandOfficersWorkload(): Promise<any[]> {
    try {
      const res = await fetch(`${API_BASE}/command-centre/officers`, {
        headers: this.getAuthHeaders()
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.officers || [];
    } catch {
      return [];
    }
  },

  async updateResponderLiveLocation(locationData: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
    heading?: number;
    speed?: number;
    locationSharingStatus?: string;
    addressDescription?: string;
    responderId?: string;
  }): Promise<{ success: boolean; responder: ResponderUnit }> {
    const res = await fetch(`${API_BASE}/responders/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
      body: JSON.stringify(locationData)
    });
    return safeFetchJson<{ success: boolean; responder: ResponderUnit }>(res, 'Failed to publish location telemetry');
  },

  async updateResponderAvailability(status: string, isAvailable?: boolean, responderId?: string): Promise<{ success: boolean; responder: ResponderUnit }> {
    const res = await fetch(`${API_BASE}/responders/availability`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
      body: JSON.stringify({ status, isAvailable, responderId })
    });
    return safeFetchJson<{ success: boolean; responder: ResponderUnit }>(res, 'Failed to update responder availability');
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

  async runOperationalSuite(): Promise<any> {
    const res = await fetch(`${API_BASE}/command-centre/run-validation-suite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      }
    });
    return safeFetchJson<any>(res, 'Failed to run operational validation suite');
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

  async updateUser(userId: string, payload: UpdateUserPayload): Promise<PlatformUserItem> {
    const res = await fetch(`${API_BASE}/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
      body: JSON.stringify(payload)
    });
    return safeFetchJson<PlatformUserItem>(res, 'User update failed');
  },

  async deleteUser(userId: string, hard: boolean = false): Promise<{ success: boolean; softDeleted?: boolean; hardDeleted?: boolean; message?: string }> {
    const res = await fetch(`${API_BASE}/users/${userId}${hard ? '?hard=true' : ''}`, {
      method: 'DELETE',
      headers: {
        ...this.getAuthHeaders()
      }
    });
    return safeFetchJson<{ success: boolean; softDeleted?: boolean; hardDeleted?: boolean; message?: string }>(res, 'User deletion failed');
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

  // Audit Logs (Paginated & Filtered)
  async getPaginatedAuditLogs(
    options?: AuditLogQueryOptions,
    signal?: AbortSignal
  ): Promise<PaginatedResponse<ImmutableAuditEvent>> {
    const query = new URLSearchParams();
    query.set('paginated', 'true');
    if (options?.actionType) query.set('actionType', options.actionType);
    if (options?.actorUserId) query.set('actorUserId', options.actorUserId);
    if (options?.targetEntity) query.set('targetEntity', options.targetEntity);
    if (options?.targetId) query.set('targetId', options.targetId);
    if (options?.startDate) query.set('startDate', options.startDate);
    if (options?.endDate) query.set('endDate', options.endDate);
    if (options?.search) query.set('search', options.search);
    if (options?.page) query.set('page', String(options.page));
    if (options?.limit) query.set('limit', String(options.limit));

    const res = await fetch(`${API_BASE}/audit-logs?${query.toString()}`, {
      headers: this.getAuthHeaders(),
      signal
    });

    if (!res.ok) {
      return {
        data: [],
        pagination: { total: 0, limit: options?.limit || 25, offset: 0, page: options?.page || 1, totalPages: 0, hasMore: false }
      };
    }
    return res.json();
  },

  async getAuditLogs(options?: AuditLogQueryOptions): Promise<ImmutableAuditEvent[]> {
    try {
      const query = new URLSearchParams();
      if (options?.actionType) query.set('actionType', options.actionType);
      if (options?.search) query.set('search', options.search);
      const res = await fetch(`${API_BASE}/audit-logs?${query.toString()}`, {
        headers: this.getAuthHeaders()
      });
      if (!res.ok) return [];
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.toLowerCase().includes('application/json')) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : data?.data || [];
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
  },

  // ----------------------------------------------------
  // PHASE 6: TECHNICIAN & HARDWARE API METHODS
  // ----------------------------------------------------
  async getDevices(filters?: { schoolId?: string; search?: string; status?: string }): Promise<DeviceRecord[]> {
    const params = new URLSearchParams();
    if (filters?.schoolId) params.append('schoolId', filters.schoolId);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.status) params.append('status', filters.status);

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE}/devices${qs}`, {
      headers: this.getAuthHeaders()
    });
    return safeFetchJson<DeviceRecord[]>(res, 'Failed to fetch hardware device telemetry');
  },

  async pingDevice(deviceId: string): Promise<{ success: boolean; deviceId: string; status: string; signalStrength: number; latencyMs: number; timestamp: string }> {
    const res = await fetch(`${API_BASE}/devices/ping`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
      body: JSON.stringify({ deviceId })
    });
    return safeFetchJson<{ success: boolean; deviceId: string; status: string; signalStrength: number; latencyMs: number; timestamp: string }>(res, 'Failed to ping hardware device');
  },

  async calibrateDevice(deviceId: string): Promise<{ success: boolean; deviceId: string; status: string; batteryLevel?: number; signalStrength: number; tamperStatus: string; calibrationStatus: string }> {
    const res = await fetch(`${API_BASE}/devices/calibrate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
      body: JSON.stringify({ deviceId })
    });
    return safeFetchJson<{ success: boolean; deviceId: string; status: string; batteryLevel?: number; signalStrength: number; tamperStatus: string; calibrationStatus: string }>(res, 'Failed to calibrate hardware device');
  },

  async logDeviceMaintenance(payload: {
    deviceId: string;
    actionType: string;
    description: string;
    status?: string;
  }): Promise<{ success: boolean; message: string; record: DeviceMaintenanceRecord }> {
    const res = await fetch(`${API_BASE}/devices/maintenance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
      body: JSON.stringify(payload)
    });
    return safeFetchJson<{ success: boolean; message: string; record: DeviceMaintenanceRecord }>(res, 'Failed to record maintenance action');
  },

  async getDeviceMaintenanceLogs(deviceId?: string): Promise<DeviceMaintenanceRecord[]> {
    const qs = deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : '';
    const res = await fetch(`${API_BASE}/devices/maintenance${qs}`, {
      headers: this.getAuthHeaders()
    });
    return safeFetchJson<DeviceMaintenanceRecord[]>(res, 'Failed to fetch maintenance logs');
  },

  async updateDeviceConfig(payload: {
    deviceId: string;
    firmwareVersion?: string;
    hardwareRevision?: string;
    status?: string;
  }): Promise<{ success: boolean; message: string; updatedConfig: any }> {
    const res = await fetch(`${API_BASE}/devices/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
      body: JSON.stringify(payload)
    });
    return safeFetchJson<{ success: boolean; message: string; updatedConfig: any }>(res, 'Failed to update device configuration');
  },

  async reassignDevice(payload: {
    oldDeviceId?: string;
    newDeviceId: string;
    learnerEmis?: string;
    learnerId?: string;
    reason?: string;
  }): Promise<{ success: boolean; message: string; newDeviceId: string; serialNumber: string }> {
    const res = await fetch(`${API_BASE}/devices/reassign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
      body: JSON.stringify(payload)
    });
    return safeFetchJson<{ success: boolean; message: string; newDeviceId: string; serialNumber: string }>(res, 'Failed to assign or reassign hardware device');
  },

  async getDeviceGateways(): Promise<DeviceGatewayRecord[]> {
    const res = await fetch(`${API_BASE}/devices/gateways`, {
      headers: this.getAuthHeaders()
    });
    return safeFetchJson<DeviceGatewayRecord[]>(res, 'Failed to fetch IoT gateways');
  },

  async runTechnicianValidationSuite(): Promise<TechnicianValidationResult> {
    const res = await fetch(`${API_BASE}/technician/run-validation-suite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      }
    });
    return safeFetchJson<TechnicianValidationResult>(res, 'Failed to run Phase 6 technician validation suite');
  },

  async getExecutiveOverview(): Promise<ExecutiveOverviewData> {
    const res = await fetch(`${API_BASE}/governance/executive-overview`, {
      headers: this.getAuthHeaders()
    });
    return safeFetchJson<ExecutiveOverviewData>(res, 'Failed to fetch executive overview data');
  },

  async runFounderValidationSuite(): Promise<FounderValidationResult> {
    const res = await fetch(`${API_BASE}/founder/run-validation-suite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      }
    });
    return safeFetchJson<FounderValidationResult>(res, 'Failed to run Phase 9 Founder validation suite');
  },

  async simulateTelemetry(payload: TelemetrySimulationRequest): Promise<TelemetrySimulationResult> {
    const res = await fetch(`${API_BASE}/telemetry/simulate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
      body: JSON.stringify(payload)
    });
    return safeFetchJson<TelemetrySimulationResult>(res, 'Failed to execute telemetry simulation');
  },

  async getTelemetryTemplates(deviceId?: string): Promise<Array<{ id: string; name: string; protocol: string; packetType: string; description: string; rawPacketHex: string }>> {
    const query = deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : '';
    const res = await fetch(`${API_BASE}/telemetry/templates${query}`, {
      headers: this.getAuthHeaders()
    });
    return safeFetchJson<Array<{ id: string; name: string; protocol: string; packetType: string; description: string; rawPacketHex: string }>>(res, 'Failed to fetch telemetry templates');
  },

  async runTelemetrySimulatorSuite(): Promise<TelemetrySimulatorTestSuiteResult> {
    const res = await fetch(`${API_BASE}/system/test-suites/telemetry-simulator`, {
      headers: this.getAuthHeaders()
    });
    return safeFetchJson<TelemetrySimulatorTestSuiteResult>(res, 'Failed to run telemetry simulator test suite');
  },

  async getTelemetryGatewayStatus(): Promise<TelemetryGatewayStatus> {
    const res = await fetch(`${API_BASE}/telemetry/gateway/status`, {
      headers: this.getAuthHeaders()
    });
    return safeFetchJson<TelemetryGatewayStatus>(res, 'Failed to fetch telemetry gateway status');
  },

  async runTelemetryGatewaySuite(): Promise<TelemetryGatewayTestSuiteResult> {
    const res = await fetch(`${API_BASE}/system/test-suites/telemetry-gateway`, {
      headers: this.getAuthHeaders()
    });
    return safeFetchJson<TelemetryGatewayTestSuiteResult>(res, 'Failed to run telemetry gateway acceptance suite');
  },

  async runTelemetryPersistenceSuite(): Promise<TelemetryPersistenceTestSuiteResult> {
    const res = await fetch(`${API_BASE}/telemetry/persistence/test-suite/run`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    });
    return safeFetchJson<TelemetryPersistenceTestSuiteResult>(res, 'Failed to run telemetry persistence acceptance suite');
  },

  async getTelemetryPersistenceSuite(): Promise<TelemetryPersistenceTestSuiteResult> {
    const res = await fetch(`${API_BASE}/telemetry/persistence/test-suite`, {
      headers: this.getAuthHeaders()
    });
    return safeFetchJson<TelemetryPersistenceTestSuiteResult>(res, 'Failed to fetch telemetry persistence acceptance suite');
  },

  // Map Data APIs
  async getMapDeviceLatestLocation(deviceId: string): Promise<MapDeviceLatestLocation> {
    const res = await fetch(`${API_BASE}/map/device/${encodeURIComponent(deviceId)}/latest`, {
      headers: this.getAuthHeaders()
    });
    const data = await safeFetchJson<{ success: boolean; data: MapDeviceLatestLocation }>(res, 'Failed to fetch latest device location');
    return data.data;
  },

  async getMapLearnerCurrentLocation(learnerId: string): Promise<MapLearnerCurrentLocation> {
    const res = await fetch(`${API_BASE}/map/learner/${encodeURIComponent(learnerId)}/latest`, {
      headers: this.getAuthHeaders()
    });
    const data = await safeFetchJson<{ success: boolean; data: MapLearnerCurrentLocation }>(res, 'Failed to fetch learner location');
    return data.data;
  },

  async getMapLocationHistory(params: {
    subjectType: 'LEARNER' | 'DEVICE';
    subjectId: string;
    startTime?: string;
    endTime?: string;
    page?: number;
    limit?: number;
  }): Promise<MapLocationHistoryResponse> {
    const query = new URLSearchParams();
    query.set('subjectType', params.subjectType);
    query.set('subjectId', params.subjectId);
    if (params.startTime) query.set('startTime', params.startTime);
    if (params.endTime) query.set('endTime', params.endTime);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));

    const res = await fetch(`${API_BASE}/map/history?${query.toString()}`, {
      headers: this.getAuthHeaders()
    });
    return safeFetchJson<MapLocationHistoryResponse>(res, 'Failed to fetch map location history');
  },

  async getIncidentTacticalContext(incidentId: string): Promise<IncidentTacticalLocationContext> {
    const res = await fetch(`${API_BASE}/map/incidents/${encodeURIComponent(incidentId)}/tactical-context`, {
      headers: this.getAuthHeaders()
    });
    const data = await safeFetchJson<{ success: boolean; data: IncidentTacticalLocationContext }>(res, 'Failed to fetch incident tactical context');
    return data.data;
  },

  async getDeviceHealthStatus(deviceId: string): Promise<DeviceHealthStatus> {
    const res = await fetch(`${API_BASE}/map/device/${encodeURIComponent(deviceId)}/health`, {
      headers: this.getAuthHeaders()
    });
    const data = await safeFetchJson<{ success: boolean; data: DeviceHealthStatus }>(res, 'Failed to fetch device health status');
    return data.data;
  },

  async pollMapLocationUpdates(cursor?: string, sinceTimestamp?: string): Promise<MapPollUpdateResponse> {
    const query = new URLSearchParams();
    if (cursor) query.set('cursor', cursor);
    if (sinceTimestamp) query.set('sinceTimestamp', sinceTimestamp);

    const res = await fetch(`${API_BASE}/map/stream/poll?${query.toString()}`, {
      headers: this.getAuthHeaders()
    });
    const data = await safeFetchJson<{ success: boolean; data: MapPollUpdateResponse }>(res, 'Failed to poll map location updates');
    return data.data;
  },

  async runLiveLocationTestSuite(): Promise<LiveLocationTestSuiteResult> {
    const res = await fetch(`${API_BASE}/map/test-suite/run`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    });
    return safeFetchJson<LiveLocationTestSuiteResult>(res, 'Failed to run live location test suite');
  },

  async getLiveLocationTestSuite(): Promise<LiveLocationTestSuiteResult> {
    const res = await fetch(`${API_BASE}/map/test-suite`, {
      headers: this.getAuthHeaders()
    });
    return safeFetchJson<LiveLocationTestSuiteResult>(res, 'Failed to fetch live location test suite');
  }
};
