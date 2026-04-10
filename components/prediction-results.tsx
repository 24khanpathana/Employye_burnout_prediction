'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface PredictionResult {
  employee_id: number;
  name: string;
  email: string;
  burnout_score: number;
  risk_level: 'low' | 'medium' | 'high';
}

interface PredictionResultsProps {
  predictions: PredictionResult[];
}

export function PredictionResults({ predictions }: PredictionResultsProps) {
  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high':
        return 'bg-destructive/10 text-destructive';
      case 'medium':
        return 'bg-accent/10 text-accent';
      case 'low':
        return 'bg-secondary/10 text-secondary';
      default:
        return 'bg-muted text-foreground';
    }
  };

  const sorted = [...predictions].sort((a, b) => b.burnout_score - a.burnout_score);

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle>Burnout Predictions</CardTitle>
        <CardDescription>Sorted by burnout score (highest risk first)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-2 font-medium text-foreground/70">Employee</th>
                <th className="text-left py-3 px-2 font-medium text-foreground/70">Email</th>
                <th className="text-left py-3 px-2 font-medium text-foreground/70">Burnout Score</th>
                <th className="text-left py-3 px-2 font-medium text-foreground/70">Risk Level</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((pred) => (
                <tr key={pred.employee_id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                  <td className="py-3 px-2">
                    <div className="font-medium text-foreground">{pred.name}</div>
                  </td>
                  <td className="py-3 px-2 text-foreground/70">{pred.email}</td>
                  <td className="py-3 px-2">
                    <div className="font-bold text-foreground">{pred.burnout_score}</div>
                  </td>
                  <td className="py-3 px-2">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium capitalize ${getRiskColor(pred.risk_level)}`}>
                      {pred.risk_level}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
