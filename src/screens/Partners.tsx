import React, { useEffect, useState } from "react";
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
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../contexts/AuthContext";
import type { DrawerScreenProps } from "@react-navigation/drawer";
import type { DrawerParamList } from "../navigation/AppDrawer";

// Firebase imports
import { db, storage } from "../lib/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  Timestamp,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

// =====================
// TIPOS
// =====================
type Partner = {
  id: string;
  name: string;
  description: string;
  link: string;
  imageUrl: string;
  imagePath?: string;
  isActive: boolean;
  createdAt: Date;
  createdBy: string;
};

type Props = DrawerScreenProps<DrawerParamList, "Parceiros">;

// =====================
// CONSTANTES
// =====================
const GREEN = "#1FA83D";
const CARD_BG = "#E6E6E6";

// =====================
// COMPONENTE PRINCIPAL
// =====================
export default function Partners({ navigation }: Props) {
  const { user, role } = useAuth();
  const isAdmin = role === "admin";

  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal de criação
  const [modalVisible, setModalVisible] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formLink, setFormLink] = useState("");
  const [formImageUri, setFormImageUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // =====================
  // LISTENER FIRESTORE (tempo real)
  // =====================
  useEffect(() => {
    // Query: parceiros ativos, ordenados por data de criação (mais recente primeiro)
    const q = query(
      collection(db, "partners"),
      where("isActive", "==", true),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Partner[] = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();

          list.push({
            id: docSnap.id,
            name: data.name || "",
            description: data.description || "",
            link: data.link || "",
            imageUrl: data.imageUrl || "",
            imagePath: data.imagePath,
            isActive: data.isActive ?? true,
            createdAt: data.createdAt?.toDate?.() || new Date(),
            createdBy: data.createdBy || "",
          });
        });

        setPartners(list);
        setLoading(false);
      },
      (error) => {
        console.error("Erro ao carregar parceiros:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // =====================
  // FUNÇÕES AUXILIARES
  // =====================

  function generateFileName(uri: string): string {
    const ext = uri.split(".").pop()?.toLowerCase() || "jpg";
    return `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
  }

  async function uploadImage(uri: string): Promise<{ url: string; path: string }> {
    const fileName = generateFileName(uri);
    const storagePath = `partners/${fileName}`;
    const storageRef = ref(storage, storagePath);

    const response = await fetch(uri);
    const blob = await response.blob();

    await uploadBytes(storageRef, blob);
    const downloadUrl = await getDownloadURL(storageRef);

    return { url: downloadUrl, path: storagePath };
  }

  async function deleteImage(path: string): Promise<void> {
    if (!path) return;
    try {
      const storageRef = ref(storage, path);
      await deleteObject(storageRef);
    } catch (e) {
      console.log("Erro ao deletar imagem:", e);
    }
  }

  function openLink(url: string) {
    if (!url) return;
    
    // Garantir que o link tenha protocolo
    let finalUrl = url;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      finalUrl = `https://${url}`;
    }

    Linking.openURL(finalUrl).catch(() => {
      Alert.alert("Erro", "Não foi possível abrir o link.");
    });
  }

  // =====================
  // AÇÕES DO MODAL
  // =====================

  function openCreate() {
    setFormName("");
    setFormDescription("");
    setFormLink("");
    setFormImageUri(null);
    setModalVisible(true);
  }

  async function pickImageFromGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permissão negada", "Conceda acesso às fotos para escolher a imagem.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85,
    });

    if (result.canceled) return;

    const asset = result.assets?.[0];
    if (asset?.uri) {
      setFormImageUri(asset.uri);
    }
  }

  async function saveCreate() {
    const name = formName.trim();
    const description = formDescription.trim();
    const link = formLink.trim();

    if (!name) {
      Alert.alert("Campo obrigatório", "Preencha o nome do parceiro.");
      return;
    }

    if (!description) {
      Alert.alert("Campo obrigatório", "Preencha a descrição do parceiro.");
      return;
    }

    if (!link) {
      Alert.alert("Campo obrigatório", "Preencha o link do parceiro.");
      return;
    }

    if (!formImageUri) {
      Alert.alert("Imagem obrigatória", "Selecione uma imagem/logo do parceiro.");
      return;
    }

    setSaving(true);

    try {
      // 1. Upload da imagem
      const { url: imageUrl, path: imagePath } = await uploadImage(formImageUri);

      // 2. Criar documento no Firestore
      await addDoc(collection(db, "partners"), {
        name,
        description,
        link,
        imageUrl,
        imagePath,
        isActive: true,
        createdAt: Timestamp.now(),
        createdBy: user?.uid || "",
      });

      setModalVisible(false);
      Alert.alert("Sucesso", "Parceiro adicionado com sucesso!");
    } catch (error: any) {
      console.error("Erro ao criar parceiro:", error);
      Alert.alert("Erro", error.message || "Não foi possível adicionar o parceiro.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete(item: Partner) {
    Alert.alert(
      "Excluir parceiro",
      `Tem certeza que deseja excluir "${item.name}"?\n\nIsso irá remover o parceiro e a imagem permanentemente.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              // 1. Deletar imagem do Storage
              if (item.imagePath) {
                await deleteImage(item.imagePath);
              }

              // 2. Deletar documento do Firestore
              await deleteDoc(doc(db, "partners", item.id));

              Alert.alert("Sucesso", "Parceiro removido com sucesso!");
            } catch (error: any) {
              console.error("Erro ao excluir:", error);
              Alert.alert("Erro", "Não foi possível excluir o parceiro.");
            }
          },
        },
      ]
    );
  }

  // =====================
  // COMPONENTES DE UI
  // =====================

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

  function Card({ item }: { item: Partner }) {
    return (
      <View style={styles.card}>
        <Image
          source={{ uri: item.imageUrl }}
          style={styles.logo}
          resizeMode="cover"
        />

        <View style={styles.cardContent}>
          <Text style={styles.partnerName}>{item.name}</Text>
          <Text style={styles.descTitle}>Descrição:</Text>
          <Text style={styles.descText}>{item.description}</Text>

          <TouchableOpacity onPress={() => openLink(item.link)} activeOpacity={0.7}>
            <Text style={styles.saibaMais}>Saiba mais</Text>
          </TouchableOpacity>
        </View>

        {/* Botão de excluir (só admin) */}
        {isAdmin && (
          <TouchableOpacity
            style={styles.trashButton}
            onPress={() => confirmDelete(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="trash-2" size={16} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // =====================
  // RENDER
  // =====================

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <Header />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={GREEN} />
          <Text style={styles.loadingText}>Carregando parceiros...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Header />

      <FlatList
        data={partners}
        keyExtractor={(it) => it.id}
        ListHeaderComponent={
          <Text style={styles.sectionTitle}>Nossos Patrocinadores</Text>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="users" size={48} color="#ccc" />
            <Text style={styles.emptyText}>Nenhum parceiro cadastrado</Text>
            {isAdmin && (
              <Text style={styles.emptySubtext}>
                Toque no botão "+" para adicionar um parceiro.
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) => <Card item={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* FAB "Novo parceiro" (só admin) */}
      {isAdmin && (
        <TouchableOpacity style={styles.fab} onPress={openCreate} activeOpacity={0.9}>
          <Feather name="plus" size={26} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Modal de criação */}
      <Modal animationType="slide" transparent visible={modalVisible}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalRoot}
        >
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Novo Parceiro</Text>

              <TextInput
                style={styles.input}
                placeholder="Nome do parceiro (ex.: Union Off Road)"
                value={formName}
                onChangeText={setFormName}
                editable={!saving}
              />

              <TextInput
                style={styles.input}
                placeholder="Descrição (ex.: Customizações e Mecânica)"
                value={formDescription}
                onChangeText={setFormDescription}
                editable={!saving}
              />

              <TextInput
                style={styles.input}
                placeholder="Link (ex.: https://instagram.com/parceiro)"
                value={formLink}
                onChangeText={setFormLink}
                autoCapitalize="none"
                keyboardType="url"
                editable={!saving}
              />

              {/* Seleção de imagem */}
              <TouchableOpacity
                style={[styles.pickBtn, saving && styles.pickBtnDisabled]}
                onPress={pickImageFromGallery}
                disabled={saving}
              >
                <Feather name="image" size={18} color="#fff" />
                <Text style={styles.pickBtnText}>
                  {formImageUri ? "Trocar logo" : "Selecionar logo"}
                </Text>
              </TouchableOpacity>

              {formImageUri && (
                <Image
                  source={{ uri: formImageUri }}
                  style={styles.preview}
                  resizeMode="contain"
                />
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSecondary]}
                  onPress={() => setModalVisible(false)}
                  disabled={saving}
                >
                  <Text style={[styles.btnText, { color: "#111" }]}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary, saving && styles.btnDisabled]}
                  onPress={saveCreate}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.btnText}>Salvar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// =====================
// ESTILOS
// =====================
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

  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111",
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignSelf: "center",
    marginBottom: 10,
  },

  listContent: { paddingHorizontal: 16, paddingBottom: 32 },

  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 12, color: "#666", fontSize: 14 },

  emptyContainer: { alignItems: "center", marginTop: 60, paddingHorizontal: 32 },
  emptyText: { marginTop: 12, color: "#999", fontSize: 18, fontWeight: "600" },
  emptySubtext: { marginTop: 8, color: "#aaa", fontSize: 14, textAlign: "center" },

  card: {
    flexDirection: "row",
    backgroundColor: CARD_BG,
    borderRadius: 10,
    marginBottom: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    overflow: "hidden",
  },

  logo: {
    width: 155,
    height: 112,
    borderRadius: 10,
    backgroundColor: "#fff",
  },

  cardContent: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  partnerName: { fontSize: 16, fontWeight: "700", color: "#000", marginBottom: 4 },
  descTitle: { fontSize: 12, fontWeight: "700", color: "#444" },
  descText: { fontSize: 13, color: "#333", marginBottom: 8 },
  saibaMais: { fontSize: 14, color: GREEN, fontWeight: "700" },

  trashButton: {
    position: "absolute",
    right: 8,
    top: 8,
    backgroundColor: "#E74C3C",
    borderRadius: 14,
    padding: 6,
  },

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
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },

  // Modal
  modalRoot: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  modalScrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 40,
  },

  modalBox: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
  },

  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16 },

  input: {
    borderWidth: 1,
    borderColor: "#d9d9d9",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 10,
    backgroundColor: "#fff",
  },

  pickBtn: {
    height: 44,
    borderRadius: 8,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    marginBottom: 10,
    flexDirection: "row",
    gap: 8,
  },

  pickBtnDisabled: { backgroundColor: "#aaa" },

  pickBtnText: { color: "#fff", fontWeight: "700" },

  preview: {
    width: "100%",
    height: 120,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: "#f5f5f5",
  },

  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 8,
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
  btnDisabled: { backgroundColor: "#aaa" },
  btnText: { color: "#fff", fontWeight: "700" },
});