import React from "react";
import {
  createDrawerNavigator,
  DrawerContentScrollView,
} from "@react-navigation/drawer";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Home from "../screens/Home";
import Partners from "../screens/Partners";
import Contact from "../screens/Contact";
import { useAuth } from "../contexts/AuthContext";

export type DrawerParamList = {
  Home: undefined;
  Eventos: undefined;
  Parceiros: undefined;
  Contato: undefined;
  Sobre: undefined;
  Perfil: undefined;
  "Clube Jota": undefined;
};

const Drawer = createDrawerNavigator<DrawerParamList>();
const BG = "#274C34";

function CustomDrawerContent(props: any) {
  const current = props.state?.routeNames?.[props.state?.index ?? 0] ?? "Home";
  const { signOutApp } = useAuth();

  const items = [
    { name: "Home", label: "Home", icon: (f:boolean)=><Ionicons name={f?"home":"home-outline"} size={22} color="#fff" /> },
    { name: "Eventos", label: "Eventos", icon: () => <MaterialCommunityIcons name="map" size={22} color="#fff" /> },
    { name: "Parceiros", label: "Parceiros", icon: () => <MaterialCommunityIcons name="handshake" size={22} color="#fff" /> },
    { name: "Contato", label: "Contato", icon: () => <Feather name="phone" size={22} color="#fff" /> },
    { name: "Sobre", label: "Sobre", icon: () => <Feather name="info" size={22} color="#fff" /> },
    { name: "Perfil", label: "Perfil", icon: () => <Feather name="user" size={22} color="#fff" /> },
    { name: "Clube Jota", label: "Clube Jota", icon: () => <MaterialCommunityIcons name="account-group" size={22} color="#fff" /> },
  ] as const;

  return (
    <DrawerContentScrollView {...props} style={{ backgroundColor: BG }} contentContainerStyle={{ flex: 1, paddingTop: 41 }}>
      <Text style={styles.menuTitle}>Menu</Text>

      <View style={{ paddingVertical: 6 }}>
        {items.map((it) => {
          const focused = current === it.name;
          return (
            <TouchableOpacity
              key={it.name}
              onPress={() => props.navigation.navigate(it.name)}
              activeOpacity={0.9}
              style={[styles.row, focused && styles.rowActive]}
            >
              <View style={styles.rowIcon}>{it.icon(focused)}</View>
              <Text style={[styles.rowLabel, focused && styles.rowLabelActive]}>{it.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ flex: 1 }} />

      <TouchableOpacity onPress={() => signOutApp()} activeOpacity={0.9} style={[styles.row, { marginBottom: 16 }]}>
        <View style={styles.rowIcon}><Feather name="log-out" size={22} color="#eee" /></View>
        <Text style={styles.rowLabel}>Sair</Text>
      </TouchableOpacity>
    </DrawerContentScrollView>
  );
}

export default function AppDrawer() {
  return (
    <Drawer.Navigator
      screenOptions={{
        headerShown: false,
        drawerType: "slide",
        overlayColor: "rgba(0,0,0,0.45)",
        drawerStyle: { width: 290, backgroundColor: BG },
      }}
      drawerContent={(p) => <CustomDrawerContent {...p} />}
    >
      <Drawer.Screen name="Home" component={Home} />
      <Drawer.Screen name="Eventos" component={() => null} />
      <Drawer.Screen name="Parceiros" component={Partners} />
      <Drawer.Screen name="Contato" component={Contact} />
      <Drawer.Screen name="Sobre" component={() => null} />
      <Drawer.Screen name="Perfil" component={() => null} />
      <Drawer.Screen name="Clube Jota" component={() => null} />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  menuTitle: { color: "#DDE9E0", fontSize: 22, fontWeight: "800", marginLeft: 20, marginBottom: 30 },
  row: { flexDirection: "row", alignItems: "center",  paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12,  marginHorizontal: 10, marginVertical: 10 },
  rowActive: { backgroundColor: "rgba(255,255,255,0.10)" },
  rowIcon: { width: 28, alignItems: "center", marginRight: 10 },
  rowLabel: { color: "#E7F2EA", fontSize: 21, fontWeight: "700" },
  rowLabelActive: { color: "#fff" },
});
