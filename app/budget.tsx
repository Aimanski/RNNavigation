// Budget

import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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
import StepProgress from "../components/ui/StepProgress";
import { getSessionUser } from "../lib/auth/session";
import {
  BUDGET_PRESETS,
  fetchBudget,
  formatPeso,
  MAX_BUDGET,
  MIN_BUDGET,
  saveBudget,
} from "../lib/health/budget";
import { goBackOr, resetTo } from "../lib/navigation";
import { Colors, useTheme } from "../providers/ThemeProvider";

export default function BudgetScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isEdit = mode === "edit";
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [userId, setUserId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [custom, setCustom] = useState("");
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
        const saved = await fetchBudget(user.id);
        if (saved !== null) {
          setAmount(saved);
          if (saved > 0 && !BUDGET_PRESETS.some((p) => p.amount === saved)) setCustom(String(saved));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const customValue = custom.trim() ? Number(custom.replace(/[^0-9]/g, "")) : null;
  const effective = customValue !== null ? customValue : amount;

  const pickPreset = (value: number) => {
    setCustom("");
    setAmount(value);
  };

  const save = async () => {
    if (!userId || saving) return;
    if (effective === null) {
      Alert.alert("Choose a budget", "Pick one of the options or type your own amount.");
      return;
    }
    if (effective > 0 && (effective < MIN_BUDGET || effective > MAX_BUDGET)) {
      Alert.alert(
        "Check your amount",
        `Enter a daily budget between ${formatPeso(MIN_BUDGET)} and ${formatPeso(MAX_BUDGET)}.`
      );
      return;
    }
    setSaving(true);
    try {
      await saveBudget(userId, effective);
      if (isEdit) goBackOr(router, "/setting");
      else resetTo(router, "/main");
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
            <Text style={s.editHeaderTitle}>Food Budget</Text>
            <View style={s.backBtn} />
          </View>
        ) : (
          <StepProgress step={7} />
        )}
      </View>

      <KeyboardSafeView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.heroIcon}>
            <Ionicons name="wallet" size={32} color={colors.accent} />
          </View>
          <Text style={s.title}>What&apos;s your daily food budget?</Text>
          <Text style={s.subtitle}>
            We&apos;ll pick meals that fit. This covers one whole day of food: breakfast, lunch, dinner and a snack.
          </Text>

          {BUDGET_PRESETS.map((preset) => {
            const active = customValue === null && amount === preset.amount;
            return (
              <Pressable
                key={preset.key}
                style={({ pressed }) => [s.card, active && s.cardActive, pressed && s.pressed]}
                onPress={() => pickPreset(preset.amount)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${preset.label}, ${preset.amount ? formatPeso(preset.amount) + " a day" : "no limit"}`}
              >
                <View style={[s.cardIcon, active && s.cardIconActive]}>
                  <Ionicons
                    name={preset.icon as keyof typeof Ionicons.glyphMap}
                    size={22}
                    color={active ? colors.onAccent : colors.accent}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{preset.label}</Text>
                  <Text style={s.cardHint}>{preset.hint}</Text>
                </View>
                <Text style={[s.cardAmount, active && s.cardAmountActive]}>
                  {preset.amount ? `${formatPeso(preset.amount)}/day` : "Any"}
                </Text>
              </Pressable>
            );
          })}

          <Text style={s.sectionLabel}>Or type your own</Text>
          <View style={[s.customRow, customValue !== null && s.customRowActive]}>
            <Text style={s.peso}>₱</Text>
            <TextInput
              style={s.customInput}
              value={custom}
              onChangeText={(t) => setCustom(t.replace(/[^0-9]/g, "").slice(0, 4))}
              placeholder="Amount per day"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              returnKeyType="done"
              maxLength={4}
            />
          </View>

          <View style={s.noteRow}>
            <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
            <Text style={s.noteText}>
              Prices are estimates. A very low budget may not cover your full calorie goal, so we&apos;ll show the
              cheapest plan we can. You can change this anytime in Settings.
            </Text>
          </View>
        </ScrollView>
      </KeyboardSafeView>

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
              <Text style={s.ctaText}>{isEdit ? "Save budget" : "Build my meal plan"}</Text>
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
    pressed: { opacity: 0.85 },
    loadingContainer: { flex: 1, backgroundColor: c.background, justifyContent: "center", alignItems: "center" },
    topHeader: { paddingTop: 22, paddingHorizontal: 24 },
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
      marginBottom: 22,
      fontWeight: "500",
      paddingHorizontal: 6,
    },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 18,
      padding: 14,
      marginBottom: 10,
    },
    cardActive: { borderColor: c.accent, backgroundColor: c.surfaceAlt, borderWidth: 2 },
    cardIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    cardIconActive: { backgroundColor: c.accent },
    cardTitle: { fontSize: 16, fontWeight: "800", color: c.textPrimary },
    cardHint: { fontSize: 13, fontWeight: "500", color: c.textMuted, marginTop: 2 },
    cardAmount: { fontSize: 15, fontWeight: "800", color: c.textSecondary },
    cardAmountActive: { color: c.accent },
    sectionLabel: { fontSize: 16, fontWeight: "800", color: c.textPrimary, marginTop: 18, marginBottom: 10 },
    customRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 16,
      paddingHorizontal: 16,
    },
    customRowActive: { borderColor: c.accent, borderWidth: 2 },
    peso: { fontSize: 20, fontWeight: "800", color: c.textSecondary },
    customInput: { flex: 1, paddingVertical: 14, fontSize: 16, fontWeight: "700", color: c.textPrimary },
    noteRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 20 },
    noteText: { flex: 1, fontSize: 12.5, fontWeight: "600", color: c.textMuted, lineHeight: 18 },
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
