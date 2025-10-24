import React from "react";
import {
  createDrawerNavigator,
  DrawerContentScrollView
} from "@react-navigation/drawer";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet
} from "react-native";
import { Feather, MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import Home from "../screens/Home";
import { useAuth } from "../contexts/AuthContext";

/** ------- Placeholders para as telas (foco é o menu) ------- */
const GREEN = "#1FA83D";
const BG = "#274C34"; // verde escuro do drawer

function ScreenShell({title}: {title: string}) {
  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
      <View style={{ padding: 16 }}>
        <Text style={{ color: "#333" }}>
          {title} – conteúdo será implementado depois.
        </Text>
      </View>
    </View>
  );
}
const Eventos    = () => <ScreenShell title="Eventos" />;
const Parceiros  = () => <ScreenShell title="Parceiros" />;
const Contato    = () => <ScreenShell title="Contato" />;
const Sobre      = () => <ScreenShell title="Sobre" />;
const Perfil     = () => <ScreenShell title="Perfil" />;
const ClubeJota  = () => <ScreenShell title="Clube Jota" />;
/** ---------------------------------------------------------- */

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

type Item = {
  name: keyof DrawerParamList;
  label: string;
  icon: (focused: boolean) => React.ReactNode;
};

const MENU: Item[] = [
  {
    name: "Home",
    label: "Home",
    icon: (f) => <Ionicons name={f ? "home" : "home-outline"} size={22} color={f ? "#fff" : "#0A0"} />
  },
  {
    name: "Eventos",
    label: "Eventos",
    icon: (f) => <MaterialCommunityIcons name="map" size={22} color={f ? "#fff" : "#0A0"} />
  },
  {
    name: "Parceiros",
    label: "Parceiros",
    icon: (f) => <MaterialCommunityIcons name="handshake" size={22} color={f ? "#fff" : "#0A0"} />
  },
  {
    name: "Contato",
    label: "Contato",
    icon: (f) => <Feather name="phone" size={22} color={f ? "#fff" : "#0A0"} />
  },
  {
    name: "Sobre",
    label: "Sobre",
    icon: (f) => <Feather name="info" size={22} color={f ? "#fff" : "#0A0"} />
  },
  {
    name: "Perfil",
    label: "Perfil",
    icon: (f) => <Feather name="user" size={22} color={f ? "#fff" : "#0A0"} />
  },
  {
    name: "Clube Jota",
    label: "Clube Jota",
    icon: (f) => <MaterialCommunityIcons name="account-group" size={22} color={f ? "#fff" : "#0A0"} />
  },
];

function CustomDrawerContent(props: any) {
  const current =
    props.state?.routeNames?.[props.state?.index ?? 0] ?? "Home";
  const { signOutApp } = useAuth();

  return (
    <DrawerContentScrollView
      {...props}
      style={{ backgroundColor: BG }}
      contentContainerStyle={{ flex: 1, paddingTop: 24 }}
    >
      {/* Título "Menu" */}
      <Text style={styles.menuTitle}>Menu</Text>

      {/* Itens */}
      <View style={{ paddingVertical: 6 }}>
        {MENU.map((it) => {
          const focused = current === it.name;
          return (
            <TouchableOpacity
              key={it.name}
              onPress={() => props.navigation.navigate(it.name)}
              activeOpacity={0.9}
              style={[
                styles.row,
                focused && styles.rowActive,
              ]}
            >
              <View style={styles.rowIcon}>
                {it.icon(focused)}
              </View>
              <Text style={[styles.rowLabel, focused && styles.rowLabelActive]}>
                {it.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ flex: 1 }} />

      {/* Sair */}
      <TouchableOpacity
        onPress={() => signOutApp()}
        activeOpacity={0.9}
        style={[styles.row, { marginBottom: 16 }]}
      >
        <View style={styles.rowIcon}>
          <Feather name="log-out" size={22} color="#eee" />
        </View>
        <Text style={[styles.rowLabel]}>Sair</Text>
      </TouchableOpacity>

      {/* Rodapé opcional */}
      <Text style={styles.footer}>Jota Expedições</Text>
    </DrawerContentScrollView>
  );
}

export default function AppDrawer() {
  return (
    <Drawer.Navigator
      screenOptions={{
        headerShown: false,
        drawerType: "slide",
        drawerStyle: {
          width: 290,
          backgroundColor: BG,
        },
        // escurece a tela ao abrir o menu
        overlayColor: "rgba(0,0,0,0.45)",
        // desabilita a UI padrão do Drawer (usamos conteúdo customizado)
      }}
      drawerContent={(p) => <CustomDrawerContent {...p} />}
    >
      <Drawer.Screen name="Home" component={Home} />
      <Drawer.Screen name="Eventos" component={Eventos} />
      <Drawer.Screen name="Parceiros" component={Parceiros} />
      <Drawer.Screen name="Contato" component={Contato} />
      <Drawer.Screen name="Sobre" component={Sobre} />
      <Drawer.Screen name="Perfil" component={Perfil} />
      <Drawer.Screen name="Clube Jota" component={ClubeJota} />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 72,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "800" },

  menuTitle: {
    color: "#DDE9E0",
    fontSize: 22,
    fontWeight: "800",
    marginLeft: 20,
    marginBottom: 14,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    marginHorizontal: 10,
    marginVertical: 3,
  },
  rowActive: {
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  rowIcon: { width: 28, alignItems: "center", marginRight: 10 },
  rowLabel: { color: "#E7F2EA", fontSize: 18, fontWeight: "700" },
  rowLabelActive: { color: "#fff" },

  footer: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    marginLeft: 20,
    marginBottom: 18,
  },
});
