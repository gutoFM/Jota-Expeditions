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
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const isAdmin = true; // Troque pela verificação real do papel do usuário

type Announcement = {
  id: string;
  title: string;
  body: string;
  imageUrl: string; // use URL por enquanto; depois podemos trocar para asset local ou picker
  createdAt: number;
};

const STORAGE_KEY = "@jota_announcements";

export default function Home({ route }: Props) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const role = route.params?.role ?? 'user';
  const isAdmin = role === 'admin';

  // Modal "Novo anúncio"
  const [modalVisible, setModalVisible] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");

  // Carrega anúncios persistidos
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          setItems(JSON.parse(raw));
        } else {
          // Seed opcional para desenvolvimento (troque as URLs pelas suas imagens)
          setItems([
            {
              id: "seed-1",
              title: "Expedição da Placa – 23/08",
              body:
                "Somente com Jota Expedições você encontra passeios 4x4 com supervisão e instrução que precisa para aprender mais e se sentir mais seguro.",
              imageUrl:
                "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?q=80&w=1600&auto=format&fit=crop",
              createdAt: Date.now() - 1000 * 60 * 60 * 24,
            },
            {
              id: "seed-2",
              title: "Estrada Real – 13/08 à 17/08",
              body:
                "Tire seu 4x4 da garagem, leve a família para uma imersão na natureza e curta paisagens incríveis com segurança e orientação.",
              imageUrl:
                "https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=1600&auto=format&fit=crop",
              createdAt: Date.now() - 1000 * 60 * 60 * 48,
            },
          ]);
        }
      } catch (e) {
        console.log("Erro lendo anúncios:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Persiste sempre que mudar
  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      } catch (e) {
        console.log("Erro salvando anúncios:", e);
      }
    })();
  }, [items]);

  const sorted = useMemo(
    () => [...items].sort((a, b) => b.createdAt - a.createdAt),
    [items]
  );

  function openCreate() {
    setFormTitle("");
    setFormBody("");
    setFormImageUrl("");
    setModalVisible(true);
  }

  function saveCreate() {
    const title = formTitle.trim();
    const body = formBody.trim();
    const imageUrl = formImageUrl.trim();

    if (!title || !body || !imageUrl) {
      Alert.alert("Campos obrigatórios", "Preencha título, texto e imagem.");
      return;
    }

    const newItem: Announcement = {
      id: String(Date.now()),
      title,
      body,
      imageUrl,
      createdAt: Date.now(),
    };

    setItems((prev) => [newItem, ...prev]);
    setModalVisible(false);
  }

  function confirmDelete(id: string) {
    Alert.alert("Excluir anúncio", "Tem certeza que deseja excluir?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () => setItems((prev) => prev.filter((x) => x.id !== id)),
      },
    ]);
  }

  // Cabeçalho verde da Home (igual ao Figma)
  function Header() {
    return (
      <View style={styles.header}>
        <TouchableOpacity activeOpacity={0.7} style={styles.headerIconLeft}>
          {/* Troque pelo seu ícone (assets) se preferir */}
          <Feather name="menu" size={26} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Home</Text>

        <TouchableOpacity activeOpacity={0.7} style={styles.headerIconRight}>
          {/* Substitua pelo logo do Jota que você já possui */}
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
        <Text style={styles.sectionTitle}>Últimas Aventuras</Text>
      </View>
    );
  }

  function Card({ item }: { item: Announcement }) {
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
        </View>

        {isAdmin && (
          <TouchableOpacity
            style={styles.trashButton}
            onPress={() => confirmDelete(item.id)}
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
        ListHeaderComponent={<SectionTitle />}
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
            />
            <TextInput
              style={[styles.input, { height: 100, textAlignVertical: "top" }]}
              placeholder="Texto do anúncio"
              value={formBody}
              onChangeText={setFormBody}
              multiline
            />
            <TextInput
              style={styles.input}
              placeholder="URL da imagem (obrigatório)"
              value={formImageUrl}
              onChangeText={setFormImageUrl}
              autoCapitalize="none"
            />

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

const GREEN = "#1FA83D"; // ajuste fino se quiser ficar idêntico ao seu Figma
const CARD_BG = "#E6E6E6";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },

  header: {
    height: 72,
    backgroundColor: GREEN,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
  },
  headerIconLeft: {
    position: "absolute",
    left: 16,
    top: "50%",
    marginTop: -13,
  },
  headerIconRight: {
    position: "absolute",
    right: 16,
    top: "50%",
    marginTop: -18,
  },
  headerLogo: { width: 36, height: 36 },

  sectionTitleWrap: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111",
  },

  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },

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
  cardImage: {
    width: "100%",
    height: 190,
  },
  cardBody: {
    backgroundColor: CARD_BG,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111",
    marginBottom: 6,
  },
  cardText: {
    fontSize: 14.5,
    color: "#444",
    lineHeight: 20,
  },
  trashButton: {
    position: "absolute",
    right: 12,
    top: 12,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 16,
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
  modalBox: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
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
