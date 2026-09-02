import React from 'react';
import './ProgressBar.css';

export interface ProgressBarProps {
  /** 0–1 */
  progress: number;
  label: string;
}

export function ProgressBar({ progress, label }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <div className="ap-progress" role="progressbar" aria-valuenow={Math.round(clamped * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="ap-progress-track">
        <div className="ap-progress-fill" style={{ width: `${clamped * 100}%` }} />
      </div>
    </div>
  );
}
