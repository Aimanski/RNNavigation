// Team

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import {
  Alert,
  Image,
  ImageSourcePropType,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "../components/ui/AppText";
import BrandLogo from "../components/brand/BrandLogo";
import { Colors, useTheme } from "../providers/ThemeProvider";

type Member = {
  image: ImageSourcePropType;
  name: string;
  role: string;
  email: string;
};

const TEAM: Member[] = [
  {
    image: require("../assets/images/AldrinAva.jpg"),
    name: "Aldrin D.M Sombillo",
    role: "Project Leader",
    email: "aldrinsombillo2017@gmail.com",
  },
  {
    image: require("../assets/images/myAvatar.jpg"),
    name: "Aiman U. Balang",
    role: "Programmer",
    email: "aimanumparabalang@gmail.com",
  },
  {
    image: require("../assets/images/kezer.jpg"),
    name: "Kezer M. Acebo",
    role: "System Analyst",
    email: "acebokezer@gmail.com",
  },
  {
    image: require("../assets/images/sian.jpg"),
    name: "Sian Carlo B. Trajano",
    role: "Document Specialist",
    email: "siantrajano5555@gmail.com",
  },
  {
    image: require("../assets/images/halem.png"),
    name: "Halem S. Asamao",
    role: "Document Specialist",
    email: "asamaohalem14@gmail.com",
  },
];

export default function MeetTheTeamScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const writeTo = (email: string) => {
    Linking.openURL(`mailto:${email}`).catch(() =>
      Alert.alert("No email app found", `You can reach them at ${email}.`)
    );
  };

  return (
    <View style={s.container}>
      <View style={s.headerContainer}>
        <Text style={s.header}>Meet the Team</Text>

      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
      >
        {/* Card */}
        <View style={s.appCard}>
          <BrandLogo variant="mark" width={96} style={s.appLogo} />
          <Text style={s.appName}>WeighApp</Text>
          <Text style={s.appTagline}>Your personal health & fitness companion</Text>
          <View style={s.versionPill}>
            <Text style={s.versionText}>Version 1.0</Text>
          </View>
        </View>

        <View style={s.sectionRow}>
          <Text style={s.sectionTitle}>The people behind it</Text>
          <Text style={s.sectionCount}>{TEAM.length} members</Text>
        </View>

        {TEAM.map((member, index) => (
          <View key={member.email} style={[s.memberCard, index === 0 && s.leaderCard]}>
            <View style={s.avatarWrap}>
              <Image source={member.image} style={s.avatar} resizeMode="cover" />
              {index === 0 && (
                <View style={s.leaderBadge}>
                  <Ionicons name="ribbon" size={13} color={colors.onAccent} />
                </View>
              )}
            </View>

            <View style={s.memberInfo}>
              <Text style={s.name} numberOfLines={2}>
                {member.name}
              </Text>

              <View style={s.roleChip}>
                <Text style={s.roleText}>{member.role}</Text>
              </View>

              <Pressable
                style={({ pressed }) => [s.emailRow, pressed && s.pressed]}
                onPress={() => writeTo(member.email)}
                accessibilityRole="link"
                accessibilityLabel={`Email ${member.name}`}
              >
                <Ionicons name="mail-outline" size={16} color={colors.accent} />
                <Text style={s.email} numberOfLines={1} ellipsizeMode="middle">
                  {member.email}
                </Text>
              </Pressable>
            </View>
          </View>
        ))}

        <Text style={s.footer}>Made with love by Team WeighApp © 2025</Text>
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    pressed: { opacity: 0.7 },

    headerContainer: {
      paddingTop: Platform.OS === "android" ? 50 : 20,
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

    scrollContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 60 },

    appCard: {
      alignItems: "center",
      backgroundColor: c.surface,
      borderRadius: 28,
      borderWidth: 1.5,
      borderColor: c.border,
      paddingVertical: 28,
      paddingHorizontal: 24,
      marginBottom: 28,
    },
    appLogo: { marginBottom: 14 },
    appName: {
      fontSize: 30,
      fontWeight: "900",
      color: c.textPrimary,
      letterSpacing: 0.5,
    },
    appTagline: {
      fontSize: 15,
      lineHeight: 22,
      color: c.textSecondary,
      marginTop: 6,
      fontWeight: "600",
      textAlign: "center",
    },
    versionPill: {
      marginTop: 14,
      backgroundColor: c.surfaceAlt,
      borderRadius: 999,
      paddingVertical: 6,
      paddingHorizontal: 14,
    },
    versionText: { fontSize: 13, fontWeight: "700", color: c.accent },

    sectionRow: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      marginBottom: 14,
    },
    sectionTitle: { fontSize: 19, fontWeight: "800", color: c.textPrimary },
    sectionCount: { fontSize: 13, fontWeight: "600", color: c.textMuted },

    memberCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      backgroundColor: c.surface,
      borderRadius: 22,
      borderWidth: 1.5,
      borderColor: c.border,
      padding: 16,
      marginBottom: 14,
    },
    leaderCard: { borderColor: c.accent },

    avatarWrap: { width: 84, height: 84 },
    avatar: {
      width: 84,
      height: 84,
      borderRadius: 42,
      borderWidth: 3,
      borderColor: c.accentLight,
    },
    leaderBadge: {
      position: "absolute",
      right: -2,
      bottom: -2,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: c.accent,
      borderWidth: 2,
      borderColor: c.surface,
      alignItems: "center",
      justifyContent: "center",
    },

    memberInfo: { flex: 1, gap: 8 },
    name: { fontSize: 17, fontWeight: "800", color: c.textPrimary },
    roleChip: {
      alignSelf: "flex-start",
      backgroundColor: c.surfaceAlt,
      borderRadius: 999,
      paddingVertical: 4,
      paddingHorizontal: 12,
    },
    roleText: { fontSize: 12.5, fontWeight: "700", color: c.accent },
    emailRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    email: { flex: 1, fontSize: 13, fontWeight: "600", color: c.textSecondary },

    footer: {
      textAlign: "center",
      fontSize: 13,
      color: c.textMuted,
      marginTop: 18,
      fontWeight: "600",
    },
  });
