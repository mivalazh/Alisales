'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Icon } from './Icon';

/**
 * Quick-search box — submits `q` into the URL so the server re-runs the one
 * search implementation. Local state keeps typing smooth between navigations.
 */
export function SearchBar({
  q,
  onSearch,
}: {
  q: string;
  onSearch: (q: string) => void;
}) {
  const [value, setValue] = useState(q);
  useEffect(() => setValue(q), [q]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSearch(value.trim());
  };

  return (
    <form onSubmit={submit} role="search" className="relative">
      <Icon
        name="search"
        size={18}
        className="pointer-events-none absolute inset-y-0 end-3 my-auto text-faint"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="جستجو در آگهی‌ها… (مثلاً پژو ۲۰۶)"
        aria-label="جستجوی آگهی"
        className="field pe-10"
      />
    </form>
  );
}
