import React from 'react';
import './Button.css';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  size?: 'large' | 'default';
  icon?: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'default',
  icon,
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = ['ap-button', `ap-button--${variant}`, `ap-button--${size}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classes} {...rest}>
      {icon}
      {children}
    </button>
  );
}
