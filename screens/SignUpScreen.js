import { useState } from "react";
import { Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, TouchableWithoutFeedback, View } from "react-native";
import { supabase } from "../lib/supabase";

export default function HomeScreen({navigation}) {
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

const handleSignUp = async () => {
    if (!username || !email || !password) {
      Alert.alert("Missing fields", "Please fill in all fields.");
      return;
    }

    // Create new account in Supabase Auth
const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      Alert.alert("Sign Up Failed", error.message);
      console.log("Auth error:", error);
      return;
    }

const user = data.user;

    if (user) {
        const { error: insertError } = await supabase
        .from("weighApp")
        .insert([
        {
        id: user.id, //links to auth.users.id
        username: username.trim(),
        email: email.trim(),
        },
    ]);

    if (insertError) {
        console.log("Database insert error:", insertError.message);
      }
    }

    Alert.alert("Success", "Account created! Please verify your email before logging in.");
    navigation.goBack(); // Redirect to login screen after sign up
  };

    return(
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
    <KeyboardAvoidingView 
    behavior="padding"
    keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
    style={styles.body}>
    <Text style={styles.appName}>
      WeighApp
    </Text>
    <View style={styles.container}>
    <Text style={styles.txt}>
        Registration
    </Text>
    <TextInput
        style={styles.usernameBox}
        placeholder="Username"
        placeholderTextColor="#ffffff"
        value={username}
        onChangeText={setUsername}
        />
    <TextInput 
        style={styles.emailBox}
        placeholder="Enter Email"
        placeholderTextColor="#ffffff"
        value={email}
        onChangeText={setEmail}
        ></TextInput>
    <TextInput
        style={styles.passwordBox}
        placeholder="Enter Password"
        placeholderTextColor="#ffffff"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        ></TextInput>
    <Pressable style={styles.boton} onPress={handleSignUp}>
        <Text>SIGN UP</Text>
    </Pressable>
    <Pressable>
        <Text style={styles.createBtn} onPress={()=>navigation.goBack()}>
          Already Have an Account?
        </Text>
    </Pressable>
    </View> 
  </KeyboardAvoidingView>
  </TouchableWithoutFeedback>

    )
}

const styles = StyleSheet.create({
      boton: {flexDirection:"row",
        color:"#ffffff", 
        backgroundColor:"#96e235",
        borderColor:"#765700ff",
        width:300, 
        marginTop:12,
        paddingVertical:10, 
        borderRadius:100, 
        justifyContent:"center"},

      container:{alignItems:"center",
        width:"90%",
        backgroundColor:"#545454", 
        paddingTop:50,
        paddingBottom:30, 
        borderRadius:50,
        top:-35},

      body: {flex:1,
        alignItems:"center", 
        justifyContent:"center",
        backgroundColor:"#211e1e"},

      usernameBox: {
        borderRadius:50,
        backgroundColor:"#3f3a3a",
        color:"#ffffff",
        height:37,
        width:300, 
        margin:10, 
        padding:10, 
        },
      emailBox: {
        borderRadius:50,
        backgroundColor:"#2f2c2c",
        color:"#ffffff",
        height:37,
        width:300, 
        margin:10, 
        padding:10, 
        },

      passwordBox: {
        borderRadius:50,
        color:"#ffffff",
        backgroundColor:"#211e1e",
        height:37,
        width:300, 
        margin:10, 
        padding:10, 
        },

      txt: {fontSize:35, 
        fontFamily:"arial, roboto", 
        fontWeight:"bold", 
        color:"#ffffff", 
        top:-15},

      appName: {fontSize:55, 
        fontFamily:"arial, roboto", 
        fontWeight:"bold", 
        color:"#96e235",
        alignSelf:"center",
        top:-100},

      signUp: {fontWeight:"bold", 
        fontFamily:"arial, roboto",
        top:20, 
        color:"#ffffff"},

      createBtn: {fontWeight:"bold", 
        color:"#96e235",
        paddingTop:20},
    });