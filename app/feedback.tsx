// Feedback

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text, TextInput } from "../components/ui/AppText";
import KeyboardSafeView from "../components/layout/KeyboardSafeView";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { goBackOr } from "../lib/navigation";
import { getSessionUser } from "../lib/auth/session";
import { Colors, useTheme } from "../providers/ThemeProvider";

type IconName = keyof typeof Ionicons.glyphMap;

const MAX_LENGTH = 500;

const RATING_LABELS: Record<number, { text: string; icon: IconName }> = {
  1: { text: "We're sorry", icon: "sad-outline" },
  2: { text: "Not great...", icon: "sad-outline" },
  3: { text: "It's okay", icon: "happy-outline" },
  4: { text: "You like it!", icon: "happy-outline" },
  5: { text: "You love it!", icon: "heart" },
};

const TOPICS: { label: string; icon: IconName }[] = [
  { label: "Bug report", icon: "bug-outline" },
  { label: "Idea", icon: "bulb-outline" },
  { label: "Praise", icon: "thumbs-up-outline" },
  { label: "Other", icon: "ellipsis-horizontal-circle-outline" },
];

export default function FeedbackScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [rating, setRating] = useState(0);
  const [topic, setTopic] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const submitFeedback = async () => {
    if (loading) return;
    if (rating === 0) {
      return Alert.alert("Hold on!", "Please tap a star to rate us");
    }

    setLoading(true);
    try {
      const user = await getSessionUser();

      // Topic
      const text = message.trim();
      const stored = text ? (topic ? `[${topic}] ${text}` : text) : null;

      const { error } = await supabase.from("feedback").insert({
        user_id: user?.id || null,
        rating,
        message: stored,
      });

      if (error) throw error;

      Alert.alert(
        "Thank you!",
        rating >= 4
          ? "You just made our day! We're so happy you love the app"
          : "Thanks for your honest feedback. We're working hard to improve!",
        [{ text: "You're welcome", onPress: () => goBackOr(router, "/setting") }]
      );
    } catch {
      Alert.alert("Oops", "Failed to send feedback. Try again later?");
    } finally {
      setLoading(false);
    }
  };

  const current = rating > 0 ? RATING_LABELS[rating] : null;

  return (
    <SafeAreaView style={s.safeArea} edges={["left", "right"]}>
      <View style={s.headerContainer}>
        <Text style={s.header}>Give Feedback</Text>

      </View>

      <KeyboardSafeView style={s.flex} behavior="padding">
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.scrollContent}
        >
          {/* Hero */}
          <View style={s.hero}>
            <View style={s.heroIcon}>
              <Ionicons name="heart" size={30} color={colors.onAccent} />
            </View>
            <View style={s.heroTextWrap}>
              <Text style={s.heroTitle}>How&apos;s your experience so far?</Text>
              <Text style={s.heroText}>Your feedback helps us grow.</Text>
            </View>
          </View>

          {/* Rating */}
          <View style={s.card}>
            <Text style={s.cardLabel}>Rate WeighApp</Text>
            <View style={s.stars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable
                  key={star}
                  onPress={() => setRating(star)}
                  disabled={loading}
                  hitSlop={4}
                  accessibilityRole="button"
                  accessibilityLabel={`${star} star${star > 1 ? "s" : ""}`}
                  style={({ pressed }) => [s.starBtn, pressed && s.pressed]}
                >
                  <Ionicons
                    name={star <= rating ? "star" : "star-outline"}
                    size={44}
                    color={star <= rating ? colors.accent : colors.textMuted}
                  />
                </Pressable>
              ))}
            </View>

            <View style={s.ratingLabelWrap}>
              {current ? (
                <View style={s.ratingLabel}>
                  <Ionicons name={current.icon} size={20} color={colors.accent} />
                  <Text style={s.ratingText}>{current.text}</Text>
                </View>
              ) : (
                <Text style={s.ratingHint}>Tap a star to rate us</Text>
              )}
            </View>
          </View>

          {/* Topic */}
          <View style={s.card}>
            <Text style={s.cardLabel}>What is it about? (optional)</Text>
            <View style={s.chips}>
              {TOPICS.map((t) => {
                const active = topic === t.label;
                return (
                  <Pressable
                    key={t.label}
                    disabled={loading}
                    onPress={() => setTopic(active ? null : t.label)}
                    style={({ pressed }) => [
                      s.chip,
                      active && s.chipActive,
                      pressed && s.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Ionicons
                      name={t.icon}
                      size={16}
                      color={active ? colors.onAccent : colors.accent}
                    />
                    <Text style={[s.chipText, active && s.chipTextActive]}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[s.cardLabel, s.messageLabel]}>Your message (optional)</Text>
            <TextInput
              style={s.input}
              placeholder="Tell us what you love or what we can improve..."
              placeholderTextColor={colors.textMuted}
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={MAX_LENGTH}
              textAlignVertical="top"
              editable={!loading}
            />
            <Text style={s.counter}>
              {message.length}/{MAX_LENGTH}
            </Text>
          </View>

          {/* Submit */}
          <Pressable
            style={({ pressed }) => [
              s.submitBtn,
              rating === 0 && s.submitBtnIdle,
              loading && s.submitBtnDisabled,
              pressed && s.pressed,
            ]}
            onPress={submitFeedback}
            disabled={loading}
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : (
              <>
                <Ionicons name="send" size={18} color={colors.onAccent} />
                <Text style={s.submitTxt}>Send feedback</Text>
              </>
            )}
          </Pressable>

          <Text style={s.footer}>
            Every star and word means the world to us. Thank you for helping us become better.
          </Text>
        </ScrollView>
      </KeyboardSafeView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: c.background },
    flex: { flex: 1 },
    pressed: { opacity: 0.7 },

    headerContainer: {
      paddingTop: 12,
      paddingBottom: 16,
      paddingHorizontal: 20,
      backgroundColor: c.background,
      flexDirection: "row",
      alignItems: "center",
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
      justifyContent: "center",
      alignItems: "center",
    },
    header: {
      flex: 1,
      textAlign: "center",
      fontSize: 22,
      fontWeight: "800",
      color: c.textPrimary,
    },
    headerSpacer: { width: 44 },

    scrollContent: { paddingHorizontal: 20, paddingBottom: 60 },

    hero: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      backgroundColor: c.surface,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1.5,
      borderColor: c.border,
      marginBottom: 16,
    },
    heroIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: c.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    heroTextWrap: { flex: 1 },
    heroTitle: { fontSize: 19, fontWeight: "800", color: c.textPrimary },
    heroText: {
      fontSize: 14,
      lineHeight: 20,
      color: c.textSecondary,
      marginTop: 4,
      fontWeight: "500",
    },

    card: {
      backgroundColor: c.surface,
      borderRadius: 22,
      borderWidth: 1.5,
      borderColor: c.border,
      padding: 20,
      marginBottom: 16,
    },
    cardLabel: {
      fontSize: 15,
      fontWeight: "800",
      color: c.textPrimary,
      marginBottom: 14,
    },
    messageLabel: { marginTop: 22, marginBottom: 10 },

    stars: { flexDirection: "row", justifyContent: "space-between" },
    starBtn: { padding: 2 },
    ratingLabelWrap: { minHeight: 28, marginTop: 14, alignItems: "center", justifyContent: "center" },
    ratingLabel: { flexDirection: "row", alignItems: "center", gap: 8 },
    ratingText: { fontSize: 18, fontWeight: "800", color: c.accent },
    ratingHint: { fontSize: 14, fontWeight: "600", color: c.textMuted },

    chips: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 9,
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.surfaceAlt,
    },
    chipActive: { backgroundColor: c.accent, borderColor: c.accent },
    chipText: { fontSize: 14, fontWeight: "700", color: c.textPrimary },
    chipTextActive: { color: c.onAccent },

    input: {
      backgroundColor: c.background,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 16,
      padding: 16,
      minHeight: 140,
      fontSize: 16,
      lineHeight: 22,
      color: c.textPrimary,
    },
    counter: {
      alignSelf: "flex-end",
      marginTop: 8,
      fontSize: 12,
      fontWeight: "600",
      color: c.textMuted,
    },

    submitBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      backgroundColor: c.accent,
      borderRadius: 16,
      paddingVertical: 17,
    },
    submitBtnIdle: { opacity: 0.55 },
    submitBtnDisabled: { opacity: 0.7 },
    submitTxt: { fontSize: 17, fontWeight: "800", color: c.onAccent },

    footer: {
      marginTop: 28,
      paddingHorizontal: 24,
      textAlign: "center",
      color: c.textSecondary,
      fontSize: 14,
      lineHeight: 22,
      fontWeight: "500",
    },
  });
