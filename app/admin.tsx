// Admin

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInputProps,
  View,
} from "react-native";
import { Text, TextInput } from "../components/ui/AppText";
import { markPageReady } from "../lib/auth/startup";
import KeyboardSafeView from "../components/layout/KeyboardSafeView";
import { SafeAreaView } from "react-native-safe-area-context";
import { getSessionUser } from "../lib/auth/session";
import { supabase } from "../lib/supabase";
import { Colors, useTheme } from "../providers/ThemeProvider";

type User = {
  id: string;
  username: string;
  email: string;
  created_at: string;
  admin: boolean;
};

type Feedback = {
  id: string;
  user_id: string;
  rating: number;
  message: string;
  created_at: string;
};

type Ingredient = {
  name: string;
  image_url: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
};

type Food = {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  meal_type: string;
  image_url: string;
  serving_g?: number | null;
  price_php?: number | null;
  ingredients?: Ingredient[];
};

type Tab = "users" | "feedback" | "foods" | "ai";

// Usage
type AiSummaryRow = {
  day: string;
  feature: string;
  calls: number;
  prompt_tokens: number;
  output_tokens: number;
  total_tokens: number;
};
type AiQuotaStatus = { window_start: string; next_reset: string; calls: number; tokens: number };
type AiQuotaLimits = { daily_requests: number | null; daily_tokens: number | null };
type AiUserRow = { user_id: string | null; username: string | null; calls: number; total_tokens: number };
type AiRecentRow = { id: number; user_id: string | null; feature: string; total_tokens: number; created_at: string };
type IconName = keyof typeof Ionicons.glyphMap;

const EMPTY_INGREDIENT: Ingredient = {
  name: "",
  image_url: "",
  calories: "",
  protein: "",
  carbs: "",
  fat: "",
};

const EMPTY_FOOD = {
  name: "",
  calories: "",
  protein: "",
  carbs: "",
  fat: "",
  meal_type: "all",
  image_url: "",
  serving_g: "",
  price_php: "",
};

const EMPTY_USER_EDIT = {
  username: "",
  email: "",
  password: "",
};

// Colors
const PROTEIN_COLOR = "#ef4444";
const CARBS_COLOR = "#3b82f6";
const FAT_COLOR = "#f59e0b";
const DANGER_COLOR = "#ef4444";
const GOLD_COLOR = "#f59e0b";

// Features
const AI_FEATURES: Record<string, { label: string; color: string; icon: IconName }> = {
  weep_chat: { label: "Weep chat", color: "#3b82f6", icon: "chatbubble-ellipses" },
  food_scan: { label: "Food scanner", color: "#f59e0b", icon: "camera" },
  food_autofill: { label: "Admin auto-fill", color: "#10b981", icon: "sparkles" },
};
const featureMeta = (key: string) =>
  AI_FEATURES[key] ?? { label: key, color: "#94a3b8", icon: "hardware-chip-outline" as IconName };

const fmtTokens = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 10_000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString();

// Quota
const AI_STUDIO_LIMITS_URL = "https://aistudio.google.com/rate-limit";

const CHART_HEIGHT = 110;
const CHART_DAYS = 14;

const GRAM_OPTIONS = [25, 50, 75, 100, 125, 150, 175, 200];
const MEAL_TYPES = ["all", "breakfast", "lunch", "dinner", "snack"];
const mealTypeLabel: Record<string, string> = {
  all: "All Meals",
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

type Styles = ReturnType<typeof makeStyles>;

// Input
function Field({
  label,
  s,
  colors,
  style,
  ...inputProps
}: TextInputProps & { label: string; s: Styles; colors: Colors }) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={[s.input, style]}
        placeholderTextColor={colors.textMuted}
        {...inputProps}
      />
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
  s,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  s: Styles;
}) {
  return (
    <Pressable
      style={({ pressed }) => [s.chip, active && s.chipActive, pressed && s.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

// Food row
const FoodCard = memo(function FoodCard({
  food,
  s,
  accent,
  onEdit,
  onDelete,
}: {
  food: Food;
  s: Styles;
  accent: string;
  onEdit: (food: Food) => void;
  onDelete: (food: Food) => void;
}) {
  return (
    <View style={s.card}>
      <View style={s.foodCardTop}>
        {food.image_url ? (
          <Image source={{ uri: food.image_url }} style={s.foodThumb} resizeMethod="resize" fadeDuration={0} />
        ) : (
          <View style={[s.foodThumb, s.foodThumbPlaceholder]}>
            <Ionicons name="restaurant" size={24} color={accent} />
          </View>
        )}
        <View style={s.foodInfo}>
          <Text style={s.foodName} numberOfLines={2}>{food.name}</Text>
          <View style={s.foodMetaRow}>
            <View style={s.mealTypeBadge}>
              <Text style={s.mealTypeBadgeText}>{mealTypeLabel[food.meal_type] || food.meal_type}</Text>
            </View>
            {food.ingredients && food.ingredients.length > 0 && (
              <Text style={s.ingredientCount}>
                {food.ingredients.length} ingredient{food.ingredients.length > 1 ? "s" : ""}
              </Text>
            )}
          </View>
        </View>
        <Text style={s.foodCalories}>{food.calories}<Text style={s.foodCaloriesUnit}> kcal</Text></Text>
      </View>
      <View style={s.foodMacros}>
        <View style={s.macroPill}><View style={[s.macroDot, { backgroundColor: PROTEIN_COLOR }]} /><Text style={s.macroText}>P {food.protein}g</Text></View>
        <View style={s.macroPill}><View style={[s.macroDot, { backgroundColor: CARBS_COLOR }]} /><Text style={s.macroText}>C {food.carbs}g</Text></View>
        <View style={s.macroPill}><View style={[s.macroDot, { backgroundColor: FAT_COLOR }]} /><Text style={s.macroText}>F {food.fat}g</Text></View>
      </View>
      <View style={s.cardActions}>
        <Pressable style={({ pressed }) => [s.actionBtn, s.editBtn, pressed && s.pressed]} onPress={() => onEdit(food)}>
          <Ionicons name="create-outline" size={16} color={accent} />
          <Text style={s.editBtnText}>Edit</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [s.actionBtn, s.deleteBtn, pressed && s.pressed]} onPress={() => onDelete(food)}>
          <Ionicons name="trash-outline" size={16} color={DANGER_COLOR} />
          <Text style={s.deleteBtnText}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
});

const foodKey = (food: Food) => food.id;

export default function AdminScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [activeTab, setActiveTab] = useState<Tab>("users");
  const [users, setUsers] = useState<User[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [foods, setFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Auth
  const [adminVerified, setAdminVerified] = useState(false);
  const [slowLoad, setSlowLoad] = useState(false);
  const [aiLoaded, setAiLoaded] = useState(false);

  const [aiSummary, setAiSummary] = useState<AiSummaryRow[]>([]);
  const [aiByUser, setAiByUser] = useState<AiUserRow[]>([]);
  const [aiRecent, setAiRecent] = useState<AiRecentRow[]>([]);
  const [aiSetup, setAiSetup] = useState<"ready" | "missing">("ready");
  const [aiQuota, setAiQuota] = useState<AiQuotaStatus | null>(null);
  const [quotaLimits, setQuotaLimits] = useState<AiQuotaLimits>({ daily_requests: null, daily_tokens: null });
  const [quotaModal, setQuotaModal] = useState(false);
  const [quotaForm, setQuotaForm] = useState({ requests: "", tokens: "" });
  const [savingQuota, setSavingQuota] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userFilter, setUserFilter] = useState<"all" | "admins" | "members">("all");
  const [feedbackFilter, setFeedbackFilter] = useState<"all" | "high" | "mid" | "low">("all");
  const [foodSearchQuery, setFoodSearchQuery] = useState("");
  const [foodMealFilter, setFoodMealFilter] = useState("all");

  const [foodModal, setFoodModal] = useState(false);
  const [editingFood, setEditingFood] = useState<Food | null>(null);
  const [foodForm, setFoodForm] = useState(EMPTY_FOOD);
  const [savingFood, setSavingFood] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);
  const [selectedGrams, setSelectedGrams] = useState(100);
  const [baseNutrition, setBaseNutrition] = useState<{ calories: number; protein: number; carbs: number; fat: number } | null>(null);

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [ingredientModal, setIngredientModal] = useState(false);
  const [editingIngredientIndex, setEditingIngredientIndex] = useState<number | null>(null);
  const [ingredientForm, setIngredientForm] = useState<Ingredient>(EMPTY_INGREDIENT);

  const [userEditModal, setUserEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userEditForm, setUserEditForm] = useState(EMPTY_USER_EDIT);
  const [savingUser, setSavingUser] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Access
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const user = await getSessionUser();
        if (!user) {
          router.replace("/");
          return;
        }
        const { data } = await supabase.from("weighApp").select("admin").eq("id", user.id).maybeSingle();
        if (!active) return;
        if (data?.admin !== true) {
          router.replace("/main");
          return;
        }
        setAdminVerified(true);
      } catch {
        // Loading
      }
    })();
    return () => {
      active = false;
    };
  }, [router]);

  // Countdown
  useEffect(() => {
    let tick = 0;
    const timer = setInterval(() => {
      setNow(Date.now());
      tick += 1;
      if (activeTab !== "ai" || !aiLoaded) return;
      const cycleEnded = aiQuota ? Date.now() >= Date.parse(aiQuota.next_reset) + 2000 : false;
      if (cycleEnded) fetchAiUsage();
      else if (tick % 2 === 0) fetchAiQuota();
    }, 30000);
    return () => clearInterval(timer);
  }, [activeTab, aiLoaded, aiQuota]);

  // Reset
  useEffect(() => {
    if (!aiQuota) return;
    const wait = Date.parse(aiQuota.next_reset) - Date.now();
    const timer = setTimeout(() => {
      setNow(Date.now());
      fetchAiUsage();
    }, Math.max(wait, 0) + 2000);
    return () => clearTimeout(timer);
  }, [aiQuota?.next_reset]);

  // Timeout
  useEffect(() => {
    const timer = setTimeout(() => setSlowLoad(true), 10000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  // Fetch
  const fetchData = async () => {
    const usersLoad = fetchUsers().finally(() => setLoading(false));
    await Promise.all([usersLoad, fetchFeedback(), fetchFoods()]);
  };

  // Splash
  useEffect(() => {
    if (!loading && adminVerified) markPageReady();
  }, [loading, adminVerified]);

  useEffect(() => {
    if (activeTab === "ai" && !aiLoaded) {
      setAiLoaded(true);
      fetchAiUsage();
    }
  }, [activeTab, aiLoaded]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchUsers(),
      fetchFeedback(),
      fetchFoods(),
      ...(aiLoaded ? [fetchAiUsage()] : []),
    ]);
    setRefreshing(false);
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from("weighApp")
      .select("id, username, email, created_at, admin")
      .order("created_at", { ascending: false });
    if (error) { Alert.alert("Error", "Failed to fetch users"); return; }
    setUsers(data || []);
  };

  const fetchFeedback = async () => {
    const { data, error } = await supabase
      .from("feedback")
      .select("id, user_id, rating, message, created_at")
      .order("created_at", { ascending: false });
    if (error) { Alert.alert("Error", "Failed to fetch feedback"); return; }
    setFeedback(data || []);
  };

  const fetchFoods = async () => {
    // Catalog
    let result = await supabase
      .from("foods")
      .select("*")
      .is("user_id", null)
      .order("created_at", { ascending: false });
    if (result.error) {
      // Fallback
      result = await supabase.from("foods").select("*").order("created_at", { ascending: false });
    }
    if (result.error) { Alert.alert("Error", "Failed to fetch foods"); return; }
    setFoods(result.data || []);
  };

  // Telemetry
  const fetchAiUsage = async () => {
    const [summaryRes, usersRes, recentRes, quotaRes, limitsRes] = await Promise.all([
      supabase.rpc("ai_usage_summary", { p_days: 30 }),
      supabase.rpc("ai_usage_by_user", { p_days: 30, p_limit: 8 }),
      supabase
        .from("ai_usage")
        .select("id, user_id, feature, total_tokens, created_at")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase.rpc("ai_quota_status"),
      supabase.from("app_settings").select("value").eq("key", "ai_quota").maybeSingle(),
    ]);
    if (summaryRes.error) {
      setAiSetup("missing");
      return;
    }
    setAiSetup("ready");
    setAiSummary((summaryRes.data || []) as AiSummaryRow[]);
    setAiByUser((usersRes.data || []) as AiUserRow[]);
    setAiRecent((recentRes.data || []) as AiRecentRow[]);

    // Limits
    const quotaRow = Array.isArray(quotaRes.data) ? quotaRes.data[0] : quotaRes.data;
    setAiQuota(quotaRow ? (quotaRow as AiQuotaStatus) : null);
    const saved = (limitsRes.data as { value?: Partial<AiQuotaLimits> } | null)?.value;
    setQuotaLimits({
      daily_requests: Number(saved?.daily_requests) > 0 ? Number(saved?.daily_requests) : null,
      daily_tokens: Number(saved?.daily_tokens) > 0 ? Number(saved?.daily_tokens) : null,
    });
  };

  // Polling
  const fetchAiQuota = async () => {
    const { data } = await supabase.rpc("ai_quota_status");
    const row = Array.isArray(data) ? data[0] : data;
    if (row) setAiQuota(row as AiQuotaStatus);
  };

  const openQuotaModal = () => {
    setQuotaForm({
      requests: quotaLimits.daily_requests ? String(quotaLimits.daily_requests) : "",
      tokens: quotaLimits.daily_tokens ? String(quotaLimits.daily_tokens) : "",
    });
    setQuotaModal(true);
  };

  const handleSaveQuota = async () => {
    // Parsing
    const parse = (text: string): number | null | "bad" => {
      const cleaned = text.replace(/[,\s]/g, "");
      if (!cleaned) return null;
      const n = Number(cleaned);
      return Number.isInteger(n) && n > 0 ? n : "bad";
    };
    const requests = parse(quotaForm.requests);
    const tokens = parse(quotaForm.tokens);
    if (requests === "bad" || tokens === "bad") {
      Alert.alert("Oops", "Please enter whole numbers greater than 0, or leave a field empty.");
      return;
    }
    setSavingQuota(true);
    try {
      const value = { daily_requests: requests, daily_tokens: tokens };
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: "ai_quota", value, updated_at: new Date().toISOString() });
      if (error) throw error;
      setQuotaLimits(value);
      setQuotaModal(false);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save the limits.");
    } finally {
      setSavingQuota(false);
    }
  };

  const filteredFoods = useMemo(() => {
    const q = foodSearchQuery.toLowerCase().trim();
    return foods.filter((food) => {
      const matchesName = (food.name || "").toLowerCase().includes(q);
      const matchesMeal = foodMealFilter === "all" || food.meal_type === foodMealFilter;
      return matchesName && matchesMeal;
    });
  }, [foods, foodSearchQuery, foodMealFilter]);

  const filteredUsers = users.filter((user) => {
    const q = userSearchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      (user.username || "").toLowerCase().includes(q) ||
      (user.email || "").toLowerCase().includes(q);
    const matchesFilter =
      userFilter === "all" || (userFilter === "admins" ? user.admin : !user.admin);
    return matchesSearch && matchesFilter;
  });

  const filteredFeedback = feedback.filter((fb) => {
    if (feedbackFilter === "high") return fb.rating >= 4;
    if (feedbackFilter === "mid") return fb.rating === 3;
    if (feedbackFilter === "low") return fb.rating <= 2;
    return true;
  });

  // Autofill
  const applyGrams = (base: { calories: number; protein: number; carbs: number; fat: number }, grams: number) => {
    const r = grams / 100;
    setFoodForm((prev) => ({
      ...prev,
      calories: String(Math.round(base.calories * r)),
      protein:  String(Math.round(base.protein * r * 10) / 10),
      carbs:    String(Math.round(base.carbs * r * 10) / 10),
      fat:      String(Math.round(base.fat * r * 10) / 10),
    }));
  };

  const autoFillNutrition = async () => {
    if (!foodForm.name.trim()) {
      Alert.alert("Oops", "Please enter a food name before auto-filling.");
      return;
    }

    setAutoFilling(true);
    try {
      // Nutrition
      const { data, error } = await supabase.functions.invoke("generate-food-info", {
        body: { name: foodForm.name.trim() },
      });
      if (error) {
        // Errors
        let message = error.message;
        try {
          const body = await (error as any).context?.json?.();
          if (body?.error) message = body.error;
        } catch {}
        throw new Error(message);
      }
      if (data?.error) throw new Error(data.error);

      const result = data?.result;
      if (!result) throw new Error("No result was returned.");

      if (!result.isFood) {
        Alert.alert(
          "Not a Food",
          result.reason || `"${foodForm.name}" doesn't look like a food or drink. Try a different name.`
        );
        return;
      }

      const base = {
        calories: Math.round(Number(result.caloriesPer100g) || 0),
        protein:  Math.round((Number(result.proteinPer100g) || 0) * 10) / 10,
        carbs:    Math.round((Number(result.carbsPer100g) || 0) * 10) / 10,
        fat:      Math.round((Number(result.fatPer100g) || 0) * 10) / 10,
      };

      setBaseNutrition(base);
      setSelectedGrams(100);
      applyGrams(base, 100);

      // Normalize
      if (typeof result.name === "string" && result.name.trim()) {
        setFoodForm((prev) => ({ ...prev, name: result.name.trim() }));
      }

      const aiIngredients: Ingredient[] = (Array.isArray(result.ingredients) ? result.ingredients : [])
        .filter((n: unknown): n is string => typeof n === "string" && n.trim().length > 0)
        .slice(0, 12)
        .map((n: string) => ({
          name: n.trim().charAt(0).toUpperCase() + n.trim().slice(1),
          image_url: "",
          calories: "",
          protein: "",
          carbs: "",
          fat: "",
        }));

      setIngredients(aiIngredients);
      Alert.alert(
        "✨ AI auto-fill done",
        `Filled nutrition (per 100 g) and ${aiIngredients.length} ingredients for "${result.name || foodForm.name}".\n\nConfidence: ${result.confidence || "medium"}${
          result.reason ? `\n${result.reason}` : ""
        }\n\nAI can make mistakes. Please review the values before saving.`
      );
    } catch (e: any) {
      Alert.alert("Auto-fill failed", e.message || "Could not generate the nutrition info. Please try again.");
    } finally {
      setAutoFilling(false);
    }
  };
  // Ingredients

  const openAddIngredient = () => {
    setEditingIngredientIndex(null);
    setIngredientForm({ ...EMPTY_INGREDIENT });
    setIngredientModal(true);
  };

  const openEditIngredient = (index: number) => {
    setEditingIngredientIndex(index);
    setIngredientForm({ ...ingredients[index] });
    setIngredientModal(true);
  };

  const saveIngredient = () => {
    if (!ingredientForm.name.trim()) {
      Alert.alert("Oops", "Ingredient name is required.");
      return;
    }
    if (editingIngredientIndex !== null) {
      setIngredients((prev) => {
        const updated = [...prev];
        updated[editingIngredientIndex] = ingredientForm;
        return updated;
      });
    } else {
      setIngredients((prev) => [...prev, ingredientForm]);
    }
    setIngredientModal(false);
  };

  const removeIngredient = (index: number) => {
    Alert.alert("Remove Ingredient", "Remove this ingredient?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => setIngredients((prev) => prev.filter((_, i) => i !== index)) },
    ]);
  };

  const handleToggleAdmin = (user: User) => {
    const action = user.admin ? "remove admin from" : "make admin";
    Alert.alert("Toggle Admin", `Are you sure you want to ${action} ${user.username}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          const { error } = await supabase.from("weighApp").update({ admin: !user.admin }).eq("id", user.id);
          if (error) { Alert.alert("Error", "Failed to update admin status"); return; }
          setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, admin: !u.admin } : u));
        },
      },
    ]);
  };

  const handleDeleteUser = (user: User) => {
    Alert.alert("Delete User", `Are you sure you want to delete ${user.username}? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { data: { session } } = await supabase.auth.getSession();
          const { error } = await supabase.functions.invoke("delete-user", {
            body: { user_id: user.id },
            headers: { Authorization: `Bearer ${session?.access_token}` },
          });
          if (error) {
            let detail = error.message;
            try {
              const body = await (error as any).context?.json?.();
              if (body?.error) detail = body.error;
            } catch {}
            Alert.alert("Error", "Failed to delete user: " + detail);
            return;
          }
          setUsers((prev) => prev.filter((u) => u.id !== user.id));
        },
      },
    ]);
  };

  const handleDeleteFeedback = (id: string) => {
    Alert.alert("Delete Feedback", "Are you sure you want to delete this feedback?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("feedback").delete().eq("id", id);
          if (error) { Alert.alert("Error", "Failed to delete feedback"); return; }
          setFeedback((prev) => prev.filter((f) => f.id !== id));
        },
      },
    ]);
  };

  const openAddFood = () => {
    setEditingFood(null);
    setFoodForm(EMPTY_FOOD);
    setIngredients([]);
    setBaseNutrition(null);
    setSelectedGrams(100);
    setFoodModal(true);
  };

  const openEditFood = useCallback((food: Food) => {
    setEditingFood(food);
    setFoodForm({
      name: food.name,
      calories: food.calories.toString(),
      protein: food.protein.toString(),
      carbs: food.carbs.toString(),
      fat: food.fat.toString(),
      meal_type: food.meal_type,
      image_url: food.image_url || "",
      serving_g: food.serving_g ? String(food.serving_g) : "",
      price_php: food.price_php ? String(food.price_php) : "",
    });
    setIngredients(food.ingredients ? food.ingredients : []);
    setBaseNutrition(null);
    setSelectedGrams(100);
    setFoodModal(true);
  }, []);

  const closeFoodModal = () => {
    setFoodModal(false);
    setEditingFood(null);
    setIngredients([]);
  };

  const handleSaveFood = async () => {
    if (!foodForm.name || !foodForm.calories) {
      Alert.alert("Oops", "Name and calories are required");
      return;
    }
    setSavingFood(true);
    try {
      const payload = {
        name: foodForm.name.trim(),
        calories: parseFloat(foodForm.calories) || 0,
        protein: parseFloat(foodForm.protein) || 0,
        carbs: parseFloat(foodForm.carbs) || 0,
        fat: parseFloat(foodForm.fat) || 0,
        meal_type: foodForm.meal_type,
        image_url: foodForm.image_url.trim(),
        ingredients: ingredients.length > 0 ? ingredients : undefined,
        serving_g: parseFloat(foodForm.serving_g) > 0 ? parseFloat(foodForm.serving_g) : 100,
        price_php: parseFloat(foodForm.price_php) > 0 ? parseFloat(foodForm.price_php) : null,
      };
      if (editingFood) {
        const { error } = await supabase.from("foods").update(payload).eq("id", editingFood.id);
        if (error) throw error;
        setFoods((prev) => prev.map((f) => f.id === editingFood.id ? { ...f, ...payload } : f));
      } else {
        const { data, error } = await supabase.from("foods").insert(payload).select().single();
        if (error) throw error;
        setFoods((prev) => [data, ...prev]);
      }
      setFoodModal(false);
      setFoodForm(EMPTY_FOOD);
      setIngredients([]);
      setEditingFood(null);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save food");
    } finally {
      setSavingFood(false);
    }
  };

  const handleDeleteFood = useCallback((food: Food) => {
    Alert.alert("Delete Food", `Delete "${food.name}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const { error } = await supabase.from("foods").delete().eq("id", food.id);
            if (error) throw error;
            setFoods((prev) => prev.filter((f) => f.id !== food.id));
            Alert.alert("Deleted", `"${food.name}" has been removed.`);
          } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to delete food.");
          }
        },
      },
    ]);
  }, []);

  const renderFood = useCallback(
    ({ item }: { item: Food }) => (
      <FoodCard food={item} s={s} accent={colors.accent} onEdit={openEditFood} onDelete={handleDeleteFood} />
    ),
    [s, colors.accent, openEditFood, handleDeleteFood]
  );

  const openEditUser = (user: User) => {
    setEditingUser(user);
    setUserEditForm({ username: user.username, email: user.email, password: "" });
    setShowPassword(false);
    setUserEditModal(true);
  };

  const handleSaveUser = async () => {
    if (!userEditForm.username.trim() || !userEditForm.email.trim()) {
      Alert.alert("Oops", "Username and email are required.");
      return;
    }
    setSavingUser(true);
    try {
      const { error: profileError } = await supabase
        .from("weighApp")
        .update({ username: userEditForm.username.trim(), email: userEditForm.email.trim() })
        .eq("id", editingUser!.id);
      if (profileError) throw profileError;

      const edgeBody: Record<string, string> = { user_id: editingUser!.id, email: userEditForm.email.trim() };
      if (userEditForm.password.trim().length >= 6) edgeBody.password = userEditForm.password.trim();

      // Authorization
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke("admin-update-user", {
        body: edgeBody,
      });
      if (edgeError) {
        let detail = edgeError.message;
        try {
          const body = await (edgeError as any).context?.json?.();
          if (body?.error) detail = body.error;
        } catch {}
        throw new Error("Auth update failed: " + detail);
      }
      if (edgeData?.error) throw new Error("Auth update failed: " + edgeData.error);

      setUsers((prev) => prev.map((u) => u.id === editingUser!.id ? { ...u, username: userEditForm.username.trim(), email: userEditForm.email.trim() } : u));
      setUserEditModal(false);
      setEditingUser(null);
      Alert.alert("Success", "User updated successfully.");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update user.");
    } finally {
      setSavingUser(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: async () => { await supabase.auth.signOut(); router.replace("/"); } },
    ]);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
  };

  // Feedback
  const avgRating = feedback.length
    ? feedback.reduce((sum, f) => sum + (f.rating || 0), 0) / feedback.length
    : 0;
  const ratingCounts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: feedback.filter((f) => f.rating === star).length,
  }));
  const maxRatingCount = Math.max(1, ...ratingCounts.map((r) => r.count));

  const usernameFor = (id: string) => users.find((u) => u.id === id)?.username || "Unknown user";

  const Stars = ({ value, size = 16 }: { value: number; size?: number }) => (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= Math.round(value) ? "star" : "star-outline"}
          size={size}
          color={GOLD_COLOR}
        />
      ))}
    </View>
  );

  const stats: { icon: IconName; value: number; label: string }[] = [
    { icon: "people", value: users.length, label: "Total users" },
    { icon: "shield-checkmark", value: users.filter((u) => u.admin).length, label: "Admins" },
    { icon: "chatbubble-ellipses", value: feedback.length, label: "Feedback" },
    { icon: "restaurant", value: foods.length, label: "Catalog foods" },
  ];

  const tabs: { key: Tab; label: string; icon: IconName }[] = [
    { key: "users", label: "Users", icon: "people-outline" },
    { key: "feedback", label: "Feedback", icon: "chatbubbles-outline" },
    { key: "foods", label: "Foods", icon: "restaurant-outline" },
    { key: "ai", label: "AI", icon: "sparkles-outline" },
  ];

  // Timezone
  const manilaToday = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  const dayKey = (daysAgo: number) =>
    new Date(Date.parse(manilaToday + "T00:00:00Z") - daysAgo * 86400000).toISOString().slice(0, 10);
  const chartDays = Array.from({ length: CHART_DAYS }, (_, i) => dayKey(CHART_DAYS - 1 - i));
  const sumTokens = (rows: AiSummaryRow[]) => rows.reduce((a, r) => a + Number(r.total_tokens), 0);
  const tokensToday = sumTokens(aiSummary.filter((r) => r.day === manilaToday));
  const tokens7 = sumTokens(aiSummary.filter((r) => r.day >= dayKey(6)));
  const tokens30 = sumTokens(aiSummary);
  const calls30 = aiSummary.reduce((a, r) => a + Number(r.calls), 0);
  const dayTotals = chartDays.map((day) => {
    const rows = aiSummary.filter((r) => r.day === day);
    return { day, total: sumTokens(rows), rows };
  });
  const maxDayTotal = Math.max(1, ...dayTotals.map((d) => d.total));
  const featureTotals = Object.keys(AI_FEATURES)
    .concat(aiSummary.map((r) => r.feature).filter((f) => !(f in AI_FEATURES)))
    .filter((f, i, all) => all.indexOf(f) === i)
    .map((feature) => {
      const rows = aiSummary.filter((r) => r.feature === feature);
      return {
        feature,
        calls: rows.reduce((a, r) => a + Number(r.calls), 0),
        tokens: sumTokens(rows),
        prompt: rows.reduce((a, r) => a + Number(r.prompt_tokens), 0),
        output: rows.reduce((a, r) => a + Number(r.output_tokens), 0),
      };
    })
    .filter((f) => f.calls > 0)
    .sort((a, b) => b.tokens - a.tokens);
  // Quota
  const resetMs = aiQuota ? Date.parse(aiQuota.next_reset) - now : null;
  const cycleEnded = !!aiQuota && now >= Date.parse(aiQuota.next_reset);
  const cycleCalls = cycleEnded ? 0 : Number(aiQuota?.calls ?? 0);
  const cycleTokens = cycleEnded ? 0 : Number(aiQuota?.tokens ?? 0);
  const clockLabel = (iso: string) =>
    new Date(iso).toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  const formatCountdown = (ms: number) => {
    const totalMinutes = Math.max(0, Math.ceil(ms / 60000));
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };
  const resetClock = aiQuota
    ? new Date(aiQuota.next_reset).toLocaleString("en-PH", {
        timeZone: "Asia/Manila",
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";
  const quotaRows: { label: string; used: number; limit: number | null }[] = [
    { label: "Requests", used: cycleCalls, limit: quotaLimits.daily_requests },
    { label: "Tokens", used: cycleTokens, limit: quotaLimits.daily_tokens },
  ];
  const aiUsername = (id: string | null) =>
    id ? users.find((u) => u.id === id)?.username || "Unknown user" : "Unknown";
  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  if (loading || !adminVerified) {
    return (
      <SafeAreaView style={s.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={s.loadingText}>Loading admin panel...</Text>
        {slowLoad && (
          <>
            <Text style={s.loadingHint}>This is taking longer than usual. Please check your connection.</Text>
            <Pressable style={({ pressed }) => [s.loadingLogout, pressed && s.pressed]} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={18} color={DANGER_COLOR} />
              <Text style={s.loadingLogoutText}>Logout</Text>
            </Pressable>
          </>
        )}
      </SafeAreaView>
    );
  }

  const overview =
    activeTab !== "ai" ? (
      <View style={s.statsGrid}>
        {stats.map((stat) => (
          <View key={stat.label} style={s.statCard}>
            <View style={s.statIcon}>
              <Ionicons name={stat.icon} size={18} color={colors.accent} />
            </View>
            <View>
              <Text style={s.statNumber}>{stat.value}</Text>
              <Text style={s.statLabel}>{stat.label}</Text>
            </View>
          </View>
        ))}
      </View>
    ) : null;

  const foodsHeader = (
    <>
      {overview}
      <Pressable style={({ pressed }) => [s.addFoodBtn, pressed && s.pressed]} onPress={openAddFood}>
        <Ionicons name="add-circle" size={22} color={colors.onAccent} />
        <Text style={s.addFoodBtnText}>Add new food</Text>
      </Pressable>

      <View style={s.searchBar}>
        <Ionicons name="search" size={20} color={colors.accent} style={{ marginRight: 10 }} />
        <TextInput
          style={s.searchInput}
          placeholder="Search foods..."
          placeholderTextColor={colors.textMuted}
          value={foodSearchQuery}
          onChangeText={setFoodSearchQuery}
        />
        {foodSearchQuery.length > 0 && (
          <Pressable onPress={() => setFoodSearchQuery("")} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      </View>
      <View style={s.chipRow}>
        {MEAL_TYPES.map((type) => (
          <Chip
            key={type}
            s={s}
            label={type === "all" ? "All" : mealTypeLabel[type]}
            active={foodMealFilter === type}
            onPress={() => setFoodMealFilter(type)}
          />
        ))}
      </View>
      <Text style={s.resultCount}>
        {filteredFoods.length} food{filteredFoods.length === 1 ? "" : "s"}
      </Text>
    </>
  );

  const foodsEmpty = (
    <View style={s.emptyBox}>
      <Ionicons name="restaurant-outline" size={34} color={colors.textMuted} />
      <Text style={s.emptyText}>No foods found.</Text>
    </View>
  );

  const refreshControl = (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />
  );

  return (
    <SafeAreaView style={s.safeArea}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.headerIcon}>
            <Ionicons name="shield-checkmark" size={24} color={colors.onAccent} />
          </View>
          <View>
            <Text style={s.headerTitle}>Admin Panel</Text>
            <Text style={s.headerSub}>Manage users, feedback & foods</Text>
          </View>
        </View>
        <Pressable
          style={({ pressed }) => [s.logoutBtn, pressed && s.pressed]}
          onPress={handleLogout}
          accessibilityRole="button"
          accessibilityLabel="Logout"
        >
          <Ionicons name="log-out-outline" size={18} color={DANGER_COLOR} />
          <Text style={s.logoutText}>Logout</Text>
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {tabs.map(({ key, label, icon }) => {
          const active = activeTab === key;
          return (
            <Pressable
              key={key}
              style={({ pressed }) => [s.tab, active && s.activeTab, pressed && s.pressed]}
              onPress={() => setActiveTab(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Ionicons name={icon} size={19} color={active ? colors.onAccent : colors.textSecondary} />
              <Text style={[s.tabText, active && s.activeTabText]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Content */}
      {activeTab === "foods" ? (
        <FlatList
          data={filteredFoods}
          keyExtractor={foodKey}
          renderItem={renderFood}
          ListHeaderComponent={foodsHeader}
          ListEmptyComponent={foodsEmpty}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          updateCellsBatchingPeriod={50}
          windowSize={7}
        />
      ) : (
        <ScrollView
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
        >
          {overview}

          {/* Users */}
          {activeTab === "users" && (
            <>
              <View style={s.searchBar}>
                <Ionicons name="search" size={20} color={colors.accent} style={{ marginRight: 10 }} />
                <TextInput
                  style={s.searchInput}
                  placeholder="Search by name or email"
                  placeholderTextColor={colors.textMuted}
                  value={userSearchQuery}
                  onChangeText={setUserSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {userSearchQuery.length > 0 && (
                  <Pressable onPress={() => setUserSearchQuery("")} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </Pressable>
                )}
              </View>
              <View style={s.chipRow}>
                <Chip s={s} label={`All (${users.length})`} active={userFilter === "all"} onPress={() => setUserFilter("all")} />
                <Chip s={s} label={`Admins (${users.filter((u) => u.admin).length})`} active={userFilter === "admins"} onPress={() => setUserFilter("admins")} />
                <Chip s={s} label={`Members (${users.filter((u) => !u.admin).length})`} active={userFilter === "members"} onPress={() => setUserFilter("members")} />
              </View>

              {filteredUsers.length === 0 ? (
                <View style={s.emptyBox}>
                  <Ionicons name="people-outline" size={34} color={colors.textMuted} />
                  <Text style={s.emptyText}>{users.length === 0 ? "No users found." : "No users match your search."}</Text>
                </View>
              ) : (
                filteredUsers.map((user) => (
                  <View key={user.id} style={s.card}>
                    <View style={s.cardTop}>
                      <View style={s.avatarCircle}>
                        <Text style={s.avatarText}>{user.username?.charAt(0).toUpperCase() || "?"}</Text>
                      </View>
                      <View style={s.cardInfo}>
                        <View style={s.nameRow}>
                          <Text style={s.cardName} numberOfLines={1}>{user.username}</Text>
                          {user.admin && (
                            <View style={s.adminBadge}>
                              <Ionicons name="shield-checkmark" size={11} color={GOLD_COLOR} />
                              <Text style={s.adminBadgeText}>ADMIN</Text>
                            </View>
                          )}
                        </View>
                        <Text style={s.cardEmail} numberOfLines={1}>{user.email}</Text>
                        <Text style={s.cardDate}>Joined {formatDate(user.created_at)}</Text>
                      </View>
                    </View>
                    <View style={s.cardActions}>
                      <Pressable style={({ pressed }) => [s.actionBtn, s.editBtn, pressed && s.pressed]} onPress={() => openEditUser(user)}>
                        <Ionicons name="create-outline" size={16} color={colors.accent} />
                        <Text style={s.editBtnText}>Edit</Text>
                      </Pressable>
                      <Pressable style={({ pressed }) => [s.actionBtn, s.neutralBtn, pressed && s.pressed]} onPress={() => handleToggleAdmin(user)}>
                        <Ionicons name={user.admin ? "shield-outline" : "shield-checkmark-outline"} size={16} color={colors.textSecondary} />
                        <Text style={s.neutralBtnText}>{user.admin ? "Remove admin" : "Make admin"}</Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [s.iconBtn, s.deleteBtn, pressed && s.pressed]}
                        onPress={() => handleDeleteUser(user)}
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${user.username}`}
                      >
                        <Ionicons name="trash-outline" size={18} color={DANGER_COLOR} />
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </>
          )}

          {/* Feedback */}
          {activeTab === "feedback" && (
            <>
              {feedback.length > 0 && (
                <View style={s.ratingCard}>
                  <View style={s.ratingLeft}>
                    <Text style={s.ratingBig}>{avgRating.toFixed(1)}</Text>
                    <Stars value={avgRating} size={15} />
                    <Text style={s.ratingSub}>{feedback.length} review{feedback.length === 1 ? "" : "s"}</Text>
                  </View>
                  <View style={s.ratingBars}>
                    {ratingCounts.map(({ star, count }) => (
                      <View key={star} style={s.ratingBarRow}>
                        <Text style={s.ratingBarLabel}>{star}</Text>
                        <Ionicons name="star" size={11} color={GOLD_COLOR} />
                        <View style={s.ratingTrack}>
                          <View style={[s.ratingFill, { width: `${(count / maxRatingCount) * 100}%` }]} />
                        </View>
                        <Text style={s.ratingBarCount}>{count}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View style={s.chipRow}>
                <Chip s={s} label="All" active={feedbackFilter === "all"} onPress={() => setFeedbackFilter("all")} />
                <Chip s={s} label="4–5 ★" active={feedbackFilter === "high"} onPress={() => setFeedbackFilter("high")} />
                <Chip s={s} label="3 ★" active={feedbackFilter === "mid"} onPress={() => setFeedbackFilter("mid")} />
                <Chip s={s} label="1–2 ★" active={feedbackFilter === "low"} onPress={() => setFeedbackFilter("low")} />
              </View>

              {filteredFeedback.length === 0 ? (
                <View style={s.emptyBox}>
                  <Ionicons name="chatbubbles-outline" size={34} color={colors.textMuted} />
                  <Text style={s.emptyText}>{feedback.length === 0 ? "No feedback yet." : "No feedback in this range."}</Text>
                </View>
              ) : (
                filteredFeedback.map((fb) => (
                  <View key={fb.id} style={s.card}>
                    <View style={s.feedbackTop}>
                      <View style={s.feedbackWho}>
                        <View style={[s.avatarCircle, s.avatarSmall]}>
                          <Text style={[s.avatarText, { fontSize: 15 }]}>
                            {usernameFor(fb.user_id).charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.feedbackUser} numberOfLines={1}>{usernameFor(fb.user_id)}</Text>
                          <Text style={s.feedbackDate}>{formatDate(fb.created_at)}</Text>
                        </View>
                      </View>
                      <Stars value={fb.rating} />
                    </View>
                    {fb.message ? (
                      <Text style={s.feedbackMessage}>{fb.message}</Text>
                    ) : (
                      <Text style={s.feedbackNoMessage}>No message provided.</Text>
                    )}
                    <View style={s.cardActions}>
                      <View style={{ flex: 1 }} />
                      <Pressable
                        style={({ pressed }) => [s.actionBtn, s.deleteBtn, { flex: 0, paddingHorizontal: 18 }, pressed && s.pressed]}
                        onPress={() => handleDeleteFeedback(fb.id)}
                      >
                        <Ionicons name="trash-outline" size={16} color={DANGER_COLOR} />
                        <Text style={s.deleteBtnText}>Delete</Text>
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </>
          )}

          {/* Usage */}
          {activeTab === "ai" &&
            (aiSetup === "missing" ? (
              <View style={s.card}>
                <View style={s.aiSetupRow}>
                  <Ionicons name="construct-outline" size={22} color={GOLD_COLOR} />
                  <Text style={s.aiSetupTitle}>Usage tracking isn&apos;t set up yet</Text>
                </View>
                <Text style={s.aiSetupText}>
                  Run the AI usage SQL (supabase/migrations/20261008_ai_usage.sql) once in the Supabase
                  SQL Editor, then pull down to refresh. Token counts are recorded from then on.
                </Text>
              </View>
            ) : (
              <>
                {/* Quota */}
                <View style={s.card}>
                  <View style={s.quotaHeader}>
                    <View style={s.quotaTitleWrap}>
                      <Ionicons name="timer-outline" size={20} color={colors.accent} />
                      <Text style={s.aiCardTitle}>Daily quota</Text>
                    </View>
                    <Pressable
                      style={({ pressed }) => [s.quotaEditBtn, pressed && s.pressed]}
                      onPress={openQuotaModal}
                      accessibilityRole="button"
                    >
                      <Ionicons name="create-outline" size={15} color={colors.accent} />
                      <Text style={s.quotaEditText}>Set limits</Text>
                    </Pressable>
                  </View>

                  {aiQuota ? (
                    <View style={s.resetBox}>
                      <Text style={s.resetBig}>{cycleEnded ? "Resetting…" : `Resets in ${formatCountdown(resetMs ?? 0)}`}</Text>
                      <Text style={s.resetSub}>
                        24-hour cycle: {clockLabel(aiQuota.window_start)} → {resetClock} (Philippine time). Counters
                        go back to 0 when it ends. Google resets daily quotas at midnight Pacific.
                      </Text>
                    </View>
                  ) : null}

                  {quotaRows.map((row) => {
                    const pct = row.limit ? Math.min(100, (row.used / row.limit) * 100) : 0;
                    const left = row.limit ? Math.max(0, row.limit - row.used) : null;
                    const barColor = pct >= 100 ? DANGER_COLOR : pct >= 80 ? GOLD_COLOR : colors.accent;
                    return (
                      <View key={row.label} style={s.quotaRow}>
                        <View style={s.quotaRowTop}>
                          <Text style={s.quotaLabel}>{row.label} used (24h)</Text>
                          <Text style={s.quotaValue}>
                            {row.used.toLocaleString()}
                            {row.limit ? ` / ${row.limit.toLocaleString()}` : ""}
                          </Text>
                        </View>
                        {row.limit ? (
                          <>
                            <View style={s.quotaTrack}>
                              <View style={[s.quotaFill, { width: `${pct}%`, backgroundColor: barColor }]} />
                            </View>
                            <Text style={[s.quotaLeft, pct >= 100 && { color: DANGER_COLOR }]}>
                              {left === 0 ? "Limit reached" : `${(left ?? 0).toLocaleString()} left`}
                            </Text>
                          </>
                        ) : (
                          <Text style={s.quotaLeft}>No limit set. Tap &quot;Set limits&quot; to see what&apos;s left.</Text>
                        )}
                      </View>
                    );
                  })}

                  <Text style={s.quotaNote}>
                    Gemini doesn&apos;t report remaining quota, so this counts only this app&apos;s calls against the
                    limits you enter from Google AI Studio. Other uses of the same key aren&apos;t included, and
                    per-minute limits (tokens per minute) reset every minute.
                  </Text>
                  <Pressable
                    style={({ pressed }) => [s.studioBtn, pressed && s.pressed]}
                    onPress={() => Linking.openURL(AI_STUDIO_LIMITS_URL)}
                    accessibilityRole="link"
                  >
                    <Ionicons name="open-outline" size={16} color={colors.accent} />
                    <Text style={s.studioBtnText}>See your real limits in AI Studio</Text>
                  </Pressable>
                </View>

                <View style={s.statsGrid}>
                  {[
                    { icon: "today-outline" as IconName, value: fmtTokens(cycleTokens), label: "Tokens (24h cycle)" },
                    { icon: "calendar-outline" as IconName, value: fmtTokens(tokens7), label: "Last 7 days" },
                    { icon: "stats-chart-outline" as IconName, value: fmtTokens(tokens30), label: "Last 30 days" },
                    { icon: "flash-outline" as IconName, value: calls30.toLocaleString(), label: "AI calls (30 days)" },
                  ].map((stat) => (
                    <View key={stat.label} style={s.statCard}>
                      <View style={s.statIcon}>
                        <Ionicons name={stat.icon} size={18} color={colors.accent} />
                      </View>
                      <View>
                        <Text style={s.statNumber}>{stat.value}</Text>
                        <Text style={s.statLabel}>{stat.label}</Text>
                      </View>
                    </View>
                  ))}
                </View>

                {calls30 === 0 ? (
                  <View style={s.emptyBox}>
                    <Ionicons name="sparkles-outline" size={34} color={colors.textMuted} />
                    <Text style={s.emptyText}>No AI calls recorded yet.</Text>
                    <Text style={s.aiEmptyHint}>
                      Usage appears here after the next scan, auto-fill or Weep chat message.
                    </Text>
                  </View>
                ) : (
                  <>
                    {/* Chart */}
                    <View style={s.card}>
                      <Text style={s.aiCardTitle}>Tokens per day</Text>
                      <Text style={s.aiCardSub}>Last {CHART_DAYS} days · peak {fmtTokens(maxDayTotal)}</Text>
                      <View style={s.chartRow}>
                        {dayTotals.map(({ day, total, rows }) => (
                          <View key={day} style={s.chartCol}>
                            <View style={s.chartBarArea}>
                              {rows.map((r) => (
                                <View
                                  key={r.feature}
                                  style={{
                                    height: Math.max(2, (Number(r.total_tokens) / maxDayTotal) * CHART_HEIGHT),
                                    backgroundColor: featureMeta(r.feature).color,
                                  }}
                                />
                              ))}
                              {total === 0 && <View style={s.chartEmptyBar} />}
                            </View>
                            <Text style={[s.chartDayLabel, day === manilaToday && s.chartDayToday]}>
                              {Number(day.slice(8))}
                            </Text>
                          </View>
                        ))}
                      </View>
                      <View style={s.legendRow}>
                        {Object.entries(AI_FEATURES).map(([key, meta]) => (
                          <View key={key} style={s.legendItem}>
                            <View style={[s.legendDot, { backgroundColor: meta.color }]} />
                            <Text style={s.legendText}>{meta.label}</Text>
                          </View>
                        ))}
                      </View>
                    </View>

                    {/* Features */}
                    <View style={s.card}>
                      <Text style={s.aiCardTitle}>By feature</Text>
                      <Text style={s.aiCardSub}>Last 30 days</Text>
                      {featureTotals.map((f) => {
                        const meta = featureMeta(f.feature);
                        return (
                          <View key={f.feature} style={s.featureRow}>
                            <View style={[s.featureIcon, { borderColor: meta.color }]}>
                              <Ionicons name={meta.icon} size={16} color={meta.color} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <View style={s.featureTop}>
                                <Text style={s.featureName}>{meta.label}</Text>
                                <Text style={s.featureTokens}>{fmtTokens(f.tokens)}</Text>
                              </View>
                              <View style={s.featureTrack}>
                                <View
                                  style={[
                                    s.featureFill,
                                    { width: `${tokens30 > 0 ? (f.tokens / tokens30) * 100 : 0}%`, backgroundColor: meta.color },
                                  ]}
                                />
                              </View>
                              <Text style={s.featureMeta}>
                                {f.calls.toLocaleString()} call{f.calls === 1 ? "" : "s"} · in {fmtTokens(f.prompt)} · out{" "}
                                {fmtTokens(f.output)}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>

                    {/* Ranking */}
                    {aiByUser.length > 0 && (
                      <View style={s.card}>
                        <Text style={s.aiCardTitle}>Top users</Text>
                        <Text style={s.aiCardSub}>Last 30 days</Text>
                        {aiByUser.map((row, i) => (
                          <View key={row.user_id ?? `u${i}`} style={s.userUsageRow}>
                            <Text style={s.userRank}>{i + 1}</Text>
                            <View style={{ flex: 1 }}>
                              <Text style={s.userUsageName} numberOfLines={1}>
                                {row.username || aiUsername(row.user_id)}
                              </Text>
                              <Text style={s.featureMeta}>
                                {Number(row.calls).toLocaleString()} call{Number(row.calls) === 1 ? "" : "s"}
                              </Text>
                            </View>
                            <Text style={s.featureTokens}>{fmtTokens(Number(row.total_tokens))}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* History */}
                    {aiRecent.length > 0 && (
                      <View style={s.card}>
                        <Text style={s.aiCardTitle}>Recent calls</Text>
                        {aiRecent.map((row) => {
                          const meta = featureMeta(row.feature);
                          return (
                            <View key={row.id} style={s.recentRow}>
                              <View style={[s.legendDot, { backgroundColor: meta.color }]} />
                              <View style={{ flex: 1 }}>
                                <Text style={s.userUsageName} numberOfLines={1}>
                                  {meta.label} · {aiUsername(row.user_id)}
                                </Text>
                                <Text style={s.featureMeta}>{formatDateTime(row.created_at)}</Text>
                              </View>
                              <Text style={s.featureTokens}>{fmtTokens(Number(row.total_tokens))}</Text>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </>
                )}

                <Text style={s.aiFootnote}>
                  Tokens are counted by Gemini (input + output) and recorded by the server after every AI
                  call. Your remaining quota is shown in Google AI Studio.
                </Text>
              </>
            ))}
        </ScrollView>
      )}

      {/* Modals */}

      {/* Editing */}
      <Modal visible={userEditModal} transparent animationType="slide" onRequestClose={() => { setUserEditModal(false); setEditingUser(null); }}>
        <KeyboardSafeView style={s.modalOverlay} behavior="padding">
          <View style={s.modalContent}>
            <View style={s.sheetHandle} />
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Edit user</Text>
              <Pressable style={s.modalClose} onPress={() => { setUserEditModal(false); setEditingUser(null); }} hitSlop={8}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Field s={s} colors={colors} label="Username" placeholder="Username *" value={userEditForm.username} onChangeText={(v) => setUserEditForm((p) => ({ ...p, username: v }))} autoCapitalize="none" />
              <Field s={s} colors={colors} label="Email" placeholder="Email *" value={userEditForm.email} onChangeText={(v) => setUserEditForm((p) => ({ ...p, email: v }))} keyboardType="email-address" autoCapitalize="none" />
              <Text style={s.fieldLabel}>New password</Text>
              <View style={s.passwordRow}>
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  placeholder="Leave blank to keep current"
                  placeholderTextColor={colors.textMuted}
                  value={userEditForm.password}
                  onChangeText={(v) => setUserEditForm((p) => ({ ...p, password: v }))}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <Pressable style={s.eyeBtn} onPress={() => setShowPassword((p) => !p)} accessibilityLabel={showPassword ? "Hide password" : "Show password"}>
                  <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textSecondary} />
                </Pressable>
              </View>
              <Text style={s.passwordHint}>Min 6 characters. Leave blank to keep the current password.</Text>
            </ScrollView>
            <View style={s.modalButtons}>
              <Pressable style={({ pressed }) => [s.cancelButton, pressed && s.pressed]} onPress={() => { setUserEditModal(false); setEditingUser(null); }}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [s.saveButton, pressed && s.pressed]} onPress={handleSaveUser} disabled={savingUser}>
                {savingUser ? <ActivityIndicator color={colors.onAccent} /> : <Text style={s.saveBtnText}>Save changes</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardSafeView>
      </Modal>

      {/* Editing */}
      <Modal visible={foodModal} transparent animationType="slide" onRequestClose={closeFoodModal}>
        <KeyboardSafeView style={s.modalOverlay} behavior="padding">
          <View style={s.modalContent}>
            <View style={s.sheetHandle} />
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{editingFood ? "Edit food" : "Add new food"}</Text>
              <Pressable style={s.modalClose} onPress={closeFoodModal} hitSlop={8}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Field s={s} colors={colors} label="Food name" placeholder="e.g. Chicken adobo *" value={foodForm.name} onChangeText={(v) => setFoodForm((p) => ({ ...p, name: v }))} />

              {/* Autofill */}
              <Pressable
                style={({ pressed }) => [s.autoFillBtn, autoFilling && { opacity: 0.7 }, pressed && s.pressed]}
                onPress={autoFillNutrition}
                disabled={autoFilling}
              >
                {autoFilling ? (
                  <ActivityIndicator color={colors.accent} size="small" />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={18} color={colors.accent} />
                    <Text style={s.autoFillBtnText}>AI auto-fill nutrition & ingredients</Text>
                  </>
                )}
              </Pressable>

              {/* Serving */}
              {baseNutrition && (
                <View style={s.servingWrap}>
                  <Text style={s.fieldLabel}>Serving size</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRowInline}>
                    {GRAM_OPTIONS.map((g) => (
                      <Chip
                        key={g}
                        s={s}
                        label={`${g}g`}
                        active={selectedGrams === g}
                        onPress={() => {
                          setSelectedGrams(g);
                          applyGrams(baseNutrition, g);
                        }}
                      />
                    ))}
                  </ScrollView>
                </View>
              )}

              <Field s={s} colors={colors} label="Calories (kcal)" placeholder="Calories *" value={foodForm.calories} onChangeText={(v) => setFoodForm((p) => ({ ...p, calories: v }))} keyboardType="numeric" />
              <View style={s.threeCol}>
                <View style={{ flex: 1 }}>
                  <Field s={s} colors={colors} label="Serving size (g)" placeholder="100" value={foodForm.serving_g} onChangeText={(v) => setFoodForm((p) => ({ ...p, serving_g: v }))} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <Field s={s} colors={colors} label="Price per serving (₱)" placeholder="Optional" value={foodForm.price_php} onChangeText={(v) => setFoodForm((p) => ({ ...p, price_php: v }))} keyboardType="numeric" />
                </View>
              </View>
              <View style={s.threeCol}>
                <View style={{ flex: 1 }}>
                  <Field s={s} colors={colors} label="Protein (g)" placeholder="0" value={foodForm.protein} onChangeText={(v) => setFoodForm((p) => ({ ...p, protein: v }))} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <Field s={s} colors={colors} label="Carbs (g)" placeholder="0" value={foodForm.carbs} onChangeText={(v) => setFoodForm((p) => ({ ...p, carbs: v }))} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <Field s={s} colors={colors} label="Fat (g)" placeholder="0" value={foodForm.fat} onChangeText={(v) => setFoodForm((p) => ({ ...p, fat: v }))} keyboardType="numeric" />
                </View>
              </View>

              <Field s={s} colors={colors} label="Image URL (optional)" placeholder="https://..." value={foodForm.image_url} onChangeText={(v) => setFoodForm((p) => ({ ...p, image_url: v }))} autoCapitalize="none" />
              {foodForm.image_url.trim() ? (
                <Image source={{ uri: foodForm.image_url.trim() }} style={s.imagePreview} resizeMode="cover" />
              ) : null}

              <Text style={s.fieldLabel}>Meal type</Text>
              <View style={[s.chipRow, { marginBottom: 18 }]}>
                {MEAL_TYPES.map((type) => (
                  <Chip
                    key={type}
                    s={s}
                    label={type.charAt(0).toUpperCase() + type.slice(1)}
                    active={foodForm.meal_type === type}
                    onPress={() => setFoodForm((p) => ({ ...p, meal_type: type }))}
                  />
                ))}
              </View>

              {/* Ingredients */}
              <View style={s.ingredientSection}>
                <View style={s.ingredientHeader}>
                  <Text style={s.sectionTitle}>Ingredients ({ingredients.length})</Text>
                  <Pressable style={({ pressed }) => [s.addIngredientBtn, pressed && s.pressed]} onPress={openAddIngredient}>
                    <Ionicons name="add" size={18} color={colors.accent} />
                    <Text style={s.addIngredientBtnText}>Add</Text>
                  </Pressable>
                </View>
                {ingredients.length === 0 ? (
                  <Text style={s.noIngredientsText}>No ingredients added yet.</Text>
                ) : (
                  ingredients.map((ing, index) => (
                    <View key={index} style={s.ingredientRow}>
                      {ing.image_url
                        ? <Image source={{ uri: ing.image_url }} style={s.ingredientThumb} />
                        : <View style={[s.ingredientThumb, s.ingredientThumbPlaceholder]}><Ionicons name="leaf" size={18} color={colors.accent} /></View>
                      }
                      <View style={s.ingredientInfo}>
                        <Text style={s.ingredientName}>{ing.name}</Text>
                        <Text style={s.ingredientMacros}>
                          {ing.calories ? `${ing.calories} kcal` : ""}
                          {ing.protein ? `  P:${ing.protein}g` : ""}
                          {ing.carbs ? `  C:${ing.carbs}g` : ""}
                          {ing.fat ? `  F:${ing.fat}g` : ""}
                        </Text>
                      </View>
                      <Pressable style={s.ingredientEditBtn} onPress={() => openEditIngredient(index)} accessibilityLabel="Edit ingredient">
                        <Ionicons name="pencil" size={16} color={colors.accent} />
                      </Pressable>
                      <Pressable style={s.ingredientDeleteBtn} onPress={() => removeIngredient(index)} accessibilityLabel="Remove ingredient">
                        <Ionicons name="trash-outline" size={16} color={DANGER_COLOR} />
                      </Pressable>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>

            <View style={s.modalButtons}>
              <Pressable style={({ pressed }) => [s.cancelButton, pressed && s.pressed]} onPress={closeFoodModal}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [s.saveButton, pressed && s.pressed]} onPress={handleSaveFood} disabled={savingFood}>
                {savingFood ? <ActivityIndicator color={colors.onAccent} /> : <Text style={s.saveBtnText}>{editingFood ? "Save changes" : "Add food"}</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardSafeView>
      </Modal>

      {/* Ingredients */}
      <Modal visible={ingredientModal} transparent animationType="fade" onRequestClose={() => setIngredientModal(false)}>
        <KeyboardSafeView style={s.ingredientModalOverlay} behavior="padding">
          <View style={s.ingredientModalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{editingIngredientIndex !== null ? "Edit ingredient" : "Add ingredient"}</Text>
              <Pressable style={s.modalClose} onPress={() => setIngredientModal(false)} hitSlop={8}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Field s={s} colors={colors} label="Name" placeholder="Ingredient name *" value={ingredientForm.name} onChangeText={(v) => setIngredientForm((p) => ({ ...p, name: v }))} />
              <Field s={s} colors={colors} label="Image URL (optional)" placeholder="https://..." value={ingredientForm.image_url} onChangeText={(v) => setIngredientForm((p) => ({ ...p, image_url: v }))} autoCapitalize="none" />
              {ingredientForm.image_url ? <Image source={{ uri: ingredientForm.image_url }} style={s.ingredientPreview} resizeMode="cover" /> : null}
              <Field s={s} colors={colors} label="Calories (optional)" placeholder="kcal" value={ingredientForm.calories} onChangeText={(v) => setIngredientForm((p) => ({ ...p, calories: v }))} keyboardType="numeric" />
              <View style={s.threeCol}>
                <View style={{ flex: 1 }}>
                  <Field s={s} colors={colors} label="Protein (g)" placeholder="0" value={ingredientForm.protein} onChangeText={(v) => setIngredientForm((p) => ({ ...p, protein: v }))} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <Field s={s} colors={colors} label="Carbs (g)" placeholder="0" value={ingredientForm.carbs} onChangeText={(v) => setIngredientForm((p) => ({ ...p, carbs: v }))} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <Field s={s} colors={colors} label="Fat (g)" placeholder="0" value={ingredientForm.fat} onChangeText={(v) => setIngredientForm((p) => ({ ...p, fat: v }))} keyboardType="numeric" />
                </View>
              </View>
            </ScrollView>
            <View style={s.modalButtons}>
              <Pressable style={({ pressed }) => [s.cancelButton, pressed && s.pressed]} onPress={() => setIngredientModal(false)}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [s.saveButton, pressed && s.pressed]} onPress={saveIngredient}>
                <Text style={s.saveBtnText}>{editingIngredientIndex !== null ? "Save" : "Add"}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardSafeView>
      </Modal>
      {/* Limits */}
      <Modal visible={quotaModal} transparent animationType="fade" onRequestClose={() => setQuotaModal(false)}>
        <KeyboardSafeView style={s.ingredientModalOverlay} behavior="padding">
          <View style={s.ingredientModalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>AI quota limits</Text>
              <Pressable style={s.modalClose} onPress={() => setQuotaModal(false)} hitSlop={8}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={s.quotaFormHelp}>
                Open Google AI Studio → Rate limits, find your model (Gemini Flash-Lite) and copy its numbers here.
                Leave a field empty if you don&apos;t want to track it.
              </Text>
              <Field
                s={s}
                colors={colors}
                label="Requests per day (RPD)"
                placeholder="e.g. 1000"
                value={quotaForm.requests}
                onChangeText={(v) => setQuotaForm((p) => ({ ...p, requests: v }))}
                keyboardType="numeric"
              />
              <Field
                s={s}
                colors={colors}
                label="Daily token budget (optional)"
                placeholder="e.g. 250000"
                value={quotaForm.tokens}
                onChangeText={(v) => setQuotaForm((p) => ({ ...p, tokens: v }))}
                keyboardType="numeric"
              />
              <Text style={s.quotaFormHelp}>
                Gemini&apos;s free tier has no fixed daily token pool, so the token budget is your own cap, useful
                if you want an early warning before costs or per-minute limits become a problem.
              </Text>
            </ScrollView>
            <View style={s.modalButtons}>
              <Pressable style={({ pressed }) => [s.cancelButton, pressed && s.pressed]} onPress={() => setQuotaModal(false)}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [s.saveButton, pressed && s.pressed]} onPress={handleSaveQuota} disabled={savingQuota}>
                {savingQuota ? <ActivityIndicator color={colors.onAccent} /> : <Text style={s.saveBtnText}>Save</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardSafeView>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: c.background },
    pressed: { opacity: 0.8 },
    loadingContainer: { flex: 1, backgroundColor: c.background, justifyContent: "center", alignItems: "center" },
    loadingText: { marginTop: 16, color: c.textSecondary, fontSize: 16, fontWeight: "600" },
    loadingHint: { marginTop: 12, color: c.textMuted, fontSize: 13.5, fontWeight: "600", textAlign: "center", paddingHorizontal: 40, lineHeight: 20 },
    loadingLogout: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 18,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: DANGER_COLOR,
      backgroundColor: c.surface,
    },
    loadingLogoutText: { color: DANGER_COLOR, fontWeight: "800", fontSize: 14 },

    // Header
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: Platform.OS === "android" ? 20 : 10,
      paddingBottom: 14,
    },
    headerLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
    headerIcon: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: c.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: { fontSize: 22, fontWeight: "900", color: c.textPrimary },
    headerSub: { fontSize: 12.5, color: c.textSecondary, fontWeight: "600", marginTop: 1 },
    logoutBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: DANGER_COLOR,
      backgroundColor: c.surface,
    },
    logoutText: { color: DANGER_COLOR, fontWeight: "800", fontSize: 13.5 },

    // Tabs
    tabRow: {
      flexDirection: "row",
      marginHorizontal: 20,
      backgroundColor: c.surfaceAlt,
      borderRadius: 16,
      padding: 4,
      marginBottom: 14,
      gap: 4,
    },
    tab: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
      paddingVertical: 9,
      borderRadius: 13,
    },
    activeTab: { backgroundColor: c.accent },
    tabText: { fontSize: 12.5, fontWeight: "800", color: c.textSecondary },
    activeTabText: { color: c.onAccent },
    tabCount: {
      minWidth: 20,
      paddingHorizontal: 5,
      height: 18,
      borderRadius: 9,
      backgroundColor: c.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    tabCountActive: { backgroundColor: c.onAccent },
    tabCountText: { fontSize: 11, fontWeight: "800", color: c.textSecondary },
    tabCountTextActive: { color: c.accent },

    scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },

    // Stats
    statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
    statCard: {
      width: "48.5%",
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: c.surface,
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: c.border,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    statIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    statNumber: { fontSize: 20, fontWeight: "900", color: c.textPrimary },
    statLabel: { fontSize: 11.5, color: c.textSecondary, fontWeight: "700", marginTop: 1 },

    // Search
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.surface,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 4,
      borderWidth: 1.5,
      borderColor: c.borderStrong,
      marginBottom: 12,
    },
    searchInput: { flex: 1, fontSize: 15.5, color: c.textPrimary, fontWeight: "600", paddingVertical: 11 },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
    chipRowInline: { flexDirection: "row", gap: 8, paddingBottom: 4 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    chipActive: { backgroundColor: c.accent, borderColor: c.accent },
    chipText: { fontSize: 13, fontWeight: "800", color: c.textSecondary },
    chipTextActive: { color: c.onAccent },
    resultCount: { fontSize: 12.5, fontWeight: "700", color: c.textMuted, marginBottom: 10 },

    emptyBox: { alignItems: "center", gap: 10, paddingVertical: 50 },
    emptyText: { textAlign: "center", color: c.textMuted, fontSize: 15, fontWeight: "600" },

    // Cards
    card: {
      backgroundColor: c.surface,
      borderRadius: 22,
      padding: 16,
      marginBottom: 14,
      borderWidth: 1.5,
      borderColor: c.border,
    },
    cardTop: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
    avatarCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: c.accent,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 14,
    },
    avatarSmall: { width: 38, height: 38, borderRadius: 19, marginRight: 10 },
    avatarText: { color: c.onAccent, fontSize: 20, fontWeight: "900" },
    cardInfo: { flex: 1 },
    nameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
    cardName: { flexShrink: 1, fontSize: 17, fontWeight: "800", color: c.textPrimary },
    adminBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      backgroundColor: c.surface,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: GOLD_COLOR,
    },
    adminBadgeText: { fontSize: 10, fontWeight: "900", color: GOLD_COLOR, letterSpacing: 0.4 },
    cardEmail: { fontSize: 13, color: c.textSecondary, marginBottom: 2, fontWeight: "500" },
    cardDate: { fontSize: 12, color: c.textMuted, fontWeight: "500" },
    cardActions: { flexDirection: "row", gap: 10, alignItems: "center" },
    actionBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 11,
      borderRadius: 14,
      borderWidth: 1.5,
    },
    iconBtn: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
    },
    editBtn: { backgroundColor: c.surface, borderColor: c.accent },
    editBtnText: { color: c.accent, fontWeight: "800", fontSize: 13 },
    neutralBtn: { backgroundColor: c.surface, borderColor: c.borderStrong },
    neutralBtnText: { color: c.textSecondary, fontWeight: "800", fontSize: 13 },
    deleteBtn: { backgroundColor: c.surface, borderColor: DANGER_COLOR },
    deleteBtnText: { color: DANGER_COLOR, fontWeight: "800", fontSize: 13 },

    // Feedback
    ratingCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 18,
      backgroundColor: c.surface,
      borderRadius: 22,
      borderWidth: 1.5,
      borderColor: c.border,
      padding: 16,
      marginBottom: 14,
    },
    ratingLeft: { alignItems: "center", gap: 4 },
    ratingBig: { fontSize: 38, fontWeight: "900", color: c.textPrimary },
    ratingSub: { fontSize: 12, fontWeight: "700", color: c.textMuted, marginTop: 2 },
    ratingBars: { flex: 1, gap: 5 },
    ratingBarRow: { flexDirection: "row", alignItems: "center", gap: 5 },
    ratingBarLabel: { width: 14, fontSize: 12, fontWeight: "800", color: c.textSecondary, textAlign: "right" },
    ratingTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: c.border, overflow: "hidden" },
    ratingFill: { height: 8, borderRadius: 4, backgroundColor: GOLD_COLOR },
    ratingBarCount: { width: 34, fontSize: 12, fontWeight: "700", color: c.textMuted, textAlign: "right" },
    feedbackTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10 },
    feedbackWho: { flexDirection: "row", alignItems: "center", flex: 1 },
    feedbackUser: { fontSize: 15, fontWeight: "800", color: c.textPrimary },
    feedbackDate: { fontSize: 12, color: c.textMuted, fontWeight: "500", marginTop: 1 },
    feedbackMessage: { fontSize: 15, color: c.textSecondary, lineHeight: 22, fontWeight: "500", marginBottom: 14 },
    feedbackNoMessage: { fontSize: 14, color: c.textMuted, fontStyle: "italic", marginBottom: 14 },

    // Foods
    addFoodBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: c.accent,
      paddingVertical: 15,
      borderRadius: 18,
      marginBottom: 14,
    },
    addFoodBtnText: { color: c.onAccent, fontSize: 16, fontWeight: "800" },
    foodCardTop: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
    foodThumb: { width: 64, height: 64, borderRadius: 16, backgroundColor: c.surfaceAlt },
    foodThumbPlaceholder: { alignItems: "center", justifyContent: "center" },
    foodInfo: { flex: 1 },
    foodName: { fontSize: 16, fontWeight: "800", color: c.textPrimary, marginBottom: 6 },
    foodMetaRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
    mealTypeBadge: {
      backgroundColor: c.surfaceAlt,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.border,
    },
    mealTypeBadgeText: { fontSize: 11, fontWeight: "800", color: c.textSecondary },
    ingredientCount: { fontSize: 12, color: c.textMuted, fontWeight: "700" },
    foodCalories: { fontSize: 20, fontWeight: "900", color: c.accent },
    foodCaloriesUnit: { fontSize: 12, fontWeight: "700", color: c.textSecondary },
    foodMacros: { flexDirection: "row", gap: 8, marginBottom: 14, flexWrap: "wrap" },
    macroPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: c.surfaceAlt,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 10,
    },
    macroDot: { width: 8, height: 8, borderRadius: 4 },
    macroText: { fontSize: 12.5, fontWeight: "700", color: c.textSecondary },

    // Usage
    aiSetupRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
    aiSetupTitle: { fontSize: 16, fontWeight: "800", color: c.textPrimary, flex: 1 },
    aiSetupText: { fontSize: 14, lineHeight: 21, color: c.textSecondary, fontWeight: "500" },
    aiEmptyHint: { fontSize: 13, color: c.textMuted, textAlign: "center", fontWeight: "500", paddingHorizontal: 24 },
    aiCardTitle: { fontSize: 16, fontWeight: "800", color: c.textPrimary },
    aiCardSub: { fontSize: 12.5, fontWeight: "600", color: c.textMuted, marginTop: 1, marginBottom: 14 },
    aiFootnote: { fontSize: 12, lineHeight: 18, color: c.textMuted, fontWeight: "500", textAlign: "center", paddingHorizontal: 6, marginTop: 2 },
    chartRow: { flexDirection: "row", alignItems: "flex-end", gap: 3 },
    chartCol: { flex: 1, alignItems: "center" },
    chartBarArea: { height: CHART_HEIGHT, width: "100%", justifyContent: "flex-end", borderRadius: 4, overflow: "hidden" },
    chartEmptyBar: { height: 2, backgroundColor: c.border },
    chartDayLabel: { fontSize: 10, fontWeight: "700", color: c.textMuted, marginTop: 5 },
    chartDayToday: { color: c.accent },
    legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 14 },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    legendDot: { width: 9, height: 9, borderRadius: 5 },
    legendText: { fontSize: 12.5, fontWeight: "700", color: c.textSecondary },
    featureRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
    featureIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1.5,
      backgroundColor: c.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    featureTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
    featureName: { fontSize: 14.5, fontWeight: "800", color: c.textPrimary },
    featureTokens: { fontSize: 14.5, fontWeight: "900", color: c.accent },
    featureTrack: { height: 8, borderRadius: 4, backgroundColor: c.border, overflow: "hidden" },
    featureFill: { height: 8, borderRadius: 4 },
    featureMeta: { fontSize: 12, fontWeight: "600", color: c.textMuted, marginTop: 5 },
    userUsageRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
    userRank: { width: 28, fontSize: 14, fontWeight: "900", color: c.textMuted, textAlign: "center" },
    userUsageName: { fontSize: 14.5, fontWeight: "800", color: c.textPrimary },
    recentRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },

    // Quota
    quotaHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
    quotaTitleWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
    quotaEditBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: c.accent,
      backgroundColor: c.surface,
    },
    quotaEditText: { fontSize: 13, fontWeight: "800", color: c.accent },
    resetBox: {
      backgroundColor: c.surfaceAlt,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: c.border,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginBottom: 16,
    },
    resetBig: { fontSize: 22, fontWeight: "900", color: c.accent },
    resetSub: { fontSize: 12.5, fontWeight: "600", color: c.textSecondary, marginTop: 3, lineHeight: 18 },
    quotaRow: { marginBottom: 14 },
    quotaRowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 7 },
    quotaLabel: { fontSize: 14, fontWeight: "800", color: c.textPrimary },
    quotaValue: { fontSize: 14, fontWeight: "900", color: c.textPrimary },
    quotaTrack: { height: 10, borderRadius: 5, backgroundColor: c.border, overflow: "hidden" },
    quotaFill: { height: 10, borderRadius: 5 },
    quotaLeft: { fontSize: 12.5, fontWeight: "700", color: c.textMuted, marginTop: 6 },
    quotaNote: { fontSize: 12, lineHeight: 18, fontWeight: "500", color: c.textMuted, marginTop: 2, marginBottom: 12 },
    studioBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 11,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    studioBtnText: { fontSize: 13.5, fontWeight: "800", color: c.accent },
    quotaFormHelp: { fontSize: 13, lineHeight: 19, fontWeight: "500", color: c.textSecondary, marginBottom: 14 },

    // Modals
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
    modalContent: {
      backgroundColor: c.background,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      borderWidth: 1.5,
      borderBottomWidth: 0,
      borderColor: c.border,
      paddingHorizontal: 22,
      paddingTop: 10,
      maxHeight: "92%",
    },
    sheetHandle: {
      width: 44,
      height: 5,
      borderRadius: 3,
      backgroundColor: c.borderStrong,
      alignSelf: "center",
      marginBottom: 14,
    },
    modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
    modalTitle: { fontSize: 21, fontWeight: "900", color: c.textPrimary },
    modalClose: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    fieldWrap: { marginBottom: 12 },
    fieldLabel: { fontSize: 13, fontWeight: "800", color: c.textSecondary, marginBottom: 6 },
    input: {
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.borderStrong,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15.5,
      color: c.textPrimary,
      fontWeight: "600",
    },
    threeCol: { flexDirection: "row", gap: 10 },
    autoFillBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 13,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: c.accent,
      backgroundColor: c.surfaceAlt,
      marginBottom: 14,
    },
    autoFillBtnText: { color: c.accent, fontWeight: "800", fontSize: 14.5 },
    servingWrap: { marginBottom: 12 },
    imagePreview: { width: "100%", height: 150, borderRadius: 16, marginBottom: 14, backgroundColor: c.surfaceAlt },
    sectionTitle: { fontSize: 15, fontWeight: "800", color: c.textPrimary },
    ingredientSection: {
      backgroundColor: c.surface,
      borderRadius: 18,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1.5,
      borderColor: c.border,
    },
    ingredientHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
    addIngredientBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: c.surfaceAlt,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: c.accent,
    },
    addIngredientBtnText: { color: c.accent, fontWeight: "800", fontSize: 13 },
    noIngredientsText: { color: c.textMuted, fontSize: 14, textAlign: "center", fontStyle: "italic", paddingVertical: 8 },
    ingredientRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.background,
      borderRadius: 14,
      padding: 10,
      marginBottom: 8,
      gap: 10,
      borderWidth: 1,
      borderColor: c.border,
    },
    ingredientThumb: { width: 46, height: 46, borderRadius: 12, backgroundColor: c.surfaceAlt },
    ingredientThumbPlaceholder: { justifyContent: "center", alignItems: "center" },
    ingredientInfo: { flex: 1 },
    ingredientName: { fontSize: 14, fontWeight: "800", color: c.textPrimary },
    ingredientMacros: { fontSize: 11.5, color: c.textSecondary, marginTop: 2, fontWeight: "600" },
    ingredientEditBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: c.accent,
      justifyContent: "center",
      alignItems: "center",
    },
    ingredientDeleteBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: DANGER_COLOR,
      justifyContent: "center",
      alignItems: "center",
    },
    modalButtons: {
      flexDirection: "row",
      gap: 12,
      paddingTop: 12,
      paddingBottom: Platform.OS === "android" ? 18 : 24,
      borderTopWidth: 1,
      borderTopColor: c.border,
      marginTop: 6,
    },
    cancelButton: {
      flex: 1,
      backgroundColor: c.surface,
      paddingVertical: 15,
      borderRadius: 16,
      alignItems: "center",
      borderWidth: 1.5,
      borderColor: c.borderStrong,
    },
    cancelBtnText: { color: c.textSecondary, fontWeight: "800", fontSize: 15 },
    saveButton: { flex: 2, backgroundColor: c.accent, paddingVertical: 15, borderRadius: 16, alignItems: "center", justifyContent: "center" },
    saveBtnText: { color: c.onAccent, fontWeight: "800", fontSize: 15 },
    passwordRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
    eyeBtn: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.borderStrong,
      alignItems: "center",
      justifyContent: "center",
    },
    passwordHint: { fontSize: 12, color: c.textMuted, marginBottom: 12, fontStyle: "italic" },
    ingredientModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center" },
    ingredientModalContent: {
      width: "92%",
      backgroundColor: c.background,
      borderRadius: 26,
      borderWidth: 1.5,
      borderColor: c.border,
      paddingHorizontal: 20,
      paddingTop: 18,
      maxHeight: "86%",
    },
    ingredientPreview: { width: "100%", height: 140, borderRadius: 14, marginBottom: 14, backgroundColor: c.surfaceAlt },
  });
