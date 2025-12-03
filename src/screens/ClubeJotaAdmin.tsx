import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  FlatList,
  Platform,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
// Usar a API legada do FileSystem (compatível com SDK 54)
import * as FileSystem from "expo-file-system/legacy";
import { useAuth } from "../contexts/AuthContext";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

// Firebase imports
import { db } from "../lib/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  addDoc,
  Timestamp,
  increment,
} from "firebase/firestore";

// =====================
// TIPOS
// =====================
type Member = {
  oderId: string;
  fullName: string;
  email: string;
  clube: {
    isMember: boolean;
    tier: string;
    balance: number;
    totalCredits: number;
    totalDebits: number;
    expeditionsCount: number;
  };
};

// Tipo para preview de importação
type ImportPreviewItem = {
  email: string;
  userName: string;
  oderId: string;
  valorOriginal: number;
  cashback: number;
  valorTotal: number;
  found: boolean;
};

type Props = NativeStackScreenProps<any, "ClubeJotaAdmin">;

// =====================
// CONSTANTES
// =====================
const GREEN = "#1FA83D";
const GOLD = "#FFD700";
const SILVER = "#C0C0C0";
const BRONZE = "#CD7F32";

const CASHBACK_RATE = 0.10; // 10%

// Tier requirements
const TIER_THRESHOLDS = {
  bronze: 0,
  prata: 3,
  ouro: 6,
};

// =====================
// COMPONENTE PRINCIPAL
// =====================
export default function ClubeJotaAdmin({ navigation }: Props) {
  const { user } = useAuth();
  const adminUid = user?.uid;

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Modais
  const [creditModal, setCreditModal] = useState(false);
  const [debitModal, setDebitModal] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [activateModal, setActivateModal] = useState(false);

  // Formulários
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [isExpedition, setIsExpedition] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Ativar membro
  const [searchEmail, setSearchEmail] = useState("");
  const [foundUser, setFoundUser] = useState<any>(null);
  const [searching, setSearching] = useState(false);

  // Importação - NOVOS ESTADOS
  const [importStep, setImportStep] = useState<"select" | "preview" | "processing" | "results">("select");
  const [importPreview, setImportPreview] = useState<ImportPreviewItem[]>([]);
  const [importNotFound, setImportNotFound] = useState<string[]>([]);
  const [importResults, setImportResults] = useState<any>(null);

  // =====================
  // CARREGAR MEMBROS
  // =====================
  async function loadMembers() {
    try {
      const q = query(
        collection(db, "profiles"),
        where("clube.isMember", "==", true)
      );
      const snapshot = await getDocs(q);
      
      const list: Member[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          oderId: docSnap.id,
          fullName: data.fullName || "Sem nome",
          email: data.email || "",
          clube: {
            isMember: true,
            tier: data.clube?.tier || "bronze",
            balance: data.clube?.balance || 0,
            totalCredits: data.clube?.totalCredits || 0,
            totalDebits: data.clube?.totalDebits || 0,
            expeditionsCount: data.clube?.expeditionsCount || 0,
          },
        });
      });

      // Ordenar por nome
      list.sort((a, b) => a.fullName.localeCompare(b.fullName));
      setMembers(list);
    } catch (e) {
      console.error("Erro ao carregar membros:", e);
      Alert.alert("Erro", "Não foi possível carregar os membros.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadMembers();
  }, []);

  // =====================
  // FUNÇÕES AUXILIARES
  // =====================

  function formatCurrency(value: number): string {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function getTierColor(tier: string): string {
    switch (tier) {
      case "ouro": return GOLD;
      case "prata": return SILVER;
      default: return BRONZE;
    }
  }

  function calculateTier(expeditionsCount: number): "bronze" | "prata" | "ouro" {
    if (expeditionsCount >= TIER_THRESHOLDS.ouro) return "ouro";
    if (expeditionsCount >= TIER_THRESHOLDS.prata) return "prata";
    return "bronze";
  }

  function parseCurrency(value: string): number {
    // Remove tudo exceto números e vírgula
    const cleaned = value.replace(/[^\d,]/g, "").replace(",", ".");
    return parseFloat(cleaned) || 0;
  }

  // Helper para parsear linha CSV
  function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current);

    return result;
  }

  // =====================
  // LANÇAR CRÉDITO
  // =====================
  function openCreditModal(member: Member) {
    setSelectedMember(member);
    setAmount("");
    setDescription("");
    setCreditModal(true);
  }

  async function handleCredit() {
    if (!selectedMember || !adminUid) return;

    const amountValue = parseCurrency(amount);
    if (amountValue <= 0) {
      Alert.alert("Atenção", "Informe um valor válido.");
      return;
    }

    const desc = description.trim() || `Crédito - ${new Date().toLocaleDateString("pt-BR")}`;

    setProcessing(true);

    try {
      // Calcular cashback
      const cashbackValue = amountValue * CASHBACK_RATE;
      const totalCredit = amountValue + cashbackValue;

      // Atualizar saldo do membro
      const memberRef = doc(db, "profiles", selectedMember.oderId);
      await updateDoc(memberRef, {
        "clube.balance": increment(totalCredit),
        "clube.totalCredits": increment(totalCredit),
        "clube.lastCreditDate": Timestamp.now(),
      });

      // Registrar transação
      await addDoc(collection(db, "clube_transactions"), {
        oderId: selectedMember.oderId,
        userEmail: selectedMember.email,
        userName: selectedMember.fullName,
        type: "credit",
        amount: totalCredit,
        originalAmount: amountValue,
        cashbackAmount: cashbackValue,
        description: desc,
        createdAt: Timestamp.now(),
        createdBy: adminUid,
        source: "manual",
      });

      setCreditModal(false);
      Alert.alert(
        "Sucesso!",
        `Creditado ${formatCurrency(totalCredit)} para ${selectedMember.fullName}\n(${formatCurrency(amountValue)} + ${formatCurrency(cashbackValue)} de cashback)`
      );
      loadMembers();
    } catch (e: any) {
      console.error("Erro ao creditar:", e);
      Alert.alert("Erro", "Não foi possível lançar o crédito.");
    } finally {
      setProcessing(false);
    }
  }

  // =====================
  // LANÇAR DÉBITO
  // =====================
  function openDebitModal(member: Member) {
    setSelectedMember(member);
    setAmount("");
    setDescription("");
    setIsExpedition(false);
    setDebitModal(true);
  }

  async function handleDebit() {
    if (!selectedMember || !adminUid) return;

    const amountValue = parseCurrency(amount);
    if (amountValue <= 0) {
      Alert.alert("Atenção", "Informe um valor válido.");
      return;
    }

    if (amountValue > selectedMember.clube.balance) {
      Alert.alert("Atenção", "Saldo insuficiente.");
      return;
    }

    const desc = description.trim() || `Débito - ${new Date().toLocaleDateString("pt-BR")}`;

    setProcessing(true);

    try {
      const memberRef = doc(db, "profiles", selectedMember.oderId);
      
      // Preparar updates
      const updates: any = {
        "clube.balance": increment(-amountValue),
        "clube.totalDebits": increment(amountValue),
      };

      // Verificar se houve mudança de tier
      let tierChanged = false;
      let newTierLabel = "";
      const currentTier = selectedMember.clube.tier;

      // Se for expedição, incrementar contador e recalcular tier
      if (isExpedition) {
        const newExpeditionsCount = selectedMember.clube.expeditionsCount + 1;
        const newTier = calculateTier(newExpeditionsCount);
        updates["clube.expeditionsCount"] = increment(1);
        updates["clube.tier"] = newTier;

        // Verificar se subiu de tier
        if (newTier !== currentTier) {
          tierChanged = true;
          newTierLabel = newTier === "ouro" ? "Ouro 🏆" : newTier === "prata" ? "Prata 🥈" : "Bronze 🥉";
        }
      }

      await updateDoc(memberRef, updates);

      // Registrar transação
      await addDoc(collection(db, "clube_transactions"), {
        oderId: selectedMember.oderId,
        userEmail: selectedMember.email,
        userName: selectedMember.fullName,
        type: "debit",
        amount: amountValue,
        description: desc,
        isExpedition,
        createdAt: Timestamp.now(),
        createdBy: adminUid,
        source: "manual",
      });

      setDebitModal(false);
      
      // Mostrar mensagem de sucesso (com parabenização se subiu de tier)
      if (tierChanged) {
        Alert.alert(
          "🎉 Parabéns!",
          `${selectedMember.fullName} subiu para a classificação ${newTierLabel}!\n\nDebitado: ${formatCurrency(amountValue)}`,
          [{ text: "Ótimo!" }]
        );
      } else {
        Alert.alert("Sucesso!", `Debitado ${formatCurrency(amountValue)} de ${selectedMember.fullName}`);
      }
      
      loadMembers();
    } catch (e: any) {
      console.error("Erro ao debitar:", e);
      Alert.alert("Erro", "Não foi possível lançar o débito.");
    } finally {
      setProcessing(false);
    }
  }

  // =====================
  // ATIVAR MEMBRO
  // =====================
  async function searchUser() {
    const email = searchEmail.trim().toLowerCase();
    if (!email) {
      Alert.alert("Atenção", "Informe o email do usuário.");
      return;
    }

    setSearching(true);
    setFoundUser(null);

    try {
      // Buscar usuário pelo email
      const q = query(
        collection(db, "profiles"),
        where("email", "==", email)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        Alert.alert("Não encontrado", "Nenhum usuário encontrado com este email.");
        return;
      }

      const docSnap = snapshot.docs[0];
      const data = docSnap.data();

      setFoundUser({
        oderId: docSnap.id,
        fullName: data.fullName || "Sem nome",
        email: data.email,
        isMember: data.clube?.isMember === true,
      });
    } catch (e) {
      console.error("Erro ao buscar:", e);
      Alert.alert("Erro", "Não foi possível buscar o usuário.");
    } finally {
      setSearching(false);
    }
  }

  async function activateMember() {
    if (!foundUser || !adminUid) return;

    setProcessing(true);

    try {
      const userRef = doc(db, "profiles", foundUser.oderId);
      await updateDoc(userRef, {
        "clube.isMember": true,
        "clube.tier": "bronze",
        "clube.balance": 0,
        "clube.totalCredits": 0,
        "clube.totalDebits": 0,
        "clube.expeditionsCount": 0,
        "clube.memberSince": Timestamp.now(),
      });

      setActivateModal(false);
      setSearchEmail("");
      setFoundUser(null);
      Alert.alert("Sucesso!", `${foundUser.fullName} agora é membro do Clube Jota!`);
      loadMembers();
    } catch (e) {
      console.error("Erro ao ativar:", e);
      Alert.alert("Erro", "Não foi possível ativar o membro.");
    } finally {
      setProcessing(false);
    }
  }

  async function deactivateMember(member: Member) {
    Alert.alert(
      "Desativar Membro",
      `Tem certeza que deseja remover ${member.fullName} do Clube Jota?\n\nO saldo atual será zerado.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Desativar",
          style: "destructive",
          onPress: async () => {
            try {
              const userRef = doc(db, "profiles", member.oderId);
              await updateDoc(userRef, {
                "clube.isMember": false,
                "clube.balance": 0,
              });
              Alert.alert("Sucesso", "Membro desativado.");
              loadMembers();
            } catch (e) {
              Alert.alert("Erro", "Não foi possível desativar.");
            }
          },
        },
      ]
    );
  }

  // =====================
  // IMPORTAR PLANILHA - PASSO 1: SELECIONAR E PRÉ-VISUALIZAR
  // =====================
  async function pickAndPreviewCSV() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/comma-separated-values", "application/vnd.ms-excel"],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      if (!file.uri) return;

      setProcessing(true);
      setImportStep("processing");

      // Ler arquivo
      const content = await FileSystem.readAsStringAsync(file.uri);
      
      // Processar CSV
      const lines = content.split("\n");
      const headers = lines[0].split(",");

      // Encontrar índices das colunas
      const emailIndex = headers.findIndex(h => h.includes("E-mail Cliente"));
      const valorLiquidoIndex = headers.findIndex(h => h.includes("Valor Líquido"));
      const statusIndex = headers.findIndex(h => h.includes("Status"));

      if (emailIndex === -1 || valorLiquidoIndex === -1) {
        Alert.alert("Erro", "Formato de planilha inválido. Verifique se as colunas 'E-mail Cliente' e 'Valor Líquido' existem.");
        setProcessing(false);
        setImportStep("select");
        return;
      }

      const previewList: ImportPreviewItem[] = [];
      const notFoundList: string[] = [];

      // Processar cada linha (pular header)
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Parse CSV (considerando vírgulas dentro de aspas)
        const cols = parseCSVLine(line);
        
        const email = (cols[emailIndex] || "").trim().toLowerCase();
        const valorStr = (cols[valorLiquidoIndex] || "").replace(/"/g, "").replace(".", "").replace(",", ".");
        const status = (cols[statusIndex] || "").trim();

        // Só processar aprovadas
        if (status && !status.toLowerCase().includes("aprovada")) {
          continue;
        }

        const valor = parseFloat(valorStr);
        if (!email || isNaN(valor) || valor <= 0) {
          continue;
        }

        // Buscar usuário
        const q = query(
          collection(db, "profiles"),
          where("email", "==", email),
          where("clube.isMember", "==", true)
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          notFoundList.push(email);
          continue;
        }

        const userDoc = snapshot.docs[0];
        const userData = userDoc.data();

        // Calcular cashback
        const cashback = valor * CASHBACK_RATE;
        const totalCredit = valor + cashback;

        previewList.push({
          email,
          userName: userData.fullName || "Sem nome",
          oderId: userDoc.id,
          valorOriginal: valor,
          cashback,
          valorTotal: totalCredit,
          found: true,
        });
      }

      setImportPreview(previewList);
      setImportNotFound(notFoundList);
      setImportStep("preview");
    } catch (e) {
      console.error("Erro ao processar CSV:", e);
      Alert.alert("Erro", "Não foi possível processar a planilha.");
      setImportStep("select");
    } finally {
      setProcessing(false);
    }
  }

  // =====================
  // IMPORTAR PLANILHA - PASSO 2: CONFIRMAR E EXECUTAR
  // =====================
  async function confirmImport() {
    if (importPreview.length === 0) {
      Alert.alert("Atenção", "Nenhum crédito para importar.");
      return;
    }

    setProcessing(true);
    setImportStep("processing");

    let creditados = 0;
    let erros = 0;
    let totalCreditado = 0;

    for (const item of importPreview) {
      try {
        // Atualizar saldo
        await updateDoc(doc(db, "profiles", item.oderId), {
          "clube.balance": increment(item.valorTotal),
          "clube.totalCredits": increment(item.valorTotal),
          "clube.lastCreditDate": Timestamp.now(),
        });

        // Registrar transação
        await addDoc(collection(db, "clube_transactions"), {
          oderId: item.oderId,
          userEmail: item.email,
          userName: item.userName,
          type: "credit",
          amount: item.valorTotal,
          originalAmount: item.valorOriginal,
          cashbackAmount: item.cashback,
          description: `Importação PagBank - ${new Date().toLocaleDateString("pt-BR")}`,
          createdAt: Timestamp.now(),
          createdBy: adminUid,
          source: "import",
        });

        creditados++;
        totalCreditado += item.valorTotal;
      } catch (e) {
        console.error("Erro ao creditar:", item.email, e);
        erros++;
      }
    }

    setImportResults({
      processados: importPreview.length,
      creditados,
      erros,
      naoEncontrados: importNotFound,
      totalCreditado,
    });

    setImportStep("results");
    setProcessing(false);
    loadMembers();
  }

  // =====================
  // RESETAR MODAL DE IMPORTAÇÃO
  // =====================
  function resetImportModal() {
    setImportModal(false);
    setImportStep("select");
    setImportPreview([]);
    setImportNotFound([]);
    setImportResults(null);
  }

  // =====================
  // COMPONENTES DE UI
  // =====================

  function Header() {
    return (
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerIconLeft}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gerenciar Clube</Text>
        <View style={styles.headerIconRight} />
      </View>
    );
  }

  function MemberCard({ member }: { member: Member }) {
    return (
      <View style={styles.memberCard}>
        <View style={styles.memberInfo}>
          <View style={styles.memberHeader}>
            <Text style={styles.memberName}>{member.fullName}</Text>
            <View style={[styles.tierBadge, { backgroundColor: getTierColor(member.clube.tier) }]}>
              <Text style={styles.tierBadgeText}>{member.clube.tier.toUpperCase()}</Text>
            </View>
          </View>
          <Text style={styles.memberEmail}>{member.email}</Text>
          <Text style={styles.memberBalance}>
            Saldo: {formatCurrency(member.clube.balance)}
          </Text>
          <Text style={styles.memberExpeditions}>
            {member.clube.expeditionsCount} expedição(ões)
          </Text>
        </View>

        <View style={styles.memberActions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.creditBtn]}
            onPress={() => openCreditModal(member)}
          >
            <Feather name="plus" size={16} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.debitBtn]}
            onPress={() => openDebitModal(member)}
          >
            <Feather name="minus" size={16} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.removeBtn]}
            onPress={() => deactivateMember(member)}
          >
            <Feather name="user-x" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
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
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Header />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Ações principais */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.mainActionBtn}
            onPress={() => setActivateModal(true)}
          >
            <Feather name="user-plus" size={20} color="#fff" />
            <Text style={styles.mainActionText}>Ativar Membro</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.mainActionBtn, { backgroundColor: "#3498DB" }]}
            onPress={() => setImportModal(true)}
          >
            <Feather name="upload" size={20} color="#fff" />
            <Text style={styles.mainActionText}>Importar CSV</Text>
          </TouchableOpacity>
        </View>

        {/* Resumo */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Resumo do Clube</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total de membros:</Text>
            <Text style={styles.summaryValue}>{members.length}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Saldo total:</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(members.reduce((sum, m) => sum + m.clube.balance, 0))}
            </Text>
          </View>
        </View>

        {/* Lista de membros */}
        <Text style={styles.sectionTitle}>Membros ({members.length})</Text>

        {members.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="users" size={48} color="#ccc" />
            <Text style={styles.emptyText}>Nenhum membro ativo</Text>
          </View>
        ) : (
          members.map((member) => (
            <MemberCard key={member.oderId} member={member} />
          ))
        )}
      </ScrollView>

      {/* Modal Crédito */}
      <Modal visible={creditModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Lançar Crédito</Text>
            {selectedMember && (
              <Text style={styles.modalSubtitle}>{selectedMember.fullName}</Text>
            )}

            <Text style={styles.inputLabel}>Valor (será adicionado 10% de cashback)</Text>
            <TextInput
              style={styles.input}
              placeholder="0,00"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />

            <Text style={styles.inputLabel}>Descrição (opcional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex.: Mensalidade Janeiro/2025"
              value={description}
              onChangeText={setDescription}
            />

            {amount && parseCurrency(amount) > 0 && (
              <View style={styles.previewBox}>
                <Text style={styles.previewText}>
                  Valor: {formatCurrency(parseCurrency(amount))}
                </Text>
                <Text style={styles.previewText}>
                  Cashback (10%): {formatCurrency(parseCurrency(amount) * CASHBACK_RATE)}
                </Text>
                <Text style={styles.previewTotal}>
                  Total: {formatCurrency(parseCurrency(amount) * (1 + CASHBACK_RATE))}
                </Text>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setCreditModal(false)}
                disabled={processing}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, processing && styles.btnDisabled]}
                onPress={handleCredit}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmBtnText}>Creditar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Débito */}
      <Modal visible={debitModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Lançar Débito</Text>
            {selectedMember && (
              <>
                <Text style={styles.modalSubtitle}>{selectedMember.fullName}</Text>
                <Text style={styles.modalBalance}>
                  Saldo disponível: {formatCurrency(selectedMember.clube.balance)}
                </Text>
              </>
            )}

            <Text style={styles.inputLabel}>Valor</Text>
            <TextInput
              style={styles.input}
              placeholder="0,00"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />

            <Text style={styles.inputLabel}>Descrição (opcional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex.: Expedição Vale do Codó"
              value={description}
              onChangeText={setDescription}
            />

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setIsExpedition(!isExpedition)}
            >
              <View style={[styles.checkbox, isExpedition && styles.checkboxChecked]}>
                {isExpedition && <Feather name="check" size={14} color="#fff" />}
              </View>
              <Text style={styles.checkboxLabel}>
                É pagamento de expedição (conta para classificação)
              </Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setDebitModal(false)}
                disabled={processing}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: "#E74C3C" }, processing && styles.btnDisabled]}
                onPress={handleDebit}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmBtnText}>Debitar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Ativar Membro */}
      <Modal visible={activateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Ativar Novo Membro</Text>

            <Text style={styles.inputLabel}>Email do usuário</Text>
            <View style={styles.searchRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="email@exemplo.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={searchEmail}
                onChangeText={setSearchEmail}
              />
              <TouchableOpacity
                style={styles.searchBtn}
                onPress={searchUser}
                disabled={searching}
              >
                {searching ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Feather name="search" size={20} color="#fff" />
                )}
              </TouchableOpacity>
            </View>

            {foundUser && (
              <View style={styles.foundUserBox}>
                <Text style={styles.foundUserName}>{foundUser.fullName}</Text>
                <Text style={styles.foundUserEmail}>{foundUser.email}</Text>
                {foundUser.isMember ? (
                  <Text style={styles.alreadyMember}>Já é membro do clube</Text>
                ) : (
                  <TouchableOpacity
                    style={styles.activateBtn}
                    onPress={activateMember}
                    disabled={processing}
                  >
                    {processing ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.activateBtnText}>Ativar como Membro</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}

            <TouchableOpacity
              style={styles.closeModalBtn}
              onPress={() => {
                setActivateModal(false);
                setSearchEmail("");
                setFoundUser(null);
              }}
            >
              <Feather name="x" size={18} color="#666" />
              <Text style={styles.closeModalBtnText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Importar CSV - COM PRÉ-VISUALIZAÇÃO */}
      <Modal visible={importModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "85%" }]}>
            <Text style={styles.modalTitle}>Importar Planilha PagBank</Text>

            {/* PASSO 1: Selecionar arquivo */}
            {importStep === "select" && (
              <>
                <Text style={styles.importInfo}>
                  Selecione o arquivo CSV exportado do PagBank. O sistema irá:
                  {"\n\n"}
                  • Identificar usuários pelo email
                  {"\n"}
                  • Calcular Valor Líquido + 10% de cashback
                  {"\n"}
                  • Mostrar uma pré-visualização antes de confirmar
                </Text>

                <TouchableOpacity
                  style={styles.importBtn}
                  onPress={pickAndPreviewCSV}
                >
                  <Feather name="file-plus" size={24} color="#fff" />
                  <Text style={styles.importBtnText}>Selecionar Arquivo CSV</Text>
                </TouchableOpacity>
              </>
            )}

            {/* PROCESSANDO */}
            {importStep === "processing" && (
              <View style={styles.processingBox}>
                <ActivityIndicator size="large" color={GREEN} />
                <Text style={styles.processingText}>Processando...</Text>
              </View>
            )}

            {/* PASSO 2: Pré-visualização */}
            {importStep === "preview" && (
              <>
                <Text style={styles.previewTitle}>
                  Pré-visualização da Importação
                </Text>

                {importPreview.length === 0 ? (
                  <View style={styles.emptyPreview}>
                    <Feather name="alert-circle" size={32} color="#E74C3C" />
                    <Text style={styles.emptyPreviewText}>
                      Nenhum membro encontrado na planilha.
                    </Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.previewSummary}>
                      <Text style={styles.previewSummaryText}>
                        {importPreview.length} crédito(s) a lançar
                      </Text>
                      <Text style={styles.previewSummaryTotal}>
                        Total: {formatCurrency(importPreview.reduce((sum, i) => sum + i.valorTotal, 0))}
                      </Text>
                    </View>

                    <ScrollView style={styles.previewList} nestedScrollEnabled>
                      {importPreview.map((item, index) => (
                        <View key={index} style={styles.previewItem}>
                          <View style={styles.previewItemInfo}>
                            <Text style={styles.previewItemName}>{item.userName}</Text>
                            <Text style={styles.previewItemEmail}>{item.email}</Text>
                          </View>
                          <View style={styles.previewItemValues}>
                            <Text style={styles.previewItemOriginal}>
                              {formatCurrency(item.valorOriginal)}
                            </Text>
                            <Text style={styles.previewItemCashback}>
                              +{formatCurrency(item.cashback)} (10%)
                            </Text>
                            <Text style={styles.previewItemTotal}>
                              = {formatCurrency(item.valorTotal)}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </ScrollView>
                  </>
                )}

                {importNotFound.length > 0 && (
                  <View style={styles.notFoundBox}>
                    <Text style={styles.notFoundTitle}>
                      ⚠️ Emails não encontrados ({importNotFound.length}):
                    </Text>
                    {importNotFound.slice(0, 3).map((email, i) => (
                      <Text key={i} style={styles.notFoundEmail}>{email}</Text>
                    ))}
                    {importNotFound.length > 3 && (
                      <Text style={styles.notFoundMore}>
                        ...e mais {importNotFound.length - 3}
                      </Text>
                    )}
                  </View>
                )}

                <View style={styles.previewActions}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => setImportStep("select")}
                  >
                    <Text style={styles.cancelBtnText}>Voltar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.confirmBtn, importPreview.length === 0 && styles.btnDisabled]}
                    onPress={confirmImport}
                    disabled={importPreview.length === 0}
                  >
                    <Feather name="check" size={18} color="#fff" />
                    <Text style={styles.confirmBtnText}>Confirmar</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* PASSO 3: Resultados */}
            {importStep === "results" && importResults && (
              <View style={styles.resultsBox}>
                <View style={styles.resultsIcon}>
                  <Feather name="check-circle" size={48} color={GREEN} />
                </View>
                <Text style={styles.resultsTitle}>Importação Concluída!</Text>
                <Text style={styles.resultLine}>
                  Créditos lançados: {importResults.creditados}
                </Text>
                <Text style={styles.resultLine}>
                  Total creditado: {formatCurrency(importResults.totalCreditado)}
                </Text>
                {importResults.erros > 0 && (
                  <Text style={[styles.resultLine, { color: "#E74C3C" }]}>
                    Erros: {importResults.erros}
                  </Text>
                )}
              </View>
            )}

            {/* Botão Fechar (sempre visível exceto durante processamento) */}
            {importStep !== "processing" && importStep !== "preview" && (
              <TouchableOpacity
                style={styles.closeModalBtn}
                onPress={resetImportModal}
              >
                <Feather name="x" size={18} color="#666" />
                <Text style={styles.closeModalBtnText}>Fechar</Text>
              </TouchableOpacity>
            )}
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
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  headerIconLeft: { position: "absolute", left: 16, top: "50%", marginTop: -13 },
  headerIconRight: { width: 26 },

  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },

  scrollContent: { padding: 16, paddingBottom: 32 },

  actionsRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  mainActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GREEN,
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  mainActionText: { color: "#fff", fontWeight: "700" },

  summaryCard: {
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  summaryTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  summaryLabel: { color: "#666" },
  summaryValue: { fontWeight: "700" },

  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12 },

  emptyState: { alignItems: "center", paddingVertical: 48 },
  emptyText: { color: "#999", marginTop: 12 },

  memberCard: {
    flexDirection: "row",
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  memberInfo: { flex: 1 },
  memberHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  memberName: { fontSize: 16, fontWeight: "700" },
  tierBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  tierBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  memberEmail: { color: "#666", fontSize: 13, marginTop: 2 },
  memberBalance: { color: GREEN, fontWeight: "700", marginTop: 4 },
  memberExpeditions: { color: "#888", fontSize: 12, marginTop: 2 },

  memberActions: { justifyContent: "center", gap: 8 },
  actionBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  creditBtn: { backgroundColor: GREEN },
  debitBtn: { backgroundColor: "#E67E22" },
  removeBtn: { backgroundColor: "#E74C3C" },

  // Modais
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 },
  modalContent: { backgroundColor: "#fff", borderRadius: 14, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: "700", marginBottom: 4 },
  modalSubtitle: { fontSize: 16, color: "#666", marginBottom: 16 },
  modalBalance: { color: GREEN, fontWeight: "600", marginBottom: 16 },

  inputLabel: { fontSize: 14, fontWeight: "600", marginBottom: 6, color: "#333" },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 46,
    marginBottom: 12,
    backgroundColor: "#fff",
  },

  previewBox: {
    backgroundColor: "#E8F5E9",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  previewText: { color: "#333", marginBottom: 4 },
  previewTotal: { color: GREEN, fontWeight: "700", fontSize: 16, marginTop: 4 },

  checkboxRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#ddd",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  checkboxChecked: { backgroundColor: GREEN, borderColor: GREEN },
  checkboxLabel: { flex: 1, color: "#333" },

  modalActions: { flexDirection: "row", gap: 12, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#eee",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelBtnText: { fontWeight: "700", color: "#333" },
  confirmBtn: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: GREEN,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  confirmBtnText: { fontWeight: "700", color: "#fff" },
  btnDisabled: { opacity: 0.6 },

  searchRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  searchBtn: {
    width: 46,
    height: 46,
    backgroundColor: GREEN,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  foundUserBox: {
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
    padding: 14,
    marginBottom: 8,
  },
  foundUserName: { fontSize: 16, fontWeight: "700" },
  foundUserEmail: { color: "#666", marginTop: 2 },
  alreadyMember: { color: "#E67E22", fontWeight: "600", marginTop: 8 },
  activateBtn: {
    backgroundColor: GREEN,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 12,
  },
  activateBtnText: { color: "#fff", fontWeight: "700" },

  importInfo: { color: "#666", lineHeight: 22, marginBottom: 20 },
  importBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3498DB",
    paddingVertical: 16,
    borderRadius: 10,
    gap: 10,
  },
  importBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },

  processingBox: { alignItems: "center", paddingVertical: 32 },
  processingText: { color: "#666", marginTop: 12 },

  // Pré-visualização
  previewTitle: { fontSize: 16, fontWeight: "700", color: "#333", marginBottom: 12 },
  previewSummary: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  previewSummaryText: { fontWeight: "600", color: "#333" },
  previewSummaryTotal: { fontWeight: "700", color: GREEN, fontSize: 16 },

  previewList: { maxHeight: 250, marginBottom: 12 },
  previewItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  previewItemInfo: { flex: 1 },
  previewItemName: { fontWeight: "700", color: "#333" },
  previewItemEmail: { fontSize: 12, color: "#888", marginTop: 2 },
  previewItemValues: { alignItems: "flex-end" },
  previewItemOriginal: { fontSize: 14, color: "#666" },
  previewItemCashback: { fontSize: 11, color: GREEN },
  previewItemTotal: { fontSize: 16, fontWeight: "700", color: GREEN },

  previewActions: { flexDirection: "row", gap: 12, marginTop: 8 },

  emptyPreview: { alignItems: "center", paddingVertical: 24 },
  emptyPreviewText: { color: "#E74C3C", marginTop: 8, textAlign: "center" },

  notFoundBox: {
    backgroundColor: "#FFF3E0",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  notFoundTitle: { fontWeight: "600", marginBottom: 6, color: "#E65100" },
  notFoundEmail: { color: "#E74C3C", fontSize: 13 },
  notFoundMore: { color: "#888", fontStyle: "italic", marginTop: 4 },

  // Resultados
  resultsBox: {
    alignItems: "center",
    paddingVertical: 16,
  },
  resultsIcon: { marginBottom: 16 },
  resultsTitle: { fontSize: 20, fontWeight: "700", marginBottom: 16, color: GREEN },
  resultLine: { fontSize: 16, marginBottom: 8, color: "#333" },

  // Botão Fechar Modal
  closeModalBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#ddd",
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 16,
    gap: 8,
  },
  closeModalBtnText: { 
    fontWeight: "700", 
    color: "#666",
    fontSize: 16,
  },
});