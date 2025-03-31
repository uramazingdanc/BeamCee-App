
import React from 'react';
import HomeButton from './HomeButton';

const StepByStepPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-beamcee-gray">
      <HomeButton />
      
      <div className="w-full max-w-4xl calculator-container">
        <h1 className="text-2xl font-bold text-center mb-6 text-beamcee-pink">Step-by-Step Solutions</h1>
        
        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
          <p className="text-gray-600 text-center">
            Detailed step-by-step solutions will be available in the next release.
            <br />
            Please use the Calculator page for now to see calculation steps.
          </p>
        </div>
      </div>
    </div>
  );
};

export default StepByStepPage;
