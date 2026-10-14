// Preferences

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
import { Text, TextInput } from "../components/ui/AppText";
import KeyboardSafeView from "../components/layout/KeyboardSafeView";
import { SafeAreaView } from "react-native-safe-area-context";
import StepProgress from "../components/ui/StepProgress";
import { ALLERGEN_OPTIONS, fetchAllergies, normalizeAllergen, saveAllergies } from "../lib/health/allergies";
import { getSessionUser } from "../lib/auth/session";
import { goBackOr, resetTo } from "../lib/navigation";
import { Colors, useTheme } from "../providers/ThemeProvider";

const MAX_CUSTOM_LENGTH = 30;

export default function PreferencesScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isEdit = mode === "edit";
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [userId, setUserId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [customText, setCustomText] = useState("");
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
        const saved = await fetchAllergies(user.id);
        if (saved) setSelected(saved);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const has = (label: string) => selected.some((x) => x.toLowerCase() === label.toLowerCase());

  const toggle = (label: string) =>
    setSelected((prev) =>
      prev.some((x) => x.toLowerCase() === label.toLowerCase())
        ? prev.filter((x) => x.toLowerCase() !== label.toLowerCase())
        : [...prev, label]
    );

  const addCustom = () => {
    const value = normalizeAllergen(customText).slice(0, MAX_CUSTOM_LENGTH);
    if (!value) return;
    if (!has(value)) setSelected((prev) => [...prev, value]);
    setCustomText("");
  };

  const customItems = selected.filter(
    (x) => !ALLERGEN_OPTIONS.some((o) => o.label.toLowerCase() === x.toLowerCase())
  );

  const save = async () => {
    if (!userId || saving) return;
    setSaving(true);
    try {
      // Input
      const pending = normalizeAllergen(customText).slice(0, MAX_CUSTOM_LENGTH);
      const finalList = pending && !has(pending) ? [...selected, pending] : selected;
      await saveAllergies(userId, finalList);
      if (isEdit) goBackOr(router, "/setting");
      else resetTo(router, "/tastes");
    } catch (err: any) {
      const message = err?.message || "Something went wrong. Please try again.";
      Alert.alert(
        "Couldn't save",
        message,
        isEdit
          ? [{ text: "OK" }]
          : [
              { text: "Try again" },
              // Onboarding
              { text: "Skip for now", onPress: () => resetTo(router, "/tastes") },
            ]
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

  const count = selected.length;
  const ctaLabel = isEdit
    ? "Save preferences"
    : count > 0
      ? `Continue with ${count} ${count === 1 ? "allergy" : "allergies"}`
      : "I have no allergies, continue";

  return (
    <SafeAreaView style={s.safeArea} edges={["left", "right", "bottom"]}>
      <View style={s.topHeader}>
        {isEdit ? (
          <View style={s.editHeader}>
            <Text style={s.editHeaderTitle}>Food Preferences</Text>
          </View>
        ) : (
          <StepProgress step={5} />
        )}
      </View>

      <KeyboardSafeView
        style={{ flex: 1 }}
        behavior="padding"
      >
        <ScrollView
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.heroIcon}>
            <Ionicons name="shield-checkmark" size={34} color={colors.accent} />
          </View>
          <Text style={s.title}>Any food allergies?</Text>
          <Text style={s.subtitle}>
            Pick the ingredients you&apos;re allergic to or avoid. We&apos;ll warn you on every meal
            that contains them.
          </Text>

          <View style={s.chipWrap}>
            {ALLERGEN_OPTIONS.map((option) => {
              const active = has(option.label);
              return (
                <Pressable
                  key={option.label}
                  style={({ pressed }) => [s.chip, active && s.chipActive, pressed && s.pressed]}
                  onPress={() => toggle(option.label)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={option.label}
                >
                  <Text style={s.chipEmoji}>{option.emoji}</Text>
                  <Text style={[s.chipText, active && s.chipTextActive]}>{option.label}</Text>
                  {active && <Ionicons name="checkmark-circle" size={18} color={colors.accent} />}
                </Pressable>
              );
            })}
          </View>

          <Text style={s.sectionLabel}>Something else?</Text>
          <View style={s.customRow}>
            <TextInput
              style={s.customInput}
              value={customText}
              onChangeText={setCustomText}
              placeholder="Type an ingredient, e.g. Pineapple"
              placeholderTextColor={colors.textMuted}
              maxLength={MAX_CUSTOM_LENGTH}
              returnKeyType="done"
              onSubmitEditing={addCustom}
              autoCapitalize="words"
              autoCorrect={false}
            />
            <Pressable
              style={({ pressed }) => [s.addBtn, !customText.trim() && s.addBtnOff, pressed && s.pressed]}
              onPress={addCustom}
              disabled={!customText.trim()}
              accessibilityRole="button"
              accessibilityLabel="Add ingredient"
            >
              <Ionicons name="add" size={26} color={colors.onAccent} />
            </Pressable>
          </View>

          {customItems.length > 0 && (
            <View style={[s.chipWrap, { marginTop: 14 }]}>
              {customItems.map((item) => (
                <Pressable
                  key={item}
                  style={({ pressed }) => [s.chip, s.chipActive, pressed && s.pressed]}
                  onPress={() => toggle(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item}`}
                >
                  <Text style={[s.chipText, s.chipTextActive]}>{item}</Text>
                  <Ionicons name="close-circle" size={18} color={colors.accent} />
                </Pressable>
              ))}
            </View>
          )}

          <View style={s.noteRow}>
            <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
            <Text style={s.noteText}>
              You can change this anytime in Settings → Food Preferences.
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
              <Text style={s.ctaText}>{ctaLabel}</Text>
              <Ionicons name={isEdit ? "checkmark" : "arrow-forward"} size={20} color={colors.onAccent} />
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
    loadingContainer: {
      flex: 1,
      backgroundColor: c.background,
      justifyContent: "center",
      alignItems: "center",
    },
    topHeader: {
      paddingTop: Platform.OS === "android" ? 60 : 64,
      paddingHorizontal: 24,
    },
    editHeader: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
    editHeaderTitle: { fontSize: 18, fontWeight: "800", color: c.textPrimary, textAlign: "center" },
    backBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
      justifyContent: "center",
      alignItems: "center",
    },
    backBtnSpacer: { width: 44 },
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
    chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 999,
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    chipActive: { borderColor: c.accent, backgroundColor: c.surfaceAlt },
    chipEmoji: { fontSize: 18 },
    chipText: { fontSize: 15, fontWeight: "700", color: c.textSecondary },
    chipTextActive: { color: c.textPrimary },
    sectionLabel: {
      fontSize: 16,
      fontWeight: "800",
      color: c.textPrimary,
      marginTop: 26,
      marginBottom: 10,
    },
    customRow: { flexDirection: "row", gap: 10, alignItems: "center" },
    customInput: {
      flex: 1,
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 13,
      fontSize: 15,
      fontWeight: "600",
      color: c.textPrimary,
    },
    addBtn: {
      width: 50,
      height: 50,
      borderRadius: 16,
      backgroundColor: c.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    addBtnOff: { opacity: 0.4 },
    noteRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 24 },
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
