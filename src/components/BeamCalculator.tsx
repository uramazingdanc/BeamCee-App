import React, { useState, useRef, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import HomeButton from './HomeButton';
import { PlusCircle, MinusCircle, Save } from 'lucide-react';
import BeamVisualization from './BeamVisualization';

interface Load {
  id: string;
  type: string;
  magnitude: number;
  position?: number;
  startPosition?: number;
  endPosition?: number;
}

interface BeamParameters {
  length: number;
  elasticModulus: number;
  momentOfInertia: number;
  beamType: string;
  loads: Load[];
}

interface CalculationResults {
  maxDeflection: number;
  maxSlope: number;
  steps: Array<{title: string, description: string, formula?: string, result?: string}>;
  deflectionPoints: Array<{x: number, y: number}>;
  slopePoints: Array<{x: number, y: number}>;
}

const BeamCalculator: React.FC = () => {
  const [parameters, setParameters] = useState<BeamParameters>({
    length: 5,
    elasticModulus: 200000,
    momentOfInertia: 4 * Math.pow(10, -5),
    beamType: 'simply-supported',
    loads: [
      { 
        id: crypto.randomUUID(), 
        type: 'point-load', 
        magnitude: 10000, 
        position: 2.5 
      }
    ]
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

  const handleLoadChange = (id: string, field: string, value: string | number) => {
    setParameters({
      ...parameters,
      loads: parameters.loads.map(load => 
        load.id === id ? { ...load, [field]: typeof value === 'string' ? parseFloat(value) || 0 : value } : load
      )
    });
  };

  const addLoad = () => {
    const newLoad: Load = { 
      id: crypto.randomUUID(), 
      type: 'point-load', 
      magnitude: 10000, 
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

  const calculateReactions = (params: BeamParameters, loadIndex: number): { R1: number, R2: number, M1?: number } => {
    const { length, beamType, loads } = params;
    const load = loads[loadIndex];
    
    if (beamType === 'simply-supported') {
      if (load.type === 'point-load' && load.position !== undefined) {
        const a = load.position;
        const b = length - a;
        const R1 = (load.magnitude * b) / length;
        const R2 = (load.magnitude * a) / length;
        return { R1, R2 };
      } else if (load.type === 'uniform-load') {
        const startPos = load.startPosition || 0;
        const endPos = load.endPosition || length;
        const loadLength = endPos - startPos;
        const loadCenter = startPos + loadLength / 2;
        
        // For uniform load over a segment
        const totalLoad = load.magnitude * loadLength;
        const R1 = totalLoad * (length - loadCenter) / length;
        const R2 = totalLoad * loadCenter / length;
        return { R1, R2 };
      }
    } else if (beamType === 'cantilever') {
      if (load.type === 'point-load' && load.position !== undefined) {
        const R1 = load.magnitude;
        const M1 = load.magnitude * load.position;
        return { R1, R2: 0, M1 };
      } else if (load.type === 'uniform-load') {
        const startPos = load.startPosition || 0;
        const endPos = load.endPosition || length;
        const loadLength = endPos - startPos;
        const loadCenter = startPos + loadLength / 2;
        
        // For uniform load over a segment
        const totalLoad = load.magnitude * loadLength;
        const R1 = totalLoad;
        const M1 = totalLoad * loadCenter;
        return { R1, R2: 0, M1 };
      }
    }
    
    // Default case
    return { R1: 0, R2: 0 };
  };

  const calculateTotalReactions = (params: BeamParameters): { R1: number, R2: number, M1?: number } => {
    const totalReactions = { R1: 0, R2: 0, M1: 0 };
    
    params.loads.forEach((_, index) => {
      const reactions = calculateReactions(params, index);
      totalReactions.R1 += reactions.R1;
      totalReactions.R2 += reactions.R2;
      totalReactions.M1 = (totalReactions.M1 || 0) + (reactions.M1 || 0);
    });
    
    return totalReactions;
  };

  const calculateBendingMoment = (params: BeamParameters, x: number): number => {
    const { beamType, loads } = params;
    let totalMoment = 0;
    
    if (beamType === 'simply-supported') {
      const { R1 } = calculateTotalReactions(params);
      
      // Moment contribution from reaction R1
      totalMoment += R1 * x;
      
      // Moment contributions from each load
      for (const load of loads) {
        if (load.type === 'point-load' && load.position !== undefined) {
          if (x > load.position) {
            totalMoment -= load.magnitude * (x - load.position);
          }
        } else if (load.type === 'uniform-load') {
          const startPos = load.startPosition || 0;
          const endPos = load.endPosition || params.length;
          
          if (x >= startPos) {
            const w = load.magnitude;
            if (x <= endPos) {
              // Portion of distributed load up to x
              const loadLength = x - startPos;
              totalMoment -= w * loadLength * loadLength / 2;
            } else {
              // Full distributed load contribution
              const loadLength = endPos - startPos;
              const loadCenter = startPos + loadLength / 2;
              totalMoment -= w * loadLength * (x - loadCenter);
            }
          }
        }
      }
    } else if (beamType === 'cantilever') {
      // For cantilever, moment contributions from each load
      for (const load of loads) {
        if (load.type === 'point-load' && load.position !== undefined) {
          if (x <= load.position) {
            totalMoment += load.magnitude * (load.position - x);
          }
        } else if (load.type === 'uniform-load') {
          const startPos = load.startPosition || 0;
          const endPos = load.endPosition || params.length;
          
          if (x <= endPos) {
            const w = load.magnitude;
            if (x <= startPos) {
              // Full distributed load contribution
              const loadLength = endPos - startPos;
              const loadCenter = startPos + loadLength / 2;
              totalMoment += w * loadLength * (loadCenter - x);
            } else {
              // Partial distributed load from x to endPos
              const loadLength = endPos - x;
              totalMoment += w * loadLength * loadLength / 2;
            }
          }
        }
      }
    }
    
    return totalMoment;
  };

  const calculateDeflectionPoints = (params: BeamParameters): Array<{x: number, y: number}> => {
    const { length, elasticModulus, momentOfInertia } = params;
    const numPoints = 100;
    const EI = elasticModulus * momentOfInertia;
    const points: Array<{x: number, y: number}> = [];
    
    for (let i = 0; i <= numPoints; i++) {
      const x = (i / numPoints) * length;
      const moment = calculateBendingMoment(params, x);
      const deflection = calculateDeflectionAt(params, x);
      points.push({ x, y: deflection });
    }
    
    return points;
  };

  const calculateSlopePoints = (params: BeamParameters): Array<{x: number, y: number}> => {
    const { length } = params;
    const numPoints = 100;
    const points: Array<{x: number, y: number}> = [];
    
    for (let i = 0; i <= numPoints; i++) {
      const x = (i / numPoints) * length;
      const slope = calculateSlopeAt(params, x);
      points.push({ x, y: slope });
    }
    
    return points;
  };

  const calculateDeflectionAt = (params: BeamParameters, position: number): number => {
    const { beamType, elasticModulus, momentOfInertia, length, loads } = params;
    const EI = elasticModulus * momentOfInertia;
    let totalDeflection = 0;
    
    if (beamType === 'simply-supported') {
      for (const load of loads) {
        if (load.type === 'point-load' && load.position !== undefined) {
          const a = load.position;
          const L = length;
          
          if (position <= a) {
            // Deflection formula for x ≤ a in a simply supported beam with point load
            totalDeflection += (load.magnitude * a * position * (L*L - a*a - position*position)) / (6 * EI * L);
          } else {
            // Deflection formula for x > a in a simply supported beam with point load
            totalDeflection += (load.magnitude * position * (L - position) * (L + position - 2*a)) / (6 * EI * L);
          }
        } else if (load.type === 'uniform-load') {
          const startPos = load.startPosition || 0;
          const endPos = load.endPosition || length;
          const w = load.magnitude;
          const L = length;
          
          // For uniform distributed load over a segment, more complex calculation
          // This is a simplified approximation
          if (endPos - startPos >= length) {
            // Full uniform load
            totalDeflection += (w * position * (L*L*L - 2*L*position*position + position*position*position)) / (24 * EI * L);
          } else {
            // Partial uniform load - more complex calculation would be needed
            // Simplified approach: treat as equivalent point load at center of distributed load
            const loadLength = endPos - startPos;
            const loadCenter = startPos + loadLength / 2;
            const equivalentPointLoad = w * loadLength;
            
            if (position <= loadCenter) {
              totalDeflection += (equivalentPointLoad * loadCenter * position * (L*L - loadCenter*loadCenter - position*position)) / (6 * EI * L);
            } else {
              totalDeflection += (equivalentPointLoad * position * (L - position) * (L + position - 2*loadCenter)) / (6 * EI * L);
            }
          }
        }
      }
    } else if (beamType === 'cantilever') {
      for (const load of loads) {
        if (load.type === 'point-load' && load.position !== undefined) {
          const a = load.position;
          const L = length;
          
          if (position <= a) {
            // Deflection formula for cantilever with point load (x ≤ a)
            totalDeflection += (load.magnitude * position * position * (3*a - position)) / (6 * EI);
          } else {
            // Deflection formula for cantilever with point load (x > a)
            totalDeflection += (load.magnitude * a * a * (3*position - a)) / (6 * EI);
          }
        } else if (load.type === 'uniform-load') {
          const startPos = load.startPosition || 0;
          const endPos = load.endPosition || length;
          const w = load.magnitude;
          
          if (endPos - startPos >= length) {
            // Full uniform load
            totalDeflection += (w * position * position * (6*length*length - 4*length*position + position*position)) / (24 * EI);
          } else {
            // Partial uniform load - simplified approach
            const loadLength = endPos - startPos;
            const loadCenter = startPos + loadLength / 2;
            const equivalentPointLoad = w * loadLength;
            
            if (position <= loadCenter) {
              totalDeflection += (equivalentPointLoad * position * position * (3*loadCenter - position)) / (6 * EI);
            } else {
              totalDeflection += (equivalentPointLoad * loadCenter * loadCenter * (3*position - loadCenter)) / (6 * EI);
            }
          }
        }
      }
    }
    
    return totalDeflection;
  };

  const calculateSlopeAt = (params: BeamParameters, position: number): number => {
    const { beamType, elasticModulus, momentOfInertia, length, loads } = params;
    const EI = elasticModulus * momentOfInertia;
    let totalSlope = 0;
    
    if (beamType === 'simply-supported') {
      for (const load of loads) {
        if (load.type === 'point-load' && load.position !== undefined) {
          const a = load.position;
          const L = length;
          
          if (position <= a) {
            // Slope formula for x ≤ a in a simply supported beam with point load
            totalSlope += (load.magnitude * a * (L*L - position*position - a*a)) / (6 * EI * L);
          } else {
            // Slope formula for x > a in a simply supported beam with point load
            totalSlope += (load.magnitude * (L - position) * (L - position + a - L)) / (6 * EI * L);
          }
        } else if (load.type === 'uniform-load') {
          const startPos = load.startPosition || 0;
          const endPos = load.endPosition || length;
          const w = load.magnitude;
          const L = length;
          
          // For uniform distributed load over a segment
          // Simplified approach using equivalent point load
          const loadLength = endPos - startPos;
          const loadCenter = startPos + loadLength / 2;
          const equivalentPointLoad = w * loadLength;
          
          if (position <= loadCenter) {
            totalSlope += (equivalentPointLoad * loadCenter * (L*L - position*position - loadCenter*loadCenter)) / (6 * EI * L);
          } else {
            totalSlope += (equivalentPointLoad * (L - position) * (L - position + loadCenter - L)) / (6 * EI * L);
          }
        }
      }
    } else if (beamType === 'cantilever') {
      for (const load of loads) {
        if (load.type === 'point-load' && load.position !== undefined) {
          const a = load.position;
          
          if (position <= a) {
            // Slope formula for cantilever with point load (x ≤ a)
            totalSlope += (load.magnitude * position * position) / (2 * EI);
          } else {
            // Slope formula for cantilever with point load (x > a)
            totalSlope += (load.magnitude * a * a) / (2 * EI);
          }
        } else if (load.type === 'uniform-load') {
          const startPos = load.startPosition || 0;
          const endPos = load.endPosition || length;
          const w = load.magnitude;
          
          // Simplified approach using equivalent point load
          const loadLength = endPos - startPos;
          const loadCenter = startPos + loadLength / 2;
          const equivalentPointLoad = w * loadLength;
          
          if (position <= loadCenter) {
            totalSlope += (equivalentPointLoad * position * position) / (2 * EI);
          } else {
            totalSlope += (equivalentPointLoad * loadCenter * loadCenter) / (2 * EI);
          }
        }
      }
    }
    
    return totalSlope;
  };

  const findMaxValues = (points: Array<{x: number, y: number}>): {max: number, position: number} => {
    let maxAbs = 0;
    let maxPos = 0;
    
    points.forEach(point => {
      const absValue = Math.abs(point.y);
      if (absValue > maxAbs) {
        maxAbs = absValue;
        maxPos = point.x;
      }
    });
    
    return { max: maxAbs, position: maxPos };
  };

  const generateSteps = (params: BeamParameters, deflectionPoints: Array<{x: number, y: number}>, slopePoints: Array<{x: number, y: number}>): Array<{title: string, description: string, formula?: string, result?: string}> => {
    const { beamType, elasticModulus, momentOfInertia, length, loads } = params;
    const steps: Array<{title: string, description: string, formula?: string, result?: string}> = [];
    const EI = elasticModulus * momentOfInertia;
    const reactions = calculateTotalReactions(params);
    const maxDeflection = findMaxValues(deflectionPoints);
    const maxSlope = findMaxValues(slopePoints);
    
    // Step 1: Calculate Bending Moment Diagram for the Real Beam
    let momentDesc = "Calculate the bending moment diagram (BMD) for the real beam under its given loading conditions.";
    let momentFormula = "M(x) = ∑(F⋅d) where F are forces and d are distances from the section";
    
    if (beamType === 'simply-supported') {
      if (loads.length === 1 && loads[0].type === 'point-load') {
        momentFormula = "M(x) = R₁×x for 0≤x≤a, M(x) = R₁×x - P×(x-a) for a≤x≤L";
      } else if (loads.length === 1 && loads[0].type === 'uniform-load') {
        momentFormula = "M(x) = R₁×x - (w×x²)/2 for 0≤x≤L";
      } else {
        momentFormula = "M(x) = R₁×x - ∑ load contributions";
      }
    } else if (beamType === 'cantilever') {
      if (loads.length === 1 && loads[0].type === 'point-load') {
        momentFormula = "M(x) = P(a-x) for 0≤x≤a, M(x) = 0 for a≤x≤L";
      } else if (loads.length === 1 && loads[0].type === 'uniform-load') {
        momentFormula = "M(x) = w(L-x)²/2 for 0≤x≤L";
      } else {
        momentFormula = "M(x) = ∑ load contributions";
      }
    }
    
    let reactionResult = "";
    if (beamType === 'simply-supported') {
      reactionResult = `R₁ = ${reactions.R1.toFixed(2)} N, R₂ = ${reactions.R2.toFixed(2)} N`;
    } else if (beamType === 'cantilever') {
      reactionResult = `R = ${reactions.R1.toFixed(2)} N, M = ${(reactions.M1 || 0).toFixed(2)} N·m`;
    }
    
    steps.push({
      title: "Step 1: Determine the Real Beam's Bending Moment Diagram (BMD)",
      description: momentDesc,
      formula: momentFormula,
      result: `Reaction forces: ${reactionResult}`
    });
    
    // Step 2: Construct the Conjugate Beam
    let conjugateDesc = "";
    if (beamType === 'simply-supported') {
      conjugateDesc = "Create a conjugate beam with the same length. For a simply supported beam, the supports remain simply supported in the conjugate beam.";
    } else if (beamType === 'cantilever') {
      conjugateDesc = "Create a conjugate beam with the same length. For a cantilever beam, the fixed end becomes free and the free end becomes fixed in the conjugate beam.";
    }
    
    steps.push({
      title: "Step 2: Construct the Conjugate Beam",
      description: conjugateDesc,
      formula: "wc(x) = M(x)/EI where M(x) is the bending moment at x, E is the elastic modulus, and I is the moment of inertia",
      result: "Conjugate beam constructed with M/EI as the loading"
    });
    
    // Step 3: Analyze the Conjugate Beam
    steps.push({
      title: "Step 3: Analyze the Conjugate Beam",
      description: "Treat the conjugate beam as a real beam loaded with the M/EI diagram. Calculate the shear forces and bending moments in the conjugate beam.",
      formula: "Vc(x) = ∑Fc where Fc are the forces on the conjugate beam\nMc(x) = ∑(Fc⋅d) where d are the distances from the section",
      result: "Shear forces and bending moments calculated for the conjugate beam"
    });
    
    // Step 4: Interpret the Results
    steps.push({
      title: "Step 4: Interpret the Results",
      description: "Apply the conjugate beam theorems: The slope at any point in the real beam equals the shear force at that point in the conjugate beam. The deflection equals the bending moment.",
      formula: "Slope: θ(x) = Vc(x)\nDeflection: δ(x) = Mc(x)",
      result: `Maximum deflection = ${maxDeflection.max.toExponential(4)} m at x = ${maxDeflection.position.toFixed(2)} m, Maximum slope = ${maxSlope.max.toExponential(4)} rad at x = ${maxSlope.position.toFixed(2)} m`
    });
    
    return steps;
  };

  const calculateResults = (params: BeamParameters): CalculationResults => {
    const deflectionPoints = calculateDeflectionPoints(params);
    const slopePoints = calculateSlopePoints(params);
    
    const maxDeflectionData = findMaxValues(deflectionPoints);
    const maxSlopeData = findMaxValues(slopePoints);
    
    const steps = generateSteps(params, deflectionPoints, slopePoints);
    
    return {
      maxDeflection: maxDeflectionData.max,
      maxSlope: maxSlopeData.max,
      steps,
      deflectionPoints,
      slopePoints
    };
  };

  const handleCalculate = () => {
    try {
      // Validate load positions
      for (const load of parameters.loads) {
        if (load.type === 'point-load' && (load.position === undefined || load.position < 0 || load.position > parameters.length)) {
          toast.error(`Load position must be between 0 and ${parameters.length}m`);
          return;
        }
        
        if (load.type === 'uniform-load') {
          const start = load.startPosition || 0;
          const end = load.endPosition || parameters.length;
          
          if (start < 0 || end > parameters.length || start >= end) {
            toast.error(`Load range must be valid and within beam length (0 to ${parameters.length}m)`);
            return;
          }
        }
      }
      
      const result = calculateResults(parameters);
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
      loads: [
        { 
          id: crypto.randomUUID(), 
          type: 'point-load', 
          magnitude: 10000, 
          position: 2.5 
        }
      ]
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
                  <Label htmlFor="beamType" className="text-black font-medium">Beam Type</Label>
                  <Select 
                    value={parameters.beamType} 
                    onValueChange={(value) => handleSelectChange('beamType', value)}
                  >
                    <SelectTrigger className="bg-white text-black">
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
                <div className="flex justify-between items-center">
                  <Label className="text-black font-medium">Loads</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addLoad} className="flex items-center gap-1">
                    <PlusCircle className="w-4 h-4" /> Add Load
                  </Button>
                </div>
                
                {parameters.loads.map((load, index) => (
                  <div key={load.id} className="space-y-2 p-3 border rounded-md">
                    <div className="flex justify-between items-center">
                      <h4 className="text-sm font-medium text-black">Load {index + 1}</h4>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => removeLoad(load.id)}
                        className="h-6 w-6 p-0 rounded-full"
                      >
                        <MinusCircle className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-2">
                      <div className="input-group">
                        <Label htmlFor={`loadType-${load.id}`} className="text-black font-medium">Load Type</Label>
                        <Select 
                          value={load.type} 
                          defaultValue={load.type}
                          onValueChange={(value) => handleLoadChange(load.id, 'type', value)}
                        >
                          <SelectTrigger id={`loadType-${load.id}`} className="bg-white text-black">
                            <SelectValue placeholder="Select load type">
                              {load.type === 'point-load' ? 'Point Load' : 'Uniform Load'}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="point-load">Point Load</SelectItem>
                            <SelectItem value="uniform-load">Uniform Load</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="input-group">
                        <Label htmlFor={`loadMagnitude-${load.id}`} className="text-black font-medium">
                          {load.type === 'point-load' ? 'Load Magnitude (N)' : 'Load Intensity (N/m)'}
                        </Label>
                        <Input 
                          id={`loadMagnitude-${load.id}`}
                          type="number" 
                          value={load.magnitude} 
                          onChange={(e) => handleLoadChange(load.id, 'magnitude', e.target.value)}
                          min="0"
                          className="text-black bg-white"
                        />
                      </div>
                      
                      {load.type === 'point-load' && (
                        <div className="input-group">
                          <Label htmlFor={`loadPosition-${load.id}`}>Load Position from Left (m)</Label>
                          <Input 
                            id={`loadPosition-${load.id}`}
                            type="number" 
                            value={load.position} 
                            onChange={(e) => handleLoadChange(load.id, 'position', e.target.value)}
                            min="0"
                            max={parameters.length}
                            step="0.1"
                          />
                        </div>
                      )}
                      
                      {load.type === 'uniform-load' && (
                        <>
                          <div className="input-group">
                            <Label htmlFor={`loadStartPosition-${load.id}`}>Start Position (m)</Label>
                            <Input 
                              id={`loadStartPosition-${load.id}`}
                              type="number" 
                              value={load.startPosition !== undefined ? load.startPosition : 0} 
                              onChange={(e) => handleLoadChange(load.id, 'startPosition', e.target.value)}
                              min="0"
                              max={parameters.length}
                              step="0.1"
                            />
                          </div>
                          <div className="input-group">
                            <Label htmlFor={`loadEndPosition-${load.id}`}>End Position (m)</Label>
                            <Input 
                              id={`loadEndPosition-${load.id}`}
                              type="number" 
                              value={load.endPosition !== undefined ? load.endPosition : parameters.length} 
                              onChange={(e) => handleLoadChange(load.id, 'endPosition', e.target.value)}
                              min="0"
                              max={parameters.length}
                              step="0.1"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
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
                
                <div className="p-4 border rounded-lg bg-white">
                  <h3 className="text-lg font-medium text-gray-700 mb-4">Beam Visualization</h3>
                  <BeamVisualization 
                    beamLength={parameters.length}
                    beamType={parameters.beamType}
                    loads={parameters.loads}
                    deflectionPoints={results.deflectionPoints}
                  />
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
