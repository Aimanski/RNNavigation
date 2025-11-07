import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { supabase } from '../lib/supabase';

// Philippines Time Helpers (UTC+8)
const PH_OFFSET_MS = 8 * 60 * 60 * 1000; // +8 hours

const toPHDate = (date) => new Date(new Date(date).getTime() + PH_OFFSET_MS);

const getPHDateString = (dateString) => {
  const phDate = toPHDate(dateString);
  return `${phDate.getUTCFullYear()}-${String(phDate.getUTCMonth() + 1).padStart(2, '0')}-${String(phDate.getUTCDate()).padStart(2, '0')}`;
};

const formatPHDate = (dateString) => {
  const phDate = toPHDate(dateString);
  return phDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const DashboardScreen = () => {
    const [dailyCalories, setDailyCalories] = useState([]);

    useEffect(() => {
        const fetchDailyCalories = async () => {
            try {
                const { data: userData, error: userError } = await supabase.auth.getUser();
                if (userError) throw userError;

                const userId = userData?.user?.id;
                if (!userId) {
                    console.error("No user ID found");
                    return;
                }

                // Fetch selected foods with created_at timestamp
                const { data, error } = await supabase
                    .from("selected_foods")
                    .select("calories, quantity, created_at")
                    .eq("user_id", userId)
                    .order("created_at", { ascending: false });

                if (error) {
                    console.error("Error fetching calorie history:", error.message);
                    return;
                }

                // Group by PH date (UTC+8)
                const groupedByDate = data.reduce((acc, item) => {
                    const phDateStr = getPHDateString(item.created_at);
                    if (!acc[phDateStr]) {
                        acc[phDateStr] = 0;
                    }
                    acc[phDateStr] += item.calories * (item.quantity || 1);
                    return acc;
                }, {});

                // Convert to array for display
                const calorieHistory = Object.entries(groupedByDate)
                    .map(([date, calories]) => ({
                        date,
                        calories: Math.round(calories),
                    }))
                    .sort((a, b) => b.date.localeCompare(a.date)); // Latest first

                setDailyCalories(calorieHistory);

                // Set up real-time subscription
                const subscription = supabase
                    .channel('selected_foods-changes')
                    .on(
                        'postgres_changes',
                        {
                            event: '*',
                            schema: 'public',
                            table: 'selected_foods',
                            filter: `user_id=eq.${userId}`,
                        },
                        () => {
                            fetchDailyCalories(); // Re-fetch on any change
                        }
                    )
                    .subscribe();

                return () => {
                    supabase.removeChannel(subscription);
                };
            } catch (err) {
                console.error("Error fetching calorie history:", err.message);
            }
        };

        fetchDailyCalories();
    }, []);

    return (
        <View style={styles.body}>
            <Text style={styles.text}>CALORIE HISTORY</Text>
            <View style={styles.container}>
                <Text style={styles.textHistory}>Daily Calorie Intake</Text>
                <ScrollView style={styles.historyContainer}>
                    {dailyCalories.length > 0 ? (
                        dailyCalories.map((entry, index) => (
                            <View key={index} style={styles.historyItem}>
                                <Text style={styles.historyText}>
                                    {formatPHDate(entry.date + 'T00:00:00Z')}: {entry.calories} kcal
                                </Text>
                            </View>
                        ))
                    ) : (
                        <Text style={styles.noDataText}>No calorie data available</Text>
                    )}
                </ScrollView>
            </View>
        </View>
    );
};

export default DashboardScreen;

const styles = StyleSheet.create({
    body: {
        flex: 1,
        alignItems: "center",
        backgroundColor: "#211e1e",
    },
    container: {
        borderRadius: 30,
        alignItems: "center",
        width: "97%",
        height: "87%",
        paddingHorizontal: "2%",
        backgroundColor: "#3f3a3a",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 3.84,
        elevation: 5,
    },
    text: {
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
    textHistory: {
        color: "#ffffff",
        fontSize: 18,
        fontWeight: "bold",
        marginVertical: 10,
    },
    historyContainer: {
        width: "100%",
        paddingHorizontal: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 3.84,
        elevation: 5,
    },
    historyItem: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: "#555",
    },
    historyText: {
        color: "#ffffff",
        fontSize: 16,
    },
    noDataText: {
        color: "#999",
        fontSize: 16,
        textAlign: "center",
        marginTop: 20,
    },
});