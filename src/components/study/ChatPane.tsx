import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, Loader2, Flag, Volume2, StopCircle } from "lucide-react";
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
  onUsageCheck?: () => Promise<boolean>;
}

export const ChatPane = ({ mode, collectionId, collectionContent, documentTypeHint, onUsageCheck }: ChatPaneProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
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

    // Check usage limit
    if (onUsageCheck) {
      const allowed = await onUsageCheck();
      if (!allowed) return;
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
      explain: "Explain Mode - Ask questions about your materials",
      quiz: "Quiz Mode - Test your knowledge",
      flashcards: "Flashcards Mode",
      memory: "Memory Tricks - Get mnemonics and shortcuts",
      worksheet: "Worksheet Mode",
      notes: "Simple Notes Mode",
    };
    return titles[mode];
  };

  const isSpeechSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  const speakText = (text: string, id: string) => {
    if (!isSpeechSupported || !text.trim()) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => setSpeakingId((prev) => (prev === id ? null : prev));
      utterance.onerror = () => setSpeakingId((prev) => (prev === id ? null : prev));
      setSpeakingId(id);
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error("Speech synthesis failed", err);
      setSpeakingId(null);
    }
  };

  const stopSpeaking = () => {
    if (!isSpeechSupported) return;
    window.speechSynthesis.cancel();
    setSpeakingId(null);
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-50/50 to-white dark:from-slate-900 dark:to-slate-950">
      {/* Minimal Header */}
      <div className="border-b px-6 py-4 bg-background/80 dark:bg-slate-900/80 backdrop-blur-sm dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-base text-slate-900 dark:text-white">{getModeTitle()}</h2>
            {!collectionId ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Select a collection to begin</p>
            ) : (
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">Ready to help with your materials</p>
            )}
          </div>
          {messages.length > 0 && (
            <div className="text-xs text-slate-400 dark:text-slate-500">
              {messages.length} {messages.length === 1 ? 'message' : 'messages'}
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <ScrollArea className="flex-1 px-6 py-6" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4 max-w-md">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-purple-100 dark:from-purple-900 to-pink-100 dark:to-pink-900 flex items-center justify-center">
                <Send className="h-7 w-7 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-slate-900 dark:text-white mb-2">Ask anything about your materials</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  I'll answer based only on what you've uploaded. Get explanations, summaries, or clarifications.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 max-w-3xl mx-auto">
            {messages.map((msg, idx) => (
              <div
                key={msg.id || idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
              >
                <div className={`max-w-[80%] ${msg.role === "user" ? "ml-12" : "mr-12"}`}>
                  {/* Message Bubble */}
                  <div
                    className={`px-4 py-3 rounded-2xl text-sm shadow-sm ${
                      msg.role === "user"
                        ? "bg-gradient-to-br from-purple-600 to-pink-600 text-white rounded-br-md"
                        : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-bl-md"
                    }`}
                  >
                    <div 
                      className={`whitespace-pre-wrap leading-relaxed ${msg.role === "assistant" ? "prose prose-sm max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0" : ""}`}
                      dangerouslySetInnerHTML={{ 
                        __html: msg.content
                          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                          .replace(/\*(.+?)\*/g, '<em>$1</em>')
                          .replace(/^- /gm, '• ')
                      }} 
                    />
                    {msg.images && msg.images.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {msg.images.map((imgUrl, i) => (
                          <img
                            key={i}
                            src={imgUrl}
                            alt={`AI generated image ${i + 1}`}
                            className="max-w-full rounded-lg"
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons for Assistant Messages */}
                  {msg.role === "assistant" && !isTyping && (
                    <div className="flex items-center gap-1 mt-2 ml-1">
                      {mode === "explain" && isSpeechSupported && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                          onClick={() => speakText(msg.content, msg.id || `assistant-${idx}`)}
                          disabled={speakingId === (msg.id || `assistant-${idx}`)}
                        >
                          <Volume2 className="h-3.5 w-3.5 mr-1" />
                          Read aloud
                        </Button>
                      )}
                      {mode === "explain" && isSpeechSupported && speakingId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                          onClick={stopSpeaking}
                        >
                          <StopCircle className="h-3.5 w-3.5 mr-1" />
                          Stop
                        </Button>
                      )}
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
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                            <Flag className="h-3 w-3" />
                          </Button>
                        }
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-background dark:bg-slate-800 border border-border dark:border-slate-700 px-4 py-3 rounded-2xl rounded-bl-md shadow-sm">
                  <div className="flex space-x-1.5">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t bg-background dark:bg-slate-900 px-6 py-4 dark:border-slate-700">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  collectionId
                    ? "Ask a question about your materials..."
                    : "Select a collection to start chatting..."
                }
                disabled={!collectionId || loading}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                className="min-h-[56px] text-sm resize-none pr-12 rounded-xl border-slate-300 focus:border-purple-500 focus:ring-purple-500"
              />
            </div>
            <Button
              onClick={sendMessage}
              disabled={!collectionId || !input.trim() || loading}
              size="icon"
              className="h-14 w-14 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg shadow-purple-500/30 shrink-0"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
          <p className="text-xs text-slate-400 mt-2 text-center">
            Press Enter to send • Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
};
