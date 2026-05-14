// app/help.tsx — UPDATED WITH PREMIUM ANIMATED BACK BUTTON (matches bloodPressure.tsx)

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function HelpScreen() {
  const router = useRouter();

  // Animation for back button
  const backScale = useSharedValue(1);
  const animatedBackStyle = useAnimatedStyle(() => ({
    transform: [{ scale: backScale.value }],
  }));

  const faqs = [
    {
      q: "How do I update my weight/height?",
      a: "Go to Settings → Update Information. You can change age, height, and weight anytime.",
    },
    {
      q: "Why was my sleep duration showing negative or wrong?",
      a: "Fixed! We now correctly handle overnight sleep (e.g., 11 PM → 7 AM = 8 hours). Max capped at 24 hours.",
    },
    {
      q: "What do the blood pressure colors mean?",
      a: "• Green = Normal\n• Yellow = Elevated\n• Orange = High Stage 1\n• Red = High Stage 2\n• Blue = Low",
    },
    {
      q: "Can I delete a wrong entry?",
      a: "Yes! Delete buttons are now available on all logs (sleep, BP, etc.)",
    },
    {
      q: "Where is my data stored?",
      a: "All your data is 100% private and securely stored in your Supabase account. Only you can access it.",
    },
    {
      q: "Will you add Apple Health / Google Fit sync?",
      a: "Yes! Already in development — coming very soon!",
    },
    {
      q: "Is my data backed up?",
      a: "Yes! Everything is saved in the cloud under your account. Even if you change phones, your data stays safe.",
    },
  ];

  return (
    <SafeAreaView style={s.safeArea} edges={["left", "right"]}>
      {/* Premium Header with Animated Back Button */}
      <View style={s.headerContainer}>
        <AnimatedPressable
          style={[s.backButton, animatedBackStyle]}
          onPressIn={() => (backScale.value = withSpring(0.92))}
          onPressOut={() => (backScale.value = withSpring(1))}
          onPress={() => router.replace("/setting")}
        >
          <Ionicons name="arrow-back" size={32} color="#10b981" />
        </AnimatedPressable>

        <Text style={s.header}>HELP & SUPPORT</Text>

        {/* Spacer to perfectly center the title */}
        <View style={{ width: 48 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Welcome Card */}
        <View style={s.welcomeCard}>
          <Ionicons name="heart" size={56} color="#10b981" />
          <Text style={s.welcomeTitle}>Got a question?</Text>
          <Text style={s.welcomeText}>
            We've got answers. Check below — most things are already explained!
          </Text>
        </View>

        {/* Quick Access */}
        <Text style={s.sectionTitle}>Quick Access</Text>
        <View style={s.quickGrid}>
          <Pressable style={s.quickCard} onPress={() => router.push("/sleep")}>
            <Ionicons name="moon" size={36} color="#10b981" />
            <Text style={s.quickText}>Sleep</Text>
          </Pressable>
          <Pressable style={s.quickCard} onPress={() => router.push("/bloodPressure")}>
            <Ionicons name="pulse" size={36} color="#10b981" />
            <Text style={s.quickText}>Blood Pressure</Text>
          </Pressable>
          <Pressable style={s.quickCard} onPress={() => router.push("/updateInfo")}>
            <Ionicons name="person" size={36} color="#10b981" />
            <Text style={s.quickText}>Profile</Text>
          </Pressable>
        </View>

        {/* FAQ Section */}
        <Text style={s.sectionTitle}>Frequently Asked Questions</Text>
        {faqs.map((item, index) => (
          <View key={index} style={s.faqCard}>
            <Text style={s.question}>{item.q}</Text>
            <Text style={s.answer}>{item.a}</Text>
          </View>
        ))}

        {/* Footer */}
        <Text style={s.footer}>
          Thank you for using the app. Your health matters. More features coming soon!
        </Text>
        <Text style={s.version}>Version 1.0 • Made with care in the Philippines</Text>
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
  welcomeCard: {
    backgroundColor: "#ffffff",
    marginHorizontal: 20,
    padding: 32,
    borderRadius: 28,
    alignItems: "center",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 16,
    borderWidth: 1,
    borderColor: "#ecfdf5",
    marginBottom: 32,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#065f46",
    marginTop: 16,
    marginBottom: 8,
  },
  welcomeText: {
    fontSize: 16,
    color: "#059669",
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 10,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#065f46",
    marginLeft: 20,
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  quickGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginHorizontal: 20,
    marginBottom: 32,
    gap: 16,
  },
  quickCard: {
    backgroundColor: "#ffffff",
    width: 110,
    height: 110,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 12,
    borderWidth: 1.5,
    borderColor: "#ecfdf5",
  },
  quickText: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: "700",
    color: "#065f46",
  },
  faqCard: {
    backgroundColor: "#ffffff",
    marginHorizontal: 20,
    padding: 22,
    borderRadius: 20,
    marginBottom: 14,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 10,
    borderWidth: 1,
    borderColor: "#ecfdf5",
  },
  question: {
    fontSize: 17,
    fontWeight: "700",
    color: "#065f46",
    marginBottom: 8,
  },
  answer: {
    fontSize: 15.5,
    color: "#059669",
    lineHeight: 24,
  },
  footer: {
    marginTop: 50,
    paddingHorizontal: 40,
    textAlign: "center",
    color: "#059669",
    fontSize: 16,
    lineHeight: 26,
    fontWeight: "600",
  },
  version: {
    textAlign: "center",
    color: "#94a3b8",
    marginTop: 16,
    fontSize: 14,
    fontWeight: "500",
  },
});