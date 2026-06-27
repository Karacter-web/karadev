import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Bot, ArrowLeft } from "lucide-react";
import { SEO } from "@/components/SEO";

export default function Terms() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <SEO title={"Terms of Service — Karadev"} description={"Karadev's terms of service covering acceptable use, accounts, and liability."} path={"/terms"} />
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
        <h1 className="text-4xl font-display font-bold mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last updated: February 24, 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-foreground/90">
          <section>
            <h2 className="text-xl font-display font-semibold mb-3">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using DevAgent ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-3">2. Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              DevAgent is an AI-powered collaborative development platform that allows teams to connect GitHub repositories, interact with an AI coding assistant, manage tasks, and collaborate on software development projects.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-3">3. User Accounts</h2>
            <p className="text-muted-foreground leading-relaxed">
              You are responsible for maintaining the confidentiality of your account credentials. You agree to accept responsibility for all activities that occur under your account. You must be at least 18 years old to create an account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-3">4. Acceptable Use</h2>
            <p className="text-muted-foreground leading-relaxed">
              You agree not to use the Service to: (a) violate any applicable laws; (b) infringe on intellectual property rights; (c) transmit malicious code; (d) attempt to gain unauthorized access to other systems; (e) use AI-generated output for harmful or deceptive purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-3">5. Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              You retain ownership of your code and content. AI-generated suggestions are provided as-is for your use. DevAgent does not claim ownership of code generated through the platform. You are responsible for reviewing and validating all AI-generated code before use in production.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-3">6. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Service is provided "as is" without warranties of any kind. DevAgent shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service. AI-generated code is not guaranteed to be correct, secure, or production-ready.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-3">7. Termination</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to suspend or terminate your account at any time for violations of these terms. You may delete your account at any time through the settings page.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-3">8. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may modify these terms at any time. Continued use of the Service after changes constitutes acceptance of the new terms. We will notify users of material changes via email or in-app notification.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-3">9. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              For questions about these Terms, please contact us through the application's support channels.
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
