import React from 'react';
import { TILE_STYLES } from '../tileStyles';
import './AnswerTile.css';

export interface AnswerTileProps {
  position: 0 | 1 | 2 | 3;
  label: string;
  size: 'host' | 'player';
  interactive?: boolean;
  selected?: boolean;
  /** True once any tile has been picked — dims and disables every other tile. */
  locked?: boolean;
  onClick?: () => void;
}

export function AnswerTile({
  position,
  label,
  size,
  interactive = false,
  selected = false,
  locked = false,
  onClick,
}: AnswerTileProps) {
  const style = TILE_STYLES[position];
  const dimmed = locked && !selected;

  const classes = [
    'ap-tile',
    `ap-tile--${size}`,
    selected && 'ap-tile--selected',
    dimmed && 'ap-tile--dimmed',
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      <span className={`ap-tile-shape ap-tile-shape--${style.shape}`} aria-hidden="true" />
      <span className="ap-tile-label">{label}</span>
      {selected && (
        <span className="ap-tile-check" aria-hidden="true">
          ✓
        </span>
      )}
    </>
  );

  if (!interactive) {
    return (
      <div className={classes} style={{ backgroundColor: style.fill }}>
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={classes}
      style={{ backgroundColor: style.fill }}
      onClick={onClick}
      disabled={dimmed}
    >
      {content}
    </button>
  );
}
