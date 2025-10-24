import React, {createContext, useContext, useRef, useState} from "react";
import {Animated, Easing} from "react-native";

type Ctx = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  slideX: Animated.Value; // 0 fechado, 1 aberto
};
const SideMenuContext = createContext<Ctx>({} as any);

export const SideMenuProvider: React.FC<React.PropsWithChildren> = ({children}) => {
  const [isOpen, setOpen] = useState(false);
  const slideX = useRef(new Animated.Value(0)).current;

  const animate = (to: 0|1) =>
    Animated.timing(slideX, {
      toValue: to, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start(() => setOpen(to === 1));

  const open = () => animate(1);
  const close = () => animate(0);
  const toggle = () => animate(isOpen ? 0 : 1);

  return (
    <SideMenuContext.Provider value={{isOpen, open, close, toggle, slideX}}>
      {children}
    </SideMenuContext.Provider>
  );
};

export const useSideMenu = () => useContext(SideMenuContext);
