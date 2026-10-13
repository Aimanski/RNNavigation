// Navigation

import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Keyboard, Platform, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../ui/AppText";
import { Colors, useTheme } from "../../providers/ThemeProvider";

const ROW_HEIGHT = 64; // Layout
export const BAR_HEIGHT = 80; // Bubble
const BUBBLE_SIZE = 60;
const LIFT = 22; // Icons
const ICON_SIZE = 28; // Icons
const ICON_MIN_SCALE = 0.7857; // Tabs

const NAV_ITEMS = [
  // Icons
  { title: "Weight", screen: "dashboard", icon: "scale-outline", activeIcon: "scale-outline" },
  { title: "Meals", screen: "mealplan", icon: "restaurant-outline", activeIcon: "restaurant" },
  { title: "Home", screen: "main", icon: "home-outline", activeIcon: "home" },
  // Icons
  { title: "Sleep", screen: "sleep", icon: "moon", activeIcon: "moon" },
  // Tabs
  { title: "Weep", fullName: "Weep - WeighApp AI Assistant", screen: "chatbot", icon: "chatbubble-ellipses-outline", activeIcon: "chatbubble-ellipses" },
];

function NavItem({
  title,
  fullName,
  icon,
  activeIcon,
  active,
  colors,
  onPress,
}: {
  title: string;
  fullName?: string;
  icon: string;
  activeIcon: string;
  active: boolean;
  colors: Colors;
  onPress: () => void;
}) {
  const pressProgress = useSharedValue(0);
  const hoverProgress = useSharedValue(0);
  const activeProgress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    activeProgress.value = withSpring(active ? 1 : 0, { damping: 20, stiffness: 400 });
  }, [active, activeProgress]);

  const liftStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -LIFT * activeProgress.value },
      { scale: 1 - pressProgress.value * 0.08 },
    ],
  }));

  const pillStyle = useAnimatedStyle(() => {
    const hoverFill = Math.max(hoverProgress.value * 0.4, pressProgress.value * 0.5);
    const strength = Math.max(activeProgress.value, hoverFill);
    return {
      opacity: strength,
      borderWidth: 4 * activeProgress.value,
      transform: [{ scale: 0.7 + 0.3 * strength }],
      shadowOpacity: 0.28 * activeProgress.value,
      elevation: 10 * activeProgress.value,
    };
  });

  // Animation
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ICON_MIN_SCALE + (1 - ICON_MIN_SCALE) * activeProgress.value }],
  }));

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={`Open ${fullName ?? title}`}
      accessibilityState={{ selected: active }}
      onPressIn={() => {
        pressProgress.value = withTiming(1, { duration: 80 });
      }}
      onPressOut={() => {
        pressProgress.value = withTiming(0, { duration: 110 });
      }}
      onHoverIn={() => {
        hoverProgress.value = withTiming(1, { duration: 150 });
      }}
      onHoverOut={() => {
        hoverProgress.value = withTiming(0, { duration: 150 });
      }}
      onPress={onPress}
      style={[s.navItem, Platform.OS === "web" && ({ cursor: "pointer" } as any)]}
    >
      <Animated.View style={[s.mover, liftStyle]}>
        <Animated.View
          style={[
            s.pill,
            { backgroundColor: active ? colors.accent : colors.border, borderColor: colors.surface },
            pillStyle,
          ]}
        />
        <Animated.View style={[s.iconLayer, iconStyle]}>
          <Ionicons
            name={(active ? activeIcon : icon) as any}
            size={ICON_SIZE}
            color={active ? colors.onAccent : colors.textMuted}
            style={s.icon}
          />
        </Animated.View>
      </Animated.View>
      <Text style={[s.navLabel, { color: active ? colors.accentDark : colors.textMuted }]}>
        {title}
      </Text>
    </Pressable>
  );
}

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  // Keyboard
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, () => setKeyboardOpen(true));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const navigateTo = (screen: string) => router.replace(`/${screen}`);

  if (keyboardOpen) return null;

  return (
    <View
      style={[
        s.bar,
        {
          height: BAR_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
          backgroundColor: colors.surface,
          shadowColor: colors.shadow,
        },
      ]}
    >
      {NAV_ITEMS.map((item) => {
        const active = pathname === `/${item.screen}`;
        return (
          <NavItem
            key={item.screen}
            title={item.title}
            fullName={(item as { fullName?: string }).fullName}
            icon={item.icon}
            activeIcon={item.activeIcon}
            active={active}
            colors={colors}
            onPress={() => {
              if (!active) navigateTo(item.screen);
            }}
          />
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    flexDirection: "row", alignItems: "flex-end",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 16,
  },
  navItem: {
    flex: 1, alignItems: "center", justifyContent: "flex-end",
    height: ROW_HEIGHT, paddingBottom: 8, gap: 1,
  },
  mover: {
    width: BUBBLE_SIZE, height: BUBBLE_SIZE,
    alignItems: "center", justifyContent: "center",
  },
  pill: {
    position: "absolute", width: BUBBLE_SIZE, height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowRadius: 8,
  },
  // Elevation
  iconLayer: { elevation: 20 },
  icon: { marginTop: 1 },
  navLabel: { fontSize: 12, fontWeight: "700" },
});
