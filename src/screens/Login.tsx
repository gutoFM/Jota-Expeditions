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
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";

type Nav = NativeStackNavigationProp<RootStackParamList, "Login">;

// =====================
// CONSTANTES - WHATSAPP
// =====================
const WHATSAPP_NUMBER = "5511964070127";
const WHATSAPP_MESSAGE = "Olá! Estava no aplicativo e surgiu uma dúvida sobre a autenticação. Poderia ajudar?";

export default function Login() {
  const navigation = useNavigation<Nav>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const { signIn } = useAuth();

  async function handleLogin() {
    const u = email.trim();
    const p = password.trim();
    if (!u || !p) {
      Alert.alert("Atenção", "Informe email e senha.");
      return;
    }
    try {
      await signIn(u, p);
    } catch (e: any) {
      Alert.alert("Falha no login", e?.message ?? "Tente novamente");
    }
  }

  function handleWhatsapp() {
    const encodedMessage = encodeURIComponent(WHATSAPP_MESSAGE);
    const url = `https://api.whatsapp.com/send?phone=${WHATSAPP_NUMBER}&text=${encodedMessage}`;
    Linking.openURL(url).catch(() => {
      Alert.alert("Erro", "Não foi possível abrir o WhatsApp.");
    });
  }

  return (
    <View style={styles.container}>
      {/* Header Verde */}
      <View style={styles.header}>
        <Image 
          source={require("../assets/logo-Jota.png")}
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
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        {/* Campo de senha com ícone de olho */}
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Senha"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowPassword(!showPassword)}
            activeOpacity={0.7}
          >
            <Feather 
              name={showPassword ? "eye" : "eye-off"} 
              size={22} 
              color="#666" 
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.button} onPress={handleLogin}>
          <Text style={styles.buttonText}>Entrar</Text>
        </TouchableOpacity>

        <View style={styles.helpContainer}>
          <Text style={styles.helpText}>
            Precisa de ajuda?{"\n"}Nos chame no WhatsApp!
          </Text>

          <TouchableOpacity onPress={handleWhatsapp}>
            <Image 
              source={require("../assets/whatsapp.png")}
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
    backgroundColor: "#28a745",
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
    marginTop: 20,
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
    height: 50,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginBottom: 12,
    paddingHorizontal: 14,
    backgroundColor: "#f9f9f9",
    fontSize: 16,
  },

  // Container do campo de senha com ícone
  passwordContainer: {
    width: "90%",
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: "#f9f9f9",
  },

  passwordInput: {
    flex: 1,
    height: "100%",
    paddingHorizontal: 14,
    fontSize: 16,
  },

  eyeButton: {
    paddingHorizontal: 14,
    height: "100%",
    justifyContent: "center",
  },

  button: {
    width: "90%",
    height: 50,
    backgroundColor: "#28a745",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },

  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 18,
  },

  helpContainer: {
    flex: 1,
    alignItems: "center",
    padding: 20,
    marginTop: 60,
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