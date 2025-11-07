import React, { useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar, FlatList,
  TouchableOpacity, Modal, TextInput, Alert, KeyboardAvoidingView,
  Platform, Image, Linking, ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import type { DrawerScreenProps } from "@react-navigation/drawer";
import type { DrawerParamList } from "../navigation/AppDrawer";
import { useAuth } from "../contexts/AuthContext";

type Props = DrawerScreenProps<DrawerParamList, "Eventos">;

const GREEN = "#1FA83D";
const CARD_BG = "#E6E6E6";
const STORAGE_KEY = "@jota_events_v1";

export type EventItem = {
  id: string;
  title: string;
  startDate: string; // ISO (yyyy-mm-dd)
  endDate: string;   // ISO
  short?: string;    // resumo do card
  description: string; // texto maior pro detalhe
  imageUrl?: string; // opcional (placeholder se vazio)
  ctaText?: string;  // ex: “Compre a Aventura”
  ctaUrl?: string;   // ex: link do WhatsApp
  createdAt: number;
};

const seed: EventItem[] = [
  {
    id: "e1",
    title: "Vale do Codó",
    startDate: "2025-09-04",
    endDate: "2025-09-07",
    short:
      "Viagem imperdível! Passa por muitos mirantes e cachoeiras, além de desafios off road.",
    description:
      "Leve seu 4x4 e a família para passear nesse paraíso!\n\n" +
      "Dia 1 - Viagem no seu ritmo até o hotel em Jaguariaíva e encontro com os amigos para um passeio no parque.\n" +
      "Dia 2 - Conheça belas cachoeiras e mirantes da cidade.\n" +
      "Dia 3 - Visite o vale do Jaguariaíva e curta cachoeiras, desafios 4x4 e belas paisagens.\n" +
      "Dia 4 - O famoso túnel offroad enfrentando uma trilha alagada. Almoço com os amigos e retorno para a casa.",
    imageUrl: "", // deixe vazio para usar placeholder local
    ctaText: "Compre a Aventura",
    ctaUrl: "https://api.whatsapp.com/send?phone=5511964070127&text=Quero%20fazer%20Parte%20da%20Expedição%20Vale%20do%20Codó",
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
  },
  {
    id: "e2",
    title: "Serra da Canastra",
    startDate: "2025-10-09",
    endDate: "2025-10-12",
    short:
      "Cânions, cachoeiras e experiências históricas e gastronômicas durante nosso passeio.",
    description:
      "Imersão offroad na Canastra, com trilhas, mirantes e aquela gastronomia mineira que ninguém esquece.",
    imageUrl: "",
    ctaText: "Compre a Aventura",
    ctaUrl: "https://api.whatsapp.com/send?phone=5511964070127&text=Quero%20fazer%20Parte%20da%20Expedição%20Serra%20da%20Canastra",
    createdAt: Date.now() - 1000 * 60 * 60 * 48,
  },
];

function buildAutoDescription(title: string, startISO: string, endISO: string) {
  const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const range = `${fmt.format(new Date(startISO))} - ${fmt.format(new Date(endISO))}`;
  return (
`Leve seu 4x4 e a família para uma experiência inesquecível!

${title}
${range}

• Trilhas off-road guiadas com segurança
• Mirantes e cachoeiras selecionadas
• Confraternização com o grupo ao final do dia

Se interessou? Toque no botão abaixo para falar com o Jota e garantir sua vaga.`
  );
}

function buildWhatsCTA(title: string, startISO: string) {
  const d = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
              .format(new Date(startISO));
  const msg = encodeURIComponent(`Olá, Jota! Tenho interesse na expedição "${title}" (${d}). Pode me passar mais detalhes?`);
  return `https://api.whatsapp.com/send?phone=5511964070127&text=${msg}`;
}

// banner padrão (se não enviar imageUrl)
const DEFAULT_EVENT_BANNER = ""; // deixe vazio p/ usar o require(...) no EventDetails

function toISO(dateStr: string, fallbackYear?: number): string | null {
  if (!dateStr) return null;

  // já está em ISO?
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

  // DD/MM ou DD/MM/AAAA
  const m = dateStr.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = m[3] ? Number(m[3]) : (fallbackYear || new Date().getFullYear());
    // cria date seguro
    const d = new Date(Date.UTC(yyyy, mm - 1, dd));
    if (d.getUTCFullYear() === yyyy && d.getUTCMonth() === mm - 1 && d.getUTCDate() === dd) {
      const mmStr = String(mm).padStart(2, "0");
      const ddStr = String(dd).padStart(2, "0");
      return `${yyyy}-${mmStr}-${ddStr}`;
    }
    return null;
  }

  // última tentativa: Date.parse
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  return null;
}

function monthKeyWithYear(iso: string) {
  const d = new Date(iso);
  const month = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(d);
  return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${d.getFullYear()}`; // ex.: "Novembro 2025"
}

function fmtRange(startISO: string, endISO: string) {
  const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${fmt.format(new Date(startISO))} - ${fmt.format(new Date(endISO))}`;
}


export default function Events({ navigation }: Props) {

  const { userRole, loadingRole } = useAuth() as {
    userRole?: string | null;
    loadingRole?: boolean;
  };

  const roleResolved = (loadingRole === undefined)
    ? (userRole !== undefined)
    : !loadingRole;

  const isAdmin = (userRole ?? "").toLowerCase() === "admin";

  const [items, setItems] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  // modal criação
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState({
    title: "", startDate: "", endDate: "", short: "", description: "",
    imageUrl: "", ctaText: "Compre a Aventura", ctaUrl: "https://api.whatsapp.com/send?phone=5511964070127"
  });

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
        const list: EventItem[] = JSON.parse(raw);
        // migra qualquer data que não esteja em ISO
        const normalized = list.map((ev) => {
            const s = toISO(ev.startDate) || ev.startDate;
            const e = toISO(ev.endDate) || ev.endDate;
            return { ...ev, startDate: s, endDate: e } as EventItem;
        });
        setItems(normalized);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        } else {
        setItems(seed);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
        }
      } catch (e) {
        console.log("events load error:", e);
        setItems(seed);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      } catch (e) {
        console.log("events save error:", e);
      }
    })();

  }, [items]);

    const byMonth = useMemo(() => {
    const sorted = [...items].sort(
        (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );
    const groups: Record<string, EventItem[]> = {};
    sorted.forEach((ev) => {
        const key = monthKeyWithYear(ev.startDate);
        (groups[key] ??= []).push(ev);
    });
    // mantém ordem cronológica das chaves
    const entries = Object.entries(groups);
    return entries.sort((a, b) => {
        const aDate = new Date(a[1][0].startDate).getTime();
        const bDate = new Date(b[1][0].startDate).getTime();
        return aDate - bDate;
    });
    }, [items]);

  function Header() {
    return (
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerIconLeft} onPress={() => navigation.openDrawer?.()} activeOpacity={0.7}>
          <Feather name="menu" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Eventos</Text>
        <TouchableOpacity style={styles.headerIconRight} activeOpacity={0.7}>
          <Image source={require("../assets/logo-Jota.png")} style={styles.headerLogo} resizeMode="contain" />
        </TouchableOpacity>
      </View>
    );
  }

  function Card({ ev }: { ev: EventItem }) {
    const title = ev.title;
    const range = fmtRange(ev.startDate, ev.endDate);
    const openDetails = () => navigation.navigate("EventoDetalhe" as any, { event: ev });
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardDates}>{range}</Text>
        </View>
        <Text style={styles.cardText} numberOfLines={5}>
          {ev.short || "Se interessou pela aventura? Clique em saiba mais!"}
        </Text>
        <View style={{ alignItems: "flex-end" }}>
          <TouchableOpacity onPress={openDetails} activeOpacity={0.8}>
            <Text style={styles.saibaMais}>Saiba mais</Text>
          </TouchableOpacity>
        </View>
        {isAdmin && (
          <TouchableOpacity
            style={styles.trashBtn}
            onPress={() =>
              Alert.alert("Excluir evento", "Tem certeza que deseja excluir?", [
                { text: "Cancelar", style: "cancel" },
                { text: "Excluir", style: "destructive", onPress: () => setItems(prev => prev.filter(x => x.id !== ev.id)) },
              ])
            }
          >
            <Feather name="trash-2" size={18} color="#111" />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  function openCreate() {
    setForm({
      title: "", startDate: "", endDate: "",
      short: "", description: "",
      imageUrl: "", ctaText: "Compre a Aventura",
      ctaUrl: "https://api.whatsapp.com/send?phone=5511964070127"
    });
    setModalVisible(true);
  }

    function saveCreate() {
    const title = form.title.trim();
    const startISO = toISO(form.startDate);
    const endISO = toISO(form.endDate, startISO ? new Date(startISO).getFullYear() : undefined);
    const description = form.description.trim();

    if (!title || !startISO || !endISO) {
        Alert.alert("Campos obrigatórios", "Preencha título e datas válidas (DD/MM ou AAAA-MM-DD).");
        return;
    }

    // 🔹 se não escrever descrição, gera automática
    const finalDescription = description || buildAutoDescription(title, startISO, endISO);

    // 🔹 CTA: usa o que o admin digitou, senão gera WhatsApp padrão
    const finalCTAUrl = (form.ctaUrl?.trim()) || buildWhatsCTA(title, startISO);
    const finalCTAText = (form.ctaText?.trim()) || "Compre a Aventura";

    const newEvent: EventItem = {
        id: String(Date.now()),
        title,
        startDate: startISO,
        endDate: endISO,
        short: form.short?.trim(),
        description: finalDescription,
        imageUrl: form.imageUrl?.trim() || DEFAULT_EVENT_BANNER,
        ctaText: finalCTAText,
        ctaUrl: finalCTAUrl,
        createdAt: Date.now(),
    };

    setItems(prev => [...prev, newEvent]);
    setModalVisible(false);
    }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <Header />
        <View style={{ flex:1, alignItems:"center", justifyContent:"center" }}>
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
        data={byMonth}
        keyExtractor={([month]) => month}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={<Text style={styles.sectionTop}>Próximas Expedições</Text>}
        renderItem={({ item: [month, evs] }) => (
          <View style={{ marginBottom: 18 }}>
            <Text style={styles.monthTitle}>{month}</Text>
            {evs.map(ev => <Card key={ev.id} ev={ev} />)}
          </View>
        )}
      />

        {roleResolved && isAdmin && (
        <TouchableOpacity style={styles.fab} onPress={openCreate} activeOpacity={0.9}>
            <Feather name="plus" size={26} color="#fff" />
        </TouchableOpacity>
        )}

      <Modal animationType="slide" transparent visible={modalVisible}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalRoot}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Novo evento</Text>

            <TextInput style={styles.input} placeholder="Título" value={form.title}
              onChangeText={(v)=>setForm(f=>({...f,title:v}))} />
            <TextInput
            style={styles.input}
            placeholder="Data início (DD/MM ou AAAA-MM-DD)"
            value={form.startDate}
            onChangeText={(v)=>setForm(f=>({...f,startDate:v}))}
            />
            <TextInput
            style={styles.input}
            placeholder="Data fim (DD/MM ou AAAA-MM-DD)"
            value={form.endDate}
            onChangeText={(v)=>setForm(f=>({...f,endDate:v}))}
            />
            <TextInput style={styles.input} placeholder="Resumo (opcional)" value={form.short}
              onChangeText={(v)=>setForm(f=>({...f,short:v}))} />
            <TextInput style={[styles.input,{height:100,textAlignVertical:"top"}]} multiline
              placeholder="Descrição (detalhes para a tela interna)" value={form.description}
              onChangeText={(v)=>setForm(f=>({...f,description:v}))} />
            <TextInput style={styles.input} placeholder="URL da imagem (opcional)"
              value={form.imageUrl} onChangeText={(v)=>setForm(f=>({...f,imageUrl:v}))} autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="Texto do botão (CTA)"
              value={form.ctaText} onChangeText={(v)=>setForm(f=>({...f,ctaText:v}))} />
            <TextInput style={styles.input} placeholder="Link do botão (WhatsApp/Checkout)" autoCapitalize="none"
              value={form.ctaUrl} onChangeText={(v)=>setForm(f=>({...f,ctaUrl:v}))} />

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={()=>setModalVisible(false)}>
                <Text style={[styles.btnText,{color:"#111"}]}>Cancelar</Text>
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

const styles = StyleSheet.create({
  container:{ flex:1, backgroundColor:"#fff" },
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

  listContent:{ paddingHorizontal:16, paddingBottom:32 },
  sectionTop:{ fontSize:20, fontWeight:"700", alignSelf:"center", marginVertical:14, color:"#111" },
  monthTitle:{ fontSize:18, fontWeight:"800", color:"#111", marginBottom:10 },

  card:{
    backgroundColor:"#fff", borderRadius:18, marginBottom:18, overflow:"hidden",
    elevation:2, shadowColor:"#000", shadowOpacity:0.08, shadowRadius:8, shadowOffset:{ width:0, height:4 }
  },
  cardHeader:{ backgroundColor: CARD_BG, paddingHorizontal:14, paddingVertical:10, borderTopLeftRadius:18, borderTopRightRadius:18 },
  cardTitle:{ fontSize:18, fontWeight:"800", color:"#111", textAlign:"center" },
  cardDates:{ fontSize:12, fontWeight:"700", color:"#111", textAlign:"center", marginTop:2 },
  cardText:{ paddingHorizontal:14, paddingVertical:12, fontSize:14.5, color:"#444", lineHeight:20 },
  saibaMais:{ color:GREEN, fontSize:15, fontWeight:"800", paddingHorizontal:14, paddingBottom:14 },

  trashBtn:{ position:"absolute", right:10, top:10, backgroundColor:"rgba(255,255,255,0.95)", borderRadius:16, padding:6 },

  fab:{
    position:"absolute", right:20, bottom:28, width:56, height:56, borderRadius:28,
    backgroundColor:GREEN, alignItems:"center", justifyContent:"center", elevation:6,
    shadowColor:"#000", shadowOpacity:0.2, shadowRadius:8, shadowOffset:{ width:0, height:4 },
  },

  modalRoot:{ flex:1, backgroundColor:"rgba(0,0,0,0.35)", alignItems:"center", justifyContent:"center", paddingHorizontal:20 },
  modalBox:{ width:"100%", backgroundColor:"#fff", borderRadius:14, padding:16 },
  modalTitle:{ fontSize:18, fontWeight:"700", marginBottom:12 },
  input:{ borderWidth:1, borderColor:"#d9d9d9", borderRadius:8, paddingHorizontal:12, height:44, marginBottom:10, backgroundColor:"#fff" },
  modalActions:{ flexDirection:"row", justifyContent:"flex-end", gap:12, marginTop:4 },
  btn:{ paddingHorizontal:16, height:42, borderRadius:8, alignItems:"center", justifyContent:"center" },
  btnPrimary:{ backgroundColor:GREEN }, btnSecondary:{ backgroundColor:"#eee" },
  btnText:{ color:"#fff", fontWeight:"700" },
});
