import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Login from "../screens/Login";
import AppDrawer from "./AppDrawer";
import ClubeJotaAdmin from "../screens/ClubeJotaAdmin";
import { useAuth } from "../contexts/AuthContext";

export type RootStackParamList = {
  Login: undefined;
  AppDrawer: undefined;
  ClubeJotaAdmin: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function Routes() {
  const { user, loading } = useAuth();
  if (loading) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="AppDrawer" component={AppDrawer} />
            <Stack.Screen name="ClubeJotaAdmin" component={ClubeJotaAdmin} />
          </>
        ) : (
          <Stack.Screen name="Login" component={Login} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}