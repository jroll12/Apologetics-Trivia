import React from 'react';
import './Avatar.css';

export interface AvatarProps {
  initial: string;
  tone?: 'violet' | 'neutral';
  size?: number;
}

// Initials only — never a photo or illustrated character, per the design
// system's voice rules.
export function Avatar({ initial, tone = 'violet', size = 40 }: AvatarProps) {
  return (
    <span
      className={`ap-avatar ap-avatar--${tone}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {initial.slice(0, 1).toUpperCase()}
    </span>
  );
}
