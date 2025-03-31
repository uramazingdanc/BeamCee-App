
import React from 'react';
import { Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const HomeButton: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Button 
      onClick={() => navigate('/')} 
      variant="outline" 
      size="icon" 
      className="fixed top-4 left-4 rounded-full bg-white shadow-md hover:bg-beamcee-pink hover:text-white transition-all"
    >
      <Home className="h-5 w-5" />
    </Button>
  );
};

export default HomeButton;
