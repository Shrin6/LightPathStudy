import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, Loader2 } from "lucide-react";
import { StudyMode, DocumentTypeHint } from "@/pages/Study";

interface Message {
  role: "user" | "assistant";
  content: string;
  images?: string[];
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
    // Scroll to bottom when messages change
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    // Load existing session when mode or collection changes
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
          setMessages(history.map((m: any) => ({
            role: m.role,
            content: m.content,
            images: m.images
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

    // PRE-FLIGHT: Get user session and access token
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;

    if (!accessToken) {
      toast.error("Session expired — please sign in again.");
      setLoading(false);
      return;
    }

    const userMessage: Message = { role: "user", content: input.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);
    setIsTyping(true);

    try {
      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-tutor`;

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

      // Add initial assistant message
      const tempMessages = [...updatedMessages, { role: "assistant" as const, content: "" }];
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

      // Save final conversation to database
      const finalMessages = [...updatedMessages, { role: "assistant" as const, content: assistantContent }];
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
      explain: "Explain Mode - Ask questions about your materials",
      quiz: "Quiz Mode - Test your knowledge",
      flashcards: "Flashcards Mode",
      memory: "Memory Tricks - Get mnemonics and shortcuts",
      worksheet: "Worksheet Mode",
      notes: "Simple Notes Mode",
    };
    return titles[mode];
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-4 bg-card">
        <h2 className="font-semibold">{getModeTitle()}</h2>
        {!collectionId && (
          <p className="text-sm text-muted-foreground mt-1">
            Select a collection from the sidebar to start
          </p>
        )}
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <div className="space-y-2 text-muted-foreground">
              <p>Start a conversation with your AI tutor</p>
              <p className="text-sm">All responses are based only on your uploaded materials</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-lg ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
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
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-muted p-3 rounded-lg">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      <div className="border-t p-4 bg-card">
        <div className="flex gap-2">
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
            className="min-h-[60px]"
          />
          <Button
            onClick={sendMessage}
            disabled={!collectionId || !input.trim() || loading}
            size="icon"
            className="h-[60px] w-[60px]"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};