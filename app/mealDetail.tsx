import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

type Ingredient = {
  name: string;
  image_url: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
};

export default function MealDetailScreen() {
  const { name, calories, protein, carbs, fat, items } = useLocalSearchParams();
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loadingIngredients, setLoadingIngredients] = useState(false);

  const parsedItems = items ? JSON.parse(items as string) : [];

  // Use the food name, or fallback to the passed name
  const displayName = parsedItems.length === 1 ? parsedItems[0].name : name;
  const heroImage = parsedItems[0]?.image_url;
  const foodId = parsedItems[0]?.id;

  // Fetch the food's ingredients from Supabase
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
      } catch (_) {
        // silently ignore — ingredients are optional
      } finally {
        setLoadingIngredients(false);
      }
    };
    fetchIngredients();
  }, [foodId]);

  const addToToday = async () => {
    setAdding(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      for (const item of parsedItems) {
        await supabase.from("selected_foods").insert({
          user_id: user.id,
          food_id: item.id,
          food_name: item.name,
          calories: item.calories,
          protein: item.protein || 0,
          carbs: item.carbs || 0,
          fat: item.fat || 0,
          quantity: 1,
        });
      }
      Alert.alert("Success", `${displayName} added to your daily log`, [
        { text: "OK", onPress: () => router.back() }
      ]);
    } catch (e) {
      Alert.alert("Error", "Failed to add meal");
    }
    setAdding(false);
  };

  return (
    <View style={s.container}>
      {/* BACKGROUND IMAGE LAYER */}
      <View style={s.heroContainer}>
        {heroImage ? (
          <Image source={{ uri: heroImage }} style={s.heroImage} />
        ) : (
          <View style={[s.heroImage, s.placeholder]}>
            <Ionicons name="restaurant" size={80} color="white" />
          </View>
        )}
        {/* gradient overlay for readability */}
        <View style={s.heroGradient} />
      </View>

      {/* FOREGROUND CONTENT LAYER */}
      <ScrollView
        style={s.scrollView}
        contentContainerStyle={{ paddingTop: SCREEN_HEIGHT * 0.4 }}
        showsVerticalScrollIndicator={false}
      >
        {/* BACK BUTTON */}
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#10b981" />
        </Pressable>

        <View style={s.card}>
          <View style={s.handle} />

          <Text style={s.title}>{displayName}</Text>
          <Text style={s.kcal}>{calories} Calories</Text>

          {/* Macros */}
          <View style={s.macroRow}>
            <View style={s.macroBox}>
              <Text style={s.macroVal}>{parseFloat(protein as string).toFixed(1)}g</Text>
              <Text style={s.macroLab}>Protein</Text>
            </View>
            <View style={s.macroBox}>
              <Text style={s.macroVal}>{parseFloat(fat as string).toFixed(1)}g</Text>
              <Text style={s.macroLab}>Fat</Text>
            </View>
            <View style={s.macroBox}>
              <Text style={s.macroVal}>{parseFloat(carbs as string).toFixed(1)}g</Text>
              <Text style={s.macroLab}>Carbs</Text>
            </View>
          </View>

          {/* ── Ingredients Section ── */}
          {loadingIngredients ? (
            <ActivityIndicator color="#10b981" style={{ marginBottom: 20 }} />
          ) : ingredients.length > 0 ? (
            <View style={s.ingredientsSection}>
              <Text style={s.ingredientsTitle}>Ingredients</Text>
              {ingredients.map((ing, index) => (
                <View key={index} style={s.ingredientCard}>
                  {/* Ingredient image */}
                  {ing.image_url ? (
                    <Image source={{ uri: ing.image_url }} style={s.ingredientImage} resizeMode="cover" />
                  ) : (
                    <View style={[s.ingredientImage, s.ingredientPlaceholder]}>
                      <Ionicons name="leaf" size={28} color="#10b981" />
                    </View>
                  )}
                  {/* Ingredient info */}
                  <View style={s.ingredientInfo}>
                    <Text style={s.ingredientName}>{ing.name}</Text>
                    <View style={s.ingredientMacroRow}>
                      {ing.calories ? (
                        <View style={s.ingredientMacroPill}>
                          <Text style={s.ingredientMacroText}>{ing.calories} kcal</Text>
                        </View>
                      ) : null}
                      {ing.protein ? (
                        <View style={[s.ingredientMacroPill, { backgroundColor: "#fef2f2" }]}>
                          <Text style={[s.ingredientMacroText, { color: "#dc2626" }]}>P {ing.protein}g</Text>
                        </View>
                      ) : null}
                      {ing.carbs ? (
                        <View style={[s.ingredientMacroPill, { backgroundColor: "#f0fdf4" }]}>
                          <Text style={[s.ingredientMacroText, { color: "#16a34a" }]}>C {ing.carbs}g</Text>
                        </View>
                      ) : null}
                      {ing.fat ? (
                        <View style={[s.ingredientMacroPill, { backgroundColor: "#fffbeb" }]}>
                          <Text style={[s.ingredientMacroText, { color: "#d97706" }]}>F {ing.fat}g</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          <Pressable
            style={[s.addBtn, adding && { opacity: 0.7 }]}
            onPress={addToToday}
            disabled={adding}
          >
            {adding ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.addBtnText}>Add to Daily Log</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fff9",
  },
  heroContainer: {
    height: SCREEN_HEIGHT * 0.45,
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
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: "rgba(248,255,249,0.3)",
  },
  placeholder: {
    backgroundColor: "#065f46",
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  backBtn: {
    position: "absolute",
    top: 50,
    left: 20,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 99,
  },
  card: {
    backgroundColor: "#f8fff9",
    borderTopLeftRadius: 35,
    borderTopRightRadius: 35,
    paddingHorizontal: 30,
    paddingTop: 20,
    paddingBottom: 60,
    minHeight: SCREEN_HEIGHT * 0.6,
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: "#cbd5e1",
    alignSelf: "center",
    marginBottom: 25,
    borderRadius: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#065f46",
    marginBottom: 5,
  },
  kcal: {
    fontSize: 18,
    color: "#10b981",
    marginBottom: 30,
    fontWeight: "600",
  },
  macroRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 36,
  },
  macroBox: {
    backgroundColor: "#fff",
    paddingVertical: 20,
    borderRadius: 20,
    flex: 1,
    marginHorizontal: 5,
    alignItems: "center",
    elevation: 3,
    borderWidth: 1,
    borderColor: "#ecfdf5",
  },
  macroVal: {
    fontSize: 18,
    fontWeight: "800",
    color: "#065f46",
  },
  macroLab: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
    marginTop: 4,
  },

  // ── Ingredients ──
  ingredientsSection: {
    marginBottom: 30,
  },
  ingredientsTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#065f46",
    marginBottom: 16,
  },
  ingredientCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 12,
    marginBottom: 12,
    alignItems: "center",
    elevation: 3,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: "#ecfdf5",
    gap: 14,
  },
  ingredientImage: {
    width: 70,
    height: 70,
    borderRadius: 14,
    backgroundColor: "#ecfdf5",
  },
  ingredientPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  ingredientInfo: {
    flex: 1,
  },
  ingredientName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#065f46",
    marginBottom: 8,
  },
  ingredientMacroRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  ingredientMacroPill: {
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  ingredientMacroText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
  },

  // ── Add Button ──
  addBtn: {
    backgroundColor: "#10b981",
    padding: 18,
    borderRadius: 22,
    marginTop: 10,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  addBtnText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "800",
    fontSize: 18,
  },
});