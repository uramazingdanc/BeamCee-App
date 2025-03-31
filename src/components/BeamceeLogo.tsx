
import React from 'react';

const BeamceeLogo: React.FC<{ className?: string }> = ({ className = "" }) => {
  return (
    <div className={`relative ${className}`}>
      <img 
        src="/lovable-uploads/0beeea80-da78-4a60-a736-4ce11b9671fc.png" 
        alt="BeamCee Logo" 
        className="w-full h-full object-contain max-h-32"
      />
    </div>
  );
};

export default BeamceeLogo;
