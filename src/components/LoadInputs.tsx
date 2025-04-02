
import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, MinusCircle } from 'lucide-react';
import { BeamParameters, Load } from '../types/beam';

interface LoadInputsProps {
  parameters: BeamParameters;
  onLoadChange: (id: string, field: string, value: string | number) => void;
  onAddLoad: () => void;
  onRemoveLoad: (id: string) => void;
}

const LoadInputs: React.FC<LoadInputsProps> = ({
  parameters,
  onLoadChange,
  onAddLoad,
  onRemoveLoad
}) => {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Loads</h3>
        <Button onClick={onAddLoad} type="button" size="sm" variant="outline">
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Load
        </Button>
      </div>
      
      {parameters.loads.map((load, index) => (
        <div key={load.id} className="p-4 border rounded-md space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="font-medium">Load {index + 1}</h4>
            <Button 
              onClick={() => onRemoveLoad(load.id)} 
              type="button" 
              size="sm" 
              variant="outline"
            >
              <MinusCircle className="mr-2 h-4 w-4" />
              Remove
            </Button>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor={`load-type-${load.id}`}>Load Type</Label>
            <Select 
              value={load.type} 
              onValueChange={(value) => onLoadChange(load.id, 'type', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select load type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="point-load">Point Load</SelectItem>
                <SelectItem value="uniform-load">Uniform Load</SelectItem>
                <SelectItem value="triangular-load">Triangular Load</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor={`load-magnitude-${load.id}`}>
              {load.type === 'point-load' ? 'Magnitude (kN)' : 'Magnitude (kN/m)'}
            </Label>
            <Input 
              id={`load-magnitude-${load.id}`}
              type="number" 
              value={load.magnitude}
              onChange={(e) => onLoadChange(load.id, 'magnitude', e.target.value)}
              min={0}
              step={0.1}
            />
          </div>
          
          {load.type === 'point-load' && (
            <div className="space-y-2">
              <Label htmlFor={`load-position-${load.id}`}>Position (m)</Label>
              <Input 
                id={`load-position-${load.id}`}
                type="number" 
                value={load.position}
                onChange={(e) => onLoadChange(load.id, 'position', e.target.value)}
                min={0}
                max={parameters.length}
                step={0.1}
              />
            </div>
          )}
          
          {(load.type === 'uniform-load' || load.type === 'triangular-load') && (
            <>
              <div className="space-y-2">
                <Label htmlFor={`load-start-${load.id}`}>Start Position (m)</Label>
                <Input 
                  id={`load-start-${load.id}`}
                  type="number" 
                  value={load.startPosition}
                  onChange={(e) => onLoadChange(load.id, 'startPosition', e.target.value)}
                  min={0}
                  max={parameters.length}
                  step={0.1}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor={`load-end-${load.id}`}>End Position (m)</Label>
                <Input 
                  id={`load-end-${load.id}`}
                  type="number" 
                  value={load.endPosition}
                  onChange={(e) => onLoadChange(load.id, 'endPosition', e.target.value)}
                  min={0}
                  max={parameters.length}
                  step={0.1}
                />
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
};

export default LoadInputs;
