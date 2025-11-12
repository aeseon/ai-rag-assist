import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, CheckCircle, XCircle, FileText, Loader2, BookOpen, Lightbulb } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface Citation {
  doc_id: string;
  title: string;
  category: string;
  version?: string;
  effective_date?: string;
  status: string;
  section_path?: string;
  snippet: string;
  score?: number;
}

interface AnalysisIssue {
  id: string;
  category: string;
  severity: "error" | "warning" | "info";
  title: string;
  description: string;
  location?: string;
  suggestion?: string;
  regulation?: string;
  submission_highlight?: string;
  regulation_highlight?: string;
  regulation_id?: string;
  regulation_title?: string;
  regulation_category?: string;
  regulation_version?: string;
  regulation_effective_date?: string;
  regulation_status?: string;
  citations?: Citation[];
  issue_code?: string;
  notes?: string;
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
          submission_highlight: issue.submission_highlight || undefined,
          regulation_highlight: issue.regulation_highlight || undefined,
          regulation_id: issue.regulation_id || undefined,
          regulation_title: issue.regulation_title || undefined,
          regulation_category: issue.regulation_category || undefined,
          regulation_version: issue.regulation_version || undefined,
          regulation_effective_date: issue.regulation_effective_date || undefined,
          regulation_status: issue.regulation_status || undefined,
          citations: issue.citations || undefined,
          issue_code: issue.issue_code || undefined,
          notes: issue.notes || undefined,
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

      {/* 반려 상세 정보 (반려 시) */}
      {overallStatus === 'non_compliant' && issues.length > 0 && (
        <div className="space-y-4">
          {/* 규정 근거 요약 - 항상 표시 */}
          <Card className="p-6 bg-destructive/5 border-destructive/20">
            <h3 className="text-lg font-semibold text-destructive mb-3 flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              규정 근거 요약
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              본 판정은 아래 규정 근거에 기반합니다.
            </p>
            <div className="space-y-2">
              {issues
                .filter(i => i.severity === 'error')
                .map((issue, idx) => (
                  <div key={issue.id} className="flex items-start gap-2 text-sm bg-background/50 p-3 rounded-lg border">
                    <span className="font-semibold text-destructive min-w-[20px]">{idx + 1}.</span>
                    <div className="flex-1">
                      <p className="font-medium text-foreground mb-1">
                        {issue.regulation_title || issue.title}
                      </p>
                      {issue.regulation && (
                        <p className="text-muted-foreground text-xs">{issue.regulation}</p>
                      )}
                      {!issue.regulation && issue.description && (
                        <p className="text-muted-foreground text-xs">{issue.description}</p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </Card>

          {/* 검토된 문서 중요 내용 하이라이트 */}
          {issues.some(i => i.severity === 'error' && i.submission_highlight) && (
            <Card className="p-6 bg-yellow-50/50 dark:bg-yellow-950/10 border-yellow-200 dark:border-yellow-800">
              <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-300 mb-3 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                검토된 문서에서 중요한 내용
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                제출하신 문서에서 규정 위반이 발견된 부분을 하이라이트하여 제시합니다.
              </p>
              <div className="space-y-3">
                {issues
                  .filter(i => i.severity === 'error' && i.submission_highlight)
                  .map((issue, idx) => (
                    <div key={issue.id} className="bg-background border border-yellow-300 dark:border-yellow-700 rounded-lg p-4">
                      <div className="flex items-start gap-2 mb-2">
                        <span className="font-semibold text-yellow-800 dark:text-yellow-300 min-w-[20px]">{idx + 1}.</span>
                        <p className="text-sm font-medium text-foreground">{issue.title}</p>
                      </div>
                      <div className="pl-6">
                        <div className="bg-yellow-100 dark:bg-yellow-900/30 border-l-4 border-yellow-500 p-3 rounded-r">
                          <p className="text-sm text-yellow-900 dark:text-yellow-100 italic">
                            "{issue.submission_highlight}"
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </Card>
          )}

          {/* 관련 법령 및 규정 근거 하이라이트 - 오류 항목이 있으면 항상 표시 */}
          <Card className="p-6 bg-blue-50/50 dark:bg-blue-950/10 border-blue-200 dark:border-blue-800">
            <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-3 flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              관련 법령 및 규정에서의 근거
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              위반된 규정의 구체적인 조항 내용을 하이라이트하여 제시합니다.
            </p>
            {issues.some(i => i.severity === 'error' && i.regulation_highlight) ? (
              <div className="space-y-3">
                {issues
                  .filter(i => i.severity === 'error' && i.regulation_highlight)
                  .map((issue, idx) => (
                    <div key={issue.id} className="bg-background border border-blue-300 dark:border-blue-700 rounded-lg p-4">
                      <div className="flex items-start gap-2 mb-2">
                        <span className="font-semibold text-blue-800 dark:text-blue-300 min-w-[20px]">{idx + 1}.</span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground mb-1">{issue.regulation_title || issue.title}</p>
                          {issue.regulation_category && (
                            <Badge variant="outline" className="text-xs">{issue.regulation_category}</Badge>
                          )}
                        </div>
                      </div>
                      <div className="pl-6">
                        <div className="bg-blue-100 dark:bg-blue-900/30 border-l-4 border-blue-500 p-3 rounded-r">
                          <p className="text-sm text-blue-900 dark:text-blue-100 italic">
                            "{issue.regulation_highlight}"
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="space-y-3">
                {issues
                  .filter(i => i.severity === 'error')
                  .map((issue, idx) => (
                    <div key={issue.id} className="bg-background border border-blue-300 dark:border-blue-700 rounded-lg p-4">
                      <div className="flex items-start gap-2 mb-2">
                        <span className="font-semibold text-blue-800 dark:text-blue-300 min-w-[20px]">{idx + 1}.</span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground mb-1">{issue.regulation_title || issue.title}</p>
                          {issue.regulation_category && (
                            <Badge variant="outline" className="text-xs">{issue.regulation_category}</Badge>
                          )}
                        </div>
                      </div>
                      <div className="pl-6">
                        {issue.regulation ? (
                          <div className="bg-blue-100 dark:bg-blue-900/30 border-l-4 border-blue-500 p-3 rounded-r">
                            <p className="text-sm text-blue-900 dark:text-blue-100">
                              {issue.regulation}
                            </p>
                          </div>
                        ) : (
                          <div className="bg-muted/50 border-l-4 border-blue-300 p-3 rounded-r">
                            <p className="text-sm text-muted-foreground italic">
                              {issue.description || "규정 근거 정보를 수집하는 중입니다."}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </Card>

          {/* 수정 제안 및 결과 판정 */}
          {issues.some(i => i.severity === 'error' && i.suggestion) && (
            <Card className="p-6 bg-accent/5 border-accent/30">
              <h3 className="text-lg font-semibold text-accent mb-3 flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                수정 제안 및 결과 판정
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                문서의 규정 위반 여부를 판별하고, 수정이 필요한 항목에 대한 구체적인 제안을 제공합니다.
              </p>
              <div className="bg-accent/10 border border-accent/30 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <XCircle className="w-6 h-6 text-destructive flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">판정 결과: 반려</h4>
                    <p className="text-sm text-muted-foreground">
                      제출하신 문서에서 규정과 불일치하거나 오류가 발견되어 <strong className="text-destructive">반려 및 보완</strong>이 필요합니다.
                      아래의 수정 제안을 참고하여 문서를 보완한 후 재제출해 주시기 바랍니다.
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                {issues
                  .filter(i => i.severity === 'error' && i.suggestion)
                  .map((issue, idx) => (
                    <div key={issue.id} className="bg-background border rounded-lg p-4">
                      <div className="flex items-start gap-2 mb-3">
                        <span className="font-semibold text-accent min-w-[20px]">{idx + 1}.</span>
                        <div className="flex-1">
                          <p className="font-medium text-foreground mb-1">{issue.title}</p>
                          <p className="text-sm text-muted-foreground mb-2">{issue.description}</p>
                        </div>
                      </div>
                      <div className="pl-6 bg-accent/10 border-l-4 border-accent p-3 rounded-r">
                        <h5 className="text-xs font-semibold text-accent mb-2">💡 수정 방법</h5>
                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                          {issue.suggestion}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </Card>
          )}

          {/* RAG 상세 근거 및 출처 (반려 시) */}
          {issues.some(i => i.severity === 'error' && i.citations && i.citations.length > 0) && (
            <Card className="p-6 bg-primary/5 border-primary/30">
              <h3 className="text-lg font-semibold text-primary mb-3 flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                관련 근거 및 보완사항 상세
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                AI가 검색한 법령/규정의 상세 근거와 보완이 필요한 사항을 제시합니다. 관련도 점수가 높을수록 직접적으로 연관됩니다.
              </p>
              <div className="space-y-4">
                {issues
                  .filter(i => i.severity === 'error' && i.citations && i.citations.length > 0)
                  .map((issue, issueIdx) => (
                    <div key={issue.id} className="bg-background border border-primary/20 rounded-lg p-4">
                      <div className="mb-3 pb-3 border-b">
                        <div className="flex items-start gap-2">
                          <span className="font-semibold text-primary min-w-[24px]">{issueIdx + 1}.</span>
                          <div className="flex-1">
                            <p className="font-semibold text-foreground mb-1">{issue.title}</p>
                            <Badge variant="destructive" className="text-xs">오류</Badge>
                          </div>
                        </div>
                      </div>
                      
                      <div className="pl-6 space-y-3">
                        {issue.citations!.map((citation, citIdx) => (
                          <div 
                            key={citIdx}
                            className="bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-lg p-3"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className="text-xs">
                                    {citation.category}
                                  </Badge>
                                  {citation.score && (
                                    <Badge 
                                      variant={citation.score >= 0.8 ? "default" : "secondary"}
                                      className="text-xs"
                                    >
                                      관련도: {(citation.score * 100).toFixed(0)}%
                                    </Badge>
                                  )}
                                </div>
                                <h5 className="font-semibold text-foreground text-sm">{citation.title}</h5>
                              </div>
                            </div>
                            
                            {citation.section_path && (
                              <div className="mb-2 bg-background/60 px-2 py-1 rounded border border-primary/10">
                                <span className="text-xs text-muted-foreground">조항 경로: </span>
                                <span className="text-xs font-medium text-foreground">{citation.section_path}</span>
                              </div>
                            )}
                            
                            <div className="bg-background/80 border-l-4 border-primary p-2 rounded-r mb-2">
                              <p className="text-sm text-foreground leading-relaxed italic">
                                "{citation.snippet}"
                              </p>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              {citation.version && (
                                <div>
                                  <span className="text-muted-foreground">버전: </span>
                                  <span className="text-foreground">{citation.version}</span>
                                </div>
                              )}
                              {citation.effective_date && (
                                <div>
                                  <span className="text-muted-foreground">시행일: </span>
                                  <span className="text-foreground">
                                    {new Date(citation.effective_date).toLocaleDateString('ko-KR', { 
                                      year: 'numeric', 
                                      month: '2-digit', 
                                      day: '2-digit' 
                                    })}
                                  </span>
                                </div>
                              )}
                              {citation.status && (
                                <div>
                                  <span className="text-muted-foreground">상태: </span>
                                  <Badge variant={citation.status === 'active' || citation.status === '활성' ? 'default' : 'secondary'} className="text-xs">
                                    {citation.status === 'active' ? '활성' : citation.status}
                                  </Badge>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </Card>
          )}
        </div>
      )}

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
                    
                    {/* 하이라이트 섹션 */}
                    {(issue.submission_highlight || issue.regulation_highlight) && (
                      <div className="space-y-3 mt-4 pt-4 border-t">
                        <h4 className="text-sm font-bold text-foreground">📌 중요 내용 하이라이트</h4>
                        
                        {issue.submission_highlight && (
                          <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                            <h5 className="text-xs font-semibold text-yellow-800 dark:text-yellow-300 mb-2">📄 제출 문서에서 발췌</h5>
                            <p className="text-sm text-yellow-900 dark:text-yellow-100 leading-relaxed italic pl-4 border-l-4 border-yellow-400">
                              "{issue.submission_highlight}"
                            </p>
                          </div>
                        )}
                        
                        {issue.regulation_highlight && (
                          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                            <h5 className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-2">📋 관련 규정에서 발췌</h5>
                            <p className="text-sm text-blue-900 dark:text-blue-100 leading-relaxed italic pl-4 border-l-4 border-blue-400">
                              "{issue.regulation_highlight}"
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 관련 법령 정보 섹션 */}
                    {issue.regulation_title && (
                      <div className="mt-4 pt-4 border-t bg-primary/5 rounded-lg p-4 border-l-4 border-primary">
                        <h4 className="text-sm font-bold text-primary mb-3 flex items-center gap-2">
                          <BookOpen className="h-4 w-4" />
                          📋 적용 규정 근거
                        </h4>
                        <div className="space-y-3 mb-3">
                          <div className="bg-background/80 p-3 rounded-md">
                            <span className="text-xs font-semibold text-muted-foreground block mb-1">규정 제목</span>
                            <span className="font-semibold text-foreground text-base">{issue.regulation_title}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-background/80 p-2 rounded-md">
                              <span className="text-xs text-muted-foreground block mb-1">카테고리</span>
                              <Badge variant="outline" className="w-fit">{issue.regulation_category}</Badge>
                            </div>
                            {issue.regulation_version && (
                              <div className="bg-background/80 p-2 rounded-md">
                                <span className="text-xs text-muted-foreground block mb-1">버전</span>
                                <span className="text-sm text-foreground">{issue.regulation_version}</span>
                              </div>
                            )}
                            {issue.regulation_effective_date && (
                              <div className="bg-background/80 p-2 rounded-md">
                                <span className="text-xs text-muted-foreground block mb-1">시행일</span>
                                <span className="text-sm text-foreground">
                                  {new Date(issue.regulation_effective_date).toLocaleDateString('ko-KR')}
                                </span>
                              </div>
                            )}
                            {issue.regulation_status && (
                              <div className="bg-background/80 p-2 rounded-md">
                                <span className="text-xs text-muted-foreground block mb-1">상태</span>
                                <Badge variant={issue.regulation_status === 'active' ? 'default' : 'secondary'} className="w-fit">
                                  {issue.regulation_status === 'active' ? '유효' : issue.regulation_status}
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>
                        {issue.regulation && (
                          <div className="bg-background/80 p-3 rounded-md border-l-2 border-primary">
                            <span className="text-xs font-semibold text-muted-foreground block mb-2">해당 조항 내용</span>
                            <p className="text-sm text-foreground leading-relaxed">{issue.regulation}</p>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* 수정 제안 섹션 */}
                    {issue.suggestion && (
                      <div className="mt-4 pt-4 border-t">
                        <div className="bg-accent/10 border border-accent/30 rounded-lg p-4">
                          <div className="flex items-start gap-2 mb-3">
                            <Lightbulb className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                            <h4 className="text-sm font-bold text-accent">💡 개선 방법 및 예시</h4>
                          </div>
                          <div className="bg-background/80 p-3 rounded-md border-l-4 border-accent">
                            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                              {issue.suggestion}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* RAG Citations 섹션 */}
                    {issue.citations && issue.citations.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                          <BookOpen className="h-4 w-4" />
                          📚 상세 규정 참조 (RAG Citations)
                        </h4>
                        <p className="text-xs text-muted-foreground mb-3">
                          AI가 검색한 관련 규정 근거들입니다. 관련도 점수가 높을수록 직접적으로 연관됩니다.
                        </p>
                        <div className="space-y-3">
                          {issue.citations.map((citation, idx) => (
                            <div 
                              key={idx}
                              className="bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-lg p-4"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="outline" className="text-xs">
                                      {citation.category}
                                    </Badge>
                                    {citation.score && (
                                      <Badge 
                                        variant={citation.score >= 0.8 ? "default" : "secondary"}
                                        className="text-xs"
                                      >
                                        관련도: {(citation.score * 100).toFixed(0)}%
                                      </Badge>
                                    )}
                                  </div>
                                  <h5 className="font-semibold text-foreground text-sm">{citation.title}</h5>
                                </div>
                              </div>
                              
                              {citation.section_path && (
                                <div className="mb-2 bg-background/60 px-2 py-1 rounded border border-primary/10">
                                  <span className="text-xs text-muted-foreground">조항 경로: </span>
                                  <span className="text-xs font-medium text-foreground">{citation.section_path}</span>
                                </div>
                              )}
                              
                              <div className="bg-background/80 border-l-4 border-primary p-3 rounded-r mb-2">
                                <p className="text-sm text-foreground leading-relaxed italic">
                                  "{citation.snippet}"
                                </p>
                              </div>
                              
                              <div className="grid grid-cols-3 gap-2 text-xs">
                                {citation.version && (
                                  <div>
                                    <span className="text-muted-foreground">버전: </span>
                                    <span className="text-foreground">{citation.version}</span>
                                  </div>
                                )}
                                {citation.effective_date && (
                                  <div>
                                    <span className="text-muted-foreground">시행일: </span>
                                    <span className="text-foreground">
                                      {new Date(citation.effective_date).toLocaleDateString('ko-KR', { 
                                        year: 'numeric', 
                                        month: '2-digit', 
                                        day: '2-digit' 
                                      })}
                                    </span>
                                  </div>
                                )}
                                {citation.status && (
                                  <div>
                                    <span className="text-muted-foreground">상태: </span>
                                    <Badge variant={citation.status === 'active' || citation.status === '활성' ? 'default' : 'secondary'} className="text-xs">
                                      {citation.status === 'active' ? '활성' : citation.status}
                                    </Badge>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notes 섹션 */}
                    {issue.notes && (
                      <div className="mt-4 pt-4 border-t">
                        <div className="bg-muted/50 border rounded-lg p-3">
                          <h4 className="text-xs font-semibold text-muted-foreground mb-2">📝 추가 참고사항</h4>
                          <p className="text-sm text-foreground">{issue.notes}</p>
                        </div>
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
