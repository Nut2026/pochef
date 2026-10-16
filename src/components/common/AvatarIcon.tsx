import type { AvatarType } from '@/types/types';

interface AvatarIconProps {
  avatarType: AvatarType;
  initials: string;
  size?: number;
  className?: string;
}

function AvocadoSVG({ sz }: { sz: number }) {
  return (
    <svg width={sz} height={sz} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="20" cy="22" rx="12" ry="15" fill="#5D8A3C" />
      <ellipse cx="20" cy="24" rx="8" ry="10" fill="#C8E6A0" />
      <ellipse cx="20" cy="26" rx="5" ry="6" fill="#5C3A1E" />
    </svg>
  );
}

function ChefsHatSVG({ sz }: { sz: number }) {
  return (
    <svg width={sz} height={sz} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="12" y="26" width="16" height="6" rx="1" fill="#E8E0D8" stroke="#C8B8A8" strokeWidth="1" />
      <ellipse cx="20" cy="20" rx="11" ry="10" fill="#FFFFFF" stroke="#E0D0C0" strokeWidth="1" />
      <ellipse cx="20" cy="12" rx="6" ry="6" fill="#FFFFFF" stroke="#E0D0C0" strokeWidth="1" />
      <ellipse cx="12" cy="16" rx="5" ry="5" fill="#FFFFFF" stroke="#E0D0C0" strokeWidth="1" />
      <ellipse cx="28" cy="16" rx="5" ry="5" fill="#FFFFFF" stroke="#E0D0C0" strokeWidth="1" />
    </svg>
  );
}

function FermentationJarSVG({ sz }: { sz: number }) {
  return (
    <svg width={sz} height={sz} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="14" y="8" width="12" height="4" rx="1" fill="#A8926E" />
      <path d="M11 14 Q10 20 10 28 Q10 32 20 32 Q30 32 30 28 Q30 20 29 14 Z" fill="#C8E8C0" stroke="#8AAE78" strokeWidth="1.2" />
      <rect x="11" y="12" width="18" height="4" rx="1" fill="#B89C6E" />
      <ellipse cx="20" cy="24" rx="5" ry="3" fill="rgba(100,160,80,0.3)" />
      <circle cx="17" cy="20" r="1.5" fill="rgba(80,140,60,0.5)" />
      <circle cx="23" cy="22" r="1" fill="rgba(80,140,60,0.5)" />
    </svg>
  );
}

function GroceryBasketSVG({ sz }: { sz: number }) {
  return (
    <svg width={sz} height={sz} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 18 Q8 32 20 32 Q32 32 32 18 Z" fill="#C8A06A" stroke="#A07840" strokeWidth="1.2" />
      <path d="M8 18 H32" stroke="#A07840" strokeWidth="1.5" />
      <line x1="14" y1="18" x2="12" y2="32" stroke="#A07840" strokeWidth="1" />
      <line x1="20" y1="18" x2="20" y2="32" stroke="#A07840" strokeWidth="1" />
      <line x1="26" y1="18" x2="28" y2="32" stroke="#A07840" strokeWidth="1" />
      <path d="M13 18 Q11 10 20 10 Q29 10 27 18" stroke="#A07840" strokeWidth="1.5" fill="none" />
      <circle cx="17" cy="14" r="2.5" fill="#E05050" />
      <circle cx="23" cy="13" r="2" fill="#50C050" />
    </svg>
  );
}

function NoodlesSVG({ sz }: { sz: number }) {
  return (
    <svg width={sz} height={sz} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 28 Q10 22 20 22 Q30 22 32 28 Q32 34 20 34 Q8 34 8 28Z" fill="#E8D098" stroke="#C8A850" strokeWidth="1" />
      <path d="M10 26 Q14 20 18 24 Q22 28 26 22 Q30 18 32 22" stroke="#F0B840" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M12 22 Q15 16 19 20 Q23 24 27 18" stroke="#F0B840" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <circle cx="16" cy="14" r="3" fill="#E06030" />
      <circle cx="24" cy="12" r="2.5" fill="#40A860" />
    </svg>
  );
}

export function AvatarIcon({ avatarType, initials, size = 32, className = '' }: AvatarIconProps) {
  const fontSize = size <= 32 ? 'text-xs' : size <= 48 ? 'text-sm' : 'text-2xl';

  if (avatarType === 'initials' || !avatarType) {
    return (
      <span className={`font-bold ${fontSize} ${className}`}>
        {initials}
      </span>
    );
  }

  const svgSize = Math.round(size * 0.7);
  const svgMap: Record<Exclude<AvatarType, 'initials'>, React.ReactNode> = {
    avocado:          <AvocadoSVG sz={svgSize} />,
    chefs_hat:        <ChefsHatSVG sz={svgSize} />,
    fermentation_jar: <FermentationJarSVG sz={svgSize} />,
    grocery_basket:   <GroceryBasketSVG sz={svgSize} />,
    noodles:          <NoodlesSVG sz={svgSize} />,
  };

  return (
    <span
      className={`flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={avatarType.replace(/_/g, ' ')}
    >
      {svgMap[avatarType as Exclude<AvatarType, 'initials'>]}
    </span>
  );
}
