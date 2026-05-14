// app/mealplan.tsx

import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";

const PH_TIMEZONE = "Asia/Manila";
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const CUBE_SIZE = (SCREEN_WIDTH - 20 * 2 - 20 * 2 - 12) / 2;
const MAX_CONTAINER_HEIGHT = SCREEN_HEIGHT * 0.48;

const getPHDateString = (date: Date | string): string => {
  const d = new Date(date);
  const year  = d.toLocaleString("en-US", { timeZone: PH_TIMEZONE, year: "numeric" });
  const month = d.toLocaleString("en-US", { timeZone: PH_TIMEZONE, month: "2-digit" });
  const day   = d.toLocaleString("en-US", { timeZone: PH_TIMEZONE, day: "2-digit" });
  return `${year}-${month}-${day}`;
};

const getTodayPHDateString = (): string => getPHDateString(new Date());

type MealType = "breakfast" | "lunch" | "dinner";

type Food = {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  meal_type: string;
  image_url: string;
};

const FoodCube = ({
  food,
  onPress,
  size,
}: {
  food: Food;
  onPress: () => void;
  size: number;
}) => (
  <Pressable
    style={[s.foodCube, { width: size, height: size }]}
    onPress={onPress}
    android_ripple={{ color: "rgba(16,185,129,0.2)" }}
  >
    {food.image_url ? (
      <Image source={{ uri: food.image_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
    ) : (
      <View style={[StyleSheet.absoluteFill, s.cubePlaceholder]}>
        <Ionicons name="restaurant" size={36} color="#10b981" />
      </View>
    )}
    <View style={[StyleSheet.absoluteFill, s.cubeOverlay]} />
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

// FIX: Render grid as plain View rows — no nested ScrollView.
// The outer ScrollView in the screen handles all scrolling.
const CubeGrid = ({
  foods,
  onPress,
}: {
  foods: Food[];
  onPress: (food: Food) => void;
}) => {
  const rows: Food[][] = [];
  for (let i = 0; i < foods.length; i += 2) {
    rows.push(foods.slice(i, i + 2));
  }
  return (
    <View style={s.accordionGrid}>
      {rows.map((row, ri) => (
        <View key={ri} style={s.cubeRow}>
          {row.map((food) => (
            <FoodCube key={food.id} food={food} onPress={() => onPress(food)} size={CUBE_SIZE} />
          ))}
          {row.length === 1 && <View style={{ width: CUBE_SIZE }} />}
        </View>
      ))}
    </View>
  );
};

export default function MealplanScreen() {
  const router = useRouter();

  const [foods, setFoods] = useState<Food[]>([]);
  const [totalCaloriesToday, setTotalCaloriesToday] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<MealType, boolean>>({
    breakfast: false, lunch: false, dinner: false,
  });
  const [searchQuery, setSearchQuery] = useState("");

  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        setLoading(true);
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) { router.replace("/"); return; }
          const uid = user.id;
          const todayStr = getTodayPHDateString();

          const { data: foodsData, error: foodsError } = await supabase
            .from("foods")
            .select("*")
            .order("name", { ascending: true });

          if (foodsError) throw foodsError;
          const fetchedFoods: Food[] = foodsData || [];
          setFoods(fetchedFoods);

          const { data: todayFoods } = await supabase
            .from("selected_foods")
            .select("food_id, quantity, created_at, calories")
            .eq("user_id", uid);

          const todayEntries = (todayFoods || []).filter(
            (entry) => getPHDateString(entry.created_at) === todayStr
          );

          let total = 0;
          todayEntries.forEach((entry) => {
            const food = fetchedFoods.find((f) => f.id === entry.food_id);
            if (food) total += food.calories * entry.quantity;
          });
          setTotalCaloriesToday(total);
        } catch (err: any) {
          Alert.alert("Error", err.message || "Failed to load data");
        } finally {
          setLoading(false);
        }
      };
      loadData();
    }, [])
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

  const mealSections: Record<MealType, Food[]> = {
    breakfast: foods.filter((f) => f.meal_type === "breakfast" || f.meal_type === "all"),
    lunch:     foods.filter((f) => f.meal_type === "lunch"     || f.meal_type === "all"),
    dinner:    foods.filter((f) => f.meal_type === "dinner"    || f.meal_type === "all"),
  };

  const filteredFoods = foods.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    // FIX: Use SafeAreaView + single outer ScrollView.
    // Removed nested ScrollViews — they cause "VirtualizedLists should never
    // be nested inside plain ScrollViews" warnings and broken touch on Android.
    <SafeAreaView style={s.safeArea} edges={["left", "right"]}>
      <ScrollView
        style={s.container}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        <View style={s.titleArea}>
          <Pressable onPress={() => router.push("/main")} style={s.backButton}>
            <Ionicons name="arrow-back" size={28} color="#10b981" />
          </Pressable>
          <Text style={s.header}>MEAL PLAN</Text>
          <Text style={s.subheader}>Today's Total: {totalCaloriesToday} kcal</Text>
        </View>

        {/* Breakfast, Lunch, Dinner */}
        {(["breakfast", "lunch", "dinner"] as MealType[]).map((type) => (
          <View key={type} style={s.section}>
            <Pressable
              style={s.accordionHeader}
              onPress={() => setExpanded((prev) => ({ ...prev, [type]: !prev[type] }))}
            >
              <View style={s.accordionLeft}>
                <Ionicons
                  name={type === "breakfast" ? "sunny" : type === "lunch" ? "partly-sunny" : "moon"}
                  size={20}
                  color="#10b981"
                  style={{ marginRight: 10 }}
                />
                <Text style={s.accordionTitle}>{type.toUpperCase()}</Text>
              </View>
              <Ionicons
                name={expanded[type] ? "chevron-up" : "chevron-down"}
                size={24}
                color="#10b981"
              />
            </Pressable>

            {expanded[type] && (
              <CubeGrid foods={mealSections[type]} onPress={goToFoodDetail} />
            )}
          </View>
        ))}

        {/* Available Library */}
        <View style={s.section}>
          <View style={s.accordionHeader}>
            <View style={s.accordionLeft}>
              <Text style={s.accordionTitle}>AVAILABLE LIBRARY</Text>
            </View>
          </View>

          <View style={s.librarySearchContainer}>
            <View style={s.searchBar}>
              <Ionicons name="search" size={18} color="#10b981" style={{ marginRight: 8 }} />
              <TextInput
                style={s.searchInput}
                placeholder="Search food..."
                placeholderTextColor="#94a3b8"
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery("")}>
                  <Ionicons name="close-circle" size={18} color="#94a3b8" />
                </Pressable>
              )}
            </View>
          </View>

          <CubeGrid foods={filteredFoods} onPress={goToFoodDetail} />
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fff9" },
  container: { flex: 1, backgroundColor: "#f8fff9" },
  listContent: { paddingHorizontal: 20, paddingBottom: 20 },

  titleArea: {
    paddingTop: Platform.OS === "android" ? 60 : 20,
    paddingBottom: 20, alignItems: "center",
  },
  backButton: {
    position: "absolute",
    top: Platform.OS === "android" ? 60 : 20,
    left: 0,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#fff", justifyContent: "center",
    alignItems: "center", elevation: 8, zIndex: 10,
  },
  header: { fontSize: 30, fontWeight: "800", color: "#065f46" },
  subheader: { fontSize: 16, fontWeight: "600", color: "#10b981", marginTop: 4 },

  section: {
    marginBottom: 16, backgroundColor: "#fff",
    borderRadius: 20, overflow: "hidden", elevation: 4,
  },
  accordionHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", padding: 18, backgroundColor: "#f0fdf4",
  },
  accordionLeft: { flexDirection: "row", alignItems: "center" },
  accordionTitle: { fontSize: 17, fontWeight: "800", color: "#065f46" },

  librarySearchContainer: {
    paddingHorizontal: 18, paddingVertical: 12, backgroundColor: "#fff",
  },
  searchBar: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#f0fdf4", borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: "#d1fae5",
  },
  searchInput: { flex: 1, fontSize: 15, color: "#065f46", fontWeight: "500" },

  accordionGrid: { padding: 14, gap: 12 },
  cubeRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  foodCube: {
    borderRadius: 18, overflow: "hidden", backgroundColor: "#065f46",
    elevation: 5, shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 6,
  },
  cubePlaceholder: { backgroundColor: "#d1fae5", justifyContent: "center", alignItems: "center" },
  cubeOverlay: { backgroundColor: "rgba(6,95,70,0.42)" },
  cubeContent: { flex: 1, justifyContent: "flex-end", padding: 12 },
  cubeName: {
    fontSize: 13, fontWeight: "800", color: "#fff", marginBottom: 6,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  cubeCaloriePill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(16,185,129,0.88)",
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  cubeCalorieText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  cubeChevron: { position: "absolute", top: 10, right: 10 },

  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
});
