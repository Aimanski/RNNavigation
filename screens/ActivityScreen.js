import { useNavigation, useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import RadioGroup from 'react-native-radio-buttons-group';
import { supabase } from '../lib/supabase';

const ActivityScreen = () => {
    const [selectedId, setSelectedId] = useState(null);
    const [loading, setLoading] = useState(false);
    const navigation = useNavigation();
    const route = useRoute();
    
    // Safely access route.params with fallback
    const { height = 0, weight = 0, age = 0, bmi = 0, bmr = 0 } = route.params || {};

    const radioButtons = [
        {
            id: '1',
            label: 'Less Active\nOffice worker, student                             \n',
            value: 'less_active',
            labelStyle: styles.radioLabel,
            containerStyle: styles.radio1,
        },
        {
            id: '2',
            label: 'Lightly Active\nCasual walker, occasional workouts',
            value: 'lightly_active',
            labelStyle: styles.radioLabel,
            containerStyle: styles.radio2,
        },
        {
            id: '3',
            label: 'Active\nRegular gym-goer, light physical job',
            value: 'active',
            labelStyle: styles.radioLabel,
            containerStyle: styles.radio3,
        },
        {
            id: '4',
            label: 'Very Active\nAthlete, manual laborer, fitness enthusiast',
            value: 'very_active',
            labelStyle: styles.radioLabel,
            containerStyle: styles.radio4,
        },
        {
            id: '5',
            label: 'Extra Active\nConstruction worker, soldier, professional athlete',
            value: 'extra_active',
            labelStyle: styles.radioLabel,
            containerStyle: styles.radio5,
        },
    ];

    const handleNext = async () => {
        if (!selectedId) {
            Alert.alert("Error", "Please select an activity level.");
            return;
        }

        if (!bmr || bmr <= 0) {
            Alert.alert("Missing Info", "BMR is required for TDEE calculation. Please complete previous steps.");
            navigation.navigate("Gender");
            return;
        }

        setLoading(true);

        try {
            const { data: userData, error: userError } = await supabase.auth.getUser();
            if (userError) throw userError;

            const userId = userData?.user?.id;
            if (!userId) {
                Alert.alert("Error", "User not logged in.");
                return;
            }

            let tdee;
            switch (selectedId) {
                case '1':
                    tdee = bmr * 1.2; // Less Active
                    break;
                case '2':
                    tdee = bmr * 1.375; // Lightly Active
                    break;
                case '3':
                    tdee = bmr * 1.55; // Active
                    break;
                case '4':
                    tdee = bmr * 1.725; // Very Active
                    break;
                case '5':
                    tdee = bmr * 1.9; // Extra Active
                    break;
                default:
                    throw new Error("Invalid activity level selected.");
            }

            if (isNaN(tdee) || tdee <= 0) {
                Alert.alert("Computation Error", "TDEE calculation failed. Please check your input values.");
                return;
            }

            const { error: updateError } = await supabase
                .from("weighApp")
                .update({ tdee: parseFloat(tdee.toFixed(2)) })
                .eq("id", userId);

            if (updateError) throw updateError;

            Alert.alert("Success", "Your activity level and TDEE have been saved!");
            navigation.navigate("Recommend");
        } catch (err) {
            console.error("Error updating TDEE:", err);
            Alert.alert("Error", err.message || "Something went wrong.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.text}>
                What is your activity level?
            </Text>

            <RadioGroup
                radioButtons={radioButtons}
                onPress={setSelectedId}
                selectedId={selectedId}
                containerStyle={styles.radioGroup}
            />

            <View style={styles.botonContainer}>
                <Pressable style={styles.back} onPress={() => navigation.goBack()}>
                    <Text style={styles.backText}>←</Text>
                </Pressable>
                <Pressable style={styles.boton} onPress={handleNext} disabled={loading}>
                    <Text style={styles.botonText}>Next</Text>
                </Pressable>
            </View>
        </View>
    );
};


export default ActivityScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: "center",
        justifyContent: "space-evenly",
        backgroundColor: "#211e1e",
    },
    radioGroup: {
        width: "80%",
    },
    radio1: {
        padding: 15,
        borderRadius: 30,
        marginVertical: 5,
        backgroundColor: "#918787",
        flexDirection: 'row',
        alignItems: 'center',
    },
    radio2: {
        padding: 15,
        borderRadius: 30,
        marginVertical: 5,
        backgroundColor: "#736f6f",
        flexDirection: 'row',
        alignItems: 'center',
    },
    radio3: {
        padding: 15,
        borderRadius: 30,
        marginVertical: 5,
        backgroundColor: "#545454",
        flexDirection: 'row',
        alignItems: 'center',
    },
    radio4: {
        padding: 15,
        borderRadius: 30,
        marginVertical: 5,
        backgroundColor: "#3f3a3a",
        flexDirection: 'row',
        alignItems: 'center',
    },
    radio5: {
        padding: 15,
        borderRadius: 30,
        marginVertical: 5,
        backgroundColor: "#2f2c2c",
        flexDirection: 'row',
        alignItems: 'center',
    },
    radioLabel: {
        fontFamily: "arial",
        fontSize: 18,
        fontWeight: "bold",
        color: "#FFFFFF",
    },
    text: {
        fontFamily: "arial",
        fontSize: 24,
        fontWeight: "bold",
        color: "#96e235",
    },
    botonContainer: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        width: "80%",
        paddingBottom: 20,
    },
    boton: {
        backgroundColor: "#96e235",
        height: 50,
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        borderRadius: 25,
        marginLeft: 10,
    },
    botonText: {
        color: "#0c3b2e",
        fontSize: 18,
        fontWeight: "bold",
    },
    back: {
        backgroundColor: "#96e235",
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: "center",
        alignItems: "center",
    },
    backText: {
        color: "#0c3b2e",
        fontSize: 18,
        fontWeight: "bold",
    },
});