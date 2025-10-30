import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  StatusBar,
  Linking,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import type { DrawerScreenProps } from "@react-navigation/drawer";
import type { DrawerParamList } from "../navigation/AppDrawer";

type Props = DrawerScreenProps<DrawerParamList, "Parceiros">;

type Partner = {
  id: string;
  name: string;
  description: string;
  link: string;
  imageRes: number;
};

const STORAGE_KEY = "@jota_partners_v";
const STORAGE_VERSION = 1;

const GREEN = "#1FA83D";
const CARD_BG = "#E6E6E6";

const seedPartners: Partner[] = [
  {
    id: "p-1",
    name: "Union Off Road",
    description: "Customizações e Mecânica",
    link: "https://www.instagram.com/union.offroad",
    imageRes: require("../assets/logo-union.png"),
  },
  {
    id: "p-2",
    name: "Careca AutoPeças",
    description: "Peças Automotivas",
    link: "https://carecaautopecas.com.br",
    imageRes: require("../assets/logo-careca.png"),
  },
  {
    id: "p-3",
    name: "Carla Leone Beaty",
    description: "Beleza e Cosméticos",
    link: "https://carlaleone.com.br",
    imageRes: require("../assets/logo-carla-leone.png"),
  },
  {
    id: "p-4",
    name: "Differencial",
    description: "Moda Automotiva",
    link: "https://www.instagram.com/grifedifferencial",
    imageRes: require("../assets/logo-diferencial.png"),
  },
  {
    id: "p-5",
    name: "Construtora Coroados",
    description: "Construção civil",
    link: "https://www.instagram.com/construtoracoroados",
    imageRes: require("../assets/logo-coroados.png"),
  },
  {
    id: "p-6",
    name: "Odonto Família Preto",
    description: "Consultório Odontológico",
    link: "https://www.instagram.com/odontofamiliapreto",
    imageRes: require("../assets/logo-familia-preto.png"),
  },
];

export default function Partners({ navigation }: Props) {
  function Header() {
    return (
      <View style={styles.header}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.headerIconLeft}
          onPress={() => navigation.openDrawer?.()}
        >
          <Feather name="menu" size={26} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Parceiros</Text>

        <TouchableOpacity activeOpacity={0.7} style={styles.headerIconRight}>
          <Image
            source={require("../assets/logo-Jota.png")}
            style={styles.headerLogo}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>
    );
  }

  function openLink(url: string) {
    Linking.openURL(url).catch(() =>
      console.log("Não foi possível abrir o link:", url)
    );
  }

  function Card({ item }: { item: Partner }) {
    return (
      <View style={styles.card}>
        <Image source={item.imageRes} style={styles.logo} resizeMode="cover" />

        <View style={{ flex: 1 }}>
          <Text style={styles.partnerName}>{item.name}</Text>
          <Text style={styles.descTitle}>Descrição:</Text>
          <Text style={styles.descText}>{item.description}</Text>

          <TouchableOpacity onPress={() => openLink(item.link)} activeOpacity={0.7}>
            <Text style={styles.saibaMais}>Saiba mais</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Header />

      <FlatList
        data={seedPartners}
        keyExtractor={(it) => it.id}
        ListHeaderComponent={<Text style={styles.sectionTitle}>Nossos Patrocinadores</Text>}
        renderItem={({ item }) => <Card item={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

// ===== estilos =====
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    height: 112,
    backgroundColor: GREEN,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: { color: "#fff", fontSize: 22, fontWeight: "700" },

  headerIconLeft: { position: "absolute", left: 16, top: "50%", marginTop: -13 },

  headerIconRight: { position: "absolute", right: 16, top: "50%", marginTop: -18 },
  headerLogo: { width: 36, height: 36 },

  sectionTitle: { fontSize: 22, fontWeight: "700", color: "#111", paddingHorizontal: 20, paddingVertical: 16, alignSelf: "center", marginBottom: 18 },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },

  card: {
    flexDirection: "row",
    backgroundColor: CARD_BG,
    borderRadius: 8,
    padding: 0,
    marginBottom: 25,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    position: "relative",
  },
  logo: { width: 175, height: 112, marginRight: 17, borderRadius: 5, backgroundColor: "#ffffff" },
  partnerName: { fontSize: 18, fontWeight: "700", color: "#000" },
  descTitle: { fontSize: 14, fontWeight: "700", color: "#000" },
  descText: { fontSize: 14, color: "#333", marginBottom: 6 },
  saibaMais: { fontSize: 15, color: GREEN, fontWeight: "700" },
});

