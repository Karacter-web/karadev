import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Bot, GitBranch, Users, MessageSquare, Zap, ArrowRight, CheckCircle } from "lucide-react";
import { SEO } from "@/components/SEO";

const features = [
  { icon: GitBranch, title: "Connect Repos", desc: "Link your GitHub repositories and give the AI full codebase context." },
  { icon: MessageSquare, title: "AI Chat", desc: "Ask questions, generate code, and get explanations — all context-aware." },
  { icon: Users, title: "Team Collab", desc: "Share AI conversations, assign tasks, and review suggestions together." },
  { icon: Zap, title: "Task Tracking", desc: "Turn AI suggestions into actionable tasks. Track progress to done." },
];

const steps = [
  "Sign up and create a workspace",
  "Connect your GitHub repos",
  "Chat with AI about your codebase",
  "Collaborate with your team",
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <SEO title={"Karadev — AI Teammate for Your Codebase"} description={"Karadev connects your GitHub repos to an AI teammate that understands your code and collaborates with your team in real time."} path={"/"} />
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 glass">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
              <Bot className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-display font-bold">Karadev</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate("/auth")}>Sign In</Button>
            <Button onClick={() => navigate("/auth")}>Get Started</Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-1/3 w-[500px] h-[500px] bg-primary/8 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-accent/8 rounded-full blur-3xl" />
        </div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-sm text-primary mb-8">
              <Zap className="h-3.5 w-3.5" /> AI-Powered Development
            </div>
            <h1 className="text-5xl md:text-7xl font-display font-bold tracking-tight leading-[1.1] mb-6">
              Your codebase,
              <br />
              <span className="gradient-text">your AI teammate.</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              Connect your GitHub repos, chat with an AI that actually understands your code, and collaborate with your team — all from one dashboard.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Button size="lg" onClick={() => navigate("/auth")} className="text-base px-8 h-12">
                Start Building <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/auth")} className="text-base px-8 h-12">
                View Demo
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">Everything your team needs</h2>
            <p className="text-muted-foreground text-lg">From repo connection to task tracking — one unified workflow.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="glass rounded-2xl p-6 hover:border-primary/30 transition-colors"
              >
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-display font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">Get started in minutes</h2>
          </div>
          <div className="space-y-4">
            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-4 glass rounded-xl p-5"
              >
                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold shrink-0">
                  {i + 1}
                </div>
                <span className="text-base font-medium">{step}</span>
                <CheckCircle className="h-5 w-5 text-accent ml-auto shrink-0" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">Ready to supercharge your workflow?</h2>
          <p className="text-muted-foreground text-lg mb-8">Join teams using DevAgent to ship faster with AI-powered collaboration.</p>
          <Button size="lg" onClick={() => navigate("/auth")} className="text-base px-8 h-12">
            Get Started Free <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            <span>Karadev</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/terms")} className="hover:text-foreground transition-colors">Terms</button>
            <button onClick={() => navigate("/privacy")} className="hover:text-foreground transition-colors">Privacy</button>
            <span>© 2026 Karadev</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
