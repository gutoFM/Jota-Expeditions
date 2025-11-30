import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  Linking,
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
type EventItem = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  imagePath?: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  createdAt: Date;
  createdBy: string;
};

type Props = DrawerScreenProps<DrawerParamList, "Eventos">;

// =====================
// CONSTANTES
// =====================
const GREEN = "#1FA83D";
const CARD_BG = "#E6E6E6";
const PAST_CARD_BG = "#D4D4D4";
const PAST_SECTION_BG = "#8B8B8B";
const WHATSAPP_NUMBER = "5511964070127";

// Mensagem padrão do WhatsApp (requisito do Jota)
const WHATSAPP_DEFAULT_MESSAGE = "Olá! Estava no aplicativo e me interessei pela expedição";

// =====================
// COMPONENTE PRINCIPAL
// =====================
export default function Events({ navigation }: Props) {
  const { user, role } = useAuth();
  const isAdmin = role === "admin";

  const [allEvents, setAllEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Controle de exibição dos eventos passados
  const [showPastEvents, setShowPastEvents] = useState(false);

  // Modal de criação
  const [modalVisible, setModalVisible] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formStartDate, setFormStartDate] = useState(""); // DD/MM/AAAA
  const [formEndDate, setFormEndDate] = useState(""); // DD/MM/AAAA
  const [formImageUri, setFormImageUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // =====================
  // LISTENER FIRESTORE (tempo real)
  // =====================
  useEffect(() => {
    // Query: todos os eventos ativos, ordenados por data de início
    const q = query(
      collection(db, "events"),
      where("isActive", "==", true),
      orderBy("startDate", "asc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: EventItem[] = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();

          // Converter Timestamps para Date
          const startDate = data.startDate?.toDate?.() || new Date();
          const endDate = data.endDate?.toDate?.() || new Date();
          const createdAt = data.createdAt?.toDate?.() || new Date();

          list.push({
            id: docSnap.id,
            title: data.title || "",
            description: data.description || "",
            imageUrl: data.imageUrl || "",
            imagePath: data.imagePath,
            startDate,
            endDate,
            isActive: data.isActive ?? true,
            createdAt,
            createdBy: data.createdBy || "",
          });
        });

        setAllEvents(list);
        setLoading(false);
      },
      (error) => {
        console.error("Erro ao carregar eventos:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // =====================
  // SEPARAR EVENTOS FUTUROS E PASSADOS
  // =====================
  const { upcomingEvents, pastEvents } = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const upcoming: EventItem[] = [];
    const past: EventItem[] = [];

    allEvents.forEach((ev) => {
      if (ev.endDate < now) {
        past.push(ev);
      } else {
        upcoming.push(ev);
      }
    });

    // Eventos passados: mais recente primeiro
    past.sort((a, b) => b.endDate.getTime() - a.endDate.getTime());

    return { upcomingEvents: upcoming, pastEvents: past };
  }, [allEvents]);

  // =====================
  // AGRUPAR POR MÊS (apenas eventos futuros)
  // =====================
  const groupedByMonth = useMemo(() => {
    const groups: Record<string, EventItem[]> = {};

    upcomingEvents.forEach((ev) => {
      const monthKey = formatMonthYear(ev.startDate);
      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(ev);
    });

    return Object.entries(groups);
  }, [upcomingEvents]);

  // =====================
  // FUNÇÕES AUXILIARES
  // =====================

  function formatMonthYear(date: Date): string {
    const month = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(date);
    const year = date.getFullYear();
    return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${year}`;
  }

  function formatDateRange(start: Date, end: Date): string {
    const fmt = new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    return `${fmt.format(start)} - ${fmt.format(end)}`;
  }

  function parseDate(str: string): Date | null {
    if (!str.trim()) return null;
    const match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return null;
    const [, dd, mm, yyyy] = match;
    const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    if (isNaN(date.getTime())) return null;
    return date;
  }

  function generateFileName(uri: string): string {
    const ext = uri.split(".").pop()?.toLowerCase() || "jpg";
    return `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
  }

  async function uploadImage(uri: string): Promise<{ url: string; path: string }> {
    const fileName = generateFileName(uri);
    const storagePath = `events/${fileName}`;
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

  function openWhatsApp(eventTitle: string, eventDate: string) {
    const message = `${WHATSAPP_DEFAULT_MESSAGE} "${eventTitle}" (${eventDate}). Poderia me passar mais detalhes?`;
    const encodedMessage = encodeURIComponent(message);
    const url = `https://api.whatsapp.com/send?phone=${WHATSAPP_NUMBER}&text=${encodedMessage}`;

    Linking.openURL(url).catch(() => {
      Alert.alert("Erro", "Não foi possível abrir o WhatsApp.");
    });
  }

  // =====================
  // AÇÕES DO MODAL
  // =====================

  function openCreate() {
    setFormTitle("");
    setFormDescription("");
    setFormStartDate("");
    setFormEndDate("");
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
    const description = formDescription.trim();

    if (!title) {
      Alert.alert("Campo obrigatório", "Preencha o título do evento.");
      return;
    }

    const startDate = parseDate(formStartDate);
    const endDate = parseDate(formEndDate);

    if (!startDate || !endDate) {
      Alert.alert("Datas inválidas", "Use o formato DD/MM/AAAA para as datas.");
      return;
    }

    if (endDate < startDate) {
      Alert.alert("Datas inválidas", "A data de fim não pode ser anterior à data de início.");
      return;
    }

    if (!formImageUri) {
      Alert.alert("Imagem obrigatória", "Selecione uma imagem para o evento.");
      return;
    }

    setSaving(true);

    try {
      const { url: imageUrl, path: imagePath } = await uploadImage(formImageUri);
      const finalDescription = description || generateAutoDescription(title, startDate, endDate);

      await addDoc(collection(db, "events"), {
        title,
        description: finalDescription,
        imageUrl,
        imagePath,
        startDate: Timestamp.fromDate(startDate),
        endDate: Timestamp.fromDate(endDate),
        isActive: true,
        createdAt: Timestamp.now(),
        createdBy: user?.uid || "",
      });

      setModalVisible(false);
      Alert.alert("Sucesso", "Evento criado com sucesso!");
    } catch (error: any) {
      console.error("Erro ao criar evento:", error);
      Alert.alert("Erro", error.message || "Não foi possível criar o evento.");
    } finally {
      setSaving(false);
    }
  }

  function generateAutoDescription(title: string, start: Date, end: Date): string {
    const range = formatDateRange(start, end);
    return `Leve seu 4x4 e a família para uma experiência inesquecível!

${title}
${range}

• Trilhas off-road guiadas com segurança
• Paisagens incríveis e muita aventura
• Confraternização com o grupo

Toque no botão abaixo para falar com o Jota e garantir sua vaga!`;
  }

  async function confirmDelete(item: EventItem, isPast: boolean = false) {
    const message = isPast
      ? `Excluir permanentemente "${item.title}"?\n\nIsso irá remover o evento e a imagem do banco de dados.`
      : `Tem certeza que deseja excluir "${item.title}"?`;

    Alert.alert("Excluir evento", message, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            if (item.imagePath) {
              await deleteImage(item.imagePath);
            }
            await deleteDoc(doc(db, "events", item.id));

            if (isPast) {
              Alert.alert("Sucesso", "Evento passado removido com sucesso!");
            }
          } catch (error: any) {
            console.error("Erro ao excluir:", error);
            Alert.alert("Erro", "Não foi possível excluir o evento.");
          }
        },
      },
    ]);
  }

  // =====================
  // COMPONENTES DE UI
  // =====================

  function Header() {
    return (
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerIconLeft}
          onPress={() => navigation.openDrawer?.()}
          activeOpacity={0.7}
        >
          <Feather name="menu" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Eventos</Text>
        <TouchableOpacity style={styles.headerIconRight} activeOpacity={0.7}>
          <Image
            source={require("../assets/logo-Jota.png")}
            style={styles.headerLogo}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>
    );
  }

  // Card de evento futuro (com botão WhatsApp)
  function UpcomingCard({ item }: { item: EventItem }) {
    const dateRange = formatDateRange(item.startDate, item.endDate);
    const shortDate = new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(item.startDate);

    return (
      <View style={styles.card}>
        <Image
          source={{ uri: item.imageUrl }}
          style={styles.cardImage}
          resizeMode="cover"
        />

        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardDates}>{dateRange}</Text>
          <Text style={styles.cardDescription} numberOfLines={4}>
            {item.description}
          </Text>

          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => openWhatsApp(item.title, shortDate)}
            activeOpacity={0.8}
          >
            <Feather name="message-circle" size={18} color="#fff" />
            <Text style={styles.ctaButtonText}>Quero Participar</Text>
          </TouchableOpacity>
        </View>

        {isAdmin && (
          <TouchableOpacity
            style={styles.trashButton}
            onPress={() => confirmDelete(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="trash-2" size={18} color="#111" />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Card de evento passado (sem botão WhatsApp, visual diferente)
  function PastCard({ item }: { item: EventItem }) {
    const dateRange = formatDateRange(item.startDate, item.endDate);

    return (
      <View style={styles.pastCard}>
        <Image
          source={{ uri: item.imageUrl }}
          style={styles.pastCardImage}
          resizeMode="cover"
        />

        <View style={styles.pastCardBody}>
          <Text style={styles.pastCardTitle}>{item.title}</Text>
          <Text style={styles.pastCardDates}>{dateRange}</Text>
        </View>

        <TouchableOpacity
          style={styles.pastTrashButton}
          onPress={() => confirmDelete(item, true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="trash-2" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  }

  // Seção de eventos passados (só para admin)
  function PastEventsSection() {
    if (!isAdmin || pastEvents.length === 0) return null;

    return (
      <View style={styles.pastSection}>
        <TouchableOpacity
          style={styles.pastSectionHeader}
          onPress={() => setShowPastEvents(!showPastEvents)}
          activeOpacity={0.8}
        >
          <View style={styles.pastSectionHeaderLeft}>
            <Feather name="archive" size={20} color="#fff" />
            <Text style={styles.pastSectionTitle}>
              Eventos Passados ({pastEvents.length})
            </Text>
          </View>
          <Feather
            name={showPastEvents ? "chevron-up" : "chevron-down"}
            size={24}
            color="#fff"
          />
        </TouchableOpacity>

        {showPastEvents && (
          <View style={styles.pastSectionContent}>
            <Text style={styles.pastSectionHint}>
              Estes eventos já aconteceram. Você pode excluí-los para liberar espaço.
            </Text>
            {pastEvents.map((ev) => (
              <PastCard key={ev.id} item={ev} />
            ))}
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
          <Text style={styles.loadingText}>Carregando eventos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Header />

      <FlatList
        data={groupedByMonth}
        keyExtractor={([month]) => month}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <Text style={styles.sectionTop}>Próximas Expedições</Text>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="calendar" size={48} color="#ccc" />
            <Text style={styles.emptyText}>Nenhum evento disponível</Text>
            <Text style={styles.emptySubtext}>
              Fique ligado! Em breve novas expedições serão anunciadas.
            </Text>
          </View>
        }
        ListFooterComponent={<PastEventsSection />}
        renderItem={({ item: [month, events] }) => (
          <View style={styles.monthGroup}>
            <Text style={styles.monthTitle}>{month}</Text>
            {events.map((ev) => (
              <UpcomingCard key={ev.id} item={ev} />
            ))}
          </View>
        )}
        showsVerticalScrollIndicator={false}
      />

      {/* FAB "Novo evento" (só admin) */}
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
              <Text style={styles.modalTitle}>Novo Evento</Text>

              <TextInput
                style={styles.input}
                placeholder="Título do evento (ex.: Vale do Codó)"
                value={formTitle}
                onChangeText={setFormTitle}
                editable={!saving}
              />

              <View style={styles.dateRow}>
                <TextInput
                  style={[styles.input, styles.dateInput]}
                  placeholder="Início (DD/MM/AAAA)"
                  value={formStartDate}
                  onChangeText={setFormStartDate}
                  keyboardType="numeric"
                  editable={!saving}
                />
                <TextInput
                  style={[styles.input, styles.dateInput]}
                  placeholder="Fim (DD/MM/AAAA)"
                  value={formEndDate}
                  onChangeText={setFormEndDate}
                  keyboardType="numeric"
                  editable={!saving}
                />
              </View>

              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Descrição do evento (opcional - será gerada automaticamente se vazio)"
                value={formDescription}
                onChangeText={setFormDescription}
                multiline
                editable={!saving}
              />

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
                <Image
                  source={{ uri: formImageUri }}
                  style={styles.preview}
                  resizeMode="cover"
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

  listContent: { paddingHorizontal: 16, paddingBottom: 32 },

  sectionTop: {
    fontSize: 22,
    fontWeight: "700",
    alignSelf: "center",
    marginVertical: 16,
    color: "#111",
  },

  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 12, color: "#666", fontSize: 14 },

  emptyContainer: { alignItems: "center", marginTop: 60, paddingHorizontal: 32 },
  emptyText: { marginTop: 12, color: "#999", fontSize: 18, fontWeight: "600" },
  emptySubtext: { marginTop: 8, color: "#aaa", fontSize: 14, textAlign: "center" },

  monthGroup: { marginBottom: 24 },
  monthTitle: { fontSize: 18, fontWeight: "800", color: "#111", marginBottom: 12 },

  // Card de evento futuro
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    marginBottom: 18,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },

  cardImage: { width: "100%", height: 180 },

  cardBody: {
    backgroundColor: CARD_BG,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  cardTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111",
    marginBottom: 4,
  },

  cardDates: {
    fontSize: 13,
    fontWeight: "700",
    color: "#555",
    marginBottom: 8,
  },

  cardDescription: {
    fontSize: 14,
    color: "#444",
    lineHeight: 20,
    marginBottom: 12,
  },

  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GREEN,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },

  ctaButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },

  trashButton: {
    position: "absolute",
    right: 12,
    top: 12,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 16,
    padding: 6,
  },

  // Seção de eventos passados
  pastSection: {
    marginTop: 24,
    borderRadius: 12,
    overflow: "hidden",
  },

  pastSectionHeader: {
    backgroundColor: PAST_SECTION_BG,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  pastSectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  pastSectionTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  pastSectionContent: {
    backgroundColor: "#F0F0F0",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },

  pastSectionHint: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
    marginBottom: 12,
    textAlign: "center",
  },

  // Card de evento passado (compacto)
  pastCard: {
    flexDirection: "row",
    backgroundColor: PAST_CARD_BG,
    borderRadius: 10,
    marginBottom: 10,
    overflow: "hidden",
    alignItems: "center",
  },

  pastCardImage: {
    width: 80,
    height: 60,
  },

  pastCardBody: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  pastCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
  },

  pastCardDates: {
    fontSize: 11,
    color: "#666",
    marginTop: 2,
  },

  pastTrashButton: {
    backgroundColor: "#E74C3C",
    padding: 10,
    marginRight: 8,
    borderRadius: 8,
  },

  // FAB
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

  dateRow: {
    flexDirection: "row",
    gap: 10,
  },

  dateInput: {
    flex: 1,
  },

  textArea: {
    height: 100,
    textAlignVertical: "top",
    paddingTop: 12,
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