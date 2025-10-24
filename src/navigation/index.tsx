import React from "react";
import {NavigationContainer} from "@react-navigation/native";
import {createNativeStackNavigator} from "@react-navigation/native-stack";
import Login from "../screens/Login";
import Home from "../screens/Home";
import {useAuth} from "../contexts/AuthContext";
import AppDrawer from "./AppDrawer";
import { View, Text } from "react-native";
import SideMenu from "../components/SideMenu";

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  "Eventos": undefined;
  "Parceiros": undefined;
  "Contato": undefined;
  "Sobre": undefined;
  "Perfil": undefined;
  "Clube Jota": undefined;
};

const Screen = ({title}:{title:string}) => <View style={{flex:1, backgroundColor:"#fff"}}><Text>{title}</Text></View>;
const Stack = createNativeStackNavigator<RootStackParamList>();

export default function Routes() {
  const {user, loading} = useAuth();
  if (loading) return null; // ou uma tela de splash

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{headerShown:false}}>
        {user ? (
          <>
            <Stack.Screen name="Home" component={Home}/>
            <Stack.Screen name="Eventos" children={()=> <Screen title="Eventos"/>}/>
            <Stack.Screen name="Parceiros" children={()=> <Screen title="Parceiros"/>}/>
            <Stack.Screen name="Contato" children={()=> <Screen title="Contato"/>}/>
            <Stack.Screen name="Sobre"   children={()=> <Screen title="Sobre"/>}/>
            <Stack.Screen name="Perfil"  children={()=> <Screen title="Perfil"/>}/>
            <Stack.Screen name="Clube Jota" children={()=> <Screen title="Clube Jota"/>}/>
          </>
        ) : (
          <Stack.Screen name="Login" component={Login}/>
        )}
        
      </Stack.Navigator>

      <SideMenu />
    </NavigationContainer>
  );
}