// Layout
import { Stack, useGlobalSearchParams, usePathname, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { BackHandler, LogBox, Platform, ToastAndroid, View } from "react-native";
import AppHeader from "../components/layout/AppHeader";
import BottomNav from "../components/layout/BottomNav";
import { resetTo } from "../lib/navigation";
import { useAppFonts } from "../lib/typography";
import { AuthProvider } from "../providers/AuthProvider";
import { ThemeProvider, useTheme } from "../providers/ThemeProvider";

// Warnings
if (__DEV__) LogBox.ignoreLogs(["Unable to activate keep awake"]);

// Splash
SplashScreen.preventAutoHideAsync().catch(() => {});

// Header
const HEADER_PAGES: Record<string, string> = {
  "/dashboard": "Weight",
  "/mealplan": "Meals",
  "/main": "Home",
  "/sleep": "Sleep",
  "/chatbot": "Weep",
};

// Footer
const FOOTER_PAGES = new Set([
  "/dashboard",
  "/mealplan",
  "/main",
  "/sleep",
  "/chatbot",
  "/setting",
]);

// Back
const SETUP_PREVIOUS_STEP: Record<string, string> = {
  "/gender": "/survey",
  "/activity": "/gender",
  "/recommend": "/activity",
  "/preferences": "/recommend",
};
const EXIT_SCREENS = new Set(["/", "/main", "/admin", "/survey", "/verifyEmail"]);
const EXIT_PRESS_WINDOW_MS = 2000;

function useAndroidBack() {
  const router = useRouter();
  const pathname = usePathname();
  const { mode } = useGlobalSearchParams<{ mode?: string }>();

  useEffect(() => {
    if (Platform.OS !== "android") return;
    let lastBackPress = 0;

    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      // Wizard
      const previousStep = SETUP_PREVIOUS_STEP[pathname];
      if (previousStep && !(pathname === "/preferences" && mode === "edit")) {
        resetTo(router, previousStep as never);
        return true;
      }

      // Stack
      if (router.canGoBack()) return false;

      // Fallback
      if (pathname === "/signup" || pathname === "/auth/callback") {
        router.replace("/");
        return true;
      }
      if (EXIT_SCREENS.has(pathname)) {
        const now = Date.now();
        if (now - lastBackPress < EXIT_PRESS_WINDOW_MS) {
          BackHandler.exitApp();
        } else {
          lastBackPress = now;
          ToastAndroid.show("Press back again to exit", ToastAndroid.SHORT);
        }
        return true;
      }
      router.replace("/main");
      return true;
    });

    return () => sub.remove();
  }, [router, pathname, mode]);
}

function AppShell() {
  const pathname = usePathname();
  const { colors } = useTheme();
  const pageName = HEADER_PAGES[pathname];
  const showFooter = FOOTER_PAGES.has(pathname);
  useAndroidBack();

  // Theme
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {pageName && <AppHeader />}
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "none",
            contentStyle: { backgroundColor: colors.background },
          }}
        />
        {showFooter && <BottomNav />}
      </View>
    </View>
  );
}

export default function RootLayout() {
  const fontsReady = useAppFonts();
  useEffect(() => {
    if (fontsReady) SplashScreen.hideAsync().catch(() => {});
  }, [fontsReady]);
  if (!fontsReady) return null;

  return (
    <ThemeProvider>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </ThemeProvider>
  );
}