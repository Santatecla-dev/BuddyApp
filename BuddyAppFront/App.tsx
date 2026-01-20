import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './src/screens/LoginScreen';
import MyDivesScreen from './src/screens/MyDiveScreen';
import DiveDetailScreen from './src/screens/DiveDetailScreen';
import CreateDiveScreen from './src/screens/CreateDiveScreen';
import InvitationsScreen from './src/screens/InvitationsScreen';
import InviteBuddyScreen from './src/screens/InviteBuddyScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="MyDives" component={MyDivesScreen} />
        <Stack.Screen name="DiveDetail" component={DiveDetailScreen} />
        <Stack.Screen name="CreateDive" component={CreateDiveScreen} />
        <Stack.Screen name="Invitations" component={InvitationsScreen} />
        <Stack.Screen name="InviteBuddy" component={InviteBuddyScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Perfil' }}/>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
