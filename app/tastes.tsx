// Tastes

import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "../components/ui/AppText";
import { SafeAreaView } from "react-native-safe-area-context";
import StepProgress from "../components/ui/StepProgress";
import { SUGGEST_GREEN, SUGGEST_RED } from "../components/meals/palette";
import { getSessionUser } from "../lib/auth/session";
import {
  CHOICE_LABEL,
  fetchTastes,
  saveTastes,
  TASTE_QUESTIONS,
  TasteChoice,
  TastePrefs,
} from "../lib/health/tastes";
import { goBackOr, resetTo } from "../lib/navigation";
import { Colors, useTheme } from "../providers/ThemeProvider";

const CHOICES: TasteChoice[] = ["love", "okay", "avoid"];
const CHOICE_ICON: Record<TasteChoice, keyof typeof Ionicons.glyphMap> = {
  love: "heart",
  okay: "remove-circle-outline",
  avoid: "close-circle",
};

export default function TastesScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isEdit = mode === "edit";
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [userId, setUserId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<TastePrefs>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Onboarding
  useEffect(() => {
    (async () => {
      try {
        const user = await getSessionUser();
        if (!user) {
          router.replace("/");
          return;
        }
        setUserId(user.id);
        const saved = await fetchTastes(user.id);
        if (saved) setPrefs(saved);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const answered = TASTE_QUESTIONS.filter((q) => !!prefs[q.key]).length;

  const choose = (key: (typeof TASTE_QUESTIONS)[number]["key"], choice: TasteChoice) =>
    setPrefs((prev) => ({ ...prev, [key]: prev[key] === choice ? undefined : choice }));

  const save = async () => {
    if (!userId || saving) return;
    setSaving(true);
    try {
      // Unanswered
      const final: TastePrefs = {};
      TASTE_QUESTIONS.forEach((q) => {
        final[q.key] = prefs[q.key] ?? "okay";
      });
      await saveTastes(userId, final);
      if (isEdit) goBackOr(router, "/setting");
      else resetTo(router, "/mealplan");
    } catch (err: any) {
      Alert.alert(
        "Couldn't save",
        err?.message || "Something went wrong. Please try again.",
        isEdit
          ? [{ text: "OK" }]
          : [{ text: "Try again" }, { text: "Skip for now", onPress: () => resetTo(router, "/main") }]
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </SafeAreaView>
    );
  }

  const tint = (choice: TasteChoice) =>
    choice === "love" ? SUGGEST_GREEN : choice === "avoid" ? SUGGEST_RED : colors.accent;

  return (
    <SafeAreaView style={s.safeArea} edges={["left", "right", "bottom"]}>
      <View style={s.topHeader}>
        {isEdit ? (
          <View style={s.editHeader}>
            <Pressable
              style={s.backBtn}
              onPress={() => goBackOr(router, "/setting")}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
            </Pressable>
            <Text style={s.editHeaderTitle}>Taste Preferences</Text>
            <View style={s.backBtn} />
          </View>
        ) : (
          <StepProgress step={6} />
        )}
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={s.heroIcon}>
          <Ionicons name="restaurant" size={32} color={colors.accent} />
        </View>
        <Text style={s.title}>What do you like to eat?</Text>
        <Text style={s.subtitle}>
          Tell us your tastes and we&apos;ll build a weekly meal plan that matches your calorie goal,
          your allergies and your cravings.
        </Text>

        <View style={s.counterRow}>
          <View style={s.counterTrack}>
            <View style={[s.counterFill, { width: `${(answered / TASTE_QUESTIONS.length) * 100}%` }]} />
          </View>
          <Text style={s.counterText}>
            {answered} of {TASTE_QUESTIONS.length}
          </Text>
        </View>

        {TASTE_QUESTIONS.map((q) => {
          const current = prefs[q.key];
          return (
            <View key={q.key} style={[s.card, !!current && { borderColor: tint(current) }]}>
              <View style={s.cardTop}>
                <Text style={s.cardEmoji}>{q.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.question}>{q.question}</Text>
                  <Text style={s.hint}>{q.hint}</Text>
                </View>
              </View>
              <View style={s.choiceRow}>
                {CHOICES.map((choice) => {
                  const active = current === choice;
                  return (
                    <Pressable
                      key={choice}
                      style={({ pressed }) => [
                        s.choice,
                        active && { backgroundColor: tint(choice), borderColor: tint(choice) },
                        pressed && s.pressed,
                      ]}
                      onPress={() => choose(q.key, choice)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`${q.question} ${CHOICE_LABEL[choice]}`}
                    >
                      <Ionicons
                        name={CHOICE_ICON[choice]}
                        size={16}
                        color={active ? "#ffffff" : colors.textMuted}
                      />
                      <Text style={[s.choiceText, active && s.choiceTextActive]}>{CHOICE_LABEL[choice]}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}

        <View style={s.noteRow}>
          <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
          <Text style={s.noteText}>
            Skipped questions count as &quot;It&apos;s okay&quot;. You can change these anytime in Settings.
          </Text>
        </View>
      </ScrollView>

      <View style={s.bottomBar}>
        <Pressable
          style={({ pressed }) => [s.ctaButton, saving && { opacity: 0.7 }, pressed && s.pressed]}
          onPress={save}
          disabled={saving}
          accessibilityRole="button"
        >
          {saving ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <>
              <Text style={s.ctaText}>{isEdit ? "Save preferences" : "Build my meal plan"}</Text>
              <Ionicons name={isEdit ? "checkmark" : "sparkles"} size={20} color={colors.onAccent} />
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: c.background },
    pressed: { opacity: 0.8 },
    loadingContainer: { flex: 1, backgroundColor: c.background, justifyContent: "center", alignItems: "center" },
    topHeader: { paddingTop: Platform.OS === "android" ? 60 : 64, paddingHorizontal: 24 },
    editHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    editHeaderTitle: { fontSize: 18, fontWeight: "800", color: c.textPrimary, textAlign: "center" },
    backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    scrollContent: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 28 },
    heroIcon: {
      width: 68,
      height: 68,
      borderRadius: 34,
      backgroundColor: c.surfaceAlt,
      borderWidth: 1.5,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "center",
      marginBottom: 14,
    },
    title: { fontSize: 26, fontWeight: "800", color: c.textPrimary, textAlign: "center" },
    subtitle: {
      fontSize: 15,
      color: c.textSecondary,
      textAlign: "center",
      lineHeight: 22,
      marginTop: 8,
      marginBottom: 20,
      fontWeight: "500",
      paddingHorizontal: 6,
    },
    counterRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
    counterTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: c.surfaceAlt, overflow: "hidden" },
    counterFill: { height: 8, borderRadius: 4, backgroundColor: SUGGEST_GREEN },
    counterText: { fontSize: 13, fontWeight: "800", color: c.textSecondary },
    card: {
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 20,
      padding: 16,
      marginBottom: 12,
      gap: 14,
    },
    cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
    cardEmoji: { fontSize: 30 },
    question: { fontSize: 16, fontWeight: "800", color: c.textPrimary },
    hint: { fontSize: 13, fontWeight: "500", color: c.textMuted, marginTop: 2 },
    choiceRow: { flexDirection: "row", gap: 8 },
    choice: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      paddingVertical: 11,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.background,
    },
    choiceText: { fontSize: 12.5, fontWeight: "800", color: c.textSecondary },
    choiceTextActive: { color: "#ffffff" },
    noteRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
    noteText: { flex: 1, fontSize: 12.5, fontWeight: "600", color: c.textMuted },
    bottomBar: {
      paddingHorizontal: 24,
      paddingTop: 12,
      paddingBottom: 16,
      backgroundColor: c.background,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    ctaButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      backgroundColor: c.accent,
      paddingVertical: 17,
      borderRadius: 16,
    },
    ctaText: { color: c.onAccent, fontSize: 17, fontWeight: "800", letterSpacing: 0.3 },
  });
