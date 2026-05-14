// app/feedback.tsx — PREMIUM ANIMATED BACK BUTTON + PERFECT HEADER

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function FeedbackScreen() {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Animation for back button
  const backScale = useSharedValue(1);
  const animatedBackStyle = useAnimatedStyle(() => ({
    transform: [{ scale: backScale.value }],
  }));

  const submitFeedback = async () => {
    if (rating === 0) {
      return Alert.alert("Hold on!", "Please tap a star to rate us");
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from("feedback").insert({
        user_id: user?.id || null,
        rating,
        message: message.trim() || null,
      });

      if (error) throw error;

      Alert.alert(
        "Thank you!",
        rating >= 4
          ? "You just made our day! We're so happy you love the app"
          : "Thanks for your honest feedback. We're working hard to improve!",
        [{ text: "You're welcome", onPress: () => router.push("/setting") }]
      );
    } catch (err) {
      Alert.alert("Oops", "Failed to send feedback. Try again later?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safeArea} edges={["left", "right"]}>
      {/* Premium Header with Animated Back Button */}
      <View style={s.headerContainer}>
        <AnimatedPressable
          style={[s.backButton, animatedBackStyle]}
          onPressIn={() => (backScale.value = withSpring(0.92))}
          onPressOut={() => (backScale.value = withSpring(1))}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={32} color="#10b981" />
        </AnimatedPressable>

        <Text style={s.header}>GIVE FEEDBACK</Text>

        {/* Spacer to center title perfectly */}
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={s.card}>
          <Ionicons name="heart" size={64} color="#10b981" style={{ marginBottom: 24 }} />

          <Text style={s.title}>How’s your experience so far?</Text>
          <Text style={s.subtitle}>Your feedback helps us grow</Text>

          {/* Star Rating */}
          <View style={s.stars}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable
                key={star}
                onPress={() => setRating(star)}
                disabled={loading}
                style={{ padding: 4 }}
              >
                <Ionicons
                  name={star <= rating ? "star" : "star-outline"}
                  size={52}
                  color="#10b981"
                />
              </Pressable>
            ))}
          </View>

          {rating > 0 && (
            <Text style={s.ratingText}>
              {rating === 5 && "You love it!"}
              {rating === 4 && "You like it!"}
              {rating === 3 && "It’s okay"}
              {rating === 2 && "Not great..."}
              {rating === 1 && "We’re sorry"}
            </Text>
          )}

          {/* Message Input */}
          <TextInput
            style={s.input}
            placeholder="Tell us what you love or what we can improve... (optional)"
            placeholderTextColor="#94a3b8"
            value={message}
            onChangeText={setMessage}
            multiline
            textAlignVertical="top"
            editable={!loading}
          />

          {/* Submit Button */}
          <Pressable
            style={[s.submitBtn, loading && s.submitBtnDisabled]}
            onPress={submitFeedback}
            disabled={loading}
          >
            <Text style={s.submitTxt}>
              {loading ? "Sending..." : "SEND FEEDBACK"}
            </Text>
          </Pressable>
        </View>

        <Text style={s.footer}>
          Every star and word means the world to us. Thank you for helping us become better.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8fff9",
  },
  headerContainer: {
    paddingTop: Platform.OS === "android" ? 50 : 20,
    paddingBottom: 30,
    paddingHorizontal: 24,
    backgroundColor: "#f8fff9",
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
    marginRight: 16,
  },
  header: {
    fontSize: 23,
    fontWeight: "900",
    color: "#064e3b",
    flex: 1,
    textAlign: "center",
    letterSpacing: 0.6,
  },
  card: {
    backgroundColor: "#ffffff",
    marginTop:20,
    marginHorizontal: 20,
    borderRadius: 24,
    padding: 32,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 25,
    elevation: 15,
    borderWidth: 1,
    borderColor: "#ecfdf5",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#065f46",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#059669",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 22,
  },
  stars: {
    flexDirection: "row",
    marginBottom: 24,
  },
  ratingText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#10b981",
    marginBottom: 32,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#f0fdf4",
    borderWidth: 1.5,
    borderColor: "#86efac",
    width: "100%",
    height: 160,
    borderRadius: 20,
    padding: 18,
    fontSize: 16,
    color: "#065f46",
    textAlignVertical: "top",
    marginBottom: 28,
  },
  submitBtn: {
    backgroundColor: "#10b981",
    width: "100%",
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 8,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitTxt: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  footer: {
    marginTop: 50,
    paddingHorizontal: 40,
    textAlign: "center",
    color: "#059669",
    fontSize: 15,
    lineHeight: 24,
    fontWeight: "500",
  },
});