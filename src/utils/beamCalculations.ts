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
  
  // Get support positions or use defaults
  const leftSupport = params.leftSupportPosition !== undefined ? params.leftSupportPosition : 0;
  const rightSupport = params.rightSupportPosition !== undefined ? params.rightSupportPosition : length;
  const span = rightSupport - leftSupport;
  
  if (beamType === 'simply-supported') {
    if (load.type === 'point-load' && load.position !== undefined) {
      // Adjust calculations for custom support positions
      const relativePos = load.position - leftSupport; // Position relative to left support
      
      if (load.position < leftSupport || load.position > rightSupport) {
        // Load is outside the supported span
        return { R1: 0, R2: 0 };
      }
      
      const R2 = (load.magnitude * relativePos) / span;
      const R1 = load.magnitude - R2;
      return { R1, R2 };
    } else if (load.type === 'uniform-load') {
      const startPos = load.startPosition || 0;
      const endPos = load.endPosition || length;
      
      // Find the overlap of the load with the supported span
      const overlapStart = Math.max(startPos, leftSupport);
      const overlapEnd = Math.min(endPos, rightSupport);
      
      if (overlapStart >= overlapEnd) {
        // No overlap between load and supported span
        return { R1: 0, R2: 0 };
      }
      
      const loadLength = overlapEnd - overlapStart;
      const totalLoad = load.magnitude * loadLength;
      
      // Calculate center of distributed load relative to left support
      const loadCenter = (overlapStart + overlapEnd) / 2 - leftSupport;
      
      const R2 = (totalLoad * loadCenter) / span;
      const R1 = totalLoad - R2;
      return { R1, R2 };
    } else if (load.type === 'triangular-load') {
      const startPos = load.startPosition || 0;
      const endPos = load.endPosition || length;
      
      // Find the overlap of the load with the supported span
      const overlapStart = Math.max(startPos, leftSupport);
      const overlapEnd = Math.min(endPos, rightSupport);
      
      if (overlapStart >= overlapEnd) {
        // No overlap between load and supported span
        return { R1: 0, R2: 0 };
      }
      
      const loadWidth = endPos - startPos;
      
      // Calculate total load (area of the triangle)
      const totalLoad = load.magnitude * loadWidth / 2;
      
      // Center of gravity of a triangle is at 1/3 from the max value
      const loadCenter = endPos - loadWidth / 3;
      
      // Adjust for support positions
      const adjustedCenter = loadCenter - leftSupport;
      
      const R2 = (totalLoad * adjustedCenter) / span;
      const R1 = totalLoad - R2;
      return { R1, R2 };
    }
  } else if (beamType === 'cantilever') {
    if (load.type === 'point-load' && load.position !== undefined) {
      // For cantilever, calculate reaction and moment at fixed end
      const R1 = load.magnitude;
      const M1 = load.magnitude * load.position;
      return { R1, R2: 0, M1 };
    } else if (load.type === 'uniform-load') {
      const startPos = load.startPosition || 0;
      const endPos = load.endPosition || length;
      
      const loadLength = endPos - startPos;
      const totalLoad = load.magnitude * loadLength;
      const loadCenter = (startPos + endPos) / 2;
      
      const R1 = totalLoad;
      const M1 = totalLoad * loadCenter;
      return { R1, R2: 0, M1 };
    } else if (load.type === 'triangular-load') {
      // For cantilever, calculate moment at fixed end
      const startPos = load.startPosition || 0;
      const endPos = load.endPosition || length;
      const loadWidth = endPos - startPos;
      
      const totalLoad = load.magnitude * loadWidth / 2;
      const loadCenter = endPos - loadWidth / 3;
      const lever = loadCenter - leftSupport;
      
      const R1 = totalLoad;
      const M1 = totalLoad * lever;
      return { R1, R2: 0, M1 };
    }
  } else if (beamType === 'fixed') {
    if (load.type === 'point-load' && load.position !== undefined) {
      // For fixed beam with point load
      const a = load.position;
      const L = length;
      
      const R1 = load.magnitude * (1 - a/L);
      const R2 = load.magnitude * (a/L);
      const M1 = -load.magnitude * a * (L - a) * (L - a) / (L * L);
      const M2 = load.magnitude * a * a * (L - a) / (L * L);
      
      return { R1, R2, M1, M2 };
    } else if (load.type === 'uniform-load') {
      const startPos = load.startPosition || 0;
      const endPos = load.endPosition || length;
      
      if (endPos - startPos >= length) {
        // Full uniform load on fixed beam
        const w = load.magnitude;
        const L = length;
        
        const R1 = w * L / 2;
        const R2 = w * L / 2;
        const M1 = -w * L * L / 12;
        const M2 = w * L * L / 12;
        
        return { R1, R2, M1, M2 };
      } else {
        // Partial uniform load on fixed beam - approximate
        const loadLength = endPos - startPos;
        const w = load.magnitude;
        const totalLoad = w * loadLength;
        const loadCenter = (startPos + endPos) / 2;
        const L = length;
        
        const R1 = totalLoad * (1 - loadCenter/L);
        const R2 = totalLoad * (loadCenter/L);
        
        // Simplified moment calculations
        const a = loadCenter;
        const b = loadLength / 2;
        
        const M1 = -w * b * (L - a) * (L - a) * (L + 2*a) / (12 * L);
        const M2 = w * b * a * a * (3*L - 2*a) / (12 * L);
        
        return { R1, R2, M1, M2 };
      }
    } else if (load.type === 'triangular-load') {
      // For fixed beam with triangular load
      const startPos = load.startPosition || 0;
      const endPos = load.endPosition || length;
      const loadWidth = endPos - startPos;
      
      const totalLoad = load.magnitude * loadWidth / 2;
      const loadCenter = endPos - loadWidth / 3;
      const adjustedCenter = loadCenter - leftSupport;
      
      const R1 = totalLoad * (1 - adjustedCenter/span);
      const R2 = totalLoad * (adjustedCenter/span);
      
      // Improved moment calculations for triangular load
      const a = adjustedCenter;
      const L = span;
      
      // Simplified moments based on equivalent point load
      const M1 = -totalLoad * a * (L - a) * (L - a) / (L * L);
      const M2 = totalLoad * a * a * (L - a) / (L * L);
      
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
      } else if (load.type === 'triangular-load') {
        const startPos = load.startPosition || 0;
        const endPos = load.endPosition || params.length;
        
        if (x >= startPos) {
          const w = load.magnitude;
          const loadWidth = endPos - startPos;
          
          if (x <= endPos) {
            // Portion of triangular load up to x
            const x1 = x - startPos;
            const partialHeight = w * x1 / loadWidth;
            // Moment for partial triangular load
            totalMoment -= partialHeight * x1 * x1 / 6;
          } else {
            // Full triangular load contribution
            const totalLoad = w * loadWidth / 2;
            const loadCenter = endPos - loadWidth / 3;
            totalMoment -= totalLoad * (x - loadCenter);
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
      } else if (load.type === 'triangular-load') {
        const startPos = load.startPosition || 0;
        const endPos = load.endPosition || params.length;
        
        if (x <= endPos) {
          const w = load.magnitude;
          const loadWidth = endPos - startPos;
          
          if (x <= startPos) {
            // Full triangular load
            const totalLoad = w * loadWidth / 2;
            const loadCenter = endPos - loadWidth / 3;
            totalMoment += totalLoad * (loadCenter - x);
          } else {
            // Partial triangular load from x to endPos
            const remainingWidth = endPos - x;
            const remainingHeight = w * remainingWidth / loadWidth;
            // Moment for the remaining triangular section
            totalMoment += remainingHeight * remainingWidth * remainingWidth / 6;
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
      } else if (load.type === 'triangular-load') {
        const startPos = load.startPosition || 0;
        const endPos = load.endPosition || params.length;
        
        if (x >= startPos) {
          const w = load.magnitude;
          const loadWidth = endPos - startPos;
          
          if (x <= endPos) {
            // Portion of triangular load up to x
            const x1 = x - startPos;
            const partialHeight = w * x1 / loadWidth;
            // Moment for partial triangular load
            totalMoment -= partialHeight * x1 * x1 / 6;
          } else {
            // Full triangular load contribution
            const totalLoad = w * loadWidth / 2;
            const loadCenter = endPos - loadWidth / 3;
            totalMoment -= totalLoad * (x - loadCenter);
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
      } else if (load.type === 'triangular-load') {
        const startPos = load.startPosition || 0;
        const endPos = load.endPosition || length;
        
        if (x > startPos) {
          const w = load.magnitude;
          const loadWidth = endPos - startPos;
          
          if (x <= endPos) {
            // Portion of triangular load up to x
            // For a triangular load, the partial area is non-linear
            const x1 = x - startPos;
            const partialHeight = w * x1 / loadWidth;
            // Area of partial triangle = 1/2 * base * height
            totalShear -= partialHeight * x1 / 2;
          } else {
            // Full triangular load
            totalShear -= w * loadWidth / 2;
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
      } else if (load.type === 'triangular-load') {
        const startPos = load.startPosition || 0;
        const endPos = load.endPosition || length;
        
        if (x < endPos) {
          const w = load.magnitude;
          const loadWidth = endPos - startPos;
          
          if (x <= startPos) {
            // Full load to the right
            totalShear += w * loadWidth / 2;
          } else {
            // Partial load to the right
            const remainingWidth = endPos - x;
            const partialHeight = w * remainingWidth / loadWidth;
            // Area of partial triangle
            totalShear += partialHeight * remainingWidth / 2;
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
      } else if (load.type === 'triangular-load') {
        const startPos = load.startPosition || 0;
        const endPos = load.endPosition || length;
        
        if (x > startPos) {
          const w = load.magnitude;
          const loadWidth = endPos - startPos;
          
          if (x <= endPos) {
            // Portion of triangular load up to x
            const x1 = x - startPos;
            const partialHeight = w * x1 / loadWidth;
            // Area of partial triangle = 1/2 * base * height
            totalShear -= partialHeight * x1 / 2;
          } else {
            // Full triangular load
            totalShear -= w * loadWidth / 2;
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
  
  // Include the entire beam length in the visualization
  const startX = 0;
  const endX = params.length;
  
  for (let i = 0; i <= numPoints; i++) {
    const x = startX + (i / numPoints) * (endX - startX);
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
      } else if (load.type === 'triangular-load') {
        const startPos = load.startPosition || 0;
        const endPos = load.endPosition || length;
        const w = load.magnitude; // Maximum intensity
        const a = startPos;
        const b = endPos;
        const loadWidth = b - a;
        
        // For triangular load on simply supported beam
        // Using modified formulas for triangular load (increasing from left to right)
        const L = length;
        
        if (position <= a) {
          // Before the load starts
          const totalLoad = w * loadWidth / 2;
          const loadCenter = b - loadWidth / 3;
          totalDeflection += (totalLoad * position * (L*L - position*position - loadCenter*loadCenter)) / (6 * EI * L);
        } else if (position <= b) {
          // Within the load
          const x1 = position - a;
          // Complex integration result for position within triangular load
          totalDeflection += (w * position * (L-position) * (L+position) * loadWidth) / (60 * EI * L) - 
                           (w * x1 * x1 * x1 * (10*L - 15*position + 6*x1)) / (120 * EI * L * loadWidth);
        } else {
          // After the load ends
          const totalLoad = w * loadWidth / 2;
          const loadCenter = b - loadWidth / 3;
          totalDeflection += (totalLoad * position * (L-position) * (L+position - 2*loadCenter)) / (6 * EI * L);
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
      } else if (load.type === 'triangular-load') {
        const startPos = load.startPosition || 0;
        const endPos = load.endPosition || length;
        const w = load.magnitude;
        const a = startPos;
        const b = endPos;
        const loadWidth = b - a;
        
        // For triangular load on cantilever beam
        if (position <= a) {
          // Before the load starts
          const totalLoad = w * loadWidth / 2;
          const loadCenter = b - loadWidth / 3;
          totalDeflection += (totalLoad * position * position * (3*loadCenter - position)) / (6 * EI);
        } else if (position <= b) {
          // Within the load
          // Complex integration for position within triangular load
          const x1 = position - a;
          totalDeflection += (w * position * position * position * loadWidth) / (24 * EI) - 
                           (w * x1 * x1 * x1 * (4*position - x1)) / (24 * EI * loadWidth);
        } else {
          // After the load ends
          // No additional deflection after the load ends on a cantilever
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
      } else if (load.type === 'triangular-load') {
        const startPos = load.startPosition || 0;
        const endPos = load.endPosition || length;
        const w = load.magnitude; // Maximum intensity
        const a = startPos;
        const b = endPos;
        const loadWidth = b - a;
        
        // For triangular load on fixed-fixed beam
        const L = length;
        
        if (position <= a) {
          // Before the load starts
          const totalLoad = w * loadWidth / 2;
          const loadCenter = b - loadWidth / 3;
          totalDeflection += (totalLoad * position * position * (3*L - position) * loadCenter) / (6 * EI * L * L);
        } else if (position <= b) {
          // Within the load
          const x1 = position - a;
          // Complex integration result for position within triangular load on fixed beam
          totalDeflection += (w * position * position * (L-position) * (L-position) * loadWidth) / (120 * EI * L * L) - 
                           (w * x1 * x1 * x1 * position * (L-position)) / (60 * EI * L * L * loadWidth);
        } else {
          // After the load ends
          const totalLoad = w * loadWidth / 2;
          const loadCenter = b - loadWidth / 3;
          totalDeflection += (totalLoad * position * position * (L-position) * (L-position) * loadCenter) / (6 * EI * L * L * L);
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
  
  // Get support positions
  const leftSupport = params.leftSupportPosition !== undefined ? params.leftSupportPosition : 0;
  const rightSupport = params.rightSupportPosition !== undefined ? params.rightSupportPosition : length;
  const span = rightSupport - leftSupport;
  
  if (beamType === 'simply-supported') {
    for (const load of loads) {
      if (load.type === 'point-load' && load.position !== undefined) {
        // Skip loads outside the supported span
        if (load.position < leftSupport || load.position > rightSupport) continue;
        
        // Adjust positions relative to left support
        const a = load.position - leftSupport;
        const L = span;
        const x = position - leftSupport;
        
        if (x < 0 || x > L) {
          // Position is outside the supported span
          continue;
        }
        
        // Corrected slope formula for simply supported beam with point load
        if (x <= a) {
          // For position x ≤ a (left of the load)
          totalSlope += (load.magnitude * a * (L - a) * (L - a - x)) / (6 * EI * L);
        } else {
          // For position x > a (right of the load)
          totalSlope += (load.magnitude * a * a * (x - a)) / (6 * EI * L);
        }
      } else if (load.type === 'uniform-load') {
        const startPos = load.startPosition || 0;
        const endPos = load.endPosition || length;
        
        // Find the overlap of the load with the supported span
        const overlapStart = Math.max(startPos, leftSupport);
        const overlapEnd = Math.min(endPos, rightSupport);
        
        if (overlapStart >= overlapEnd) continue; // No overlap
        
        const w = load.magnitude;
        const L = span;
        const x = position - leftSupport;
        
        if (x < 0 || x > L) continue; // Position outside span
        
        if (overlapStart === leftSupport && overlapEnd === rightSupport) {
          // Full uniform load on simply supported beam
          totalSlope += (w * (L * L * L - 4 * L * x * x + 2 * x * x * x)) / (24 * EI * L);
        } else {
          // Partial uniform load - simplified approach
          const loadLength = overlapEnd - overlapStart;
          const midPoint = (overlapStart + overlapEnd) / 2 - leftSupport;
          const totalLoad = w * loadLength;
          
          if (x <= overlapStart - leftSupport) {
            // Point before the distributed load
            totalSlope += (totalLoad * (x * (L - midPoint) - x * x / 2)) / (EI * L);
          } else if (x <= overlapEnd - leftSupport) {
            // Point within the distributed load
            const x1 = x - (overlapStart - leftSupport);
            totalSlope += (w * (x * (L - x) - x1 * x1 / 2)) / (EI * L);
          } else {
            // Point after the distributed load
            totalSlope += (totalLoad * (L - x) * (midPoint / L)) / (EI);
          }
        }
      } else if (load.type === 'triangular-load') {
        const startPos = load.startPosition || 0;
        const endPos = load.endPosition || length;
        
        // Find the overlap of the load with the supported span
        const overlapStart = Math.max(startPos, leftSupport);
        const overlapEnd = Math.min(endPos, rightSupport);
        
        if (overlapStart >= overlapEnd) continue; // No overlap
        
        const L = span;
        const x = position - leftSupport;
        
        if (x < 0 || x > L) continue; // Position outside span
        
        const a = overlapStart - leftSupport;
        const b = overlapEnd - leftSupport;
        const c = b - a; // Length of load
        const w = load.magnitude; // Maximum intensity at endPos
        
        // Calculate slope for triangular load on simply supported beam
        if (x <= a) {
          // Point before the triangular load
          const totalLoad = w * c / 2;
          const loadCenter = b - c/3;
          totalSlope += (totalLoad * (L - loadCenter) * x) / (EI * L);
        } else if (x <= b) {
          // Point within the triangular load
          const x1 = x - a;
          // Using simplified approach - treating as equivalent point load with adjustment
          const loadIntensityAtX = w * x1 / c; // Intensity at position
          const remainingLength = b - x;
          const remainingLoadArea = loadIntensityAtX * remainingLength / 2;
          const remainingLoadCenter = x + remainingLength * 2/3;
          
          totalSlope += (remainingLoadArea * (L - remainingLoadCenter) * x) / (EI * L);
        } else {
          // Point after the triangular load
          const totalLoad = w * c / 2;
          const loadCenter = b - c/3;
          totalSlope += (totalLoad * loadCenter * (L - x)) / (EI * L);
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
      } else if (load.type === 'triangular-load') {
        const startPos = load.startPosition || 0;
        const endPos = load.endPosition || length;
        const w = load.magnitude;
        const loadWidth = endPos - startPos;
        
        if (position <= startPos) {
          // Point before the triangular load
          const totalLoad = w * loadWidth / 2;
          const loadCenter = endPos - loadWidth / 3;
          totalSlope += (totalLoad * (2 * loadCenter - position)) / (2 * EI);
        } else if (position <= endPos) {
          // Point within the triangular load
          // The height of the triangle at position
          const x1 = position - startPos;
          const heightAtPosition = w * x1 / loadWidth;
          // Slope contribution from the remaining triangular load
          const remainingWidth = endPos - position;
          totalSlope += (heightAtPosition * remainingWidth * remainingWidth) / (6 * EI);
        } else {
          // Point after the triangular load (no slope contribution)
          totalSlope += 0;
        }
      }
    }
  } else if (beamType === 'fixed') {
    for (const load of loads) {
      if (load.type === 'point-load' && load.position !== undefined) {
        const a = load.position;
        const L = length;
        
        // Slope formula for fixed beam with point load
        if (position <= a) {
          totalSlope += (load.magnitude * a * position * (L - a - position)) / (2 * EI * L);
        } else {
          totalSlope += (load.magnitude * a * (L - position) * (position - a)) / (2 * EI * L);
        }
      } else if (load.type === 'uniform-load') {
        const startPos = load.startPosition || 0;
        const endPos = load.endPosition || length;
        const w = load.magnitude;
        const L = length;
        
        if (endPos - startPos >= length) {
          // Full uniform load on fixed beam
          totalSlope += (w * position * (L - position) * (L - 2 * position)) / (12 * EI);
        } else {
          // Partial uniform load - simplified approach
          const loadLength = endPos - startPos;
          const loadCenter = startPos + loadLength / 2;
          const totalLoad = w * loadLength;
          
          // Simplified slope calculation for partial uniform load
          if (position <= loadCenter) {
            totalSlope += (totalLoad * position * (L - loadCenter - position / 3)) / (2 * EI * L);
          } else {
            totalSlope += (totalLoad * (L - position) * (position - loadCenter / 3)) / (2 * EI * L);
          }
        }
      } else if (load.type === 'triangular-load') {
        const startPos = load.startPosition || 0;
        const endPos = load.endPosition || length;
        const w = load.magnitude;
        const L = length;
        const loadWidth = endPos - startPos;
        
        // Simplified slope calculation for triangular load on fixed beam
        const totalLoad = w * loadWidth / 2;
        const loadCenter = endPos - loadWidth / 3;
        
        if (position <= loadCenter) {
          totalSlope += (totalLoad * position * (L - loadCenter - position / 3)) / (2 * EI * L);
        } else {
          totalSlope += (totalLoad * (L - position) * (position - loadCenter / 3)) / (2 * EI * L);
        }
      }
    }
  }
  
  return totalSlope;
};

/**
 * Perform all beam calculations and return comprehensive results
 */
export const performCalculations = (params: BeamParameters): CalculationResults => {
  // Calculate deflection at key points
  const leftEndDeflection = calculateDeflectionAt(params, 0);
  const rightEndDeflection = calculateDeflectionAt(params, params.length);
  const midspanDeflection = calculateDeflectionAt(params, params.length / 2);
  
  // Find maximum deflection by sampling multiple points
  let maxDeflection = midspanDeflection;
  let maxDeflectionPosition = params.length / 2;
  
  const numSamples = 50;
  for (let i = 0; i <= numSamples; i++) {
    const position = (i / numSamples) * params.length;
    const deflection = calculateDeflectionAt(params, position);
    
    if (Math.abs(deflection) > Math.abs(maxDeflection)) {
      maxDeflection = deflection;
      maxDeflectionPosition = position;
    }
  }
  
  // Calculate slope at key points
  const leftEndSlope = calculateSlopeAt(params, 0);
  const rightEndSlope = calculateSlopeAt(params, params.length);
  const midspanSlope = calculateSlopeAt(params, params.length / 2);
  
  // Find maximum slope
  let maxSlope = Math.max(Math.abs(leftEndSlope), Math.abs(rightEndSlope), Math.abs(midspanSlope));
  let maxSlopePosition = Math.abs(leftEndSlope) > Math.abs(rightEndSlope) ? 0 : params.length;
  
  if (Math.abs(midspanSlope) > maxSlope) {
    maxSlope = Math.abs(midspanSlope);
    maxSlopePosition = params.length / 2;
  }
  
  // Sample more points to find true maximum slope
  for (let i = 0; i <= numSamples; i++) {
    const position = (i / numSamples) * params.length;
    const slope = calculateSlopeAt(params, position);
    
    if (Math.abs(slope) > maxSlope) {
      maxSlope = Math.abs(slope);
      maxSlopePosition = position;
    }
  }
  
  // Generate calculation steps for explanation
  const steps = generateCalculationSteps(params);
  
  // Calculate points for plotting deflection and slope curves
  const deflectionPoints = calculateDeflectionPoints(params);
  const slopePoints = calculateSlopePoints(params);
  
  // Build and return comprehensive results
  return {
    deflection: {
      leftEnd: leftEndDeflection * 1000, // Convert to mm
      rightEnd: rightEndDeflection * 1000,
      midspan: midspanDeflection * 1000,
      maxValue: maxDeflection * 1000,
      maxPosition: maxDeflectionPosition
    },
    slope: {
      leftEnd: leftEndSlope * (180 / Math.PI), // Convert to degrees
      rightEnd: rightEndSlope * (180 / Math.PI),
      midspan: midspanSlope * (180 / Math.PI),
      maxValue: maxSlope * (180 / Math.PI),
      maxPosition: maxSlopePosition
    },
    steps,
    deflectionPoints,
    slopePoints
  };
};

/**
 * Generate step-by-step calculation explanations
 */
const generateCalculationSteps = (params: BeamParameters): Array<{title: string, description: string, formula?: string, result?: string}> => {
  const steps: Array<{title: string, description: string, formula?: string, result?: string}> = [];
  
  // Step 1: Describe the beam setup
  steps.push({
    title: "Beam Configuration",
    description: `${params.beamType.charAt(0).toUpperCase() + params.beamType.slice(1)} beam with length ${params.length} m.\nElastic modulus (E): ${params.elasticModulus} MPa\nMoment of inertia (I): ${params.momentOfInertia} mm⁴`
  });
  
  // Step 2: Calculate reactions
  const reactions = calculateTotalReactions(params);
  steps.push({
    title: "Support Reactions",
    description: "Calculate the reactions at the supports based on equilibrium equations.",
    formula: "∑Forces = 0, ∑Moments = 0",
    result: `R₁ = ${(reactions.R1/1000).toFixed(2)} kN, R₂ = ${(reactions.R2/1000).toFixed(2)} kN${reactions.M1 ? `, M₁ = ${(reactions.M1/1000).toFixed(2)} kN·m` : ''}${reactions.M2 ? `, M₂ = ${(reactions.M2/1000).toFixed(2)} kN·m` : ''}`
  });
  
  // Step 3: Explain deflection calculation approach
  let deflectionFormula = "";
  if (params.beamType === 'simply-supported') {
    deflectionFormula = "δ = (PL³)/(48EI) for center point load";
  } else if (params.beamType === 'cantilever') {
    deflectionFormula = "δ = (PL³)/(3EI) for end point load";
  } else if (params.beamType === 'fixed') {
    deflectionFormula = "δ = (PL³)/(192EI) for center point load";
  }
  
  steps.push({
    title: "Deflection Calculation Method",
    description: "Using the principle of superposition and integrating the bending moment equation twice to find deflection.",
    formula: deflectionFormula,
    result: `Maximum deflection = ${(calculateDeflectionAt(params, params.length/2) * 1000).toFixed(3)} mm at midspan`
  });
  
  // Step 4: Explain slope calculation approach
  steps.push({
    title: "Slope Calculation",
    description: "The slope is calculated by taking the first derivative of the deflection curve.",
    formula: "θ = dδ/dx",
    result: `Maximum slope = ${(Math.abs(calculateSlopeAt(params, 0) * (180/Math.PI))).toFixed(4)}° at support`
  });
  
  return steps;
};
