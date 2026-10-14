// Scanner

import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Text, TextInput } from "../components/ui/AppText";
import { SafeAreaView } from "react-native-safe-area-context";
import KeyboardSafeView from "../components/layout/KeyboardSafeView";
import { lookupBarcodeProduct, looksLikeBarcode } from "../lib/health/openFoodFacts";
import { goBackOr } from "../lib/navigation";
import { supabase } from "../lib/supabase";
import { getSessionUser } from "../lib/auth/session";
import { useTheme } from "../providers/ThemeProvider";

type ScanMode = "barcode" | "photo";

type ScannedResult = {
  source: ScanMode;
  name: string;
  imageUrl: string | null; // Types
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  defaultGrams: number;
  confidenceNote?: string;
};

export default function ScanFoodScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [mode, setMode] = useState<ScanMode>("barcode");
  const [analyzing, setAnalyzing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [scannedResult, setScannedResult] = useState<ScannedResult | null>(null);
  const [localPreviewUri, setLocalPreviewUri] = useState<string | null>(null);
  const [grams, setGrams] = useState("100");
  const barcodeHandledRef = useRef(false);

  // Auth
  useEffect(() => {
    (async () => {
      const user = await getSessionUser();
      if (!user) router.replace("/");
    })();
  }, [router]);

  const resetScan = () => {
    setScannedResult(null);
    setLocalPreviewUri(null);
    setGrams("100");
    barcodeHandledRef.current = false;
  };

  const switchMode = (next: ScanMode) => {
    if (next === mode) return;
    resetScan();
    setMode(next);
  };

  // Barcode
  const handleBarcodeScanned = async (result: { data: string }) => {
    if (barcodeHandledRef.current || analyzing || scannedResult) return;

    const value = result.data.trim();
    if (!looksLikeBarcode(value)) {
      barcodeHandledRef.current = true;
      Alert.alert(
        "Not a Food Barcode",
        "That code doesn't look like a food product barcode. Please scan a food item's barcode, or switch to Food Photo mode.",
        [{ text: "OK", onPress: () => { barcodeHandledRef.current = false; } }]
      );
      return;
    }

    barcodeHandledRef.current = true;
    setAnalyzing(true);
    try {
      const product = await lookupBarcodeProduct(value);
      if (!product) {
        Alert.alert(
          "Not Found",
          "This product isn't in the food database yet. Try Food Photo mode instead, or scan a different item.",
          [{ text: "OK", onPress: () => { barcodeHandledRef.current = false; } }]
        );
        return;
      }

      setScannedResult({
        source: "barcode",
        name: product.name,
        imageUrl: product.imageUrl,
        caloriesPer100g: product.caloriesPer100g,
        proteinPer100g: product.proteinPer100g,
        carbsPer100g: product.carbsPer100g,
        fatPer100g: product.fatPer100g,
        defaultGrams: 100,
      });
      setGrams("100");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Couldn't look up that barcode.", [
        { text: "OK", onPress: () => { barcodeHandledRef.current = false; } },
      ]);
    } finally {
      setAnalyzing(false);
    }
  };

  // Photo
  const handleTakePhoto = async () => {
    if (analyzing || !cameraRef.current) return;
    setAnalyzing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5 });
      if (!photo?.base64) throw new Error("Couldn't capture a photo. Please try again.");

      const { data, error } = await supabase.functions.invoke("analyze-food-photo", {
        body: { image: photo.base64 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const result = data?.result;
      if (!result) throw new Error("No analysis was returned.");

      if (!result.isFood) {
        Alert.alert(
          "That Doesn't Look Like Food",
          result.reason || "Please point the camera at a food item and try again."
        );
        return;
      }

      const estimatedGrams = result.estimatedGrams > 0 ? Math.round(result.estimatedGrams) : 100;
      const scale = 100 / estimatedGrams;

      setLocalPreviewUri(photo.uri);
      setScannedResult({
        source: "photo",
        name: result.name || "Scanned food",
        imageUrl: null, // Photo
        caloriesPer100g: Math.round((result.calories || 0) * scale),
        proteinPer100g: Math.round((result.protein || 0) * scale * 10) / 10,
        carbsPer100g: Math.round((result.carbs || 0) * scale * 10) / 10,
        fatPer100g: Math.round((result.fat || 0) * scale * 10) / 10,
        defaultGrams: estimatedGrams,
        confidenceNote: `AI estimate (${result.confidence || "medium"} confidence)${
          result.reason ? `: ${result.reason}` : ""
        }`,
      });
      setGrams(String(estimatedGrams));
    } catch (e: any) {
      Alert.alert("Scan Failed", e.message || "Couldn't analyze that photo. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  // Logging
  const addToToday = async () => {
    if (!scannedResult) return;
    setAdding(true);
    try {
      const user = await getSessionUser();
      if (!user) {
        router.replace("/");
        return;
      }

      const gramsNum = parseFloat(grams);
      const ratio = (isNaN(gramsNum) || gramsNum <= 0 ? scannedResult.defaultGrams : gramsNum) / 100;

      const calories = Math.round(scannedResult.caloriesPer100g * ratio);
      const protein = Math.round(scannedResult.proteinPer100g * ratio * 10) / 10;
      const carbs = Math.round(scannedResult.carbsPer100g * ratio * 10) / 10;
      const fat = Math.round(scannedResult.fatPer100g * ratio * 10) / 10;

      // Ownership
      const { data: existing } = await supabase
        .from("foods")
        .select("id, name")
        .eq("user_id", user.id)
        .eq("name", scannedResult.name)
        .eq("calories", calories)
        .eq("protein", protein)
        .eq("carbs", carbs)
        .eq("fat", fat)
        .limit(1);

      let newFood: { id: string; name: string } | undefined = existing?.[0];
      if (!newFood) {
        const { data: inserted, error: foodError } = await supabase
          .from("foods")
          .insert({
            user_id: user.id,
            name: scannedResult.name,
            calories,
            protein,
            carbs,
            fat,
            meal_type: "all",
            image_url: scannedResult.imageUrl || "",
          })
          .select()
          .single();
        if (foodError) throw foodError;
        newFood = inserted as { id: string; name: string };
      }

      const { error: logError } = await supabase.from("selected_foods").insert({
        user_id: user.id,
        food_id: newFood.id,
        food_name: newFood.name,
        calories,
        protein,
        carbs,
        fat,
        quantity: 1,
      });
      if (logError) throw logError;

      Alert.alert("Added!", `${scannedResult.name} was added to your daily log.`, [
        { text: "OK", onPress: () => goBackOr(router, "/mealplan") },
      ]);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to add this food.");
    } finally {
      setAdding(false);
    }
  };

  // Permission
  if (!permission) {
    return (
      <View style={[s.container, s.centered]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[s.container, s.centered]}>
        <Ionicons name="camera-outline" size={64} color={colors.accent} />
        <Text style={s.permissionTitle}>Camera Access Needed</Text>
        <Text style={s.permissionText}>
          WeighApp needs your camera to scan food, barcodes, and QR codes.
        </Text>
        {permission.canAskAgain ? (
          <Pressable style={s.permissionBtn} onPress={requestPermission}>
            <Text style={s.permissionBtnText}>Grant Camera Access</Text>
          </Pressable>
        ) : (
          <Text style={s.permissionText}>
            Camera access was denied. Please enable it for WeighApp in your device Settings.
          </Text>
        )}
      </SafeAreaView>
    );
  }

  // Preview
  const gramsNum = parseFloat(grams);
  const ratio = (isNaN(gramsNum) || gramsNum <= 0 ? scannedResult?.defaultGrams ?? 100 : gramsNum) / 100;
  const liveCalories = scannedResult ? Math.round(scannedResult.caloriesPer100g * ratio) : 0;
  const liveProtein = scannedResult ? Math.round(scannedResult.proteinPer100g * ratio * 10) / 10 : 0;
  const liveCarbs = scannedResult ? Math.round(scannedResult.carbsPer100g * ratio * 10) / 10 : 0;
  const liveFat = scannedResult ? Math.round(scannedResult.fatPer100g * ratio * 10) / 10 : 0;

  return (
    <View style={s.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ["qr", "ean13", "ean8", "upc_a", "upc_e", "code128", "code39"],
        }}
        onBarcodeScanned={
          mode === "barcode" && !scannedResult && !analyzing ? handleBarcodeScanned : undefined
        }
      />

      <KeyboardSafeView style={{ flex: 1 }} pointerEvents="box-none">
      <SafeAreaView style={s.overlay} pointerEvents="box-none">
        {/* Header */}
        <View style={s.topBar} pointerEvents="box-none">
          <View style={s.iconBtnSpacer} />

          <View style={s.modeToggle}>
            <Pressable
              style={[s.modeBtn, mode === "barcode" && s.modeBtnActive]}
              onPress={() => switchMode("barcode")}
            >
              <Text style={[s.modeBtnText, mode === "barcode" && s.modeBtnTextActive]}>
                Barcode/QR
              </Text>
            </Pressable>
            <Pressable
              style={[s.modeBtn, mode === "photo" && s.modeBtnActive]}
              onPress={() => switchMode("photo")}
            >
              <Text style={[s.modeBtnText, mode === "photo" && s.modeBtnTextActive]}>
                Food Photo
              </Text>
            </Pressable>
          </View>

          <View style={s.iconBtnSpacer} />
        </View>

        {!scannedResult && !analyzing && (
          <View style={s.hintWrap} pointerEvents="none">
            <View style={s.scanFrame} />
            <Text style={s.hintText}>
              {mode === "barcode"
                ? "Point the camera at a food's barcode or QR code"
                : "Frame the food, then tap the capture button"}
            </Text>
          </View>
        )}

        {analyzing && (
          <View style={s.analyzingWrap} pointerEvents="none">
            <ActivityIndicator size="large" color="#fff" />
            <Text style={s.analyzingText}>
              {mode === "barcode" ? "Looking up product…" : "Analyzing food…"}
            </Text>
          </View>
        )}

        {/* Capture */}
        {mode === "photo" && !scannedResult && (
          <View style={s.captureRow} pointerEvents="box-none">
            <Pressable
              style={[s.captureBtn, analyzing && s.captureBtnDisabled]}
              onPress={handleTakePhoto}
              disabled={analyzing}
            >
              <View style={s.captureBtnInner} />
            </Pressable>
          </View>
        )}

        {/* Review */}
        {scannedResult && (
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={s.reviewCard}>
              <View style={s.reviewRow}>
                {localPreviewUri ? (
                  <Image source={{ uri: localPreviewUri }} style={s.reviewImage} />
                ) : scannedResult.imageUrl ? (
                  <Image source={{ uri: scannedResult.imageUrl }} style={s.reviewImage} />
                ) : (
                  <View style={[s.reviewImage, s.reviewImagePlaceholder]}>
                    <Ionicons name="restaurant" size={28} color={colors.accent} />
                  </View>
                )}
                <View style={s.reviewNameWrap}>
                  <Text style={s.reviewName} numberOfLines={2}>
                    {scannedResult.name}
                  </Text>
                  {scannedResult.confidenceNote && (
                    <Text style={s.confidenceNote} numberOfLines={2}>
                      {scannedResult.confidenceNote}
                    </Text>
                  )}
                </View>
              </View>

              <View style={s.gramsRow}>
                <Text style={s.gramsLabel}>Amount</Text>
                <TextInput
                  style={s.gramsInput}
                  value={grams}
                  onChangeText={(t) => setGrams(t.replace(/[^0-9.]/g, ""))}
                  keyboardType="number-pad"
                />
                <Text style={s.gramsLabel}>grams</Text>
              </View>

              <View style={s.macroRow}>
                <View style={s.macroBox}>
                  <Text style={s.macroVal}>{liveCalories}</Text>
                  <Text style={s.macroLab}>kcal</Text>
                </View>
                <View style={s.macroBox}>
                  <Text style={s.macroVal}>{liveProtein}g</Text>
                  <Text style={s.macroLab}>Protein</Text>
                </View>
                <View style={s.macroBox}>
                  <Text style={s.macroVal}>{liveCarbs}g</Text>
                  <Text style={s.macroLab}>Carbs</Text>
                </View>
                <View style={s.macroBox}>
                  <Text style={s.macroVal}>{liveFat}g</Text>
                  <Text style={s.macroLab}>Fat</Text>
                </View>
              </View>

              <View style={s.reviewBtnRow}>
                <Pressable style={s.retakeBtn} onPress={resetScan} disabled={adding}>
                  <Text style={s.retakeBtnText}>Scan Again</Text>
                </Pressable>
                <Pressable
                  style={[s.addBtn, adding && s.captureBtnDisabled]}
                  onPress={addToToday}
                  disabled={adding}
                >
                  {adding ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={s.addBtnText}>Add to Today</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </TouchableWithoutFeedback>
        )}
      </SafeAreaView>
      </KeyboardSafeView>
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>["colors"]) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: "#000000" },
    centered: { justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
    overlay: { flex: 1, justifyContent: "space-between" },

    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: Platform.OS === "android" ? 12 : 0,
    },
    iconBtn: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center", alignItems: "center",
    },
    iconBtnSpacer: { width: 40 },
    modeToggle: {
      flexDirection: "row",
      backgroundColor: "rgba(0,0,0,0.5)",
      borderRadius: 16,
      padding: 4,
    },
    modeBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12 },
    modeBtnActive: { backgroundColor: c.accent },
    modeBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
    modeBtnTextActive: { color: c.onAccent },

    hintWrap: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 40 },
    scanFrame: {
      width: 240, height: 240,
      borderRadius: 24,
      borderWidth: 3,
      borderColor: "rgba(255,255,255,0.85)",
      marginBottom: 24,
    },
    hintText: { color: "#fff", fontSize: 15, fontWeight: "600", textAlign: "center" },

    analyzingWrap: { flex: 1, justifyContent: "center", alignItems: "center", gap: 14 },
    analyzingText: { color: "#fff", fontSize: 16, fontWeight: "700" },

    captureRow: { alignItems: "center", paddingBottom: 40 },
    captureBtn: {
      width: 76, height: 76, borderRadius: 38,
      backgroundColor: "rgba(255,255,255,0.25)",
      borderWidth: 4, borderColor: "#fff",
      justifyContent: "center", alignItems: "center",
    },
    captureBtnDisabled: { opacity: 0.5 },
    captureBtnInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#fff" },

    permissionTitle: { fontSize: 22, fontWeight: "800", color: c.textPrimary, marginTop: 20, textAlign: "center" },
    permissionText: { fontSize: 15, color: c.textSecondary, textAlign: "center", marginTop: 10, lineHeight: 22 },
    permissionBtn: {
      backgroundColor: c.accent, paddingVertical: 16, paddingHorizontal: 32,
      borderRadius: 20, marginTop: 24,
    },
    permissionBtnText: { color: c.onAccent, fontSize: 16, fontWeight: "800" },
    backLink: { marginTop: 20 },
    backLinkText: { color: c.textSecondary, fontSize: 14, fontWeight: "600" },

    reviewCard: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: 24,
      paddingBottom: Platform.OS === "ios" ? 34 : 24,
      borderWidth: 1.5,
      borderColor: c.border,
    },
    reviewRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 18 },
    reviewImage: { width: 64, height: 64, borderRadius: 16, backgroundColor: c.surfaceAlt },
    reviewImagePlaceholder: { justifyContent: "center", alignItems: "center" },
    reviewNameWrap: { flex: 1 },
    reviewName: { fontSize: 19, fontWeight: "800", color: c.textPrimary },
    confidenceNote: { fontSize: 12, color: c.textMuted, marginTop: 4, fontWeight: "500" },

    gramsRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 18 },
    gramsLabel: { fontSize: 14, fontWeight: "700", color: c.textSecondary },
    gramsInput: {
      flex: 1,
      backgroundColor: c.background,
      borderWidth: 1.5, borderColor: c.border,
      borderRadius: 14,
      paddingHorizontal: 14, paddingVertical: 10,
      fontSize: 16, fontWeight: "700", color: c.textPrimary,
      textAlign: "center",
    },

    macroRow: { flexDirection: "row", gap: 8, marginBottom: 22 },
    macroBox: {
      flex: 1, backgroundColor: c.background, borderRadius: 16,
      paddingVertical: 14, alignItems: "center",
      borderWidth: 1.5, borderColor: c.border,
    },
    macroVal: { fontSize: 16, fontWeight: "800", color: c.textPrimary },
    macroLab: { fontSize: 11, color: c.textMuted, fontWeight: "600", marginTop: 2 },

    reviewBtnRow: { flexDirection: "row", gap: 12 },
    retakeBtn: {
      flex: 1, paddingVertical: 16, borderRadius: 18,
      borderWidth: 1.5, borderColor: c.border, alignItems: "center",
    },
    retakeBtnText: { color: c.textSecondary, fontSize: 15, fontWeight: "700" },
    addBtn: {
      flex: 2, backgroundColor: c.accent, paddingVertical: 16,
      borderRadius: 18, alignItems: "center",
    },
    addBtnText: { color: c.onAccent, fontSize: 15, fontWeight: "800" },
  });
