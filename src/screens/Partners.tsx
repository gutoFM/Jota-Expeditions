import React, { useEffect, useMemo, useState } from "react";
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
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { useAuth } from "../contexts/AuthContext";
import type { DrawerScreenProps } from "@react-navigation/drawer";
import type { DrawerParamList } from "../navigation/AppDrawer";

// Importação dinâmica para evitar erro no Web e permitir imagens locais
const {documentDirectory, cacheDirectory, getInfoAsync, makeDirectoryAsync, copyAsync, deleteAsync} = require("expo-file-system");

type Props = DrawerScreenProps<DrawerParamList, "Parceiros">;

type Partner = {
  id: string;
  name: string;
  description: string;
  imageUri?: string;
  link: string;
  createdAt: number;
};

// chaves de persistência
const STORAGE_KEY = "@jota_partners";
const DIR_PARTNERS = Platform.OS === "web" ? cacheDirectory ?? null : documentDirectory ?? null;

// util: cria pasta se não existir
async function ensureDirAsync(path: string) {
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(path, { intermediates: true });
    }
  } catch (e) {
    console.log("Erro ao garantir pasta:", e);
  }
}

// util: salva/copia a imagem do picker para nossa pasta
async function savePickedImageToAppDir(pickedUri: string) {
  await ensureDirAsync(DIR_PARTNERS);
  const filename = pickedUri.split("/").pop() ?? `img_${Date.now()}.jpg`;
  const dest = `${DIR_PARTNERS}/${Date.now()}_${filename}`;
  await FileSystem.copyAsync({ from: pickedUri, to: dest });
  return dest; // uri local persistente
}

export default function Partners({ navigation }: Props) {
  const { userRole } = useAuth() as any;
  const isAdmin = userRole === "admin";

  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);

  // modal + form
  const [modalVisible, setModalVisible] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formLink, setFormLink] = useState("");
  const [formImageUri, setFormImageUri] = useState<string | undefined>();

  // carrega parceiros (seed inicial sem imagem; admin depois adiciona/edita)
  useEffect(() => {
    (async () => {
      try {
        await ensureDirAsync(DIR_PARTNERS);
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          setPartners(JSON.parse(raw));
        } else {
          setPartners([
            {
              id: "p-1",
              name: "Union Off Road",
              description: "Customizações e Mecânica",
              link: "https://www.instagram.com/union.offroad",
              createdAt: Date.now(),
            },
            {
              id: "p-2",
              name: "Careca AutoPeças",
              description: "Peças Automotivas",
              link: "https://carecaautopecas.com.br",
              createdAt: Date.now(),
            },
            {
              id: "p-3",
              name: "Carla Leone Beaty",
              description: "Beleza e Cosméticos",
              link: "https://carlaleone.com.br",
              createdAt: Date.now(),
            },
            {
              id: "p-4",
              name: "Differencial",
              description: "Moda Automotiva",
              link: "https://www.instagram.com/grifedifferencial",
              createdAt: Date.now(),
            },
            {
              id: "p-5",
              name: "Construtora Coroados",
              description: "Construção civil",
              link: "https://www.instagram.com/construtoracoroados",
              createdAt: Date.now(),
            },
            {
              id: "p-6",
              name: "Odonto Família Preto",
              description: "Consultório Odontológico",
              link: "https://www.instagram.com/odontofamiliapreto",
              createdAt: Date.now(),
            },
          ]);
        }
      } catch (e) {
        console.log("Erro lendo parceiros:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // persiste sempre que muda
  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(partners));
      } catch (e) {
        console.log("Erro salvando parceiros:", e);
      }
    })();
  }, [partners]);

  const sorted = useMemo(
    () => [...partners].sort((a, b) => b.createdAt - a.createdAt),
    [partners]
  );

  async function handlePickImage() {
    if (Platform.OS === "web") {
      Alert.alert("Indisponível no Web", "Escolher imagem só funciona em iOS/Android.");
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permissão negada", "Precisamos da permissão da galeria para continuar.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      allowsEditing: true,
    });
    if (res.canceled || !res.assets?.length) return;
    try {
      const localUri = await savePickedImageToAppDir(res.assets[0].uri);
      setFormImageUri(localUri);
    } catch (e) {
      console.log("Erro salvando imagem:", e);
      Alert.alert("Erro", "Não foi possível salvar a imagem.");
    }
  }

  function openCreate() {
    setFormName("");
    setFormDesc("");
    setFormLink("");
    setFormImageUri(undefined);
    setModalVisible(true);
  }

  async function saveCreate() {
    const name = formName.trim();
    const description = formDesc.trim();
    const link = formLink.trim();
    if (!name || !description || !link || !formImageUri) {
      Alert.alert("Campos obrigatórios", "Preencha nome, descrição, link e escolha uma imagem.");
      return;
    }
    const newPartner: Partner = {
      id: String(Date.now()),
      name,
      description,
      link,
      imageUri: formImageUri,
      createdAt: Date.now(),
    };
    setPartners((prev) => [newPartner, ...prev]);
    setModalVisible(false);
  }

  function confirmDelete(id: string) {
    Alert.alert("Excluir parceiro", "Deseja realmente excluir este parceiro?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () => setPartners((prev) => prev.filter((x) => x.id !== id)),
      },
    ]);
  }

  function openLink(url: string) {
    Linking.openURL(url).catch(() =>
      Alert.alert("Erro", "Não foi possível abrir o link.")
    );
  }

  // Header com o botão do Drawer
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

  function PartnerCard({ item }: { item: Partner }) {
    return (
      <View style={styles.card}>
        <Image
          source={
            item.imageUri
              ? { uri: item.imageUri }
              : require("../assets/logo-Jota.png") // coloque um placeholder no seu assets
          }
          style={styles.logo}
          resizeMode="cover"
        />

        <View style={{ flex: 1 }}>
          <Text style={styles.partnerName}>{item.name}</Text>
          <Text style={styles.descTitle}>Descrição:</Text>
          <Text style={styles.descText}>{item.description}</Text>

          <TouchableOpacity onPress={() => openLink(item.link)} activeOpacity={0.7}>
            <Text style={styles.saibaMais}>Saiba mais</Text>
          </TouchableOpacity>
        </View>

        {isAdmin && (
          <TouchableOpacity
            onPress={() => confirmDelete(item.id)}
            style={styles.trashButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="trash-2" size={18} color="#111" />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <Header />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Header />

      <FlatList
        data={sorted}
        keyExtractor={(it) => it.id}
        ListHeaderComponent={
          <Text style={styles.sectionTitle}>Nossos Patrocinadores</Text>
        }
        renderItem={({ item }) => <PartnerCard item={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {isAdmin && (
        <TouchableOpacity style={styles.fab} onPress={openCreate} activeOpacity={0.9}>
          <Feather name="plus" size={26} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Modal de criação (com escolha da imagem da GALERIA) */}
      <Modal animationType="slide" transparent visible={modalVisible}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalRoot}
        >
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Novo Parceiro</Text>

            <TextInput
              style={styles.input}
              placeholder="Nome"
              value={formName}
              onChangeText={setFormName}
            />
            <TextInput
              style={styles.input}
              placeholder="Descrição"
              value={formDesc}
              onChangeText={setFormDesc}
            />
            <TextInput
              style={styles.input}
              placeholder="Link (Instagram, site, etc.)"
              value={formLink}
              onChangeText={setFormLink}
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary, { marginTop: 6, marginBottom: 10 }]}
              onPress={handlePickImage}
            >
              <Text style={[styles.btnText, { color: "#111" }]}>
                {formImageUri ? "Trocar imagem" : "Escolher imagem da galeria"}
              </Text>
            </TouchableOpacity>

            {formImageUri && (
              <Image
                source={{ uri: formImageUri }}
                style={{ width: "100%", height: 160, borderRadius: 8, marginBottom: 10 }}
                resizeMode="cover"
              />
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={[styles.btnText, { color: "#111" }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={saveCreate}>
                <Text style={styles.btnText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const GREEN = "#1FA83D";
const CARD_BG = "#E6E6E6";

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

  headerLogo: { 
    width: 38, 
    height: 38 
  },

  sectionTitle: { fontSize: 22, fontWeight: "700", color: "#111", paddingHorizontal: 20, paddingVertical: 16, alignSelf: "center" },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },

  card: {
    flexDirection: "row",
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    position: "relative",
  },
  logo: { width: 70, height: 70, marginRight: 10, borderRadius: 10, backgroundColor: "#fff" },
  partnerName: { fontSize: 18, fontWeight: "700", color: "#000" },
  descTitle: { fontSize: 14, fontWeight: "700", color: "#000" },
  descText: { fontSize: 14, color: "#333", marginBottom: 6 },
  saibaMais: { fontSize: 15, color: GREEN, fontWeight: "700" },

  fab: {
    position: "absolute",
    right: 20,
    bottom: 28,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  trashButton: {
    position: "absolute",
    right: 8,
    top: 8,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 16,
    padding: 6,
  },

  modalRoot: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalBox: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#d9d9d9",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 4,
  },
  btn: {
    paddingHorizontal: 16,
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimary: { backgroundColor: GREEN },
  btnSecondary: { backgroundColor: "#eee" },
  btnText: { color: "#fff", fontWeight: "700" },
});
