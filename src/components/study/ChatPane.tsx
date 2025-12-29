import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, Loader2, Flag, MessageSquare } from "lucide-react";
import { StudyMode, DocumentTypeHint } from "@/pages/Study";
import { ProofButtons } from "./ProofButtons";
import { ReportDialog, ReportPayload } from "./ReportDialog";
import { insertLearningEvent } from "@/lib/learningEvents";

const SUPABASE_URL = "https://dsvpodsvrxwgfqnuojcz.supabase.co";

interface Message {
  role: "user" | "assistant";
  content: string;
  images?: string[];
  id?: string;
}

interface ChatPaneProps {
  mode: StudyMode;
  collectionId: string | null;
  collectionContent: string;
  documentTypeHint: DocumentTypeHint;
}

export const ChatPane = ({ mode, collectionId, collectionContent, documentTypeHint }: ChatPaneProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const loadSession = async () => {
      if (!collectionId) {
        setMessages([]);
        setSessionId(null);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("study_sessions")
        .select("id, conversation_history")
        .eq("user_id", session.user.id)
        .eq("collection_id", collectionId)
        .eq("mode", mode)
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error loading session:", error);
        setMessages([]);
        setSessionId(null);
        return;
      }

      if (data) {
        setSessionId(data.id);
        const history = data.conversation_history as any;
        if (Array.isArray(history)) {
          setMessages(history.map((m: any, idx: number) => ({
            role: m.role,
            content: m.content,
            images: m.images,
            id: m.id || `msg-${idx}`,
          })));
        }
      } else {
        setMessages([]);
        setSessionId(null);
      }
    };

    loadSession();
  }, [mode, collectionId]);

  const saveSession = async (updatedMessages: Message[]) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !collectionId) return;

    const sessionData = {
      user_id: session.user.id,
      collection_id: collectionId,
      mode,
      conversation_history: updatedMessages as any,
    };

    if (sessionId) {
      await supabase
        .from("study_sessions")
        .update({ conversation_history: updatedMessages as any, updated_at: new Date().toISOString() })
        .eq("id", sessionId);
    } else {
      const { data } = await supabase
        .from("study_sessions")
        .insert(sessionData)
        .select("id")
        .single();
      if (data) setSessionId(data.id);
    }
  };

  const handleProofSignal = async (signal: "GOT_IT" | "NOT_SURE" | "CHECK_ME", msgIdx: number) => {
    const lastAssistant = messages[msgIdx];
    const lastUser = messages.slice(0, msgIdx).reverse().find(m => m.role === "user");
    
    const eventType = signal === "GOT_IT" ? "PROOF_GOT_IT" : signal === "NOT_SURE" ? "PROOF_NOT_SURE" : "PROOF_CHECK_ME";
    
    await insertLearningEvent(
      collectionId,
      eventType,
      lastAssistant?.content?.substring(0, 100) || null,
      {
        lastUserMessage: lastUser?.content || "",
        lastTutorAnswer: lastAssistant?.content || "",
      }
    );

    if (signal === "GOT_IT") {
      toast.success("Great! Keep going!");
    } else if (signal === "NOT_SURE") {
      toast.info("No worries! Let me help clarify.");
      setInput("Can you explain that in a different way?");
    } else if (signal === "CHECK_ME") {
      setInput("Ask me a quick question to check my understanding of what you just explained.");
    }
  };

  const getReportPayload = (msg: Message, msgIdx: number): ReportPayload => {
    return {
      feature: "tutor_message",
      content_type: "tutor_message",
      content_id: msg.id || `msg-${msgIdx}`,
      content_text: msg.content,
      collection_id: collectionId || undefined,
    };
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    if (!collectionId) {
      toast.error("Please select a collection first");
      return;
    }

    if (!collectionContent || collectionContent.length < 200) {
      toast.error("Your notes are empty or unreadable. Try re-uploading clearer slides.");
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;

    if (!accessToken) {
      toast.error("Session expired — please sign in again.");
      setLoading(false);
      return;
    }

    const userMessage: Message = { role: "user", content: input.trim(), id: `msg-${Date.now()}` };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);
    setIsTyping(true);

    try {
      const CHAT_URL = `${SUPABASE_URL}/functions/v1/chat-tutor`;

      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messages: updatedMessages,
          mode,
          collectionId,
          notes: collectionContent,
          document_type_hint: documentTypeHint,
        }),
      });

      if (response.status === 429) {
        toast.error("Rate limit exceeded. Please try again later.");
        setMessages((prev) => prev.slice(0, -1));
        setLoading(false);
        setIsTyping(false);
        return;
      }

      if (response.status === 402) {
        toast.error("AI credits exhausted. Please add credits to continue.");
        setMessages((prev) => prev.slice(0, -1));
        setLoading(false);
        setIsTyping(false);
        return;
      }

      if (response.status === 401) {
        toast.error("Authentication failed. Please refresh the page and try again.");
        setMessages((prev) => prev.slice(0, -1));
        setLoading(false);
        setIsTyping(false);
        return;
      }

      if (response.status === 404) {
        toast.error("Collection not found. Please select a valid collection.");
        setMessages((prev) => prev.slice(0, -1));
        setLoading(false);
        setIsTyping(false);
        return;
      }

      if (!response.ok || !response.body) {
        const errorText = await response.text();
        console.error("Chat API error:", response.status, errorText);
        toast.error(`Failed to get response: ${response.status} ${errorText}`);
        setMessages((prev) => prev.slice(0, -1));
        setLoading(false);
        setIsTyping(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      let textBuffer = "";
      let streamDone = false;

      const assistantId = `msg-${Date.now()}-assistant`;
      const tempMessages = [...updatedMessages, { role: "assistant" as const, content: "", id: assistantId }];
      setMessages(tempMessages);

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages((prev) => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = {
                  role: "assistant",
                  content: assistantContent,
                  id: assistantId,
                };
                return newMessages;
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      const finalMessages = [...updatedMessages, { role: "assistant" as const, content: assistantContent, id: assistantId }];
      setMessages(finalMessages);
      await saveSession(finalMessages);
    } catch (error: any) {
      console.error("Chat error:", error);
      toast.error("Failed to send message");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
      setIsTyping(false);
    }
  };

  const getModeTitle = () => {
    const titles: Record<StudyMode, string> = {
      explain: "Explain Mode",
      quiz: "Quiz Mode",
      flashcards: "Flashcards",
      memory: "Memory Tricks",
      worksheet: "Worksheet",
      notes: "Simple Notes",
    };
    return titles[mode];
  };

  const getModeDescription = () => {
    const descriptions: Record<StudyMode, string> = {
      explain: "Ask questions about your materials",
      quiz: "Test your knowledge",
      flashcards: "Review with flashcards",
      memory: "Get mnemonics and shortcuts",
      worksheet: "Practice problems",
      notes: "Simplified notes",
    };
    return descriptions[mode];
  };

  return (
    <div className="flex flex-col h-full bg-background" data-testid="panel-chat">
      <div className="border-b px-4 py-3 bg-muted/30">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-sm">{getModeTitle()}</h2>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {!collectionId ? "Select a collection from the sidebar to start" : getModeDescription()}
        </p>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <div className="space-y-2 text-muted-foreground max-w-sm">
              <MessageSquare className="h-8 w-8 mx-auto opacity-50" />
              <p className="text-sm">Start a conversation with your AI tutor</p>
              <p className="text-xs">All responses are based only on your uploaded materials</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 max-w-3xl mx-auto">
            {messages.map((msg, idx) => (
              <div
                key={msg.id || idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                data-testid={`message-${msg.role}-${idx}`}
              >
                <div className="max-w-[85%]">
                  <div
                    className={`px-3 py-2 rounded-lg text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted rounded-bl-sm"
                    }`}
                  >
                    <div 
                      className="whitespace-pre-wrap prose prose-sm dark:prose-invert max-w-none [&>p]:m-0 [&>ul]:my-1 [&>ol]:my-1"
                      dangerouslySetInnerHTML={{ 
                        __html: msg.content
                          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                          .replace(/\*(.+?)\*/g, '<em>$1</em>')
                          .replace(/^- /gm, '&#8226; ')
                      }} 
                    />
                    {msg.images && msg.images.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {msg.images.map((imgUrl, i) => (
                          <img
                            key={i}
                            src={imgUrl}
                            alt={`AI generated image ${i + 1}`}
                            className="max-w-full rounded"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  {msg.role === "assistant" && !isTyping && (
                    <div className="flex items-center gap-1 mt-1">
                      <ProofButtons
                        onGotIt={() => handleProofSignal("GOT_IT", idx)}
                        onNotSure={() => handleProofSignal("NOT_SURE", idx)}
                        onCheckMe={() => handleProofSignal("CHECK_ME", idx)}
                        disabled={loading}
                      />
                      <ReportDialog
                        feature="tutor_message"
                        payload={getReportPayload(msg, idx)}
                        trigger={
                          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-6 px-1.5">
                            <Flag className="h-3 w-3" />
                          </Button>
                        }
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-muted px-3 py-2 rounded-lg rounded-bl-sm">
                  <div className="flex space-x-1">
                    <div className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      <div className="border-t p-3 bg-muted/30">
        <div className="flex gap-2 max-w-3xl mx-auto">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              collectionId
                ? "Type your question..."
                : "Select a collection first..."
            }
            disabled={!collectionId || loading}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            className="min-h-[48px] max-h-32 resize-none text-sm"
            data-testid="input-chat-message"
          />
          <Button
            onClick={sendMessage}
            disabled={!collectionId || !input.trim() || loading}
            size="icon"
            className="h-12 w-12 shrink-0"
            data-testid="button-send-message"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
