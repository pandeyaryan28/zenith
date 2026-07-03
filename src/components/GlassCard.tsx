import React from 'react';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', ...props }) => {
  return (
    <div className={`glass-card ${className}`} {...props}>
      {children}
    </div>
  );
};

export const GlassPanel: React.FC<GlassCardProps> = ({ children, className = '', ...props }) => {
  return (
    <div className={`glass-panel ${className}`} {...props}>
      {children}
    </div>
  );
};
