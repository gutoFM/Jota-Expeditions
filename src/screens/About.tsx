import React from "react";
import {
  Alert,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Linking,
  ScrollView,
} from "react-native";
import { Feather, FontAwesome, FontAwesome5, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "react-native";
import type { DrawerScreenProps } from "@react-navigation/drawer";
import type { DrawerParamList } from "../navigation/AppDrawer";

type Props = DrawerScreenProps<DrawerParamList, "Sobre">;

const GREEN = "#1FA83D";
const SECTION_BG = "#274C34";
const CARD_BG = "#F5F5F5";
const TEXT_COLOR = "#000";

// =====================
// CONSTANTES - WHATSAPP
// =====================
const WHATSAPP_NUMBER = "5511992652120";
const WHATSAPP_MESSAGE = "Olá! Estava no aplicativo Jota Expedições e me interessei pelo seu serviço. Poderia me auxiliar?";

function handleWhatsapp() {
  const encodedMessage = encodeURIComponent(WHATSAPP_MESSAGE);
  const url = `https://api.whatsapp.com/send?phone=${WHATSAPP_NUMBER}&text=${encodedMessage}`;
  Linking.openURL(url).catch(() => {
    Alert.alert("Erro", "Não foi possível abrir o WhatsApp.");
  });
}

export default function About({ navigation }: Props) {
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

        <Text style={styles.headerTitle}>Sobre</Text>

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
    Linking.openURL(url).catch(() => {
      console.log("Não foi possível abrir o link:", url);
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Header />

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* --- Seção Aplicativo --- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Aplicativo</Text>

          <View style={styles.labelWrap}>
            <Text style={styles.label}>Versão:</Text>
          </View>

          <View style={styles.card}>
            <FontAwesome name="tag" size={20} color="#000" style={styles.cardIcon} />
            <Text style={styles.cardText}>1.0.0</Text>
          </View>

          <TouchableOpacity
            style={styles.card}
            onPress={() => openLink("https://jotaexpedicoes.com.br/politica")}
            activeOpacity={0.8}
          >
            <FontAwesome5 name="file-alt" size={20} color="#000" style={styles.cardIcon} />
            <Text style={styles.cardText}>Política de Privacidade</Text>
          </TouchableOpacity>
        </View>

        {/* --- Seção Administradores --- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Administradores</Text>

          <View style={styles.card}>
            <MaterialCommunityIcons name="crown" size={20} color="#000" style={styles.cardIcon} />
            <Text style={styles.cardText}>Johannes Cristoni (Jota)</Text>
          </View>

          <View style={styles.card}>
            <MaterialCommunityIcons name="crown" size={20} color="#000" style={styles.cardIcon} />
            <Text style={styles.cardText}>Renata Mattos</Text>
          </View>
        </View>

        {/* --- Seção Créditos --- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Créditos</Text>

          <View style={styles.labelWrap}>
            <Text style={styles.label}>Empresa:</Text>
          </View>
          <View style={styles.card}>
            <FontAwesome5 name="building" size={20} color="#000" style={styles.cardIcon} />
            <Text style={styles.cardText}>Jota Expedições</Text>
          </View>

          <View style={styles.labelWrap}>
            <Text style={styles.label}>Desenvolvedor:</Text>
          </View>
          <TouchableOpacity
            style={styles.card}
            onPress={handleWhatsapp}
            activeOpacity={0.8}
          >
            <FontAwesome5 name="code" size={20} color="#000" style={styles.cardIcon} />
            <Text style={styles.cardText}>Augusto Fisco Milreu</Text>
          </TouchableOpacity>
          
          
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scroll: { paddingHorizontal: 16, paddingTop: 8 },

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

  section: {
    backgroundColor: "#fff",
    borderRadius: 10,
    marginTop: 22,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#ddd",
  },
  sectionTitle: {
    backgroundColor: SECTION_BG,
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  labelWrap: { paddingHorizontal: 14, paddingTop: 10 },
  label: { fontSize: 14, fontWeight: "700", color: "#000" },

  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CARD_BG,
    borderRadius: 10,
    marginHorizontal: 14,
    marginVertical: 6,
    padding: 10,
  },
  cardIcon: { marginRight: 10 },
  cardText: { fontSize: 15, fontWeight: "500", color: TEXT_COLOR },
});
