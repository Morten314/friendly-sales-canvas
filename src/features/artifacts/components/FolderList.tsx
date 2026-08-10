import { ChevronRight, Folder } from "lucide-react";

interface FolderListProps {
  folders: { name: string; count: number }[];
  onOpen: (folder: string) => void;
}

/** Folder rows at the storage root. */
export const FolderList = ({ folders, onOpen }: FolderListProps) => (
  <div className="rounded-lg border">
    {folders.map((folder) => (
      <button
        key={folder.name}
        type="button"
        onClick={() => onOpen(folder.name)}
        className="flex w-full items-center gap-3 border-b px-3 py-2.5 text-left last:border-b-0 hover:bg-muted/50"
      >
        <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-sm">{folder.name}</span>
        <span className="text-xs text-muted-foreground">
          {folder.count} {folder.count === 1 ? "item" : "items"}
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>
    ))}
  </div>
);
