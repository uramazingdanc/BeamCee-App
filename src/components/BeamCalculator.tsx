import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import HomeButton from './HomeButton';
import { Save } from 'lucide-react';
import BeamVisualization from './BeamVisualization';
import { BeamParameters, CalculationResults } from '../types/beam';
import BeamParametersInput from './BeamParametersInput';
import LoadInputs from './LoadInputs';
import ResultsDisplay from './CalculationResults';
import { performCalculations } from '../utils/beamCalculations';

const BeamCalculator: React.FC = () => {
  const [parameters, setParameters] = useState<BeamParameters>({
    length: 5,
    elasticModulus: 200000, // MPa
    momentOfInertia: 40000000, // mm⁴ (4 * 10^7)
    beamType: 'simply-supported',
    leftSupportPosition: 0,
    rightSupportPosition: 5,
    loads: [
      { 
        id: crypto.randomUUID(), 
        type: 'point-load', 
        magnitude: 10, // kN
        position: 2.5 // m
      }
    ]
  });
  
  const [results, setResults] = useState<CalculationResults | null>(null);
  const [activeTab, setActiveTab] = useState('parameters');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (name === 'leftSupportPosition') {
      const leftPos = parseFloat(value) || 0;
      const rightPos = parameters.rightSupportPosition || parameters.length;
      
      if (leftPos >= rightPos) {
        toast.error("Left support must be before right support");
        return;
      }
      
      setParameters({
        ...parameters,
        leftSupportPosition: leftPos
      });
      return;
    }
    
    if (name === 'rightSupportPosition') {
      const rightPos = parseFloat(value) || parameters.length;
      const leftPos = parameters.leftSupportPosition || 0;
      
      if (rightPos <= leftPos) {
        toast.error("Right support must be after left support");
        return;
      }
      
      setParameters({
        ...parameters,
        rightSupportPosition: rightPos
      });
      return;
    }
    
    setParameters({
      ...parameters,
      [name]: parseFloat(value) || 0
    });
  };

  const handleSelectChange = (name: string, value: string) => {
    if (name === 'beamType') {
      if (value === 'cantilever') {
        setParameters({
          ...parameters,
          beamType: value,
          leftSupportPosition: 0,
          rightSupportPosition: undefined
        });
      } else if (value === 'simply-supported' || value === 'fixed') {
        setParameters({
          ...parameters,
          beamType: value,
          leftSupportPosition: 0,
          rightSupportPosition: parameters.length
        });
      }
    } else {
      setParameters({
        ...parameters,
        [name]: value
      });
    }
  };

  const handleLoadChange = (id: string, field: string, value: string | number) => {
    setParameters({
      ...parameters,
      loads: parameters.loads.map(load => {
        if (load.id === id) {
          const parsedValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
          
          if (field === 'type') {
            if (value === 'point-load') {
              return {
                ...load,
                type: 'point-load',
                magnitude: load.magnitude,
                position: parameters.length / 2,
                startPosition: undefined,
                endPosition: undefined
              };
            } else if (value === 'uniform-load' || value === 'triangular-load') {
              return {
                ...load,
                type: value.toString(),
                magnitude: load.magnitude,
                position: undefined,
                startPosition: 0,
                endPosition: parameters.length
              };
            }
          }
          
          return { ...load, [field]: parsedValue };
        }
        return load;
      })
    });
  };

  const addLoad = () => {
    const newLoad = { 
      id: crypto.randomUUID(), 
      type: 'point-load', 
      magnitude: 10, // kN
      position: parameters.length / 2 
    };
    
    setParameters({
      ...parameters,
      loads: [...parameters.loads, newLoad]
    });
  };

  const removeLoad = (id: string) => {
    if (parameters.loads.length <= 1) {
      toast.error("At least one load is required");
      return;
    }
    
    setParameters({
      ...parameters,
      loads: parameters.loads.filter(load => load.id !== id)
    });
  };

  const validateInputs = (): boolean => {
    if (parameters.length <= 0) {
      toast.error("Beam length must be greater than 0");
      return false;
    }
    
    if (parameters.elasticModulus <= 0) {
      toast.error("Elastic modulus must be greater than 0");
      return false;
    }
    
    if (parameters.momentOfInertia <= 0) {
      toast.error("Moment of inertia must be greater than 0");
      return false;
    }
    
    if (parameters.leftSupportPosition !== undefined && parameters.rightSupportPosition !== undefined) {
      if (parameters.leftSupportPosition >= parameters.rightSupportPosition) {
        toast.error("Left support must be before right support");
        return false;
      }
    }
    
    for (const load of parameters.loads) {
      if (load.magnitude <= 0) {
        toast.error("Load magnitude must be greater than 0");
        return false;
      }
      
      if (load.type === 'point-load') {
        if (load.position === undefined || load.position < 0 || load.position > parameters.length) {
          toast.error("Load position must be between 0 and beam length");
          return false;
        }
      } else if (load.type === 'uniform-load' || load.type === 'triangular-load') {
        if (
          load.startPosition === undefined || 
          load.endPosition === undefined || 
          load.startPosition < 0 || 
          load.endPosition > parameters.length ||
          load.startPosition >= load.endPosition
        ) {
          toast.error("Load start and end positions must be valid");
          return false;
        }
      }
    }
    
    return true;
  };

  const handleCalculate = () => {
    if (!validateInputs()) return;
    
    try {
      const calculationResults = performCalculations(parameters);
      setResults(calculationResults);
      setActiveTab('results');
      toast.success("Calculation completed successfully");
    } catch (error) {
      console.error("Calculation error:", error);
      toast.error("Error performing calculations");
    }
  };

  const handleSaveResults = () => {
    if (!results) {
      toast.error("No results to save");
      return;
    }
    
    const output = {
      parameters,
      results
    };
    
    const dataStr = JSON.stringify(output, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'beam_calculation_results.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    toast.success("Results saved successfully");
  };

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Beam Calculator</h1>
        <HomeButton />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full">
              <TabsTrigger value="parameters" className="flex-1">Parameters</TabsTrigger>
              <TabsTrigger value="loads" className="flex-1">Loads</TabsTrigger>
              <TabsTrigger value="results" className="flex-1">Results</TabsTrigger>
            </TabsList>
            
            <TabsContent value="parameters" className="pt-4">
              <BeamParametersInput 
                parameters={parameters}
                onInputChange={handleInputChange}
                onSelectChange={handleSelectChange}
              />
            </TabsContent>
            
            <TabsContent value="loads" className="pt-4">
              <LoadInputs 
                parameters={parameters}
                onLoadChange={handleLoadChange}
                onAddLoad={addLoad}
                onRemoveLoad={removeLoad}
              />
            </TabsContent>
            
            <TabsContent value="results" className="pt-4">
              <ResultsDisplay results={results} />
            </TabsContent>
          </Tabs>
          
          <div className="flex gap-3">
            <Button onClick={handleCalculate} className="flex-1">Calculate</Button>
            <Button 
              onClick={handleSaveResults} 
              variant="outline" 
              disabled={!results}
              className="flex items-center"
            >
              <Save className="mr-2 h-4 w-4" />
              Save Results
            </Button>
          </div>
        </div>
        
        <div className="border rounded-lg p-4 bg-white">
          <h2 className="text-lg font-medium mb-4">Beam Visualization</h2>
          <BeamVisualization 
            beamLength={parameters.length}
            beamType={parameters.beamType}
            loads={parameters.loads}
            deflectionPoints={results?.deflectionPoints || []}
            leftSupportPosition={parameters.leftSupportPosition}
            rightSupportPosition={parameters.rightSupportPosition}
          />
        </div>
      </div>
    </div>
  );
};

export default BeamCalculator;
