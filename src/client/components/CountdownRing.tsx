import React from 'react';
import { getTimerColor } from '../timerColor';

const VIEWBOX = 128;
const RADIUS = 54;
const STROKE = 10;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export interface CountdownRingProps {
  secondsRemaining: number;
  totalSeconds: number;
  size?: number;
}

export function CountdownRing({ secondsRemaining, totalSeconds, size = 128 }: CountdownRingProps) {
  const clamped = Math.max(0, Math.min(secondsRemaining, totalSeconds));
  const fractionElapsed = totalSeconds > 0 ? 1 - clamped / totalSeconds : 1;
  const dashOffset = CIRCUMFERENCE * fractionElapsed;
  const color = getTimerColor(clamped);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
      role="img"
      aria-label={`${clamped} seconds remaining`}
    >
      <circle
        cx={VIEWBOX / 2}
        cy={VIEWBOX / 2}
        r={RADIUS}
        fill="none"
        stroke="var(--color-border)"
        strokeWidth={STROKE}
      />
      <circle
        cx={VIEWBOX / 2}
        cy={VIEWBOX / 2}
        r={RADIUS}
        fill="none"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={dashOffset}
        transform={`rotate(-90 ${VIEWBOX / 2} ${VIEWBOX / 2})`}
        style={{ transition: 'stroke-dashoffset 1s linear, stroke 200ms ease-out' }}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontFamily="var(--font-display)"
        fontWeight={700}
        fontSize={38}
      >
        {clamped}
      </text>
    </svg>
  );
}
