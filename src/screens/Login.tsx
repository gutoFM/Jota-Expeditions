import React, { useState } from "react";
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet,
  Linking,
  Alert,
  Image 
} from "react-native";
import {useAuth} from "../contexts/AuthContext";

type Nav = NativeStackNavigationProp<RootStackParamList, "Login">;

export default function Login() {
  const navigation = useNavigation<Nav>();
  const [email, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const {signIn} = useAuth();

async function handleLogin() {
  const u = email.trim(); // ou username, conforme seu campo
  const p = password.trim();
    if (!u || !p) {
      Alert.alert("Informe email e senha");
      return;
    }
    try {
      await signIn(u, p);
      // ✅ NÃO navegue manualmente. O Routes vai renderizar Home ao detectar usuário logado.
    } catch (e: any) {
      Alert.alert("Falha no login", e?.message ?? "Tente novamente");
    }
  }

  function handleWhatsapp() {
    // Abre conversa com o WhatsApp do Jota
    // Troque o número pelo oficial do cliente
    const phoneNumber = "5511964070127";
    const url = `https://wa.me/${phoneNumber}`;
    Linking.openURL(url);
  }

  return (
    <View style={styles.container}>
      {/* Header Verde */}
      <View style={styles.header}>
        <Image 
          source={require("../assets/logo-Jota.png")} // Coloque o logo do Jota aqui
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* Área de Login */}
        <View style={styles.content}>
            <Text style={styles.title}>Sua aventura está próxima,</Text>
            <Text style={styles.subtitle}>Faça login em sua conta!</Text>

            <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setUsername}
            />

            <TextInput
            style={styles.input}
            placeholder="Senha"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            />

            <TouchableOpacity style={styles.button} onPress={handleLogin}>
            <Text style={styles.buttonText}>Entrar</Text>
            </TouchableOpacity>

            {/* Loader (pode usar ActivityIndicator) */}
            {/* <ActivityIndicator size="large" color="#00ff00" /> */}

            <View style={styles.helpContainer}>
                <Text style={styles.helpText}>
                Precisa de ajuda?{"\n"}Nos chame no WhatsApp!
                </Text>

                <TouchableOpacity onPress={handleWhatsapp}>
                <Image 
                    source={require("../assets/whatsapp.png")} // Ícone do WhatsApp
                    style={styles.whatsappIcon}
                />
                </TouchableOpacity>
            </View>
                
        </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },

  header: {
    height: 200,
    backgroundColor: "#28a745", // Verde
    alignItems: "center",
    justifyContent: "center",
  },

  logo: {
    width: 185,
    height: 159,
  },

  content: {
    flex: 1,
    alignItems: "center",
    padding: 20,
    marginTop: 20, // Para "subir" a logo acima do conteúdo
  },

  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 4,
    textAlign: "center",
  },

  subtitle: {
    fontSize: 16,
    color: "#444",
    marginBottom: 20,
    textAlign: "center",
  },

  input: {
    width: "90%",
    height: 45,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    marginBottom: 12,
    paddingHorizontal: 10,
    backgroundColor: "#f9f9f9",
  },

  button: {
    width: "90%",
    height: 45,
    backgroundColor: "#999",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },

  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },

  helpContainer: {
    flex: 1,
    alignItems: "center",
    padding: 20,
    marginTop: 80,
  },

  helpText: {
    fontSize: 14,
    textAlign: "center",
    color: "#333",
    marginBottom: 10,
  },

  whatsappIcon: {
    width: 40,
    height: 40,
  },
});
