import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Bot, ArrowLeft, Eye, EyeOff, Check, X, Mail, Loader2, Github } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";

type AuthView = "signIn" | "signUp" | "forgotPassword";

function getPasswordStrength(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: "Weak", color: "bg-destructive" };
  if (score <= 2) return { score, label: "Fair", color: "bg-orange-500" };
  if (score <= 3) return { score, label: "Good", color: "bg-yellow-500" };
  return { score, label: "Strong", color: "bg-accent" };
}

const PASSWORD_RULES = [
  { test: (p: string) => p.length >= 8, label: "At least 8 characters" },
  { test: (p: string) => /[A-Z]/.test(p), label: "One uppercase letter" },
  { test: (p: string) => /[0-9]/.test(p), label: "One number" },
  { test: (p: string) => /[^A-Za-z0-9]/.test(p), label: "One special character" },
];

export default function Auth() {
  const [view, setView] = useState<AuthView>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  const handleOAuth = async (provider: "google" | "github") => {
    const setLoadingFn = provider === "google" ? setGoogleLoading : setGithubLoading;
    setLoadingFn(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: provider === "github" ? "read:user user:email repo" : undefined,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      toast({ title: "OAuth Error", description: error.message, variant: "destructive" });
      setLoadingFn(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (view === "signUp" && !agreedToTerms) {
      toast({ title: "Error", description: "Please agree to the Terms of Service and Privacy Policy", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      if (view === "signUp") {
        await signUp(email, password, displayName);
        toast({ title: "Check your email", description: "We sent you a verification link to confirm your account." });
        setView("signIn");
        setPassword("");
      } else {
        await signIn(email, password);
        navigate("/dashboard");
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({ title: "Error", description: "Enter your email address", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (error) throw error;
      toast({ title: "Reset link sent", description: "Check your email for a password reset link." });
      setView("signIn");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <Button variant="ghost" className="mb-6" onClick={() => navigate("/")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>

        <Card className="glass glow-primary">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl font-display">
              {view === "forgotPassword" ? "Reset Password" : view === "signUp" ? "Create Account" : "Welcome Back"}
            </CardTitle>
            <CardDescription>
              {view === "forgotPassword"
                ? "Enter your email and we'll send a reset link"
                : view === "signUp"
                ? "Start collaborating with your team"
                : "Sign in to your workspace"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {view === "forgotPassword" ? (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@team.com" required className="pl-10" />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Sending..." : "Send Reset Link"}
                </Button>
                <button type="button" onClick={() => setView("signIn")} className="w-full text-sm text-muted-foreground hover:text-primary transition-colors text-center">
                  Back to Sign In
                </button>
              </form>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 gap-2"
                  onClick={() => handleOAuth("google")}
                  disabled={googleLoading}
                >
                  {googleLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                  )}
                  Continue with Google
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 gap-2 mt-2"
                  onClick={() => handleOAuth("github")}
                  disabled={githubLoading}
                >
                  {githubLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Github className="h-4 w-4" />}
                  Continue with GitHub
                </Button>

                <div className="relative my-6">
                  <Separator />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
                    or
                  </span>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {view === "signUp" && (
                    <div className="space-y-2">
                      <Label htmlFor="name">Display Name</Label>
                      <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" required />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@team.com" required className="pl-10" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      {view === "signIn" && (
                        <button type="button" onClick={() => setView("forgotPassword")} className="text-xs text-primary hover:underline">
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        minLength={8} // Aligned with password strength UI constraints
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>

                    {view === "signUp" && password.length > 0 && (
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${strength.color}`}
                              style={{ width: `${(strength.score / 5) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{strength.label}</span>
                        </div>
                         <ul className="space-y-1">
                          {PASSWORD_RULES.map((rule) => (
                            <li key={rule.label} className="flex items-center gap-1.5 text-xs">
                              {rule.test(password) ? (
                                <Check className="h-3 w-3 text-accent" />
                              ) : (
                                <X className="h-3 w-3 text-muted-foreground" />
                              )}
                              <span className={rule.test(password) ? "text-accent" : "text-muted-foreground"}>{rule.label}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {view === "signUp" && (
                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="terms"
                        checked={agreedToTerms}
                        onCheckedChange={(c) => setAgreedToTerms(c === true)}
                        className="mt-0.5"
                      />
                      <label htmlFor="terms" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                        I agree to the{" "}
                        <a href="/terms" className="text-primary hover:underline" target="_blank" rel="noopener">Terms of Service</a>{" "}
                        and{" "}
                        <a href="/privacy" className="text-primary hover:underline" target="_blank" rel="noopener">Privacy Policy</a>
                      </label>
                    </div>
                  )}

                  <Button type="submit" className="w-full" disabled={loading || (view === "signUp" && !agreedToTerms)}>
                    {loading ? "Loading..." : view === "signUp" ? "Create Account" : "Sign In"}
                  </Button>
                </form>
              </>
            )}

            {view !== "forgotPassword" && (
              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => setView(view === "signUp" ? "signIn" : "signUp")}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  {view === "signUp" ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
