import { handleError } from "@/utils/errorHandling";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { LicenseError, LicenseValidationError } from "./errors";
import { LicenseService } from "./services";
import { StoredLicense } from "./types";

interface AuthContextType {
  license: StoredLicense | null;
  isLoading: boolean;
  error: string | null;
  isLicenseActive: boolean;
  isLicenseExpired: boolean;
  isInitialized: boolean;
  setIsLicenseExpired: (expired: boolean) => void;
  activateLicense: (licenseKey: string) => Promise<StoredLicense | null>;
  validateLicense: () => Promise<void>;
  setLicense: (license: StoredLicense | null) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [license, setLicense] = useState<StoredLicense | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLicenseExpired, setIsLicenseExpired] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const isLicenseActive = useMemo(() => {
    if (!license) {
      return false;
    }
    return LicenseService.isLicenseActive(license);
  }, [license]);

  const validateLicense = useCallback(async () => {
    try {
      const result = await LicenseService.checkLicense();
      setLicense(result);
      setError(null);
      if (result) {
        setIsLicenseExpired(LicenseService.isLicenseExpired(result));
      }
    } catch (err) {
      const errorMessage =
        err instanceof LicenseValidationError
          ? err.message
          : err instanceof LicenseError
          ? `License error: ${err.message}`
          : handleError(err);
      setError(errorMessage);
      setLicense(null);
      setIsLicenseExpired(true);
    } finally {
      setIsLoading(false);
      setIsInitialized(true);
    }
  }, []);

  useEffect(() => {
    validateLicense();
  }, [validateLicense]);

  const activateLicense = useCallback(async (licenseKey: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const newLicense = await LicenseService.validateLicense(licenseKey);
      setLicense(newLicense);
      setIsLicenseExpired(LicenseService.isLicenseExpired(newLicense));
      return newLicense;
    } catch (err) {
      const errorMessage =
        err instanceof LicenseValidationError
          ? err.message
          : err instanceof LicenseError
          ? `License error: ${err.message}`
          : handleError(err);
      setError(errorMessage);
      setIsLicenseExpired(true);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        license,
        isLoading,
        error,
        isLicenseActive,
        isLicenseExpired,
        isInitialized,
        setIsLicenseExpired,
        activateLicense,
        validateLicense,
        setLicense,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}
