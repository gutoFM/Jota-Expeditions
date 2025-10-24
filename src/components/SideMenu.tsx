import React from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions,
} from "react-native";
import {Feather, Ionicons, MaterialCommunityIcons} from "@expo/vector-icons";
import {useNavigation, useNavigationState} from "@react-navigation/native";
import {useSideMenu} from "../contexts/SideMenuContext";

const BG = "#274C34";
const W = Math.min(290, Math.round(Dimensions.get("window").width * 0.8));

const items = [
  {name: "Home", label: "Home", icon: (f:boolean)=><Ionicons name={f?"home":"home-outline"} size={22} color="#fff"/>},
  {name: "Eventos", label: "Eventos", icon: ()=> <MaterialCommunityIcons name="map" size={22} color="#fff"/>},
  {name: "Parceiros", label: "Parceiros", icon: ()=> <MaterialCommunityIcons name="handshake" size={22} color="#fff"/>},
  {name: "Contato", label: "Contato", icon: ()=> <Feather name="phone" size={22} color="#fff"/>},
  {name: "Sobre", label: "Sobre", icon: ()=> <Feather name="info" size={22} color="#fff"/>},
  {name: "Perfil", label: "Perfil", icon: ()=> <Feather name="user" size={22} color="#fff"/>},
  {name: "Clube Jota", label: "Clube Jota", icon: ()=> <MaterialCommunityIcons name="account-group" size={22} color="#fff"/>},
];

export default function SideMenu() {
  const {isOpen, close, slideX} = useSideMenu();
  const navigation = useNavigation<any>();
  const idx = useNavigationState((s)=> s.index);
  const current = useNavigationState((s)=> s.routes[idx]?.name) ?? "Home";

  const translateX = slideX.interpolate({inputRange:[0,1], outputRange:[-W,0]});
  const overlayOpacity = slideX.interpolate({inputRange:[0,1], outputRange:[0,0.45]});

  if (!isOpen && (slideX as any)._value === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* overlay escuro */}
      <Animated.View
        style={[StyleSheet.absoluteFill, {backgroundColor:"#000", opacity: overlayOpacity}]}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={close}/>
      </Animated.View>

      {/* painel */}
      <Animated.View style={[styles.drawer, {transform:[{translateX}]}]}>
        <Text style={styles.menuTitle}>Menu</Text>
        {items.map(it=>{
          const focused = current === it.name;
          return (
            <TouchableOpacity
              key={it.name}
              style={[styles.row, focused && styles.rowActive]}
              onPress={()=>{
                navigation.navigate(it.name);
                close();
              }}
              activeOpacity={0.9}
            >
              <View style={styles.rowIcon}>{it.icon(focused)}</View>
              <Text style={[styles.rowLabel, focused && styles.rowLabelActive]}>
                {it.label}
              </Text>
            </TouchableOpacity>
          );
        })}
        <View style={{flex:1}}/>
        <TouchableOpacity style={styles.row} onPress={()=>{
          navigation.navigate("Login"); // ou chame seu signOut do contexto
          close();
        }}>
          <View style={styles.rowIcon}><Feather name="log-out" size={22} color="#eee"/></View>
          <Text style={styles.rowLabel}>Sair</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  drawer:{position:"absolute", left:0, top:0, bottom:0, width:W, backgroundColor:BG, paddingTop:24},
  menuTitle:{color:"#DDE9E0", fontSize:22, fontWeight:"800", marginLeft:20, marginBottom:14},
  row:{flexDirection:"row", alignItems:"center", paddingVertical:12, paddingHorizontal:18, borderRadius:12, marginHorizontal:10, marginVertical:3},
  rowActive:{backgroundColor:"rgba(255,255,255,0.10)"},
  rowIcon:{width:28, alignItems:"center", marginRight:10},
  rowLabel:{color:"#E7F2EA", fontSize:18, fontWeight:"700"},
  rowLabelActive:{color:"#fff"},
});
