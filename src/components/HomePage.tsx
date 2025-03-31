
import React from 'react';
import { useNavigate } from 'react-router-dom';
import BeamceeLogo from './BeamceeLogo';
import { Calculator } from 'lucide-react';

const HomePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 animate-fade-in">
      <BeamceeLogo className="mb-12 w-80" />
      
      <div className="max-w-4xl w-full">
        <button 
          onClick={() => navigate('/calculator')}
          className="beamcee-card flex flex-col items-center justify-center gap-4 p-8 mx-auto w-full max-w-sm"
        >
          <Calculator className="w-16 h-16 text-beamcee-pink" />
          <h2 className="text-xl font-bold text-beamcee-dark">Calculator</h2>
          <p className="text-sm text-center text-gray-600">
            Input beam parameters and perform calculations
          </p>
        </button>
      </div>
      
      <footer className="mt-12 text-center text-sm text-gray-500">
        <p>BeamCee © 2024 | Educational Application for Engineering</p>
      </footer>
    </div>
  );
};

export default HomePage;
