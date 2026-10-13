// Chatbot

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text, TextInput } from "../components/ui/AppText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BAR_HEIGHT } from "../components/layout/BottomNav";
import KeyboardSafeView from "../components/layout/KeyboardSafeView";
import WeepAvatar from "../components/brand/WeepAvatar";
import { useAllergies } from "../lib/health/allergies";
import { getSessionUser } from "../lib/auth/session";
import { supabase } from "../lib/supabase";
import { Colors, useTheme } from "../providers/ThemeProvider";

const MAX_CHARS = 300;
// Cooldown
const COOLDOWN_MS = 4500;
// History
const HISTORY_SENT = 7;
const STORE_MAX = 40;
// Footer
const HINT_HEIGHT = 56;

type Msg = { id: string; role: "user" | "bot"; text: string; error?: boolean };

const SUGGESTIONS = [
  "How many calories should I eat a day?",
  "I'm overweight. Where do I start?",
  "Suggest a healthy breakfast for me",
  "How do I add a scanned food to my log?",
];

const storeKey = (userId: string) => `bot_chat_${userId}`;

// Sanitize
const cleanReply = (text: string) =>
  text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^\s*[*•]\s+/gm, "- ")
    .replace(/^#+\s*/gm, "")
    .trim();

// Errors
async function readError(error: any): Promise<{ message: string; remaining?: number }> {
  try {
    const body = await error?.context?.json?.();
    if (body?.error) return { message: body.error, remaining: body.remaining };
  } catch {}
  return { message: error?.message || "Something went wrong. Please try again." };
}

export default function ChatbotScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { allergies } = useAllergies();

  const scrollRef = useRef<ScrollView>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [cooling, setCooling] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [limit, setLimit] = useState<number | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, () => setKeyboardOpen(true));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Loading
  useEffect(() => {
    let active = true;
    (async () => {
      const user = await getSessionUser();
      if (!user) {
        router.replace("/");
        return;
      }
      if (!active) return;
      setUserId(user.id);

      try {
        const saved = await AsyncStorage.getItem(storeKey(user.id));
        if (saved && active) setMessages(JSON.parse(saved));
      } catch {}
      if (active) setLoaded(true);

      // Status
      const { data } = await supabase.functions.invoke("weighapp-bot", { body: { status: true } });
      if (active && typeof data?.remaining === "number") {
        setRemaining(data.remaining);
        if (typeof data.limit === "number") setLimit(data.limit);
      }
    })();
    return () => {
      active = false;
    };
  }, [router]);

  // Persistence
  useEffect(() => {
    if (!userId || !loaded) return;
    const toSave = messages.filter((m) => !m.error).slice(-STORE_MAX);
    AsyncStorage.setItem(storeKey(userId), JSON.stringify(toSave)).catch(() => {});
  }, [messages, userId, loaded]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const limitReached = remaining !== null && remaining <= 0;
  const canSend = input.trim().length > 0 && !sending && !cooling && !limitReached;

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || sending || cooling || limitReached) return;
    if (text.length > MAX_CHARS) return;

    const userMsg: Msg = { id: `u${Date.now()}`, role: "user", text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setSending(true);
    setCooling(true);
    setTimeout(() => setCooling(false), COOLDOWN_MS);
    scrollToEnd();

    const history = next
      .filter((m) => !m.error)
      .slice(-(HISTORY_SENT + 1))
      .map((m) => ({ role: m.role === "user" ? "user" : "model", text: m.text }));

    try {
      const { data, error } = await supabase.functions.invoke("weighapp-bot", {
        body: { messages: history },
      });
      if (error) {
        const failure = await readError(error);
        if (typeof failure.remaining === "number") setRemaining(failure.remaining);
        throw new Error(failure.message);
      }
      if (data?.error) throw new Error(data.error);
      if (!data?.reply) throw new Error("No answer was returned.");

      if (typeof data.remaining === "number") setRemaining(data.remaining);
      setMessages((prev) => [
        ...prev,
        { id: `b${Date.now()}`, role: "bot", text: cleanReply(String(data.reply)) },
      ]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e${Date.now()}`,
          role: "bot",
          error: true,
          text: e?.message || "Something went wrong. Please try again.",
        },
      ]);
    } finally {
      setSending(false);
      scrollToEnd();
    }
  };

  const clearChat = () => {
    Alert.alert("Clear chat", "Delete this conversation from your phone?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: () => setMessages([]) },
    ]);
  };

  const hint = limitReached
    ? "Daily limit reached — come back tomorrow."
    : remaining !== null
      ? `${remaining}${limit ? ` of ${limit}` : ""} message${remaining === 1 ? "" : "s"} left today`
      : "Not medical advice";

  return (
    <KeyboardSafeView style={s.container}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={scrollToEnd}
      >
        {messages.length === 0 ? (
          <View style={s.welcome}>
            <WeepAvatar size={132} style={s.welcomeIcon} />
            <Text style={s.welcomeTitle}>Hi, I&apos;m Weep</Text>
            <Text style={s.welcomeRole}>WeighApp AI Assistant</Text>
            <Text style={s.welcomeText}>
              Ask me about your meals, your weight and health, or how to use WeighApp. I only give
              suggestions when you ask for them.
            </Text>
            <View style={s.allergyNote}>
              <Ionicons name="shield-checkmark" size={18} color={colors.accent} />
              <Text style={s.allergyNoteText}>
                {allergies.length > 0
                  ? `I know you avoid ${allergies.join(", ")}, so I won't suggest foods with them.`
                  : "Add your food allergies in Settings > Food Preferences and I'll avoid them in my suggestions."}
              </Text>
            </View>
            <View style={s.suggestWrap}>
              {SUGGESTIONS.map((q) => (
                <Pressable
                  key={q}
                  style={({ pressed }) => [s.suggestChip, pressed && s.pressed]}
                  onPress={() => send(q)}
                  disabled={sending || cooling || limitReached}
                  accessibilityRole="button"
                >
                  <Text style={s.suggestText}>{q}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <>
            <Pressable style={s.clearBtn} onPress={clearChat} hitSlop={8} accessibilityRole="button">
              <Ionicons name="trash-outline" size={14} color={colors.textMuted} />
              <Text style={s.clearText}>Clear chat</Text>
            </Pressable>
            {messages.map((m) => (
              <View key={m.id} style={[s.row, m.role === "user" ? s.rowUser : s.rowBot]}>
                {m.role === "bot" && (
                  m.error ? (
                    <View style={[s.botAvatar, s.botAvatarError]}>
                      <Ionicons name="alert" size={15} color="#ef4444" />
                    </View>
                  ) : (
                    <WeepAvatar size={34} style={s.botAvatarImg} />
                  )
                )}
                <View
                  style={[
                    s.bubble,
                    m.role === "user" ? s.bubbleUser : s.bubbleBot,
                    m.error && s.bubbleError,
                  ]}
                >
                  <Text
                    selectable
                    style={[s.bubbleText, m.role === "user" && s.bubbleTextUser, m.error && s.bubbleTextError]}
                  >
                    {m.text}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}

        {sending && (
          <View style={[s.row, s.rowBot]}>
            <WeepAvatar size={34} style={s.botAvatarImg} />
            <View style={[s.bubble, s.bubbleBot, s.typing]}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={s.typingText}>Thinking…</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input */}
      <View style={s.inputBar}>
        <View style={s.inputWrap}>
          <TextInput
            style={s.input}
            value={input}
            onChangeText={setInput}
            placeholder={limitReached ? "Daily limit reached" : "Ask about meals or your weight…"}
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={MAX_CHARS}
            editable={!limitReached}
            returnKeyType="default"
          />
          {input.length > MAX_CHARS - 60 && (
            <Text style={s.charCount}>
              {input.length}/{MAX_CHARS}
            </Text>
          )}
        </View>
        <Pressable
          style={({ pressed }) => [s.sendBtn, !canSend && s.sendBtnOff, pressed && s.pressed]}
          onPress={() => send()}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Send message"
        >
          {sending ? (
            <ActivityIndicator size="small" color={colors.onAccent} />
          ) : (
            <Ionicons name="arrow-up" size={22} color={colors.onAccent} />
          )}
        </Pressable>
      </View>

      {/* Footer */}
      {!keyboardOpen && (
        <View style={{ height: BAR_HEIGHT + insets.bottom + HINT_HEIGHT - 20 }}>
          <Text style={[s.hint, limitReached && s.hintLimit]}>{hint}</Text>
        </View>
      )}
    </KeyboardSafeView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    pressed: { opacity: 0.8 },
    listContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, flexGrow: 1 },

    // Welcome
    welcome: { alignItems: "center", paddingTop: 18 },
    welcomeIcon: { marginBottom: 6 },
    welcomeTitle: { fontSize: 24, fontWeight: "900", color: c.textPrimary },
    welcomeRole: { fontSize: 13.5, fontWeight: "800", color: c.accent, marginTop: 2, marginBottom: 10 },
    allergyNote: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 16,
      paddingVertical: 11,
      paddingHorizontal: 14,
      marginBottom: 18,
      alignSelf: "stretch",
    },
    allergyNoteText: { flex: 1, fontSize: 13.5, lineHeight: 19, fontWeight: "600", color: c.textSecondary },
    welcomeText: {
      fontSize: 14.5,
      lineHeight: 21,
      color: c.textSecondary,
      textAlign: "center",
      fontWeight: "500",
      paddingHorizontal: 10,
      marginBottom: 20,
    },
    suggestWrap: { width: "100%", gap: 10 },
    suggestChip: {
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 16,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    suggestText: { fontSize: 14.5, fontWeight: "700", color: c.accent },

    // Messages
    clearBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      alignSelf: "flex-end",
      marginBottom: 8,
    },
    clearText: { fontSize: 12.5, fontWeight: "700", color: c.textMuted },
    row: { flexDirection: "row", alignItems: "flex-end", marginBottom: 10, gap: 8 },
    rowUser: { justifyContent: "flex-end" },
    rowBot: { justifyContent: "flex-start" },
    botAvatar: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: c.surfaceAlt,
      borderWidth: 1.5,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    botAvatarError: { borderColor: "#ef4444" },
    botAvatarImg: { marginBottom: 2 },
    bubble: { maxWidth: "80%", paddingVertical: 10, paddingHorizontal: 14, borderRadius: 20 },
    bubbleUser: { backgroundColor: c.accent, borderBottomRightRadius: 6 },
    bubbleBot: {
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
      borderBottomLeftRadius: 6,
    },
    bubbleError: { borderColor: "#ef4444" },
    bubbleText: { fontSize: 15, lineHeight: 22, color: c.textPrimary, fontWeight: "500" },
    bubbleTextUser: { color: c.onAccent, fontWeight: "600" },
    bubbleTextError: { color: "#ef4444", fontWeight: "600" },
    typing: { flexDirection: "row", alignItems: "center", gap: 8 },
    typingText: { fontSize: 14, fontWeight: "600", color: c.textSecondary },

    // Input
    inputBar: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 6,
      backgroundColor: c.background,
      borderTopWidth: 1.5,
      borderTopColor: c.border,
    },
    inputWrap: {
      flex: 1,
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.borderStrong,
      borderRadius: 22,
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 4,
      justifyContent: "center",
    },
    input: {
      fontSize: 15.5,
      color: c.textPrimary,
      fontWeight: "500",
      maxHeight: 110,
      minHeight: 40,
      paddingTop: 8,
      paddingBottom: 8,
    },
    charCount: { fontSize: 11, fontWeight: "700", color: c.textMuted, alignSelf: "flex-end", paddingBottom: 2 },
    sendBtn: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: c.accent,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 2,
    },
    sendBtnOff: { opacity: 0.4 },
    hint: {
      fontSize: 12.5,
      fontWeight: "700",
      color: c.textMuted,
      paddingHorizontal: 20,
      paddingTop: 6,
      maxWidth: "62%",
    },
    hintLimit: { color: "#ef4444" },
  });
