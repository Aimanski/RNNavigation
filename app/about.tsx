// app/about.tsx — With person icon next to name

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export default function AboutScreen() {
  const router = useRouter();

  const team = [
    {
      image: require("../assets/images/aldrin.jpeg"),
      name: "Aldrin D.M Sombillo",
      role: "Project Leader",
      email: "aldrinsombillo2017@gmail.com",
    },
    {
      image: require("../assets/images/aimanski.jpg"),
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

  return (
    <View style={s.container}>
      <View style={s.fixedHeader}>
        <Pressable onPress={() => router.back()} style={s.backButton}>
          <Ionicons name="arrow-back" size={28} color="#10b981" />
        </Pressable>
        <Text style={s.header}>About Us</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
      >
        <View style={s.introCard}>
          <Text style={s.appName}>WEIGHAPP</Text>
          <Text style={s.appTagline}>Your personal health & fitness companion</Text>
          <Text style={s.appVersion}>Version 1.0 • 2025</Text>
        </View>

        <Text style={s.sectionTitle}>Meet the Team</Text>

        {team.map((member, index) => (
          <View key={index} style={s.memberCard}>
            {/* Avatar */}
            <Image source={member.image} style={s.avatar} resizeMode="cover" />

            {/* Role - Centered */}
            <Text style={s.role}>{member.role}</Text>

            {/* Name with person icon + Email with mail icon */}
            <View style={s.infoLeft}>
              {/* Name + Person Icon */}
              <View style={s.nameContainer}>
                <Ionicons name="person-outline" size={19} color="#065f46" />
                <Text style={s.name}>{member.name}</Text>
              </View>

              {/* Email + Mail Icon */}
              <View style={s.emailContainer}>
                <Ionicons name="mail-outline" size={19} color="#059669" />
                <Text style={s.email}>{member.email}</Text>
              </View>
            </View>
          </View>
        ))}

        <Text style={s.footer}>
          Made with love by Team WeighApp © 2025
        </Text>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fff9" },
  fixedHeader: {
    paddingTop: 50,
    paddingHorizontal: 20,
    backgroundColor: "#f8fff9",
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(16, 185, 129, 0.08)",
  },
  backButton: {
    position: "absolute",
    top: 60,
    left: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  header: {
    fontSize: 28,
    fontWeight: "700",
    color: "#065f46",
    textAlign: "center",
    marginTop: 16,
  },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20 },

  introCard: {
    backgroundColor: "#ffffff",
    borderRadius: 28,
    padding: 32,
    alignItems: "center",
    marginBottom: 40,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 20,
    borderWidth: 2,
    borderColor: "#ecfdf5",
  },
  appName: { fontSize: 38, fontWeight: "900", color: "#065f46", letterSpacing: 1 },
  appTagline: { fontSize: 16, color: "#059669", marginTop: 12, fontWeight: "600", textAlign: "center" },
  appVersion: { fontSize: 14, color: "#94a3b8", marginTop: 8 },
  sectionTitle: { fontSize: 26, fontWeight: "800", color: "#065f46", textAlign: "center", marginBottom: 32 },

  memberCard: {
    width: "98%",
    height: 390,
    alignSelf: "center",
    backgroundColor: "#ffffff",
    borderRadius: 32,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 40,
    marginBottom: 28,
    alignItems: "center",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.24,
    shadowRadius: 30,
    elevation: 22,
    borderWidth: 2.5,
    borderColor: "#ecfdf5",
  },

  avatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 5,
    borderColor: "#86efac",
    marginBottom: 20,
  },

  role: {
    fontSize: 25,
    fontWeight: "700",
    color: "#10b981",
    marginBottom: 28,
    textAlign: "center",
  },

  infoLeft: {
    width: "100%",
    paddingHorizontal: 12,
    gap: 14,
  },

  nameContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  name: {
    fontSize: 18,
    fontWeight: "900",
    color: "#065f46",
  },

  emailContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  email: {
    fontSize: 14,
    color: "#059669",
    fontWeight: "600",
  },

  footer: {
    textAlign: "center",
    fontSize: 15,
    color: "#94a3b8",
    marginTop: 20,
    marginBottom: 60,
    fontWeight: "600",
  },
});