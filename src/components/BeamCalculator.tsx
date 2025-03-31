
import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import HomeButton from './HomeButton';

interface BeamParameters {
  length: number;
  elasticModulus: number;
  momentOfInertia: number;
  beamType: string;
  loadType: string;
  loadMagnitude: number;
  loadPosition: number;
  loadLength?: number;
}

interface CalculationResults {
  maxDeflection: number;
  maxSlope: number;
  steps: Array<{title: string, description: string, formula?: string, result?: string}>;
}

const BeamCalculator: React.FC = () => {
  const [parameters, setParameters] = useState<BeamParameters>({
    length: 5,
    elasticModulus: 200000,
    momentOfInertia: 4 * Math.pow(10, -5),
    beamType: 'simply-supported',
    loadType: 'point-load',
    loadMagnitude: 10000,
    loadPosition: 2.5,
    loadLength: 0
  });
  
  const [results, setResults] = useState<CalculationResults | null>(null);
  const [activeTab, setActiveTab] = useState('parameters');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setParameters({
      ...parameters,
      [name]: parseFloat(value) || 0
    });
  };

  const handleSelectChange = (name: string, value: string) => {
    setParameters({
      ...parameters,
      [name]: value
    });
  };

  const calculateSimplySupported = (params: BeamParameters): CalculationResults => {
    const { length, elasticModulus, momentOfInertia, loadMagnitude, loadPosition } = params;
    const EI = elasticModulus * momentOfInertia;
    
    let maxDeflection = 0;
    let maxSlope = 0;
    let steps: Array<{title: string, description: string, formula?: string, result?: string}> = [];
    
    if (params.loadType === 'point-load') {
      const a = loadPosition;
      const b = length - a;
      
      // Calculate max deflection for point load
      maxDeflection = (loadMagnitude * a * b * Math.sqrt(3)) / (27 * EI * length);
      maxSlope = (loadMagnitude * a * b) / (6 * EI * length);
      
      steps = [
        {
          title: "Step 1: Calculate Reaction Forces",
          description: "Determine the reaction forces at the supports using equilibrium equations.",
          formula: "R₁ = P × b/L, R₂ = P × a/L",
          result: `R₁ = ${(loadMagnitude * b / length).toFixed(2)} N, R₂ = ${(loadMagnitude * a / length).toFixed(2)} N`
        },
        {
          title: "Step 2: Determine Bending Moment Diagram",
          description: "Calculate the bending moment equation for the real beam.",
          formula: "M(x) = R₁×x for 0≤x≤a, M(x) = R₁×x - P×(x-a) for a≤x≤L",
          result: "Bending moment diagram created"
        },
        {
          title: "Step 3: Construct Conjugate Beam",
          description: "Create a conjugate beam with the same length and convert supports accordingly. Simply supported beam remains simply supported in conjugate beam.",
          result: "Conjugate beam constructed"
        },
        {
          title: "Step 4: Apply M/EI as Load on Conjugate Beam",
          description: "The bending moment diagram divided by EI becomes the loading on the conjugate beam.",
          formula: "w_c(x) = M(x)/EI",
          result: "Conjugate beam loaded with M/EI"
        },
        {
          title: "Step 5: Calculate Slope and Deflection",
          description: "Calculate the maximum slope and deflection using conjugate beam theorems.",
          formula: "δ_max = (P×a×b×√3)/(27×EI×L), θ_max = (P×a×b)/(6×EI×L)",
          result: `Maximum deflection = ${maxDeflection.toExponential(4)} m, Maximum slope = ${maxSlope.toExponential(4)} rad`
        }
      ];
    } else if (params.loadType === 'uniform-load') {
      // Calculate max deflection for uniform load
      maxDeflection = (5 * loadMagnitude * Math.pow(length, 4)) / (384 * EI);
      maxSlope = (loadMagnitude * Math.pow(length, 3)) / (24 * EI);
      
      steps = [
        {
          title: "Step 1: Calculate Reaction Forces",
          description: "For uniform load, reactions are equal at both supports.",
          formula: "R₁ = R₂ = wL/2",
          result: `R₁ = R₂ = ${(loadMagnitude * length / 2).toFixed(2)} N`
        },
        {
          title: "Step 2: Determine Bending Moment Diagram",
          description: "Calculate the bending moment equation for the real beam under uniform load.",
          formula: "M(x) = (wL/2)×x - (w×x²)/2 for 0≤x≤L",
          result: "Bending moment diagram created"
        },
        {
          title: "Step 3: Construct Conjugate Beam",
          description: "Create a conjugate beam with the same length. Simply supported beam remains simply supported in conjugate beam.",
          result: "Conjugate beam constructed"
        },
        {
          title: "Step 4: Apply M/EI as Load on Conjugate Beam",
          description: "The bending moment diagram divided by EI becomes the loading on the conjugate beam.",
          formula: "w_c(x) = M(x)/EI",
          result: "Conjugate beam loaded with M/EI"
        },
        {
          title: "Step 5: Calculate Slope and Deflection",
          description: "Calculate the maximum slope and deflection using conjugate beam theorems.",
          formula: "δ_max = (5wL⁴)/(384EI), θ_max = (wL³)/(24EI)",
          result: `Maximum deflection = ${maxDeflection.toExponential(4)} m, Maximum slope = ${maxSlope.toExponential(4)} rad`
        }
      ];
    }
    
    return {
      maxDeflection,
      maxSlope,
      steps
    };
  };

  const calculateCantilever = (params: BeamParameters): CalculationResults => {
    const { length, elasticModulus, momentOfInertia, loadMagnitude, loadPosition } = params;
    const EI = elasticModulus * momentOfInertia;
    
    let maxDeflection = 0;
    let maxSlope = 0;
    let steps: Array<{title: string, description: string, formula?: string, result?: string}> = [];
    
    if (params.loadType === 'point-load') {
      // For cantilever with point load at the end
      if (loadPosition === length) {
        maxDeflection = (loadMagnitude * Math.pow(length, 3)) / (3 * EI);
        maxSlope = (loadMagnitude * Math.pow(length, 2)) / (2 * EI);
      } else {
        // For point load at arbitrary position
        const a = loadPosition;
        maxDeflection = (loadMagnitude * Math.pow(a, 2) * (3 * length - a)) / (6 * EI);
        maxSlope = (loadMagnitude * a * (2 * length - a)) / (2 * EI);
      }
      
      steps = [
        {
          title: "Step 1: Calculate Reaction Forces",
          description: "For a cantilever beam with a point load, calculate the reaction force and moment at the fixed end.",
          formula: "R = P, M = P×a",
          result: `R = ${loadMagnitude.toFixed(2)} N, M = ${(loadMagnitude * loadPosition).toFixed(2)} N·m`
        },
        {
          title: "Step 2: Determine Bending Moment Diagram",
          description: "Calculate the bending moment equation for the real beam.",
          formula: "M(x) = P(a-x) for 0≤x≤a, M(x) = 0 for a≤x≤L",
          result: "Bending moment diagram created"
        },
        {
          title: "Step 3: Construct Conjugate Beam",
          description: "Create a conjugate beam where the fixed end becomes free and free end becomes fixed.",
          result: "Conjugate beam constructed"
        },
        {
          title: "Step 4: Apply M/EI as Load on Conjugate Beam",
          description: "The bending moment diagram divided by EI becomes the loading on the conjugate beam.",
          formula: "w_c(x) = M(x)/EI",
          result: "Conjugate beam loaded with M/EI"
        },
        {
          title: "Step 5: Calculate Slope and Deflection",
          description: "Calculate the maximum slope and deflection using conjugate beam theorems.",
          formula: loadPosition === length ? 
            "δ_max = (PL³)/(3EI), θ_max = (PL²)/(2EI)" : 
            "δ_max = (Pa²(3L-a))/(6EI), θ_max = (Pa(2L-a))/(2EI)",
          result: `Maximum deflection = ${maxDeflection.toExponential(4)} m, Maximum slope = ${maxSlope.toExponential(4)} rad`
        }
      ];
    } else if (params.loadType === 'uniform-load') {
      // Calculate max deflection for uniform load on cantilever
      maxDeflection = (loadMagnitude * Math.pow(length, 4)) / (8 * EI);
      maxSlope = (loadMagnitude * Math.pow(length, 3)) / (6 * EI);
      
      steps = [
        {
          title: "Step 1: Calculate Reaction Forces",
          description: "For a cantilever beam with uniform load, calculate the reaction force and moment at the fixed end.",
          formula: "R = wL, M = wL²/2",
          result: `R = ${(loadMagnitude * length).toFixed(2)} N, M = ${(loadMagnitude * Math.pow(length, 2) / 2).toFixed(2)} N·m`
        },
        {
          title: "Step 2: Determine Bending Moment Diagram",
          description: "Calculate the bending moment equation for the real beam under uniform load.",
          formula: "M(x) = w(L-x)²/2 for 0≤x≤L",
          result: "Bending moment diagram created"
        },
        {
          title: "Step 3: Construct Conjugate Beam",
          description: "Create a conjugate beam where the fixed end becomes free and free end becomes fixed.",
          result: "Conjugate beam constructed"
        },
        {
          title: "Step 4: Apply M/EI as Load on Conjugate Beam",
          description: "The bending moment diagram divided by EI becomes the loading on the conjugate beam.",
          formula: "w_c(x) = M(x)/EI",
          result: "Conjugate beam loaded with M/EI"
        },
        {
          title: "Step 5: Calculate Slope and Deflection",
          description: "Calculate the maximum slope and deflection using conjugate beam theorems.",
          formula: "δ_max = (wL⁴)/(8EI), θ_max = (wL³)/(6EI)",
          result: `Maximum deflection = ${maxDeflection.toExponential(4)} m, Maximum slope = ${maxSlope.toExponential(4)} rad`
        }
      ];
    }
    
    return {
      maxDeflection,
      maxSlope,
      steps
    };
  };

  const handleCalculate = () => {
    try {
      let result: CalculationResults;
      
      if (parameters.beamType === 'simply-supported') {
        result = calculateSimplySupported(parameters);
      } else if (parameters.beamType === 'cantilever') {
        result = calculateCantilever(parameters);
      } else {
        // Default to simply supported if not specified
        result = calculateSimplySupported(parameters);
      }
      
      setResults(result);
      setActiveTab('results');
      toast.success("Calculations completed successfully!");
    } catch (error) {
      console.error("Calculation error:", error);
      toast.error("An error occurred during calculation. Please check your inputs.");
    }
  };

  const handleReset = () => {
    setParameters({
      length: 5,
      elasticModulus: 200000,
      momentOfInertia: 4 * Math.pow(10, -5),
      beamType: 'simply-supported',
      loadType: 'point-load',
      loadMagnitude: 10000,
      loadPosition: 2.5,
      loadLength: 0
    });
    setResults(null);
    setActiveTab('parameters');
    toast.info("Calculator reset to default values");
  };

  return (
    <div className="min-h-screen p-6 flex flex-col items-center justify-center">
      <HomeButton />
      
      <div className="w-full max-w-4xl calculator-container">
        <h1 className="text-2xl font-bold text-center mb-6 text-beamcee-pink">Beam Deflection Calculator</h1>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="parameters">Parameters</TabsTrigger>
            <TabsTrigger value="results" disabled={!results}>Results</TabsTrigger>
          </TabsList>
          
          <TabsContent value="parameters" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="input-group">
                  <Label htmlFor="beamType">Beam Type</Label>
                  <Select 
                    value={parameters.beamType} 
                    onValueChange={(value) => handleSelectChange('beamType', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select beam type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="simply-supported">Simply Supported</SelectItem>
                      <SelectItem value="cantilever">Cantilever</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="input-group">
                  <Label htmlFor="length">Beam Length (m)</Label>
                  <Input 
                    id="length" 
                    name="length" 
                    type="number" 
                    value={parameters.length} 
                    onChange={handleInputChange} 
                    step="0.1"
                    min="0.1"
                  />
                </div>
                
                <div className="input-group">
                  <Label htmlFor="elasticModulus">Young's Modulus, E (N/m²)</Label>
                  <Input 
                    id="elasticModulus" 
                    name="elasticModulus" 
                    type="number" 
                    value={parameters.elasticModulus} 
                    onChange={handleInputChange}
                    min="1"
                  />
                </div>
                
                <div className="input-group">
                  <Label htmlFor="momentOfInertia">Moment of Inertia, I (m⁴)</Label>
                  <Input 
                    id="momentOfInertia" 
                    name="momentOfInertia" 
                    type="number" 
                    value={parameters.momentOfInertia} 
                    onChange={handleInputChange}
                    step="0.000001"
                    min="0.000001"
                  />
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="input-group">
                  <Label htmlFor="loadType">Load Type</Label>
                  <Select 
                    value={parameters.loadType} 
                    onValueChange={(value) => handleSelectChange('loadType', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select load type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="point-load">Point Load</SelectItem>
                      <SelectItem value="uniform-load">Uniform Load</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="input-group">
                  <Label htmlFor="loadMagnitude">
                    {parameters.loadType === 'point-load' ? 'Load Magnitude (N)' : 'Load Intensity (N/m)'}
                  </Label>
                  <Input 
                    id="loadMagnitude" 
                    name="loadMagnitude" 
                    type="number" 
                    value={parameters.loadMagnitude} 
                    onChange={handleInputChange}
                    min="0"
                  />
                </div>
                
                {parameters.loadType === 'point-load' && (
                  <div className="input-group">
                    <Label htmlFor="loadPosition">Load Position from Left Support (m)</Label>
                    <Input 
                      id="loadPosition" 
                      name="loadPosition" 
                      type="number" 
                      value={parameters.loadPosition} 
                      onChange={handleInputChange}
                      min="0"
                      max={parameters.length}
                      step="0.1"
                    />
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex justify-center mt-6 space-x-4">
              <Button className="beamcee-btn" onClick={handleCalculate}>
                Calculate
              </Button>
              <Button variant="outline" onClick={handleReset}>
                Reset
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="results">
            {results && (
              <div className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-gray-50 rounded-lg">
                  <div className="p-4 border rounded-lg bg-white">
                    <h3 className="text-lg font-medium text-gray-700">Maximum Deflection</h3>
                    <p className="text-2xl font-bold text-beamcee-pink mt-2">
                      {results.maxDeflection.toExponential(4)} m
                    </p>
                  </div>
                  
                  <div className="p-4 border rounded-lg bg-white">
                    <h3 className="text-lg font-medium text-gray-700">Maximum Slope</h3>
                    <p className="text-2xl font-bold text-beamcee-pink mt-2">
                      {results.maxSlope.toExponential(4)} rad
                    </p>
                  </div>
                </div>
                
                <div className="mt-8">
                  <h3 className="text-xl font-bold mb-4">Step-by-Step Solution</h3>
                  <div className="space-y-4">
                    {results.steps.map((step, index) => (
                      <div key={index} className="p-4 border rounded-lg bg-white">
                        <h4 className="text-lg font-medium text-beamcee-pink">{step.title}</h4>
                        <p className="text-gray-700 mt-2">{step.description}</p>
                        
                        {step.formula && (
                          <div className="mt-2 p-2 bg-gray-50 rounded font-mono text-sm">
                            {step.formula}
                          </div>
                        )}
                        
                        {step.result && (
                          <div className="mt-2 font-medium">
                            Result: {step.result}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="flex justify-center mt-6">
                  <Button className="beamcee-btn" onClick={() => setActiveTab('parameters')}>
                    Modify Parameters
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default BeamCalculator;
