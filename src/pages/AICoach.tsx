import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Send, User, Sparkles, Paperclip } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const suggestedPrompts = [
  "How can I improve my sleep?",
  "Explain my test results in sinmple language",
  "Help me manage stress",
  "What supplements should I take?",
  "Book me an Appointment",
];

const PATIENT_ID = "PT0001";
const API_URL = "http://127.0.0.1:8002/api/chat";

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
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = async (text: string, file?: File | null) => {
    if (!text.trim() && !file) return;
    let content = text || "";
    if (file && file.name) {
      content = content ? `${content}\n\n[Attachment: ${file.name}]` : `[Attachment: ${file.name}]`;
    }
    const userMsg: Message = { id: Date.now().toString(), role: "user", content };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setAttachedFile(null);
    setIsTyping(true);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient_id: PATIENT_ID, message: content, session_id: sessionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail ?? `Server error ${res.status}`);
      }
      setSessionId(data.session_id);
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "assistant", content: data.response },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `Error: ${msg}`,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setAttachedFile(f);
  };

  const clearAttachment = () => setAttachedFile(null);

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
          className="max-w-3xl mx-auto flex gap-2 items-center"
          onSubmit={(e) => { e.preventDefault(); sendMessage(input, attachedFile); }}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
          />

          <Button type="button" variant="ghost" size="icon" onClick={handleAttachClick}>
            <Paperclip className="h-4 w-4" />
          </Button>

          {attachedFile && (
            <div className="flex items-center gap-2 px-3 py-1 bg-muted rounded-full text-sm">
              <span className="truncate max-w-xs">{attachedFile.name}</span>
              <Button type="button" size="icon" variant="ghost" onClick={clearAttachment}>
                ✕
              </Button>
            </div>
          )}

          <Input
            placeholder="Ask your health coach..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={!input.trim() && !attachedFile}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
