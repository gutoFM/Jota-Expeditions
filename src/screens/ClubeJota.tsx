import React, { useEffect, useState, useRef } from "react";
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
  Linking,
  Alert,
  Modal,
  Animated,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../contexts/AuthContext";
import type { DrawerScreenProps } from "@react-navigation/drawer";
import type { DrawerParamList } from "../navigation/AppDrawer";

// Firebase imports
import { db } from "../lib/firebase";
import {
  doc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";

// =====================
// TIPOS
// =====================
type ClubeData = {
  isMember: boolean;
  tier: "bronze" | "prata" | "ouro";
  balance: number;
  totalCredits: number;
  totalDebits: number;
  expeditionsCount: number;
  memberSince: Date | null;
  lastCreditDate: Date | null;
};

type Transaction = {
  id: string;
  type: "credit" | "debit";
  amount: number;
  description: string;
  createdAt: Date;
};

type Props = DrawerScreenProps<DrawerParamList, "Clube Jota">;

// =====================
// CONSTANTES
// =====================
const GREEN = "#1FA83D";
const GOLD = "#FFD700";
const SILVER = "#C0C0C0";
const BRONZE = "#CD7F32";

const WHATSAPP_NUMBER = "5511964070127";
const WHATSAPP_MESSAGE = "Olá! Estava no aplicativo e quero saber mais sobre o Clube Jota. Poderia me explicar como funciona?";

// Requisitos para cada tier
const TIER_REQUIREMENTS = {
  bronze: { min: 0, max: 2, next: "prata" },
  prata: { min: 3, max: 5, next: "ouro" },
  ouro: { min: 6, max: Infinity, next: null },
};

// Ordem dos tiers para comparação
const TIER_ORDER = { bronze: 1, prata: 2, ouro: 3 };

// =====================
// COMPONENTE PRINCIPAL
// =====================
export default function ClubeJota({ navigation }: Props) {
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const uid = user?.uid;

  const [loading, setLoading] = useState(true);
  const [clubeData, setClubeData] = useState<ClubeData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Estado para modal de parabenização
  const [showCongrats, setShowCongrats] = useState(false);
  const [newTierAchieved, setNewTierAchieved] = useState<string | null>(null);
  const scaleAnim = useRef(new Animated.Value(0)).current;

  // =====================
  // VERIFICAR MUDANÇA DE TIER
  // =====================
  async function checkTierChange(currentTier: string) {
    if (!uid) return;

    const storageKey = `@clube_jota_tier_${uid}`;
    
    try {
      const lastKnownTier = await AsyncStorage.getItem(storageKey);
      
      // Se é a primeira vez, apenas salva o tier atual
      if (!lastKnownTier) {
        await AsyncStorage.setItem(storageKey, currentTier);
        return;
      }

      // Verifica se subiu de tier
      const lastOrder = TIER_ORDER[lastKnownTier as keyof typeof TIER_ORDER] || 0;
      const currentOrder = TIER_ORDER[currentTier as keyof typeof TIER_ORDER] || 0;

      if (currentOrder > lastOrder) {
        // Subiu de tier! Mostrar parabenização
        setNewTierAchieved(currentTier);
        setShowCongrats(true);
        
        // Animação
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 50,
          useNativeDriver: true,
        }).start();
      }

      // Atualiza o tier armazenado
      await AsyncStorage.setItem(storageKey, currentTier);
    } catch (e) {
      console.log("Erro ao verificar tier:", e);
    }
  }

  function closeCongrats() {
    Animated.timing(scaleAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowCongrats(false);
      setNewTierAchieved(null);
    });
  }

  // =====================
  // CARREGAR DADOS DO CLUBE
  // =====================
  useEffect(() => {
    if (!uid) return;

    const profileRef = doc(db, "profiles", uid);
    const unsubProfile = onSnapshot(
      profileRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const clube = data.clube || {};

          const currentTier = clube.tier || "bronze";

          setClubeData({
            isMember: clube.isMember === true,
            tier: currentTier,
            balance: clube.balance || 0,
            totalCredits: clube.totalCredits || 0,
            totalDebits: clube.totalDebits || 0,
            expeditionsCount: clube.expeditionsCount || 0,
            memberSince: clube.memberSince?.toDate?.() || null,
            lastCreditDate: clube.lastCreditDate?.toDate?.() || null,
          });

          // Verificar se houve mudança de tier (apenas se for membro)
          if (clube.isMember === true) {
            checkTierChange(currentTier);
          }
        } else {
          setClubeData({
            isMember: false,
            tier: "bronze",
            balance: 0,
            totalCredits: 0,
            totalDebits: 0,
            expeditionsCount: 0,
            memberSince: null,
            lastCreditDate: null,
          });
        }
        setLoading(false);
      },
      (error) => {
        console.error("Erro ao carregar dados do clube:", error);
        setLoading(false);
      }
    );

    return () => unsubProfile();
  }, [uid]);

  // Carregar transações do usuário
  useEffect(() => {
    if (!uid || !clubeData?.isMember) return;

    // Query principal usando "userId"
    const q = query(
      collection(db, "clube_transactions"),
      where("userId", "==", uid),
      orderBy("createdAt", "desc"),
      limit(20)
    );

    const unsub = onSnapshot(
      q, 
      (snapshot) => {
        const list: Transaction[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            type: data.type,
            amount: data.amount,
            description: data.description,
            createdAt: data.createdAt?.toDate?.() || new Date(),
          });
        });
        setTransactions(list);
      },
      (error) => {
        console.error("Erro ao carregar transações:", error);
        // Se der erro na query principal, tentar query alternativa (campo antigo)
        tryLegacyQuery();
      }
    );

    // Query alternativa para transações antigas que usavam "oderId"
    async function tryLegacyQuery() {
      try {
        const legacyQ = query(
          collection(db, "clube_transactions"),
          where("oderId", "==", uid),
          orderBy("createdAt", "desc"),
          limit(20)
        );
        
        const unsubLegacy = onSnapshot(legacyQ, (snapshot) => {
          const list: Transaction[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            list.push({
              id: docSnap.id,
              type: data.type,
              amount: data.amount,
              description: data.description,
              createdAt: data.createdAt?.toDate?.() || new Date(),
            });
          });
          if (list.length > 0) {
            setTransactions(list);
          }
        });
      } catch (e) {
        console.log("Query legada também falhou:", e);
      }
    }

    return () => unsub();
  }, [uid, clubeData?.isMember]);

  // =====================
  // FUNÇÕES AUXILIARES
  // =====================

  function formatCurrency(value: number): string {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function formatDate(date: Date): string {
    return date.toLocaleDateString("pt-BR");
  }

  function getTierColor(tier: string): string {
    switch (tier) {
      case "ouro":
        return GOLD;
      case "prata":
        return SILVER;
      default:
        return BRONZE;
    }
  }

  function getTierLabel(tier: string): string {
    switch (tier) {
      case "ouro":
        return "Ouro";
      case "prata":
        return "Prata";
      default:
        return "Bronze";
    }
  }

  function getTierEmoji(tier: string): string {
    switch (tier) {
      case "ouro":
        return "🏆";
      case "prata":
        return "🥈";
      default:
        return "🥉";
    }
  }

  function getExpeditionsForNextTier(currentTier: string, count: number): number | null {
    const req = TIER_REQUIREMENTS[currentTier as keyof typeof TIER_REQUIREMENTS];
    if (!req.next) return null;
    const nextReq = TIER_REQUIREMENTS[req.next as keyof typeof TIER_REQUIREMENTS];
    return nextReq.min - count;
  }

  function openWhatsApp() {
    const url = `https://api.whatsapp.com/send?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert("Erro", "Não foi possível abrir o WhatsApp.");
    });
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
        <Text style={styles.headerTitle}>Clube Jota</Text>
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

  // Modal de Parabenização
  function CongratsModal() {
    if (!newTierAchieved) return null;

    const tierColor = getTierColor(newTierAchieved);
    const tierLabel = getTierLabel(newTierAchieved);
    const tierEmoji = getTierEmoji(newTierAchieved);

    return (
      <Modal
        visible={showCongrats}
        transparent
        animationType="fade"
        onRequestClose={closeCongrats}
      >
        <View style={styles.congratsOverlay}>
          <Animated.View 
            style={[
              styles.congratsContent,
              { transform: [{ scale: scaleAnim }] }
            ]}
          >
            {/* Ícone de medalha grande */}
            <View style={[styles.congratsMedalContainer, { backgroundColor: tierColor }]}>
              <MaterialCommunityIcons name="medal" size={64} color="#fff" />
            </View>

            {/* Emoji e texto */}
            <Text style={styles.congratsEmoji}>{tierEmoji}</Text>
            <Text style={styles.congratsTitle}>Parabéns!</Text>
            <Text style={styles.congratsSubtitle}>
              Você subiu para a classificação
            </Text>
            <Text style={[styles.congratsTier, { color: tierColor }]}>
              {tierLabel}
            </Text>
            <Text style={styles.congratsMessage}>
              Continue participando das expedições para alcançar níveis ainda mais altos e ganhar brindes exclusivos!
            </Text>

            {/* Botão fechar */}
            <TouchableOpacity
              style={[styles.congratsButton, { backgroundColor: tierColor }]}
              onPress={closeCongrats}
              activeOpacity={0.8}
            >
              <Text style={styles.congratsButtonText}>Incrível!</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    );
  }

  // Tela para não membros
  function NonMemberView() {
    return (
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <MaterialCommunityIcons name="crown" size={64} color={GOLD} />
          <Text style={styles.heroTitle}>Clube Jota</Text>
          <Text style={styles.heroSubtitle}>
            Faça parte do clube exclusivo de expedicionários!
          </Text>
        </View>

        {/* Benefícios */}
        <View style={styles.benefitsSection}>
          <Text style={styles.sectionTitle}>Benefícios Exclusivos</Text>

          <View style={styles.benefitCard}>
            <View style={styles.benefitIcon}>
              <Feather name="percent" size={24} color={GREEN} />
            </View>
            <View style={styles.benefitContent}>
              <Text style={styles.benefitTitle}>Cashback de 10%</Text>
              <Text style={styles.benefitText}>
                Receba 10% de volta em créditos em todas as suas contribuições mensais.
              </Text>
            </View>
          </View>

          <View style={styles.benefitCard}>
            <View style={styles.benefitIcon}>
              <MaterialCommunityIcons name="medal" size={24} color={GREEN} />
            </View>
            <View style={styles.benefitContent}>
              <Text style={styles.benefitTitle}>Sistema de Classificação</Text>
              <Text style={styles.benefitText}>
                Evolua de Bronze para Prata e Ouro participando das expedições!
              </Text>
            </View>
          </View>

          <View style={styles.benefitCard}>
            <View style={styles.benefitIcon}>
              <Feather name="gift" size={24} color={GREEN} />
            </View>
            <View style={styles.benefitContent}>
              <Text style={styles.benefitTitle}>Brindes Exclusivos</Text>
              <Text style={styles.benefitText}>
                Membros recebem brindes especiais de acordo com sua classificação.
              </Text>
            </View>
          </View>

          <View style={styles.benefitCard}>
            <View style={styles.benefitIcon}>
              <Feather name="credit-card" size={24} color={GREEN} />
            </View>
            <View style={styles.benefitContent}>
              <Text style={styles.benefitTitle}>Créditos para Expedições</Text>
              <Text style={styles.benefitText}>
                Use seus créditos para pagar suas aventuras com o Jota!
              </Text>
            </View>
          </View>
        </View>

        {/* Como Funciona */}
        <View style={styles.howItWorksSection}>
          <Text style={styles.sectionTitle}>Como Funciona</Text>

          <View style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <Text style={styles.stepText}>
              Escolha o valor que deseja contribuir mensalmente
            </Text>
          </View>

          <View style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <Text style={styles.stepText}>
              Receba seu valor + 10% de cashback em créditos
            </Text>
          </View>

          <View style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <Text style={styles.stepText}>
              Use os créditos nas expedições do Jota
            </Text>
          </View>

          <View style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>4</Text>
            </View>
            <Text style={styles.stepText}>
              Suba de classificação e ganhe mais benefícios!
            </Text>
          </View>
        </View>

        {/* CTA */}
        <View style={styles.ctaSection}>
          <Text style={styles.ctaText}>
            Quer fazer parte dessa aventura?
          </Text>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={openWhatsApp}
            activeOpacity={0.8}
          >
            <Feather name="message-circle" size={20} color="#fff" />
            <Text style={styles.ctaButtonText}>Quero fazer parte!</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // Tela para membros
  function MemberView() {
    if (!clubeData) return null;

    const tierColor = getTierColor(clubeData.tier);
    const tierLabel = getTierLabel(clubeData.tier);
    const expeditionsToNext = getExpeditionsForNextTier(
      clubeData.tier,
      clubeData.expeditionsCount
    );

    return (
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Card de Saldo */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceLabel}>Seu Saldo</Text>
            <View style={[styles.tierBadge, { backgroundColor: tierColor }]}>
              <MaterialCommunityIcons name="medal" size={14} color="#fff" />
              <Text style={styles.tierBadgeText}>{tierLabel}</Text>
            </View>
          </View>
          <Text style={styles.balanceValue}>
            {formatCurrency(clubeData.balance)}
          </Text>
          {clubeData.lastCreditDate && (
            <Text style={styles.lastCredit}>
              Último crédito: {formatDate(clubeData.lastCreditDate)}
            </Text>
          )}
        </View>

        {/* Estatísticas */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Feather name="arrow-down-circle" size={24} color={GREEN} />
            <Text style={styles.statValue}>
              {formatCurrency(clubeData.totalCredits)}
            </Text>
            <Text style={styles.statLabel}>Total Recebido</Text>
          </View>
          <View style={styles.statCard}>
            <Feather name="arrow-up-circle" size={24} color="#E74C3C" />
            <Text style={styles.statValue}>
              {formatCurrency(clubeData.totalDebits)}
            </Text>
            <Text style={styles.statLabel}>Total Utilizado</Text>
          </View>
        </View>

        {/* Progresso de Classificação */}
        <View style={styles.progressSection}>
          <Text style={styles.sectionTitle}>Sua Classificação</Text>
          
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <MaterialCommunityIcons
                name="medal"
                size={40}
                color={tierColor}
              />
              <View style={styles.progressInfo}>
                <Text style={styles.progressTier}>{tierLabel}</Text>
                <Text style={styles.progressExpeditions}>
                  {clubeData.expeditionsCount} expedição(ões) com créditos
                </Text>
              </View>
            </View>

            {expeditionsToNext !== null && (
              <View style={styles.nextTierInfo}>
                <Feather name="arrow-up" size={16} color={GREEN} />
                <Text style={styles.nextTierText}>
                  Faltam {expeditionsToNext} expedição(ões) para {getTierLabel(TIER_REQUIREMENTS[clubeData.tier].next!)}
                </Text>
              </View>
            )}

            {clubeData.tier === "ouro" && (
              <View style={styles.maxTierInfo}>
                <MaterialCommunityIcons name="star" size={16} color={GOLD} />
                <Text style={styles.maxTierText}>
                  Você atingiu o nível máximo! Parabéns!
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Extrato */}
        <View style={styles.statementSection}>
          <Text style={styles.sectionTitle}>Extrato</Text>

          {transactions.length === 0 ? (
            <View style={styles.emptyStatement}>
              <Feather name="file-text" size={32} color="#ccc" />
              <Text style={styles.emptyStatementText}>
                Nenhuma movimentação ainda
              </Text>
            </View>
          ) : (
            <View style={styles.statementList}>
              {transactions.map((tx) => (
                <View key={tx.id} style={styles.transactionItem}>
                  <View style={styles.transactionIcon}>
                    <Feather
                      name={tx.type === "credit" ? "arrow-down-circle" : "arrow-up-circle"}
                      size={20}
                      color={tx.type === "credit" ? GREEN : "#E74C3C"}
                    />
                  </View>
                  <View style={styles.transactionInfo}>
                    <Text style={styles.transactionDesc}>{tx.description}</Text>
                    <Text style={styles.transactionDate}>
                      {formatDate(tx.createdAt)}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.transactionAmount,
                      { color: tx.type === "credit" ? GREEN : "#E74C3C" },
                    ]}
                  >
                    {tx.type === "credit" ? "+" : "-"}
                    {formatCurrency(tx.amount)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Membro desde */}
        {clubeData.memberSince && (
          <View style={styles.memberSinceSection}>
            <Feather name="calendar" size={16} color="#666" />
            <Text style={styles.memberSinceText}>
              Membro desde {formatDate(clubeData.memberSince)}
            </Text>
          </View>
        )}
      </ScrollView>
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
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Header />
      
      {/* Botão Admin - sempre visível para admins, no topo */}
      {isAdmin && (
        <TouchableOpacity
          style={styles.adminButtonTop}
          onPress={() => navigation.navigate("ClubeJotaAdmin" as any)}
          activeOpacity={0.8}
        >
          <Feather name="settings" size={18} color="#fff" />
          <Text style={styles.adminButtonTopText}>Gerenciar Clube</Text>
        </TouchableOpacity>
      )}
      
      {clubeData?.isMember ? <MemberView /> : <NonMemberView />}

      {/* Modal de Parabenização */}
      <CongratsModal />
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

  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 12, color: "#666" },

  scrollContent: { padding: 16, paddingBottom: 32 },

  // Hero (não membro)
  heroSection: { alignItems: "center", paddingVertical: 32 },
  heroTitle: { fontSize: 28, fontWeight: "800", color: "#111", marginTop: 12 },
  heroSubtitle: { fontSize: 16, color: "#666", textAlign: "center", marginTop: 8 },

  // Benefícios
  benefitsSection: { marginTop: 24 },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: "#111", marginBottom: 16 },
  benefitCard: {
    flexDirection: "row",
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  benefitIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E8F5E9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  benefitContent: { flex: 1 },
  benefitTitle: { fontSize: 16, fontWeight: "700", color: "#111" },
  benefitText: { fontSize: 14, color: "#666", marginTop: 4 },

  // Como funciona
  howItWorksSection: { marginTop: 32 },
  stepCard: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  stepNumberText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  stepText: { flex: 1, fontSize: 15, color: "#333" },

  // CTA
  ctaSection: { alignItems: "center", marginTop: 32, paddingTop: 24, borderTopWidth: 1, borderTopColor: "#eee" },
  ctaText: { fontSize: 18, fontWeight: "600", color: "#111", marginBottom: 16 },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GREEN,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  ctaButtonText: { color: "#fff", fontSize: 18, fontWeight: "700" },

  // Card de saldo (membro)
  balanceCard: {
    backgroundColor: GREEN,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  balanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  balanceLabel: { color: "rgba(255,255,255,0.8)", fontSize: 14 },
  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  tierBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  balanceValue: { color: "#fff", fontSize: 36, fontWeight: "800" },
  lastCredit: { color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 8 },

  // Estatísticas
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  statCard: {
    flex: 1,
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  statValue: { fontSize: 18, fontWeight: "700", color: "#111", marginTop: 8 },
  statLabel: { fontSize: 12, color: "#666", marginTop: 4 },

  // Progresso
  progressSection: { marginBottom: 24 },
  progressCard: {
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 16,
  },
  progressHeader: { flexDirection: "row", alignItems: "center" },
  progressInfo: { marginLeft: 12 },
  progressTier: { fontSize: 20, fontWeight: "700", color: "#111" },
  progressExpeditions: { fontSize: 14, color: "#666", marginTop: 2 },
  nextTierInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    gap: 8,
  },
  nextTierText: { color: GREEN, fontSize: 14, fontWeight: "600" },
  maxTierInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    gap: 8,
  },
  maxTierText: { color: GOLD, fontSize: 14, fontWeight: "600" },

  // Extrato
  statementSection: { marginBottom: 24 },
  emptyStatement: { alignItems: "center", paddingVertical: 32 },
  emptyStatementText: { color: "#999", marginTop: 8 },
  statementList: {
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    overflow: "hidden",
  },
  transactionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  transactionIcon: { marginRight: 12 },
  transactionInfo: { flex: 1 },
  transactionDesc: { fontSize: 14, fontWeight: "600", color: "#111" },
  transactionDate: { fontSize: 12, color: "#888", marginTop: 2 },
  transactionAmount: { fontSize: 16, fontWeight: "700" },

  // Membro desde
  memberSinceSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  memberSinceText: { color: "#666", fontSize: 14 },

  // Botão admin no topo
  adminButtonTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#333",
    paddingVertical: 10,
    gap: 8,
  },
  adminButtonTopText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  // Modal de Parabenização
  congratsOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  congratsContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
    width: "100%",
    maxWidth: 340,
  },
  congratsMedalContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  congratsEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  congratsTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111",
    marginBottom: 8,
  },
  congratsSubtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  congratsTier: {
    fontSize: 32,
    fontWeight: "800",
    marginTop: 4,
    marginBottom: 16,
  },
  congratsMessage: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  congratsButton: {
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 12,
  },
  congratsButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
});