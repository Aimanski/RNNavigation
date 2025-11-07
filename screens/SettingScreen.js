import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "../lib/supabase";

const SettingScreen = ({ navigation }) => {
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert("Logout failed", error.message);
    } else {
      Alert.alert("Success", "You have been logged out");
      navigation.reset({ index: 0, routes: [{ name: "Home" }] });
    }
  };

  // Action when pressing the ">" button
  const handleTilePress = (title) => {
    Alert.alert("Pressed", `${title} >`);
    // Replace with: navigation.navigate('YourScreen');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>SETTINGS</Text>

      {/* 2×2 Grid */}
      <View style={styles.gridContainer}>
        {["Account", "Update Information", "Set reminders", "Sleep", "Blood Pressure", "Help & support", "Give feedback", "About us"].map(
          (title) => (
            <Pressable key={title} style={styles.gridItem}>
              <View style={styles.box}>
                {/* Tile text - centered at top */}
                <Text style={styles.listText}>{title}</Text>

                {/* Circle ">" Button - BOTTOM CENTER */}
                <Pressable
                  style={styles.circleBtn}
                  onPress={() => handleTilePress(title)}
                >
                  <Text style={styles.circleText}>›</Text>
                </Pressable>
              </View>
            </Pressable>
          )
        )}
      </View>

      {/* Logout Button */}
      <Pressable style={styles.boton} onPress={handleLogout}>
        <Text style={styles.logoutText}>LOGOUT</Text>
      </Pressable>
    </View>
  );
};

export default SettingScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#211e1e",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  header: {
    margin: 15,
    textAlign: "center",
    padding: "2.5%",
    borderRadius: 50,
    height: "7%",
    width: "99%",
    backgroundColor: "#3f3a3a",
    fontSize: 24,
    color: "#96e235",
    fontWeight: "bold",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 3.84,
    elevation: 5,
  },

  /* Grid Layout */
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 15,
  },
  gridItem: {
    width: "48%",
    marginBottom: 16,
  },
  box: {
    borderRadius: 30,
    height: 120,
    backgroundColor: "#3f3a3a",
    padding: 12,
    justifyContent: "space-between", // Text at top, button at bottom
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  listText: {
    fontSize: 15,
    color: "#FFF",
    fontWeight: "600",
    textAlign: "center", // Center text horizontally
    flex: 1, // Take available space at top
    justifyContent: "center", // Center text vertically in its space
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 3.84,
    elevation: 5,
  },

  /* Circle ">" Button - BOTTOM CENTER */
  circleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#565656ff",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center", // Center horizontally at bottom
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3.84,
    elevation: 5,
  },
  circleText: {
    color: "#96e235",
    fontSize: 25,
    fontWeight: "bold",
    marginLeft: 2,
  },

  /* Logout Button */
  boton: {
    backgroundColor: "#96e235",
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 3.84,
    elevation: 5,
  },
  logoutText: {
    color: "#211e1e",
    fontWeight: "bold",
    fontSize: 11,
  },
});