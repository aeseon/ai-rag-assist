import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, CheckCircle, XCircle, FileText, Loader2, BookOpen, Lightbulb } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface AnalysisIssue {
  id: string;
  category: string;
  severity: "error" | "warning" | "info";
  title: string;
  description: string;
  location?: string;
  suggestion?: string;
  regulation?: string;
}

interface AnalysisResultsProps {
  submissionId: string;
}

const AnalysisResults = ({ submissionId }: AnalysisResultsProps) => {
  const [issues, setIssues] = useState<AnalysisIssue[]>([]);
  const [overallStatus, setOverallStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalysisResults();
  }, [submissionId]);

  const fetchAnalysisResults = async () => {
    try {
      const { data: analysisResult, error: analysisError } = await supabase
        .from('analysis_results')
        .select('*, analysis_issues(*)')
        .eq('submission_id', submissionId)
        .maybeSingle();

      if (analysisError) throw analysisError;

      if (analysisResult) {
        setOverallStatus(analysisResult.overall_status);
        const mappedIssues = (analysisResult.analysis_issues || []).map((issue: any) => ({
          id: issue.id,
          category: issue.category,
          severity: issue.severity as "error" | "warning" | "info",
          title: issue.title,
          description: issue.description,
          location: issue.location || undefined,
          suggestion: issue.suggestion || undefined,
          regulation: issue.regulation || undefined,
        }));
        setIssues(mappedIssues);
      }
    } catch (error) {
      console.error('Error fetching analysis results:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-12">
        <div className="flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">분석 결과를 불러오는 중...</p>
        </div>
      </Card>
    );
  }
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
      case "compliant":
        return {
          icon: <CheckCircle className="w-8 h-8 text-accent" />,
          title: "승인",
          description: "모든 검토 항목이 규정에 부합합니다.",
          bgColor: "bg-accent/10",
          borderColor: "border-accent/30",
        };
      case "non_compliant":
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
                    {issue.location && (
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-1">위치</h4>
                        <p className="text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-md border-l-2 border-primary">{issue.location}</p>
                      </div>
                    )}
                    
                    {/* 근거 및 수정 제안 섹션 */}
                    {(issue.regulation || issue.suggestion) && (
                      <div className="space-y-3 mt-4 pt-4 border-t">
                        <h4 className="text-sm font-bold text-foreground">근거 및 수정 제안</h4>
                        
                        {issue.regulation && (
                          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                            <div className="flex items-start gap-2 mb-2">
                              <BookOpen className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                              <h5 className="text-sm font-semibold text-primary">관련 법령 및 규정 근거</h5>
                            </div>
                            <p className="text-sm text-foreground leading-relaxed pl-6 bg-background/50 p-3 rounded border-l-4 border-primary">
                              {issue.regulation}
                            </p>
                          </div>
                        )}
                        
                        {issue.suggestion && (
                          <div className="bg-accent/5 border border-accent/20 rounded-lg p-4">
                            <div className="flex items-start gap-2 mb-2">
                              <Lightbulb className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                              <h5 className="text-sm font-semibold text-accent">수정 제안</h5>
                            </div>
                            <p className="text-sm text-foreground leading-relaxed pl-6 bg-background/50 p-3 rounded border-l-4 border-accent">
                              {issue.suggestion}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
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

export default AnalysisResults;
