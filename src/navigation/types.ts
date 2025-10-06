export type RootStackParamList = {
  Login: undefined;
  Home: { role?: 'admin' | 'user' } | undefined;
};