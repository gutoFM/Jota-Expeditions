import "react-native-gesture-handler";
import React from "react";
import Routes from "./src/navigation";
import { AuthProvider } from "./src/contexts/AuthContext";
import { SideMenuProvider } from "./src/contexts/SideMenuContext";

export default function App() {
  return (
    <AuthProvider>
      <SideMenuProvider>
        <Routes />
      </SideMenuProvider>
    </AuthProvider>
  );
}
