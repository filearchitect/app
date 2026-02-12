import { toast } from "sonner";

export const handleAsyncError = async <T>(
  operation: () => Promise<T>,
  errorMessage: string,
  fallback?: T
): Promise<T | undefined> => {
  try {
    return await operation();
  } catch (error) {
    console.error(`${errorMessage}:`, error);
    toast.error(errorMessage);
    return fallback;
  }
};

export const handleError = (err: unknown): string => {
  if (err instanceof Error) {
    return err.message;
  }
  return "An unexpected error occurred";
};

export const createErrorBoundary = (errorMessage: string) => {
  return (error: unknown) => {
    console.error(`${errorMessage}:`, error);
    toast.error(errorMessage);
  };
};
