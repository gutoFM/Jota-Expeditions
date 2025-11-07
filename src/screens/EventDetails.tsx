import React from "react";
import { View, Text, StyleSheet, SafeAreaView, StatusBar, TouchableOpacity, Image, ScrollView, Linking, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/index"; // ou use o que estiver usando
import { EventItem } from "./Events";

type Props = NativeStackScreenProps<RootStackParamList, "EventoDetalhe">;

const GREEN = "#1FA83D";

export default function EventDetails({ route, navigation }: Props) {
  const ev = route.params.event as EventItem;

  function openCTA() {
    if (!ev.ctaUrl) return;
    Linking.openURL(ev.ctaUrl).catch(()=> Alert.alert("Erro", "Não foi possível abrir o link."));
  }

  const dateRange = new Intl.DateTimeFormat("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric" });
  const range = `${dateRange.format(new Date(ev.startDate))} - ${dateRange.format(new Date(ev.endDate))}`;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerIconLeft} onPress={()=>navigation.goBack()} activeOpacity={0.7}>
          <Feather name="arrow-left" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Eventos</Text>
        <View style={styles.headerIconRight} />
      </View>

      <ScrollView contentContainerStyle={{ padding:16, paddingBottom:32 }}>
        <Text style={styles.title}>{ev.title}</Text>
        <Text style={styles.dates}>{range}</Text>

        <Image
          source={ ev.imageUrl ? { uri: ev.imageUrl } : require("../assets/logo-Jota.png") }
          style={styles.banner}
          resizeMode="cover"
        />

        <Text style={styles.body}>{ev.description}</Text>

        {ev.ctaUrl ? (
          <TouchableOpacity style={styles.ctaBtn} onPress={openCTA} activeOpacity={0.9}>
            <Text style={styles.ctaText}>{ev.ctaText || "Quero participar"}</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
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

  title:{ fontSize:20, fontWeight:"800", textAlign:"center", color:"#111" },
  dates:{ fontSize:12, fontWeight:"700", textAlign:"center", color:"#111", marginTop:2, marginBottom:10 },
  banner:{ width:"100%", height:160, borderRadius:10, backgroundColor:"#ddd", marginBottom:12 },
  body:{ fontSize:14.5, color:"#333", lineHeight:22, marginBottom:16 },
  ctaBtn:{ backgroundColor:GREEN, borderRadius:10, paddingVertical:12, alignItems:"center" },
  ctaText:{ color:"#fff", fontWeight:"800", fontSize:16 },
});
