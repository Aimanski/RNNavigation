import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';
import AboutScreen from "../screens/AboutScreen";
import DashboardScreen from '../screens/DashboardScreen';
import MealplanScreen from '../screens/MealplanScreen';
import SettingScreen from '../screens/SettingScreen';

const Tab = createBottomTabNavigator()

export default function AppBottomTabs(){
    return(
        
        <Tab.Navigator>
            <Tab.Screen name="HOME" component={AboutScreen} options={{ headerShown: false, tabBarIcon: ({ color, size }) => (<Icon name="home-outline" size={size} color={color} />),}}/>
            <Tab.Screen name="MealplanScreen" component={MealplanScreen} options={{ headerShown: false }}/>
            <Tab.Screen name="DashboardScreen" component={DashboardScreen} options={{ headerShown: false }}/>
            <Tab.Screen name="SettingScreen" component={SettingScreen} options={{ headerShown: false }}/>
        </Tab.Navigator>
        
    )
}