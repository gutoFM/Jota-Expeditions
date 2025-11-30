import React from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  FlatList,
  Linking,
  Alert,
  Share,
} from "react-native";
import { Image } from "react-native";
import { Feather, FontAwesome, FontAwesome5, MaterialCommunityIcons } from "@expo/vector-icons";
import type { DrawerScreenProps } from "@react-navigation/drawer";
import type { DrawerParamList } from "../navigation/AppDrawer";

type Props = DrawerScreenProps<DrawerParamList, "Contato">;

const GREEN = "#1FA83D";
const CARD_BG = "#E6F6EA";
const TEXT_MUTED = "#4E5A57";

// =====================
// CONSTANTES - WHATSAPP
// =====================
const WHATSAPP_NUMBER = "5511964070127";
const WHATSAPP_MESSAGE = "Olá! Estava no aplicativo e surgiu uma dúvida. Poderia ajudar?";
const WHATSAPP_URL = `https://api.whatsapp.com/send?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

type ContactItem = {
  id: string;
  title: string;
  subtitle?: string;
  url: string;
  icon:
    | { type: "fa"; name: keyof typeof FontAwesome.glyphMap }
    | { type: "fa5"; name: keyof typeof FontAwesome5.glyphMap }
    | { type: "mci"; name: keyof typeof MaterialCommunityIcons.glyphMap }
    | { type: "img"; src: any };
  accent?: string;
};

const items: ContactItem[] = [
  {
    id: "instagram",
    title: "Instagram",
    subtitle: "@jotaexpedicoes",
    url: "https://www.instagram.com/jotaexpedicoes",
    icon: { type: "fa", name: "instagram" },
    accent: "#E1306C",
  },
  {
    id: "facebook",
    title: "Facebook",
    subtitle: "/jotaexpedicoes4x4",
    url: "https://www.facebook.com/jotaexpedicoes4x4",
    icon: { type: "fa", name: "facebook-square" },
    accent: "#1877F2",
  },
  {
    id: "whatsapp",
    title: "WhatsApp",
    subtitle: "+55 11 96407-0127",
    url: WHATSAPP_URL, // URL com mensagem padrão
    icon: { type: "fa", name: "whatsapp" },
    accent: "#25D366",
  },
  {
    id: "youtube",
    title: "YouTube",
    subtitle: "/jotaexpedicoes",
    url: "https://www.youtube.com/jotaexpedicoes",
    icon: { type: "fa", name: "youtube-play" },
    accent: "#FF0000",
  },
];

export default function Contact({ navigation }: Props) {
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

        <Text style={styles.headerTitle}>Contato</Text>

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

  async function open(url: string) {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) throw new Error("URL não suportada");
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert("Erro", "Não foi possível abrir o link.");
    }
  }

  async function share(url: string, title?: string) {
    try {
      await Share.share({ message: `${title ?? "Jota Expedições"} – ${url}` });
    } catch {}
  }

  function SocialCard({ item }: { item: ContactItem }) {
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.card}
        onPress={() => open(item.url)}
      >
        {/* Ícone esquerdo */}
        <View style={[styles.iconWrap, { borderColor: item.accent || "#ffffff" }]}>
          {item.icon.type === "fa" && (
            <FontAwesome name={item.icon.name} size={24} color="#000" />
          )}
          {item.icon.type === "fa5" && (
            <FontAwesome5 name={item.icon.name} size={22} color="#000" />
          )}
          {item.icon.type === "mci" && (
            <MaterialCommunityIcons name={item.icon.name} size={24} color="#000" />
          )}
          {item.icon.type === "img" && (
            <Image source={item.icon.src} style={{ width: 24, height: 24 }} />
          )}
        </View>

        {/* Conteúdo */}
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          {!!item.subtitle && <Text style={styles.cardSub}>{item.subtitle}</Text>}
        </View>

        {/* Botão compartilhar */}
        <TouchableOpacity
          onPress={() => share(item.url, item.title)}
          style={styles.shareBtn}
          activeOpacity={0.8}
        >
          <Feather name="share-2" size={18} color="#111" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Header />

      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <Text style={styles.sectionTitle}>Nos Contate</Text>
            <Text style={styles.lead}>
              Não hesite em nos contatar quando tiver qualquer sugestão ou dúvida.
              Estamos aqui para melhorar a sua experiência no nosso
              aplicativo e no mundo OffRoad.
            </Text>
            <Text style={styles.sectionMidia}>Redes Sociais</Text>
          </View>
        }
        renderItem={({ item }) => <SocialCard item={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

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

  listContent: { paddingHorizontal: 16, paddingBottom: 32 },

  headerBlock: { paddingHorizontal: 4 },

  sectionTitle: { fontSize: 22, fontWeight: "700", color: "#111", paddingHorizontal: 20, paddingVertical: 16, alignSelf: "center", marginBottom: 18 },
  
  lead: {fontSize: 14.5, color: TEXT_MUTED, lineHeight: 22, textAlign: "center", marginBottom: 158 },

  sectionMidia: { fontSize: 14, fontWeight: "700", color: "#111" },

  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#CFEBDD",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1.5,
  },
  cardTitle: { fontSize: 16.5, fontWeight: "700", color: "#0f1f1a" },
  cardSub: { fontSize: 13, color: TEXT_MUTED, marginTop: 2 },

  shareBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#E4F2EA",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
});