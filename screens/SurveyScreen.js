import { useEffect, useState } from "react";
import { Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, TouchableWithoutFeedback } from "react-native";
import { supabase } from "../lib/supabase";

export default function UserInfoForm({ navigation }) {
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [username, setUsername] = useState("");
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        if (userData?.user) {
          const user = userData.user;
          setEmail(user.email);
          setUserId(user.id);

          // Fetch existing user data, including gender
          const { data: existingData, error: fetchError } = await supabase
            .from("weighApp")
            .select("username, age, height_cm, weight_kg, gender")
            .eq("id", user.id)
            .maybeSingle();

          if (fetchError && fetchError.code !== "PGRST116") throw fetchError;

          // If data exists with gender, navigate to About screen
          if (existingData?.gender) {
            navigation.reset({
              index: 0,
              routes: [{ name: "About" }],
            });
            return;
          }

          // If data exists but no gender, auto-fill inputs
          if (existingData) {
            setUsername(existingData.username || "");
            setAge(existingData.age?.toString() || "");
            setHeight(existingData.height_cm?.toString() || "");
            setWeight(existingData.weight_kg?.toString() || "");
          }
        }
      } catch (err) {
        console.error("Error loading user data:", err);
        Alert.alert("Error", err.message || "Something went wrong.");
      } finally {
        setIsLoaded(true);
      }
    };
    loadUserData();
  }, [navigation]);

  const handleSubmit = async () => {
    if (!age || !height || !weight) {
      Alert.alert("Missing fields", "Please fill in all the fields!");
      return;
    }

    const parsedAge = parseFloat(age);
    const parsedHeight = parseFloat(height);
    const parsedWeight = parseFloat(weight);

    if (parsedAge <= 0 || parsedHeight <= 0 || parsedWeight <= 0) {
      Alert.alert("Invalid value", "Please enter numbers greater than zero.");
      return;
    }

    // Calculate BMI: weight_kg / (height_m)^2
    const heightInMeters = parsedHeight / 100;
    const bmi = parsedWeight / (heightInMeters * heightInMeters);

    if (isNaN(bmi) || bmi <= 0) {
      Alert.alert("Invalid BMI", "BMI calculation failed. Please check your height and weight.");
      return;
    }

    try {
      // Check if user already exists
      const { data: existingUser, error: fetchError } = await supabase
        .from("weighApp")
        .select("id")
        .eq("id", userId)
        .maybeSingle();

      if (fetchError && fetchError.code !== "PGRST116") throw fetchError;

      if (existingUser) {
        // Update existing record
        const { error: updateError } = await supabase
          .from("weighApp")
          .update({
            age: parseInt(age),
            height_cm: parsedHeight,
            weight_kg: parsedWeight,
            username: username.trim(),
            bmi: parseFloat(bmi.toFixed(2)), // Round to 2 decimal places
          })
          .eq("id", userId);

        if (updateError) throw updateError;
      } else {
        // Insert new record
        const { error: insertError } = await supabase.from("weighApp").insert({
          id: userId,
          email,
          username: username.trim(),
          age: parseInt(age),
          height_cm: parsedHeight,
          weight_kg: parsedWeight,
          bmi: parseFloat(bmi.toFixed(2)), // Round to 2 decimal places
        });

        if (insertError) throw insertError;
      }

      navigation.navigate("Gender", {
        age: parsedAge,
        height: parsedHeight,
        weight: parsedWeight,
        bmi: parseFloat(bmi.toFixed(2)),
      });
    } catch (err) {
      console.error("Error saving data:", err);
      Alert.alert("Error", err.message || "Something went wrong.");
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
    <KeyboardAvoidingView 
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
        style={styles.container}>
      <Text style={styles.text}>Enter Your Information</Text>
      <TextInput
        style={styles.ageInput}
        placeholder="Enter your age"
        placeholderTextColor="#ffffff"
        keyboardType="decimal-pad"
        value={age}
        onChangeText={setAge}
      />

      <TextInput
        style={styles.heightInput}
        placeholder="Enter your height (cm)"
        placeholderTextColor="#ffffff"
        keyboardType="decimal-pad"
        value={height}
        onChangeText={setHeight}
      />

      <TextInput
        style={styles.weightInput}
        placeholder="Enter your weight (kg)"
        placeholderTextColor="#ffffff"
        keyboardType="decimal-pad"
        value={weight}
        onChangeText={setWeight}
      />
      <Pressable title="Submit" onPress={handleSubmit} style={styles.boton}>
      <Text>SUBMIT</Text>
      </Pressable>
    </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
    container: {
        flex:1,
        alignItems: "center",
        backgroundColor:"#211e1e",
    },
    boton: {
        alignItems:"center",
        justifyContent:"center",
        borderRadius:30,
        height:"5%",
        width:"30%",
        bottom:-25,
        backgroundColor:"#96e235",
    },
    text: {
        fontSize:24,
        color:"#96e235",
        fontWeight:"bold",
        marginBottom:16,
        paddingTop:70,
    },
    ageInput: {
        color:"#ffffff",
        backgroundColor:"#545454",
        width:"75%",
        borderWidth:1,
        padding:25,
        margin:50,
        borderRadius:30,
    },
    weightInput: {
        color:"#ffffff",
        backgroundColor:"#2f2c2c",
        width:"75%",
        borderWidth:1,
        padding:25,
        margin:50,
        borderRadius:30,
    },
    heightInput: {
        color:"#ffffff",
        backgroundColor:"#3f3a3a",
        width:"75%",
        borderWidth:1,
        padding:25,
        margin:50,
        borderRadius:30,
    }
});