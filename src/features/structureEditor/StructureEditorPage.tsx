import React from "react";
import { StructureCreator } from "./components/StructureCreator";
import { StructureEditorProvider } from "./context/StructureEditorContext";

export const StructureEditorPage: React.FC = () => {
  return (
    <StructureEditorProvider>
      <StructureCreator />
    </StructureEditorProvider>
  );
};

export { StructureCreator } from "./components/StructureCreator";
export {
  StructureEditorProvider,
  useStructureEditor,
} from "./context/StructureEditorContext";
