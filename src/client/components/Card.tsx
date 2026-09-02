import React from 'react';
import './Card.css';

export interface CardProps {
  children: React.ReactNode;
  padding?: 'host' | 'player';
  className?: string;
}

export function Card({ children, padding = 'host', className }: CardProps) {
  const classes = ['ap-card', `ap-card--${padding}`, className].filter(Boolean).join(' ');
  return <div className={classes}>{children}</div>;
}
