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
    }
  
  // Improved triangular load calculations
  else if (load.type === 'triangular-load') {
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
    
    if (beamType === 'simply-supported') {
      // Calculate total load (area of the triangle)
      const totalLoad = load.magnitude * loadWidth / 2;
      
      // Center of gravity of a triangle is at 1/3 from the max value
      const loadCenter = endPos - loadWidth / 3;
      
      // Adjust for support positions
      const adjustedCenter = loadCenter - leftSupport;
      
      const R2 = (totalLoad * adjustedCenter) / span;
      const R1 = totalLoad - R2;
      return { R1, R2 };
    } else if (beamType === 'cantilever') {
      // For cantilever, calculate moment at fixed end
      const totalLoad = load.magnitude * loadWidth / 2;
      const loadCenter = endPos - loadWidth / 3;
      const lever = loadCenter - leftSupport;
      
      const R1 = totalLoad;
      const M1 = totalLoad * lever;
      return { R1, R2: 0, M1 };
    } else if (beamType === 'fixed') {
      // For fixed beam with triangular load
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
  
  // Improved triangular load shear force calculations
  else if (load.type === 'triangular-load') {
    const startPos = load.startPosition || 0;
    const endPos = load.endPosition || length;
    
    if (beamType === 'simply-supported' || beamType === 'fixed') {
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
    } else if (beamType === 'cantilever') {
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
  
  // Improved triangular load deflection calculations
  else if (load.type === 'triangular-load') {
    const startPos = load.startPosition || 0;
    const endPos = load.endPosition || length;
    const w = load.magnitude; // Maximum intensity
    const a = startPos;
    const b = endPos;
    const loadWidth = b - a;
    
    if (beamType === 'simply-supported') {
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
    } else if (beamType === 'cantilever') {
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
    } else if (beamType === 'fixed') {
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
      }
      else if (load.type === 'triangular-load') {
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
      }
      else if (load.type === 'triangular-load') {
        const startPos = load.startPosition || 0;
        const end
