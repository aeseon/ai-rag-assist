import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Shield, Mail, Lock, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("올바른 이메일을 입력해주세요"),
  password: z.string().min(6, "비밀번호는 최소 6자 이상이어야 합니다"),
});

const signupSchema = loginSchema.extend({
  fullName: z.string().min(2, "이름은 최소 2자 이상이어야 합니다").max(50, "이름은 50자 이하여야 합니다"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "비밀번호가 일치하지 않습니다",
  path: ["confirmPassword"],
});

const Auth = () => {
  const { user, signIn, signUp } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  
  // Login form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginErrors, setLoginErrors] = useState<{ email?: string; password?: string }>({});

  // Signup form
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [signupErrors, setSignupErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
    fullName?: string;
  }>({});

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErrors({});

    try {
      loginSchema.parse({ email: loginEmail, password: loginPassword });
      setIsLoading(true);
      await signIn(loginEmail, loginPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: any = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            errors[err.path[0]] = err.message;
          }
        });
        setLoginErrors(errors);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupErrors({});

    try {
      signupSchema.parse({
        email: signupEmail,
        password: signupPassword,
        confirmPassword,
        fullName,
      });
      setIsLoading(true);
      await signUp(signupEmail, signupPassword, fullName);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: any = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            errors[err.path[0]] = err.message;
          }
        });
        setSignupErrors(errors);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="p-2 rounded-lg bg-gradient-primary">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            의료기기 검토 시스템
          </h1>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">로그인</TabsTrigger>
            <TabsTrigger value="signup">회원가입</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">이메일</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="your@email.com"
                    className="pl-10"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>
                {loginErrors.email && (
                  <p className="text-sm text-destructive">{loginErrors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password">비밀번호</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••"
                    className="pl-10"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                </div>
                {loginErrors.password && (
                  <p className="text-sm text-destructive">{loginErrors.password}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "로그인 중..." : "로그인"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-name">이름</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="홍길동"
                    className="pl-10"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                {signupErrors.fullName && (
                  <p className="text-sm text-destructive">{signupErrors.fullName}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-email">이메일</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="your@email.com"
                    className="pl-10"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    required
                  />
                </div>
                {signupErrors.email && (
                  <p className="text-sm text-destructive">{signupErrors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-password">비밀번호</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••"
                    className="pl-10"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                  />
                </div>
                {signupErrors.password && (
                  <p className="text-sm text-destructive">{signupErrors.password}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">비밀번호 확인</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="••••••"
                    className="pl-10"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                {signupErrors.confirmPassword && (
                  <p className="text-sm text-destructive">{signupErrors.confirmPassword}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "가입 중..." : "회원가입"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};

export default Auth;
