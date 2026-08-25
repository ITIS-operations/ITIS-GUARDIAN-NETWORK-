import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  FileCheck, 
  Search, 
  Lock, 
  CheckCircle2, 
  RefreshCw, 
  Key, 
  User, 
  Clock,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { ImmutableAuditEvent, PaginatedResponse } from '../types.js';
import { api } from '../services/api.js';

export const AuditLogView: React.FC = () => {
  const [logs, setLogs] = useState<ImmutableAuditEvent[]>([]);
  const [pagination, setPagination] = useState<{
    total: number;
    limit: number;
    offset: number;
    page: number;
    totalPages: number;
    hasMore: boolean;
  }>({
    total: 0,
    limit: 25,
    offset: 0,
    page: 1,
    totalPages: 1,
    hasMore: false
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchLogs = async (pageToFetch = currentPage, search = searchQuery) => {
    setIsLoading(true);
    try {
      const paginatedData = await api.getPaginatedAuditLogs({
        page: pageToFetch,
        limit: 25,
        search: search.trim() || undefined
      });
      setLogs(Array.isArray(paginatedData.data) ? paginatedData.data : []);
      if (paginatedData.pagination) {
        setPagination(paginatedData.pagination);
      }
    } catch (err) {
      console.error(err);
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLogs(currentPage, searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [currentPage, searchQuery]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || (pagination.totalPages && newPage > pagination.totalPages)) return;
    setCurrentPage(newPage);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3.5 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            <Lock className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white tracking-tight">
                Immutable National Child Safety Audit Registry
              </h2>
              <span className="px-2.5 py-0.5 text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                Cryptographically Sealed
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Every create, link, unlink, grade advancement, and emergency dispatch event is stamped with an immutable cryptographic checksum.
            </p>
          </div>
        </div>

        <button
          onClick={() => fetchLogs(currentPage, searchQuery)}
          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-2 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Trail</span>
        </button>
      </div>

      {/* Filter & Pagination Header */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by action type, staff actor, entity ID or SHA checksum..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-cyan-500 font-mono"
          />
        </div>
        <div className="flex items-center gap-3 justify-between sm:justify-end">
          <span className="text-xs text-slate-400 font-mono">
            {pagination.total} Verified Audit Blocks
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1 || isLoading}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono text-cyan-300 px-2">
              Page {pagination.page} of {Math.max(pagination.totalPages, 1)}
            </span>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={!pagination.hasMore || currentPage >= pagination.totalPages || isLoading}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 transition-colors"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4">Action Event</th>
                <th className="py-3.5 px-4">Staff Actor</th>
                <th className="py-3.5 px-4">Target Entity</th>
                <th className="py-3.5 px-4">Transaction Details</th>
                <th className="py-3.5 px-4">Cryptographic Checksum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                    {isLoading ? 'Loading audit records...' : 'No audit records found matching criteria.'}
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-850/50 transition-colors">
                    <td className="py-3 px-4 text-slate-400">
                      <span className="block text-white">{new Date(log.timestamp).toLocaleDateString()}</span>
                      <span className="text-[10px]">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-[10px] font-bold">
                        {log.actionType}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-sans">
                        <strong className="text-white block text-xs">{log.actorName}</strong>
                        <span className="text-[10px] text-slate-500 font-mono">{log.actorRole}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="text-purple-300">{log.targetEntity}</span>
                      <span className="block text-[10px] text-slate-500">{log.targetId}</span>
                    </td>

                    <td className="py-3 px-4 font-sans text-xs text-slate-300 max-w-xs truncate">
                      {JSON.stringify(log.details)}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate max-w-[130px]">{log.checksum}</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
