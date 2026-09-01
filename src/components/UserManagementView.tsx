import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  ShieldCheck, 
  Lock, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Building2, 
  Mail, 
  Phone, 
  RotateCw, 
  Filter, 
  ShieldAlert, 
  Sparkles,
  School as SchoolIcon,
  Shield,
  Layers,
  ChevronRight,
  Edit,
  Trash2
} from 'lucide-react';
import { PlatformUserItem, UserRole, AccountStatus, School as SchoolType, ActiveUserSession } from '../types.js';
import { api } from '../services/api.js';
import { CreateUserModal } from './CreateUserModal.js';
import { EditUserModal } from './EditUserModal.js';

interface Props {
  schools: SchoolType[];
  currentUser?: ActiveUserSession;
}

export const UserManagementView: React.FC<Props> = ({ schools = [], currentUser }) => {
  const [users, setUsers] = useState<PlatformUserItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  
  // Create User Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Edit User Modal state
  const [editingUser, setEditingUser] = useState<PlatformUserItem | null>(null);
  
  // Status change notification
  const [statusChangeMsg, setStatusChangeMsg] = useState<{ id: string; msg: string; type: 'success' | 'error' } | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const data = await api.getUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Failed to load user directory:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (userId: string, newStatus: AccountStatus, isDemo?: boolean, role?: UserRole) => {
    if (role === 'FOUNDER_EXECUTIVE') {
      setStatusChangeMsg({
        id: userId,
        msg: 'Founder / SuperAdmin accounts are protected and cannot be suspended or deactivated.',
        type: 'error'
      });
      setTimeout(() => setStatusChangeMsg(null), 3000);
      return;
    }

    setIsUpdatingStatus(userId);
    setStatusChangeMsg(null);

    try {
      const res = await api.updateUserStatus(userId, newStatus);
      if (res.success) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: newStatus } : u));
        setStatusChangeMsg({
          id: userId,
          msg: `Account status updated to ${newStatus}.`,
          type: 'success'
        });
      }
    } catch (err: any) {
      setStatusChangeMsg({
        id: userId,
        msg: err.message || 'Failed to update account status.',
        type: 'error'
      });
    } finally {
      setIsUpdatingStatus(null);
      setTimeout(() => setStatusChangeMsg(null), 3500);
    }
  };

  const handleUserCreated = (newUser: PlatformUserItem) => {
    setUsers(prev => [newUser, ...prev]);
    fetchUsers();
  };

  const handleUserUpdated = (updatedUser: PlatformUserItem) => {
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
    fetchUsers();
  };

  const handleUserDeleted = (userId: string) => {
    setUsers(prev => prev.filter(u => u.id !== userId));
    fetchUsers();
  };

  // Filtered list
  const filteredUsers = users.filter(user => {
    // Role filter
    if (selectedRoleFilter !== 'ALL' && user.role !== selectedRoleFilter) {
      return false;
    }
    // Status filter
    if (selectedStatusFilter !== 'ALL' && (user.status || 'ACTIVE') !== selectedStatusFilter) {
      return false;
    }
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (user.name || '').toLowerCase().includes(q);
      const matchFirst = (user.firstName || '').toLowerCase().includes(q);
      const matchSurname = (user.surname || '').toLowerCase().includes(q);
      const matchEmail = (user.email || '').toLowerCase().includes(q);
      const matchOrg = (user.organization || '').toLowerCase().includes(q);
      const matchRole = (user.role || '').toLowerCase().includes(q);
      return matchName || matchFirst || matchSurname || matchEmail || matchOrg || matchRole;
    }
    return true;
  });

  const getRoleBadgeStyle = (role: UserRole) => {
    switch (role) {
      case 'FOUNDER_EXECUTIVE':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case 'COMMAND_OPERATOR':
        return 'bg-red-500/20 text-red-300 border-red-500/40';
      case 'FIELD_RESPONDER':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
      case 'SYSTEM_ADMIN':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'GOVERNMENT_AUDITOR':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'SCHOOL_PRINCIPAL':
      case 'SCHOOL_ADMIN_STAFF':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'TECHNICIAN':
        return 'bg-teal-500/20 text-teal-300 border-teal-500/40';
      case 'PARENT_GUARDIAN':
      default:
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
    }
  };

  const getPortalDestinationLabel = (role: UserRole) => {
    switch (role) {
      case 'FOUNDER_EXECUTIVE':
        return 'Executive Governance Portal';
      case 'COMMAND_OPERATOR':
        return 'National Command Centre';
      case 'FIELD_RESPONDER':
        return 'Responder Tactical Console';
      case 'SYSTEM_ADMIN':
        return 'System Admin Portal';
      case 'GOVERNMENT_AUDITOR':
        return 'Governance & Audit Portal';
      case 'SCHOOL_PRINCIPAL':
      case 'SCHOOL_ADMIN_STAFF':
        return 'School Portal';
      case 'TECHNICIAN':
        return 'Technician IoT Portal';
      case 'PARENT_GUARDIAN':
      default:
        return 'Guardian Family Portal';
    }
  };

  const activeCount = users.filter(u => (u.status || 'ACTIVE') === 'ACTIVE').length;
  const suspendedCount = users.filter(u => u.status === 'SUSPENDED').length;
  const disabledCount = users.filter(u => u.status === 'DISABLED').length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Action Header */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Platform User Identity Management
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 rounded border border-cyan-500/40">
                  FOUNDER AUTHORITATIVE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage registered user identities, authoritative roles, and access status across all national portals.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="btn-refresh-users"
            onClick={fetchUsers}
            disabled={isLoading}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-2 transition-all"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh Directory</span>
          </button>

          <button
            id="btn-open-create-user-modal"
            onClick={() => setIsCreateModalOpen(true)}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-cyan-900/30"
          >
            <UserPlus className="w-4 h-4" />
            <span>CREATE USER</span>
          </button>
        </div>
      </div>

      {/* Security Directives Callout */}
      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
          <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-white block font-semibold">Sole Creator Constraint</strong>
            <span className="text-slate-400 text-[11px]">Only Founder/SuperAdmin may create platform user accounts. Admins are blocked.</span>
          </div>
        </div>

        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
          <Lock className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-white block font-semibold">Unified Single Sign-In</strong>
            <span className="text-slate-400 text-[11px]">Users sign in with their unique email at /login and route automatically to their permitted portal.</span>
          </div>
        </div>

        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
          <Shield className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-white block font-semibold">Encrypted Passwords</strong>
            <span className="text-slate-400 text-[11px]">Enforces 12+ char complexity with salted SHA-256 cryptographic hashing on server.</span>
          </div>
        </div>
      </div>

      {/* Directory Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-slate-400 block text-[11px]">Total Platform Users</span>
          <strong className="text-xl font-bold text-white font-mono">{users.length}</strong>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-emerald-400 block text-[11px]">Active (Can Sign In)</span>
          <strong className="text-xl font-bold text-emerald-400 font-mono">{activeCount}</strong>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-amber-400 block text-[11px]">Suspended</span>
          <strong className="text-xl font-bold text-amber-400 font-mono">{suspendedCount}</strong>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-red-400 block text-[11px]">Disabled / Deactivated</span>
          <strong className="text-xl font-bold text-red-400 font-mono">{disabledCount}</strong>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="input-user-directory-search"
            type="text"
            placeholder="Search users by name, email, role, or organization..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            id="select-filter-user-role"
            value={selectedRoleFilter}
            onChange={e => setSelectedRoleFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Roles</option>
            <option value="PARENT_GUARDIAN">Parent / Guardian</option>
            <option value="SCHOOL_PRINCIPAL">School Principal</option>
            <option value="SCHOOL_ADMIN_STAFF">School Staff</option>
            <option value="COMMAND_OPERATOR">Command Operator</option>
            <option value="FIELD_RESPONDER">Field Responder</option>
            <option value="TECHNICIAN">Technician</option>
            <option value="GOVERNMENT_AUDITOR">Government Auditor</option>
            <option value="SYSTEM_ADMIN">System Admin</option>
            <option value="FOUNDER_EXECUTIVE">Founder Executive</option>
          </select>

          <select
            id="select-filter-user-status"
            value={selectedStatusFilter}
            onChange={e => setSelectedStatusFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="SUSPENDED">SUSPENDED</option>
            <option value="DISABLED">DISABLED</option>
          </select>
        </div>
      </div>

      {/* Global Status Update Feedback Toast */}
      {statusChangeMsg && (
        <div className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
          statusChangeMsg.type === 'success' 
            ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200' 
            : 'bg-red-950/60 border-red-500/50 text-red-200'
        }`}>
          {statusChangeMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span>{statusChangeMsg.msg}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950/90 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">User Details</th>
                <th className="py-3.5 px-4">Authoritative Role</th>
                <th className="py-3.5 px-4">Organization / Scope</th>
                <th className="py-3.5 px-4">Assigned Portal</th>
                <th className="py-3.5 px-4">Account Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RotateCw className="w-6 h-6 animate-spin text-cyan-400" />
                      <span>Loading platform identities...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users className="w-8 h-8 text-slate-600" />
                      <span className="text-slate-300 font-semibold">No platform users match the filter criteria</span>
                      <p className="text-slate-500 text-[11px]">Click "CREATE USER" above to provision a new user account.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => {
                  const isFounder = user.role === 'FOUNDER_EXECUTIVE';
                  const currentStatus = user.status || 'ACTIVE';

                  return (
                    <tr key={user.id} className="hover:bg-slate-800/30 transition-colors">
                      {/* User Details */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">
                              {user.name || `${user.firstName || ''} ${user.surname || ''}`.trim() || 'Unnamed User'}
                            </span>
                            {user.isDemoAccount && (
                              <span className="px-1.5 py-0.2 text-[9px] font-mono uppercase bg-slate-800 text-slate-400 rounded border border-slate-700">
                                SEED
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-slate-400 text-[11px] font-mono">
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3 text-slate-500" />
                              {user.email}
                            </span>
                            {user.mobileNumber && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-slate-500" />
                                {user.mobileNumber}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-semibold border ${getRoleBadgeStyle(user.role)}`}>
                          {user.role}
                        </span>
                      </td>

                      {/* Organization */}
                      <td className="py-3.5 px-4 text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="truncate max-w-[180px]">
                            {user.organization || (user.schoolId ? `School ID: ${user.schoolId}` : user.responderUnit ? `Unit: ${user.responderUnit}` : 'National Directorate')}
                          </span>
                        </div>
                      </td>

                      {/* Assigned Portal */}
                      <td className="py-3.5 px-4 text-cyan-300 font-mono text-[11px]">
                        <span className="flex items-center gap-1">
                          <ChevronRight className="w-3 h-3 text-cyan-500" />
                          {getPortalDestinationLabel(user.role)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {isFounder ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                            <ShieldCheck className="w-3 h-3 text-emerald-400" />
                            ACTIVE (PROTECTED)
                          </span>
                        ) : (
                          <select
                            id={`select-status-${user.id}`}
                            value={currentStatus}
                            disabled={isUpdatingStatus === user.id}
                            onChange={e => handleStatusChange(user.id, e.target.value as AccountStatus, user.isDemoAccount, user.role)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono border focus:outline-none transition-all ${
                              currentStatus === 'ACTIVE'
                                ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40 hover:border-emerald-400'
                                : currentStatus === 'SUSPENDED'
                                ? 'bg-amber-950/70 text-amber-300 border-amber-500/40 hover:border-amber-400'
                                : 'bg-red-950/70 text-red-300 border-red-500/40 hover:border-red-400'
                            }`}
                          >
                            <option value="ACTIVE" className="bg-slate-900 text-emerald-300">ACTIVE</option>
                            <option value="SUSPENDED" className="bg-slate-900 text-amber-300">SUSPENDED</option>
                            <option value="DISABLED" className="bg-slate-900 text-red-300">DISABLED</option>
                          </select>
                        )}
                      </td>

                      {/* Quick Action / Status Toggle & Edit */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            id={`btn-edit-${user.id}`}
                            onClick={() => setEditingUser(user)}
                            className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 text-[10px] font-semibold flex items-center gap-1 transition-all"
                            title="Edit User Identity"
                          >
                            <Edit className="w-3 h-3" />
                            <span>Edit</span>
                          </button>

                          {!isFounder && (
                            <>
                              {currentStatus === 'ACTIVE' ? (
                                <button
                                  id={`btn-suspend-${user.id}`}
                                  onClick={() => handleStatusChange(user.id, 'SUSPENDED', user.isDemoAccount, user.role)}
                                  disabled={isUpdatingStatus === user.id}
                                  className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-[10px] font-semibold transition-all"
                                >
                                  Suspend
                                </button>
                              ) : (
                                <button
                                  id={`btn-activate-${user.id}`}
                                  onClick={() => handleStatusChange(user.id, 'ACTIVE', user.isDemoAccount, user.role)}
                                  disabled={isUpdatingStatus === user.id}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold transition-all"
                                >
                                  Activate
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      <CreateUserModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onUserCreated={handleUserCreated}
        schools={schools}
      />

      {/* Edit User Modal */}
      <EditUserModal
        isOpen={!!editingUser}
        user={editingUser}
        onClose={() => setEditingUser(null)}
        onUserUpdated={handleUserUpdated}
        onUserDeleted={handleUserDeleted}
        schools={schools}
      />
    </div>
  );
};
