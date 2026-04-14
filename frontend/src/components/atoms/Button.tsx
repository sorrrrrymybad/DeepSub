import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
}

export const Button: React.FC<ButtonProps> = ({ variant = 'primary', className = '', ...props }) => {
  const baseStyle =
    'inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors duration-150 ease-linear disabled:cursor-not-allowed disabled:opacity-50'
  
  const variants = {
    primary: 'bg-primary text-on-primary hover:bg-primary-dim',
    secondary: 'border border-outline-variant bg-surface-container-lowest text-on-surface hover:border-primary hover:bg-surface-container-low',
    ghost: 'bg-transparent text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface',
  }

  return (
    <button className={`${baseStyle} ${variants[variant]} ${className}`} {...props}>
      {props.children}
    </button>
  )
}
