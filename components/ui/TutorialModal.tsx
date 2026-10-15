// Tutorial

import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "./AppText";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { supabase } from "../../lib/supabase";
import { getSessionUser } from "../../lib/auth/session";
import { Colors, useTheme } from "../../providers/ThemeProvider";


// Slides
type Slide = {
  icon: string;          // Icons
  iconColor: string;
  iconBg: string;
  title: string;
  body: string;
  accent: string;        // Badge
  accentText: string;
};

const SLIDES: Slide[] = [
  {
    icon: "leaf",
    iconColor: "#0B6FDB",
    iconBg: "#CFE4FB",
    title: "Welcome to WeighApp 👋",
    body: "Your all-in-one wellness companion. Track calories, monitor sleep, plan meals, and build healthy habits, all in one beautiful place.",
    accent: "#0B6FDB",
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
    iconColor: "#0B6FDB",
    iconBg: "#CFE4FB",
    title: "Weight & Calorie Tracker",
    body: "The Dashboard shows today's calorie progress, your actual macro intake (protein, carbs, fat), and your ideal daily macro goals, all in elegant green progress bars.",
    accent: "#0B6FDB",
    accentText: "Know your numbers",
  },
  {
    icon: "moon",
    iconColor: "#6366f1",
    iconBg: "#ede9fe",
    title: "Smart Sleep Logger",
    body: "Just tap \"I'm Going to Sleep\" at bedtime. When you wake up, tap \"I Just Woke Up\". The app records your sleep automatically and gives you a personalised quality report.",
    accent: "#6366f1",
    accentText: "Sleep smarter",
  },
  {
    icon: "restaurant",
    iconColor: "#0B6FDB",
    iconBg: "#CFE4FB",
    title: "Meal Plan & Food Library",
    body: "Browse curated Filipino and international foods sorted by breakfast, lunch, and dinner. Tap any food to view full macros and add it to your daily log in one tap.",
    accent: "#0B6FDB",
    accentText: "Eat mindfully",
  },
  {
    icon: "accessibility",
    iconColor: "#4D4D4D",
    iconBg: "#EAF3FC",
    title: "Built for Everyone ♿",
    body: "WeighApp is designed to be accessible for Persons with Disabilities (PWD). Large tap targets, clear labels, and high-contrast text ensure a comfortable experience for everyone.",
    accent: "#4D4D4D",
    accentText: "Inclusive by design",
  },
  {
    icon: "sparkles",
    iconColor: "#0B6FDB",
    iconBg: "#CFE4FB",
    title: "Your Meal Plan Is Set 🎉",
    body: "We built a weekly plan from your calorie goal, your tastes and your allergies. Small daily habits create big results, and we're rooting for you every step of the way.",
    accent: "#0B6FDB",
    accentText: "Suggested For You",
  },
];

// Props
type Props = {
  visible: boolean;
  onDismiss: () => void;
  onViewMealPlan?: () => void;
};

// Animation
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

// Modal
export default function TutorialModal({ visible, onDismiss, onViewMealPlan }: Props) {
  const { colors } = useTheme();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = screenH < 740;
  const s = useMemo(
    () => makeStyles(colors, screenW, compact, insets.top, insets.bottom),
    [colors, screenW, compact, insets.top, insets.bottom]
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saving,       setSaving]       = useState(false);

  // Animation
  const cardOpacity   = useSharedValue(1);
  const cardTranslateX = useSharedValue(0);
  const overlayOpacity = useSharedValue(0);

  const isLast = currentIndex === SLIDES.length - 1;

  // Overlay
  useEffect(() => {
    if (visible) {
      overlayOpacity.value = withTiming(1, { duration: 350 });
      setCurrentIndex(0);
    }
  }, [visible, overlayOpacity]);

  // Styles
  const overlayStyle    = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const cardAnimStyle   = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateX: cardTranslateX.value }],
  }));

  // Transition
  const goToSlide = (nextIndex: number) => {
    const direction = nextIndex > currentIndex ? -40 : 40;

    // Transition
    cardOpacity.value = withTiming(0, { duration: 160 });

    setTimeout(() => {
      cardTranslateX.value = direction;
      setCurrentIndex(nextIndex);
      cardOpacity.value    = withTiming(1, { duration: 220 });
      cardTranslateX.value = withSpring(0, { damping: 18, stiffness: 200 });
    }, 165); // Timing
  };

  const handleNext = () => {
    if (isLast) {
      handleFinish(onViewMealPlan);
    } else {
      goToSlide(currentIndex + 1);
    }
  };

  const handleFinish = async (afterwards?: () => void) => {
    setSaving(true);
    try {
      const user = await getSessionUser();
      if (user) {
        await supabase
          .from("weighApp")
          .update({ tutorial_completed: true })
          .eq("id", user.id);
      }
    } catch (err) {
      // Fallback
      console.warn("Tutorial completion save failed:", err);
    } finally {
      setSaving(false);
      overlayOpacity.value = withTiming(0, { duration: 300 });
      setTimeout(() => {
        onDismiss();
        if (afterwards) afterwards();
      }, 310);
    }
  };

  const slide = SLIDES[currentIndex];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => handleFinish()}
    >
      {/* Backdrop */}
      <Animated.View style={[s.backdrop, overlayStyle]}>

        {/* Skip */}
        <Pressable
          style={s.skipBtn}
          onPress={() => handleFinish()}
          hitSlop={16}
        >
          <Text style={s.skipTxt}>Skip</Text>
          <Ionicons name="close" size={16} color={colors.textSecondary} style={{ marginLeft: 4 }} />
        </Pressable>

        {/* Card */}
        <Animated.View style={[s.card, cardAnimStyle]}>
          <ScrollView
            style={s.cardScroll}
            contentContainerStyle={s.cardScrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
          {/* Icon */}
          <View style={[s.iconWrap, { backgroundColor: slide.iconBg }]}>
            <Ionicons
              name={slide.icon as any}
              size={compact ? 38 : 56}
              color={slide.iconColor}
            />
          </View>

          {/* Badge */}
          <View style={[s.accentPill, { backgroundColor: slide.accent + "22", borderColor: slide.accent + "55" }]}>
            <View style={[s.accentDot, { backgroundColor: slide.accent }]} />
            <Text style={[s.accentTxt, { color: slide.accent }]}>{slide.accentText}</Text>
          </View>

          {/* Content */}
          <Text style={s.title}>{slide.title}</Text>
          <Text style={s.body}>{slide.body}</Text>
          </ScrollView>

          <View style={s.cardFooter}>
          {/* Pagination */}
          <View style={s.dotsRow}>
            {SLIDES.map((_, i) => (
              <Pressable key={i} onPress={() => goToSlide(i)} hitSlop={8}>
                <Animated.View
                  style={[
                    s.dot,
                    i === currentIndex
                      ? { backgroundColor: colors.accent, width: 24 }
                      : { backgroundColor: colors.border, width: 8 },
                  ]}
                />
              </Pressable>
            ))}
          </View>

          {/* Navigation */}
          <View style={s.btnRow}>
            {/* Navigation */}
            {currentIndex > 0 ? (
              <SpringButton
                style={s.backBtn}
                onPress={() => goToSlide(currentIndex - 1)}
              >
                <Ionicons name="arrow-back" size={20} color={colors.accent} />
              </SpringButton>
            ) : (
              <View style={s.backBtnPlaceholder} />
            )}

            {/* Navigation */}
            <SpringButton
              style={[s.nextBtn, { backgroundColor: slide.accent }]}
              onPress={handleNext}
              disabled={saving}
            >
              <Text style={s.nextTxt}>
                {isLast ? "View Meal Plan" : "Next"}
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
                  name="restaurant"
                  size={18}
                  color="#fff"
                  style={{ marginLeft: 8 }}
                />
              )}
            </SpringButton>
          </View>

          {isLast && (
            <Pressable onPress={() => handleFinish()} hitSlop={10} disabled={saving}>
              <Text style={s.laterTxt}>Start Using WeighApp</Text>
            </Pressable>
          )}

          {/* Counter */}
          <Text style={s.counter}>
            {currentIndex + 1} of {SLIDES.length}
          </Text>
          </View>

        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// Styles

const makeStyles = (c: Colors, screenW: number, compact: boolean, topInset: number, bottomInset: number) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(4, 47, 46, 0.72)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: topInset + 64,
    paddingBottom: bottomInset + 16,
  },

  // Skip
  skipBtn: {
    position: "absolute",
    top: topInset + 12,
    right: 24,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 12,
  },
  skipTxt: {
    fontSize: 13,
    fontWeight: "600",
    color: c.textSecondary,
    letterSpacing: 0.2,
  },

  // Card
  card: {
    width: Math.min(screenW - 40, 420),
    backgroundColor: c.surface,
    borderRadius: 32,
    paddingHorizontal: compact ? 20 : 32,
    paddingTop: compact ? 20 : 32,
    paddingBottom: compact ? 16 : 28,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: c.border,
    maxHeight: "100%",
  },
  cardScroll: { flexGrow: 0, flexShrink: 1, width: "100%" },
  cardScrollContent: { alignItems: "center", paddingBottom: 8 },
  cardFooter: { width: "100%", alignItems: "center", flexShrink: 0, paddingTop: 4 },

  // Icon
  iconWrap: {
    width: compact ? 72 : 104,
    height: compact ? 72 : 104,
    borderRadius: compact ? 36 : 52,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: compact ? 12 : 20,
  },

  // Badge
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

  // Typography
  title: {
    fontSize: compact ? 20 : 22,
    fontWeight: "900",
    color: c.textPrimary,
    textAlign: "center",
    marginBottom: 14,
    letterSpacing: -0.3,
    lineHeight: compact ? 27 : 30,
  },
  body: {
    fontSize: compact ? 14 : 15,
    fontWeight: "400",
    color: c.textSecondary,
    textAlign: "center",
    lineHeight: compact ? 21 : 24,
    paddingHorizontal: 4,
    marginBottom: compact ? 12 : 20,
  },

  // Pagination
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: compact ? 14 : 24,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },

  // Buttons
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
    backgroundColor: c.surfaceAlt,
    borderWidth: 1.5,
    borderColor: c.border,
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
    shadowColor: "#000000",
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

  // Counter
  laterTxt: { fontSize: 14, fontWeight: "700", color: c.textSecondary, marginTop: 14, textAlign: "center" },
  counter: {
    fontSize: 12,
    color: c.textMuted,
    fontWeight: "500",
    letterSpacing: 0.4,
  },
});
