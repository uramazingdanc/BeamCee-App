
import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BeamParameters } from '../types/beam';

interface BeamParametersInputProps {
  parameters: BeamParameters;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectChange: (name: string, value: string) => void;
}

const BeamParametersInput: React.FC<BeamParametersInputProps> = ({
  parameters,
  onInputChange,
  onSelectChange
}) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="length">Beam Length (m)</Label>
          <Input
            id="length"
            name="length"
            type="number"
            value={parameters.length}
            onChange={onInputChange}
            min={0.1}
            step={0.1}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="beamType">Beam Type</Label>
          <Select 
            value={parameters.beamType} 
            onValueChange={(value) => onSelectChange('beamType', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select beam type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="simply-supported">Simply Supported</SelectItem>
              <SelectItem value="cantilever">Cantilever</SelectItem>
              <SelectItem value="fixed">Fixed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Support positions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="leftSupportPosition">Left Support Position (m)</Label>
          <Input
            id="leftSupportPosition"
            name="leftSupportPosition"
            type="number"
            value={parameters.leftSupportPosition || 0}
            onChange={onInputChange}
            min={0}
            max={parameters.length}
            step={0.1}
          />
        </div>
        
        {parameters.beamType !== 'cantilever' && (
          <div className="space-y-2">
            <Label htmlFor="rightSupportPosition">Right Support Position (m)</Label>
            <Input
              id="rightSupportPosition"
              name="rightSupportPosition"
              type="number" 
              value={parameters.rightSupportPosition || parameters.length}
              onChange={onInputChange}
              min={parameters.leftSupportPosition || 0}
              max={parameters.length}
              step={0.1}
            />
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="elasticModulus">Elastic Modulus, E (MPa)</Label>
          <Input
            id="elasticModulus"
            name="elasticModulus"
            type="number"
            value={parameters.elasticModulus}
            onChange={onInputChange}
            min={100}
            step={1000}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="momentOfInertia">Moment of Inertia, I (mm⁴)</Label>
          <Input
            id="momentOfInertia"
            name="momentOfInertia"
            type="number"
            value={parameters.momentOfInertia}
            onChange={onInputChange}
            min={10000}
            step={1000000}
          />
        </div>
      </div>
    </div>
  );
};

export default BeamParametersInput;
