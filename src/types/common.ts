export interface BaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface AsyncOperationOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  loadingMessage?: string;
  successMessage?: string;
  errorMessage?: string;
}

export interface FileOperationResult {
  success: boolean;
  path?: string;
  error?: string;
}

export interface LoadingState {
  isLoading: boolean;
  error: string | null;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

export interface SortState {
  field: string;
  direction: "asc" | "desc";
}

export interface FilterState {
  [key: string]: any;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  error?: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface FormState<T> {
  values: T;
  errors: ValidationError[];
  isSubmitting: boolean;
  isValid: boolean;
}
