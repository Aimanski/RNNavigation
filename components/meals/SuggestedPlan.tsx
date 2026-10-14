// Suggested

import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "../ui/AppText";
import { PlanDay, PlanItem, Slot, WeekPlan } from "../../lib/health/mealPlan";
import { Colors, useTheme } from "../../providers/ThemeProvider";

type IconName = keyof typeof Ionicons.glyphMap;

const SLOT_ICON: Record<Slot, IconName> = {
  breakfast: "sunny",
  lunch: "partly-sunny",
  dinner: "moon",
  snack: "cafe",
};

const monthDay = (iso: string) => {
  const [, m, d] = iso.split("-").map(Number);
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[m - 1]} ${d}`;
};

const sum = (items: PlanItem[], key: "protein" | "carbs" | "fat") =>
  Math.round(items.reduce((total, it) => total + it[key], 0));

export default function SuggestedPlan({
  plan,
  goal,
  loading,
  selectedDay,
  today,
  hasTastes,
  onSelectDay,
  onShuffle,
  onOpenItem,
  onSetTastes,
  onSetGoal,
}: {
  plan: WeekPlan | null;
  goal: number | null;
  loading: boolean;
  selectedDay: number;
  today: string;
  hasTastes: boolean;
  onSelectDay: (index: number) => void;
  onShuffle: () => void;
  onOpenItem: (item: PlanItem) => void;
  onSetTastes: () => void;
  onSetGoal: () => void;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const day: PlanDay | undefined = plan?.days[selectedDay];
  const allItems = day ? day.meals.flatMap((m) => m.items) : [];
  const pct = day && goal ? Math.min(100, Math.round((day.kcal / goal) * 100)) : 0;

  return (
    <View style={s.card}>
      {/* Header */}
      <View style={s.headRow}>
        <View style={s.headIcon}>
          <Ionicons name="sparkles" size={20} color={colors.onAccent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Suggested For You</Text>
          <Text style={s.subtitle}>
            {goal ? `Your weekly meal plan, ${goal.toLocaleString()} kcal a day` : "Your weekly meal plan"}
          </Text>
        </View>
        {!!plan && (
          <Pressable
            style={({ pressed }) => [s.shuffleBtn, pressed && s.pressed]}
            onPress={onShuffle}
            accessibilityRole="button"
            accessibilityLabel="Shuffle meal plan"
            hitSlop={8}
          >
            <Ionicons name="shuffle" size={20} color={colors.accent} />
          </Pressable>
        )}
      </View>

      {loading && !plan && (
        <View style={s.stateBox}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={s.stateText}>Building your plan…</Text>
        </View>
      )}

      {!loading && !plan && !goal && (
        <View style={s.stateBox}>
          <Ionicons name="flame-outline" size={30} color={colors.accent} />
          <Text style={s.stateTitle}>We need your calorie goal</Text>
          <Text style={s.stateText}>Add your height, weight and activity so we can plan your meals.</Text>
          <Pressable style={({ pressed }) => [s.stateBtn, pressed && s.pressed]} onPress={onSetGoal}>
            <Text style={s.stateBtnText}>Set up my profile</Text>
          </Pressable>
        </View>
      )}

      {!loading && !plan && !!goal && (
        <View style={s.stateBox}>
          <Ionicons name="restaurant-outline" size={30} color={colors.accent} />
          <Text style={s.stateTitle}>No foods to suggest yet</Text>
          <Text style={s.stateText}>
            Every food in the library has an ingredient you avoid. Check your food preferences.
          </Text>
        </View>
      )}

      {!!plan && !!day && (
        <>
          {!hasTastes && (
            <Pressable style={({ pressed }) => [s.tasteBanner, pressed && s.pressed]} onPress={onSetTastes}>
              <Ionicons name="heart-outline" size={18} color={colors.accent} />
              <Text style={s.tasteBannerText}>Tell us what you like to eat for a plan that fits your taste</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.accent} />
            </Pressable>
          )}

          {/* Days */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.dayRow}
            accessibilityRole="tablist"
          >
            {plan.days.map((d, i) => {
              const active = i === selectedDay;
              const isToday = d.date === today;
              const fill = Math.min(100, Math.round((d.kcal / plan.goal) * 100));
              return (
                <Pressable
                  key={d.date}
                  style={({ pressed }) => [s.dayChip, active && s.dayChipActive, pressed && s.pressed]}
                  onPress={() => onSelectDay(i)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Day ${d.day}, ${d.weekday}${isToday ? ", today" : ""}`}
                >
                  <Text style={[s.dayNum, active && s.dayTextActive]}>Day {d.day}</Text>
                  <Text style={[s.dayWeek, active && s.dayTextActive]}>{d.weekday}</Text>
                  <View style={[s.dayBar, active && s.dayBarActive]}>
                    <View style={[s.dayBarFill, { width: `${fill}%` }, active && { backgroundColor: colors.onAccent }]} />
                  </View>
                  {isToday ? (
                    <View style={[s.todayDot, active && { backgroundColor: colors.onAccent }]} />
                  ) : (
                    <View style={s.todayDotSpace} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Summary */}
          <View style={s.daySummary}>
            <View style={{ flex: 1 }}>
              <Text style={s.dayTitle}>
                Day {day.day} · {day.weekday}, {monthDay(day.date)}
              </Text>
              <Text style={s.dayMacros}>
                Protein {sum(allItems, "protein")}g · Carbs {sum(allItems, "carbs")}g · Fat {sum(allItems, "fat")}g
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={s.dayKcal}>{day.kcal.toLocaleString()}</Text>
              <Text style={s.dayKcalUnit}>of {plan.goal.toLocaleString()} kcal</Text>
            </View>
          </View>
          <View style={s.track}>
            <View style={[s.fill, { width: `${pct}%` }]} />
          </View>

          {/* Meals */}
          {day.meals.map((meal) => (
            <View key={meal.slot} style={s.meal}>
              <View style={s.mealHead}>
                <Ionicons name={SLOT_ICON[meal.slot]} size={16} color={colors.accent} />
                <Text style={s.mealTitle}>{meal.title}</Text>
                <Text style={s.mealKcal}>{meal.kcal} kcal</Text>
              </View>
              {meal.items.map((item) => (
                <Pressable
                  key={item.food.id}
                  style={({ pressed }) => [s.row, pressed && s.pressed]}
                  onPress={() => onOpenItem(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.food.name}, ${item.grams} grams, ${item.kcal} calories`}
                >
                  {item.food.image_url ? (
                    <Image source={{ uri: item.food.image_url }} style={s.thumb} resizeMode="cover" />
                  ) : (
                    <View style={[s.thumb, s.thumbPlaceholder]}>
                      <Ionicons name="restaurant" size={20} color={colors.accent} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={s.foodName} numberOfLines={2}>
                      {item.food.name}
                    </Text>
                    <Text style={s.foodMeta}>
                      {item.grams}g · {item.kcal} kcal
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.accent} />
                </Pressable>
              ))}
            </View>
          ))}
        </>
      )}
    </View>
  );
}

const makeStyles = (c: Colors) => {
  const tint = c.surfaceAlt;
  return StyleSheet.create({
    pressed: { opacity: 0.8 },
    card: {
      backgroundColor: c.surface,
      borderRadius: 22,
      borderWidth: 2,
      borderColor: c.accent,
      padding: 16,
      marginBottom: 14,
      gap: 14,
    },
    headRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    headIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    title: { fontSize: 19, fontWeight: "800", color: c.textPrimary },
    subtitle: { fontSize: 13, fontWeight: "600", color: c.textSecondary, marginTop: 1 },
    shuffleBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: tint,
      alignItems: "center",
      justifyContent: "center",
    },
    stateBox: { alignItems: "center", gap: 8, paddingVertical: 18, paddingHorizontal: 12 },
    stateTitle: { fontSize: 16, fontWeight: "800", color: c.textPrimary },
    stateText: { fontSize: 13.5, lineHeight: 19, color: c.textSecondary, textAlign: "center", fontWeight: "500" },
    stateBtn: { backgroundColor: c.accent, borderRadius: 14, paddingVertical: 11, paddingHorizontal: 20, marginTop: 4 },
    stateBtnText: { color: c.onAccent, fontSize: 14.5, fontWeight: "800" },
    tasteBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: tint,
      borderRadius: 14,
      paddingVertical: 11,
      paddingHorizontal: 12,
    },
    tasteBannerText: { flex: 1, fontSize: 13, fontWeight: "700", color: c.textPrimary, lineHeight: 18 },
    dayRow: { gap: 8, paddingRight: 4 },
    dayChip: {
      width: 64,
      alignItems: "center",
      gap: 2,
      paddingTop: 10,
      paddingBottom: 6,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.background,
    },
    dayChipActive: { backgroundColor: c.accent, borderColor: c.accent },
    dayNum: { fontSize: 14, fontWeight: "800", color: c.textPrimary },
    dayWeek: { fontSize: 12, fontWeight: "700", color: c.textMuted },
    dayTextActive: { color: c.onAccent },
    dayBar: { width: 38, height: 4, borderRadius: 2, backgroundColor: tint, overflow: "hidden", marginTop: 4 },
    dayBarActive: { backgroundColor: c.accentLight },
    dayBarFill: { height: 4, borderRadius: 2, backgroundColor: c.accent },
    todayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: c.accent, marginTop: 3 },
    todayDotSpace: { width: 5, height: 5, marginTop: 3 },
    daySummary: { flexDirection: "row", alignItems: "center", gap: 12 },
    dayTitle: { fontSize: 16, fontWeight: "800", color: c.textPrimary },
    dayMacros: { fontSize: 12.5, fontWeight: "600", color: c.textMuted, marginTop: 3 },
    dayKcal: { fontSize: 22, fontWeight: "800", color: c.accent },
    dayKcalUnit: { fontSize: 12, fontWeight: "700", color: c.textMuted },
    track: { height: 8, borderRadius: 4, backgroundColor: tint, overflow: "hidden", marginTop: -4 },
    fill: { height: 8, borderRadius: 4, backgroundColor: c.accent },
    meal: { gap: 8 },
    mealHead: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
    mealTitle: { flex: 1, fontSize: 15, fontWeight: "800", color: c.textPrimary },
    mealKcal: { fontSize: 13, fontWeight: "800", color: c.accent },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: tint,
      borderWidth: 1.5,
      borderColor: c.accent,
      borderRadius: 16,
      padding: 10,
    },
    thumb: { width: 54, height: 54, borderRadius: 12 },
    thumbPlaceholder: { backgroundColor: c.surface, alignItems: "center", justifyContent: "center" },
    foodName: { fontSize: 14.5, fontWeight: "800", color: c.textPrimary },
    foodMeta: { fontSize: 13, fontWeight: "700", color: c.accent, marginTop: 2 },
  });
};
