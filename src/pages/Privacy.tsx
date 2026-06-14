import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Bot, ArrowLeft } from "lucide-react";

export default function Privacy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 inset-x-0 z-50 glass">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
              <Bot className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-display font-bold">DevAgent</span>
          </div>
          <Button variant="ghost" onClick={() => navigate(-1 as any)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto pt-28 pb-20 px-6">
        <h1 className="text-4xl font-display font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: February 24, 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-foreground/90">
          <section>
            <h2 className="text-xl font-display font-semibold mb-3">1. Information We Collect</h2>
            <p className="text-muted-foreground leading-relaxed">
              We collect information you provide directly: email address, display name, and profile information. When you connect GitHub repositories, we access repository metadata and code content through the GitHub API with your authorization.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-3">2. How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use your information to: (a) provide and improve the Service; (b) power AI-assisted code analysis and generation; (c) enable team collaboration features; (d) send service-related communications; (e) ensure platform security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-3">3. AI & Code Processing</h2>
            <p className="text-muted-foreground leading-relaxed">
              Code snippets and conversations are sent to AI models to generate responses. We do not use your proprietary code to train AI models. Conversation history is stored to provide continuity within your workspace. You can delete conversations at any time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-3">4. Data Sharing</h2>
            <p className="text-muted-foreground leading-relaxed">
              We do not sell your personal information. We share data only with: (a) AI service providers for generating responses (code context only, not personal data); (b) infrastructure providers necessary to operate the Service; (c) law enforcement when required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-3">5. Data Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              We implement industry-standard security measures including encryption in transit and at rest, row-level security policies, and access controls. However, no system is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-3">6. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your data for as long as your account is active. Upon account deletion, we remove your personal data within 30 days. Some anonymized, aggregated data may be retained for analytics purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-3">7. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed">
              You have the right to: (a) access your personal data; (b) correct inaccurate data; (c) delete your account and associated data; (d) export your data; (e) withdraw consent for optional processing. Contact us to exercise these rights.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-3">8. Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use essential cookies for authentication and session management. We do not use tracking or advertising cookies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-3">9. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy periodically. We will notify you of significant changes via email or in-app notification. Continued use after changes constitutes acceptance.
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <span>© 2026 DevAgent</span>
          <div className="flex gap-4">
            <button onClick={() => navigate("/terms")} className="hover:text-foreground transition-colors">Terms</button>
            <button onClick={() => navigate("/privacy")} className="hover:text-foreground transition-colors">Privacy</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
