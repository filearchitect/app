import { StructureEditorPage } from "@/features/structureEditor";
import { lazy, Suspense } from "react";
import { useAuthContext } from "@/features/auth/AuthProvider";
import {
  isAppStoreBuild,
  isSetappBuild,
  shouldUseAppStoreEntitlement,
  shouldUsePlatformEntitlement,
} from "@/features/auth/setapp";
import { Navigate, Route, Routes } from "react-router-dom";

// Lazy load preference pages to reduce initial bundle size
const AccountPreferences = lazy(
  () => import("@/pages/preferences/AccountPreferences")
);
const AIPreferences = lazy(() => import("@/pages/preferences/AIPreferences"));
const GeneralPreferences = lazy(
  () => import("@/pages/preferences/GeneralPreferences")
);
const HelpPreferences = lazy(
  () => import("@/pages/preferences/HelpPreferences")
);
const PreferencesLayout = lazy(
  () => import("@/pages/preferences/PreferencesLayout")
);

// Loading component for lazy-loaded routes
const RouteLoading = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

// This wrapper component includes the future flags configuration
export function Router() {
  const { license } = useAuthContext();
  const platformBuild =
    isSetappBuild() || isAppStoreBuild() || shouldUsePlatformEntitlement(license);
  const appStoreBuild =
    isAppStoreBuild() ||
    license?.source === "appstore" ||
    shouldUseAppStoreEntitlement(license);

  return (
    <Routes>
      <Route path="/" element={<StructureEditorPage />} />
      <Route
        element={
          <Suspense fallback={<RouteLoading />}>
            <PreferencesLayout />
          </Suspense>
        }
      >
        <Route
          path="/preferences/general"
          element={
            <Suspense fallback={<RouteLoading />}>
              <GeneralPreferences />
            </Suspense>
          }
        />
        <Route
          path="/preferences/account"
          element={
            appStoreBuild ? (
              <Navigate to="/preferences/general" replace />
            ) : (
              <Suspense fallback={<RouteLoading />}>
                <AccountPreferences />
              </Suspense>
            )
          }
        />
        <Route
          path="/preferences/ai"
          element={
            platformBuild ? (
              <Navigate
                to={appStoreBuild ? "/preferences/general" : "/preferences/account"}
                replace
              />
            ) : (
              <Suspense fallback={<RouteLoading />}>
                <AIPreferences />
              </Suspense>
            )
          }
        />
        <Route
          path="/preferences/help"
          element={
            <Suspense fallback={<RouteLoading />}>
              <HelpPreferences />
            </Suspense>
          }
        />
      </Route>
    </Routes>
  );
}
