import { BeamParameters, Load, SlopeValues, DeflectionValues, CalculationResults } from "../types/beam";

// Convert units for calculation
export const convertToCalculationUnits = (params: BeamParameters) => {
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

export const calculateReactions = (params: BeamParameters, loadIndex: number): { R1: number, R2: number, M1?: number, M2?: number } => {
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
    } else if (load.type === 'triangular-load') {
      const startPos = load.startPosition || 0;
      const endPos = load.endPosition || length;
      const loadLength = endPos - startPos;
      
      // For triangular load, the center of gravity is 1/3 from the higher end
      // Magnitude is at the higher end (endPos)
      const totalLoad = load.magnitude * loadLength / 2; // Area of triangle = 1/2 * base * height
      const loadCenter = endPos - loadLength / 3; // Center of gravity is 1/3 from the max load end
      
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
    } else if (load.type === 'triangular-load') {
      const startPos = load.startPosition || 0;
      const endPos = load.endPosition || length;
      const loadLength = endPos - startPos;
      
      // For triangular load
      const totalLoad = load.magnitude * loadLength / 2;
      const loadCenter = endPos - loadLength / 3; // Center of gravity is 1/3 from the max load end
      
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
    } else if (load.type === 'triangular-load') {
      const startPos = load.startPosition || 0;
      const endPos = load.endPosition || length;
      const loadLength = endPos - startPos;
      const w = load.magnitude;
      const L = length;
      
      // Simplified approach for triangular load on fixed beam
      const totalLoad = w * loadLength / 2;
      const loadCenter = endPos - loadLength / 3;
      
      const R1 = totalLoad / 2;
      const R2 = totalLoad / 2;
      const M1 = (totalLoad * (loadCenter) * (L - loadCenter)) / (2 * L);
      const M2 = (totalLoad * (loadCenter) * (L - loadCenter)) / (2 * L);
      return { R1, R2, M1, M2 };
    }
  }
  
  // Default case
  return { R1: 0, R2: 0 };
};

export const calculateTotalReactions = (params: BeamParameters): { R1: number, R2: number, M1?: number, M2?: number } => {
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

export const calculateBendingMoment = (params: BeamParameters, x: number): number => {
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

export const calculateShearForce = (params: BeamParameters, x: number): number => {
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

export const calculateDeflectionPoints = (params: BeamParameters): Array<{x: number, y: number}> => {
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

export const calculateSlopePoints = (params: BeamParameters): Array<{x: number, y: number}> => {
  const numPoints = 100;
  const points: Array<{x: number, y: number}> = [];
  
  for (let i = 0; i <= numPoints; i++) {
    const x = (i / numPoints) * params.length;
    const slopeRad = calculateSlopeAt(params, x);
    // Convert radians to degrees
    const slopeDeg = slopeRad * (180 / Math.PI);
    points.push({ x, y: slopeDeg });
  }
  
  return points;
};

export const calculateDeflectionAt = (params: BeamParameters, position: number): number => {
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

export const calculateSlopeAt = (params: BeamParameters, position: number): number => {
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
      else if (load.type === 'triangular-load') {
        const startPos = load.startPosition || 0;
        const endPos = load.endPosition || length;
        const w = load.magnitude; // Maximum intensity at endPos
        const L = length;
        const a = startPos;
        const b = endPos;
        const c = b - a; // Length of load
        
        // Calculate slope for triangular load on simply supported beam
        if (position <= a) {
          // Point before the triangular load
          const totalLoad = w * c / 2;
          const loadCenter = b - c/3;
          totalSlope += (totalLoad * (L - loadCenter) * position) / (EI * L);
        } else if (position <= b) {
          // Point within the triangular load
          const x1 = position - a;
          // Using simplified approach - treating as equivalent point load with adjustment
          const loadIntensityAtX = w * x1 / c; // Intensity at position
          const remainingLength = b - position;
          const remainingLoadArea = loadIntensityAtX * remainingLength / 2;
          const remainingLoadCenter = position + remainingLength * 2/3;
          
          totalSlope += (remainingLoadArea * (L - remainingLoadCenter) * position) / (EI * L);
        } else {
          // Point after the triangular load
          const totalLoad = w * c / 2;
          const loadCenter = b - c/3;
          totalSlope += (totalLoad * loadCenter * (L - position)) / (EI * L);
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
      else if (load.type === 'triangular-load') {
        const startPos = load.startPosition || 0;
        const endPos = load.endPosition || length;
        const w = load.magnitude;
        const loadLength = endPos - startPos;
        
        if (position <= startPos) {
          // Point before the triangular load
          const totalLoad = w * loadLength / 2;
          const loadCenter = endPos - loadLength / 3;
          totalSlope += (totalLoad * (2 * loadCenter - position)) / (2 * EI);
        } else if (position <= endPos) {
          // Point within the triangular load
          // Simplified calculation for slope within triangular load region
          const x = position - startPos;
          const remainingLength = endPos - position;
          // Intensity at current position (linear variation)
          const intensityAtX = w * x / loadLength;
          // Area of remaining triangular load
          const remainingLoad = intensityAtX * remainingLength / 2;
          // Center of gravity of remaining load from current position
          const cgFromPosition = remainingLength * 2/3;
          // Moment contribution from remaining load
          totalSlope += (remainingLoad * cgFromPosition) / (EI);
        } else {
          // Point after the triangular load (no slope contribution)
          totalSlope += 0;
        }
      }
    }
  } else if (beamType === 'fixed') {
    // Fixed-end slope calculations would go here
    // For a fixed beam, the slope at both ends is zero
    // For intermediate points, we need more complex calculations
  }
  
  return totalSlope;
};

export const performCalculations = (params: BeamParameters): CalculationResults => {
  // Generate deflection and slope points for visualization
  const deflectionPoints = calculateDeflectionPoints(params);
  const slopePoints = calculateSlopePoints(params);
  
  // Find maximum deflection and its position
  let maxDeflection = 0;
  let maxDeflectionPosition = 0;
  
  deflectionPoints.forEach(point => {
    const absDeflection = Math.abs(point.y);
    if (absDeflection > Math.abs(maxDeflection)) {
      maxDeflection = point.y;
      maxDeflectionPosition = point.x;
    }
  });
  
  // Find maximum slope and its position
  let maxSlope = 0;
  let maxSlopePosition = 0;
  
  slopePoints.forEach(point => {
    const absSlope = Math.abs(point.y);
    if (absSlope > Math.abs(maxSlope)) {
      maxSlope = point.y;
      maxSlopePosition = point.x;
    }
  });
  
  // Calculate values at key positions
  const leftEndDeflection = calculateDeflectionAt(params, 0) * 1000; // Convert to mm
  const rightEndDeflection = calculateDeflectionAt(params, params.length) * 1000;
  const midspanDeflection = calculateDeflectionAt(params, params.length / 2) * 1000;
  
  const leftEndSlopeRad = calculateSlopeAt(params, 0);
  const rightEndSlopeRad = calculateSlopeAt(params, params.length);
  const midspanSlopeRad = calculateSlopeAt(params, params.length / 2);
  
  // Convert slopes to degrees
  const leftEndSlope = leftEndSlopeRad * (180 / Math.PI);
  const rightEndSlope = rightEndSlopeRad * (180 / Math.PI);
  const midspanSlope = midspanSlopeRad * (180 / Math.PI);
  
  // Prepare calculation steps for display
  const steps = prepareCalculationSteps(params, maxDeflection, maxDeflectionPosition);
  
  return {
    deflection: {
      leftEnd: leftEndDeflection,
      rightEnd: rightEndDeflection,
      midspan: midspanDeflection,
      maxValue: maxDeflection,
      maxPosition: maxDeflectionPosition
    },
    slope: {
      leftEnd: leftEndSlope,
      rightEnd: rightEndSlope,
      midspan: midspanSlope,
      maxValue: maxSlope,
      maxPosition: maxSlopePosition
    },
    steps,
    deflectionPoints,
    slopePoints
  };
};

// Helper function to prepare calculation steps for display
const prepareCalculationSteps = (
  params: BeamParameters,
  maxDeflection: number,
  maxDeflectionPosition: number
): Array<{title: string, description: string, formula?: string, result?: string}> => {
  const { beamType, loads } = params;
  const steps = [];
  
  // Step 1: Support Reactions
  const reactions = calculateTotalReactions(params);
  steps.push({
    title: "Step 1: Calculate Support Reactions",
    description: `For the ${beamType} beam, the support reactions are calculated based on static equilibrium.`,
    result: `R1 = ${(reactions.R1/1000).toFixed(2)} kN, R2 = ${(reactions.R2/1000).toFixed(2)} kN`
  });
  
  // Step 2: Bending Moment Diagram
  steps.push({
    title: "Step 2: Develop Bending Moment Diagram",
    description: "The bending moment at any point along the beam is calculated from the reactions and applied loads."
  });
  
  // Step 3: Beam Stiffness
  const EI = params.elasticModulus * 1e6 * params.momentOfInertia * 1e-12;
  steps.push({
    title: "Step 3: Calculate Beam Stiffness (EI)",
    description: "Beam stiffness is the product of the elastic modulus (E) and moment
