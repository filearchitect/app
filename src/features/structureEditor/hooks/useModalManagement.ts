import { useModalState } from "@/hooks/useModalState";

export interface ModalState extends Record<string, boolean> {
  showPreview: boolean;
  showAiModal: boolean;
}

export function useModalManagement() {
  const { modalStates, openModal, closeModal, toggleModal } =
    useModalState<ModalState>({
      showPreview: true,
      showAiModal: false,
    });

  const togglePreview = () => toggleModal("showPreview");
  const handleOpenAiModal = () => openModal("showAiModal");
  const handleCloseAiModal = () => closeModal("showAiModal");

  return {
    showPreview: modalStates.showPreview,
    showAiModal: modalStates.showAiModal,
    togglePreview,
    handleOpenAiModal,
    handleCloseAiModal,
  };
}
