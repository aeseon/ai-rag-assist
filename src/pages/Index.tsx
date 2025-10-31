import { useState } from "react";
import { FileText, Shield, Sparkles, LogOut, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileUploader } from "@/components/FileUploader";
import { AnalysisProgress } from "@/components/AnalysisProgress";
import AnalysisResults from "@/components/AnalysisResults";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type AnalysisState = "idle" | "analyzing" | "completed";

const Index = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysisState, setAnalysisState] = useState<AnalysisState>("idle");
  const [progress, setProgress] = useState(0);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const { toast } = useToast();
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

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

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setAnalysisState("analyzing");
    setProgress(20);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('인증이 필요합니다');
      }

      // Upload file to storage
      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('submissions')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      setProgress(40);

      // Create submission record
      const { data: submission, error: submissionError } = await supabase
        .from('submissions')
        .insert({
          user_id: user.id,
          title: file.name,
          file_path: filePath,
          file_size: file.size,
          status: 'pending',
        })
        .select()
        .single();

      if (submissionError) throw submissionError;

      setProgress(60);

      // Process document
      const { error: processError } = await supabase.functions.invoke('process-document', {
        body: {
          submissionId: submission.id,
          filePath,
          isRegulation: false,
        },
      });

      if (processError) {
        console.error('Processing error:', processError);
      }

      setProgress(80);

      // Analyze submission
      const { error: analyzeError } = await supabase.functions.invoke('analyze-submission', {
        body: { submissionId: submission.id },
      });

      if (analyzeError) {
        console.error('Analysis error:', analyzeError);
      }

      setProgress(100);
      setSelectedSubmissionId(submission.id);
      setAnalysisState("completed");

      toast({
        title: "분석 완료",
        description: "문서 검토가 완료되었습니다.",
      });

    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "오류 발생",
        description: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
        variant: "destructive",
      });
      setAnalysisState("idle");
      setSelectedFile(null);
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setAnalysisState("idle");
    setProgress(0);
    setSelectedSubmissionId(null);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 헤더 */}
      <header className="border-b bg-card shadow-soft">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
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
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Button
                  variant="outline"
                  onClick={() => navigate("/admin")}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  관리자 페이지
                </Button>
              )}
              <Button variant="ghost" onClick={signOut}>
                <LogOut className="w-4 h-4 mr-2" />
                로그아웃
              </Button>
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

          {/* 분석 진행 상태 */}
          {analysisState === "analyzing" && (
            <AnalysisProgress steps={analysisSteps} currentProgress={progress} />
          )}

          {/* 분석 결과 */}
          {analysisState === "completed" && selectedSubmissionId && (
            <AnalysisResults submissionId={selectedSubmissionId} />
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
