import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from '../lib/supabase';

const MealplanScreen = ({ navigation }) => { // Add navigation prop
    const [foods, setFoods] = useState([
        { id: 1, name: "Grilled Chicken Breast (150g)", calories: 250 },
        { id: 2, name: "Quinoa Salad", calories: 120 },
        { id: 3, name: "Steamed Broccoli", calories: 55 },
        { id: 4, name: "Greek Yogurt", calories: 100 },
        { id: 5, name: "Almonds (1 oz)", calories: 160 },
        { id: 6, name: "3 Whole eggs", calories: 210 },
        { id: 7, name: "1 Banana", calories: 90 },
        { id: 8, name: "1 Glass of Milk (250ml)", calories: 150 },
        { id: 9, name: "Peanut Butter (2 tbps)", calories: 190 },
        { id: 10, name: "Whole-grain Bread (2 slices)", calories: 160 },
        { id: 11, name: "1 cup Oatmeal (cooked)", calories: 150 },
        { id: 12, name: "Honey (1 tbps)", calories: 60 },
        { id: 13, name: "Chia seeds (1 tbps)", calories: 60 },
        { id: 14, name: "1 Glass of Milk (200ml)", calories: 120 },
        { id: 15, name: "1 cup Mix Vegetables", calories: 80 },
        { id: 16, name: "1 cup Cooked Brown Rice", calories: 215 },
        { id: 17, name: "Olive Oil (1 tbps)", calories: 120 },
        { id: 18, name: "1/2 Avocado", calories: 120 },
        { id: 19, name: "Lean Ground Beef (100g)", calories: 250 },
        { id: 20, name: "1 cup Cooked Pasta", calories: 200 },
        { id: 21, name: "1/2 cup Tomato Sauce", calories: 60 },
        { id: 22, name: "Grated Cheese (1 tbps)", calories: 40 },
        { id: 23, name: "Mixed Nuts (30g)", calories: 180 },
        { id: 24, name: "2 Boiled Eggs", calories: 140 },
        { id: 25, name: "1 slice Whole-grain Toast", calories: 80 },
        { id: 26, name: "1 cup Mixed Greens", calories: 40 },
        { id: 27, name: "1 cup Low-fat Yogurt", calories: 100 },
        { id: 28, name: "1/4 cup Few Berries", calories: 25 },
        { id: 29, name: "Baked Salmon (100g)", calories: 200 },
        { id: 30, name: "1/2 cup Brown Rice", calories: 110 },
        { id: 31, name: "1 cup Brocolli + Carrots", calories: 55 },
        { id: 32, name: "1 cup Brocolli", calories: 40 },
        { id: 33, name: "Fish Tilapia/Salmon (120g)", calories: 200 },
        { id: 34, name: "1 cup Mashed Potatoes", calories: 180 },
        { id: 35, name: "1 cup Milk", calories: 150 },
        { id: 36, name: "1 slice Cheese", calories: 100 },
        { id: 37, name: "100g Grilled Chicken", calories: 120 },
        { id: 38, name: "1/2 cup Cooked Rice", calories: 120 },
    ]);

    const [totalCalories, setTotalCalories] = useState(0);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedFoodId, setSelectedFoodId] = useState(null);
    const [quantity, setQuantity] = useState("1");
    const [selectedFoods, setSelectedFoods] = useState([]);

    useEffect(() => {
        const fetchSelectedFoods = async () => {
            try {
                const { data: userData, error: userError } = await supabase.auth.getUser();
                if (userError) throw userError;

                const userId = userData?.user?.id;
                if (!userId) {
                    console.error("No user ID found");
                    return;
                }

                // Fetch only today's selected foods
                const today = new Date().toISOString().split('T')[0];
                const { data, error } = await supabase
                    .from("selected_foods")
                    .select("calories, quantity, food_id, created_at")
                    .eq("user_id", userId)
                    .gte("created_at", `${today}T00:00:00.000Z`)
                    .lte("created_at", `${today}T23:59:59.999Z`);

                if (error) {
                    console.error("Error fetching selected foods:", error.message);
                    return;
                }

                const total = data.reduce((sum, item) => sum + (item.calories * (item.quantity || 1)), 0);
                setTotalCalories(total);
                setSelectedFoods(data.map(item => ({
                    food_id: item.food_id,
                    calories: item.calories,
                    quantity: item.quantity
                })));
                setTotalCalories(0);
                setSelectedFoods([]);
            } catch (err) {
                console.error("Error fetching selected foods:", err.message);
            }
        };

        fetchSelectedFoods();

        const subscription = supabase
            .channel('selected_foods-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'selected_foods',
                },
                () => {
                    fetchSelectedFoods();
                }
            )
            .subscribe();

        // Reset state when navigating away
        const unsubscribe = navigation.addListener('blur', () => {
            setTotalCalories(0);
            setSelectedFoods([]);
        });

        return () => {
            supabase.removeChannel(subscription);
            unsubscribe();
        };
    }, [navigation]);

    const handleAddFood = (foodId) => {
        setSelectedFoodId(foodId);
        setQuantity("1");
        setModalVisible(true);
    };

    const handleConfirm = () => {
        if (!selectedFoodId) return;

        const selectedFood = foods.find((food) => food.id === selectedFoodId);
        if (!selectedFood) return;

        const qty = parseFloat(quantity) || 1;
        const totalCaloriesForItem = selectedFood.calories * qty;

        // Update local selected foods state
        setSelectedFoods((prev) => [
            ...prev,
            { food_id: selectedFoodId, calories: selectedFood.calories, quantity: qty }
        ]);

        // Update total calories
        setTotalCalories((prev) => prev + totalCaloriesForItem);

        setModalVisible(false);
        setSelectedFoodId(null);
        setQuantity("1");
    };

    const handleCancel = () => {
        setModalVisible(false);
        setSelectedFoodId(null);
        setQuantity("1");
    };

    const handleDone = async () => {
        try {
            const { data: userData, error: userError } = await supabase.auth.getUser();
            if (userError) throw userError;

            const userId = userData?.user?.id;
            if (!userId) {
                console.error("No user ID found");
                return;
            }

            // Insert all locally selected foods to Supabase
            if (selectedFoods.length > 0) {
                const { error: insertError } = await supabase
                    .from("selected_foods")
                    .insert(
                        selectedFoods.map(food => ({
                            user_id: userId,
                            food_id: food.food_id,
                            calories: food.calories,
                            quantity: food.quantity,
                        }))
                    );

                if (insertError) throw insertError;
            }

            // Fetch current progress
            const { data: weighAppData, error: weighAppError } = await supabase
                .from("weighApp")
                .select("progress")
                .eq("id", userId)
                .single();

            if (weighAppError) throw weighAppError;

            const newProgress = (weighAppData.progress || 0) + totalCalories;

            // Update progress in weighApp
            const { error: updateError } = await supabase
                .from("weighApp")
                .update({ progress: newProgress })
                .eq("id", userId);

            if (updateError) throw updateError;

            // Reset local state
            setTotalCalories(0);
            setSelectedFoods([]);
        } catch (err) {
            console.error("Error handling done:", err.message);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.textContainer}>
                <Text style={styles.text}>
                    MEAL PLAN
                </Text>
            </View>
            <View style={styles.measureContainer}>
                <Text style={styles.textInside}>
                    Total Calories: {totalCalories} kcal
                </Text>
                <Pressable style={styles.doneButton} onPress={handleDone}>
                    <Text style={styles.doneButtonText}>Done</Text>
                </Pressable>
            </View>
            <ScrollView style={styles.foodContainer}>
                {foods.map((food) => (
                    <View key={food.id} style={styles.foodItem}>
                        <Text style={styles.foodText}>
                            {food.name} - {food.calories} kcal
                        </Text>
                        <Pressable
                            style={styles.addButton}
                            onPress={() => handleAddFood(food.id)}
                        >
                            <Text style={styles.addButtonText}>+</Text>
                        </Pressable>
                    </View>
                ))}
            </ScrollView>
            <Modal
                animationType="fade"
                transparent={true}
                visible={modalVisible}
                onRequestClose={handleCancel}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Enter Quantity</Text>
                        <TextInput
                            style={styles.quantityInput}
                            value={quantity}
                            onChangeText={setQuantity}
                            keyboardType="numeric"
                            placeholder="Enter quantity"
                            placeholderTextColor="#999"
                        />
                        <View style={styles.modalButtons}>
                            <Pressable style={styles.cancelButton} onPress={handleCancel}>
                                <Text style={styles.buttonText}>Cancel</Text>
                            </Pressable>
                            <Pressable style={styles.confirmButton} onPress={handleConfirm}>
                                <Text style={styles.buttonText}>Confirm</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

export default MealplanScreen;

// Styles remain unchanged
const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: "center",
        backgroundColor: "#211e1e",
    },
    text: {
        fontSize: 24,
        fontWeight: "bold",
        marginBottom: 16,
        color: "#96e235",
    },
    textInside: {
        color: "#FFFFFF",
        fontWeight: "bold",
    },
    textContainer: {
        marginTop: 15,
        alignItems: "center",
        justifyContent: "center",
        paddingTop: 10,
        borderRadius: 50,
        height: "7%",
        width: "99%",
        backgroundColor: "#3f3a3a",
        marginBottom: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 3.84,
        elevation: 5,
    },
    measureContainer: {
        flexDirection: "row",
        borderRadius: 30,
        height: "10%",
        width: "97%",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: "4%",
        marginBottom: 16,
        backgroundColor: "#3f3a3a",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 3.84,
        elevation: 5,
    },
    doneButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: "#96e235",
        justifyContent: "center",
        alignItems: "center",
    },
    doneButtonText: {
        color: "#211e1e",
        fontSize: 16,
        fontWeight: "bold",
    },
    foodContainer: {
        borderRadius: 30,
        width: "97%",
        marginBottom: 15,
        paddingHorizontal: "2%",
        backgroundColor: "#3f3a3a",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 3.84,
        elevation: 5,
    },
    foodItem: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderBottomWidth: 1,
        borderBottomColor: "#555",
    },
    foodText: {
        color: "#FFFFFF",
        fontSize: 16,
    },
    addButton: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: "#96e235",
        justifyContent: "center",
        alignItems: "center",
    },
    addButtonText: {
        color: "#211e1e",
        fontSize: 20,
        fontWeight: "bold",
    },
    modalContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
    modalContent: {
        width: 300,
        padding: 20,
        backgroundColor: "#3f3a3a",
        borderRadius: 20,
        alignItems: "center",
    },
    modalTitle: {
        fontSize: 18,
        color: "#FFFFFF",
        fontWeight: "bold",
        marginBottom: 15,
    },
    quantityInput: {
        width: "100%",
        height: 40,
        backgroundColor: "#555",
        color: "#FFFFFF",
        borderRadius: 10,
        paddingHorizontal: 10,
        marginBottom: 20,
        fontSize: 16,
    },
    modalButtons: {
        flexDirection: "row",
        justifyContent: "space-between",
        width: "100%",
    },
    cancelButton: {
        width: 120,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#D3D3D3",
        justifyContent: "center",
        alignItems: "center",
    },
    confirmButton: {
        width: 120,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#96e235",
        justifyContent: "center",
        alignItems: "center",
    },
    buttonText: {
        color: "#211e1e",
        fontSize: 16,
        fontWeight: "bold",
    },
});