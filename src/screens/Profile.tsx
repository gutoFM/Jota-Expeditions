import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ScrollView,
  Image,
  Switch,
  FlatList,
  StyleSheet,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import {
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../lib/firebase";

// =====================
// TIPOS
// =====================
type UserProfile = {
  fullName: string;
  email: string;
  dob?: string; // DD/MM/AAAA (exibição) → salva como YYYY/MM/DD no banco
  phone?: string;
  hasVehicle?: boolean;
  carModel?: string;
  role?: string;
  isActive?: boolean;
  updatedAt?: any;
  createdAt?: any;
};

// =====================
// CONSTANTES
// =====================
const GREEN = "#1FA83D";
const PANEL = "#e7e7e7";
const TITLE = "#0f0f0f";

const CAR_MODELS = [
  "Pajero TR4",
  "Pajero Dakar",
  "Pajero Sport",
  "Pajero Full",
  "L200 Triton",
  "L200 Outdoor",
  "Jimny",
  "Jimny Sierra",
  "Troller T4",
  "Toyota Bandeirante",
  "Toyota Hilux",
  "Toyota SW4",
  "Ford Ranger",
  "Chevrolet S10",
  "Chevrolet Trailblazer",
  "Jeep Wrangler",
  "Jeep Renegade",
  "Jeep Compass",
  "Jeep Commander",
  "Land Rover Defender",
  "Land Rover Discovery",
  "Suzuki Vitara",
  "Nissan Frontier",
  "Outro",
];

// =====================
// COMPONENTE PRINCIPAL
// =====================
export default function Profile({ navigation }: any) {
  const { user } = useAuth();
  const uid = user?.uid;

  // Estados do formulário
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState(""); // Formato DD/MM/AAAA para exibição
  const [phone, setPhone] = useState("");
  const [hasVehicle, setHasVehicle] = useState(false);
  const [carModel, setCarModel] = useState("");

  // Modal de senha
  const [pwdModal, setPwdModal] = useState(false);
  const [currPwd, setCurrPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [newPwd2, setNewPwd2] = useState("");
  const [changingPwd, setChangingPwd] = useState(false);

  // Modal de seleção de modelo
  const [modelModal, setModelModal] = useState(false);
  const [customModelModal, setCustomModelModal] = useState(false);
  const [customModelText, setCustomModelText] = useState("");

  // =====================
  // CARREGAR PERFIL DO FIRESTORE
  // =====================
  useEffect(() => {
    if (!uid) return;

    (async () => {
      try {
        // CORREÇÃO: Buscar na collection "profiles", não "users"
        const ref = doc(db, "profiles", uid);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const data = snap.data() as UserProfile;

          // Carregar dados existentes
          setEmail(data.email || user?.email || "");
          setFullName(data.fullName || "");
          setPhone(formatPhoneDisplay(data.phone || ""));
          setHasVehicle(data.hasVehicle === true);
          setCarModel(data.carModel || "");

          // Converter DOB do formato do banco (YYYY/MM/DD) para exibição (DD/MM/AAAA)
          if (data.dob) {
            setDob(convertDobToDisplay(data.dob));
          }
        } else {
          // Perfil não existe ainda - criar com dados básicos
          setEmail(user?.email || "");
          setFullName("");
          setPhone("");
          setHasVehicle(false);
          setCarModel("");
          setDob("");
        }
      } catch (e: any) {
        console.log("profile load error:", e);
        // Se for erro de permissão, ainda assim carregar o email do Auth
        setEmail(user?.email || "");
        Alert.alert("Aviso", "Não foi possível carregar todos os dados do perfil. Complete seu cadastro.");
      } finally {
        setLoading(false);
      }
    })();
  }, [uid]);

  // =====================
  // FUNÇÕES DE FORMATAÇÃO
  // =====================

  // Formatar telefone para exibição: 11964070127 → (11) 96407-0127
  function formatPhoneDisplay(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    } else if (digits.length === 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return digits;
  }

  // Extrair apenas dígitos do telefone para salvar
  function extractPhoneDigits(phone: string): string {
    return phone.replace(/\D/g, "");
  }

  // Formatar telefone enquanto digita
  function handlePhoneChange(text: string) {
    const digits = text.replace(/\D/g, "").slice(0, 11);
    
    if (digits.length <= 2) {
      setPhone(digits.length > 0 ? `(${digits}` : "");
    } else if (digits.length <= 7) {
      setPhone(`(${digits.slice(0, 2)}) ${digits.slice(2)}`);
    } else {
      setPhone(`(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`);
    }
  }

  // Converter DOB do banco (YYYY/MM/DD ou YYYY-MM-DD) para exibição (DD/MM/AAAA)
  function convertDobToDisplay(dbDob: string): string {
    // Aceita tanto YYYY/MM/DD quanto YYYY-MM-DD
    const match = dbDob.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})$/);
    if (match) {
      const [, year, month, day] = match;
      return `${day}/${month}/${year}`;
    }
    return dbDob; // Retorna como está se não conseguir converter
  }

  // Converter DOB de exibição (DD/MM/AAAA) para banco (YYYY/MM/DD)
  function convertDobToStorage(displayDob: string): string {
    const match = displayDob.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      const [, day, month, year] = match;
      return `${year}/${month}/${day}`;
    }
    return displayDob;
  }

  // Formatar data enquanto digita (DD/MM/AAAA)
  function handleDobChange(text: string) {
    const digits = text.replace(/\D/g, "").slice(0, 8);
    
    if (digits.length <= 2) {
      setDob(digits);
    } else if (digits.length <= 4) {
      setDob(`${digits.slice(0, 2)}/${digits.slice(2)}`);
    } else {
      setDob(`${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`);
    }
  }

  // Validar data DD/MM/AAAA
  function isValidDob(dob: string): boolean {
    if (!dob) return true; // Opcional
    const match = dob.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return false;
    
    const [, day, month, year] = match;
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    
    if (m < 1 || m > 12) return false;
    if (d < 1 || d > 31) return false;
    if (y < 1900 || y > new Date().getFullYear()) return false;
    
    // Verificar data válida
    const date = new Date(y, m - 1, d);
    return date.getDate() === d && date.getMonth() === m - 1 && date.getFullYear() === y;
  }

  // Validar email
  function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // =====================
  // SALVAR PERFIL
  // =====================
  async function handleSave() {
    if (!uid) return;

    // Validações
    if (!fullName.trim()) {
      Alert.alert("Atenção", "Preencha seu nome completo.");
      return;
    }

    if (!isValidEmail(email)) {
      Alert.alert("Atenção", "Email inválido.");
      return;
    }

    if (dob && !isValidDob(dob)) {
      Alert.alert("Atenção", "Data de nascimento inválida. Use o formato DD/MM/AAAA.");
      return;
    }

    const phoneDigits = extractPhoneDigits(phone);
    if (phone && (phoneDigits.length < 10 || phoneDigits.length > 11)) {
      Alert.alert("Atenção", "Telefone inválido. Use DDD + número (10 ou 11 dígitos).");
      return;
    }

    if (hasVehicle && !carModel.trim()) {
      Alert.alert("Atenção", "Selecione o modelo do seu veículo.");
      return;
    }

    setSaving(true);

    try {
      const ref = doc(db, "profiles", uid);
      const snap = await getDoc(ref);

      const profileData: Partial<UserProfile> = {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phoneDigits,
        dob: dob ? convertDobToStorage(dob) : "",
        hasVehicle,
        carModel: hasVehicle ? carModel.trim() : "",
        updatedAt: serverTimestamp(),
      };

      if (snap.exists()) {
        // Atualizar documento existente (não sobrescreve role e isActive)
        await updateDoc(ref, profileData);
      } else {
        // Criar novo documento
        await setDoc(ref, {
          ...profileData,
          createdAt: serverTimestamp(),
        });
      }

      Alert.alert("Sucesso!", "Perfil atualizado com sucesso.");
    } catch (e: any) {
      console.log("save profile error:", e);
      Alert.alert("Erro", e?.message ?? "Não foi possível salvar o perfil.");
    } finally {
      setSaving(false);
    }
  }

  // =====================
  // ALTERAR SENHA
  // =====================
  async function doChangePassword() {
    if (!currPwd || !newPwd || !newPwd2) {
      Alert.alert("Atenção", "Preencha todos os campos.");
      return;
    }

    if (newPwd.length < 6) {
      Alert.alert("Atenção", "A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (newPwd !== newPwd2) {
      Alert.alert("Atenção", "A confirmação da nova senha não confere.");
      return;
    }

    setChangingPwd(true);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) {
        throw new Error("Usuário não autenticado.");
      }

      // Reautenticar
      const credential = EmailAuthProvider.credential(currentUser.email, currPwd);
      await reauthenticateWithCredential(currentUser, credential);

      // Alterar senha
      await updatePassword(currentUser, newPwd);

      setPwdModal(false);
      setCurrPwd("");
      setNewPwd("");
      setNewPwd2("");
      Alert.alert("Sucesso!", "Senha alterada com sucesso.");
    } catch (e: any) {
      console.log("change pwd error:", e);
      
      let message = "Não foi possível alterar a senha.";
      if (e.code === "auth/wrong-password") {
        message = "Senha atual incorreta.";
      } else if (e.code === "auth/weak-password") {
        message = "A nova senha é muito fraca.";
      } else if (e.code === "auth/requires-recent-login") {
        message = "Por segurança, faça logout e login novamente antes de alterar a senha.";
      }
      
      Alert.alert("Erro", message);
    } finally {
      setChangingPwd(false);
    }
  }

  // =====================
  // SELEÇÃO DE MODELO
  // =====================
  function handleSelectModel(model: string) {
    if (model === "Outro") {
      setModelModal(false);
      setCustomModelText("");
      setTimeout(() => setCustomModelModal(true), 200);
    } else {
      setCarModel(model);
      setModelModal(false);
    }
  }

  function handleConfirmCustomModel() {
    const trimmed = customModelText.trim();
    if (trimmed) {
      setCarModel(trimmed);
    }
    setCustomModelModal(false);
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
        <Text style={styles.headerTitle}>Perfil</Text>
        <View style={styles.headerIconRight}>
          <Image
            source={require("../assets/logo-Jota.png")}
            style={styles.headerLogo}
            resizeMode="contain"
          />
        </View>
      </View>
    );
  }

  function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {children}
      </View>
    );
  }

  // =====================
  // RENDER - LOADING
  // =====================
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <Header />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={GREEN} />
          <Text style={styles.loadingText}>Carregando perfil...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // =====================
  // RENDER - FORMULÁRIO
  // =====================
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Header />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.pageTitle}>Editar Perfil</Text>

          {/* Painel de dados */}
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelHeaderText}>Dados do Usuário</Text>
            </View>

            {/* Email (apenas exibição) */}
            <Field label="Email">
              <View style={[styles.input, styles.inputDisabled]}>
                <Text style={styles.inputDisabledText}>{email}</Text>
              </View>
              <Text style={styles.hint}>O email não pode ser alterado.</Text>
            </Field>

            {/* Nome Completo */}
            <Field label="Nome Completo *">
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="Seu nome completo"
                style={styles.input}
              />
            </Field>

            {/* Senha */}
            <Field label="Senha">
              <View style={styles.passwordRow}>
                <Text style={styles.passwordMask}>••••••••</Text>
                <TouchableOpacity
                  onPress={() => setPwdModal(true)}
                  activeOpacity={0.9}
                  style={styles.changePasswordBtn}
                >
                  <Text style={styles.changePasswordBtnText}>Alterar</Text>
                </TouchableOpacity>
              </View>
            </Field>

            {/* Data de Nascimento */}
            <Field label="Data de Nascimento">
              <TextInput
                value={dob}
                onChangeText={handleDobChange}
                placeholder="DD/MM/AAAA"
                keyboardType="numeric"
                maxLength={10}
                style={styles.input}
              />
            </Field>

            {/* Telefone */}
            <Field label="Telefone">
              <TextInput
                value={phone}
                onChangeText={handlePhoneChange}
                placeholder="(11) 96407-0127"
                keyboardType="phone-pad"
                maxLength={15}
                style={styles.input}
              />
            </Field>

            {/* Possui Veículo */}
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Possui Veículo?</Text>
              <Switch
                value={hasVehicle}
                onValueChange={setHasVehicle}
                thumbColor="#fff"
                trackColor={{ true: GREEN, false: "#bbb" }}
              />
            </View>

            {/* Modelo do Veículo */}
            {hasVehicle && (
              <Field label="Modelo do Veículo *">
                <TouchableOpacity
                  onPress={() => setModelModal(true)}
                  activeOpacity={0.7}
                  style={styles.selectInput}
                >
                  <Text style={carModel ? styles.selectText : styles.selectPlaceholder}>
                    {carModel || "Selecione o modelo"}
                  </Text>
                  <Feather name="chevron-down" size={20} color="#666" />
                </TouchableOpacity>
              </Field>
            )}

            {/* CTA Clube Jota */}
            <View style={styles.clubeCtaContainer}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => navigation.navigate("Clube Jota")}
                style={styles.clubeCtaBtn}
              >
                <Text style={styles.clubeCtaBtnText}>Quero fazer parte do Clube!</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Botão Salvar */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.9}
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Salvar alterações</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal Selecionar Modelo */}
      <Modal
        transparent
        visible={modelModal}
        animationType="fade"
        onRequestClose={() => setModelModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Escolha o modelo</Text>
            <FlatList
              data={CAR_MODELS}
              keyExtractor={(item) => item}
              style={styles.modelList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => handleSelectModel(item)}
                  style={[
                    styles.modelItem,
                    item === carModel && styles.modelItemSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.modelItemText,
                      item === carModel && styles.modelItemTextSelected,
                    ]}
                  >
                    {item}
                  </Text>
                  {item === carModel && (
                    <Feather name="check" size={20} color={GREEN} />
                  )}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
            <TouchableOpacity
              onPress={() => setModelModal(false)}
              style={styles.modalCloseBtn}
            >
              <Text style={styles.modalCloseBtnText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Modelo Customizado */}
      <Modal
        transparent
        visible={customModelModal}
        animationType="fade"
        onRequestClose={() => setCustomModelModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentSmall}>
            <Text style={styles.modalTitle}>Informe o modelo</Text>
            <TextInput
              placeholder="Ex.: Ford Bronco"
              value={customModelText}
              onChangeText={setCustomModelText}
              autoFocus
              style={styles.input}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setCustomModelModal(false)}
                style={styles.btnSecondary}
              >
                <Text style={styles.btnSecondaryText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmCustomModel}
                style={styles.btnPrimary}
              >
                <Text style={styles.btnPrimaryText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Alterar Senha */}
      <Modal
        transparent
        visible={pwdModal}
        animationType="slide"
        onRequestClose={() => setPwdModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentSmall}>
            <Text style={styles.modalTitle}>Alterar Senha</Text>

            <TextInput
              placeholder="Senha atual"
              secureTextEntry
              value={currPwd}
              onChangeText={setCurrPwd}
              style={styles.input}
            />
            <TextInput
              placeholder="Nova senha (mín. 6 caracteres)"
              secureTextEntry
              value={newPwd}
              onChangeText={setNewPwd}
              style={styles.input}
            />
            <TextInput
              placeholder="Confirmar nova senha"
              secureTextEntry
              value={newPwd2}
              onChangeText={setNewPwd2}
              style={styles.input}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => {
                  setPwdModal(false);
                  setCurrPwd("");
                  setNewPwd("");
                  setNewPwd2("");
                }}
                style={styles.btnSecondary}
                disabled={changingPwd}
              >
                <Text style={styles.btnSecondaryText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={doChangePassword}
                style={[styles.btnPrimary, changingPwd && styles.btnDisabled]}
                disabled={changingPwd}
              >
                {changingPwd ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.btnPrimaryText}>Salvar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
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

  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 12, color: "#666", fontSize: 14 },

  scrollContent: { padding: 16, paddingBottom: 32 },

  pageTitle: {
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    color: TITLE,
    marginBottom: 16,
  },

  panel: {
    backgroundColor: PANEL,
    borderRadius: 16,
    padding: 12,
  },

  panelHeader: {
    backgroundColor: GREEN,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  panelHeaderText: { color: "#fff", fontWeight: "800", fontSize: 15 },

  field: { marginBottom: 12 },
  fieldLabel: { fontWeight: "700", marginBottom: 6, color: "#333" },

  input: {
    borderWidth: 1,
    borderColor: "#d9d9d9",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 46,
    backgroundColor: "#fff",
    justifyContent: "center",
  },

  inputDisabled: {
    backgroundColor: "#f0f0f0",
  },
  inputDisabledText: { color: "#666" },

  hint: { fontSize: 11, color: "#888", marginTop: 4 },

  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  passwordMask: { flex: 1, paddingVertical: 12, color: "#444", fontSize: 16 },
  changePasswordBtn: {
    backgroundColor: GREEN,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  changePasswordBtnText: { color: "#fff", fontWeight: "700" },

  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingVertical: 8,
  },
  switchLabel: { fontWeight: "700", color: "#333" },

  selectInput: {
    borderWidth: 1,
    borderColor: "#d9d9d9",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 46,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectText: { color: "#111", fontSize: 15 },
  selectPlaceholder: { color: "#999", fontSize: 15 },

  clubeCtaContainer: { alignItems: "center", marginTop: 16 },
  clubeCtaBtn: {
    backgroundColor: GREEN,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  clubeCtaBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },

  saveBtn: {
    backgroundColor: GREEN,
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },

  // Modais
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    maxHeight: "75%",
  },
  modalContentSmall: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12 },

  modelList: { maxHeight: 350 },
  modelItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  modelItemSelected: { backgroundColor: "#E8F5E9" },
  modelItemText: { fontSize: 16, color: "#333" },
  modelItemTextSelected: { color: GREEN, fontWeight: "600" },

  separator: { height: 1, backgroundColor: "#eee" },

  modalCloseBtn: { alignItems: "center", paddingVertical: 12, marginTop: 8 },
  modalCloseBtnText: { fontWeight: "700", color: "#666" },

  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 16,
  },

  btnPrimary: {
    backgroundColor: GREEN,
    paddingHorizontal: 20,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimaryText: { color: "#fff", fontWeight: "700" },

  btnSecondary: {
    backgroundColor: "#eee",
    paddingHorizontal: 20,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  btnSecondaryText: { fontWeight: "700", color: "#333" },

  btnDisabled: { opacity: 0.6 },
});