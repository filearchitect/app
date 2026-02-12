import { GetStructureResult, StructureOperation } from "@filearchitect/core";
import { File, Folder } from "lucide-react";
import React from "react";

const Badge = React.memo<{
  variant: "import" | "copy" | "move" | "warning";
  text?: string;
}>(({ variant, text }) => {
  const styles = {
    import: "bg-blue-100 text-blue-800",
    copy: "bg-green-100 text-green-800",
    move: "bg-purple-100 text-purple-800",
    warning: "bg-yellow-100 text-yellow-800",
  };

  return (
    <span
      className={`px-1.5 py-0.5 text-xs font-medium rounded ${styles[variant]}`}
    >
      {text || variant}
    </span>
  );
});
Badge.displayName = "Badge";

const FolderItem = React.memo<{
  item: StructureOperation;
  showFullPaths: boolean;
}>(({ item, showFullPaths }) => {
  const Icon = item.isDirectory ? Folder : File;

  return (
    <div className={`flex flex-col relative`}>
      {Array.from({ length: item.depth }).map((_, index) => (
        <div
          key={`${index}`}
          className={`absolute top-0 bottom-0 w-px bg-gray-400 ml-1`}
          style={{
            left: `${index * 1.5}rem`,
          }}
        />
      ))}
      <div
        className="flex items-center gap-2 py-0.5"
        style={{
          marginLeft: `${item.depth * 1.5}rem`,
        }}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="text-sm truncate">
          {showFullPaths ? (
            <>
              <span className="text-gray-400">
                {item.targetPath.replace(item.name, "")}
              </span>
              <span
                className={`text-gray-800 ${
                  item.isDirectory ? "font-bold" : ""
                }`}
              >
                {item.name}
              </span>
            </>
          ) : (
            <span className={item.isDirectory ? "font-bold" : ""}>
              {item.name}
            </span>
          )}
        </span>
        {(item.type === "copy" ||
          item.type === "move" ||
          item.type === "included") && (
          <div className="flex items-center gap-1 shrink-0">
            {item.type === "copy" && <Badge variant="copy" />}
            {item.type === "move" && <Badge variant="move" />}
            {item.type === "included" && <Badge variant="copy" />}
          </div>
        )}

        {item.warning && item.warning.length > 0 && (
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs text-gray-500">{item.warning}</span>
          </div>
        )}
      </div>
    </div>
  );
});
FolderItem.displayName = "FolderItem";

export const StructurePreview = React.memo<{
  structure: GetStructureResult;
  showFullPaths?: boolean;
}>(({ structure, showFullPaths = false }) => {
  return (
    <div className="flex flex-col gap-2">
      {structure.operations.map((item: StructureOperation, index: number) => {
        return (
          <FolderItem
            key={`${item.name}-${index}`}
            item={item}
            showFullPaths={showFullPaths}
          />
        );
      })}
    </div>
  );
});
StructurePreview.displayName = "StructurePreview";
