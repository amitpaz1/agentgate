import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api, type ApprovalRequest } from '../api';
import { StatusBadge } from '../components/StatusBadge';

type StatusFilter = 'all' | 'pending' | 'approved' | 'denied' | 'expired';

export default function RequestList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const statusFilter = (searchParams.get('status') || 'all') as StatusFilter;

  const fetchRequests = useCallback(async () => {
    try {
      setError(null);
      const params: { status?: string; limit: number } = { limit: 50 };
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const response = await api.listRequests(params);
      setRequests(response.requests);
      setTotal(response.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchRequests();
    
    // Auto-refresh pending requests every 5 seconds
    const interval = setInterval(() => {
      if (statusFilter === 'pending' || statusFilter === 'all') {
        fetchRequests();
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [fetchRequests, statusFilter]);

  const handleStatusChange = (status: StatusFilter) => {
    if (status === 'all') {
      searchParams.delete('status');
    } else {
      searchParams.set('status', status);
    }
    setSearchParams(searchParams);
    setLoading(true);
  };

  const urgencyColors = {
    low: 'text-gray-500',
    normal: 'text-blue-500',
    high: 'text-orange-500',
    critical: 'text-red-500',
  };

  const tabs: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'denied', label: 'Denied' },
    { value: 'expired', label: 'Expired' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Approval Requests</h1>
        <span className="text-sm text-gray-500">
          {total} {total === 1 ? 'request' : 'requests'}
        </span>
      </div>

      {/* Status filter tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4 -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => handleStatusChange(tab.value)}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                statusFilter === tab.value
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500">No requests found</p>
          {statusFilter !== 'all' && (
            <button
              onClick={() => handleStatusChange('all')}
              className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
            >
              Show all requests
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {/* Table Header */}
          <div className="hidden sm:grid sm:grid-cols-12 gap-4 px-4 py-3 bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-500">
            <div className="col-span-3">ID</div>
            <div className="col-span-3">Action</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Urgency</div>
            <div className="col-span-2">Created</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-gray-200">
            {requests.map((request) => (
              <div
                key={request.id}
                onClick={() => navigate(`/requests/${request.id}`)}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 px-4 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="col-span-3 font-mono text-sm text-gray-600 truncate">
                  {request.id}
                </div>
                <div className="col-span-3 font-medium text-gray-900">
                  {request.action}
                </div>
                <div className="col-span-2">
                  <StatusBadge status={request.status} />
                </div>
                <div className={`col-span-2 text-sm font-medium ${urgencyColors[request.urgency]}`}>
                  {request.urgency.toUpperCase()}
                </div>
                <div className="col-span-2 text-sm text-gray-500">
                  {new Date(request.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
