import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Send, User, Sparkles } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const suggestedPrompts = [
  "How can I improve my sleep?",
  "Post-workout recovery tips",
  "Help me manage stress",
  "What supplements should I take?",
];

const mockResponses: Record<string, string> = {
  default: "That's a great question! Based on your health data, I'd recommend starting with small, consistent changes. Would you like me to create a personalized plan for you?",
  sleep: "**Here are some tips to improve your sleep:**\n\n1. **Stick to a schedule** — Go to bed and wake up at the same time daily\n2. **Limit screens** — No phones/laptops 1 hour before bed\n3. **Cool environment** — Keep your bedroom at 65-68°F\n4. **Magnesium** — Consider a magnesium glycinate supplement\n5. **Wind-down routine** — Try 10 minutes of deep breathing\n\nYour recent data shows you're averaging 7.2 hours — let's aim for 7.5 this week! 🌙",
  recovery: "**Post-workout recovery essentials:**\n\n- 🥤 **Hydrate** — Drink 16-24oz water within 30 minutes\n- 🍌 **Protein + carbs** — Eat within 45 minutes (aim for 20-30g protein)\n- 🧊 **Cold therapy** — Try a 2-min cold shower\n- 🧘 **Stretch** — 10 minutes of gentle stretching\n- 😴 **Rest** — Ensure 7-8 hours of sleep tonight\n\nI noticed your step count was high today — great job staying active!",
  stress: "**Stress management strategies based on your profile:**\n\n1. **Box breathing** — 4 seconds in, hold 4, out 4, hold 4. Repeat 5 times\n2. **Movement** — Even a 10-minute walk can reduce cortisol by 15%\n3. **Journaling** — Write 3 things you're grateful for each evening\n4. **Adaptogens** — Ashwagandha has shown promise for stress reduction\n\nYour heart rate has been steady at 72 bpm — that's a good sign! Let's keep it that way. 💚",
  supplements: "**Recommended supplements based on your health profile:**\n\n| Supplement | Benefit | Timing |\n|---|---|---|\n| Vitamin D3 | Immune support, mood | Morning |\n| Omega-3 | Heart & brain health | With meals |\n| Magnesium | Sleep, recovery | Evening |\n| Probiotics | Gut health | Morning |\n\nAll of these are available in our **Health Shop** — want me to add them to your cart? 🛒",
};

function getResponse(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes("sleep")) return mockResponses.sleep;
  if (lower.includes("recovery") || lower.includes("workout")) return mockResponses.recovery;
  if (lower.includes("stress") || lower.includes("anxiety")) return mockResponses.stress;
  if (lower.includes("supplement") || lower.includes("vitamin")) return mockResponses.supplements;
  return mockResponses.default;
}

export default function AICoach() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hi Jane! 👋 I'm your AI health coach. I can help with nutrition, exercise, sleep, stress management, and more. What would you like to work on today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    setTimeout(() => {
      const response = getResponse(text);
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "assistant", content: response },
      ]);
      setIsTyping(false);
    }, 1200);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="p-4 border-b border-border bg-card">
        <div className="flex items-center gap-3 max-w-3xl mx-auto">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-foreground">AI Health Coach</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" />
              Online — powered by AI
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto space-y-4">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
              >
                {msg.role === "assistant" && (
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                )}
                <Card className={`max-w-[80%] px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card"
                }`}>
                  <div className={`text-sm whitespace-pre-wrap leading-relaxed ${
                    msg.role === "user" ? "text-primary-foreground" : "text-foreground"
                  }`}>
                    {msg.content.split("\n").map((line, i) => {
                      const bold = line.replace(/\*\*(.*?)\*\*/g, "");
                      return <p key={i} className={line === "" ? "h-2" : ""}>{bold || line}</p>;
                    })}
                  </div>
                </Card>
                {msg.role === "user" && (
                  <div className="h-8 w-8 rounded-full bg-foreground/10 flex items-center justify-center shrink-0 mt-1">
                    <User className="h-4 w-4 text-foreground" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {isTyping && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <Card className="px-4 py-3 bg-card">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="h-2 w-2 rounded-full bg-muted-foreground/40"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                    />
                  ))}
                </div>
              </Card>
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Suggested prompts */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2">
          <div className="max-w-3xl mx-auto flex flex-wrap gap-2">
            {suggestedPrompts.map((p) => (
              <Button
                key={p}
                variant="outline"
                size="sm"
                className="text-xs rounded-full hover:bg-primary/5 hover:border-primary/30"
                onClick={() => sendMessage(p)}
              >
                {p}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-border bg-card">
        <form
          className="max-w-3xl mx-auto flex gap-2"
          onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
        >
          <Input
            placeholder="Ask your health coach..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={!input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
