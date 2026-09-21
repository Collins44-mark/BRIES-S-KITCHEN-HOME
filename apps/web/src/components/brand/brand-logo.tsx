'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Home } from 'lucide-react';
import { cn } from '@/lib/utils';

const LOGO_CANDIDATES = ['/brand/logo.png', '/brand/logo.svg'] as const;

export function BrandLogo({
  size = 40,
  className,
  rounded = 'rounded-xl',
}: {
  size?: number;
  className?: string;
  rounded?: string;
}) {
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const src = LOGO_CANDIDATES[index];

  if (failed || !src) {
    return (
      <div
        className={cn(
          'flex shrink-0 items-center justify-center bg-white/10 text-white',
          rounded,
          className,
        )}
        style={{ width: size, height: size }}
      >
        <Home style={{ width: size * 0.45, height: size * 0.45 }} />
      </div>
    );
  }

  return (
    <div
      className={cn('relative shrink-0 overflow-hidden bg-white/10', rounded, className)}
      style={{ width: size, height: size }}
    >
      <Image
        src={src}
        alt="BRIE'S HOME & KITCHEN"
        width={size}
        height={size}
        className="h-full w-full object-cover"
        priority
        onError={() => {
          if (index < LOGO_CANDIDATES.length - 1) {
            setIndex((v) => v + 1);
          } else {
            setFailed(true);
          }
        }}
      />
    </div>
  );
}

export function ProfileAvatar({
  name,
  size = 32,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const [useFile, setUseFile] = useState(true);
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  if (useFile) {
    return (
      <div
        className={cn('relative shrink-0 overflow-hidden rounded-full bg-slate-800', className)}
        style={{ width: size, height: size }}
      >
        <Image
          src="/brand/avatar.png"
          alt={name}
          width={size}
          height={size}
          className="h-full w-full object-cover"
          onError={() => setUseFile(false)}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white',
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.32) }}
    >
      <span className="font-semibold leading-none">{initials || 'U'}</span>
    </div>
  );
}
