import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
}

export const Button: React.FC<ButtonProps> = ({ variant = 'primary', className = '', ...props }) => {
  const baseStyle = "px-4 py-2 font-medium text-sm transition-colors duration-150 ease-linear disabled:opacity-50 disabled:cursor-not-allowed"
  
  const variants = {
    primary: "bg-primary text-on-primary hover:bg-primary-dim",
    secondary: "bg-transparent border border-outline-variant hover:border-primary text-on-surface",
    ghost: "bg-transparent text-secondary hover:bg-surface-container",
  }

  return (
    <button className={`${baseStyle} ${variants[variant]} ${className}`} {...props}>
      {props.children}
    </button>
  )
}
