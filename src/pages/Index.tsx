import { useState } from "react";
import { FileText, Shield, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileUploader } from "@/components/FileUploader";
import { AnalysisProgress } from "@/components/AnalysisProgress";
import { AnalysisResults, AnalysisIssue } from "@/components/AnalysisResults";
import { useToast } from "@/hooks/use-toast";

type AnalysisState = "idle" | "analyzing" | "completed";

const Index = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysisState, setAnalysisState] = useState<AnalysisState>("idle");
  const [progress, setProgress] = useState(0);
  const [analysisResults, setAnalysisResults] = useState<{
    issues: AnalysisIssue[];
    status: "approved" | "rejected" | "needs-revision";
  } | null>(null);
  const { toast } = useToast();

  const getStepStatus = (stepIndex: number): "pending" | "in-progress" | "completed" | "error" => {
    if (analysisState === "idle") return "pending";
    if (analysisState === "completed") return "completed";
    
    const progressThresholds = [0, 25, 50, 75, 100];
    const threshold = progressThresholds[stepIndex];
    const nextThreshold = progressThresholds[stepIndex + 1] || 100;
    
    if (progress > nextThreshold) return "completed";
    if (progress > threshold) return "in-progress";
    return "pending";
  };

  const analysisSteps = [
    { id: "1", title: "PDF 파일 읽기 및 텍스트 추출", status: getStepStatus(0) },
    { id: "2", title: "문서 구조 분석", status: getStepStatus(1) },
    { id: "3", title: "규정 준수 여부 확인", status: getStepStatus(2) },
    { id: "4", title: "AI 기반 내용 검토", status: getStepStatus(3) },
    { id: "5", title: "최종 리포트 생성", status: getStepStatus(4) },
  ];

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    toast({
      title: "파일 업로드 완료",
      description: `${file.name} 파일이 선택되었습니다.`,
    });
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setAnalysisState("idle");
    setProgress(0);
    setAnalysisResults(null);
  };

  const simulateAnalysis = () => {
    setAnalysisState("analyzing");
    setProgress(0);

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setAnalysisState("completed");
          
          // 시뮬레이션된 분석 결과
          setAnalysisResults({
            status: "needs-revision",
            issues: [
              {
                id: "1",
                category: "작용원리",
                severity: "error",
                title: "멸균/비멸균 표기 혼용",
                description: "작용원리 섹션에서 '멸균' 및 '비멸균' 표현이 동시에 사용되었습니다.",
                location: "페이지 3, 작용원리 섹션 2번째 단락",
                suggestion: "제품의 멸균 여부를 명확히 하여 하나의 표현만 사용하시기 바랍니다.",
                regulation: "의료기기법 시행규칙 제23조 제1항",
              },
              {
                id: "2",
                category: "치수 및 형상",
                severity: "warning",
                title: "치수 표기 단위 불일치",
                description: "일부 치수가 mm로, 일부는 cm로 표기되어 일관성이 부족합니다.",
                location: "페이지 5, 치수 및 형상 표",
                suggestion: "모든 치수를 동일한 단위(mm 권장)로 통일하여 표기하시기 바랍니다.",
                regulation: "의료기기 기술문서 작성 가이드라인 3.2절",
              },
              {
                id: "3",
                category: "원재료",
                severity: "error",
                title: "원재료 안전성 자료 누락",
                description: "사용된 원재료 중 생체적합성 시험 결과가 누락되었습니다.",
                location: "페이지 8, 원재료 명세 표",
                suggestion: "ISO 10993 기준에 따른 생체적합성 시험 결과를 추가하시기 바랍니다.",
                regulation: "의료기기법 제6조, ISO 10993",
              },
            ],
          });
          
          return 100;
        }
        return prev + 5;
      });
    }, 200);
  };

  const handleAnalyze = () => {
    if (!selectedFile) {
      toast({
        title: "파일을 선택해주세요",
        description: "분석할 PDF 파일을 먼저 업로드해주세요.",
        variant: "destructive",
      });
      return;
    }

    simulateAnalysis();
    toast({
      title: "분석 시작",
      description: "신고서 검토를 시작합니다. 잠시만 기다려주세요.",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 헤더 */}
      <header className="border-b bg-card shadow-soft">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-primary">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                의료기기 허가 신고서 자동 검토 시스템
              </h1>
              <p className="text-sm text-muted-foreground">
                AI 기반 규정 준수 검사 및 문서 분석
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* 소개 섹션 */}
          {analysisState === "idle" && !selectedFile && (
            <div className="text-center space-y-4 animate-fade-in">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
                <Sparkles className="w-4 h-4" />
                <span>AI 자동 검토</span>
              </div>
              <h2 className="text-3xl font-bold text-foreground">
                신고서를 업로드하고 자동 검토를 시작하세요
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                의료기기 허가 신고서를 업로드하면 AI가 자동으로 규정 준수 여부를 검토하고,
                필요한 수정사항을 제안합니다.
              </p>
            </div>
          )}

          {/* 파일 업로더 */}
          <FileUploader
            onFileSelect={handleFileSelect}
            selectedFile={selectedFile}
            onClear={handleClearFile}
          />

          {/* 분석 버튼 */}
          {selectedFile && analysisState === "idle" && (
            <div className="flex justify-center animate-fade-in">
              <Button
                size="lg"
                onClick={handleAnalyze}
                className="bg-gradient-primary shadow-medium hover:shadow-soft transition-all"
              >
                <FileText className="w-5 h-5 mr-2" />
                검토 시작
              </Button>
            </div>
          )}

          {/* 분석 진행 상태 */}
          {analysisState === "analyzing" && (
            <AnalysisProgress steps={analysisSteps} currentProgress={progress} />
          )}

          {/* 분석 결과 */}
          {analysisState === "completed" && analysisResults && (
            <AnalysisResults
              issues={analysisResults.issues}
              overallStatus={analysisResults.status}
            />
          )}
        </div>
      </main>

      {/* 푸터 */}
      <footer className="border-t mt-16">
        <div className="container mx-auto px-4 py-6">
          <p className="text-center text-sm text-muted-foreground">
            © 2025 의료기기 자동 검토 시스템. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
