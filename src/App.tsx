import { Toaster } from "@/components/ui/sonner";
import { BrowserRouter } from "react-router-dom";

// Components
import StructureSidebar from "@/components/layout/StructureSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { UpdateDialog } from "@/components/UpdateDialog";
import { WelcomeDialog } from "@/components/WelcomeDialog";

// Context
import { AuthProvider } from "@/features/auth/AuthProvider";
import { StructureProvider } from "@/features/structures/StructureContext";

// Features
import LicenseExpirationModal from "@/features/auth/LicenseExpirationModal";
import { useAppInitialization } from "@/hooks/useAppInitialization";
import { Router } from "@/lib/router";

// Styles
import "./App.css";

function MainLayout() {
  const {
    showWelcome,
    setShowWelcome,
    showUpdateDialog,
    setShowUpdateDialog,
    updateInfo,
    isUpdating,
    handleUpdate,
    showLicenseModal,
    setShowLicenseModal,
    license,
  } = useAppInitialization();

  return (
    <>
      <div
        style={{
          position: "fixed",
          top: 6,
          right: 8,
          zIndex: 999999,
          background: "#ffeb3b",
          color: "#000",
          fontSize: 10,
          padding: "2px 6px",
          borderRadius: 4,
          fontFamily: "monospace",
        }}
      >
        BUILD-MARKER test33
      </div>
      <WelcomeDialog open={showWelcome} onOpenChange={setShowWelcome} />
      <UpdateDialog
        open={showUpdateDialog}
        onOpenChange={setShowUpdateDialog}
        updateInfo={updateInfo}
        onUpdate={handleUpdate}
        isUpdating={isUpdating}
      />
      <LicenseExpirationModal
        open={showLicenseModal}
        onOpenChange={setShowLicenseModal}
        trialEndDate={license?.expires_at || undefined}
      />
      <div className="h-screen w-full flex" data-tauri-drag-region>
        <SidebarProvider>
          <StructureSidebar />
          <main className="flex-1 overflow-y-auto bg-background">
            <Router />
          </main>
        </SidebarProvider>
      </div>
      <Toaster position="bottom-left" />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <StructureProvider>
          <MainLayout />
        </StructureProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
