import React from 'react';
import './Badge.css';

export interface BadgeProps {
  children: React.ReactNode;
  tone?: 'violet' | 'neutral';
  pulse?: boolean;
  className?: string;
}

export function Badge({ children, tone = 'neutral', pulse = false, className }: BadgeProps) {
  const classes = ['ap-badge', `ap-badge--${tone}`, pulse && 'ap-badge--pulse', className]
    .filter(Boolean)
    .join(' ');
  return <span className={classes}>{children}</span>;
}
