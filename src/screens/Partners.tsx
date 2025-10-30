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
import * as FileSystem from "expo-file-system/legacy"
import { useAuth } from "../contexts/AuthContext";
import type { DrawerScreenProps } from "@react-navigation/drawer";
import type { DrawerParamList } from "../navigation/AppDrawer";
import Constants from "expo-constants";


const {documentDirectory, cacheDirectory, EncodingType} = require("expo-file-system");

// ===== Tipos =====
type Props = DrawerScreenProps<DrawerParamList, "Parceiros">;

type Partner = {
  id: string;
  name: string;
  description: string;
  link: string;
  createdAt: number;
  imageUri?: string;     // quando admin adiciona da galeria
  imageRes?: number;     // quando vem do seed (require local)
};

type PartnersStore = {
  version: number;
  items: Partner[];
};

// ===== Constantes =====
const STORAGE_KEY = "@jota_partners_v";
const STORAGE_VERSION = 1;

const GREEN = "#1FA83D";
const CARD_BG = "#E6E6E6";

// Ajuste os requires de acordo com os nomes reais dos arquivos:
const seedPartners: Partner[] = [
  {
    id: "p-1",
    name: "Union Off Road",
    description: "Customizações e Mecânica",
    link: "https://www.instagram.com/union.offroad",
    createdAt: Date.now(),
    imageRes: require("../assets/logo-union.png"),
  },
  {
    id: "p-2",
    name: "Careca AutoPeças",
    description: "Peças Automotivas",
    link: "https://carecaautopecas.com.br",
    createdAt: Date.now(),
    imageRes: require("../assets/logo-careca.png"),
  },
  {
    id: "p-3",
    name: "Carla Leone Beaty",
    description: "Beleza e Cosméticos",
    link: "https://carlaleone.com.br",
    createdAt: Date.now(),
    imageRes: require("../assets/logo-carla-leone.png"),
  },
  {
    id: "p-4",
    name: "Differencial",
    description: "Moda Automotiva",
    link: "https://www.instagram.com/grifedifferencial",
    createdAt: Date.now(),
    imageRes: require("../assets/logo-diferencial.png"),
  },
  {
    id: "p-5",
    name: "Construtora Coroados",
    description: "Construção civil",
    link: "https://www.instagram.com/construtoracoroados",
    createdAt: Date.now(),
    imageRes: require("../assets/logo-coroados.png"),
  },
  {
    id: "p-6",
    name: "Odonto Família Preto",
    description: "Consultório Odontológico",
    link: "https://www.instagram.com/odontofamiliapreto",
    createdAt: Date.now(),
    imageRes: require("../assets/logo-familia-preto.png"),
  },
];

// ===== Helpers =====
const DOC_DIR = documentDirectory;   // deve ser algo como "file:///data/user/0/.../files/"
const FALLBACK_DIR = cacheDirectory; // fallback se DOC_DIR indisponível
const DIR_PARTNERS = `${(DOC_DIR ?? FALLBACK_DIR) || ""}partners/`;

async function ensureDirAsync(path: string) {
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) await FileSystem.makeDirectoryAsync(path, { intermediates: true });
  } catch (e) {
    console.log("ensureDirAsync error:", e);
    throw e;
  }
}

function ensureExtension(name: string) {
  // garante extensão visível pro Image reconhecer
  return /\.[a-zA-Z0-9]+$/.test(name) ? name : `${name}.jpg`;
}

async function copyIntoAppDir(srcUri: string) {
  await ensureDirAsync(DIR_PARTNERS);

  const base = srcUri.split("/").pop() || `img_${Date.now()}`;
  const filename = ensureExtension(base);
  const dest = `${DIR_PARTNERS}${Date.now()}_${filename}`;

  try {
    await FileSystem.copyAsync({ from: srcUri, to: dest });
    return dest; // "file:///.../partners/..."
  } catch (err) {
    console.log("copyAsync failed, trying fallback read/write:", err);
    // Fallback para alguns devices com content:// mais chato
    const data = await FileSystem.readAsStringAsync(srcUri, { encoding: EncodingType.Base64 });
    await FileSystem.writeAsStringAsync(dest, data, { encoding: EncodingType.Base64 });
    return dest;
  }
}


async function handlePickImage() {
  try {
    if (Platform.OS === "web") {
      Alert.alert("Indisponível no Web", "Escolher imagem só funciona em iOS/Android.");
      return;
    }

    // 1) Permissão
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") {
      Alert.alert("Permissão negada", "Precisamos de acesso à galeria para continuar.");
      return;
    }

    // 2) Abrir galeria
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      allowsEditing: true,
      exif: false,
      base64: false,
    });
    if (res.canceled || !res.assets?.length) return;

    const picked = res.assets[0];
    console.log("Picked asset:", picked); // DEBUG

    // 3) Copiar para pasta do app (content:// -> file://)
    const localUri = await copyIntoAppDir(picked.uri);
    console.log("Saved localUri:", localUri); // DEBUG

    // 4) Atualizar preview do modal
    setFormImageUri(localUri);
  } catch (e: any) {
    console.log("handlePickImage error:", e);
    Alert.alert("Erro", "Não foi possível carregar a imagem.");
  }
}

// ===== Componente =====
export default function Partners({ navigation }: Props) {
  const { user, userRole } = useAuth() as any;
  const roleIsAdmin = (userRole?.toLowerCase?.() === "admin");

  const ADMIN_EMAIL = (Constants.expoConfig?.extra as any)?.ADMIN_EMAIL
    ?? "contato@jotaexpedicoes.com.br";
  const emailIsAdmin = user?.email?.toLowerCase?.() === ADMIN_EMAIL.toLowerCase();

  const isAdmin = roleIsAdmin || emailIsAdmin;

  const [items, setItems] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);

  // modal + form
  const [modalVisible, setModalVisible] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formLink, setFormLink] = useState("");
  const [formImageUri, setFormImageUri] = useState<string | undefined>();

  // Carregar do AsyncStorage com seed versionado
  useEffect(() => {
    (async () => {
      try {
        await ensureDirAsync(DIR_PARTNERS);
        const raw = await AsyncStorage.getItem(STORAGE_KEY + STORAGE_VERSION);
        if (raw) {
          const data: PartnersStore = JSON.parse(raw);
          if (data?.items?.length) {
            setItems(data.items);
          } else {
            setItems(seedPartners);
          }
        } else {
          // primeira vez / versão nova: grava o seed
          setItems(seedPartners);
          await AsyncStorage.setItem(
            STORAGE_KEY + STORAGE_VERSION,
            JSON.stringify({ version: STORAGE_VERSION, items: seedPartners } as PartnersStore)
          );
        }
      } catch (e) {
        console.log("load partners error:", e);
        setItems(seedPartners);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Persistir sempre que mudar
  useEffect(() => {
    (async () => {
      try {
        const store: PartnersStore = { version: STORAGE_VERSION, items };
        await AsyncStorage.setItem(STORAGE_KEY + STORAGE_VERSION, JSON.stringify(store));
      } catch (e) {
        console.log("save partners error:", e);
      }
    })();
  }, [items]);

  const sorted = useMemo(() => [...items].sort((a, b) => b.createdAt - a.createdAt), [items]);

  function openLink(url: string) {
    Linking.openURL(url).catch(() => Alert.alert("Erro", "Não foi possível abrir o link."));
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
    const newItem = {
        id: String(Date.now()),
        name,
        description,
        link,
        imageUri: formImageUri,   // ⬅️ usa o caminho local
        createdAt: Date.now(),
    };
    setItems((prev) => [newItem, ...prev]);
    setModalVisible(false);
    }

  function confirmDelete(id: string) {
    Alert.alert("Excluir parceiro", "Deseja realmente excluir este parceiro?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () => setItems((prev) => prev.filter((x) => x.id !== id)),
      },
    ]);
  }



  async function resetSeed() {
    await AsyncStorage.removeItem(STORAGE_KEY + STORAGE_VERSION);
    setItems(seedPartners);
    Alert.alert("OK", "Lista restaurada para os patrocinadores padrão.");
  }

  // Header com menu e (se admin) ação de reset
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

        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.headerIconRight}
          onPress={() => {
            if (isAdmin) resetSeed();
          }}
        >
          <Image
            source={require("../assets/logo-Jota.png")}
            style={styles.headerLogo}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>
    );
  }

  function Card({ item }: { item: Partner }) {
    const imgSource = item.imageUri
      ? { uri: item.imageUri }
      : item.imageRes
      ? item.imageRes
      : require("../assets/logo-Jota.png");

    return (
      <View style={styles.card}>
        <Image source={imgSource} style={styles.logo} resizeMode="cover" />

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
        ListHeaderComponent={<Text style={styles.sectionTitle}>Nossos Patrocinadores</Text>}
        renderItem={({ item }) => <Card item={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {isAdmin && (
        <TouchableOpacity style={styles.fab} onPress={openCreate} activeOpacity={0.9}>
          <Feather name="plus" size={26} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Modal de criação (imagem da GALERIA) */}
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

            <TouchableOpacity style={[styles.btn, styles.btnSecondary, { marginTop: 6, marginBottom: 10 }]} onPress={handlePickImage}>
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
function setFormImageUri(localUri: string) {
    throw new Error("Function not implemented.");
}

