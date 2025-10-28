import { AlertTriangle, CheckCircle, XCircle, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export interface AnalysisIssue {
  id: string;
  category: string;
  severity: "error" | "warning" | "info";
  title: string;
  description: string;
  location: string;
  suggestion: string;
  regulation: string;
}

interface AnalysisResultsProps {
  issues: AnalysisIssue[];
  overallStatus: "approved" | "rejected" | "needs-revision";
}

export const AnalysisResults = ({ issues, overallStatus }: AnalysisResultsProps) => {
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "error":
        return <XCircle className="w-5 h-5 text-destructive" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-warning" />;
      default:
        return <FileText className="w-5 h-5 text-primary" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "error":
        return <Badge variant="destructive">오류</Badge>;
      case "warning":
        return <Badge className="bg-warning text-warning-foreground">경고</Badge>;
      default:
        return <Badge variant="secondary">정보</Badge>;
    }
  };

  const getStatusConfig = () => {
    switch (overallStatus) {
      case "approved":
        return {
          icon: <CheckCircle className="w-8 h-8 text-accent" />,
          title: "승인",
          description: "모든 검토 항목이 규정에 부합합니다.",
          bgColor: "bg-accent/10",
          borderColor: "border-accent/30",
        };
      case "rejected":
        return {
          icon: <XCircle className="w-8 h-8 text-destructive" />,
          title: "반려",
          description: "중대한 오류가 발견되어 재제출이 필요합니다.",
          bgColor: "bg-destructive/10",
          borderColor: "border-destructive/30",
        };
      default:
        return {
          icon: <AlertTriangle className="w-8 h-8 text-warning" />,
          title: "보완 필요",
          description: "일부 항목에 대한 보완이 필요합니다.",
          bgColor: "bg-warning/10",
          borderColor: "border-warning/30",
        };
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 전체 상태 */}
      <Card className={`p-6 ${statusConfig.bgColor} border-2 ${statusConfig.borderColor}`}>
        <div className="flex items-start gap-4">
          {statusConfig.icon}
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-foreground mb-1">{statusConfig.title}</h2>
            <p className="text-muted-foreground">{statusConfig.description}</p>
            {(errorCount > 0 || warningCount > 0) && (
              <div className="flex gap-4 mt-4">
                {errorCount > 0 && (
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-destructive" />
                    <span className="text-sm font-medium">오류 {errorCount}건</span>
                  </div>
                )}
                {warningCount > 0 && (
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-warning" />
                    <span className="text-sm font-medium">경고 {warningCount}건</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* 세부 검토 결과 */}
      {issues.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">세부 검토 결과</h3>
          <Accordion type="single" collapsible className="w-full">
            {issues.map((issue) => (
              <AccordionItem key={issue.id} value={issue.id}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3 text-left">
                    {getSeverityIcon(issue.severity)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-foreground">{issue.title}</span>
                        {getSeverityBadge(issue.severity)}
                      </div>
                      <p className="text-xs text-muted-foreground">{issue.category}</p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-4 pl-8">
                    <div>
                      <h4 className="text-sm font-semibold text-foreground mb-1">문제점</h4>
                      <p className="text-sm text-muted-foreground">{issue.description}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground mb-1">위치</h4>
                      <p className="text-sm text-muted-foreground">{issue.location}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground mb-1">수정 제안</h4>
                      <p className="text-sm text-muted-foreground">{issue.suggestion}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground mb-1">관련 규정</h4>
                      <p className="text-sm text-primary">{issue.regulation}</p>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Card>
      )}
    </div>
  );
};
