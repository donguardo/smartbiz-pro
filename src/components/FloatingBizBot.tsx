import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Mic, MicOff, RotateCcw, Volume2, VolumeX, X } from "lucide-react";
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
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
import { cn } from "@/lib/utils";

const CHAT_KEY = "bizbot-conversation-v1";
const POSITION_KEY = "bizbot-position-v1";
const MAX_CONTEXT_PRODUCTS = 80;

type BotPosition = { x: number; y: number };
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

const clampPosition = (position: BotPosition): BotPosition => ({
  x: Math.max(8, Math.min(window.innerWidth - 112, position.x)),
  y: Math.max(72, Math.min(window.innerHeight - 124, position.y)),
});

export function FloatingBizBot() {
  const { lang, t } = useT();
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [storeContext, setStoreContext] = useState("");
  const [motion, setMotion] = useState(0);
  const [position, setPosition] = useState<BotPosition>({ x: 24, y: 120 });
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceReplyRef = useRef(false);
  const dragRef = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<UIMessage>({
        api: "/api/public/bizbot",
        body: { language: lang, storeContext },
      }),
    [lang, storeContext],
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
      toast.error(chatError.message || t("bot.error"));
    },
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    const savedPosition = localStorage.getItem(POSITION_KEY);
    let initial = { x: window.innerWidth - 144, y: window.innerHeight - 180 };
    if (savedPosition) {
      try {
        initial = JSON.parse(savedPosition) as BotPosition;
      } catch {
        localStorage.removeItem(POSITION_KEY);
      }
    }
    setPosition(clampPosition(initial));
    setMessages(loadMessages());
    setHydrated(true);
  }, [setMessages]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(CHAT_KEY, JSON.stringify(messages));
  }, [hydrated, messages, status]);

  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => textareaRef.current?.focus(), 0);
    let active = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session || !active) {
        setStoreContext("");
        return;
      }
      const [productsResult, salesResult, itemsResult] = await Promise.all([
        supabase.from("products").select("id,name,category,price,cost,stock,reorder_level").order("name").limit(MAX_CONTEXT_PRODUCTS),
        supabase.from("sales").select("total,cost_total,payment_method,created_at").order("created_at", { ascending: false }).limit(200),
        supabase.from("sale_items").select("product_id,name,category,qty,price,cost,created_at").order("created_at", { ascending: false }).limit(500),
      ]);
      if (!active) return;
      const context = {
        generatedAt: new Date().toISOString(),
        products: productsResult.data ?? [],
        recentSales: salesResult.data ?? [],
        recentSaleItems: itemsResult.data ?? [],
      };
      setStoreContext(JSON.stringify(context));
    });
    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onResize = () => setPosition((current) => clampPosition(current));
    window.addEventListener("open-bizbot", onOpen);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("open-bizbot", onOpen);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setMotion(Math.floor(Math.random() * 4)), 4200 + Math.random() * 2200);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      drag.moved = true;
      setPosition(clampPosition({ x: event.clientX - drag.dx, y: event.clientY - drag.dy }));
    };
    const onUp = () => {
      if (!dragRef.current) return;
      suppressClickRef.current = dragRef.current.moved;
      localStorage.setItem(POSITION_KEY, JSON.stringify(position));
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [position]);

  useEffect(() => () => {
    recognitionRef.current?.stop();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  const submit = useCallback(
    (text: string, byVoice = false) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      voiceReplyRef.current = byVoice;
      void sendMessage({ text: trimmed });
    },
    [busy, sendMessage],
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
    localStorage.removeItem(CHAT_KEY);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    textareaRef.current?.focus();
  };

  const onBotPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { dx: event.clientX - position.x, dy: event.clientY - position.y, moved: false };
  };

  const onBotClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setOpen((current) => !current);
  };

  return (
    <>
      {open && (
        <section
          aria-label={t("bot.title")}
          className="fixed bottom-24 right-3 z-[70] flex h-[min(620px,calc(100dvh-8rem))] w-[min(390px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-lg border border-primary/60 bg-popover/95 shadow-2xl backdrop-blur-xl md:bottom-5 md:right-5"
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
            <Button size="icon" variant="ghost" onClick={() => setOpen(false)} title={t("bot.close")} aria-label={t("bot.close")}><X /></Button>
          </header>

          <Conversation className="min-h-0 flex-1">
            <ConversationContent className="gap-5 p-4">
              {messages.length === 0 ? (
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
              {error && <p role="alert" className="text-sm text-destructive">{error.message || t("bot.error")}</p>}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          <div className="shrink-0 border-t border-border bg-card/80 p-3">
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
          </div>
        </section>
      )}

      <button
        type="button"
        aria-label={open ? t("bot.close") : t("bot.open")}
        title={t("bot.dragHint")}
        onPointerDown={onBotPointerDown}
        onClick={onBotClick}
        className="fixed z-[80] touch-none select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ left: position.x, top: position.y }}
      >
        <span className="absolute inset-2 rounded-full bg-primary/25 blur-xl" aria-hidden />
        <img
          src={bizBotImage}
          alt=""
          draggable={false}
          className={cn("relative h-28 w-28 object-contain drop-shadow-[0_0_14px_var(--scene-magenta)]", `bizbot-motion-${motion}`)}
        />
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-primary/60 bg-popover/95 px-2 py-0.5 font-mono text-[10px] font-bold text-foreground shadow backdrop-blur-md">
          {listening ? t("bot.listening") : "BIZBOT"}
        </span>
      </button>
    </>
  );
}