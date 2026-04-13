import React from 'react';

// Dummy SectionHeader component to prevent build errors
export const SectionHeader: React.FC<{ children: React.ReactNode; title?: string }> = ({ children, title }) => {
  return (
    <div className="section-header">
      {title && <h2>{title}</h2>}
      {children}
    </div>
  );
};
