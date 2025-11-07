import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import RadioGroup from 'react-native-radio-buttons-group';
import { supabase } from '../lib/supabase';

const RecommendScreen = () => {
    const [selectedId, setSelectedId] = useState(null);
    const [radioButtons, setRadioButtons] = useState([]);
    const [bmiText, setBmiText] = useState("Fetching BMI...");
    const [weightCategory, setWeightCategory] = useState("");
    const [tdee, setTdee] = useState(0);
    const navigation = useNavigation();

    useEffect(() => {
        const fetchBMIAndTDEE = async () => {
            try {
                const { data: userData, error: userError } = await supabase.auth.getUser();
                if (userError) throw userError;

                const userId = userData?.user?.id;
                if (!userId) {
                    Alert.alert("Error", "User not logged in.");
                    return;
                }

                const { data, error } = await supabase
                    .from("weighApp")
                    .select("bmi, tdee")
                    .eq("id", userId)
                    .single();

                if (error) throw error;

                const bmi = data?.bmi || 0;
                const baseTdee = data?.tdee || 0;
                setTdee(baseTdee);

                let weightCategory;
                if (bmi < 18.5) {
                    weightCategory = "UNDERWEIGHT";
                } else if (bmi >= 18.5 && bmi < 25) {
                    weightCategory = "NORMAL";
                } else if (bmi >= 25 && bmi < 30) {
                    weightCategory = "OVERWEIGHT";
                } else {
                    weightCategory = "OBESE";
                }

                setBmiText(bmi.toFixed(1));
                setWeightCategory(weightCategory);

                setRadioButtons([
                    {
                        id: '1',
                        label: (
                            <Text>
                                <Text style={styles.radioLabel}>    Lose Weight</Text>
                                {bmi >= 25 && <Text style={styles.recommendedLabel}>    (Recommended)</Text>}
                            </Text>
                        ),
                        value: 'lose',
                        labelStyle: styles.radioLabel,
                        containerStyle: styles.radio1,
                    },
                    {
                        id: '2',
                        label: (
                            <Text>
                                <Text style={styles.radioLabel}>    Maintain Weight {'\n'}</Text>
                                {bmi >= 18.5 && bmi <= 24.9 && <Text style={styles.recommendedLabel}>   (Recommended)</Text>}
                            </Text>
                        ),
                        value: 'maintain',
                        labelStyle: styles.radioLabel,
                        containerStyle: styles.radio2,
                    },
                    {
                        id: '3',
                         label: (
                            <Text>
                                <Text style={styles.radioLabel}>    Gain Weight</Text>
                                {bmi < 18.5 && <Text style={styles.recommendedLabel}>   (Recommended)</Text>}
                            </Text>
                        ),
                        value: 'gain',
                        labelStyle: styles.radioLabel,
                        containerStyle: styles.radio3,
                    },
                ]);
            } catch (err) {
                console.error("Error fetching BMI:", err);
                Alert.alert("Error", err.message || "Could not fetch BMI data.");
                setBmiText("Error fetching BMI");
            }
        };

        fetchBMIAndTDEE();
    }, []);

    useEffect(() => {
        const updateTDEE = async () => {
            if (selectedId) {
                const { data: userData } = await supabase.auth.getUser();
                const userId = userData?.user?.id;
                let newTdee = tdee;
                if (selectedId === '1') newTdee = tdee - 500; // Lose
                else if (selectedId === '3') newTdee = tdee + 500; // Gain

                const { error } = await supabase
                    .from("weighApp")
                    .update({ tdee: newTdee })
                    .eq("id", userId);

                if (!error) {
                    setTdee(newTdee);
                }
            }
        };
        updateTDEE();
    }, [selectedId]);

    return (
        <View style={styles.container}>
            <Text style={styles.text}>
                <Text style={styles.text1}>Your BMI: </Text>{bmiText}
                {'\n\n'}
                <Text style={styles.weightCategory}>You are considered </Text>{weightCategory}
            </Text>

            <RadioGroup
                radioButtons={radioButtons}
                onPress={setSelectedId}
                selectedId={selectedId}
                containerStyle={styles.radioGroup}
            />

            <View style={styles.botonContainer}>
                <Pressable style={styles.back} onPress={() => navigation.navigate("Activity")}>
                    <Text style={styles.backText}>←</Text>
                </Pressable>
                <Pressable style={styles.boton} 
                onPress={() => navigation.reset({
                index: 0,
                routes: [{ name: "About" }],
                })
                }>
                    <Text style={styles.botonText}>Next</Text>
                </Pressable>
            </View>
        </View>
    );
};

export default RecommendScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: "center",
        backgroundColor: "#211e1e",
        justifyContent: "space-evenly",
    },
    radioGroup: {
        width: "80%",
    },
    radio1: {
        padding: 15,
        borderRadius: 30,
        marginVertical: 5,
        backgroundColor: "#918787",
        flexDirection: "row",
        alignItems: "center",
        width:"90%",
        height:"20%",
    },
    radio2: {
        padding: 15,
        borderRadius: 30,
        marginVertical: 5,
        backgroundColor: "#545454",
        flexDirection: "row",
        alignItems: "center",
        width:"90%",
        height:"20%",
    },
    radio3: {
        padding: 15,
        borderRadius: 30,
        marginVertical: 5,
        backgroundColor: "#3f3a3a",
        flexDirection: "row",
        alignItems: "center",
        width:"90%",
        height:"20%",
    },
    radioLabel: {
        fontFamily: "arial",
        fontSize: 18,
        fontWeight: "bold",
        color: "#FFFFFF",
    },
    recommendedLabel: {
        padding: 10,
        fontFamily: "arial",
        fontSize: 18,
        fontWeight: "bold",
        color: "#96e235",
    },
    text: {
        fontFamily: "arial",
        fontSize: 24,
        fontWeight: "bold",
        color: "#96e235",
    },
    text1: {
        color:"#ffffff",
    },
    weightCategory: {
        color: "#FFFFFF",
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