import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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
import { Text } from "../components/ui/AppText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { findAllergens, ingredientNames, useAllergies } from "../lib/health/allergies";
import { cache } from "../lib/cache";
import { goBackOr } from "../lib/navigation";
import { supabase } from "../lib/supabase";
import { getSessionUser } from "../lib/auth/session";
import { Colors, useTheme } from "../providers/ThemeProvider";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const HERO_HEIGHT = SCREEN_HEIGHT * 0.36;

// Macros
const PROTEIN_COLOR = "#ef4444";
const CARBS_COLOR = "#3b82f6";
const FAT_COLOR = "#f59e0b";
const DANGER_COLOR = "#ef4444";

const MAX_SERVINGS = 10;
// Ingredients
const INGREDIENTS_PREVIEW = 4;

type Ingredient = {
  name: string;
  image_url: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
};

export default function MealDetailScreen() {
  const { name, calories, protein, carbs, fat, items, servings: servingsParam, portion } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [adding, setAdding] = useState(false);
  // Portion
  const initialServings = (() => {
    const n = parseFloat(typeof servingsParam === "string" ? servingsParam : "");
    return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_SERVINGS) : 1;
  })();
  const stepSize = Number.isInteger(initialServings) ? 1 : (initialServings * 2) % 1 === 0 ? 0.5 : 0.25;
  const minServings = stepSize;
  const [servings, setServings] = useState(initialServings);
  const [showAllIngredients, setShowAllIngredients] = useState(false);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loadingIngredients, setLoadingIngredients] = useState(false);
  const { allergies } = useAllergies();

  const parsedItems = useMemo(() => {
    if (!items || typeof items !== "string") return [];
    try {
      const parsed = JSON.parse(items);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [items]);

  // Fallback
  const displayName = parsedItems.length === 1 ? parsedItems[0].name : name;
  const heroImage = parsedItems[0]?.image_url;
  const foodId = parsedItems[0]?.id;

  // Ingredients
  useEffect(() => {
    if (!foodId) return;
    const fetchIngredients = async () => {
      setLoadingIngredients(true);
      try {
        const { data, error } = await supabase
          .from("foods")
          .select("ingredients")
          .eq("id", foodId)
          .single();
        if (!error && data?.ingredients && Array.isArray(data.ingredients)) {
          setIngredients(data.ingredients);
        }
      } catch {
        // Errors
      } finally {
        setLoadingIngredients(false);
      }
    };
    fetchIngredients();
  }, [foodId]);

  // Allergies
  const allergenHits = useMemo(
    () =>
      findAllergens(allergies, [
        ...parsedItems.map((item: { name?: string }) => item.name),
        typeof displayName === "string" ? displayName : undefined,
        ...ingredientNames(ingredients),
      ]),
    [allergies, parsedItems, displayName, ingredients]
  );

  const addToToday = () => {
    if (allergenHits.length === 0) {
      logMeal();
      return;
    }
    Alert.alert(
      "Allergy warning",
      `This meal has an ingredient that you are allergic to: ${allergenHits.join(", ")}.\n\nAdd it to your daily log anyway?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Add anyway", style: "destructive", onPress: logMeal },
      ]
    );
  };

  const logMeal = async () => {
    setAdding(true);
    try {
      const user = await getSessionUser();
      if (!user) {
        router.replace("/");
        return;
      }

      if (parsedItems.length === 0) {
        throw new Error("No food item was selected.");
      }

      for (const item of parsedItems) {
        const { error } = await supabase.from("selected_foods").insert({
          user_id: user.id,
          food_id: item.id,
          food_name: item.name,
          calories: item.calories,
          protein: item.protein || 0,
          carbs: item.carbs || 0,
          fat: item.fat || 0,
          quantity: servings,
        });
        if (error) throw error;
      }
      const label = servings > 1 ? `${servings} × ${displayName}` : `${displayName}`;
      Alert.alert("Success", `${label} added to your daily log`, [
        { text: "OK", onPress: () => goBackOr(router, "/mealplan") }
      ]);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to add meal");
    }
    setAdding(false);
  };

  // Servings
  const num = (v: unknown) => {
    const n = parseFloat(v as string);
    return Number.isFinite(n) ? n : 0;
  };
  const kcalTotal = Math.round(num(calories) * servings);
  const proteinTotal = num(protein) * servings;
  const carbsTotal = num(carbs) * servings;
  const fatTotal = num(fat) * servings;

  // Calories
  const macroKcal = { protein: proteinTotal * 4, carbs: carbsTotal * 4, fat: fatTotal * 9 };
  const macroKcalSum = macroKcal.protein + macroKcal.carbs + macroKcal.fat;
  const pct = (v: number) => (macroKcalSum > 0 ? Math.round((v / macroKcalSum) * 100) : 0);

  // Goal
  const goalCalories =
    cache.get<{ goalCalories: number | null }>("meals:snapshot")?.goalCalories ?? null;
  const goalPct = goalCalories ? Math.round((kcalTotal / goalCalories) * 100) : null;

  const visibleIngredients = showAllIngredients
    ? ingredients
    : ingredients.slice(0, INGREDIENTS_PREVIEW);
  const hiddenCount = ingredients.length - visibleIngredients.length;

  const fmt = (v: number) => v.toFixed(1);

  return (
    <View style={s.container}>
      {/* Background */}
      <View style={s.heroContainer}>
        {heroImage ? (
          <Image source={{ uri: heroImage }} style={s.heroImage} />
        ) : (
          <View style={[s.heroImage, s.placeholder]}>
            <View style={s.placeholderCircle}>
              <Ionicons name="restaurant" size={52} color={colors.accent} />
            </View>
          </View>
        )}
        {/* Overlay */}
        <View style={s.heroGradient} />
      </View>

      {/* Foreground */}
      <ScrollView
        style={s.scrollView}
        contentContainerStyle={{ paddingTop: HERO_HEIGHT - 28, paddingBottom: 130 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.card}>
          <View style={s.handle} />

          <Text style={s.title}>{displayName}</Text>

          {allergenHits.length > 0 && (
            <View style={s.allergyBanner} accessibilityRole="alert">
              <View style={s.allergyIcon}>
                <Ionicons name="warning" size={22} color="#ffffff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.allergyTitle}>Allergy warning</Text>
                <Text style={s.allergyText}>
                  This meal has an ingredient that you are allergic to:{" "}
                  <Text style={s.allergyBold}>{allergenHits.join(", ")}</Text>
                </Text>
              </View>
            </View>
          )}

          {/* Calories */}
          <View style={s.kcalRow}>
            <View style={s.kcalIcon}>
              <Ionicons name="flame" size={22} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.kcal}>
                {kcalTotal.toLocaleString()}
                <Text style={s.kcalUnit}> Calories</Text>
              </Text>
              {goalPct !== null && (
                <Text style={s.kcalHint}>
                  {goalPct}% of your {goalCalories?.toLocaleString()} kcal daily goal
                </Text>
              )}
            </View>
            {servings !== 1 && (
              <View style={s.servingTag}>
                <Text style={s.servingTagText}>
                  {typeof portion === "string" && servings === initialServings ? portion : `${servings} servings`}
                </Text>
              </View>
            )}
          </View>

          {/* Macros */}
          <View style={s.macroRow}>
            <View style={s.macroBox}>
              <View style={[s.macroDot, { backgroundColor: PROTEIN_COLOR }]} />
              <Text style={s.macroVal}>{fmt(proteinTotal)}g</Text>
              <Text style={s.macroLab}>Protein</Text>
            </View>
            <View style={s.macroBox}>
              <View style={[s.macroDot, { backgroundColor: CARBS_COLOR }]} />
              <Text style={s.macroVal}>{fmt(carbsTotal)}g</Text>
              <Text style={s.macroLab}>Carbs</Text>
            </View>
            <View style={s.macroBox}>
              <View style={[s.macroDot, { backgroundColor: FAT_COLOR }]} />
              <Text style={s.macroVal}>{fmt(fatTotal)}g</Text>
              <Text style={s.macroLab}>Fat</Text>
            </View>
          </View>

          {/* Breakdown */}
          {macroKcalSum > 0 && (
            <View style={s.splitWrap}>
              <Text style={s.splitTitle}>Where the calories come from</Text>
              <View style={s.splitBar}>
                <View style={{ flex: macroKcal.protein, backgroundColor: PROTEIN_COLOR }} />
                <View style={{ flex: macroKcal.carbs, backgroundColor: CARBS_COLOR }} />
                <View style={{ flex: macroKcal.fat, backgroundColor: FAT_COLOR }} />
              </View>
              <View style={s.splitLegend}>
                <Text style={s.splitLegendText}>
                  <Text style={{ color: PROTEIN_COLOR }}>● </Text>Protein {pct(macroKcal.protein)}%
                </Text>
                <Text style={s.splitLegendText}>
                  <Text style={{ color: CARBS_COLOR }}>● </Text>Carbs {pct(macroKcal.carbs)}%
                </Text>
                <Text style={s.splitLegendText}>
                  <Text style={{ color: FAT_COLOR }}>● </Text>Fat {pct(macroKcal.fat)}%
                </Text>
              </View>
            </View>
          )}

          {/* Ingredients */}
          {loadingIngredients ? (
            <ActivityIndicator color={colors.accent} style={{ marginBottom: 20 }} />
          ) : ingredients.length > 0 ? (
            <View style={s.ingredientsSection}>
              <View style={s.ingredientsHeader}>
                <Text style={s.ingredientsTitle}>Ingredients</Text>
                <View style={s.countPill}>
                  <Text style={s.countText}>{ingredients.length}</Text>
                </View>
              </View>
              {visibleIngredients.map((ing, index) => {
                const ingredientHits = findAllergens(allergies, [ing.name]);
                return (
                <View key={index} style={[s.ingredientCard, ingredientHits.length > 0 && s.ingredientCardWarn]}>
                  {/* Image */}
                  {ing.image_url ? (
                    <Image source={{ uri: ing.image_url }} style={s.ingredientImage} resizeMode="cover" />
                  ) : (
                    <View style={[s.ingredientImage, s.ingredientPlaceholder]}>
                      <Ionicons name="leaf" size={22} color={colors.accent} />
                    </View>
                  )}
                  {/* Details */}
                  <View style={s.ingredientInfo}>
                    <Text style={s.ingredientName}>{ing.name}</Text>
                    {ingredientHits.length > 0 && (
                      <View style={s.ingredientAllergen}>
                        <Ionicons name="warning" size={12} color="#ffffff" />
                        <Text style={s.ingredientAllergenText}>You&apos;re allergic</Text>
                      </View>
                    )}
                    <View style={s.ingredientMacroRow}>
                      {ing.calories ? (
                        <View style={s.ingredientMacroPill}>
                          <Text style={s.ingredientMacroText}>{ing.calories} kcal</Text>
                        </View>
                      ) : null}
                      {ing.protein ? (
                        <View style={s.ingredientMacroPill}>
                          <View style={[s.pillDot, { backgroundColor: PROTEIN_COLOR }]} />
                          <Text style={s.ingredientMacroText}>P {ing.protein}g</Text>
                        </View>
                      ) : null}
                      {ing.carbs ? (
                        <View style={s.ingredientMacroPill}>
                          <View style={[s.pillDot, { backgroundColor: CARBS_COLOR }]} />
                          <Text style={s.ingredientMacroText}>C {ing.carbs}g</Text>
                        </View>
                      ) : null}
                      {ing.fat ? (
                        <View style={s.ingredientMacroPill}>
                          <View style={[s.pillDot, { backgroundColor: FAT_COLOR }]} />
                          <Text style={s.ingredientMacroText}>F {ing.fat}g</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>
                );
              })}

              {ingredients.length > INGREDIENTS_PREVIEW && (
                <Pressable
                  style={({ pressed }) => [s.moreBtn, pressed && s.pressed]}
                  onPress={() => setShowAllIngredients((v) => !v)}
                  accessibilityRole="button"
                >
                  <Text style={s.moreBtnText}>
                    {showAllIngredients ? "Show fewer" : `Show ${hiddenCount} more`}
                  </Text>
                  <Ionicons
                    name={showAllIngredients ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={colors.accent}
                  />
                </Pressable>
              )}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Toolbar */}
      <View style={[s.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <View style={s.stepper}>
          <Pressable
            style={({ pressed }) => [s.stepBtn, servings <= minServings && s.stepBtnOff, pressed && s.pressed]}
            onPress={() => setServings((n) => Math.max(minServings, n - stepSize))}
            disabled={servings <= minServings || adding}
            accessibilityRole="button"
            accessibilityLabel="Fewer servings"
            hitSlop={6}
          >
            <Ionicons name="remove" size={20} color={colors.accent} />
          </Pressable>
          <Text style={s.stepValue} accessibilityLabel={`${servings} servings`}>{servings}</Text>
          <Pressable
            style={({ pressed }) => [s.stepBtn, servings >= MAX_SERVINGS && s.stepBtnOff, pressed && s.pressed]}
            onPress={() => setServings((n) => Math.min(MAX_SERVINGS, n + stepSize))}
            disabled={servings >= MAX_SERVINGS || adding}
            accessibilityRole="button"
            accessibilityLabel="More servings"
            hitSlop={6}
          >
            <Ionicons name="add" size={20} color={colors.accent} />
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [s.addBtn, adding && { opacity: 0.7 }, pressed && s.pressed]}
          onPress={addToToday}
          disabled={adding}
          accessibilityRole="button"
        >
          {adding ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text style={s.addBtnText}>Add to Daily Log · {kcalTotal.toLocaleString()} kcal</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    pressed: { opacity: 0.8 },
    heroContainer: {
      height: HERO_HEIGHT,
      width: "100%",
      position: "absolute",
      top: 0,
    },
    heroImage: {
      width: "100%",
      height: "100%",
      resizeMode: "cover",
    },
    heroGradient: {
      position: "absolute",
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: "rgba(0,0,0,0.12)",
    },
    placeholder: {
      backgroundColor: c.surfaceAlt,
      justifyContent: "center",
      alignItems: "center",
    },
    placeholderCircle: {
      width: 104,
      height: 104,
      borderRadius: 52,
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 20,
    },
    scrollView: {
      flex: 1,
    },
    backBtn: {
      position: "absolute",
      left: 20,
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: "center",
      alignItems: "center",
    },
    card: {
      backgroundColor: c.background,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      borderWidth: 1.5,
      borderBottomWidth: 0,
      borderColor: c.border,
      paddingHorizontal: 20,
      paddingTop: 14,
      minHeight: SCREEN_HEIGHT * 0.64,
    },
    handle: {
      width: 44,
      height: 5,
      backgroundColor: c.borderStrong,
      alignSelf: "center",
      marginBottom: 18,
      borderRadius: 5,
    },
    title: {
      fontSize: 28,
      fontWeight: "800",
      color: c.textPrimary,
      marginBottom: 14,
      lineHeight: 34,
    },
    kcalRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: c.surface,
      borderRadius: 22,
      borderWidth: 1.5,
      borderColor: c.border,
      paddingVertical: 14,
      paddingHorizontal: 16,
      marginBottom: 12,
    },
    kcalIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    kcal: {
      fontSize: 28,
      color: c.accent,
      fontWeight: "800",
    },
    kcalUnit: {
      fontSize: 16,
      color: c.textSecondary,
      fontWeight: "700",
    },
    kcalHint: {
      fontSize: 12.5,
      color: c.textSecondary,
      fontWeight: "600",
      marginTop: 1,
    },
    servingTag: {
      backgroundColor: c.accent,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    servingTagText: { color: c.onAccent, fontSize: 12, fontWeight: "800" },
    macroRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 14,
    },
    macroBox: {
      backgroundColor: c.surface,
      paddingVertical: 14,
      paddingHorizontal: 4,
      borderRadius: 22,
      flex: 1,
      alignItems: "center",
      borderWidth: 1.5,
      borderColor: c.border,
    },
    macroDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginBottom: 8,
    },
    macroVal: {
      fontSize: 18,
      fontWeight: "800",
      color: c.textPrimary,
    },
    macroLab: {
      fontSize: 13,
      color: c.textSecondary,
      fontWeight: "700",
      marginTop: 3,
    },

    // Split
    splitWrap: {
      backgroundColor: c.surface,
      borderRadius: 22,
      borderWidth: 1.5,
      borderColor: c.border,
      padding: 16,
      marginBottom: 24,
    },
    splitTitle: { fontSize: 14, fontWeight: "800", color: c.textPrimary, marginBottom: 10 },
    splitBar: {
      flexDirection: "row",
      height: 12,
      borderRadius: 6,
      overflow: "hidden",
      backgroundColor: c.border,
      gap: 2,
    },
    splitLegend: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 14,
      marginTop: 10,
    },
    splitLegendText: { fontSize: 12.5, fontWeight: "700", color: c.textSecondary },

    // Allergy
    allergyBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: DANGER_COLOR,
      borderRadius: 22,
      padding: 14,
      marginBottom: 14,
    },
    allergyIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: DANGER_COLOR,
      alignItems: "center",
      justifyContent: "center",
    },
    allergyTitle: { fontSize: 16, fontWeight: "800", color: DANGER_COLOR, marginBottom: 2 },
    allergyText: { fontSize: 14, fontWeight: "600", color: c.textSecondary, lineHeight: 20 },
    allergyBold: { fontWeight: "800", color: c.textPrimary },
    ingredientCardWarn: { borderColor: DANGER_COLOR, borderWidth: 2 },
    ingredientAllergen: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      alignSelf: "flex-start",
      backgroundColor: DANGER_COLOR,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      marginBottom: 8,
    },
    ingredientAllergenText: { color: "#ffffff", fontSize: 11, fontWeight: "800" },

    // Ingredients
    ingredientsSection: {
      marginBottom: 8,
    },
    ingredientsHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 12,
    },
    ingredientsTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: c.textPrimary,
    },
    countPill: {
      backgroundColor: c.surfaceAlt,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 2,
    },
    countText: { fontSize: 13, fontWeight: "800", color: c.accent },
    ingredientCard: {
      flexDirection: "row",
      backgroundColor: c.surface,
      borderRadius: 20,
      padding: 10,
      marginBottom: 10,
      alignItems: "center",
      borderWidth: 1.5,
      borderColor: c.border,
      gap: 12,
    },
    ingredientImage: {
      width: 56,
      height: 56,
      borderRadius: 14,
      backgroundColor: c.surfaceAlt,
    },
    ingredientPlaceholder: {
      justifyContent: "center",
      alignItems: "center",
    },
    ingredientInfo: {
      flex: 1,
    },
    ingredientName: {
      fontSize: 15,
      fontWeight: "700",
      color: c.textPrimary,
      marginBottom: 6,
    },
    ingredientMacroRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    ingredientMacroPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: c.surfaceAlt,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 10,
    },
    pillDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    ingredientMacroText: {
      fontSize: 12,
      fontWeight: "700",
      color: c.textSecondary,
    },
    moreBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    moreBtnText: { fontSize: 14.5, fontWeight: "800", color: c.accent },

    // Toolbar
    bottomBar: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      paddingTop: 12,
      backgroundColor: c.background,
      borderTopWidth: 1.5,
      borderTopColor: c.border,
    },
    stepper: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 16,
      paddingHorizontal: 6,
      height: 54,
    },
    stepBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    stepBtnOff: { opacity: 0.35 },
    stepValue: {
      minWidth: 24,
      textAlign: "center",
      fontSize: 18,
      fontWeight: "800",
      color: c.textPrimary,
    },
    addBtn: {
      flex: 1,
      height: 54,
      backgroundColor: c.accent,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    addBtnText: {
      color: c.onAccent,
      textAlign: "center",
      fontWeight: "800",
      fontSize: 16,
    },
  });
