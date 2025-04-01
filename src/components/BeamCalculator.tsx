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
  magnitude: number; // in kN
  position?: number; // in m
  startPosition?: number; // in m
  endPosition?: number; // in m
}

interface BeamParameters {
  length: number; // in m
  elasticModulus: number; // in MPa
  momentOfInertia: number; // in mm⁴
  beamType: string;
  loads: Load[];
}

interface SlopeValues {
  leftEnd: number;
  rightEnd: number;
  midspan: number;
  maxValue: number;
  maxPosition: number;
}

interface DeflectionValues {
  leftEnd: number;
  rightEnd: number;
  midspan: number;
  maxValue: number;
  maxPosition: number;
}

interface CalculationResults {
  deflection: DeflectionValues;
  slope: SlopeValues;
  steps: Array<{title: string, description: string, formula?: string, result?: string}>;
  deflectionPoints: Array<{x: number, y: number}>;
  slopePoints: Array<{x: number, y: number}>;
}

const BeamCalculator: React.FC = () => {
  const [parameters, setParameters] = useState<BeamParameters>({
    length: 5,
    elasticModulus: 200000, // MPa
    momentOfInertia: 40000000, // mm⁴ (4 * 10^7)
    beamType: 'simply-supported',
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
      loads: parameters.loads.map(load => {
        if (load.id === id) {
          // Handle conversion to number for numeric fields
          const parsedValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
          
          // When changing load type, set default values for the other fields
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
            } else if (value === 'uniform-load') {
              return {
                ...load,
                type: 'uniform-load',
                magnitude: load.magnitude,
                position: undefined,
                startPosition: 0,
                endPosition: parameters.length
              };
            }
          }
          
          // For regular field updates
          return { ...load, [field]: parsedValue };
        }
        return load;
      })
    });
  };

  const addLoad = () => {
    const newLoad: Load = { 
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

  // Convert units for calculation
  const convertToCalculationUnits = (params: BeamParameters) => {
    // Convert kN to N, MPa to Pa, mm⁴ to m⁴
    return {
      ...params,
      elasticModulus: params.elasticModulus * 1e6, // MPa to Pa
      momentOfInertia: params.momentOfInertia * 1e-12, // mm⁴ to m⁴
      loads: params.loads.map(load => ({
        ...load,
        magnitude: load.magnitude * 1000 // kN to N
      }))
    };
  };

  const calculateReactions = (params: BeamParameters, loadIndex: number): { R1: number, R2: number, M1?: number, M2?: number } => {
    const calculationParams = convertToCalculationUnits(params);
    const { length, beamType, loads } = calculationParams;
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
    } else if (beamType === 'fixed') {
      if (load.type === 'point-load' && load.position !== undefined) {
        const a = load.position;
        const L = length;
        
        // For fixed beam with point load
        const R1 = load.magnitude / 2;
        const R2 = load.magnitude / 2;
        const M1 = (load.magnitude * a * (L - a) * (L - a)) / (L * L);
        const M2 = (load.magnitude * a * a * (L - a)) / (L * L);
        return { R1, R2, M1, M2 };
      } else if (load.type === 'uniform-load') {
        const startPos = load.startPosition || 0;
        const endPos = load.endPosition || length;
        const w = load.magnitude;
        const L = length;
        
        if (endPos - startPos >= length) {
          // Full uniform load on fixed beam
          const R1 = (w * L) / 2;
          const R2 = (w * L) / 2;
          const M1 = (w * L * L) / 12;
          const M2 = (w * L * L) / 12;
          return { R1, R2, M1, M2 };
        } else {
          // Partial uniform load - simplified approach
          const loadLength = endPos - startPos;
          const totalLoad = w * loadLength;
          const loadCenter = startPos + loadLength / 2;
          const R1 = totalLoad / 2;
          const R2 = totalLoad / 2;
          // Note: For partial loads, the moment calculations would be more complex
          // This is a simplified approximation
          const M1 = (totalLoad * (loadCenter) * (L - loadCenter)) / (2 * L);
          const M2 = (totalLoad * (loadCenter) * (L - loadCenter)) / (2 * L);
          return { R1, R2, M1, M2 };
        }
      }
    }
    
    // Default case
    return { R1: 0, R2: 0 };
  };

  const calculateTotalReactions = (params: BeamParameters): { R1: number, R2: number, M1?: number, M2?: number } => {
    const totalReactions = { R1: 0, R2: 0, M1: 0, M2: 0 };
    
    params.loads.forEach((_, index) => {
      const reactions = calculateReactions(params, index);
      totalReactions.R1 += reactions.R1;
      totalReactions.R2 += reactions.R2;
      totalReactions.M1 = (totalReactions.M1 || 0) + (reactions.M1 || 0);
      totalReactions.M2 = (totalReactions.M2 || 0) + (reactions.M2 || 0);
    });
    
    return totalReactions;
  };

  const calculateBendingMoment = (params: BeamParameters, x: number): number => {
    const calculationParams = convertToCalculationUnits(params);
    const { beamType, loads } = calculationParams;
    let totalMoment = 0;
    
    if (beamType === 'simply-supported') {
      const { R1 } = calculateTotalReactions(calculationParams);
      
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
    } else if (beamType === 'fixed') {
      const { R1, M1, M2 } = calculateTotalReactions(calculationParams);
      const L = params.length;
      
      // Fixed beam moment calculation
      totalMoment = -M1 + R1 * x;
      
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
    }
    
    return totalMoment;
  };

  const calculateShearForce = (params: BeamParameters, x: number): number => {
    const calculationParams = convertToCalculationUnits(params);
    const { beamType, loads, length } = calculationParams;
    let totalShear = 0;
    
    if (beamType === 'simply-supported') {
      const { R1 } = calculateTotalReactions(calculationParams);
      
      // Shear contribution from reaction
      totalShear += R1;
      
      // Shear contributions from each load
      for (const load of loads) {
        if (load.type === 'point-load' && load.position !== undefined) {
          if (x > load.position) {
            totalShear -= load.magnitude;
          }
        } else if (load.type === 'uniform-load') {
          const startPos = load.startPosition || 0;
          const endPos = load.endPosition || length;
          
          if (x > startPos) {
            const w = load.magnitude;
            if (x <= endPos) {
              // Portion of distributed load up to x
              totalShear -= w * (x - startPos);
            } else {
              // Full distributed load
              totalShear -= w * (endPos - startPos);
            }
          }
        }
      }
    } else if (beamType === 'cantilever') {
      // For cantilever, shear force at any point is the sum of all loads to the right
      for (const load of loads) {
        if (load.type === 'point-load' && load.position !== undefined) {
          if (x <= load.position) {
            totalShear += load.magnitude;
          }
        } else if (load.type === 'uniform-load') {
          const startPos = load.startPosition || 0;
          const endPos = load.endPosition || length;
          
          if (x < endPos) {
            const w = load.magnitude;
            if (x <= startPos) {
              // Full load to the right
              totalShear += w * (endPos - startPos);
            } else {
              // Partial load to the right
              totalShear += w * (endPos - x);
            }
          }
        }
      }
    } else if (beamType === 'fixed') {
      const { R1 } = calculateTotalReactions(calculationParams);
      
      // Shear from reaction
      totalShear += R1;
      
      // Shear contributions from each load
      for (const load of loads) {
        if (load.type === 'point-load' && load.position !== undefined) {
          if (x > load.position) {
            totalShear -= load.magnitude;
          }
        } else if (load.type === 'uniform-load') {
          const startPos = load.startPosition || 0;
          const endPos = load.endPosition || length;
          
          if (x > startPos) {
            const w = load.magnitude;
            if (x <= endPos) {
              totalShear -= w * (x - startPos);
            } else {
              totalShear -= w * (endPos - startPos);
            }
          }
        }
      }
    }
    
    return totalShear;
  };

  const calculateDeflectionPoints = (params: BeamParameters): Array<{x: number, y: number}> => {
    const numPoints = 100;
    const points: Array<{x: number, y: number}> = [];
    
    for (let i = 0; i <= numPoints; i++) {
      const x = (i / numPoints) * params.length;
      const deflection = calculateDeflectionAt(params, x);
      // Convert deflection to mm
      points.push({ x, y: deflection * 1000 });
    }
    
    return points;
  };

  const calculateSlopePoints = (params: BeamParameters): Array<{x: number, y: number}> => {
    const numPoints = 100;
    const points: Array<{x: number, y: number}> = [];
    
    for (let i = 0; i <= numPoints; i++) {
      const x = (i / numPoints) * params.length;
      const slope = calculateSlopeAt(params, x);
      points.push({ x, y: slope });
    }
    
    return points;
  };

  const calculateDeflectionAt = (params: BeamParameters, position: number): number => {
    const calculationParams = convertToCalculationUnits(params);
    const { beamType, elasticModulus, momentOfInertia, length, loads } = calculationParams;
    const EI = elasticModulus * momentOfInertia;
    let totalDeflection = 0;
    
    // Using the moment/EI method for deflection calculation
    const moment = calculateBendingMoment(calculationParams, position);
    
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
          
          // For uniform distributed load over a segment
          if (endPos - startPos >= length) {
            // Full uniform load
            totalDeflection += (w * position * (L*L*L - 2*L*position*position + position*position*position)) / (24 * EI * L);
          } else {
            // Partial uniform load - simplified approach
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
    } else if (beamType === 'fixed') {
      for (const load of loads) {
        if (load.type === 'point-load' && load.position !== undefined) {
          const a = load.position;
          const L = length;
          
          // Fixed beam deflection for point load
          totalDeflection += (load.magnitude * position * position * (3*L - position) * a) / (6 * EI * L);
          if (position > a) {
            totalDeflection -= (load.magnitude * (position - a) * (position - a) * (position - a)) / (6 * EI);
          }
        } else if (load.type === 'uniform-load') {
          const startPos = load.startPosition || 0;
          const endPos = load.endPosition || length;
          const w = load.magnitude;
          const L = length;
          
          if (endPos - startPos >= length) {
            // Full uniform load on fixed beam
            totalDeflection += (w * position * position * (L - position) * (L - position)) / (24 * EI);
          } else {
            // Partial uniform load requires more complex calculations
            // Using a simplified approach
            const loadLength = endPos - startPos;
            const equivalentPointLoad = w * loadLength;
            const loadCenter = startPos + loadLength / 2;
            
            totalDeflection += (equivalentPointLoad * position * position * (3*L - position) * loadCenter) / (6 * EI * L);
            if (position > loadCenter) {
              totalDeflection -= (equivalentPointLoad * (position - loadCenter) * (position - loadCenter) * (position - loadCenter)) / (6 * EI);
            }
          }
        }
      }
    }
    
    return totalDeflection;
  };

  const calculateSlopeAt = (params: BeamParameters, position: number): number => {
    const calculationParams = convertToCalculationUnits(params);
    const { beamType, elasticModulus, momentOfInertia, length, loads } = calculationParams;
    const EI = elasticModulus * momentOfInertia;
    let totalSlope = 0;
    
    if (beamType === 'simply-supported') {
      for (const load of loads) {
        if (load.type === 'point-load' && load.position !== undefined) {
          const a = load.position;
          const L = length;
          
          // Corrected slope formula for simply supported beam with point load
          if (position <= a) {
            // For position x ≤ a (left of the load)
            totalSlope += (load.magnitude * a * (L - a) * (L - a - position)) / (6 * EI * L);
          } else {
            // For position x > a (right of the load)
            totalSlope += (load.magnitude * a * a * (position - a)) / (6 * EI * L);
          }
        } else if (load.type === 'uniform-load') {
          const startPos = load.startPosition || 0;
          const endPos = load.endPosition || length;
          const w = load.magnitude;
          const L = length;
          
          if (endPos - startPos >= length) {
            // Full uniform load on simply supported beam
            totalSlope += (w * (L * L * L - 4 * L * position * position + 2 * position * position * position)) / (24 * EI * L);
          } else {
            // Partial uniform load
            const loadLength = endPos - startPos;
            const midPoint = (startPos + endPos) / 2;
            const totalLoad = w * loadLength;
            
            if (position <= startPos) {
              // Point before the distributed load
              totalSlope += (totalLoad * (position * (L - midPoint) - position * position / 2)) / (EI * L);
            } else if (position <= endPos) {
              // Point within the distributed load
              const x1 = position - startPos;
              totalSlope += (w * (position * (L - position) - x1 * x1 / 2)) / (EI * L);
            } else {
              // Point after the distributed load
              totalSlope += (totalLoad * (L - position) * (midPoint / L)) / (EI);
            }
          }
        }
      }
    } else if (beamType === 'cantilever') {
      for (const load of loads) {
        if (load.type === 'point-load' && load.position !== undefined) {
          const a = load.position;
          
          if (position <= a) {
            // Corrected slope formula for cantilever with point load (x ≤ a)
            totalSlope += (load.magnitude * position * (2 * a - position)) / (2 * EI);
          } else {
            // Corrected slope formula for cantilever with point load (x > a)
            totalSlope += (load.magnitude * a * a) / (2 * EI);
          }
        } else if (load.type === 'uniform-load') {
          const startPos = load.startPosition || 0;
          const endPos = load.endPosition || length;
          const w = load.magnitude;
          
          if (endPos - startPos >= length) {
            // Full uniform load on cantilever
            totalSlope += (w * position * (2 * length - position)) / (4 * EI);
          } else {
            // Partial uniform load
            const loadLength = endPos - startPos;
            
            if (position <= startPos) {
              // Point before the distributed load
              totalSlope += (w * loadLength * (2 * (endPos + startPos) / 2 - position)) / (2 * EI);
            } else if (position <= endPos) {
              // Point within the distributed load
              totalSlope += (w * (endPos - position) * (endPos - position)) / (4 * EI);
            } else {
              // Point after the distributed load (no slope contribution)
              totalSlope += 0;
            }
          }
        }
      }
    } else if (beamType === 'fixed') {
      for (const load of loads) {
        if (load.type === 'point-load' && load.position !== undefined) {
          const a = load.position;
          const L = length;
          
          // Corrected slope formula for fixed beam with point load
          if (position <= a) {
            totalSlope += (load.magnitude * a * position * (L - a) * (L - position)) / (6 * EI * L * L);
          } else {
            totalSlope += (load.magnitude * a * (L - a) * position * (L - position)) / (6 * EI * L * L);
          }
        } else if (load.type === 'uniform-load') {
          const startPos = load.startPosition || 0;
          const endPos = load.endPosition || length;
          const w = load.magnitude;
          const L = length;
          
          if (endPos - startPos >= length) {
            // Full uniform load on fixed beam
            totalSlope += (w * position * (L - position) * (L - 2 * position)) / (12 * EI * L);
          } else {
            // Partial uniform load
            const loadLength = endPos - startPos;
            const midPoint = (startPos + endPos) / 2;
            const totalLoad = w * loadLength;
            
            // Simplified approach for partial load on fixed beam
            if (position <= midPoint) {
              totalSlope += (totalLoad * position * (L - position) * (L - 2 * position)) / (12 * EI * L * L);
            } else {
              totalSlope += -(totalLoad * position * (L - position) * (2 * position - L)) / (12 * EI * L * L);
            }
          }
        }
      }
    }
    
    return totalSlope;
  };

  const calculateDeflectionValues = (params: BeamParameters, deflectionPoints: Array<{x: number, y: number}>): DeflectionValues => {
    const leftEnd = calculateDeflectionAt(params, 0) * 1000; // Convert to mm
    const rightEnd = calculateDeflectionAt(params, params.length) * 1000; // Convert to mm
    const midspan = calculateDeflectionAt(params, params.length / 2) * 1000; // Convert to mm
    
    let maxDeflection = 0;
    let maxPosition = 0;
    
    deflectionPoints.forEach(point => {
      const absDeflection = Math.abs(point.y);
      if (absDeflection > maxDeflection) {
        maxDeflection = absDeflection;
        maxPosition = point.x;
      }
    });
    
    return {
      leftEnd,
      rightEnd,
      midspan,
      maxValue: maxDeflection,
      maxPosition
    };
  };

  const calculateSlopeValues = (params: BeamParameters, slopePoints: Array<{x: number, y: number}>): SlopeValues => {
    const leftEnd = calculateSlopeAt(params, 0);
    const rightEnd = calculateSlopeAt(params, params.length);
    const midspan = calculateSlopeAt(params, params.length / 2);
    
    let maxSlope = 0;
    let maxPosition = 0;
    
    slopePoints.forEach(point => {
      const absSlope = Math.abs(point.y);
      if (absSlope > maxSlope) {
        maxSlope = absSlope;
        maxPosition = point.x;
      }
    });
    
    return {
      leftEnd,
      rightEnd,
      midspan,
      maxValue: maxSlope,
      maxPosition
    };
  };

  const generateSteps = (
    params: BeamParameters, 
    deflectionValues: DeflectionValues, 
    slopeValues: SlopeValues
  ): Array<{title: string, description: string, formula?: string, result?: string}> => {
    const { beamType, elasticModulus, momentOfInertia, length, loads } = params;
    const steps: Array<{title: string, description: string, formula?: string, result?: string}> = [];
    
    // Convert units for display
    const E = elasticModulus; // MPa
    const I = momentOfInertia; // mm⁴
    const reactions = calculateTotalReactions(params);
    
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
    } else if (beamType === 'fixed') {
      if (loads.length === 1 && loads[0].type === 'point-load') {
        momentFormula = "M(x) = M₁ + R₁×x - P×(x-a) for a≤x≤L";
      } else if (loads.length === 1 && loads[0].type === 'uniform-load') {
        momentFormula = "M(x) = M₁ + R₁×x - (w×x²)/2 for 0≤x≤L";
      } else {
        momentFormula = "M(x) = M₁ + R₁×x - ∑ load contributions";
      }
    }
    
    let reactionResult = "";
    if (beamType === 'simply-supported') {
      reactionResult = `R₁ = ${(reactions.R1/1000).toFixed(2)} kN, R₂ = ${(reactions.R2/1000).toFixed(2)} kN`;
    } else if (beamType === 'cantilever') {
      reactionResult = `R = ${(reactions.R1/1000).toFixed(2)} kN, M = ${((reactions.M1 || 0)/1000).toFixed(2)} kN·m`;
    } else if (beamType === 'fixed') {
      reactionResult = `R₁ = ${(reactions.R1/1000).toFixed(2)} kN, R₂ = ${(reactions.R2/1000).toFixed(2)} kN, M₁ = ${((reactions.M1 || 0)/1000).toFixed(2)} kN·m, M₂ = ${((reactions.M2 || 0)/1000).toFixed(2)} kN·m`;
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
    } else if (beamType === 'fixed') {
      conjugateDesc = "Create a conjugate beam with the same length. For a fixed beam, the fixed ends become free with released constraints in the conjugate beam.";
    }
    
    steps.push({
      title: "Step 2: Construct the Conjugate Beam",
      description: conjugateDesc,
      formula: "wc(x) = M(x)/EI where M(x) is the bending moment at x, E is the elastic modulus in MPa, and I is the moment of inertia in mm⁴",
      result: `Using E = ${E.toExponential(2)} MPa, I = ${I.toExponential(2)} mm⁴`
    });
    
    // Step 3: Analyze the Conjugate Beam
    steps.push({
      title: "Step 3: Analyze the Conjugate Beam",
      description: "Treat the conjugate beam as a real beam loaded with the M/EI diagram. Calculate the shear forces and bending moments in the conjugate beam.",
      formula: "Vc(x) = ∑Fc where Fc are the forces on the conjugate beam\nMc(x) = ∑(Fc⋅d) where d are the distances from the section",
      result: "Shear forces and bending moments calculated for the conjugate beam"
    });
    
    // Step 4: Interpret the Results
    const deflectionResult = `Maximum deflection = ${deflectionValues.maxValue.toFixed(2)} mm at x = ${deflectionValues.maxPosition.toFixed(2)} m
Left end deflection = ${deflectionValues.leftEnd.toFixed(2)} mm
Right end deflection = ${deflectionValues.rightEnd.toFixed(2)} mm
Midspan deflection = ${deflectionValues.midspan.toFixed(2)} mm`;
    
    const slopeResult = `Maximum slope = ${slopeValues.maxValue.toExponential(4)} rad at x = ${slopeValues.maxPosition.toFixed(2)} m
Left end slope = ${slopeValues.leftEnd.toExponential(4)} rad
Right end slope = ${slopeValues.rightEnd.toExponential(4)} rad
Midspan slope = ${slopeValues.midspan.toExponential(4)} rad`;
    
    steps.push({
      title: "Step 4: Interpret the Results",
      description: "Apply the conjugate beam theorems: The slope at any point in the real beam equals the shear force at that point in the conjugate beam. The deflection equals the bending moment.",
      formula: "Slope: θ(x) = Vc(x)/EI\nDeflection: δ(x) = Mc(x)/EI",
      result: `${deflectionResult}\n\n${slopeResult}`
    });
    
    return steps;
  };

  const calculateResults = (params: BeamParameters): CalculationResults => {
    const deflectionPoints = calculateDeflectionPoints(params);
    const slopePoints = calculateSlopePoints(params);
    
    const deflectionValues = calculateDeflectionValues(params, deflectionPoints);
    const slopeValues = calculateSlopeValues(params, slopePoints);
    
    const steps = generateSteps(params, deflectionValues, slopeValues);
    
    return {
      deflection: deflectionValues,
      slope: slopeValues,
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
      elasticModulus: 200000, // MPa
      momentOfInertia: 40000000, // mm⁴ (4 * 10^7)
      beamType: 'simply-supported',
      loads: [
        { 
          id: crypto.randomUUID(), 
          type: 'point-load', 
          magnitude: 10, // kN
          position: 2.5 // m
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
                      <SelectValue placeholder="Select beam type">
                        {parameters.beamType === 'simply-supported' ? 'Simply Supported' : 
                         parameters.beamType === 'cantilever' ? 'Cantilever' : 'Fixed'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="simply-supported">Simply Supported</SelectItem>
                      <SelectItem value="cantilever">Cantilever</SelectItem>
                      <SelectItem value="fixed">Fixed</SelectItem>
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
                  <Label htmlFor="elasticModulus">Young's Modulus, E (MPa)</Label>
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
                  <Label htmlFor="momentOfInertia">Moment of Inertia, I (mm⁴)</Label>
                  <Input 
                    id="momentOfInertia" 
                    name="momentOfInertia" 
                    type="number" 
                    value={parameters.momentOfInertia} 
                    onChange={handleInputChange}
                    step="1000"
                    min="1000"
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
                          {load.type === 'point-load' ? 'Load Magnitude (kN)' : 'Load Intensity (kN/m)'}
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
                      {results.deflection.maxValue.toFixed(2)} mm
                    </p>
                    <div className="mt-3 text-sm">
                      <p>Left End: {results.deflection.leftEnd.toFixed(2)} mm</p>
                      <p>Midspan: {results.deflection.midspan.toFixed(2)} mm</p>
                      <p>Right End: {results.deflection.rightEnd.toFixed(2)} mm</p>
                    </div>
                  </div>
                  
                  <div className="p-4 border rounded-lg bg-white">
                    <h3 className="text-lg font-medium text-gray-700">Maximum Slope</h3>
                    <p className="text-2xl font-bold text-beamcee-pink mt-2">
                      {results.slope.maxValue.toExponential(4)} rad
                    </p>
                    <div className="mt-3 text-sm">
                      <p>Left End: {results.slope.leftEnd.toExponential(4)} rad</p>
                      <p>Midspan: {results.slope.midspan.toExponential(4)} rad</p>
                      <p>Right End: {results.slope.rightEnd.toExponential(4)} rad</p>
                    </div>
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
                            {step.formula.split('\n').map((line, i) => (
                              <div key={i}>{line}</div>
                            ))}
                          </div>
                        )}
                        
                        {step.result && (
                          <div className="mt-2 font-medium">
                            <p className="font-semibold mb-1">Result:</p>
                            <pre className="whitespace-pre-wrap text-sm">{step.result}</pre>
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
