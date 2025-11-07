import React, { useEffect, useMemo, useState } from "react";
import {
  View, Text, SafeAreaView, StatusBar, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Modal,
  ScrollView, Image, Switch, FlatList
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import {
  getAuth, updateEmail, updatePassword,
  reauthenticateWithCredential, EmailAuthProvider,
} from "firebase/auth";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp,
} from "firebase/firestore";

type UserProfile = {
  name: string;
  email: string;
  dob?: string;       // YYYY-MM-DD
  phone?: string;     // 11999998888
  hasVehicle?: boolean;
  carModel?: string;
  updatedAt?: any;
  createdAt?: any;
};

const GREEN = "#1FA83D";
const PANEL = "#e7e7e7";
const TITLE = "#0f0f0f";

const CAR_MODELS = [
  "Pajero TR4",
  "Pajero Dakar",
  "L200 Triton",
  "Jimny",
  "Troller T4",
  "Toyota Bandeirante",
  "Wrangler",
  "Hilux",
  "Ranger",
  "S10",
  "Outro…",
];

export default function Profile({ navigation }: any) {
  const { user } = useAuth() as any;
  const auth = getAuth();
  const db = getFirestore();

  const uid = user?.uid;

  // state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [hasVehicle, setHasVehicle] = useState(true);
  const [carModel, setCarModel] = useState("");

  // senha modal
  const [pwdModal, setPwdModal] = useState(false);
  const [currPwd, setCurrPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [newPwd2, setNewPwd2] = useState("");

  // seletor de modelo Modals
  const [modelModal, setModelModal] = useState(false);
  const [customModelModal, setCustomModelModal] = useState(false);
  const [customModelText, setCustomModelText] = useState("");

  // load profile
  useEffect(() => {
    if (!uid) return;
    (async () => {
      try {
        const ref = doc(db, "users", uid);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          const base: UserProfile = {
            name: user.displayName || "",
            email: user.email || "",
            hasVehicle: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          await setDoc(ref, base);
          setName(base.name);
          setEmail(base.email);
          setHasVehicle(true);
        } else {
          const data = snap.data() as UserProfile;
          setEmail(data.email || user.email || "");
          setName(data.name || "");
          setDob(data.dob || "");
          setPhone(data.phone || "");
          setHasVehicle(typeof data.hasVehicle === "boolean" ? data.hasVehicle : true);
          setCarModel(data.carModel || "");
        }
      } catch (e) {
        console.log("profile load error:", e);
        Alert.alert("Erro", "Não foi possível carregar seu perfil.");
      } finally {
        setLoading(false);
      }
    })();
  }, [uid]);

  // helpers
  const onlyDigits = (s: string) => s.replace(/\D+/g, "");
  const isISODate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

  async function handleSave() {
    if (!uid) return;
    const trimmedPhone = onlyDigits(phone);

    if (!isEmail(email)) {
      Alert.alert("Atenção", "Email inválido.");
      return;
    }
    if (dob && !isISODate(dob)) {
      Alert.alert("Atenção", "Aniversário deve ser YYYY-MM-DD (ex.: 1990-08-23).");
      return;
    }

    setSaving(true);
    try {
      // se e-mail foi alterado no Auth, precisa reautenticar
      if (email !== (user.email || "")) {
        await requireReauthAndUpdateEmail();
      }

      const ref = doc(db, "users", uid);
      await updateDoc(ref, {
        name: name.trim(),
        email: email.trim(),
        dob: dob || "",
        phone: trimmedPhone || "",
        hasVehicle,
        carModel: hasVehicle ? carModel.trim() : "",
        updatedAt: serverTimestamp(),
      });

      Alert.alert("Pronto!", "Perfil atualizado com sucesso.");
    } catch (e: any) {
      console.log("save profile error:", e);
      Alert.alert("Erro", e?.message ?? "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function requireReauthAndUpdateEmail() {
    // iOS tem Alert.prompt; no Android usamos o modal de senha
    if ((Alert as any).prompt) {
      return new Promise<void>((resolve, reject) => {
        (Alert as any).prompt(
          "Confirme sua senha",
          "Para alterar o e-mail, confirme sua senha atual.",
          [
            { text: "Cancelar", style: "cancel", onPress: () => reject(new Error("cancel")) },
            {
              text: "Confirmar",
              onPress: async (pwd: string) => {
                try {
                  if (!pwd) throw new Error("Senha não informada.");
                  const cred = EmailAuthProvider.credential(user.email, pwd);
                  await reauthenticateWithCredential(auth.currentUser!, cred);
                  await updateEmail(auth.currentUser!, email.trim());
                  resolve();
                } catch (err) { reject(err as any); }
              },
            },
          ],
          "secure-text"
        );
      });
    } else {
      // Android → usa o mesmo modal de “Alterar senha” para pedir a atual rapidamente
      setPwdModal(true);
      throw new Error("reauth_pending_modal");
    }
  }

  async function doChangePassword() {
    try {
      if (!currPwd || !newPwd || !newPwd2) {
        Alert.alert("Atenção", "Preencha todos os campos.");
        return;
      }
      if (newPwd.length < 6) {
        Alert.alert("Atenção", "Nova senha deve ter pelo menos 6 caracteres.");
        return;
      }
      if (newPwd !== newPwd2) {
        Alert.alert("Atenção", "A confirmação não confere.");
        return;
      }

      const cred = EmailAuthProvider.credential(user.email, currPwd);
      await reauthenticateWithCredential(auth.currentUser!, cred);
      await updatePassword(auth.currentUser!, newPwd);

      setPwdModal(false);
      setCurrPwd(""); setNewPwd(""); setNewPwd2("");
      Alert.alert("Pronto!", "Senha alterada.");
    } catch (e: any) {
      console.log("change pwd error:", e);
      Alert.alert("Erro", e?.message ?? "Não foi possível alterar.");
    }
  }

  // UI
  function Header() {
    return (
      <View style={{ height: 72, backgroundColor: GREEN, flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
        <TouchableOpacity style={{ position: "absolute", left: 16, top: "50%", marginTop: -13 }} onPress={() => navigation.openDrawer?.()} activeOpacity={0.7}>
          <Feather name="menu" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={{ color: "#fff", fontSize: 22, fontWeight: "700" }}>Perfil</Text>
        <View style={{ position: "absolute", right: 16, top: "50%", marginTop: -18 }}>
          <Image source={require("../assets/logo-Jota.png")} style={{ width: 36, height: 36 }} resizeMode="contain" />
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        <StatusBar barStyle="light-content" />
        <Header />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <StatusBar barStyle="light-content" />
      <Header />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <Text style={{ textAlign: "center", fontSize: 18, fontWeight: "700", color: TITLE, marginBottom: 12 }}>
          Editar Perfil
        </Text>

        {/* Painel */}
        <View style={{ backgroundColor: PANEL, borderRadius: 16, padding: 12 }}>
          <View style={{ backgroundColor: GREEN, borderRadius: 6, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 12 }}>
            <Text style={{ color: "#fff", fontWeight: "800" }}>Dados do Usuário</Text>
          </View>

          {/* Email */}
          <Field label="Email">
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="exemplo@dominio.com"
              style={input}
            />
          </Field>

          {/* Nome */}
          <Field label="Nome Completo">
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Seu nome"
              style={input}
            />
          </Field>

          {/* Senha */}
          <Field label="Senha">
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ flex: 1, paddingVertical: 12, color: "#444" }}>********</Text>
              <TouchableOpacity onPress={() => setPwdModal(true)} activeOpacity={0.9} style={{ backgroundColor: GREEN, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 }}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>Alterar</Text>
              </TouchableOpacity>
            </View>
          </Field>

          {/* Possui veículo? */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <Switch value={hasVehicle} onValueChange={setHasVehicle} thumbColor="#fff" trackColor={{ true: GREEN, false: "#bbb" }} />
            <Text style={{ marginLeft: 8, fontWeight: "700" }}>Possui Veículo?</Text>
          </View>

          {/* Modelo (seletor) */}
          {hasVehicle && (
            <Field label="Modelo">
              <TouchableOpacity onPress={() => setModelModal(true)} activeOpacity={0.7} style={[input, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
                <Text style={{ color: carModel ? "#111" : "#999" }}>{carModel || "Selecione o modelo"}</Text>
                <Feather name="chevron-right" size={20} color="#666" />
              </TouchableOpacity>
            </Field>
          )}

          {/* DOB */}
          <Field label="Aniversário (YYYY-MM-DD)">
            <TextInput
              value={dob}
              onChangeText={setDob}
              placeholder="1990-08-23"
              autoCapitalize="none"
              style={input}
            />
          </Field>

          {/* Telefone */}
          <Field label="Telefone (somente números)">
            <TextInput
              value={phone}
              onChangeText={(v) => setPhone(onlyDigits(v))}
              placeholder="11999998888"
              keyboardType="phone-pad"
              style={input}
            />
          </Field>

          {/* CTA Clube Jota */}
          <View style={{ alignItems: "center", marginTop: 12 }}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => navigation.navigate("ClubeJota")}
              style={{ backgroundColor: GREEN, paddingVertical: 14, paddingHorizontal: 18, borderRadius: 8, minWidth: 220, alignItems: "center" }}
            >
              <Text style={{ color: "#fff", fontWeight: "900" }}>Quero fazer parte!</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Salvar */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.9}
          style={{ backgroundColor: GREEN, marginTop: 16, paddingVertical: 14, borderRadius: 10, alignItems: "center", opacity: saving ? 0.6 : 1 }}
        >
          <Text style={{ color: "#fff", fontWeight: "800" }}>{saving ? "Salvando..." : "Salvar alterações"}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal Selecionar Modelo */}
      <Modal transparent visible={modelModal} animationType="fade" onRequestClose={() => setModelModal(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", padding: 20 }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 12, maxHeight: "70%" }}>
            <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 8 }}>Escolha o modelo</Text>
            <FlatList
              data={CAR_MODELS}
              keyExtractor={(i) => i}
              renderItem={({ item }) => (
                <TouchableOpacity
                    onPress={() => {
                    if (item === "Outro…") {
                        setModelModal(false);

                        // iOS: tem Alert.prompt
                        if ((Alert as any).prompt) {
                        (Alert as any).prompt(
                            "Modelo",
                            "Digite o modelo",
                            [
                            { text: "Cancelar", style: "cancel" },
                            {
                                text: "OK",
                                onPress: (txt: string) => setCarModel((txt || "").trim()),
                            },
                            ],
                            "plain-text"
                        );
                        } else {
                        // Android: abre um pequeno modal com TextInput
                        setTimeout(() => {
                            setCustomModelText("");
                            setCustomModelModal(true);
                        }, 200);
                        }
                    } else {
                        setCarModel(item);
                        setModelModal(false);
                    }
                    }}
                  style={{ paddingVertical: 12 }}
                >
                  <Text style={{ fontSize: 16 }}>{item}</Text>
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: "#eee" }} />}
            />
            <View style={{ alignItems: "flex-end", marginTop: 8 }}>
              <TouchableOpacity onPress={() => setModelModal(false)} style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
                <Text style={{ fontWeight: "700" }}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={customModelModal}
        animationType="fade"
        onRequestClose={() => setCustomModelModal(false)}
        >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", padding: 20 }}>
            <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 8 }}>Modelo</Text>
            <TextInput
                placeholder="Digite o modelo"
                value={customModelText}
                onChangeText={setCustomModelText}
                style={{
                borderWidth: 1, borderColor: "#d9d9d9", borderRadius: 8,
                paddingHorizontal: 12, height: 44, backgroundColor: "#fff",
                }}
            />
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 12 }}>
                <TouchableOpacity onPress={() => setCustomModelModal(false)} style={{ backgroundColor: "#eee", paddingHorizontal: 16, height: 42, borderRadius: 8, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontWeight: "700" }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                onPress={() => {
                    setCarModel(customModelText.trim());
                    setCustomModelModal(false);
                }}
                style={{ backgroundColor: GREEN, paddingHorizontal: 16, height: 42, borderRadius: 8, alignItems: "center", justifyContent: "center" }}
                >
                <Text style={{ color: "#fff", fontWeight: "700" }}>OK</Text>
                </TouchableOpacity>
            </View>
            </View>
        </View>
      </Modal>

      {/* Modal Alterar/Confirmar Senha */}
      <Modal transparent visible={pwdModal} animationType="slide" onRequestClose={() => setPwdModal(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <View style={{ width: "100%", backgroundColor: "#fff", borderRadius: 12, padding: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 10 }}>Alterar senha</Text>
            <TextInput placeholder="Senha atual" secureTextEntry value={currPwd} onChangeText={setCurrPwd} style={input} />
            <TextInput placeholder="Nova senha (mín. 6)" secureTextEntry value={newPwd} onChangeText={setNewPwd} style={input} />
            <TextInput placeholder="Confirmar nova senha" secureTextEntry value={newPwd2} onChangeText={setNewPwd2} style={input} />
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 8 }}>
              <TouchableOpacity onPress={() => { setPwdModal(false); setCurrPwd(""); setNewPwd(""); setNewPwd2(""); }} style={btnSecondary}>
                <Text style={{ fontWeight: "700" }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={doChangePassword} style={btnPrimary}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={{ fontWeight: "700", marginBottom: 6 }}>{label}</Text>
      {children}
    </View>
  );
}

// estilos pequenos para inputs/botões
const input = {
  borderWidth: 1, borderColor: "#d9d9d9", borderRadius: 8,
  paddingHorizontal: 12, height: 44, backgroundColor: "#fff",
} as const;

const btnPrimary = {
  backgroundColor: GREEN, paddingHorizontal: 16, height: 42, borderRadius: 8,
  alignItems: "center", justifyContent: "center",
} as const;

const btnSecondary = {
  backgroundColor: "#eee", paddingHorizontal: 16, height: 42, borderRadius: 8,
  alignItems: "center", justifyContent: "center",
} as const;
