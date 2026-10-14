// Meals

import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import PlanTeaser from "../components/meals/PlanTeaser";
import { SUGGEST_GREEN } from "../components/meals/palette";
import { Text, TextInput } from "../components/ui/AppText";
import { SafeAreaView } from "react-native-safe-area-context";
import { fetchAllergies, findAllergens, ingredientNames } from "../lib/health/allergies";
import { Food, fetchFoods, MEALS_CACHE_KEY, MealSnapshot } from "../lib/health/mealData";
import { useMealPlan } from "../lib/health/useMealPlan";
import { cache } from "../lib/cache";
import { getSessionUser } from "../lib/auth/session";
import { supabase } from "../lib/supabase";
import { Colors, useTheme } from "../providers/ThemeProvider";

const PH_TIMEZONE = "Asia/Manila";
const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Paging
const PAGE_SIZE = 4;
const GRID_PAD = 14;
const GRID_GAP = 12;
// Layout
const DEFAULT_GRID_WIDTH = SCREEN_WIDTH - 20 * 2 - 3;

const getPHDateString = (date: Date | string): string => {
  const d = new Date(date);
  const year  = d.toLocaleString("en-US", { timeZone: PH_TIMEZONE, year: "numeric" });
  const month = d.toLocaleString("en-US", { timeZone: PH_TIMEZONE, month: "2-digit" });
  const day   = d.toLocaleString("en-US", { timeZone: PH_TIMEZONE, day: "2-digit" });
  return `${year}-${month}-${day}`;
};

const getTodayPHDateString = (): string => getPHDateString(new Date());

const chunk = <T,>(items: T[], size: number): T[][] => {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages;
};

type MealType = "breakfast" | "lunch" | "dinner";
type SectionKey = MealType | "scanned";
type IconName = keyof typeof Ionicons.glyphMap;

// Danger
const DANGER_COLOR = "#ef4444";

const MEAL_SECTIONS: { key: MealType; title: string; icon: IconName }[] = [
  { key: "breakfast", title: "Breakfast", icon: "sunny" },
  { key: "lunch", title: "Lunch", icon: "partly-sunny" },
  { key: "dinner", title: "Dinner", icon: "moon" },
];

// Cube
const FoodCube = ({
  food,
  onPress,
  size,
  s,
  colors,
  allergens,
  suggested,
}: {
  food: Food;
  onPress: () => void;
  size: number;
  s: ReturnType<typeof makeStyles>;
  colors: Colors;
  allergens?: string[];
  suggested?: boolean;
}) => (
  <Pressable
    style={[
      s.foodCube,
      !!suggested && !allergens?.length && s.foodCubeSuggest,
      !!allergens?.length && s.foodCubeWarn,
      { width: size, height: size },
    ]}
    onPress={onPress}
    android_ripple={{ color: "rgba(11, 111, 219,0.2)" }}
    accessibilityRole="button"
    accessibilityLabel={
      allergens?.length
        ? `${food.name}, ${food.calories} calories. Warning: contains ${allergens.join(", ")}, which you are allergic to`
        : `${food.name}, ${food.calories} calories`
    }
  >
    {food.image_url ? (
      <Image source={{ uri: food.image_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
    ) : (
      <View style={[StyleSheet.absoluteFill, s.cubePlaceholder]}>
        <Ionicons name="restaurant" size={30} color={colors.accent} />
      </View>
    )}
    <View style={[StyleSheet.absoluteFill, s.cubeOverlay]} />
    {!!allergens?.length && (
      <View style={s.allergenBadge}>
        <Ionicons name="warning" size={15} color="#ffffff" />
      </View>
    )}
    {!!suggested && !allergens?.length && (
      <View style={s.suggestBadge}>
        <Ionicons name="star" size={15} color="#ffffff" />
      </View>
    )}
    <View style={s.cubeChevron}>
      <Ionicons name="chevron-forward-circle" size={20} color="rgba(255,255,255,0.85)" />
    </View>
    <View style={s.cubeContent}>
      <Text style={s.cubeName} numberOfLines={2}>{food.name}</Text>
      <View style={s.cubeCaloriePill}>
        <Text style={s.cubeCalorieText}>{food.calories} kcal</Text>
      </View>
    </View>
  </Pressable>
);

// Grid
const PagedCubeGrid = ({
  foods,
  onPress,
  s,
  colors,
  emptyIcon,
  emptyTitle,
  emptyText,
  warnings,
  suggestedIds,
}: {
  foods: Food[];
  onPress: (food: Food) => void;
  s: ReturnType<typeof makeStyles>;
  colors: Colors;
  emptyIcon: IconName;
  emptyTitle: string;
  emptyText?: string;
  warnings: Record<string, string[]>;
  suggestedIds?: Set<string>;
}) => {
  const scrollRef = useRef<ScrollView>(null);
  const [width, setWidth] = useState(DEFAULT_GRID_WIDTH);
  const [page, setPage] = useState(0);

  const pages = useMemo(() => chunk(foods, PAGE_SIZE), [foods]);
  const cube = (width - GRID_PAD * 2 - GRID_GAP) / 2;
  const current = Math.min(page, Math.max(pages.length - 1, 0));

  const goTo = (index: number) => {
    const next = Math.max(0, Math.min(pages.length - 1, index));
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
    setPage(next);
  };

  if (foods.length === 0) {
    return (
      <View style={s.emptyBox}>
        <Ionicons name={emptyIcon} size={30} color={colors.textMuted} />
        <Text style={s.emptyTitle}>{emptyTitle}</Text>
        {!!emptyText && <Text style={s.emptyText}>{emptyText}</Text>}
      </View>
    );
  }

  const renderRow = (row: Food[]) => (
    <View style={s.cubeRow}>
      {row.map((food) => (
        <FoodCube
          key={food.id}
          food={food}
          onPress={() => onPress(food)}
          size={cube}
          s={s}
          colors={colors}
          allergens={warnings[food.id]}
          suggested={suggestedIds?.has(food.id)}
        />
      ))}
      {row.length === 1 && <View style={{ width: cube }} />}
    </View>
  );

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) =>
          setPage(Math.round(e.nativeEvent.contentOffset.x / width))
        }
      >
        {pages.map((items, pi) => (
          <View key={pi} style={{ width, padding: GRID_PAD, gap: GRID_GAP }}>
            {/* Lazy */}
            {Math.abs(pi - current) <= 1 ? (
              <>
                {renderRow(items.slice(0, 2))}
                {items.length > 2 && renderRow(items.slice(2, 4))}
              </>
            ) : (
              <View style={{ height: items.length > 2 ? cube * 2 + GRID_GAP : cube }} />
            )}
          </View>
        ))}
      </ScrollView>

      {pages.length > 1 && (
        <View style={s.pager}>
          <Pressable
            style={[s.pagerBtn, current === 0 && s.pagerBtnOff]}
            onPress={() => goTo(current - 1)}
            disabled={current === 0}
            hitSlop={8}
            accessibilityLabel="Previous foods"
          >
            <Ionicons name="chevron-back" size={20} color={colors.accent} />
          </Pressable>
          <Text style={s.pagerText}>
            {current + 1} / {pages.length}
          </Text>
          <Pressable
            style={[s.pagerBtn, current >= pages.length - 1 && s.pagerBtnOff]}
            onPress={() => goTo(current + 1)}
            disabled={current >= pages.length - 1}
            hitSlop={8}
            accessibilityLabel="Next foods"
          >
            <Ionicons name="chevron-forward" size={20} color={colors.accent} />
          </Pressable>
        </View>
      )}
    </View>
  );
};

// Section
const FoodSection = ({
  title,
  icon,
  count,
  expanded,
  onToggle,
  s,
  colors,
  children,
}: {
  title: string;
  icon: IconName;
  count: number | null;
  expanded: boolean;
  onToggle: () => void;
  s: ReturnType<typeof makeStyles>;
  colors: Colors;
  children: React.ReactNode;
}) => (
  <View style={s.section}>
    <Pressable
      style={s.accordionHeader}
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
    >
      <View style={s.accordionLeft}>
        <View style={s.sectionIcon}>
          <Ionicons name={icon} size={20} color={colors.accent} />
        </View>
        <Text style={s.accordionTitle}>{title}</Text>
        {count !== null && (
          <View style={s.countPill}>
            <Text style={s.countText}>{count}</Text>
          </View>
        )}
      </View>
      <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={22} color={colors.accent} />
    </Pressable>
    {expanded && children}
  </View>
);

export default function MealplanScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const s = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  // Cache
  const cached = cache.get<MealSnapshot>(MEALS_CACHE_KEY);
  const [foods, setFoods] = useState<Food[]>(cached?.foods ?? []);
  const [userId, setUserId] = useState<string | null>(cached?.userId ?? null);
  const [goalCalories, setGoalCalories] = useState<number | null>(cached?.goalCalories ?? null);
  const [totalCaloriesToday, setTotalCaloriesToday] = useState<number>(cached?.total ?? 0);
  const [warnings, setWarnings] = useState<Record<string, string[]>>(cached?.warnings ?? {});
  const [loading, setLoading] = useState(!cached);
  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>({
    breakfast: false, lunch: false, dinner: false, scanned: false,
  });
  const [searchQuery, setSearchQuery] = useState("");

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const loadData = async () => {
        // Loading
        if (!cache.get(MEALS_CACHE_KEY)) setLoading(true);
        try {
          const user = await getSessionUser();
          if (!user) { router.replace("/"); return; }
          const uid = user.id;
          const todayStr = getTodayPHDateString();

          // Window
          const since = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();

          // Parallel
          const [foodsRes, entriesRes, profileRes, allergies] = await Promise.all([
            fetchFoods(),
            supabase
              .from("selected_foods")
              .select("food_id, quantity, created_at, calories")
              .eq("user_id", uid)
              .gte("created_at", since),
            supabase.from("weighApp").select("goal_calories").eq("id", uid).maybeSingle(),
            fetchAllergies(uid),
          ]);

          if (foodsRes.error) throw new Error(foodsRes.error.message || "Failed to load foods");
          const fetchedFoods: Food[] = foodsRes.data || [];

          // Allergies
          const nextWarnings: Record<string, string[]> = {};
          if (allergies && allergies.length > 0) {
            fetchedFoods.forEach((food) => {
              const hits = findAllergens(allergies, [food.name, ...ingredientNames(food.ingredients)]);
              if (hits.length > 0) nextWarnings[food.id] = hits;
            });
          }

          let total = 0;
          (entriesRes.data || [])
            .filter((entry) => getPHDateString(entry.created_at) === todayStr)
            .forEach((entry) => {
              const food = fetchedFoods.find((f) => f.id === entry.food_id);
              if (food) total += food.calories * entry.quantity;
            });

          const goal =
            profileRes.data && profileRes.data.goal_calories > 0
              ? profileRes.data.goal_calories
              : null;

          cache.set<MealSnapshot>(MEALS_CACHE_KEY, {
            foods: fetchedFoods,
            userId: uid,
            goalCalories: goal,
            total,
            warnings: nextWarnings,
          });
          if (!active) return;
          setUserId(uid);
          setWarnings(nextWarnings);
          setFoods(fetchedFoods);
          setTotalCaloriesToday(total);
          setGoalCalories(goal);
        } catch (err: any) {
          Alert.alert("Error", err.message || "Failed to load data");
        } finally {
          if (active) setLoading(false);
        }
      };
      loadData();
      return () => {
        active = false;
      };
    }, [router])
  );

  const goToFoodDetail = (food: Food) => {
    router.push({
      pathname: "/mealDetail",
      params: {
        name: food.name,
        calories: food.calories.toString(),
        protein: (food.protein || 0).toFixed(1),
        carbs: (food.carbs || 0).toFixed(1),
        fat: (food.fat || 0).toFixed(1),
        items: JSON.stringify([{
          id: food.id,
          name: food.name,
          calories: food.calories,
          protein: food.protein,
          carbs: food.carbs,
          fat: food.fat,
          desc: `${food.calories} kcal`,
          image_url: food.image_url,
        }]),
      },
    });
  };

  // Catalog
  const catalogFoods = useMemo(() => foods.filter((f) => !f.user_id), [foods]);
  const scannedFoods = useMemo(
    () =>
      foods
        .filter((f) => !!f.user_id && f.user_id === userId)
        .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")),
    [foods, userId]
  );

  const mealSections: Record<MealType, Food[]> = {
    breakfast: catalogFoods.filter((f) => f.meal_type === "breakfast" || f.meal_type === "all"),
    lunch:     catalogFoods.filter((f) => f.meal_type === "lunch"     || f.meal_type === "all"),
    dinner:    catalogFoods.filter((f) => f.meal_type === "dinner"    || f.meal_type === "all"),
  };

  // Suggested
  const { plan, todayIndex, reloadTastes } = useMealPlan({
    foods,
    goal: goalCalories,
    warnings,
    userId,
  });

  // Refresh
  useFocusEffect(
    useCallback(() => {
      reloadTastes();
    }, [reloadTastes])
  );

  const query = searchQuery.trim().toLowerCase();
  const filteredFoods = useMemo(
    () => catalogFoods.filter((f) => f.name.toLowerCase().includes(query)),
    [catalogFoods, query]
  );

  const toggle = (key: SectionKey) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const goalPct = goalCalories
    ? Math.min(100, Math.round((totalCaloriesToday / goalCalories) * 100))
    : 0;

  // Loading
  const initialLoading = loading && foods.length === 0;
  const loadingBox = (
    <View style={s.emptyBox}>
      <ActivityIndicator size="small" color={colors.accent} />
      <Text style={s.emptyText}>Loading foods…</Text>
    </View>
  );

  return (
    <SafeAreaView style={s.safeArea} edges={["left", "right"]}>
      <ScrollView
        style={s.container}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Summary */}
        <View style={s.summaryCard}>
          <View style={s.summaryLeft}>
            <View style={s.summaryLabelRow}>
              <Ionicons name="flame" size={16} color={colors.accent} />
              <Text style={s.summaryLabel}>Today&apos;s total</Text>
              {loading && <ActivityIndicator size="small" color={colors.accent} />}
            </View>
            <Text style={s.summaryValue}>
              {totalCaloriesToday.toLocaleString()}
              <Text style={s.summaryUnit}> kcal</Text>
            </Text>

            {goalCalories ? (
              <>
                <View style={s.progressTrack}>
                  <View style={[s.progressFill, { width: `${goalPct}%` }]} />
                </View>
                <Text style={s.summaryHint}>
                  {goalPct}% of your {goalCalories.toLocaleString()} kcal goal
                </Text>
              </>
            ) : (
              <Text style={s.summaryHint}>Add foods below to track your day</Text>
            )}
          </View>

          <View style={s.scanWrap}>
            <Pressable
              style={({ pressed }) => [s.scanBtn, pressed && s.pressed]}
              onPress={() => router.push("/scanFood")}
              accessibilityRole="button"
              accessibilityLabel="Scan food"
            >
              <Ionicons name="camera" size={26} color={colors.onAccent} />
            </Pressable>
            <Text style={s.scanBtnLabel}>Scan Food</Text>
          </View>
        </View>

        {/* Suggested */}
        <PlanTeaser
          plan={plan}
          goal={goalCalories}
          loading={initialLoading}
          todayIndex={todayIndex}
          onOpen={() => router.push("/myplan")}
        />

        {/* Legend */}
        {(Object.keys(warnings).length > 0 || !!plan) && (
          <View style={s.legend}>
            {Object.keys(warnings).length > 0 && (
              <View style={s.legendItem}>
                <View style={[s.legendIcon, { backgroundColor: DANGER_COLOR }]}>
                  <Ionicons name="warning" size={14} color="#ffffff" />
                </View>
                <Text style={s.legendText}>Allergen</Text>
              </View>
            )}
            {Object.keys(warnings).length > 0 && !!plan && <View style={s.legendDivider} />}
            {!!plan && (
              <View style={s.legendItem}>
                <View style={[s.legendIcon, { backgroundColor: SUGGEST_GREEN }]}>
                  <Ionicons name="star" size={14} color="#ffffff" />
                </View>
                <Text style={s.legendText}>Suggested</Text>
              </View>
            )}
          </View>
        )}

        {/* Meals */}
        {MEAL_SECTIONS.map(({ key, title, icon }) => (
          <FoodSection
            key={key}
            title={title}
            icon={icon}
            count={initialLoading ? null : mealSections[key].length}
            expanded={expanded[key]}
            onToggle={() => toggle(key)}
            s={s}
            colors={colors}
          >
            {initialLoading ? (
              loadingBox
            ) : (
              <PagedCubeGrid
                foods={mealSections[key]}
                onPress={goToFoodDetail}
                warnings={warnings}
                suggestedIds={plan?.foodIds}
                s={s}
                colors={colors}
                emptyIcon="restaurant-outline"
                emptyTitle={`No ${title.toLowerCase()} foods yet`}
              />
            )}
          </FoodSection>
        ))}

        {/* Scanned */}
        <FoodSection
          title="Scanned Foods"
          icon="scan-outline"
          count={initialLoading ? null : scannedFoods.length}
          expanded={expanded.scanned}
          onToggle={() => toggle("scanned")}
          s={s}
          colors={colors}
        >
          <View style={s.privateRow}>
            <Ionicons name="lock-closed-outline" size={14} color={colors.textMuted} />
            <Text style={s.privateText}>Only you can see these</Text>
          </View>
          {initialLoading ? (
            loadingBox
          ) : (
            <PagedCubeGrid
              foods={scannedFoods}
              onPress={goToFoodDetail}
              warnings={warnings}
              suggestedIds={plan?.foodIds}
              s={s}
              colors={colors}
              emptyIcon="camera-outline"
              emptyTitle="No scanned foods yet"
              emptyText="Foods you scan with the camera are saved here, just for you."
            />
          )}
        </FoodSection>

        {/* Library */}
        <View style={s.section}>
          <View style={s.accordionHeader}>
            <View style={s.accordionLeft}>
              <View style={s.sectionIcon}>
                <Ionicons name="library-outline" size={20} color={colors.accent} />
              </View>
              <Text style={s.accordionTitle}>Available Library</Text>
              {!initialLoading && (
                <View style={s.countPill}>
                  <Text style={s.countText}>{filteredFoods.length}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={s.librarySearchContainer}>
            <View style={s.searchBar}>
              <Ionicons name="search" size={18} color={colors.accent} style={{ marginRight: 8 }} />
              <TextInput
                style={s.searchInput}
                placeholder="Search food..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </Pressable>
              )}
            </View>
          </View>

          {initialLoading ? (
            loadingBox
          ) : (
            <PagedCubeGrid
              key={query}
              foods={filteredFoods}
              onPress={goToFoodDetail}
              warnings={warnings}
              suggestedIds={plan?.foodIds}
              s={s}
              colors={colors}
              emptyIcon="search"
              emptyTitle={query ? "No foods match your search" : "No foods available"}
              emptyText={query ? "Try a different name." : undefined}
            />
          )}
        </View>

        <View style={{ height: 210 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Colors, isDark: boolean) => {
  // Background
  const sectionBg = isDark ? c.surface : "#F1F3F5";

  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: c.background },
    container: { flex: 1, backgroundColor: c.background },
    listContent: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 20 },
    pressed: { opacity: 0.75 },

    // Summary
    summaryCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      backgroundColor: c.surface,
      borderRadius: 24,
      borderWidth: 1.5,
      borderColor: c.border,
      padding: 20,
      marginBottom: 18,
    },
    summaryLeft: { flex: 1 },
    summaryLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    summaryLabel: { fontSize: 13, fontWeight: "800", color: c.textSecondary, letterSpacing: 0.3 },
    summaryValue: { fontSize: 34, fontWeight: "900", color: c.textPrimary, marginTop: 4 },
    summaryUnit: { fontSize: 16, fontWeight: "700", color: c.textSecondary },
    progressTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: c.surfaceAlt,
      overflow: "hidden",
      marginTop: 10,
    },
    progressFill: { height: "100%", borderRadius: 4, backgroundColor: c.accent },
    summaryHint: { fontSize: 12.5, fontWeight: "600", color: c.textSecondary, marginTop: 8 },
    scanWrap: { alignItems: "center" },
    scanBtn: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.accent,
    },
    scanBtnLabel: { color: c.accentDark, fontSize: 12.5, fontWeight: "800", marginTop: 8 },

    // Cards
    section: {
      marginBottom: 14,
      backgroundColor: sectionBg,
      borderRadius: 20,
      overflow: "hidden",
      borderWidth: 1.5,
      borderColor: c.border,
    },
    accordionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 14,
      paddingHorizontal: 16,
      backgroundColor: sectionBg,
    },
    accordionLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
    sectionIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    accordionTitle: { fontSize: 17, fontWeight: "800", color: c.textPrimary },
    countPill: {
      minWidth: 26,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: c.surfaceAlt,
      alignItems: "center",
    },
    countText: { fontSize: 12, fontWeight: "800", color: c.accent },

    privateRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 18,
      paddingBottom: 2,
    },
    privateText: { fontSize: 12.5, fontWeight: "600", color: c.textMuted },

    // Search
    librarySearchContainer: {
      paddingHorizontal: 16,
      paddingBottom: 4,
      backgroundColor: sectionBg,
    },
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.background,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: c.border,
    },
    searchInput: { flex: 1, fontSize: 15, color: c.textPrimary, fontWeight: "500", paddingVertical: 0 },

    // Grid
    cubeRow: { flexDirection: "row", justifyContent: "space-between" },
    foodCube: {
      borderRadius: 18,
      overflow: "hidden",
      backgroundColor: "#000000",
      borderWidth: 1.5,
      borderColor: c.border,
    },
    // Placeholder
    cubePlaceholder: { backgroundColor: c.surfaceAlt, justifyContent: "flex-start", alignItems: "center", paddingTop: 40 },
    cubeOverlay: { backgroundColor: "rgba(0, 0, 0,0.42)" },
    cubeContent: { flex: 1, justifyContent: "flex-end", padding: 12 },
    cubeName: {
      fontSize: 13,
      fontWeight: "800",
      color: "#fff",
      marginBottom: 6,
      textShadowColor: "rgba(0,0,0,0.5)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    cubeCaloriePill: {
      alignSelf: "flex-start",
      backgroundColor: c.accent,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 20,
    },
    cubeCalorieText: { color: c.onAccent, fontSize: 11, fontWeight: "700" },
    cubeChevron: { position: "absolute", top: 10, right: 10 },
    foodCubeWarn: { borderWidth: 2.5, borderColor: DANGER_COLOR },
    foodCubeSuggest: { borderWidth: 2.5, borderColor: SUGGEST_GREEN },
    suggestBadge: {
      position: "absolute",
      top: 10,
      left: 10,
      width: 28,
      height: 28,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: SUGGEST_GREEN,
      borderRadius: 14,
    },
    allergenBadge: {
      position: "absolute",
      top: 10,
      left: 10,
      width: 28,
      height: 28,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: DANGER_COLOR,
      borderRadius: 14,
    },
    legend: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 14,
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 16,
      paddingVertical: 10,
      paddingHorizontal: 14,
      marginBottom: 14,
    },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
    legendIcon: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    legendText: { fontSize: 14, fontWeight: "800", color: c.textPrimary },
    legendDivider: { width: 1.5, height: 20, backgroundColor: c.border },

    // Pager
    pager: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
      paddingBottom: 14,
    },
    pagerBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    pagerBtnOff: { opacity: 0.35 },
    pagerText: { fontSize: 13.5, fontWeight: "800", color: c.textSecondary, minWidth: 48, textAlign: "center" },

    // Empty
    emptyBox: { alignItems: "center", gap: 6, paddingVertical: 26, paddingHorizontal: 24 },
    emptyTitle: { fontSize: 15, fontWeight: "800", color: c.textPrimary, marginTop: 4 },
    emptyText: { fontSize: 13, lineHeight: 19, color: c.textSecondary, textAlign: "center" },
  });
};
