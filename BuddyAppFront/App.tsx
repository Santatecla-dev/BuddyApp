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
        <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Sign in' }} />
        <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Create account' }} />
        <Stack.Screen name="MyDives" component={MyDivesScreen} options={{ title: 'My dives' }} />
        <Stack.Screen name="DiveDetail" component={DiveDetailScreen} options={{ title: 'Dive details' }} />
        <Stack.Screen name="CreateDive" component={CreateDiveScreen} options={{ title: 'Log a dive' }} />
        <Stack.Screen name="Invitations" component={InvitationsScreen} options={{ title: 'Invitations' }} />
        <Stack.Screen name="InviteBuddy" component={InviteBuddyScreen} options={{ title: 'Invite a buddy' }} />
        <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }}/>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
