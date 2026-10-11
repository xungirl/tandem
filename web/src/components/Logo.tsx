export function Logo({ size = 40, spin }: { size?: number; spin?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className={spin ? 'animate-[wiggle_1.2s_ease-in-out_infinite]' : ''}>
      <circle cx="24" cy="32" r="15" fill="#FF6B4A" stroke="#1F1A17" strokeWidth="4" />
      <circle cx="40" cy="32" r="15" fill="#1FA59A" fillOpacity="0.85" stroke="#1F1A17" strokeWidth="4" />
      <path d="M32 19.6a15 15 0 0 1 0 24.8a15 15 0 0 1 0-24.8z" fill="#FFC94A" stroke="#1F1A17" strokeWidth="4" strokeLinejoin="round" />
    </svg>
  )
}
