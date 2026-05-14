// app/main.tsx

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Calendar } from "react-native-calendars";
import TutorialModal from "../components/TutorialModal";
import { supabase } from "../lib/supabase";

export default function MainScreen() {
  const router = useRouter();
  const [streak, setStreak] = useState(0);
  const [markedDates, setMarkedDates] = useState<Record<string, any>>({});
  const [showTutorial, setShowTutorial] = useState<boolean | null>(null);

  // BLOCK ANDROID HARDWARE BACK BUTTON
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => backHandler.remove();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          router.replace("/");
          return;
        }

        const { data, error } = await supabase
          .from("weighApp")
          .select("streak, last_sign_in, tutorial_completed")
          .eq("id", user.id)
          .maybeSingle();

        if (error) throw error;

        const tutorialDone = data?.tutorial_completed === true;
        setShowTutorial(!tutorialDone);

        // FIX: Brand-new account — row doesn't exist yet.
        // Use insert with ignoreDuplicates so we never accidentally
        // overwrite an existing row's data.
        if (!data) {
          const todayStr = new Date().toISOString().split("T")[0];
          await supabase.from("weighApp").upsert(
            {
              id: user.id,
              streak: 1,
              last_sign_in: new Date().toISOString(),
              tutorial_completed: false,
            },
            { onConflict: "id", ignoreDuplicates: true }
          );
          setStreak(1);
          setMarkedDates({
            [todayStr]: { selected: true, selectedColor: "#10b981" },
          });
          return;
        }

        // Streak logic
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        let newStreak = data.streak ?? 0;

        if (data.last_sign_in) {
          const l = new Date(data.last_sign_in);
          l.setHours(0, 0, 0, 0);
          if (l.getTime() === today.getTime()) {
            newStreak = data.streak;
          } else if (l.getTime() === yesterday.getTime()) {
            newStreak = (data.streak ?? 0) + 1;
          } else {
            newStreak = 1;
          }
        } else {
          newStreak = 1;
        }

        await supabase
          .from("weighApp")
          .update({ streak: newStreak, last_sign_in: new Date().toISOString() })
          .eq("id", user.id);

        setStreak(newStreak);

        const marked: Record<string, any> = {};
        for (let i = 0; i < newStreak; i++) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          marked[d.toISOString().split("T")[0]] = {
            selected: true,
            selectedColor: "#10b981",
            selectedTextColor: "#fff",
          };
        }
        setMarkedDates(marked);
      } catch (err) {
        console.error("Main screen error:", err);
        setShowTutorial(false);
      }
    };

    fetchData();
    // FIX: router removed from deps — it's stable but including it
    // caused the effect to re-run on every navigation event.
  }, []);

  const navigateTo = (screen: string) => {
    router.push(`/${screen.toLowerCase()}`);
  };

  return (
    <>
      <ScrollView
        style={s.scrollView}
        contentContainerStyle={s.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.header}>WEIGHAPP</Text>

        <View style={s.streakContainer}>
          <Text style={s.streakNumber}>{streak}</Text>
          <Text style={s.streakLabel}>Day Streak</Text>
          <Text style={s.streakMotivation}>
            {streak === 0 ? "Start today!" : streak >= 7 ? "You're on fire!" : "Keep going!"}
          </Text>
        </View>

        <View style={s.calendarWrapper}>
          <Calendar
            markedDates={markedDates}
            theme={{
              backgroundColor: "transparent",
              calendarBackground: "#ffffff",
              textSectionTitleColor: "#065f46",
              selectedDayBackgroundColor: "#10b981",
              selectedDayTextColor: "#ffffff",
              todayTextColor: "#10b981",
              todayBackgroundColor: "#ecfdf5",
              dayTextColor: "#065f46",
              textDisabledColor: "#94a3b8",
              monthTextColor: "#065f46",
              indicatorColor: "#10b981",
              arrowColor: "#10b981",
              textDayFontWeight: "600",
              textMonthFontWeight: "800",
              textDayHeaderFontWeight: "700",
            }}
            hideExtraDays
            disableMonthChange
            firstDay={1}
            style={s.calendar}
          />
        </View>

        <View style={s.grid}>
          {[
            { title: "Weight Tracker", screen: "dashboard", icon: "scale-outline" },
            { title: "Meal Plan",      screen: "mealplan",  icon: "restaurant-outline" },
            { title: "Sleep",          screen: "sleep",     icon: "moon-outline" },
            { title: "Settings",       screen: "setting",   icon: "settings-outline" },
          ].map((item) => (
            <Pressable
              key={item.title}
              style={({ pressed }) => [s.gridItem, pressed && s.pressed]}
              onPress={() => navigateTo(item.screen)}
            >
              <View style={s.box}>
                <Ionicons name={item.icon as any} size={48} color="#10b981" />
                <Text style={s.boxText}>{item.title}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <View style={s.pwdContainer}>
          <View style={s.pwdDivider} />
          <Text style={s.pwdText}>
            ♿ This app is designed to be accessible{"\n"}for Persons with Disabilities (PWD)
          </Text>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>

      {showTutorial !== null && (
        <TutorialModal
          visible={showTutorial === true}
          onDismiss={() => setShowTutorial(false)}
        />
      )}
    </>
  );
}

const s = StyleSheet.create({
  scrollView: { flex: 1, backgroundColor: "#f8fff9" },
  contentContainer: { paddingBottom: 40 },
  header: {
    fontSize: 52, fontWeight: "900", color: "#065f46",
    textAlign: "center", marginTop: 60, marginBottom: 20, letterSpacing: 1,
  },
  streakContainer: { alignItems: "center", marginVertical: 32 },
  streakNumber: { fontSize: 84, fontWeight: "900", color: "#10b981", letterSpacing: -2 },
  streakLabel: { fontSize: 22, fontWeight: "700", color: "#065f46", marginTop: 8 },
  streakMotivation: { fontSize: 18, color: "#059669", marginTop: 8, fontWeight: "600" },
  calendarWrapper: {
    marginHorizontal: 20, marginBottom: 40,
    borderRadius: 28, overflow: "hidden",
    shadowColor: "#10b981", shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22, shadowRadius: 28, elevation: 20,
    backgroundColor: "#ffffff", borderWidth: 2, borderColor: "#ecfdf5",
  },
  calendar: { borderRadius: 28 },
  grid: {
    flexDirection: "row", flexWrap: "wrap",
    justifyContent: "space-around", paddingHorizontal: 20, gap: 20,
  },
  gridItem: { width: "44%", marginBottom: 8 },
  pressed: { transform: [{ scale: 0.95 }] },
  box: {
    backgroundColor: "#ffffff", height: 140, borderRadius: 28,
    justifyContent: "center", alignItems: "center", padding: 20,
    shadowColor: "#10b981", shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18, shadowRadius: 24, elevation: 16,
    borderWidth: 2, borderColor: "#ecfdf5",
  },
  boxText: {
    fontSize: 17, fontWeight: "800", color: "#065f46",
    textAlign: "center", letterSpacing: 0.3, marginTop: 12,
  },
  pwdContainer: { alignItems: "center", marginTop: 36, paddingHorizontal: 32 },
  pwdDivider: {
    width: 48, height: 1.5, backgroundColor: "#a7f3d0",
    borderRadius: 2, marginBottom: 16,
  },
  pwdText: {
    fontSize: 13, fontWeight: "500", color: "#059669",
    textAlign: "center", lineHeight: 20, letterSpacing: 0.2, opacity: 0.85,
  },
});
