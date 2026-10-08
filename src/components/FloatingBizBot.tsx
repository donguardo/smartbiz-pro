import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ChevronUp, Mic, MicOff, Minus, RotateCcw, Volume2, VolumeX } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import bizBotImage from "@/assets/bizbot-transparent.png";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/lib/i18n";
import { useSession } from "@/lib/auth";

const CHAT_KEY = "bizbot-conversation-v1";
const BOT_POSITION_KEY = "bizbot-position-v1";
const BOT_SIZE = 68;
const BOT_MARGIN = 16;
type BotPosition = { x: number; y: number };
type DragState = { pointerId: number; offsetX: number; offsetY: number; moved: boolean };
type SpeechRecognitionEventLike = Event & {
  results: { [index: number]: { [index: number]: { transcript: string } } };
};
type SpeechRecognitionErrorEventLike = Event & { error: string };
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const textOf = (message: UIMessage) =>
  message.parts
    .filter((part): part is Extract<(typeof message.parts)[number], { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();

const loadMessages = (): UIMessage[] => {
  try {
    const raw = localStorage.getItem(CHAT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as UIMessage[]) : [];
  } catch {
    return [];
  }
};

const clampBotPosition = (position: BotPosition): BotPosition => ({
  x: Math.min(Math.max(BOT_MARGIN, position.x), Math.max(BOT_MARGIN, window.innerWidth - BOT_SIZE - BOT_MARGIN)),
  y: Math.min(Math.max(BOT_MARGIN, position.y), Math.max(BOT_MARGIN, window.innerHeight - BOT_SIZE - BOT_MARGIN)),
});

const loadBotPosition = (): BotPosition | null => {
  try {
    const raw = localStorage.getItem(BOT_POSITION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("x" in parsed) ||
      !("y" in parsed) ||
      typeof parsed.x !== "number" ||
      typeof parsed.y !== "number" ||
      !Number.isFinite(parsed.x) ||
      !Number.isFinite(parsed.y)
    ) return null;
    return clampBotPosition({ x: parsed.x, y: parsed.y });
  } catch {
    return null;
  }
};

export function FloatingBizBot() {
  const { lang, t } = useT();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const { session } = useSession();
  const signedIn = Boolean(session);
  const [localFaq, setLocalFaq] = useState<UIMessage[]>([]);
  const hadSessionRef = useRef(false);
  const [botPosition, setBotPosition] = useState<BotPosition | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceReplyRef = useRef(false);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<UIMessage>({
        api: "/api/public/bizbot",
        prepareSendMessagesRequest: async ({ id, messages }) => {
          const { data } = await supabase.auth.getSession();
          return {
            headers: data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {},
            body: { id, language: lang, messages: messages.slice(-20) },
          };
        },
      }),
    [lang],
  );

  const speak = useCallback(
    (text: string) => {
      if (!voiceEnabled || !text || !("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.replace(/[*#_`]/g, ""));
      utterance.lang = lang === "tl" ? "fil-PH" : "en-US";
      utterance.rate = 1.02;
      window.speechSynthesis.speak(utterance);
    },
    [lang, voiceEnabled],
  );

  const { messages, sendMessage, setMessages, status, stop, error } = useChat({
    id: "bizbot-single-conversation",
    transport,
    onFinish: ({ message, isAbort, isError }) => {
      if (voiceReplyRef.current && !isAbort && !isError) speak(textOf(message));
      voiceReplyRef.current = false;
      window.setTimeout(() => textareaRef.current?.focus(), 0);
    },
    onError: (chatError) => {
      voiceReplyRef.current = false;
      const m = chatError.message || "";
      if (!m.startsWith("Sign in")) toast.error(m.startsWith("This conversation is too long") ? t("bot.tooLong") : m || t("bot.error"));
    },
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    setMessages(loadMessages());
    setBotPosition(loadBotPosition());
    setHydrated(true);
  }, [setMessages]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(CHAT_KEY, JSON.stringify(messages));
  }, [hydrated, messages, status]);

  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }, [open]);

  // Sign-out privacy: a shared phone must not keep the previous user's store answers.
  useEffect(() => {
    if (session) {
      hadSessionRef.current = true;
      return;
    }
    if (hadSessionRef.current) {
      hadSessionRef.current = false;
      setMessages([]);
      setLocalFaq([]);
      localStorage.removeItem(CHAT_KEY);
    }
  }, [session, setMessages]);

  const addFaq = (question: string, answer: string) => {
    const now = Date.now();
    setLocalFaq((prev) => [
      ...prev,
      { id: `faq-q-${now}`, role: "user", parts: [{ type: "text", text: question }] },
      { id: `faq-a-${now}`, role: "assistant", parts: [{ type: "text", text: answer }] },
    ]);
  };

  useEffect(() => {
    const onOpen = () => {
      setOpen(true);
      setMinimized(false);
    };
    window.addEventListener("open-bizbot", onOpen);
    return () => {
      window.removeEventListener("open-bizbot", onOpen);
    };
  }, []);

  useEffect(() => {
    const keepBotOnScreen = () => {
      setBotPosition((position) => {
        if (!position) return null;
        const nextPosition = clampBotPosition(position);
        localStorage.setItem(BOT_POSITION_KEY, JSON.stringify(nextPosition));
        return nextPosition;
      });
    };
    window.addEventListener("resize", keepBotOnScreen);
    return () => window.removeEventListener("resize", keepBotOnScreen);
  }, []);

  useEffect(() => () => {
    recognitionRef.current?.stop();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  const submit = useCallback(
    (text: string, byVoice = false) => {
      const trimmed = text.trim();
      if (!trimmed || busy || !signedIn) return;
      voiceReplyRef.current = byVoice;
      void sendMessage({ text: trimmed });
    },
    [busy, sendMessage, signedIn],
  );

  const startListening = () => {
    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      toast.error(t("bot.voiceUnsupported"));
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new Recognition();
    recognition.lang = lang === "tl" ? "fil-PH" : "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => submit(event.results[0]?.[0]?.transcript ?? "", true);
    recognition.onerror = (event) => {
      setListening(false);
      if (event.error !== "aborted") toast.error(t("bot.voiceError"));
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  const clearConversation = () => {
    if (busy) void stop();
    setMessages([]);
    setLocalFaq([]);
    localStorage.removeItem(CHAT_KEY);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    textareaRef.current?.focus();
  };

  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - bounds.left,
      offsetY: event.clientY - bounds.top,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveBot = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.moved = drag.moved || Math.abs(event.movementX) + Math.abs(event.movementY) > 2;
    const nextPosition = clampBotPosition({
      x: event.clientX - drag.offsetX,
      y: event.clientY - drag.offsetY,
    });
    setBotPosition(nextPosition);
    localStorage.setItem(BOT_POSITION_KEY, JSON.stringify(nextPosition));
  };

  const stopDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    suppressClickRef.current = drag.moved;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const openBot = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setOpen(true);
    setMinimized(false);
  };

  const minimizeBot = () => {
    setMinimized(true);
    recognitionRef.current?.stop();
  };

  return (
    <>
      {open && !minimized && (
        <section
          aria-label={t("bot.title")}
          className="fixed bottom-24 right-3 z-[70] flex h-[min(620px,calc(100dvh-8rem))] w-[min(390px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-lg border border-primary/60 bg-popover/95 shadow-2xl backdrop-blur-xl md:bottom-20 md:right-4"
        >
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-primary/30 px-3">
            <img src={bizBotImage} alt="" className="h-10 w-10 object-contain" />
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-display text-sm font-bold">{t("bot.title")}</h2>
              <p className="truncate text-xs text-muted-foreground">{listening ? t("bot.listening") : t("bot.status")}</p>
            </div>
            <Button size="icon" variant="ghost" onClick={() => setVoiceEnabled((enabled) => !enabled)} title={voiceEnabled ? t("bot.mute") : t("bot.unmute")} aria-label={voiceEnabled ? t("bot.mute") : t("bot.unmute")}>
              {voiceEnabled ? <Volume2 /> : <VolumeX />}
            </Button>
            <Button size="icon" variant="ghost" onClick={clearConversation} title={t("bot.clear")} aria-label={t("bot.clear")}><RotateCcw /></Button>
            <Button size="icon" variant="ghost" onClick={minimizeBot} title={t("bot.minimize")} aria-label={t("bot.minimize")}><Minus /></Button>
          </header>

          <Conversation className="min-h-0 flex-1">
            <ConversationContent className="gap-5 p-4">
              {!signedIn ? (
                <>
                  <div className="rounded-lg border border-primary/50 bg-card p-4 text-sm">
                    <h3 className="font-display text-base font-bold">{t("bot.signInTitle")}</h3>
                    <p className="mt-1 text-muted-foreground">{t("bot.signInBody")}</p>
                    <Button asChild size="sm" className="mt-3"><Link to="/auth">{t("bot.signIn")}</Link></Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {([["bot.promptFeatures", "bot.faqFeatures"], ["bot.promptPricing", "bot.faqPricing"], ["bot.promptTrial", "bot.faqTrial"]] as const).map(([q, a]) => (
                      <Button key={q} variant="outline" size="sm" onClick={() => addFaq(t(q), t(a))}>{t(q)}</Button>
                    ))}
                  </div>
                  {localFaq.map((message) => (
                    <Message key={message.id} from={message.role}>
                      <MessageContent className="group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground">
                        <MessageResponse>{textOf(message)}</MessageResponse>
                      </MessageContent>
                    </Message>
                  ))}
                </>
              ) : messages.length === 0 ? (
                <ConversationEmptyState
                  icon={<img src={bizBotImage} alt="" className="mx-auto h-28 w-28 object-contain" />}
                  title={t("bot.welcomeTitle")}
                  description={t("bot.welcomeBody")}
                >
                  <img src={bizBotImage} alt="" className="mx-auto h-28 w-28 object-contain" />
                  <div>
                    <h3 className="font-display text-base font-bold">{t("bot.welcomeTitle")}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{t("bot.welcomeBody")}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap justify-center gap-2">
                    {[t("bot.promptFeatures"), t("bot.promptReorder"), t("bot.promptPricing")].map((prompt) => (
                      <Button key={prompt} variant="outline" size="sm" onClick={() => submit(prompt)}>{prompt}</Button>
                    ))}
                  </div>
                </ConversationEmptyState>
              ) : (
                messages.map((message) => (
                  <Message key={message.id} from={message.role}>
                    <MessageContent className="group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground">
                      {message.parts.map((part, index) => {
                        if (part.type === "text") return <MessageResponse key={index}>{part.text}</MessageResponse>;
                        if (part.type === "reasoning" && part.text) {
                          return <details key={index} className="text-xs text-muted-foreground"><summary>{t("bot.reasoning")}</summary><p className="mt-1">{part.text}</p></details>;
                        }
                        return null;
                      })}
                    </MessageContent>
                  </Message>
                ))
              )}
              {status === "submitted" && <Shimmer className="text-sm">{t("bot.thinking")}</Shimmer>}
              {signedIn && error && (error.message.startsWith("Sign in") ? (
                <div className="rounded-lg border border-primary/50 bg-card p-4 text-sm">
                  <h3 className="font-display text-base font-bold">{t("bot.signInTitle")}</h3>
                  <p className="mt-1 text-muted-foreground">{t("bot.signInBody")}</p>
                  <Button asChild size="sm" className="mt-3"><Link to="/auth">{t("bot.signIn")}</Link></Button>
                </div>
              ) : (
                <p role="alert" className="text-sm text-destructive">{error.message.startsWith("This conversation is too long") ? t("bot.tooLong") : error.message || t("bot.error")}</p>
              ))}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          {signedIn && <div className="shrink-0 border-t border-border bg-card/80 p-3">
            <PromptInput onSubmit={({ text }) => submit(text)}>
              <PromptInputTextarea ref={textareaRef} disabled={busy} placeholder={t("bot.placeholder")} className="max-h-28 min-h-12" />
              <PromptInputFooter>
                <PromptInputTools>
                  <Button
                    type="button"
                    size="icon"
                    variant={listening ? "default" : "ghost"}
                    onClick={startListening}
                    disabled={busy}
                    title={listening ? t("bot.stopListening") : t("bot.microphone")}
                    aria-label={listening ? t("bot.stopListening") : t("bot.microphone")}
                  >
                    {listening ? <MicOff /> : <Mic />}
                  </Button>
                  <span className="text-xs text-muted-foreground">{listening ? t("bot.listening") : t("bot.voiceHint")}</span>
                </PromptInputTools>
                <PromptInputSubmit status={status} onStop={stop} disabled={!hydrated} />
              </PromptInputFooter>
            </PromptInput>
          </div>}
        </section>
      )}

      {open && minimized && (
        <div className="fixed bottom-4 right-3 z-[80] flex h-12 items-center gap-2 rounded-lg border border-primary/60 bg-popover/95 px-2 shadow-xl backdrop-blur-xl md:right-4">
          <img src={bizBotImage} alt="" className="h-9 w-9 object-contain" />
          <span className="max-w-36 truncate text-sm font-bold">BIZBOT</span>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setMinimized(false)}
            title={t("bot.restore")}
            aria-label={t("bot.restore")}
          >
            <ChevronUp />
          </Button>
        </div>
      )}

      {!open && !minimized && (
        <button
          type="button"
          aria-label={t("bot.open")}
          title={t("bot.dragHint")}
          onClick={openBot}
          onPointerDown={startDrag}
          onPointerMove={moveBot}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
          style={botPosition ? { left: botPosition.x, top: botPosition.y, width: BOT_SIZE, height: BOT_SIZE } : { width: BOT_SIZE, height: BOT_SIZE }}
          className="fixed bottom-4 right-4 z-[80] flex touch-none select-none items-center justify-center rounded-full border border-primary/60 bg-card shadow-xl outline-none cursor-grab active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="absolute inset-2 rounded-full bg-primary/25 blur-xl" aria-hidden />
          <img
            src={bizBotImage}
            alt=""
            draggable={false}
            className="bizbot-motion-0 relative h-full w-full object-contain drop-shadow-[0_0_12px_var(--scene-magenta)]"
          />
          <span className="sr-only">{listening ? t("bot.listening") : "BIZBOT"}</span>
        </button>
      )}
    </>
  );
}