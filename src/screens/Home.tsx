import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  FlatList,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Linking,
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
  updateDoc,
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
type Announcement = {
  id: string;
  title: string;
  body: string;
  imageUrl: string;
  imagePath?: string; // caminho no Storage para deletar
  linkExterno?: string;
  dataValidade?: Date | null;
  isActive: boolean;
  createdAt: Date;
  createdBy: string;
};

type Props = DrawerScreenProps<DrawerParamList, "Home">;

// =====================
// CONSTANTES
// =====================
const GREEN = "#1FA83D";
const CARD_BG = "#E6E6E6";

// =====================
// COMPONENTE PRINCIPAL
// =====================
export default function Home({ navigation }: Props) {
  const { user, role } = useAuth();
  const isAdmin = role === "admin";

  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal "Novo anúncio"
  const [modalVisible, setModalVisible] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formLinkExterno, setFormLinkExterno] = useState("");
  const [formDataValidade, setFormDataValidade] = useState(""); // DD/MM/AAAA
  const [formImageUri, setFormImageUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // =====================
  // LISTENER FIRESTORE (tempo real)
  // =====================
  useEffect(() => {
    // Query: apenas anúncios ativos, ordenados por data de criação
    const q = query(
      collection(db, "announcements"),
      where("isActive", "==", true),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Announcement[] = [];
        const now = new Date();

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          
          // Converter Timestamps para Date
          const createdAt = data.createdAt?.toDate?.() || new Date();
          const dataValidade = data.dataValidade?.toDate?.() || null;

          // Verificar se expirou
          if (dataValidade && dataValidade < now) {
            // Anúncio expirado - marcar como inativo (não mostrar)
            // Opcionalmente, poderíamos atualizar isActive para false aqui
            return;
          }

          list.push({
            id: docSnap.id,
            title: data.title || "",
            body: data.body || "",
            imageUrl: data.imageUrl || "",
            imagePath: data.imagePath,
            linkExterno: data.linkExterno,
            dataValidade,
            isActive: data.isActive ?? true,
            createdAt,
            createdBy: data.createdBy || "",
          });
        });

        setItems(list);
        setLoading(false);
      },
      (error) => {
        console.error("Erro ao carregar anúncios:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // =====================
  // FUNÇÕES AUXILIARES
  // =====================
  
  // Converte DD/MM/AAAA para Date
  function parseDataValidade(str: string): Date | null {
    if (!str.trim()) return null;
    const match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return null;
    const [, dd, mm, yyyy] = match;
    const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd), 23, 59, 59);
    if (isNaN(date.getTime())) return null;
    return date;
  }

  // Gera nome único para arquivo
  function generateFileName(uri: string): string {
    const ext = uri.split(".").pop()?.toLowerCase() || "jpg";
    return `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
  }

  // Upload de imagem para Firebase Storage
  async function uploadImage(uri: string): Promise<{ url: string; path: string }> {
    const fileName = generateFileName(uri);
    const storagePath = `announcements/${fileName}`;
    const storageRef = ref(storage, storagePath);

    // Converter URI para blob
    const response = await fetch(uri);
    const blob = await response.blob();

    // Upload
    await uploadBytes(storageRef, blob);

    // Obter URL pública
    const downloadUrl = await getDownloadURL(storageRef);

    return { url: downloadUrl, path: storagePath };
  }

  // Deletar imagem do Storage
  async function deleteImage(path: string): Promise<void> {
    if (!path) return;
    try {
      const storageRef = ref(storage, path);
      await deleteObject(storageRef);
    } catch (e) {
      console.log("Erro ao deletar imagem (pode já não existir):", e);
    }
  }

  // =====================
  // AÇÕES DO MODAL
  // =====================
  
  function openCreate() {
    setFormTitle("");
    setFormBody("");
    setFormLinkExterno("");
    setFormDataValidade("");
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
    const title = formTitle.trim();
    const body = formBody.trim();

    if (!title || !body || !formImageUri) {
      Alert.alert("Campos obrigatórios", "Preencha título, texto e selecione a imagem.");
      return;
    }

    // Validar data de validade se preenchida
    const dataValidade = parseDataValidade(formDataValidade);
    if (formDataValidade.trim() && !dataValidade) {
      Alert.alert("Data inválida", "Use o formato DD/MM/AAAA para a data de validade.");
      return;
    }

    setSaving(true);

    try {
      // 1. Upload da imagem
      const { url: imageUrl, path: imagePath } = await uploadImage(formImageUri);

      // 2. Criar documento no Firestore
      await addDoc(collection(db, "announcements"), {
        title,
        body,
        imageUrl,
        imagePath,
        linkExterno: formLinkExterno.trim() || null,
        dataValidade: dataValidade ? Timestamp.fromDate(dataValidade) : null,
        isActive: true,
        createdAt: Timestamp.now(),
        createdBy: user?.uid || "",
      });

      setModalVisible(false);
      Alert.alert("Sucesso", "Anúncio criado com sucesso!");
    } catch (error: any) {
      console.error("Erro ao criar anúncio:", error);
      Alert.alert("Erro", error.message || "Não foi possível criar o anúncio.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete(item: Announcement) {
    Alert.alert("Excluir anúncio", "Tem certeza que deseja excluir?", [
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
            await deleteDoc(doc(db, "announcements", item.id));
          } catch (error: any) {
            console.error("Erro ao excluir:", error);
            Alert.alert("Erro", "Não foi possível excluir o anúncio.");
          }
        },
      },
    ]);
  }

  // Abrir link externo
  function openLinkExterno(url: string) {
    if (!url) return;
    Linking.openURL(url).catch(() => {
      Alert.alert("Erro", "Não foi possível abrir o link.");
    });
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
          onPress={() => navigation.openDrawer()}
        >
          <Feather name="menu" size={26} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Home</Text>

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

  function SectionTitle() {
    return (
      <View style={styles.sectionTitleWrap}>
        <Text style={styles.sectionTitle}>Últimas Notícias</Text>
      </View>
    );
  }

  function Card({ item }: { item: Announcement }) {
    const hasLink = !!item.linkExterno;

    return (
      <View style={styles.card}>
        <Image
          source={{ uri: item.imageUrl }}
          style={styles.cardImage}
          resizeMode="cover"
        />

        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardText}>{item.body}</Text>

          {/* Botão de link externo */}
          {hasLink && (
            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => openLinkExterno(item.linkExterno!)}
              activeOpacity={0.8}
            >
              <Feather name="external-link" size={16} color="#fff" />
              <Text style={styles.linkBtnText}>Saiba mais</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Botão de excluir (só admin) */}
        {isAdmin && (
          <TouchableOpacity
            style={styles.trashButton}
            onPress={() => confirmDelete(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="trash-2" size={18} color="#111" />
          </TouchableOpacity>
        )}

        {/* Indicador de validade (se tiver data) */}
        {item.dataValidade && (
          <View style={styles.validadeBadge}>
            <Text style={styles.validadeText}>
              Até {item.dataValidade.toLocaleDateString("pt-BR")}
            </Text>
          </View>
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
          <Text style={styles.loadingText}>Carregando anúncios...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Header />

      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        ListHeaderComponent={<SectionTitle />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="inbox" size={48} color="#ccc" />
            <Text style={styles.emptyText}>Nenhum anúncio disponível</Text>
          </View>
        }
        renderItem={({ item }) => <Card item={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* FAB "Novo anúncio" (só admin) */}
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
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Novo anúncio</Text>

            <TextInput
              style={styles.input}
              placeholder="Título (ex.: Expedição da Placa – 23/08)"
              value={formTitle}
              onChangeText={setFormTitle}
              editable={!saving}
            />

            <TextInput
              style={[styles.input, { height: 100, textAlignVertical: "top" }]}
              placeholder="Texto do anúncio"
              value={formBody}
              onChangeText={setFormBody}
              multiline
              editable={!saving}
            />

            <TextInput
              style={styles.input}
              placeholder="Link externo (opcional)"
              value={formLinkExterno}
              onChangeText={setFormLinkExterno}
              autoCapitalize="none"
              keyboardType="url"
              editable={!saving}
            />

            <TextInput
              style={styles.input}
              placeholder="Data de validade DD/MM/AAAA (opcional)"
              value={formDataValidade}
              onChangeText={setFormDataValidade}
              keyboardType="numeric"
              editable={!saving}
            />

            {/* Seleção de imagem da galeria */}
            <TouchableOpacity
              style={[styles.pickBtn, saving && styles.pickBtnDisabled]}
              onPress={pickImageFromGallery}
              disabled={saving}
            >
              <Feather name="image" size={18} color="#fff" />
              <Text style={styles.pickBtnText}>
                {formImageUri ? "Trocar imagem" : "Selecionar imagem"}
              </Text>
            </TouchableOpacity>

            {formImageUri && (
              <Image source={{ uri: formImageUri }} style={styles.preview} resizeMode="cover" />
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
  headerLogo: { width: 38, height: 38 },

  sectionTitleWrap: { paddingHorizontal: 20, paddingVertical: 16 },
  sectionTitle: { fontSize: 22, fontWeight: "700", color: "#111", alignSelf: "center" },

  listContent: { paddingHorizontal: 16, paddingBottom: 32 },

  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 12, color: "#666", fontSize: 14 },

  emptyContainer: { alignItems: "center", marginTop: 60 },
  emptyText: { marginTop: 12, color: "#999", fontSize: 16 },

  card: {
    borderRadius: 18,
    backgroundColor: "#fff",
    marginBottom: 22,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    overflow: "hidden",
  },

  cardImage: { width: "100%", height: 190 },

  cardBody: { backgroundColor: CARD_BG, paddingHorizontal: 16, paddingVertical: 14 },

  cardTitle: { fontSize: 20, fontWeight: "800", color: "#111", marginBottom: 6 },

  cardText: { fontSize: 14.5, color: "#444", lineHeight: 20 },

  linkBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GREEN,
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 12,
    gap: 6,
  },

  linkBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  trashButton: {
    position: "absolute",
    right: 12,
    top: 12,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 16,
    padding: 6,
  },

  validadeBadge: {
    position: "absolute",
    left: 12,
    top: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  validadeText: { color: "#fff", fontSize: 11, fontWeight: "600" },

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
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },

  modalRoot: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  modalBox: { width: "100%", backgroundColor: "#fff", borderRadius: 14, padding: 16 },

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

  preview: { width: "100%", height: 160, borderRadius: 8, marginBottom: 10 },

  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 4 },

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