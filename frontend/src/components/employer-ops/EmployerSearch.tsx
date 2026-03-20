import { useState, useRef, useEffect, useMemo } from 'react';

export interface OrgResult {
  orgId: string;
  name: string;
  memberCount?: number;
}

export interface ContactResult {
  contactName: string;
  orgId: string;
  orgName: string;
}

interface EmployerSearchProps {
  orgs: OrgResult[];
  contacts: ContactResult[];
  alertCount: number;
  onSelectEmployer: (orgId: string) => void;
  onShowAlerts: () => void;
}

export default function EmployerSearch({
  orgs,
  contacts,
  alertCount,
  onSelectEmployer,
  onShowAlerts,
}: EmployerSearchProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = query.trim().toLowerCase();
  const showDropdown = open && trimmed.length >= 2;

  const filteredOrgs = useMemo(() => {
    if (trimmed.length < 2) return [];
    return orgs
      .filter(
        (o) => o.name.toLowerCase().includes(trimmed) || o.orgId.toLowerCase().includes(trimmed),
      )
      .slice(0, 8);
  }, [orgs, trimmed]);

  const filteredContacts = useMemo(() => {
    if (trimmed.length < 2) return [];
    return contacts.filter((c) => c.contactName.toLowerCase().includes(trimmed)).slice(0, 5);
  }, [contacts, trimmed]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  function handleSelect(orgId: string) {
    onSelectEmployer(orgId);
    setQuery('');
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Search bar row */}
      <div className="flex items-center gap-3">
        {/* Search input with icon */}
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            &#x1F50D;
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => {
              if (trimmed.length >= 2) setOpen(true);
            }}
            placeholder="Search employers by name, ID, or contact..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Alert badge */}
        <button
          type="button"
          onClick={onShowAlerts}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            alertCount > 0
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
          }`}
        >
          <span>&#x1F514;</span>
          <span>{alertCount}</span>
        </button>
      </div>

      {/* Dropdown overlay */}
      {showDropdown && (filteredOrgs.length > 0 || filteredContacts.length > 0) && (
        <div className="absolute left-0 right-0 mt-1 z-50 rounded-lg shadow-lg border border-gray-200 bg-white max-h-80 overflow-y-auto">
          {/* Employers section */}
          {filteredOrgs.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
                Employers
              </div>
              {filteredOrgs.map((org) => (
                <button
                  key={org.orgId}
                  type="button"
                  onClick={() => handleSelect(org.orgId)}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <div className="text-sm font-medium text-gray-900">{org.name}</div>
                    <div className="text-xs text-gray-500">{org.orgId}</div>
                  </div>
                  {org.memberCount != null && (
                    <span className="text-xs text-gray-400">
                      {org.memberCount.toLocaleString()} members
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Contacts section */}
          {filteredContacts.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 border-t border-gray-100">
                Contacts
              </div>
              {filteredContacts.map((contact, idx) => (
                <button
                  key={`${contact.orgId}-${contact.contactName}-${idx}`}
                  type="button"
                  onClick={() => handleSelect(contact.orgId)}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 cursor-pointer"
                >
                  <div className="text-sm font-medium text-gray-900">{contact.contactName}</div>
                  <div className="text-xs text-gray-500">{contact.orgName}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
