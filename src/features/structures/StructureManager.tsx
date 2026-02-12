import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Structure } from "@/types";
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { path } from "@tauri-apps/api";
import { invoke } from "@tauri-apps/api/core";
import { Plus, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useStructures } from "./StructureContext";

interface SortableStructureItemProps {
  structure: Structure;
  onSelect: (structure: Structure) => void;
  onDelete: (name: string) => void;
  onExit: () => void;
  onRename: (oldName: string, newName: string) => Promise<void>;
  isDragging?: boolean;
  isOver?: boolean;
  overIndex?: number;
  currentIndex: number;
  isActive?: boolean;
  onReveal: (name: string) => void;
  isRenaming?: boolean;
  onStartRename: (name: string) => void;
  onCancelRename: () => void;
}

type StructureItemProps = {
  structure: Structure;
  isActive?: boolean;
  onExit?: () => void;
  isRenaming?: boolean;
  renameValue?: string;
  onRenameChange?: (value: string) => void;
  onRenameSubmit?: () => void;
  onRenameCancel?: () => void;
  inputRef?: React.RefObject<HTMLInputElement>;
};

const StructureItem: React.FC<StructureItemProps> = ({
  structure,
  isActive,
  onExit,
  isRenaming,
  renameValue,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
  inputRef,
}) => {
  useEffect(() => {
    if (isRenaming && inputRef?.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming, inputRef]);

  return (
    <div
      className={cn(
        "group/structure cursor-grab active:cursor-grabbing rounded-md ease-in-out flex items-center justify-between p-2 h-9 transition-all",
        isActive
          ? "bg-blue-50 text-blue-700"
          : "hover:bg-gray-100 hover:text-gray-600"
      )}
    >
      {isRenaming ? (
        <input
          ref={inputRef}
          type="text"
          value={renameValue}
          onChange={(e) => onRenameChange?.(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onRenameSubmit?.();
            } else if (e.key === "Escape") {
              e.preventDefault();
              onRenameCancel?.();
            }
          }}
          onBlur={() => onRenameSubmit?.()}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="font-medium text-sm w-full bg-white/80 backdrop-blur-sm rounded-[3px] px-0.5 -mx-0.5 py-0 border-0 shadow-[0_0_0_2px_rgba(59,130,246,0.5)] focus:outline-none focus:shadow-[0_0_0_2px_rgba(59,130,246,0.8)] selection:bg-blue-200"
        />
      ) : (
        <span className="font-medium text-sm truncate">{structure.name}</span>
      )}
      {isActive && onExit && !isRenaming && (
        <button
          type="button"
          aria-label="Exit structure editing"
          className="text-blue-400 hover:text-blue-700 rounded p-1 transition-all hover:bg-blue-100 flex-shrink-0"
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onExit();
          }}
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
};

const SortableStructureItem: React.FC<SortableStructureItemProps> = ({
  structure,
  onSelect,
  onDelete,
  onExit,
  onRename,
  onReveal,
  isDragging,
  isOver,
  overIndex,
  currentIndex,
  isActive,
  isRenaming,
  onStartRename,
  onCancelRename,
}) => {
  const { attributes, listeners, setNodeRef, transform } = useSortable({
    id: structure.name,
    disabled: isRenaming,
  });

  const [renameValue, setRenameValue] = useState(structure.name);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isSubmittingRef = useRef(false);
  const renameValueRef = useRef(renameValue);

  // Keep ref in sync with state
  useEffect(() => {
    renameValueRef.current = renameValue;
  }, [renameValue]);

  // Reset rename value when entering rename mode
  useEffect(() => {
    if (isRenaming) {
      setRenameValue(structure.name);
      renameValueRef.current = structure.name;
    }
  }, [isRenaming, structure.name]);

  const handleRenameSubmit = async () => {
    if (isSubmittingRef.current) return;
    
    const trimmedName = renameValueRef.current.trim();
    if (!trimmedName || trimmedName === structure.name) {
      onCancelRename();
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      await onRename(structure.name, trimmedName);
    } catch (error) {
      console.error("Failed to rename structure:", error);
      toast.error("Failed to rename structure");
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      onCancelRename();
    }
  };

  // Handle clicks outside the input (including on drag regions)
  useEffect(() => {
    if (!isRenaming) return;

    const handleMouseDown = (e: MouseEvent) => {
      // If clicking outside the input, submit the rename
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        handleRenameSubmit();
      }
    };

    // Use capture phase to catch events before Tauri's drag region handler
    document.addEventListener("mousedown", handleMouseDown, true);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown, true);
    };
  }, [isRenaming, structure.name, onRename, onCancelRename]);

  const style = {
    transform: CSS.Transform.toString(transform),
  };

  const showTopLine =
    isOver && overIndex !== undefined && currentIndex > overIndex;
  const showBottomLine =
    isOver && overIndex !== undefined && currentIndex < overIndex;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`block relative ${isDragging ? "opacity-50 z-10" : ""}`}
    >
      {showTopLine && (
        <div className="absolute -top-[3px] left-0 right-0 h-[2px] bg-blue-500 rounded-full" />
      )}
      {showBottomLine && (
        <div className="absolute -bottom-[3px] left-0 right-0 h-[2px] bg-blue-500 rounded-full" />
      )}
      <ContextMenu>
        <ContextMenuTrigger className="focus:outline-none" disabled={isRenaming}>
          <div
            {...attributes}
            {...(isRenaming ? {} : listeners)}
            onClick={() => !isRenaming && onSelect(structure)}
            onDoubleClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onStartRename(structure.name);
            }}
          >
            <StructureItem
              structure={structure}
              isActive={isActive}
              onExit={isActive ? onExit : undefined}
              isRenaming={isRenaming}
              renameValue={renameValue}
              onRenameChange={setRenameValue}
              onRenameSubmit={handleRenameSubmit}
              onRenameCancel={onCancelRename}
              inputRef={inputRef}
            />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => onStartRename(structure.name)}>
            Rename
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onReveal(structure.name)}>
            Reveal in Finder
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onDelete(structure.name)}>
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </li>
  );
};

const StructureManager: React.FC = () => {
  const {
    structures,
    setStructures,
    deleteStructure,
    reorderStructures,
    isLoading,
    activeStructure,
    exitStructureEditing,
    createNewStructure,
    requestSelectStructure,
    renameStructure,
  } = useStructures();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [overIndex, setOverIndex] = useState<number | undefined>(undefined);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  
  // New structure dialog state
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newStructureName, setNewStructureName] = useState("");
  
  // Rename state
  const [renamingStructure, setRenamingStructure] = useState<string | null>(null);

  const handleStartRename = (name: string) => {
    setRenamingStructure(name);
  };

  const handleCancelRename = () => {
    setRenamingStructure(null);
  };

  const handleRename = async (oldName: string, newName: string) => {
    await renameStructure(oldName, newName);
    // If we renamed the active structure, update the active structure reference
    if (activeStructure?.name === oldName) {
      // The structure list will be reloaded by renameStructure, so the activeStructure
      // will be updated accordingly in the next render
    }
    toast.success("Structure renamed successfully");
  };

  const handleStructureSelect = (structure: Structure) => {
    // Request to select structure - switches immediately
    requestSelectStructure(structure);
  };

  const handleOpenNewDialog = () => {
    setNewStructureName("");
    setShowNewDialog(true);
  };

  const handleCreateWithName = async () => {
    const trimmedName = newStructureName.trim();
    if (!trimmedName || isCreatingNew) return;
    
    setIsCreatingNew(true);
    setShowNewDialog(false);
    try {
      await createNewStructure(false, trimmedName);
    } finally {
      setIsCreatingNew(false);
      setNewStructureName("");
    }
  };

  const handleStructureDelete = async (name: string) => {
    try {
      // If deleting the active structure, exit editing mode first
      if (activeStructure?.name === name) {
        exitStructureEditing();
      }
      await deleteStructure(name);
      toast.success("Structure deleted successfully");
    } catch (error) {
      console.error("Failed to delete structure:", error);
      toast.error("Failed to delete structure");
    }
  };

  // Reveal a specific structure file in Finder
  const handleRevealStructure = async (structureName: string) => {
    try {
      const documentsDir = await path.documentDir();
      const structureFile = await path.join(
        documentsDir,
        "FileArchitect",
        "Templates",
        `${structureName}.txt`
      );
      await invoke("reveal_file_command", { path: structureFile });
    } catch (error) {
      console.error("Failed to reveal structure:", error);
      toast.error("Failed to reveal in Finder");
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    setOverId(null);
    setOverIndex(undefined);

    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = structures.findIndex((s) => s.name === active.id);
      const newIndex = structures.findIndex((s) => s.name === over.id);

      const reorderedStructures = arrayMove(structures, oldIndex, newIndex);

      setStructures(reorderedStructures);
      reorderStructures(reorderedStructures).catch((error) => {
        console.error("Failed to persist structure order:", error);
        toast.error("Failed to save structure order");
        setStructures(structures);
      });
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  return (
    <div data-tauri-drag-region className="relative group">
      <div className="structure-list flex-grow overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={({ over }) => {
              setOverId((over?.id as string) ?? null);
              if (over?.id) {
                setOverIndex(structures.findIndex((s) => s.name === over.id));
              } else {
                setOverIndex(undefined);
              }
            }}
          >
            <SortableContext
              items={structures.map((s) => s.name)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="space-y-1 p-1">
                {structures.map((structure, index) => (
                  <SortableStructureItem
                    key={structure.name}
                    structure={structure}
                    onSelect={handleStructureSelect}
                    onDelete={handleStructureDelete}
                    onExit={exitStructureEditing}
                    onRename={handleRename}
                    onReveal={handleRevealStructure}
                    isDragging={structure.name === activeId}
                    isOver={structure.name === overId}
                    overIndex={overIndex}
                    currentIndex={index}
                    isActive={activeStructure?.name === structure.name}
                    isRenaming={renamingStructure === structure.name}
                    onStartRename={handleStartRename}
                    onCancelRename={handleCancelRename}
                  />
                ))}
              </ul>
            </SortableContext>
            <DragOverlay>
              {activeId ? (
                <div className="bg-white rounded-md shadow-lg">
                  <StructureItem
                    structure={structures.find((s) => s.name === activeId)!}
                    isActive={activeStructure?.name === activeId}
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* New Structure list item */}
      <ul className="p-1">
        <li
          onClick={handleOpenNewDialog}
          className={`rounded-md ease-in-out flex items-center space-x-2 p-2 transition-all ${
            isCreatingNew
              ? "bg-gray-50 text-gray-400 border border-dashed border-gray-300 cursor-default"
              : "hover:bg-gray-100 hover:text-gray-600 text-gray-400 opacity-70 hover:opacity-100 cursor-pointer"
          }`}
        >
          {!isCreatingNew && <Plus className="h-4 w-4 text-gray-400 mr-1" />}
          <span className="font-medium text-sm">
            {isCreatingNew ? "Creating Structure..." : "New Structure"}
          </span>
        </li>
      </ul>

      {/* New Structure Name Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Structure</DialogTitle>
            <DialogDescription>
              Enter a name for your new structure.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Structure name"
              value={newStructureName}
              onChange={(e) => setNewStructureName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newStructureName.trim()) {
                  handleCreateWithName();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNewDialog(false)}
              disabled={isCreatingNew}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateWithName}
              disabled={!newStructureName.trim() || isCreatingNew}
            >
              {isCreatingNew ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StructureManager;
