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
import DiveStatsScreen from './src/screens/DiveStatsScreen';
import PlanDiveScreen from './src/screens/PlanDiveScreen';
import PlannedDivesScreen from './src/screens/PlannedDivesScreen';
import PlannedDiveDetailScreen from './src/screens/PlannedDiveDetailScreen';
import DiveTripsScreen from './src/screens/DiveTripsScreen';
import DiveTripWorkspaceScreen from './src/screens/DiveTripWorkspaceScreen';
import DiveMapScreen from './src/screens/DiveMapScreen';
import DiveActivityScreen from './src/screens/DiveActivityScreen';
import PokedexScreen from './src/screens/PokedexScreen';

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
        <Stack.Screen name="DiveStats" component={DiveStatsScreen} options={{ title: 'Dive statistics' }} />
        <Stack.Screen name="PlanDive" component={PlanDiveScreen} options={{ title: 'Plan a dive' }} />
        <Stack.Screen name="PlannedDives" component={PlannedDivesScreen} options={{ title: 'Planned dives' }} />
        <Stack.Screen name="PlannedDiveDetail" component={PlannedDiveDetailScreen} options={{ title: 'Planned dive' }} />
        <Stack.Screen name="DiveTrips" component={DiveTripsScreen} options={{ title: 'Dive trips' }} />
        <Stack.Screen name="DiveTripWorkspace" component={DiveTripWorkspaceScreen} options={{ title: 'Trip workspace' }} />
        <Stack.Screen name="DiveMap" component={DiveMapScreen} options={{ title: 'Dive map' }} />
        <Stack.Screen name="DiveActivity" component={DiveActivityScreen} options={{ title: 'Dive activity' }} />
        <Stack.Screen name="Pokedex" component={PokedexScreen} options={{ title: 'Pokedex' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
