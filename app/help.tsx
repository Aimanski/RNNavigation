// Help

import { Ionicons } from "@expo/vector-icons";
import { Href, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text, TextInput } from "../components/ui/AppText";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors, useTheme } from "../providers/ThemeProvider";

type IconName = keyof typeof Ionicons.glyphMap;

const QUICK_LINKS: { label: string; icon: IconName; route: Href }[] = [
  { label: "Meal Plan", icon: "sparkles-outline", route: "/myplan" },
  { label: "Ask Weep", icon: "chatbubble-ellipses-outline", route: "/chatbot" },
  { label: "Food Budget", icon: "wallet-outline", route: { pathname: "/budget", params: { mode: "edit" } } },
  { label: "Tastes", icon: "restaurant-outline", route: { pathname: "/tastes", params: { mode: "edit" } } },
  { label: "Update Info", icon: "create-outline", route: "/updateInfo" },
  { label: "Account", icon: "person-circle-outline", route: "/account" },
  { label: "Reminders", icon: "notifications-outline", route: "/reminders" },
  { label: "Water", icon: "water-outline", route: "/water" },
  { label: "Blood Pressure", icon: "pulse-outline", route: "/bloodPressure" },
];

const FAQS: { id: string; icon: IconName; q: string; a: string }[] = [
  {
    id: "start",
    icon: "rocket-outline",
    q: "How do I get started?",
    a: "Setup has 7 short steps: your basic info, sex, activity level, calorie goal, food allergies, tastes and a daily food budget. After that, a quick tutorial on Home ends with your weekly meal plan.\n\nKeep your details up to date in Settings → Update Info so your calorie goal stays accurate, then follow your progress on the Weight tab.",
  },
  {
    id: "plan",
    icon: "sparkles-outline",
    q: "What is my weekly meal plan?",
    a: "On the Meals tab, tap View Your Meal Plan on the Suggested For You card. WeighApp builds a plan for Monday to Sunday (Day 1 to Day 7) with Breakfast, Lunch, Dinner and a Snack each day.\n\n• It adds up to your daily calorie goal.\n• It leaves out foods with your allergens.\n• It follows your tastes and your daily food budget.\n\nTap a day to see its meals, tap a food to log it with the planned portion, or tap the shuffle button for a different plan. A new plan is made every week.",
  },
  {
    id: "budget",
    icon: "wallet-outline",
    q: "How do I change my food budget or tastes?",
    a: "Open Settings and tap Food Budget to set how much you can spend on food in a day, or Taste Preferences to say what you love or want to avoid. You can also tap the budget bar at the top of your meal plan. Your plan updates right after you save.\n\nPrices in WeighApp are rough estimates in pesos per serving. If your budget is very low, the plan shows the cheapest meals it can and tells you.",
  },
  {
    id: "badges",
    icon: "star-outline",
    q: "What do the red and green badges mean?",
    a: "On the food cards in Meals:\n\n• Red warning icon = the food has an ingredient you are allergic to.\n• Green star = the food is part of your weekly meal plan.\n\nSet your allergies in Settings → Food Preferences.",
  },
  {
    id: "meal",
    icon: "restaurant-outline",
    q: "How do I log a meal?",
    a: "Open the Meals tab and expand Breakfast, Lunch, Dinner or Snack (or search the Available Library). Tap a food to see its calories and macros, choose the servings, then tap Add to Daily Log. Today's total updates right away.\n\nYou can also log straight from your meal plan.",
  },
  {
    id: "scan",
    icon: "camera-outline",
    q: "How does Scan Food work?",
    a: "On the Meals tab, tap the round camera button.\n\n• Barcode/QR: point the camera at a packaged food's barcode.\n• Food Photo: frame your meal and tap the capture button to get an estimate of its nutrition.\n\nCheck the amount in grams, then tap Add to Today. Scanned foods are saved in your private Scanned Foods card. If the camera sees something that isn't food, you'll get a warning and can scan again.",
  },
  {
    id: "history",
    icon: "time-outline",
    q: "Where is my calorie history?",
    a: "Open the Weight tab and tap Detail on the Daily Calories card. You'll see your last 30 days. Tap a day to see every food you logged, with the time and calories.",
  },
  {
    id: "delete",
    icon: "trash-outline",
    q: "Can I delete a wrong entry?",
    a: "Yes. If you added a food by mistake, go to Weight → Detail, tap the day, and tap the red trash button next to the food. Your totals update right away.\n\nBlood pressure readings have a delete button on each entry, and the Water page can reset today's intake. Sleep entries can't be deleted from the app yet, so check the times before you tap I Just Woke Up.",
  },
  {
    id: "weep",
    icon: "chatbubble-ellipses-outline",
    q: "What can Weep help me with?",
    a: "Weep is the WeighApp assistant on the Weep tab. Ask it about meals, calories, healthy weight habits or how to use the app. It knows your allergies, tastes and budget, so its food ideas fit you. You can send 15 messages a day.\n\nWeep isn't a doctor. For medical concerns, please see a doctor or dietitian.",
  },
  {
    id: "update",
    icon: "create-outline",
    q: "What happens when I update my weight or height?",
    a: "Go to Settings → Update Info. WeighApp recalculates your BMI, daily energy needs and calorie goal, and shows them before you save. Your meal plan then follows the new goal.",
  },
  {
    id: "settings",
    icon: "settings-outline",
    q: "Where are the Settings?",
    a: "Tap your round profile picture at the top right of the Weight, Meals, Home, Sleep or Weep page. From there you can change your account, details, allergies, tastes, budget, reminders and dark mode, or log out. Use the back arrow to return to Home.",
  },
  {
    id: "reminder",
    icon: "alarm-outline",
    q: "Why didn't my reminder notify me?",
    a: "Reminders repeat every day at the time you pick. Check that:\n\n• Notifications are allowed for WeighApp in your phone's settings.\n• The reminder's bell is switched on.\n• The time shown is the one you expect.\n\nSome phones delay alerts to save battery. Setting WeighApp's battery usage to Unrestricted helps them arrive on time.",
  },
  {
    id: "sleep",
    icon: "moon-outline",
    q: "How do I log my sleep?",
    a: "Open the Sleep tab and tap I'm Going to Sleep. When you wake up, tap I Just Woke Up to save the session. Overnight sleep is handled correctly (11 PM → 7 AM = 8 hours) and a single session is capped at 24 hours.",
  },
  {
    id: "bp",
    icon: "pulse-outline",
    q: "What do the blood pressure colors mean?",
    a: "• Green = Normal\n• Yellow = Elevated\n• Orange = High Stage 1\n• Red = High Stage 2\n• Blue = Low",
  },
  {
    id: "streak",
    icon: "flame-outline",
    q: "How is my streak counted?",
    a: "Your streak grows by one for each day in a row that you open WeighApp. If you miss a day, it starts again from 1.",
  },
  {
    id: "profile",
    icon: "person-circle-outline",
    q: "How do I change my photo or username?",
    a: "Go to Settings → Account. Tap your photo to choose a new one, edit your username or email, then tap Save Changes. If you signed in with Google, your Google photo is used until you pick your own.",
  },
  {
    id: "dark",
    icon: "contrast-outline",
    q: "Can I switch to dark mode?",
    a: "Yes. Turn on the Dark Mode switch at the top of Settings. You can switch back at any time.",
  },
  {
    id: "devices",
    icon: "phone-portrait-outline",
    q: "Does WeighApp work on my phone?",
    a: "WeighApp is made for Android phones and tablets of different sizes. The layout adapts to your screen and to larger system text. If something looks wrong on your phone, please send us feedback with your phone model.",
  },
  {
    id: "privacy",
    icon: "shield-checkmark-outline",
    q: "Is my data private and backed up?",
    a: "Your data is stored securely in your own WeighApp account in the cloud, and only you can access it. If you change phones, just sign in again and everything is still there.",
  },
];

export default function HelpScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const term = query.trim().toLowerCase();
  const results = term
    ? FAQS.filter(
        (f) => f.q.toLowerCase().includes(term) || f.a.toLowerCase().includes(term)
      )
    : FAQS;

  return (
    <SafeAreaView style={s.safeArea} edges={["left", "right"]}>
      <View style={s.headerContainer}>
        <Text style={s.header}>Help & Support</Text>

      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.scrollContent}
      >
        {/* Hero */}
        <View style={s.hero}>
          <View style={s.heroIcon}>
            <Ionicons name="help-buoy" size={30} color={colors.onAccent} />
          </View>
          <View style={s.heroTextWrap}>
            <Text style={s.heroTitle}>How can we help?</Text>
            <Text style={s.heroText}>
              Search the answers below or jump straight to a feature.
            </Text>
          </View>
        </View>

        {/* Search */}
        <View style={s.searchBox}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            style={s.searchInput}
            placeholder="Search for help"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")} hitSlop={10}>
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </Pressable>
          )}
        </View>

        {/* Links */}
        {!term && (
          <>
            <Text style={s.sectionTitle}>Quick links</Text>
            <View style={s.quickGrid}>
              {QUICK_LINKS.map((item) => (
                <Pressable
                  key={item.label}
                  style={({ pressed }) => [s.quickCard, pressed && s.pressed]}
                  onPress={() => router.push(item.route)}
                >
                  <View style={s.quickIcon}>
                    <Ionicons name={item.icon} size={24} color={colors.accent} />
                  </View>
                  <Text style={s.quickText}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {/* Questions */}
        <Text style={s.sectionTitle}>
          {term ? `Results (${results.length})` : "Frequently asked questions"}
        </Text>

        {results.length === 0 ? (
          <View style={s.emptyCard}>
            <Ionicons name="search-outline" size={34} color={colors.textMuted} />
            <Text style={s.emptyTitle}>No answers found</Text>
            <Text style={s.emptyText}>
              Try a different word, or send us a message below and we&apos;ll help you out.
            </Text>
          </View>
        ) : (
          results.map((item) => {
            const open = openId === item.id || !!term;
            return (
              <Pressable
                key={item.id}
                style={s.faqCard}
                onPress={() => setOpenId(openId === item.id ? null : item.id)}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
              >
                <View style={s.faqHeader}>
                  <View style={s.faqIcon}>
                    <Ionicons name={item.icon} size={20} color={colors.accent} />
                  </View>
                  <Text style={s.question}>{item.q}</Text>
                  {!term && (
                    <Ionicons
                      name={open ? "chevron-up" : "chevron-down"}
                      size={20}
                      color={colors.textSecondary}
                    />
                  )}
                </View>
                {open && <Text style={s.answer}>{item.a}</Text>}
              </Pressable>
            );
          })
        )}

        {/* Contact */}
        <View style={s.contactCard}>
          <Ionicons name="chatbubbles-outline" size={30} color={colors.accent} />
          <Text style={s.contactTitle}>Still need help?</Text>
          <Text style={s.contactText}>
            Tell us what&apos;s going wrong or what you&apos;d like to see. We read every message.
          </Text>
          <Pressable
            style={({ pressed }) => [s.contactBtn, pressed && s.pressed]}
            onPress={() => router.push("/feedback")}
          >
            <Ionicons name="send" size={18} color={colors.onAccent} />
            <Text style={s.contactBtnText}>Send feedback</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/about")} hitSlop={8}>
            <Text style={s.contactLink}>Meet the team behind WeighApp</Text>
          </Pressable>
        </View>

        <Text style={s.version}>WeighApp · Version 1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: c.background },
    pressed: { opacity: 0.7 },

    headerContainer: {
      paddingTop: 12,
      paddingBottom: 16,
      paddingHorizontal: 20,
      backgroundColor: c.background,
      flexDirection: "row",
      alignItems: "center",
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
      justifyContent: "center",
      alignItems: "center",
    },
    header: {
      flex: 1,
      textAlign: "center",
      fontSize: 22,
      fontWeight: "800",
      color: c.textPrimary,
    },
    headerSpacer: { width: 44 },

    scrollContent: { paddingHorizontal: 20, paddingBottom: 60 },

    hero: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      backgroundColor: c.surface,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1.5,
      borderColor: c.border,
      marginBottom: 16,
    },
    heroIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: c.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    heroTextWrap: { flex: 1 },
    heroTitle: { fontSize: 20, fontWeight: "800", color: c.textPrimary },
    heroText: {
      fontSize: 14,
      lineHeight: 20,
      color: c.textSecondary,
      marginTop: 4,
      fontWeight: "500",
    },

    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: c.surface,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: c.border,
      paddingHorizontal: 16,
      height: 52,
      marginBottom: 24,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: c.textPrimary,
      paddingVertical: 0,
    },

    sectionTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: c.textPrimary,
      marginBottom: 12,
    },

    quickGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: 12,
      marginBottom: 28,
    },
    quickCard: {
      width: "31.5%",
      backgroundColor: c.surface,
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: c.border,
      paddingVertical: 16,
      paddingHorizontal: 6,
      alignItems: "center",
      gap: 10,
    },
    quickIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    quickText: {
      fontSize: 13,
      fontWeight: "700",
      color: c.textPrimary,
      textAlign: "center",
    },

    faqCard: {
      backgroundColor: c.surface,
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: c.border,
      padding: 16,
      marginBottom: 12,
    },
    faqHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
    faqIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    question: {
      flex: 1,
      fontSize: 15.5,
      fontWeight: "700",
      color: c.textPrimary,
    },
    answer: {
      fontSize: 15,
      lineHeight: 23,
      color: c.textSecondary,
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },

    emptyCard: {
      alignItems: "center",
      backgroundColor: c.surface,
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: c.border,
      padding: 28,
      gap: 8,
      marginBottom: 12,
    },
    emptyTitle: { fontSize: 17, fontWeight: "800", color: c.textPrimary },
    emptyText: {
      fontSize: 14,
      lineHeight: 21,
      color: c.textSecondary,
      textAlign: "center",
    },

    contactCard: {
      alignItems: "center",
      backgroundColor: c.surface,
      borderRadius: 24,
      borderWidth: 1.5,
      borderColor: c.border,
      padding: 24,
      marginTop: 20,
      gap: 8,
    },
    contactTitle: { fontSize: 20, fontWeight: "800", color: c.textPrimary },
    contactText: {
      fontSize: 14.5,
      lineHeight: 21,
      color: c.textSecondary,
      textAlign: "center",
      marginBottom: 8,
    },
    contactBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      backgroundColor: c.accent,
      borderRadius: 16,
      paddingVertical: 14,
      paddingHorizontal: 28,
      alignSelf: "stretch",
    },
    contactBtnText: { fontSize: 16, fontWeight: "800", color: c.onAccent },
    contactLink: {
      fontSize: 14,
      fontWeight: "700",
      color: c.accent,
      marginTop: 10,
    },

    version: {
      textAlign: "center",
      color: c.textMuted,
      marginTop: 28,
      fontSize: 13,
      fontWeight: "500",
    },
  });
