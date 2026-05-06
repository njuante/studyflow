interface AppIconProps {
  size?: number;
}

export function AppIcon({ size = 16 }: AppIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`appicon-bg-${size}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4DA3FF" />
          <stop offset="100%" stopColor="#0A63E0" />
        </linearGradient>
        <clipPath id={`appicon-clip-${size}`}>
          <rect x="0" y="0" width="1024" height="1024" rx="228" ry="228" />
        </clipPath>
      </defs>
      <g clipPath={`url(#appicon-clip-${size})`}>
        <rect width="1024" height="1024" fill={`url(#appicon-bg-${size})`} />
        <rect x="216" y="239" width="592" height="569" rx="80" fill="#FFFFFF" />
        <rect x="284" y="421" width="341" height="57" rx="17" fill="#0A63E0" opacity="0.85" />
        <rect x="284" y="523" width="444" height="57" rx="17" fill="#1D9E75" opacity="0.85" />
        <rect x="284" y="625" width="250" height="57" rx="17" fill="#D85A30" opacity="0.85" />
      </g>
    </svg>
  );
}
