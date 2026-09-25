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
import MarineLifeMapScreen from './src/screens/MarineLifeMapScreen';
import DiveActivityScreen from './src/screens/DiveActivityScreen';
import EquipmentScreen from './src/screens/EquipmentScreen';
import EquipmentDetailScreen from './src/screens/EquipmentDetailScreen';
import AchievementsScreen from './src/screens/AchievementsScreen';
import PokedexScreen from './src/screens/PokedexScreen';
import ActivityFeedScreen from './src/screens/ActivityFeedScreen';
import CenterRegisterScreen from './src/screens/CenterRegisterScreen';
import CenterDashboardScreen from './src/screens/CenterDashboardScreen';
import CenterInventoryScreen from './src/screens/CenterInventoryScreen';
import CenterClientsScreen from './src/screens/CenterClientsScreen';
import CenterLogDiveScreen from './src/screens/CenterLogDiveScreen';
import CenterProfileScreen from './src/screens/CenterProfileScreen';
import CenterWarehouseScreen from './src/screens/CenterWarehouseScreen';
import CenterDiveRostersScreen from './src/screens/CenterDiveRostersScreen';
import CenterDiveSitesScreen from './src/screens/CenterDiveSitesScreen';
import CenterDiveSiteDetailScreen from './src/screens/CenterDiveSiteDetailScreen';

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
        <Stack.Screen name="CenterRegister" component={CenterRegisterScreen} options={{ title: 'Register dive center', headerTintColor: '#123b52' }} />
        <Stack.Screen name="CenterDashboard" component={CenterDashboardScreen} options={{ title: 'Center workspace', headerTintColor: '#123b52' }} />
        <Stack.Screen name="CenterProfile" component={CenterProfileScreen} options={{ title: 'Center profile', headerTintColor: '#123b52' }} />
        <Stack.Screen name="CenterWarehouse" component={CenterWarehouseScreen} options={{ title: 'Warehouse layout', headerTintColor: '#123b52' }} />
        <Stack.Screen name="CenterDiveRosters" component={CenterDiveRostersScreen} options={{ title: 'Dive center rosters', headerTintColor: '#123b52' }} />
        <Stack.Screen name="CenterDiveSites" component={CenterDiveSitesScreen} options={{ title: 'Dive sites map', headerTintColor: '#123b52' }} />
        <Stack.Screen name="CenterDiveSiteDetail" component={CenterDiveSiteDetailScreen} options={{ title: 'Dive zone profile', headerTintColor: '#123b52' }} />
        <Stack.Screen name="CenterInventory" component={CenterInventoryScreen} options={{ title: 'Center inventory', headerTintColor: '#123b52' }} />
        <Stack.Screen name="CenterClients" component={CenterClientsScreen} options={{ title: 'Center clients', headerTintColor: '#123b52' }} />
        <Stack.Screen name="CenterLogDive" component={CenterLogDiveScreen} options={{ title: 'Log center dive', headerTintColor: '#123b52' }} />
        <Stack.Screen name="CenterPlanDive" component={PlanDiveScreen} initialParams={{ centerMode: true }} options={{ title: 'Plan center dive', headerTintColor: '#123b52' }} />
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
        <Stack.Screen name="MarineLifeMap" component={MarineLifeMapScreen} options={{ title: 'Marine life map' }} />
        <Stack.Screen name="DiveActivity" component={DiveActivityScreen} options={{ title: 'Dive activity' }} />
        <Stack.Screen name="Equipment" component={EquipmentScreen} options={{ title: 'My equipment' }} />
        <Stack.Screen name="EquipmentDetail" component={EquipmentDetailScreen} options={{ title: 'Equipment detail' }} />
        <Stack.Screen name="Achievements" component={AchievementsScreen} options={{ title: 'Achievements' }} />
        <Stack.Screen name="Pokedex" component={PokedexScreen} options={{ title: 'Pokedex' }} />
        <Stack.Screen name="ActivityFeed" component={ActivityFeedScreen} options={{ title: 'Buddy activity' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
