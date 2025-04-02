
import React, { useRef, useEffect } from 'react';

interface Load {
  id: string;
  type: string;
  magnitude: number;
  position?: number;
  startPosition?: number;
  endPosition?: number;
}

interface BeamVisualizationProps {
  beamLength: number;
  beamType: string;
  loads: Load[];
  deflectionPoints: Array<{x: number, y: number}>;
  leftSupportPosition?: number;
  rightSupportPosition?: number;
}

const BeamVisualization: React.FC<BeamVisualizationProps> = ({
  beamLength,
  beamType,
  loads,
  deflectionPoints,
  leftSupportPosition = 0,
  rightSupportPosition
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size
    canvas.width = 800;
    canvas.height = 300;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Scale factors
    const xScale = (canvas.width - 100) / beamLength;
    const startX = 50;
    const beamY = 150;
    
    // Find max deflection for scaling (safely check if array is not empty)
    let maxDeflection = 0;
    if (deflectionPoints && deflectionPoints.length > 0) {
      deflectionPoints.forEach(point => {
        const absDeflection = Math.abs(point.y);
        if (absDeflection > maxDeflection) {
          maxDeflection = absDeflection;
        }
      });
    }
    
    // Calculate deflection scale
    const deflectionScale = maxDeflection > 0 ? 80 / maxDeflection : 1;
    
    // Draw beam supports
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    
    // Draw undeflected beam
    ctx.beginPath();
    ctx.moveTo(startX, beamY);
    ctx.lineTo(startX + beamLength * xScale, beamY);
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Use rightSupportPosition if provided, otherwise default to beamLength
    const actualRightSupportPosition = rightSupportPosition !== undefined ? rightSupportPosition : beamLength;
    
    // Draw supports based on beam type
    if (beamType === 'simply-supported') {
      // Left support (triangle) at custom position
      const leftSupportX = startX + leftSupportPosition * xScale;
      ctx.beginPath();
      ctx.moveTo(leftSupportX, beamY);
      ctx.lineTo(leftSupportX - 15, beamY + 15);
      ctx.lineTo(leftSupportX + 15, beamY + 15);
      ctx.closePath();
      ctx.stroke();
      
      // Right support (triangle with circle for roller) at custom position
      const rightSupportX = startX + actualRightSupportPosition * xScale;
      ctx.beginPath();
      ctx.moveTo(rightSupportX, beamY);
      ctx.lineTo(rightSupportX - 15, beamY + 15);
      ctx.lineTo(rightSupportX + 15, beamY + 15);
      ctx.closePath();
      ctx.stroke();
      
      // Roller indication
      ctx.beginPath();
      ctx.arc(rightSupportX, beamY + 20, 5, 0, Math.PI * 2);
      ctx.stroke();
    } else if (beamType === 'cantilever') {
      // Fixed support (left)
      const fixedSupportX = startX + leftSupportPosition * xScale;
      ctx.beginPath();
      ctx.moveTo(fixedSupportX, beamY - 20);
      ctx.lineTo(fixedSupportX, beamY + 20);
      ctx.stroke();
      
      // Hatching to indicate fixed support
      for (let i = -20; i <= 20; i += 5) {
        ctx.beginPath();
        ctx.moveTo(fixedSupportX, beamY + i);
        ctx.lineTo(fixedSupportX - 10, beamY + i);
        ctx.stroke();
      }
    } else if (beamType === 'fixed') {
      // Fixed support (left)
      const leftFixedX = startX + leftSupportPosition * xScale;
      ctx.beginPath();
      ctx.moveTo(leftFixedX, beamY - 20);
      ctx.lineTo(leftFixedX, beamY + 20);
      ctx.stroke();
      
      // Hatching to indicate fixed support (left)
      for (let i = -20; i <= 20; i += 5) {
        ctx.beginPath();
        ctx.moveTo(leftFixedX, beamY + i);
        ctx.lineTo(leftFixedX - 10, beamY + i);
        ctx.stroke();
      }
      
      // Fixed support (right)
      const rightFixedX = startX + actualRightSupportPosition * xScale;
      ctx.beginPath();
      ctx.moveTo(rightFixedX, beamY - 20);
      ctx.lineTo(rightFixedX, beamY + 20);
      ctx.stroke();
      
      // Hatching to indicate fixed support (right)
      for (let i = -20; i <= 20; i += 5) {
        ctx.beginPath();
        ctx.moveTo(rightFixedX, beamY + i);
        ctx.lineTo(rightFixedX + 10, beamY + i);
        ctx.stroke();
      }
    }
    
    // Draw loads
    ctx.fillStyle = '#ff1ba7';
    ctx.strokeStyle = '#ff1ba7';
    
    loads.forEach(load => {
      if (load.type === 'point-load' && load.position !== undefined) {
        const loadX = startX + load.position * xScale;
        
        // Draw arrow
        ctx.beginPath();
        ctx.moveTo(loadX, beamY - 40);
        ctx.lineTo(loadX, beamY - 5);
        ctx.stroke();
        
        // Draw arrowhead
        ctx.beginPath();
        ctx.moveTo(loadX, beamY);
        ctx.lineTo(loadX - 5, beamY - 10);
        ctx.lineTo(loadX + 5, beamY - 10);
        ctx.closePath();
        ctx.fill();
        
        // Draw magnitude text
        ctx.fillStyle = '#000000';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${load.magnitude} kN`, loadX, beamY - 45);
        ctx.fillStyle = '#ff1ba7';
      } else if (load.type === 'uniform-load') {
        const startLoadX = startX + (load.startPosition || 0) * xScale;
        const endLoadX = startX + (load.endPosition || beamLength) * xScale;
        
        // Draw interval markers
        ctx.strokeStyle = '#000000';
        ctx.setLineDash([3, 3]);
        
        // Start interval marker
        ctx.beginPath();
        ctx.moveTo(startLoadX, beamY - 60);
        ctx.lineTo(startLoadX, beamY + 20);
        ctx.stroke();
        
        // End interval marker
        ctx.beginPath();
        ctx.moveTo(endLoadX, beamY - 60);
        ctx.lineTo(endLoadX, beamY + 20);
        ctx.stroke();
        
        // Reset line style
        ctx.setLineDash([]);
        ctx.strokeStyle = '#ff1ba7';
        
        // Draw distributed load arrows
        const numArrows = Math.floor((endLoadX - startLoadX) / 20) + 1;
        const arrowSpacing = (endLoadX - startLoadX) / (numArrows - 1 || 1);
        
        for (let i = 0; i < numArrows; i++) {
          const loadX = startLoadX + i * arrowSpacing;
          
          // Draw arrow
          ctx.beginPath();
          ctx.moveTo(loadX, beamY - 40);
          ctx.lineTo(loadX, beamY - 5);
          ctx.stroke();
          
          // Draw arrowhead
          ctx.beginPath();
          ctx.moveTo(loadX, beamY);
          ctx.lineTo(loadX - 5, beamY - 10);
          ctx.lineTo(loadX + 5, beamY - 10);
          ctx.closePath();
          ctx.fill();
        }
        
        // Draw top line connecting arrows
        ctx.beginPath();
        ctx.moveTo(startLoadX, beamY - 40);
        ctx.lineTo(endLoadX, beamY - 40);
        ctx.stroke();
        
        // Draw interval text
        ctx.fillStyle = '#000000';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        
        // Display start and end positions
        ctx.fillText(`${load.startPosition || 0} m`, startLoadX, beamY + 35);
        ctx.fillText(`${load.endPosition || beamLength} m`, endLoadX, beamY + 35);
        
        // Draw magnitude text
        ctx.font = '12px Arial';
        ctx.fillText(`${load.magnitude} kN/m`, (startLoadX + endLoadX) / 2, beamY - 50);
        ctx.fillStyle = '#ff1ba7';
      } else if (load.type === 'triangular-load' && load.startPosition !== undefined && load.endPosition !== undefined) {
        const startLoadX = startX + load.startPosition * xScale;
        const endLoadX = startX + load.endPosition * xScale;
        
        // Draw interval markers
        ctx.strokeStyle = '#000000';
        ctx.setLineDash([3, 3]);
        
        // Start interval marker
        ctx.beginPath();
        ctx.moveTo(startLoadX, beamY - 60);
        ctx.lineTo(startLoadX, beamY + 20);
        ctx.stroke();
        
        // End interval marker
        ctx.beginPath();
        ctx.moveTo(endLoadX, beamY - 60);
        ctx.lineTo(endLoadX, beamY + 20);
        ctx.stroke();
        
        // Reset line style
        ctx.setLineDash([]);
        ctx.strokeStyle = '#ff1ba7';
        
        // Draw triangular load arrows - more arrows near the max load side
        const numArrows = Math.floor((endLoadX - startLoadX) / 20) + 1;
        const arrowSpacing = (endLoadX - startLoadX) / (numArrows - 1 || 1);
        
        for (let i = 0; i < numArrows; i++) {
          const loadX = startLoadX + i * arrowSpacing;
          // Calculate height based on position (linear variation)
          const ratio = i / (numArrows - 1);
          const arrowHeight = 5 + ratio * 35; // Height varies from 5 to 40
          
          // Draw arrow
          ctx.beginPath();
          ctx.moveTo(loadX, beamY - arrowHeight);
          ctx.lineTo(loadX, beamY - 5);
          ctx.stroke();
          
          // Draw arrowhead
          ctx.beginPath();
          ctx.moveTo(loadX, beamY);
          ctx.lineTo(loadX - 5, beamY - 10);
          ctx.lineTo(loadX + 5, beamY - 10);
          ctx.closePath();
          ctx.fill();
        }
        
        // Draw sloped top line connecting arrows
        ctx.beginPath();
        ctx.moveTo(startLoadX, beamY - 5);
        ctx.lineTo(endLoadX, beamY - 40);
        ctx.stroke();
        
        // Draw interval text
        ctx.fillStyle = '#000000';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        
        // Display start and end positions
        ctx.fillText(`${load.startPosition} m`, startLoadX, beamY + 35);
        ctx.fillText(`${load.endPosition} m`, endLoadX, beamY + 35);
        
        // Draw magnitude text
        ctx.font = '12px Arial';
        ctx.fillText(`${load.magnitude} kN/m at end`, endLoadX, beamY - 50);
        ctx.fillStyle = '#ff1ba7';
      }
    });
    
    // Draw deflected beam ONLY if there are valid deflection points
    if (deflectionPoints && deflectionPoints.length > 0) {
      ctx.beginPath();
      ctx.strokeStyle = '#ff1ba7';
      ctx.lineWidth = 3;
      
      const firstPoint = deflectionPoints[0];
      ctx.moveTo(startX + firstPoint.x * xScale, beamY - firstPoint.y * deflectionScale);
      
      deflectionPoints.forEach((point, index) => {
        if (index > 0) {
          ctx.lineTo(startX + point.x * xScale, beamY - point.y * deflectionScale);
        }
      });
      
      ctx.stroke();
    }
    
    // Draw scale and axis labels
    ctx.fillStyle = '#000000';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`0 m`, startX - 5, beamY + 30);
    ctx.textAlign = 'right';
    ctx.fillText(`${beamLength} m`, startX + beamLength * xScale + 5, beamY + 30);
    
    // Add a legend
    ctx.fillStyle = '#000000';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    
    // Undeflected beam legend
    ctx.beginPath();
    ctx.setLineDash([5, 5]);
    ctx.moveTo(startX, beamY + 60);
    ctx.lineTo(startX + 50, beamY + 60);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillText('Undeflected beam', startX + 60, beamY + 65);
    
    // Deflected beam legend
    ctx.beginPath();
    ctx.strokeStyle = '#ff1ba7';
    ctx.lineWidth = 3;
    ctx.moveTo(startX, beamY + 80);
    ctx.lineTo(startX + 50, beamY + 80);
    ctx.stroke();
    ctx.fillText('Deflected beam', startX + 60, beamY + 85);
    
    // Note about scale
    ctx.fillStyle = '#666666';
    ctx.font = '10px Arial';
    ctx.fillText('Note: Deflection is scaled for visibility (in mm)', startX, beamY + 100);
  }, [beamLength, beamType, loads, deflectionPoints, leftSupportPosition, rightSupportPosition]);

  return (
    <div className="flex justify-center">
      <canvas 
        ref={canvasRef} 
        className="w-full max-w-full h-auto border rounded-md"
        style={{ maxHeight: '300px' }}
      />
    </div>
  );
};

export default BeamVisualization;
