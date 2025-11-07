import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons'; // Import MaterialIcons
import DashboardScreen from '../screens/DashboardScreen';
import MealplanScreen from '../screens/MealplanScreen';
import SettingScreen from '../screens/SettingScreen';
import MainScreen from './MainScreen';

const Tab = createBottomTabNavigator();

export default function AppBottomTabs() {
  return (
    <View style={styles.container}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarActiveTintColor: '#96e235',
          tabBarInactiveTintColor: '#D3D3D3',
          tabBarStyle: {
            backgroundColor: '#3f3a3a',
            borderTopColor: '#3f3a3a',
          },
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;

            if (route.name === 'HOME') {
              iconName = focused ? 'home' : 'home';
            } else if (route.name === 'MEAL PLAN') {
              iconName = focused ? 'restaurant' : 'restaurant';
            } else if (route.name === 'DASHBOARD') {
              iconName = focused ? 'description' : 'description';
            } else if (route.name === 'SETTINGS') {
              iconName = focused ? 'settings' : 'settings';
            }

            return <Icon name={iconName} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="HOME" component={MainScreen} options={{ headerShown: false }} />
        <Tab.Screen name="MEAL PLAN" component={MealplanScreen} options={{ headerShown: false }} />
        <Tab.Screen name="DASHBOARD" component={DashboardScreen} options={{ headerShown: false }} />
        <Tab.Screen name="SETTINGS" component={SettingScreen} options={{ headerShown: false }} />
      </Tab.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
});