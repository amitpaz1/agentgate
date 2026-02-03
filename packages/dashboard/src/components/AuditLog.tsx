import type { AuditLogEntry } from '../api';

interface AuditLogProps {
  entries: AuditLogEntry[];
}

const eventTypeIcons: Record<string, string> = {
  created: '📝',
  approved: '✅',
  denied: '❌',
  expired: '⏰',
};

export function AuditLog({ entries }: AuditLogProps) {
  if (entries.length === 0) {
    return (
      <div className="text-gray-500 text-sm py-4">
        No audit entries yet
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {entries.map((entry, index) => (
        <div key={entry.id} className="relative">
          {/* Timeline connector */}
          {index < entries.length - 1 && (
            <div className="absolute left-4 top-8 w-0.5 h-full bg-gray-200" />
          )}
          
          <div className="flex gap-4">
            {/* Icon */}
            <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm">
              {eventTypeIcons[entry.eventType] || '📋'}
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0 pb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-gray-900 capitalize">
                  {entry.eventType.replace('_', ' ')}
                </span>
                <span className="text-gray-400">by</span>
                <span className="text-gray-700 font-medium">{entry.actor}</span>
              </div>
              <time className="text-sm text-gray-500">
                {new Date(entry.createdAt).toLocaleString()}
              </time>
              
              {/* Details */}
              {entry.details && Object.keys(entry.details).length > 0 && (
                <div className="mt-2 text-sm">
                  <details className="group">
                    <summary className="text-blue-600 cursor-pointer hover:text-blue-800">
                      View details
                    </summary>
                    <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-x-auto text-gray-700">
                      {JSON.stringify(entry.details, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
