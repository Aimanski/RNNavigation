// app/admin.tsx

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";

// Gumagamit ng Open Food Facts API — LIBRE, walang API key needed!

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
  ingredients?: Ingredient[];
};

type Tab = "users" | "feedback" | "foods";

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
};

const EMPTY_USER_EDIT = {
  username: "",
  email: "",
  password: "",
};

export default function AdminScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("users");
  const [users, setUsers] = useState<User[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [foods, setFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [foodSearchQuery, setFoodSearchQuery] = useState("");

  const [foodModal, setFoodModal] = useState(false);
  const [editingFood, setEditingFood] = useState<Food | null>(null);
  const [foodForm, setFoodForm] = useState(EMPTY_FOOD);
  const [savingFood, setSavingFood] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);
  const [selectedGrams, setSelectedGrams] = useState(100);
  const [showGramDropdown, setShowGramDropdown] = useState(false);
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

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => backHandler.remove();
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchUsers(), fetchFeedback(), fetchFoods()]);
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchUsers(), fetchFeedback(), fetchFoods()]);
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
    const { data, error } = await supabase
      .from("foods")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) { Alert.alert("Error", "Failed to fetch foods"); return; }
    setFoods(data || []);
  };

  const filteredFoods = foods.filter((food) =>
    food.name.toLowerCase().includes(foodSearchQuery.toLowerCase().trim())
  );

  // ====================== AUTO-FILL NUTRITION + INGREDIENTS (Open Food Facts) ======================
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
      const query = encodeURIComponent(foodForm.name.trim());
      // Fetch more results + lc field to sort English products first
      const response = await fetch(
        `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${query}&search_simple=1&action=process&json=1&page_size=20&fields=product_name,nutriments,ingredients_text_en,ingredients_text,lc`
      );
      const data = await response.json();
      const products = data?.products || [];

      // Sort: English products (lc="en") first
      const sorted = [...products].sort((a: any, b: any) =>
        (a.lc === "en" ? 0 : 1) - (b.lc === "en" ? 0 : 1)
      );

      // Pick first English product with nutrition AND English ingredients if possible
      const product =
        sorted.find((p: any) =>
          p.nutriments &&
          p.nutriments["energy-kcal_100g"] != null &&
          p.lc === "en"
        ) ||
        sorted.find((p: any) =>
          p.nutriments && p.nutriments["energy-kcal_100g"] != null
        );

      if (!product) {
        Alert.alert(
          "Not Found",
          `Could not find "${foodForm.name}". Try a different spelling or use English (e.g. "rice", "chicken breast").`
        );
        return;
      }

      const n = product.nutriments;
      const base = {
        calories: Math.round(n["energy-kcal_100g"] ?? 0),
        protein:  Math.round((n["proteins_100g"] ?? 0) * 10) / 10,
        carbs:    Math.round((n["carbohydrates_100g"] ?? 0) * 10) / 10,
        fat:      Math.round((n["fat_100g"] ?? 0) * 10) / 10,
      };

      setBaseNutrition(base);
      setSelectedGrams(100);
      applyGrams(base, 100);

      // ---- Build auto-ingredients — English only, no calories ----
      const autoIngredients: Ingredient[] = [];

      // Words indicating origin/country — not real ingredients
      const originWords = new Set([
        "origin", "from", "made", "product", "produced", "imported",
        "africa", "america", "europe", "asia", "australia",
        "north", "south", "east", "west", "central",
        "germany", "france", "italy", "spain", "china", "india",
        "brazil", "usa", "canada", "mexico", "japan", "korea",
        "thailand", "vietnam", "netherlands", "belgium", "poland",
        "ukraine", "argentina", "chile", "colombia", "peru",
        "indonesia", "malaysia", "philippines", "ch", "eu", "uk", "us",
      ]);

      const isOriginPhrase = (text: string): boolean =>
        text.toLowerCase().split(/\s+/).some((w) => originWords.has(w));

      const isEnglish = (text: string): boolean => {
        if (/[àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿœ]/i.test(text)) return false;
        const ascii = text.replace(/[^a-zA-Z]/g, "").length;
        const total = text.replace(/\s/g, "").length;
        return total === 0 || ascii / total > 0.85;
      };

      const getNutritionalComponents = (): Ingredient[] => {
        const comps: { label: string; key: string }[] = [
          { label: "Protein",       key: "proteins_100g"      },
          { label: "Carbohydrates", key: "carbohydrates_100g" },
          { label: "Fat",           key: "fat_100g"           },
          { label: "Fiber",         key: "fiber_100g"         },
          { label: "Sugar",         key: "sugars_100g"        },
        ];
        return comps
          .filter(({ key }) => n[key] != null && n[key] > 0)
          .map(({ label, key }) => ({
            name: label,
            image_url: "",
            calories: "",
            protein:  label === "Protein"       ? String(Math.round(n[key] * 10) / 10) : "",
            carbs:    label === "Carbohydrates" || label === "Sugar" ? String(Math.round(n[key] * 10) / 10) : "",
            fat:      label === "Fat"           ? String(Math.round(n[key] * 10) / 10) : "",
          }));
      };

      const rawText: string = product.ingredients_text_en || product.ingredients_text || "";

      const parsed = rawText
        .split(/[,;]/)
        .map((s: string) =>
          s.trim()
            .replace(/\(.*?\)/g, "")
            .replace(/\[.*?\]/g, "")
            .replace(/\d+\.?\d*\s*%/g, "")
            .replace(/[^a-zA-Z\s\-]/g, "")
            .trim()
        )
        .map((s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
        .filter((s: string) =>
          s.length > 2 &&
          s.length < 40 &&
          isEnglish(s) &&
          !isOriginPhrase(s)
        );

      if (parsed.length >= 2) {
        parsed.slice(0, 6).forEach((name: string) => {
          autoIngredients.push({ name, image_url: "", calories: "", protein: "", carbs: "", fat: "" });
        });
      } else {
        // Fallback to nutritional components
        getNutritionalComponents().forEach((ing) => autoIngredients.push(ing));
      }

      setIngredients(autoIngredients);
      Alert.alert(
        "\u2705 Done!",
        `Nutrition and ${autoIngredients.length} ingredients auto-filled for "${foodForm.name}"!`
      );
    } catch (err: any) {
      Alert.alert("Error", "Could not auto-fill. Please check your internet connection.");
    } finally {
      setAutoFilling(false);
    }
  };
  // ========================================================================================

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
          if (error) { Alert.alert("Error", "Failed to delete user: " + error.message); return; }
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
    setShowGramDropdown(false);
    setFoodModal(true);
  };

  const openEditFood = (food: Food) => {
    setEditingFood(food);
    setFoodForm({
      name: food.name,
      calories: food.calories.toString(),
      protein: food.protein.toString(),
      carbs: food.carbs.toString(),
      fat: food.fat.toString(),
      meal_type: food.meal_type,
      image_url: food.image_url || "",
    });
    setIngredients(food.ingredients ? food.ingredients : []);
    setBaseNutrition(null);
    setSelectedGrams(100);
    setShowGramDropdown(false);
    setFoodModal(true);
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

  const handleDeleteFood = (food: Food) => {
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
  };

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

      const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhla25vZmRydWlzZWVhaWliZWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NDU2NjMsImV4cCI6MjA5MDUyMTY2M30.A-4A_RXvrRwed_NevanowKdWjjOTctw6ggwkEhHEPBs";
      const edgeBody: Record<string, string> = { user_id: editingUser!.id, email: userEditForm.email.trim() };
      if (userEditForm.password.trim().length >= 6) edgeBody.password = userEditForm.password.trim();

      const edgeRes = await fetch("https://xeknofdruiseeaiibeep.supabase.co/functions/v1/admin-update-user", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${ANON_KEY}`, "apikey": ANON_KEY },
        body: JSON.stringify(edgeBody),
      });
      const edgeData = await edgeRes.json();
      if (!edgeRes.ok) throw new Error("Auth update failed: " + (edgeData?.error || edgeRes.status));

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

  const renderStars = (rating: number) => "★".repeat(rating) + "☆".repeat(5 - rating);
  const mealTypeLabel: Record<string, string> = { all: "All Meals", breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };

  if (loading) {
    return (
      <SafeAreaView style={s.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={s.loadingText}>Loading admin panel...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safeArea}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Admin Panel</Text>
          <Text style={s.headerSub}>Manage users, feedback & foods</Text>
        </View>
        <Pressable style={s.logoutBtn} onPress={handleLogout}>
          <Text style={s.logoutText}>Logout</Text>
        </Pressable>
      </View>

      {/* Stats */}
      <View style={s.statsRow}>
        <View style={s.statCard}><Text style={s.statNumber}>{users.length}</Text><Text style={s.statLabel}>Total Users</Text></View>
        <View style={s.statCard}><Text style={s.statNumber}>{users.filter((u) => u.admin).length}</Text><Text style={s.statLabel}>Admins</Text></View>
        <View style={s.statCard}><Text style={s.statNumber}>{feedback.length}</Text><Text style={s.statLabel}>Feedbacks</Text></View>
        <View style={s.statCard}><Text style={s.statNumber}>{foods.length}</Text><Text style={s.statLabel}>Foods</Text></View>
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {(["users", "feedback", "foods"] as Tab[]).map((tab) => (
          <Pressable key={tab} style={[s.tab, activeTab === tab && s.activeTab]} onPress={() => setActiveTab(tab)}>
            <Text style={[s.tabText, activeTab === tab && s.activeTabText]}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</Text>
          </Pressable>
        ))}
      </View>

      {/* Content */}
      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" />}>

        {/* USERS */}
        {activeTab === "users" && (
          users.length === 0 ? <Text style={s.emptyText}>No users found.</Text> :
          users.map((user) => (
            <View key={user.id} style={s.card}>
              <View style={s.cardTop}>
                <View style={s.avatarCircle}><Text style={s.avatarText}>{user.username?.charAt(0).toUpperCase() || "?"}</Text></View>
                <View style={s.cardInfo}>
                  <View style={s.nameRow}>
                    <Text style={s.cardName}>{user.username}</Text>
                    {user.admin && <View style={s.adminBadge}><Text style={s.adminBadgeText}>ADMIN</Text></View>}
                  </View>
                  <Text style={s.cardEmail}>{user.email}</Text>
                  <Text style={s.cardDate}>Joined {formatDate(user.created_at)}</Text>
                </View>
              </View>
              <View style={s.cardActions}>
                <Pressable style={[s.actionBtn, s.editBtn]} onPress={() => openEditUser(user)}><Text style={s.editBtnText}>Edit</Text></Pressable>
                <Pressable style={[s.actionBtn, s.toggleBtn]} onPress={() => handleToggleAdmin(user)}><Text style={s.toggleBtnText}>{user.admin ? "Remove Admin" : "Make Admin"}</Text></Pressable>
                <Pressable style={[s.actionBtn, s.deleteBtn]} onPress={() => handleDeleteUser(user)}><Text style={s.deleteBtnText}>Delete</Text></Pressable>
              </View>
            </View>
          ))
        )}

        {/* FEEDBACK */}
        {activeTab === "feedback" && (
          feedback.length === 0 ? <Text style={s.emptyText}>No feedback yet.</Text> :
          feedback.map((fb) => (
            <View key={fb.id} style={s.card}>
              <View style={s.feedbackTop}>
                <Text style={s.stars}>{renderStars(fb.rating)}</Text>
                <Text style={s.feedbackDate}>{formatDate(fb.created_at)}</Text>
              </View>
              {fb.message ? <Text style={s.feedbackMessage}>{fb.message}</Text> : <Text style={s.feedbackNoMessage}>No message provided.</Text>}
              <Pressable style={[s.actionBtn, s.deleteBtn, { marginTop: 12, alignSelf: "flex-end" }]} onPress={() => handleDeleteFeedback(fb.id)}>
                <Text style={s.deleteBtnText}>Delete</Text>
              </Pressable>
            </View>
          ))
        )}

        {/* FOODS */}
        {activeTab === "foods" && (
          <>
            <View style={s.searchContainer}>
              <View style={s.searchBar}>
                <Ionicons name="search" size={20} color="#10b981" style={{ marginRight: 10 }} />
                <TextInput style={s.searchInput} placeholder="Search foods..." placeholderTextColor="#94a3b8" value={foodSearchQuery} onChangeText={setFoodSearchQuery} />
              </View>
            </View>
            <Pressable style={s.addFoodBtn} onPress={openAddFood}><Text style={s.addFoodBtnText}>+ Add New Food</Text></Pressable>
            {filteredFoods.length === 0 ? <Text style={s.emptyText}>No foods found.</Text> : (
              filteredFoods.map((food) => (
                <View key={food.id} style={s.card}>
                  <View style={s.foodCardTop}>
                    <View style={s.foodInfo}>
                      <Text style={s.foodName}>{food.name}</Text>
                      <View style={s.mealTypeBadge}><Text style={s.mealTypeBadgeText}>{mealTypeLabel[food.meal_type] || food.meal_type}</Text></View>
                    </View>
                    <Text style={s.foodCalories}>{food.calories} kcal</Text>
                  </View>
                  <View style={s.foodMacros}>
                    <Text style={s.foodMacroText}>P: {food.protein}g</Text>
                    <Text style={s.foodMacroText}>C: {food.carbs}g</Text>
                    <Text style={s.foodMacroText}>F: {food.fat}g</Text>
                  </View>
                  {food.ingredients && food.ingredients.length > 0 && (
                    <Text style={s.ingredientCount}>🥄 {food.ingredients.length} ingredient{food.ingredients.length > 1 ? "s" : ""}</Text>
                  )}
                  <View style={s.cardActions}>
                    <Pressable style={[s.actionBtn, s.toggleBtn]} onPress={() => openEditFood(food)}><Text style={s.toggleBtnText}>Edit</Text></Pressable>
                    <Pressable style={[s.actionBtn, s.deleteBtn]} onPress={() => handleDeleteFood(food)}><Text style={s.deleteBtnText}>Delete</Text></Pressable>
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* ====================== MODALS ====================== */}

      {/* Edit User Modal */}
      <Modal visible={userEditModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Edit User</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.fieldLabel}>Username</Text>
              <TextInput style={s.input} placeholder="Username *" placeholderTextColor="#94a3b8" value={userEditForm.username} onChangeText={(v) => setUserEditForm((p) => ({ ...p, username: v }))} autoCapitalize="none" />
              <Text style={s.fieldLabel}>Email</Text>
              <TextInput style={s.input} placeholder="Email *" placeholderTextColor="#94a3b8" value={userEditForm.email} onChangeText={(v) => setUserEditForm((p) => ({ ...p, email: v }))} keyboardType="email-address" autoCapitalize="none" />
              <Text style={s.fieldLabel}>New Password</Text>
              <View style={s.passwordRow}>
                <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} placeholder="Leave blank to keep current" placeholderTextColor="#94a3b8" value={userEditForm.password} onChangeText={(v) => setUserEditForm((p) => ({ ...p, password: v }))} secureTextEntry={!showPassword} autoCapitalize="none" />
                <Pressable style={s.eyeBtn} onPress={() => setShowPassword((p) => !p)}><Text style={s.eyeBtnText}>{showPassword ? "Hide" : "Show"}</Text></Pressable>
              </View>
              <Text style={s.passwordHint}>Min 6 characters. Leave blank to keep the current password.</Text>
              <View style={[s.modalButtons, { marginTop: 20 }]}>
                <Pressable style={s.cancelButton} onPress={() => { setUserEditModal(false); setEditingUser(null); }}><Text style={s.cancelBtnText}>Cancel</Text></Pressable>
                <Pressable style={s.saveButton} onPress={handleSaveUser} disabled={savingUser}>
                  {savingUser ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Save Changes</Text>}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add/Edit Food Modal */}
      <Modal visible={foodModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>{editingFood ? "Edit Food" : "Add New Food"}</Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* Food Name + Gram Dropdown */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <TextInput
                  style={[s.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="Food name *"
                  value={foodForm.name}
                  onChangeText={(v) => setFoodForm((p) => ({ ...p, name: v }))}
                />
                <View>
                  <Pressable style={s.gramBtn} onPress={() => setShowGramDropdown((p) => !p)}>
                    <Text style={s.gramBtnText}>{selectedGrams}g</Text>
                    <Ionicons name={showGramDropdown ? "chevron-up" : "chevron-down"} size={14} color="#059669" />
                  </Pressable>
                  {showGramDropdown && (
                    <View style={s.gramDropdown}>
                      {[25, 50, 75, 100, 125, 150, 175, 200].map((g) => (
                        <Pressable
                          key={g}
                          style={[s.gramOption, selectedGrams === g && s.gramOptionActive]}
                          onPress={() => {
                            setSelectedGrams(g);
                            setShowGramDropdown(false);
                            if (baseNutrition) applyGrams(baseNutrition, g);
                          }}
                        >
                          <Text style={[s.gramOptionText, selectedGrams === g && s.gramOptionTextActive]}>{g}g</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              </View>

              {/* 🤖 Auto-fill Nutrition & Ingredients Button */}
              <Pressable style={[s.autoFillBtn, autoFilling && { opacity: 0.7 }]} onPress={autoFillNutrition} disabled={autoFilling}>
                {autoFilling
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.autoFillBtnText}>🤖 Auto-fill Nutrition & Ingredients</Text>
                }
              </Pressable>

              <TextInput style={s.input} placeholder="Calories *" value={foodForm.calories} onChangeText={(v) => setFoodForm((p) => ({ ...p, calories: v }))} keyboardType="numeric" />
              <TextInput style={s.input} placeholder="Protein (g)" value={foodForm.protein} onChangeText={(v) => setFoodForm((p) => ({ ...p, protein: v }))} keyboardType="numeric" />
              <TextInput style={s.input} placeholder="Carbs (g)" value={foodForm.carbs} onChangeText={(v) => setFoodForm((p) => ({ ...p, carbs: v }))} keyboardType="numeric" />
              <TextInput style={s.input} placeholder="Fat (g)" value={foodForm.fat} onChangeText={(v) => setFoodForm((p) => ({ ...p, fat: v }))} keyboardType="numeric" />
              <TextInput style={s.input} placeholder="Food Image URL (optional)" value={foodForm.image_url} onChangeText={(v) => setFoodForm((p) => ({ ...p, image_url: v }))} autoCapitalize="none" />

              <Text style={s.selectorLabel}>Meal Type</Text>
              <View style={s.mealTypeRow}>
                {["all", "breakfast", "lunch", "dinner"].map((type) => (
                  <Pressable key={type} style={[s.mealTypeBtn, foodForm.meal_type === type && s.mealTypeBtnActive]} onPress={() => setFoodForm((p) => ({ ...p, meal_type: type }))}>
                    <Text style={[s.mealTypeBtnText, foodForm.meal_type === type && s.mealTypeBtnTextActive]}>{type.charAt(0).toUpperCase() + type.slice(1)}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Ingredients */}
              <View style={s.ingredientSection}>
                <View style={s.ingredientHeader}>
                  <Text style={s.selectorLabel}>Ingredients ({ingredients.length})</Text>
                  <Pressable style={s.addIngredientBtn} onPress={openAddIngredient}>
                    <Ionicons name="add-circle" size={20} color="#10b981" />
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
                        : <View style={[s.ingredientThumb, s.ingredientThumbPlaceholder]}><Ionicons name="leaf" size={18} color="#10b981" /></View>
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
                      <Pressable style={s.ingredientEditBtn} onPress={() => openEditIngredient(index)}><Ionicons name="pencil" size={16} color="#2563eb" /></Pressable>
                      <Pressable style={s.ingredientDeleteBtn} onPress={() => removeIngredient(index)}><Ionicons name="trash" size={16} color="#dc2626" /></Pressable>
                    </View>
                  ))
                )}
              </View>

              <View style={s.modalButtons}>
                <Pressable style={s.cancelButton} onPress={() => { setFoodModal(false); setEditingFood(null); setIngredients([]); }}><Text style={s.cancelBtnText}>Cancel</Text></Pressable>
                <Pressable style={s.saveButton} onPress={handleSaveFood} disabled={savingFood}>
                  {savingFood ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>{editingFood ? "Save Changes" : "Add Food"}</Text>}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add/Edit Ingredient Modal */}
      <Modal visible={ingredientModal} transparent animationType="fade">
        <View style={s.ingredientModalOverlay}>
          <View style={s.ingredientModalContent}>
            <Text style={s.modalTitle}>{editingIngredientIndex !== null ? "Edit Ingredient" : "Add Ingredient"}</Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <TextInput style={s.input} placeholder="Ingredient name *" value={ingredientForm.name} onChangeText={(v) => setIngredientForm((p) => ({ ...p, name: v }))} />
              <TextInput style={s.input} placeholder="Ingredient image URL (optional)" value={ingredientForm.image_url} onChangeText={(v) => setIngredientForm((p) => ({ ...p, image_url: v }))} autoCapitalize="none" />
              {ingredientForm.image_url ? <Image source={{ uri: ingredientForm.image_url }} style={s.ingredientPreview} resizeMode="cover" /> : null}
              <TextInput style={s.input} placeholder="Calories (optional)" value={ingredientForm.calories} onChangeText={(v) => setIngredientForm((p) => ({ ...p, calories: v }))} keyboardType="numeric" />
              <TextInput style={s.input} placeholder="Protein (g) (optional)" value={ingredientForm.protein} onChangeText={(v) => setIngredientForm((p) => ({ ...p, protein: v }))} keyboardType="numeric" />
              <TextInput style={s.input} placeholder="Carbs (g) (optional)" value={ingredientForm.carbs} onChangeText={(v) => setIngredientForm((p) => ({ ...p, carbs: v }))} keyboardType="numeric" />
              <TextInput style={s.input} placeholder="Fat (g) (optional)" value={ingredientForm.fat} onChangeText={(v) => setIngredientForm((p) => ({ ...p, fat: v }))} keyboardType="numeric" />
              <View style={s.modalButtons}>
                <Pressable style={s.cancelButton} onPress={() => setIngredientModal(false)}><Text style={s.cancelBtnText}>Cancel</Text></Pressable>
                <Pressable style={s.saveButton} onPress={saveIngredient}><Text style={s.saveBtnText}>{editingIngredientIndex !== null ? "Save" : "Add"}</Text></Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fff9" },
  loadingContainer: { flex: 1, backgroundColor: "#f8fff9", justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 16, color: "#059669", fontSize: 16, fontWeight: "600" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, paddingTop: Platform.OS === "android" ? 20 : 10, paddingBottom: 16 },
  headerTitle: { fontSize: 26, fontWeight: "900", color: "#065f46" },
  headerSub: { fontSize: 13, color: "#059669", fontWeight: "500", marginTop: 2 },
  logoutBtn: { backgroundColor: "#fee2e2", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, borderColor: "#fca5a5" },
  logoutText: { color: "#dc2626", fontWeight: "800", fontSize: 14 },
  statsRow: { flexDirection: "row", paddingHorizontal: 24, gap: 8, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: "#ffffff", borderRadius: 20, paddingVertical: 16, alignItems: "center", shadowColor: "#10b981", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 6, borderWidth: 1.5, borderColor: "#d1fae5" },
  statNumber: { fontSize: 24, fontWeight: "900", color: "#065f46" },
  statLabel: { fontSize: 11, color: "#059669", fontWeight: "600", marginTop: 4 },
  tabRow: { flexDirection: "row", marginHorizontal: 24, backgroundColor: "#e8f5e9", borderRadius: 16, padding: 4, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 13 },
  activeTab: { backgroundColor: "#10b981" },
  tabText: { fontSize: 13, fontWeight: "700", color: "#059669" },
  activeTabText: { color: "#ffffff" },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },
  emptyText: { textAlign: "center", color: "#94a3b8", fontSize: 16, marginTop: 60, fontWeight: "500" },
  searchContainer: { marginBottom: 16 },
  searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: "#f0fdf4", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1.5, borderColor: "#86efac" },
  searchInput: { flex: 1, fontSize: 16, color: "#065f46", fontWeight: "500" },
  card: { backgroundColor: "#ffffff", borderRadius: 24, padding: 20, marginBottom: 16, shadowColor: "#10b981", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 8, borderWidth: 1.5, borderColor: "#d1fae5" },
  cardTop: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  avatarCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#10b981", justifyContent: "center", alignItems: "center", marginRight: 14 },
  avatarText: { color: "#fff", fontSize: 20, fontWeight: "900" },
  cardInfo: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 },
  cardName: { fontSize: 17, fontWeight: "800", color: "#065f46" },
  adminBadge: { backgroundColor: "#fef08a", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: "#fde047" },
  adminBadgeText: { fontSize: 10, fontWeight: "900", color: "#854d0e" },
  cardEmail: { fontSize: 13, color: "#64748b", marginBottom: 2 },
  cardDate: { fontSize: 12, color: "#94a3b8", fontWeight: "500" },
  cardActions: { flexDirection: "row", gap: 10 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: "center" },
  editBtn: { backgroundColor: "#eff6ff", borderWidth: 1.5, borderColor: "#93c5fd" },
  editBtnText: { color: "#2563eb", fontWeight: "800", fontSize: 13 },
  toggleBtn: { backgroundColor: "#ecfdf5", borderWidth: 1.5, borderColor: "#86efac" },
  toggleBtnText: { color: "#059669", fontWeight: "800", fontSize: 13 },
  deleteBtn: { backgroundColor: "#fee2e2", borderWidth: 1.5, borderColor: "#fca5a5" },
  deleteBtnText: { color: "#dc2626", fontWeight: "800", fontSize: 13 },
  foodCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  foodInfo: { flex: 1, marginRight: 12 },
  foodName: { fontSize: 16, fontWeight: "800", color: "#065f46", marginBottom: 6 },
  mealTypeBadge: { backgroundColor: "#ecfdf5", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, alignSelf: "flex-start", borderWidth: 1, borderColor: "#86efac" },
  mealTypeBadgeText: { fontSize: 11, fontWeight: "700", color: "#059669" },
  foodCalories: { fontSize: 18, fontWeight: "900", color: "#10b981" },
  foodMacros: { flexDirection: "row", gap: 16, marginBottom: 8 },
  foodMacroText: { fontSize: 13, color: "#64748b", fontWeight: "600" },
  ingredientCount: { fontSize: 13, color: "#059669", fontWeight: "600", marginBottom: 12 },
  addFoodBtn: { backgroundColor: "#10b981", paddingVertical: 16, borderRadius: 20, alignItems: "center", marginBottom: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 8 },
  addFoodBtnText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  autoFillBtn: { backgroundColor: "#7c3aed", paddingVertical: 14, borderRadius: 16, alignItems: "center", marginBottom: 14, shadowColor: "#7c3aed", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  autoFillBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  feedbackTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  stars: { fontSize: 18, color: "#f59e0b", letterSpacing: 2 },
  feedbackDate: { fontSize: 12, color: "#94a3b8", fontWeight: "500" },
  feedbackMessage: { fontSize: 15, color: "#374151", lineHeight: 22, fontWeight: "500" },
  feedbackNoMessage: { fontSize: 14, color: "#94a3b8", fontStyle: "italic" },
  ingredientSection: { backgroundColor: "#f0fdf4", borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1.5, borderColor: "#86efac" },
  ingredientHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  addIngredientBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#ecfdf5", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1.5, borderColor: "#86efac" },
  addIngredientBtnText: { color: "#10b981", fontWeight: "800", fontSize: 13 },
  noIngredientsText: { color: "#94a3b8", fontSize: 14, textAlign: "center", fontStyle: "italic", paddingVertical: 8 },
  ingredientRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, padding: 10, marginBottom: 8, gap: 10, borderWidth: 1, borderColor: "#d1fae5" },
  ingredientThumb: { width: 48, height: 48, borderRadius: 10, backgroundColor: "#ecfdf5" },
  ingredientThumbPlaceholder: { justifyContent: "center", alignItems: "center" },
  ingredientInfo: { flex: 1 },
  ingredientName: { fontSize: 14, fontWeight: "700", color: "#065f46" },
  ingredientMacros: { fontSize: 11, color: "#64748b", marginTop: 2 },
  ingredientEditBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: "#eff6ff", justifyContent: "center", alignItems: "center" },
  ingredientDeleteBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: "#fee2e2", justifyContent: "center", alignItems: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#fff", borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 28, maxHeight: "92%" },
  modalTitle: { fontSize: 22, fontWeight: "900", color: "#065f46", textAlign: "center", marginBottom: 20 },
  input: { backgroundColor: "#f0fdf4", borderWidth: 2, borderColor: "#86efac", borderRadius: 16, padding: 16, fontSize: 16, color: "#065f46", marginBottom: 14 },
  selectorLabel: { fontSize: 15, fontWeight: "700", color: "#065f46", marginBottom: 10 },
  mealTypeRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  mealTypeBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center", backgroundColor: "#f0fdf4", borderWidth: 1.5, borderColor: "#86efac" },
  mealTypeBtnActive: { backgroundColor: "#10b981", borderColor: "#10b981" },
  mealTypeBtnText: { fontSize: 12, fontWeight: "700", color: "#059669" },
  mealTypeBtnTextActive: { color: "#fff" },
  modalButtons: { flexDirection: "row", gap: 12, marginTop: 8, marginBottom: 20 },
  cancelButton: { flex: 1, backgroundColor: "#f1f5f9", paddingVertical: 16, borderRadius: 16, alignItems: "center" },
  cancelBtnText: { color: "#64748b", fontWeight: "800", fontSize: 15 },
  saveButton: { flex: 2, backgroundColor: "#10b981", paddingVertical: 16, borderRadius: 16, alignItems: "center" },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  passwordRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  eyeBtn: { backgroundColor: "#ecfdf5", borderWidth: 1.5, borderColor: "#86efac", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 16 },
  eyeBtnText: { color: "#059669", fontWeight: "700", fontSize: 13 },
  passwordHint: { fontSize: 12, color: "#94a3b8", marginBottom: 8, fontStyle: "italic" },
  ingredientModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center" },
  ingredientModalContent: { width: "90%", backgroundColor: "#fff", borderRadius: 28, padding: 24, maxHeight: "80%" },
  ingredientPreview: { width: "100%", height: 140, borderRadius: 14, marginBottom: 14, backgroundColor: "#ecfdf5" },
  fieldLabel: { fontSize: 13, fontWeight: "700", color: "#065f46", marginBottom: 6, marginTop: 4 },
  gramBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#f0fdf4", borderWidth: 2, borderColor: "#86efac", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 16 },
  gramBtnText: { fontSize: 14, fontWeight: "800", color: "#059669" },
  gramDropdown: { position: "absolute", top: 54, right: 0, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1.5, borderColor: "#86efac", zIndex: 999, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 10, minWidth: 80, overflow: "hidden" },
  gramOption: { paddingVertical: 10, paddingHorizontal: 16, alignItems: "center" },
  gramOptionActive: { backgroundColor: "#10b981" },
  gramOptionText: { fontSize: 14, fontWeight: "700", color: "#065f46" },
  gramOptionTextActive: { color: "#fff" },
});