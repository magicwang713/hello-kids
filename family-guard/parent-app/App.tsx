import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Session } from "@supabase/supabase-js";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";

import AuthScreen from "./src/screens/AuthScreen";
import PairScreen from "./src/screens/PairScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import { supabase } from "./src/api/supabase";
import { ChildProfile } from "./src/types";
import { initI18n } from "./src/i18n";
import { CONSENT_KEY } from "./src/utils/storageKeys";

const Stack = createNativeStackNavigator();

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [dashboardRefresh, setDashboardRefresh] = useState(0);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    (async () => {
      await initI18n();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session);
      const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
        setSession(newSession);
      });
      unsubscribe = () => authListener.subscription.unsubscribe();
      await ensureConsent();
      setIsReady(true);
    })();
    return () => {
      unsubscribe?.();
    };
  }, []);

  const ensureConsent = async () => {
    const consent = await SecureStore.getItemAsync(CONSENT_KEY);
    if (!consent) {
      Alert.alert("Family Guard", "Please review and accept the privacy notice in Settings.");
    }
  };

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator>
          {session ? (
            <>
              <Stack.Screen name="Dashboard" options={{ headerShown: false }}>
                {() => (
                  <DashboardScreen
                    session={session}
                    selectedChildId={selectedChildId}
                    onChildChange={setSelectedChildId}
                    onChildrenLoaded={setChildren}
                    refreshKey={dashboardRefresh}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen name="Pair" options={{ title: "Pair" }}>
                {() => (
                  <PairScreen
                    child={children.find((child) => child.id === selectedChildId) ?? children[0]}
                    onRefresh={() => {
                      setDashboardRefresh((prev) => prev + 1);
                    }}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen name="Settings" options={{ title: "Settings" }}>
                {() => <SettingsScreen childId={selectedChildId} />}
              </Stack.Screen>
            </>
          ) : (
            <Stack.Screen name="Auth" options={{ headerShown: false }}>
              {() => <AuthScreen onSignedIn={() => setSelectedChildId(null)} />}
            </Stack.Screen>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
