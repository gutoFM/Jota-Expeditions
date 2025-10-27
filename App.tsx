import "react-native-gesture-handler";
import React from "react";
import Routes from "./src/navigation";
import { AuthProvider } from "./src/contexts/AuthContext";

export default function App() {
  return (
    <AuthProvider>
      <Routes />
    </AuthProvider>
  );
}
