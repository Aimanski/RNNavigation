// Plan

import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import SuggestedPlan from "../components/meals/SuggestedPlan";
import { Text } from "../components/ui/AppText";
import { planItemParams } from "../lib/health/mealData";
import { PlanItem } from "../lib/health/mealPlan";
import { useMealPlan, usePlanInputs } from "../lib/health/useMealPlan";
import { goBackOr } from "../lib/navigation";
import { Colors, useTheme } from "../providers/ThemeProvider";

export default function MyPlanScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const inputs = usePlanInputs();
  const { refresh, loading } = inputs;
  const { plan, today, activeDay, setSelectedDay, onShuffle, hasTastes, reloadTastes } = useMealPlan(inputs);

  useFocusEffect(
    useCallback(() => {
      refresh();
      reloadTastes();
    }, [refresh, reloadTastes])
  );

  const openItem = (item: PlanItem) =>
    router.push({ pathname: "/mealDetail", params: planItemParams(item) });

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Pressable
          style={s.backBtn}
          onPress={() => goBackOr(router, "/mealplan")}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back to Meals"
        >
          <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
        </Pressable>
        <Text style={s.title}>Your Meal Plan</Text>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <SuggestedPlan
          plan={plan}
          goal={inputs.goal}
          loading={loading}
          selectedDay={activeDay}
          today={today}
          hasTastes={hasTastes}
          onSelectDay={setSelectedDay}
          onShuffle={onShuffle}
          onOpenItem={openItem}
          onSetTastes={() => router.push({ pathname: "/tastes", params: { mode: "edit" } })}
          onSetGoal={() => router.push("/updateInfo")}
        />
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingTop: Platform.OS === "android" ? 56 : 60,
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
    title: { fontSize: 26, fontWeight: "800", color: c.textPrimary, letterSpacing: -0.3 },
    content: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 40 },
  });
