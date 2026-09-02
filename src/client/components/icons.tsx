import React from 'react';

// Heroicons v2 outline style (24px grid, 1.5px stroke, currentColor) —
// only the glyphs this product actually uses. Per the design system's voice
// rules, icons are wordmark/badge lockups only, never faces or mascots.
type IconProps = React.SVGProps<SVGSVGElement>;

const base = {
  xmlns: 'http://www.w3.org/2000/svg',
  fill: 'none',
  viewBox: '0 0 24 24',
  strokeWidth: 1.5,
  stroke: 'currentColor',
};

export function CheckBadgeIcon(props: IconProps) {
  return (
    <svg {...base} aria-hidden="true" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75l1.75 1.75L15 9.75M9.75 3.104a2.25 2.25 0 012.5 0l.813.483a2.25 2.25 0 001.084.303h.928a2.25 2.25 0 012.25 2.25v.928c0 .39.109.771.303 1.084l.483.813a2.25 2.25 0 010 2.5l-.483.813a2.25 2.25 0 00-.303 1.084v.928a2.25 2.25 0 01-2.25 2.25h-.928a2.25 2.25 0 00-1.084.303l-.813.483a2.25 2.25 0 01-2.5 0l-.813-.483a2.25 2.25 0 00-1.084-.303h-.928a2.25 2.25 0 01-2.25-2.25v-.928a2.25 2.25 0 00-.303-1.084l-.483-.813a2.25 2.25 0 010-2.5l.483-.813A2.25 2.25 0 006.5 7.068v-.928a2.25 2.25 0 012.25-2.25h.928a2.25 2.25 0 001.084-.303l.813-.483z"
      />
    </svg>
  );
}

export function HandRaisedIcon(props: IconProps) {
  return (
    <svg {...base} aria-hidden="true" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.5 1.5v11.25M10.5 1.5a1.5 1.5 0 013 0v9M13.5 10.5V6a1.5 1.5 0 013 0v6M16.5 9.75a1.5 1.5 0 013 0v3.75a7.5 7.5 0 01-7.5 7.5h-1.318a4.5 4.5 0 01-3.182-1.318l-3.75-3.75a1.06 1.06 0 011.5-1.5l1.5 1.5V13.5a1.5 1.5 0 013 0"
      />
    </svg>
  );
}

export function TrophyIcon(props: IconProps) {
  return (
    <svg {...base} aria-hidden="true" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.75a1.125 1.125 0 01-1.125-1.125v-1.5c0-.621.504-1.125 1.125-1.125h.75c.622 0 1.125-.504 1.125-1.125V6.75A2.25 2.25 0 0016.5 4.5h-9A2.25 2.25 0 005.25 6.75v2.625c0 .621.504 1.125 1.125 1.125h.75c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125h-.75A1.125 1.125 0 005.25 15.375V18.75"
      />
    </svg>
  );
}

export function MicrophoneIcon(props: IconProps) {
  return (
    <svg {...base} aria-hidden="true" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
      />
    </svg>
  );
}

export function ArrowPathIcon(props: IconProps) {
  return (
    <svg {...base} aria-hidden="true" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
      />
    </svg>
  );
}
