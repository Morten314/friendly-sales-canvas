import type React from "react";
import { useState, useRef, useEffect } from "react";

import type { DataSource, DataSourceType } from "../../types";

export interface DataSourceFormApi {
  // State values
  isAddingInline: boolean;
  selectedType: DataSourceType | "";
  sourceName: string;
  sourceUrl: string;
  selectedFile: File | null;
  existingFileName: string | null;
  selectedTags: string[];
  customTag: string;
  sourceDescription: string;
  editingId: string | null;
  canSave: boolean;

  // Refs
  fileInputRef: React.RefObject<HTMLInputElement>;
  formCardRef: React.RefObject<HTMLDivElement>;

  // Setters (consumed by handleSaveSource and AddDataSourceMenu callbacks)
  setIsAddingInline: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedType: React.Dispatch<React.SetStateAction<DataSourceType | "">>;
  setSourceName: React.Dispatch<React.SetStateAction<string>>;
  setSourceUrl: React.Dispatch<React.SetStateAction<string>>;
  setSelectedFile: React.Dispatch<React.SetStateAction<File | null>>;
  setExistingFileName: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedTags: React.Dispatch<React.SetStateAction<string[]>>;
  setCustomTag: React.Dispatch<React.SetStateAction<string>>;
  setSourceDescription: React.Dispatch<React.SetStateAction<string>>;
  setEditingId: React.Dispatch<React.SetStateAction<string | null>>;

  // Handlers
  resetInlineForm: () => void;
  handleStartAdd: () => void;
  handleCancelInline: () => void;
  handleTypeSelect: (type: DataSourceType) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleTagToggle: (tag: string) => void;
  handleAddCustomTag: () => void;
  handleCustomTagKeyDown: (e: React.KeyboardEvent) => void;
  handleEditSource: (source: DataSource) => void;
}

/**
 * Owns all inline add/edit form state for DataSourcesManager.
 * Extracted from DataSourcesManager (Phase 13b, Seam 5).
 *
 * @param dataSources - The current data sources array (needed for the scroll-to-edit effect).
 */
export function useDataSourceForm(dataSources: DataSource[]): DataSourceFormApi {
  // Form state
  const [isAddingInline, setIsAddingInline] = useState(false);
  const [selectedType, setSelectedType] = useState<DataSourceType | "">("");
  const [sourceName, setSourceName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [existingFileName, setExistingFileName] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  const [sourceDescription, setSourceDescription] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const formCardRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to form when editing URL source
  useEffect(() => {
    if (isAddingInline && editingId && formCardRef.current) {
      const source = dataSources.find((s) => s.id === editingId);
      if (source && source.type === "url") {
        // Use setTimeout to ensure DOM has updated
        setTimeout(() => {
          formCardRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 100);
      }
    }
  }, [isAddingInline, editingId, dataSources]);

  const resetInlineForm = () => {
    setIsAddingInline(false);
    setSelectedType("");
    setSourceName("");
    setSourceUrl("");
    setSelectedFile(null);
    setExistingFileName(null);
    setSelectedTags([]);
    setCustomTag("");
    setSourceDescription("");
    setEditingId(null);
  };

  const handleStartAdd = () => {
    resetInlineForm();
    setIsAddingInline(true);
  };

  const handleCancelInline = () => {
    resetInlineForm();
  };

  const handleTypeSelect = (type: DataSourceType) => {
    setSelectedType(type);
    // Clear URL/file when switching types
    if (type === "url") {
      setSelectedFile(null);
      setExistingFileName(null);
    } else if (type === "file") {
      setSourceUrl("");
    } else if (type === "system") {
      setSelectedFile(null);
      setExistingFileName(null);
      setSourceUrl("");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setExistingFileName(null); // Clear existing filename when new file is selected
    }
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleAddCustomTag = () => {
    if (customTag.trim() && !selectedTags.includes(customTag.trim())) {
      setSelectedTags((prev) => [...prev, customTag.trim()]);
      setCustomTag("");
    }
  };

  const handleCustomTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddCustomTag();
    }
  };

  const handleEditSource = (source: DataSource) => {
    setEditingId(source.id);
    setSelectedType(source.type);
    setSourceName(source.name);
    setSourceUrl(source.url || "");
    setSourceDescription(source.description || "");
    setSelectedTags(source.tags);
    if (source.type === "file") {
      setExistingFileName(source.fileName || null);
      setSelectedFile(null); // Clear selected file so existing filename shows
    } else {
      setExistingFileName(null);
    }
    setIsAddingInline(true);
  };

  const canSave = Boolean(
    selectedType &&
    sourceName.trim() &&
    (selectedType === "system"
      ? true // System type only needs a name
      : selectedType === "url"
        ? editingId
          ? true
          : sourceUrl.trim() // When editing URL, URL is optional; when adding new, URL is required
        : editingId
          ? true // When editing, file is optional - can update metadata without new file
          : selectedFile), // When adding new, file is required
  );

  return {
    // State values
    isAddingInline,
    selectedType,
    sourceName,
    sourceUrl,
    selectedFile,
    existingFileName,
    selectedTags,
    customTag,
    sourceDescription,
    editingId,
    canSave,

    // Refs
    fileInputRef,
    formCardRef,

    // Setters
    setIsAddingInline,
    setSelectedType,
    setSourceName,
    setSourceUrl,
    setSelectedFile,
    setExistingFileName,
    setSelectedTags,
    setCustomTag,
    setSourceDescription,
    setEditingId,

    // Handlers
    resetInlineForm,
    handleStartAdd,
    handleCancelInline,
    handleTypeSelect,
    handleFileChange,
    handleTagToggle,
    handleAddCustomTag,
    handleCustomTagKeyDown,
    handleEditSource,
  };
}
