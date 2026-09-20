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
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerTintColor: '#0077CC',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Login' }} />
        <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Register' }} />
        <Stack.Screen name="MyDives" component={MyDivesScreen} options={{ title: 'My Dives' }} />
        <Stack.Screen name="DiveDetail" component={DiveDetailScreen} options={{ title: 'Dive Details' }} />
        <Stack.Screen name="CreateDive" component={CreateDiveScreen} options={{ title: 'New Dive' }} />
        <Stack.Screen name="Invitations" component={InvitationsScreen} options={{ title: 'Invitations' }} />
        <Stack.Screen name="InviteBuddy" component={InviteBuddyScreen} options={{ title: 'Invite Buddy' }} />
        <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
