import { useState, useEffect, useRef, useCallback } from 'react';
import { useContactSearch } from '@/hooks/useCRM';
import type { Contact, ContactType, SecurityFlag } from '@/types/CRM';

interface ContactSearchProps {
  onSelect: (contact: Contact) => void;
}

const contactTypeBadge: Record<ContactType, { label: string; color: string }> = {
  member: { label: 'Member', color: 'bg-blue-100 text-blue-800' },
  beneficiary: { label: 'Beneficiary', color: 'bg-purple-100 text-purple-800' },
  alternate_payee: { label: 'Alt Payee', color: 'bg-amber-100 text-amber-800' },
  external: { label: 'External', color: 'bg-gray-100 text-gray-700' },
};

const securityFlagLabels: Record<SecurityFlag, { label: string; color: string }> = {
  fraud_alert: { label: 'Fraud Alert', color: 'text-red-600' },
  pending_divorce: { label: 'Pending Divorce', color: 'text-orange-600' },
  suspected_death: { label: 'Suspected Death', color: 'text-red-700' },
  legal_hold: { label: 'Legal Hold', color: 'text-red-600' },
  restricted_access: { label: 'Restricted', color: 'text-red-500' },
};

export default function ContactSearch({ onSelect }: ContactSearchProps) {
  const [inputValue, setInputValue] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce the search query by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(inputValue.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  const { data: results, isLoading } = useContactSearch(debouncedQuery, debouncedQuery.length >= 2);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (contact: Contact) => {
      setInputValue(`${contact.firstName} ${contact.lastName}`);
      setIsOpen(false);
      onSelect(contact);
    },
    [onSelect],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setIsOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const contacts = results?.items ?? [];
  const showDropdown = isOpen && debouncedQuery.length >= 2;

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => debouncedQuery.length >= 2 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search contacts by name, ID, email, phone..."
          className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-brand-600" />
          </div>
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
          {contacts.length === 0 && !isLoading && (
            <div className="px-4 py-3 text-sm text-gray-500">
              No contacts found for "{debouncedQuery}"
            </div>
          )}

          {contacts.length > 0 && (
            <ul className="max-h-80 overflow-y-auto py-1">
              {contacts.map((contact) => {
                const badge = contactTypeBadge[contact.contactType] ?? {
                  label: contact.contactType,
                  color: 'bg-gray-100 text-gray-700',
                };
                const secFlag = contact.securityFlag
                  ? securityFlagLabels[contact.securityFlag]
                  : null;

                return (
                  <li key={contact.contactId}>
                    <button
                      type="button"
                      onClick={() => handleSelect(contact)}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      {/* Avatar initials */}
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                        {contact.firstName[0]}
                        {contact.lastName[0]}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {contact.firstName}
                            {contact.middleName ? ` ${contact.middleName}` : ''} {contact.lastName}
                            {contact.suffix ? ` ${contact.suffix}` : ''}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.color}`}
                          >
                            {badge.label}
                          </span>
                          {secFlag && (
                            <span
                              className={`flex items-center gap-1 text-xs font-medium ${secFlag.color}`}
                            >
                              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path
                                  fillRule="evenodd"
                                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              {secFlag.label}
                            </span>
                          )}
                        </div>

                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
                          {contact.legacyMemberId && (
                            <span className="font-mono text-gray-600">
                              ID: {contact.legacyMemberId}
                            </span>
                          )}
                          {contact.primaryPhone && (
                            <span className="flex items-center gap-1">
                              <svg
                                className="h-3 w-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                                />
                              </svg>
                              {contact.primaryPhone}
                            </span>
                          )}
                          {contact.primaryEmail && (
                            <span className="flex items-center gap-1 truncate">
                              <svg
                                className="h-3 w-3 flex-shrink-0"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                />
                              </svg>
                              {contact.primaryEmail}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {results && results.pagination.hasMore && (
            <div className="border-t border-gray-100 px-4 py-2 text-center text-xs text-gray-400">
              Showing {contacts.length} of {results.pagination.total} results
            </div>
          )}
        </div>
      )}
    </div>
  );
}
