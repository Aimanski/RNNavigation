import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AboutScreen from "../screens/AboutScreen";
import ActivityScreen from "../screens/ActivityScreen";
import GenderScreen from "../screens/GenderScreen";
import HomeScreen from "../screens/HomeScreen";
import RecommendScreen from "../screens/RecommendScreen";
import SignUpScreen from "../screens/SignUpScreen";
import SurveyScreen from "../screens/SurveyScreen";


const Stack = createNativeStackNavigator();

export default function App() {
    return(
            <Stack.Navigator options={{ headerShown: false }}>
                <Stack.Screen name="Home" component={HomeScreen}  options={{ headerShown: false }}/>
                <Stack.Screen name="About" component={AboutScreen}  options={{ headerShown: false }}/>
                <Stack.Screen name="SignUp" component={SignUpScreen}  options={{ headerShown: false }}/>
                <Stack.Screen name="Survey" component={SurveyScreen}  options={{ headerShown: false }}/>
                <Stack.Screen name="Gender" component={GenderScreen}  options={{ headerShown: false }}/>
                <Stack.Screen name="Activity" component={ActivityScreen}  options={{ headerShown: false }}/>
                <Stack.Screen name="Recommend" component={RecommendScreen}  options={{ headerShown: false }}/>
            </Stack.Navigator>
    );
}