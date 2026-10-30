import { useId } from 'react';

export function Logo({ size = 40 }: { size?: number }) {
  // Unique gradient id per instance: a hidden copy (desktop/mobile header) must not break the visible one.
  const id = 'lg' + useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <defs><linearGradient id={id} x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#4f5bd5" /><stop offset=".35" stopColor="#962fbf" /><stop offset=".6" stopColor="#d62976" /><stop offset=".82" stopColor="#fa7e1e" /><stop offset="1" stopColor="#feda75" /></linearGradient></defs>
      <rect width="40" height="40" rx="12" fill={'url(#' + id + ')'} />
      <path d="M10 28V13.5c0-1.2 1.5-1.8 2.3-.9L20 21l7.7-8.4c.8-.9 2.3-.3 2.3.9V28" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="20" cy="30" r="2.2" fill="#fff" />
    </svg>
  );
}
