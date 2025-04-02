
import React from 'react';
import { Separator } from '@/components/ui/separator';
import { CalculationResults } from '../types/beam';

interface ResultsDisplayProps {
  results: CalculationResults | null;
}

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ results }) => {
  if (!results) {
    return (
      <div className="p-6 text-center text-gray-500">
        No calculation results yet. Configure parameters and click Calculate.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-3">Deflection Results</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 border rounded-md">
            <p className="text-sm text-gray-500">Left End</p>
            <p className="font-medium">{results.deflection.leftEnd.toFixed(3)} mm</p>
          </div>
          <div className="p-3 border rounded-md">
            <p className="text-sm text-gray-500">Right End</p>
            <p className="font-medium">{results.deflection.rightEnd.toFixed(3)} mm</p>
          </div>
          <div className="p-3 border rounded-md">
            <p className="text-sm text-gray-500">Midspan</p>
            <p className="font-medium">{results.deflection.midspan.toFixed(3)} mm</p>
          </div>
          <div className="p-3 border rounded-md">
            <p className="text-sm text-gray-500">Maximum</p>
            <p className="font-medium">{results.deflection.maxValue.toFixed(3)} mm</p>
            <p className="text-xs text-gray-400">at {results.deflection.maxPosition.toFixed(2)} m</p>
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-lg font-medium mb-3">Slope Results</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 border rounded-md">
            <p className="text-sm text-gray-500">Left End</p>
            <p className="font-medium">{results.slope.leftEnd.toFixed(4)}°</p>
          </div>
          <div className="p-3 border rounded-md">
            <p className="text-sm text-gray-500">Right End</p>
            <p className="font-medium">{results.slope.rightEnd.toFixed(4)}°</p>
          </div>
          <div className="p-3 border rounded-md">
            <p className="text-sm text-gray-500">Midspan</p>
            <p className="font-medium">{results.slope.midspan.toFixed(4)}°</p>
          </div>
          <div className="p-3 border rounded-md">
            <p className="text-sm text-gray-500">Maximum</p>
            <p className="font-medium">{results.slope.maxValue.toFixed(4)}°</p>
            <p className="text-xs text-gray-400">at {results.slope.maxPosition.toFixed(2)} m</p>
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-lg font-medium mb-3">Calculation Steps</h3>
        {results.steps.map((step, index) => (
          <div key={index} className="mb-4 p-4 border rounded-md">
            <h4 className="font-medium mb-2">{step.title}</h4>
            <p className="text-sm mb-2 whitespace-pre-line">{step.description}</p>
            {step.formula && <p className="text-sm italic mb-1">Formula: {step.formula}</p>}
            {step.result && <p className="text-sm font-medium">Result: {step.result}</p>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ResultsDisplay;
