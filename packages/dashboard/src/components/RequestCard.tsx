import { Link } from 'react-router-dom';
import type { ApprovalRequest } from '../api';
import { StatusBadge } from './StatusBadge';

interface RequestCardProps {
  request: ApprovalRequest;
}

const urgencyColors = {
  low: 'text-gray-500',
  normal: 'text-blue-500',
  high: 'text-orange-500',
  critical: 'text-red-500',
};

export function RequestCard({ request }: RequestCardProps) {
  const createdAt = new Date(request.createdAt).toLocaleString();

  return (
    <Link
      to={`/requests/${request.id}`}
      className="block bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-gray-900 truncate">{request.action}</h3>
            <StatusBadge status={request.status} />
          </div>
          <p className="text-sm text-gray-500 truncate">
            ID: {request.id}
          </p>
          <div className="flex items-center gap-4 mt-2 text-sm">
            <span className={`font-medium ${urgencyColors[request.urgency]}`}>
              {request.urgency.toUpperCase()}
            </span>
            <span className="text-gray-400">{createdAt}</span>
          </div>
        </div>
        <div className="text-gray-400">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  );
}
