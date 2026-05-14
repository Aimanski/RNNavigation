// components/TutorialModal.tsx
// ─────────────────────────────────────────────────────────────────────────────
// One-time onboarding tutorial for WeighApp.
// Shows a paginated full-screen modal on first login.
// Completion is persisted to Supabase (weighApp.tutorial_completed = true)
// so it never appears again for this account.
//
// SUPABASE SETUP (run once in your dashboard SQL editor):
//   ALTER TABLE "weighApp"
//     ADD COLUMN IF NOT EXISTS tutorial_completed BOOLEAN NOT NULL DEFAULT false;
// ─────────────────────────────────────────────────────────────────────────────

import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { supabase } from "../lib/supabase";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// ─────────────────────────────────────────────
// Slide definitions
// ─────────────────────────────────────────────
type Slide = {
  icon: string;          // Ionicons name
  iconColor: string;
  iconBg: string;
  title: string;
  body: string;
  accent: string;        // pill/badge color
  accentText: string;
};

const SLIDES: Slide[] = [
  {
    icon: "leaf",
    iconColor: "#10b981",
    iconBg: "#d1fae5",
    title: "Welcome to WeighApp 👋",
    body: "Your all-in-one wellness companion. Track calories, monitor sleep, plan meals, and build healthy habits — all in one beautiful place.",
    accent: "#10b981",
    accentText: "Let's get started",
  },
  {
    icon: "flame",
    iconColor: "#f59e0b",
    iconBg: "#fef3c7",
    title: "Build Your Streak",
    body: "Every day you open the app counts as a check-in. Your streak and a colour-coded calendar on the Home screen show your consistency at a glance. Keep that streak alive!",
    accent: "#f59e0b",
    accentText: "Consistency is key",
  },
  {
    icon: "bar-chart",
    iconColor: "#10b981",
    iconBg: "#d1fae5",
    title: "Weight & Calorie Tracker",
    body: "The Dashboard shows today's calorie progress, your actual macro intake (protein, carbs, fat), and your ideal daily macro goals — all in elegant green progress bars.",
    accent: "#10b981",
    accentText: "Know your numbers",
  },
  {
    icon: "moon",
    iconColor: "#6366f1",
    iconBg: "#ede9fe",
    title: "Smart Sleep Logger",
    body: "Just tap \"I'm Going to Sleep\" at bedtime. When you wake up, tap \"I Just Woke Up\" — the app records your sleep automatically and gives you a personalised quality report.",
    accent: "#6366f1",
    accentText: "Sleep smarter",
  },
  {
    icon: "restaurant",
    iconColor: "#10b981",
    iconBg: "#d1fae5",
    title: "Meal Plan & Food Library",
    body: "Browse curated Filipino and international foods sorted by breakfast, lunch, and dinner. Tap any food to view full macros and add it to your daily log in one tap.",
    accent: "#10b981",
    accentText: "Eat mindfully",
  },
  {
    icon: "accessibility",
    iconColor: "#059669",
    iconBg: "#ecfdf5",
    title: "Built for Everyone ♿",
    body: "WeighApp is designed to be fully accessible for Persons with Disabilities (PWD). Large tap targets, clear labels, and high-contrast text ensure a comfortable experience for all.",
    accent: "#059669",
    accentText: "Inclusive by design",
  },
  {
    icon: "rocket",
    iconColor: "#10b981",
    iconBg: "#d1fae5",
    title: "You're All Set! 🎉",
    body: "Your personalised wellness journey starts now. Remember: small daily habits create big long-term results. We're rooting for you every step of the way.",
    accent: "#10b981",
    accentText: "Start your journey",
  },
];

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
type Props = {
  visible: boolean;
  onDismiss: () => void;
};

// ─────────────────────────────────────────────
// Animated spring-button wrapper
// ─────────────────────────────────────────────
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function SpringButton({
  onPress,
  style,
  children,
  disabled,
}: {
  onPress: () => void;
  style: any;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const scale = useSharedValue(1);
  const anim  = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      style={[style, anim]}
      onPressIn={() => { scale.value = withSpring(0.95); }}
      onPressOut={() => { scale.value = withSpring(1); }}
      onPress={onPress}
      disabled={disabled}
    >
      {children}
    </AnimatedPressable>
  );
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────
export default function TutorialModal({ visible, onDismiss }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saving,       setSaving]       = useState(false);

  // Shared animation values
  const cardOpacity   = useSharedValue(1);
  const cardTranslateX = useSharedValue(0);
  const overlayOpacity = useSharedValue(0);

  const scrollRef = useRef<ScrollView>(null);
  const isLast = currentIndex === SLIDES.length - 1;

  // ── Fade the overlay in when visible ──
  useEffect(() => {
    if (visible) {
      overlayOpacity.value = withTiming(1, { duration: 350 });
      setCurrentIndex(0);
    }
  }, [visible]);

  // ── Animated styles ──
  const overlayStyle    = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const cardAnimStyle   = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateX: cardTranslateX.value }],
  }));

  // ── Slide transition ──
  const goToSlide = (nextIndex: number) => {
    const direction = nextIndex > currentIndex ? -40 : 40;

    // Fade out, swap the slide on the JS thread after the animation completes,
    // then fade/spring back in — no runOnJS needed.
    cardOpacity.value = withTiming(0, { duration: 160 });

    setTimeout(() => {
      cardTranslateX.value = direction;
      setCurrentIndex(nextIndex);
      cardOpacity.value    = withTiming(1, { duration: 220 });
      cardTranslateX.value = withSpring(0, { damping: 18, stiffness: 200 });
    }, 165); // fires just after the 160ms fade-out finishes
  };

  const handleNext = () => {
    if (isLast) {
      handleFinish();
    } else {
      goToSlide(currentIndex + 1);
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("weighApp")
          .update({ tutorial_completed: true })
          .eq("id", user.id);
      }
    } catch (err) {
      // Non-critical — still dismiss even if update fails
      console.warn("Tutorial completion save failed:", err);
    } finally {
      setSaving(false);
      overlayOpacity.value = withTiming(0, { duration: 300 });
      setTimeout(onDismiss, 310);
    }
  };

  const slide = SLIDES[currentIndex];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleFinish}
    >
      {/* ── Dimmed backdrop ── */}
      <Animated.View style={[s.backdrop, overlayStyle]}>

        {/* ── Skip button (top-right, always visible) ── */}
        <Pressable
          style={s.skipBtn}
          onPress={handleFinish}
          hitSlop={16}
        >
          <Text style={s.skipTxt}>Skip</Text>
          <Ionicons name="close" size={16} color="#6b7280" style={{ marginLeft: 4 }} />
        </Pressable>

        {/* ── Main card ── */}
        <Animated.View style={[s.card, cardAnimStyle]}>

          {/* Icon illustration */}
          <View style={[s.iconWrap, { backgroundColor: slide.iconBg }]}>
            <Ionicons
              name={slide.icon as any}
              size={56}
              color={slide.iconColor}
            />
          </View>

          {/* Accent pill */}
          <View style={[s.accentPill, { backgroundColor: slide.accent + "22", borderColor: slide.accent + "55" }]}>
            <View style={[s.accentDot, { backgroundColor: slide.accent }]} />
            <Text style={[s.accentTxt, { color: slide.accent }]}>{slide.accentText}</Text>
          </View>

          {/* Text content */}
          <Text style={s.title}>{slide.title}</Text>
          <Text style={s.body}>{slide.body}</Text>

          {/* ── Dot indicators ── */}
          <View style={s.dotsRow}>
            {SLIDES.map((_, i) => (
              <Pressable key={i} onPress={() => goToSlide(i)} hitSlop={8}>
                <Animated.View
                  style={[
                    s.dot,
                    i === currentIndex
                      ? { backgroundColor: "#10b981", width: 24 }
                      : { backgroundColor: "#d1fae5", width: 8 },
                  ]}
                />
              </Pressable>
            ))}
          </View>

          {/* ── Navigation buttons ── */}
          <View style={s.btnRow}>
            {/* Back (hidden on first slide) */}
            {currentIndex > 0 ? (
              <SpringButton
                style={s.backBtn}
                onPress={() => goToSlide(currentIndex - 1)}
              >
                <Ionicons name="arrow-back" size={20} color="#10b981" />
              </SpringButton>
            ) : (
              <View style={s.backBtnPlaceholder} />
            )}

            {/* Next / Finish */}
            <SpringButton
              style={[s.nextBtn, { backgroundColor: slide.accent }]}
              onPress={handleNext}
              disabled={saving}
            >
              <Text style={s.nextTxt}>
                {isLast ? "Start Using WeighApp" : "Next"}
              </Text>
              {!isLast && (
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color="#fff"
                  style={{ marginLeft: 8 }}
                />
              )}
              {isLast && (
                <Ionicons
                  name="rocket"
                  size={18}
                  color="#fff"
                  style={{ marginLeft: 8 }}
                />
              )}
            </SpringButton>
          </View>

          {/* Slide counter */}
          <Text style={s.counter}>
            {currentIndex + 1} of {SLIDES.length}
          </Text>

        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const CARD_W = Math.min(SCREEN_W - 40, 420);

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(4, 47, 46, 0.72)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },

  // ── Skip ──
  skipBtn: {
    position: "absolute",
    top: Platform.OS === "android" ? 50 : 56,
    right: 24,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
    zIndex: 10,
  },
  skipTxt: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
    letterSpacing: 0.2,
  },

  // ── Card ──
  card: {
    width: CARD_W,
    backgroundColor: "#ffffff",
    borderRadius: 32,
    padding: 32,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#d1fae5",
    shadowColor: "#064e3b",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.28,
    shadowRadius: 40,
    elevation: 24,
    maxHeight: SCREEN_H * 0.82,
  },

  // ── Icon ──
  iconWrap: {
    width: 104,
    height: 104,
    borderRadius: 52,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },

  // ── Accent pill ──
  accentPill: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 16,
    gap: 6,
  },
  accentDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  accentTxt: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
  },

  // ── Text ──
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: "#065f46",
    textAlign: "center",
    marginBottom: 14,
    letterSpacing: -0.3,
    lineHeight: 30,
  },
  body: {
    fontSize: 15,
    fontWeight: "400",
    color: "#374151",
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 4,
    marginBottom: 28,
  },

  // ── Dots ──
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 28,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },

  // ── Buttons ──
  btnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    width: "100%",
    marginBottom: 14,
  },
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#ecfdf5",
    borderWidth: 1.5,
    borderColor: "#a7f3d0",
    justifyContent: "center",
    alignItems: "center",
  },
  backBtnPlaceholder: {
    width: 48,
  },
  nextBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 22,
    shadowColor: "#064e3b",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 10,
  },
  nextTxt: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  // ── Counter ──
  counter: {
    fontSize: 12,
    color: "#9ca3af",
    fontWeight: "500",
    letterSpacing: 0.4,
  },
});