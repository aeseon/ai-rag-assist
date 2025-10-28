import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface AnalysisStep {
  id: string;
  title: string;
  status: "pending" | "in-progress" | "completed" | "error";
}

interface AnalysisProgressProps {
  steps: AnalysisStep[];
  currentProgress: number;
}

export const AnalysisProgress = ({ steps, currentProgress }: AnalysisProgressProps) => {
  return (
    <Card className="p-6 animate-fade-in">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-2">문서 분석 중</h3>
          <Progress value={currentProgress} className="h-2" />
        </div>
        
        <div className="space-y-3">
          {steps.map((step) => (
            <div key={step.id} className="flex items-center gap-3">
              {step.status === "completed" && (
                <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0" />
              )}
              {step.status === "in-progress" && (
                <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0" />
              )}
              {step.status === "error" && (
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
              )}
              {step.status === "pending" && (
                <div className="w-5 h-5 rounded-full border-2 border-muted flex-shrink-0" />
              )}
              <span
                className={`text-sm ${
                  step.status === "completed"
                    ? "text-accent font-medium"
                    : step.status === "in-progress"
                    ? "text-primary font-medium"
                    : step.status === "error"
                    ? "text-destructive font-medium"
                    : "text-muted-foreground"
                }`}
              >
                {step.title}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};
