import {initializeApp} from "firebase/app";
import {
  getAuth,
  initializeAuth,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";

import {getFirestore} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {Platform} from "react-native";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getReactNativePersistence } = require("firebase/auth");

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);

// Android/iOS: use initializeAuth com AsyncStorage
// Web: use getAuth + browserLocalPersistence
export const auth =
  Platform.OS === "web"
    ? getAuth(app)
    : initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });

if (Platform.OS === "web") {
  // garante persistência no navegador
  setPersistence(auth, browserLocalPersistence).catch(() => {});
}

export const db = getFirestore(app);

/**
 * SE o TypeScript reclamar que 'getReactNativePersistence' não existe:
 * 1) Confira a versão: npx expo install firebase (Expo 54 usa firebase 12.x)
 * 2) Como último recurso, troque a inicialização acima por este fallback:
 *
 * // eslint-disable-next-line @typescript-eslint/no-var-requires
 * const {initializeAuth: initAuth, getReactNativePersistence: getRNP} = require("firebase/auth");
 * export const auth =
 *   Platform.OS === "web"
 *     ? getAuth(app)
 *     : initAuth(app, {persistence: getRNP(AsyncStorage)});
 */
