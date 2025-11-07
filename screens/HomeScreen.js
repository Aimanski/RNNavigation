import { useState } from "react";
import { Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, TouchableWithoutFeedback, View } from "react-native";
import { supabase } from "../lib/supabase";

export default function HomeScreen({navigation}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Missing fields", "Please enter both email and password");
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      Alert.alert("Login failed", error.message);
    } else {
    navigation.reset({
      index: 0,
      routes: [{ name: "Survey" }],
    });
    }
  };
    return(
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
    <KeyboardAvoidingView 
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
        style={styles.body}
        >
    <Text style={styles.appName}>
      WeighApp
    </Text>
    <View style={styles.container}>
      <Text style={styles.txt}>
        WELCOME
      </Text>
    <TextInput 
        style={styles.usernameBox}
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
    <Pressable style={styles.boton} onPress={handleLogin}>
        <Text>LOGIN</Text>
    </Pressable>
    <Pressable>
        <Text style={styles.createBtn} onPress={() => navigation.navigate("SignUp")}>
          Create an Account?
        </Text>
    </Pressable>
    </View> 
  </KeyboardAvoidingView>
  </TouchableWithoutFeedback>

    )
}

const styles = StyleSheet.create({
      boton: {flexDirection:"row",
        marginTop:12,
        backgroundColor:"#96e235",
        width:"35%", 
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

      usernameBox: {borderColor:"#ffffff",
        borderRadius:50,
        color:"#ffffff",
        backgroundColor:"#3f3a3a",
        height:37,
        width:300, 
        margin:10, 
        padding:10, 
        },

      passwordBox: {borderColor:"#ffffff",
        borderRadius:50,
        color:"#ffffff",
        backgroundColor:"#2f2c2c",
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
        top:-125},

      signUp: {fontWeight:"bold", 
        fontFamily:"arial, roboto",
        top:20, color:"#ffffff"},
        
      createBtn: {fontWeight:"bold", 
        color:"#96e235",
        paddingTop:20},
    });