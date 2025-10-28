import { useState, useEffect } from "react";
import { Shield, Plus, Trash2, Edit, FileText, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { z } from "zod";

const regulationSchema = z.object({
  title: z.string().min(1, "제목을 입력해주세요").max(200, "제목은 200자 이하여야 합니다"),
  description: z.string().max(1000, "설명은 1000자 이하여야 합니다").optional(),
  category: z.string().min(1, "카테고리를 선택해주세요"),
  version: z.string().max(50, "버전은 50자 이하여야 합니다").optional(),
  effectiveDate: z.string().optional(),
});

interface Regulation {
  id: string;
  title: string;
  description: string | null;
  category: string;
  file_path: string;
  version: string | null;
  effective_date: string | null;
  status: string;
  created_at: string;
}

const Admin = () => {
  const [regulations, setRegulations] = useState<Regulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    version: "",
    effectiveDate: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchRegulations();
  }, []);

  const fetchRegulations = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("regulations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "데이터 조회 실패",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setRegulations(data || []);
    }
    setLoading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setSelectedFile(file);
    } else {
      toast({
        title: "잘못된 파일 형식",
        description: "PDF 파일만 업로드 가능합니다.",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async () => {
    setFormErrors({});

    if (!selectedFile) {
      toast({
        title: "파일을 선택해주세요",
        description: "규정 문서 PDF 파일을 업로드해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      regulationSchema.parse(formData);

      // Upload file to storage
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user?.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("regulations")
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      // Insert metadata to database
      const { error: dbError } = await supabase.from("regulations").insert({
        title: formData.title,
        description: formData.description || null,
        category: formData.category,
        version: formData.version || null,
        effective_date: formData.effectiveDate || null,
        file_path: filePath,
        file_size: selectedFile.size,
        uploaded_by: user?.id,
        status: "active",
      });

      if (dbError) throw dbError;

      toast({
        title: "업로드 성공",
        description: "규정 문서가 성공적으로 등록되었습니다.",
      });

      setIsDialogOpen(false);
      setFormData({ title: "", description: "", category: "", version: "", effectiveDate: "" });
      setSelectedFile(null);
      fetchRegulations();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            errors[err.path[0] as string] = err.message;
          }
        });
        setFormErrors(errors);
      } else {
        toast({
          title: "업로드 실패",
          description: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
          variant: "destructive",
        });
      }
    }
  };

  const handleDelete = async (id: string, filePath: string) => {
    if (!confirm("이 규정 문서를 삭제하시겠습니까?")) return;

    const { error: storageError } = await supabase.storage
      .from("regulations")
      .remove([filePath]);

    if (storageError) {
      toast({
        title: "파일 삭제 실패",
        description: storageError.message,
        variant: "destructive",
      });
      return;
    }

    const { error: dbError } = await supabase
      .from("regulations")
      .delete()
      .eq("id", id);

    if (dbError) {
      toast({
        title: "데이터 삭제 실패",
        description: dbError.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "삭제 완료",
        description: "규정 문서가 삭제되었습니다.",
      });
      fetchRegulations();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card shadow-soft">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-primary">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">관리자 페이지</h1>
                <p className="text-sm text-muted-foreground">규정 문서 관리</p>
              </div>
            </div>
            <Button onClick={() => window.location.href = "/"} variant="outline">
              검토 시스템으로
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-foreground">
              등록된 규정 문서 ({regulations.length})
            </h2>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-primary">
                  <Plus className="w-4 h-4 mr-2" />
                  규정 문서 추가
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>새 규정 문서 등록</DialogTitle>
                  <DialogDescription>
                    의료기기 허가 관련 규정 문서를 업로드하세요
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="file">파일 (PDF)</Label>
                    <Input
                      id="file"
                      type="file"
                      accept=".pdf"
                      onChange={handleFileChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="title">제목 *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="예: 의료기기법 시행규칙"
                    />
                    {formErrors.title && (
                      <p className="text-sm text-destructive">{formErrors.title}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">카테고리 *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({ ...formData, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="카테고리 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="법령">법령</SelectItem>
                        <SelectItem value="시행규칙">시행규칙</SelectItem>
                        <SelectItem value="가이드라인">가이드라인</SelectItem>
                        <SelectItem value="고시">고시</SelectItem>
                        <SelectItem value="기타">기타</SelectItem>
                      </SelectContent>
                    </Select>
                    {formErrors.category && (
                      <p className="text-sm text-destructive">{formErrors.category}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">설명</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="규정 문서에 대한 간단한 설명"
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="version">버전</Label>
                      <Input
                        id="version"
                        value={formData.version}
                        onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                        placeholder="예: v1.0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="effectiveDate">시행일</Label>
                      <Input
                        id="effectiveDate"
                        type="date"
                        value={formData.effectiveDate}
                        onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    취소
                  </Button>
                  <Button onClick={handleSubmit}>등록</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>제목</TableHead>
                  <TableHead>카테고리</TableHead>
                  <TableHead>버전</TableHead>
                  <TableHead>시행일</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      로딩 중...
                    </TableCell>
                  </TableRow>
                ) : regulations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      등록된 규정 문서가 없습니다
                    </TableCell>
                  </TableRow>
                ) : (
                  regulations.map((regulation) => (
                    <TableRow key={regulation.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-primary" />
                          {regulation.title}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{regulation.category}</Badge>
                      </TableCell>
                      <TableCell>{regulation.version || "-"}</TableCell>
                      <TableCell>
                        {regulation.effective_date ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(regulation.effective_date).toLocaleDateString("ko-KR")}
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={regulation.status === "active" ? "default" : "secondary"}>
                          {regulation.status === "active" ? "활성" : regulation.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(regulation.id, regulation.file_path)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Admin;
