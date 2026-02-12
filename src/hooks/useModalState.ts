import { useCallback, useState } from "react";

export function useModalState<T extends Record<string, boolean>>(
  initialState: T
) {
  const [modalStates, setModalStates] = useState<T>(initialState);

  const openModal = useCallback((key: keyof T) => {
    setModalStates((prev) => ({ ...prev, [key]: true }));
  }, []);

  const closeModal = useCallback((key: keyof T) => {
    setModalStates((prev) => ({ ...prev, [key]: false }));
  }, []);

  const toggleModal = useCallback((key: keyof T) => {
    setModalStates((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const resetModals = useCallback(() => {
    setModalStates(initialState);
  }, [initialState]);

  return {
    modalStates,
    openModal,
    closeModal,
    toggleModal,
    resetModals,
  };
}
