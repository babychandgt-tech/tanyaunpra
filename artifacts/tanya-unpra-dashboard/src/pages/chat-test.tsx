import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, RefreshCw, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  source?: "intent" | "ai" | "fallback";
  confidence?: number;
  needsReview?: boolean;
  timestamp: Date;
}

const SOURCE_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  intent: { label: "Intent", variant: "default" },
  ai: { label: "AI", variant: "secondary" },
  fallback: { label: "Fallback", variant: "destructive" },
};

export default function ChatTest() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  async function sendMessage() {
    const question = input.trim();
    if (!question || isLoading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: question,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/chat/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question, sessionId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Gagal mengirim pesan");
      }

      const data = await res.json();
      setSessionId(data.sessionId);

      const botMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.answer,
        source: data.source,
        confidence: data.confidence,
        needsReview: data.needsReview,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Gagal mengirim pesan",
        description: err instanceof Error ? err.message : "Terjadi kesalahan",
      });
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function resetChat() {
    setMessages([]);
    setSessionId(undefined);
    setInput("");
    inputRef.current?.focus();
  }

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-7rem)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Test Chatbot</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Uji coba langsung respons AI asisten Tanya UNPRA
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={resetChat} disabled={isLoading || messages.length === 0}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Reset Chat
        </Button>
      </div>

      <Card className="flex flex-col flex-1 overflow-hidden">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-sm">Tanya UNPRA</CardTitle>
              <CardDescription className="text-xs">Asisten Informasi Akademik</CardDescription>
            </div>
            {sessionId && (
              <Badge variant="outline" className="ml-auto text-xs font-mono">
                Session aktif
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex flex-col flex-1 p-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-16 text-center gap-3">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                  <Bot className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-sm">Mulai percakapan</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    Tanyakan seputar jadwal kuliah, pengumuman, kalender akademik, dan informasi kampus lainnya
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center mt-2">
                  {["Jadwal kuliah hari ini apa?", "Ada pengumuman terbaru?", "Kapan UTS semester ini?"].map((q) => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); inputRef.current?.focus(); }}
                      className="text-xs px-3 py-1.5 rounded-full border border-border bg-muted hover:bg-muted/80 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                    <div className={`h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-medium ${
                      msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}>
                      {msg.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    </div>
                    <div className={`flex flex-col gap-1 max-w-[75%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                      <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-sm"
                          : "bg-muted text-foreground rounded-tl-sm"
                      }`}>
                        {msg.content}
                      </div>
                      <div className="flex items-center gap-1.5 px-1">
                        <span className="text-xs text-muted-foreground">
                          {msg.timestamp.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {msg.source && (
                          <>
                            <span className="text-muted-foreground text-xs">·</span>
                            <Badge variant={SOURCE_LABEL[msg.source]?.variant ?? "outline"} className="text-xs h-4 px-1.5 py-0">
                              {SOURCE_LABEL[msg.source]?.label ?? msg.source}
                            </Badge>
                          </>
                        )}
                        {msg.confidence !== undefined && (
                          <>
                            <span className="text-muted-foreground text-xs">·</span>
                            <span className="text-xs text-muted-foreground">{Math.round(msg.confidence * 100)}%</span>
                          </>
                        )}
                        {msg.needsReview && (
                          <Info className="h-3 w-3 text-yellow-500" aria-label="Perlu review" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3 flex-row">
                    <div className="h-8 w-8 rounded-full flex-shrink-0 bg-muted flex items-center justify-center">
                      <Bot className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className="p-4 border-t">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ketik pertanyaan kamu di sini..."
                disabled={isLoading}
                className="flex-1"
                data-testid="chat-input"
                autoFocus
              />
              <Button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                size="icon"
                data-testid="chat-send"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Tekan Enter untuk kirim · Badge menunjukkan sumber jawaban (Intent / AI / Fallback) dan tingkat kepercayaan
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
