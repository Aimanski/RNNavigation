import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import ActivityScreen from './screens/ActivityScreen';
import DashboardScreen from './screens/DashboardScreen';
import GenderScreen from './screens/GenderScreen';
import HomeScreen from './screens/HomeScreen';
import MainScreen from './screens/MainScreen';
import MealplanScreen from './screens/MealplanScreen';
import ProfileScreen from './screens/ProfileScreen';
import RecommendScreen from './screens/RecommendScreen';
import SettingScreen from './screens/SettingScreen';
import SignUpScreen from './screens/SignUpScreen';
import SurveyScreen from './screens/SurveyScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="Survey" component={SurveyScreen} />
        <Stack.Screen name="Gender" component={GenderScreen} />
        <Stack.Screen name="Activity" component={ActivityScreen} />
        <Stack.Screen name="Recommend" component={RecommendScreen} />
        <Stack.Screen name="Main" component={MainScreen} />
        <Stack.Screen name="DashboardScreen" component={DashboardScreen} />
        <Stack.Screen name="MealplanScreen" component={MealplanScreen} />
        <Stack.Screen name="SettingScreen" component={SettingScreen} />
        <Stack.Screen name="ProfileScreen" component={ProfileScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}