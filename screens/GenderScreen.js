import { useEffect, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "../lib/supabase";

const maleImg = require("../assets/images/lalaki.png");
const femaleImg = require("../assets/images/babae.png");

const GenderScreen = ({ route, navigation }) => {
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const { height, weight, age, bmi } = route.params || {};

  useEffect(() => {
    const checkUserAndGender = async () => {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        if (userData?.user) {
          const userId = userData.user.id;
          setUserId(userId);

          // Check if gender is already set
          const { data: existingData, error: fetchError } = await supabase
            .from("weighApp")
            .select("gender")
            .eq("id", userId)
            .maybeSingle();

          if (fetchError && fetchError.code !== "PGRST116") throw fetchError;

          // If gender exists, navigate to ActivityS creen
          if (existingData?.gender) {
            navigation.navigate("Activity", { height, weight, age, bmi });
          }
        }
      } catch (err) {
        console.error("Error checking user or gender:", err);
        Alert.alert("Error", err.message || "Something went wrong.");
      }
    };
    checkUserAndGender();
  }, [navigation, height, weight, age, bmi]);

  // MALE BUTTON FUNCTION
  const handleMaleSelect = async () => {
    if (!userId) {
      Alert.alert("Error", "User not logged in.");
      return;
    }

    if (!age || !height || !weight || !bmi) {
      Alert.alert("Missing Info", "Please make sure your info is complete first.");
      return;
    }

    if (age <= 0 || height <= 0 || weight <= 0 || bmi <= 0) {
      Alert.alert("Invalid Value", "All values must be greater than zero.");
      return;
    }

    setLoading(true);

    try {
      const bmr = 10 * parseFloat(weight) + 6.25 * parseFloat(height) - 5 * parseFloat(age) + 5;

      if (isNaN(bmr) || bmr <= 0) {
        Alert.alert("Computation Error", "BMR calculation failed. Please check your input values.");
        setLoading(false);
        return;
      }

      const { error: updateError } = await supabase
        .from("weighApp")
        .update({
          gender: "Male",
          bmr: bmr,
        })
        .eq("id", userId);

      if (updateError) throw updateError;

      Alert.alert("Success", "Your gender and BMR have been saved!");
      navigation.navigate("Activity", { height, weight, age, bmi, bmr });
    } catch (err) {
      console.error("Error updating gender or BMR:", err);
      Alert.alert("Error", err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  // FEMALE BUTTON FUNCTION
  const handleFemaleSelect = async () => {
    if (!userId) {
      Alert.alert("Error", "User not logged in.");
      return;
    }

    if (!age || !height || !weight || !bmi) {
      Alert.alert("Missing Info", "Please make sure your info is complete first.");
      return;
    }

    if (age <= 0 || height <= 0 || weight <= 0 || bmi <= 0) {
      Alert.alert("Invalid Value", "All values must be greater than zero.");
      return;
    }

    setLoading(true);

    try {
      const bmr = 10 * parseFloat(weight) + 6.25 * parseFloat(height) - 5 * parseFloat(age) - 161;
      if (isNaN(bmr) || bmr <= 0) {
        Alert.alert("Computation Error", "The value that you enter is invalid.");
        setLoading(false);
        navigation.navigate("Survey");
        return;
      }

      const { error: updateError } = await supabase
        .from("weighApp")
        .update({
          gender: "Female",
          bmr: bmr,
        })
        .eq("id", userId);

      if (updateError) throw updateError;

      Alert.alert("Success", "Your gender and BMR have been saved!");
      navigation.navigate("Activity", { height, weight, age, bmi, bmr });
    } catch (err) {
      console.error("Error updating gender or BMR:", err);
      Alert.alert("Error", err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };
  
    return(
    <View style={styles.container}>
        <View>
            <Pressable style={styles.outer1} onPress={() => handleMaleSelect("Male")}>
            <Image source={maleImg} style={styles.genderM} resizeMode="contain"/>
            <Text style={styles.genderText}>MALE</Text>
            </Pressable>
        </View>
            <Text style={styles.text}>CHOOSE YOUR GENDER</Text>
        <View>
            <Pressable style={styles.outer1} onPress={() => handleFemaleSelect("Female")}>
            <Image source={femaleImg} style={styles.genderF} resizeMode="contain"/>
            <Text style={styles.genderText}>FEMALE</Text>
            </Pressable>
        </View>
        </View>
    );
};

export default GenderScreen;

const styles = StyleSheet.create({
    container: {
        flex:1,
        backgroundColor:"#211e1e",
        alignItems: "center",
        justifyContent:"center",
    },
    text: {
        fontWeight:"bold",
        color:"#96e235",
        fontFamily:"arial, roboto",
        fontSize:20,
    },
    outer1: {
        padding:100,
        alignItems:"center",
    },
    genderM: {
        backgroundColor:"#96e235",
        width:105,
        height:105,
        margin:10,
        padding:25,
        borderWidth:1,
        borderRadius:52.5,
        overflow:"hidden",
    },
    genderText: {
      color:"#ffffff",
      fontWeight:"bold",
    },
    genderF: {
        backgroundColor:"#96e235",
        width:115,
        height:115,
        margin:10,
        padding:25,
        borderWidth:1,
        borderRadius:60.5,
        overflow:"hidden",
    },
});