import { useState, useRef, useCallback } from "react";
import {
  FolderIcon,
  FileIcon,
  FileTextIcon,
  FileImageIcon,
  FileZipIcon,
  FileCodeIcon,
  ArrowLeftIcon,
  DownloadSimpleIcon,
  UploadSimpleIcon,
  TrashIcon,
  CopyIcon,
  HouseIcon,
  SpinnerGapIcon,
  WarningCircleIcon,
  MagnifyingGlassIcon,
  CaretRightIcon,
  DotsThreeIcon,
  XIcon,
  CheckIcon,
  PencilSimpleIcon,
  FolderOpenIcon,
  HardDriveIcon,
} from "@phosphor-icons/react";
import {
  fileList,
  fileDownload,
  fileUpload,
  fileDelete,
  fileMove,
  fileCopy,
  type FileEntry,
} from "../api";

/* ───── Helpers ───── */

function formatSize(bytes: number): string {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("tr-TR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function getFileIcon(name: string, isDir: boolean) {
  if (isDir) return <FolderIcon size={18} weight="fill" />;
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg", "png", "gif", "svg", "webp", "bmp", "ico"].includes(ext))
    return <FileImageIcon size={18} weight="fill" />;
  if (["zip", "tar", "gz", "bz2", "xz", "7z", "rar", "deb", "rpm"].includes(ext))
    return <FileZipIcon size={18} weight="fill" />;
  if (["js", "ts", "tsx", "py", "sh", "bash", "c", "cpp", "h", "rs", "go", "java", "rb", "php", "html", "css", "json", "xml", "yaml", "yml", "toml", "sql", "md"].includes(ext))
    return <FileCodeIcon size={18} weight="fill" />;
  if (["txt", "log", "cfg", "conf", "ini", "env"].includes(ext))
    return <FileTextIcon size={18} weight="fill" />;
  return <FileIcon size={18} weight="fill" />;
}

function getParentPath(currentPath: string): string {
  // Handle both / and \ paths
  const normalized = currentPath.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length <= 1) {
    // Root: on Windows keep drive letter, on Unix return /
    if (/^[a-zA-Z]:/.test(currentPath)) return parts[0] + "\\";
    return "/";
  }
  parts.pop();
  const parent = parts.join("/");
  if (/^[a-zA-Z]:/.test(currentPath)) return parent.replace(/\//g, "\\");
  return "/" + parent;
}

/* ───── Context Menu ───── */

interface ContextMenuProps {
  x: number;
  y: number;
  entry: FileEntry;
  onClose: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onRename: () => void;
  onCopy: () => void;
}

function ContextMenu({ x, y, entry, onClose, onDownload, onDelete, onRename, onCopy }: ContextMenuProps) {
  return (
    <>
      <div className="fm-ctx-overlay" onClick={onClose} />
      <div className="fm-ctx-menu" style={{ top: y, left: x }}>
        {!entry.isDirectory && (
          <button className="fm-ctx-item" onClick={onDownload}>
            <DownloadSimpleIcon size={14} /> İndir
          </button>
        )}
        <button className="fm-ctx-item" onClick={onRename}>
          <PencilSimpleIcon size={14} /> Yeniden Adlandır
        </button>
        <button className="fm-ctx-item" onClick={onCopy}>
          <CopyIcon size={14} /> Kopyala
        </button>
        <div className="fm-ctx-divider" />
        <button className="fm-ctx-item fm-ctx-danger" onClick={onDelete}>
          <TrashIcon size={14} /> Sil
        </button>
      </div>
    </>
  );
}

/* ───── Dialog ───── */

interface InputDialogProps {
  title: string;
  placeholder: string;
  defaultValue?: string;
  onSubmit: (val: string) => void;
  onCancel: () => void;
}

function InputDialog({ title, placeholder, defaultValue, onSubmit, onCancel }: InputDialogProps) {
  const [val, setVal] = useState(defaultValue || "");
  return (
    <div className="fm-dialog-overlay" onClick={onCancel}>
      <div className="fm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="fm-dialog-title">{title}</div>
        <form onSubmit={(e) => { e.preventDefault(); if (val.trim()) onSubmit(val.trim()); }}>
          <input
            className="fm-dialog-input"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder={placeholder}
            autoFocus
          />
          <div className="fm-dialog-actions">
            <button type="button" className="fm-dialog-btn fm-dialog-cancel" onClick={onCancel}>
              İptal
            </button>
            <button type="submit" className="fm-dialog-btn fm-dialog-ok" disabled={!val.trim()}>
              <CheckIcon size={13} weight="bold" /> Tamam
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   FILE MANAGER DRAWER CONTENT
   ═══════════════════════════════════════════════════ */

export default function FileManagerContent({
  agentId,
  isWindows,
  disabled,
}: {
  agentId: string;
  isWindows: boolean;
  disabled: boolean;
}) {
  const [currentPath, setCurrentPath] = useState<string>("");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");

  // Context menu
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; entry: FileEntry } | null>(null);
  // Dialogs
  const [dialog, setDialog] = useState<{ type: "rename" | "copy" | "move" | "goto"; entry?: FileEntry } | null>(null);
  // Clipboard for paste
  const [clipboard, setClipboard] = useState<{ path: string; name: string } | null>(null);
  // Upload
  const uploadRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  // Busy state for actions
  const [actionBusy, setActionBusy] = useState(false);
  // Path input
  const [pathInput, setPathInput] = useState("");
  const [editingPath, setEditingPath] = useState(false);

  const navigate = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    setCtxMenu(null);
    try {
      const result = await fileList(agentId, path);
      setEntries(result.entries);
      setCurrentPath(result.path);
      setPathInput(result.path);
      setInitialized(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  // Auto-navigate on first render — boş string gönder, agent kendi home dizinini döner
  if (!initialized && !loading && !disabled) {
    navigate("");
  }

  const refresh = () => navigate(currentPath);

  const handleDownload = async (entry: FileEntry) => {
    setCtxMenu(null);
    try {
      const result = await fileDownload(agentId, entry.path);
      // Convert base64 → Blob → download
      const byteChars = atob(result.data);
      const bytes = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
      const blob = new Blob([bytes]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      const sep = isWindows ? "\\" : "/";
      const destPath = currentPath.endsWith(sep) ? currentPath + file.name : currentPath + sep + file.name;
      await fileUpload(agentId, destPath, base64);
      await refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (uploadRef.current) uploadRef.current.value = "";
    }
  };

  const handleDelete = async (entry: FileEntry) => {
    setCtxMenu(null);
    if (!confirm(`"${entry.name}" ${entry.isDirectory ? "klasörü" : "dosyası"} silinsin mi?`)) return;
    setActionBusy(true);
    try {
      await fileDelete(agentId, entry.path);
      await refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionBusy(false);
    }
  };

  const handleRename = async (entry: FileEntry, newName: string) => {
    setDialog(null);
    setActionBusy(true);
    try {
      const parent = getParentPath(entry.path);
      const sep = isWindows ? "\\" : "/";
      const dest = parent.endsWith(sep) ? parent + newName : parent + sep + newName;
      await fileMove(agentId, entry.path, dest);
      await refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionBusy(false);
    }
  };

  const handleCopyToClipboard = (entry: FileEntry) => {
    setCtxMenu(null);
    setClipboard({ path: entry.path, name: entry.name });
  };

  const handlePaste = async () => {
    if (!clipboard) return;
    setActionBusy(true);
    try {
      const sep = isWindows ? "\\" : "/";
      const dest = currentPath.endsWith(sep) ? currentPath + clipboard.name : currentPath + sep + clipboard.name;
      await fileCopy(agentId, clipboard.path, dest);
      setClipboard(null);
      await refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionBusy(false);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, entry: FileEntry) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, entry });
  };

  const filtered = entries.filter((e) =>
    !searchFilter || e.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const breadcrumbs = currentPath
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean);

  return (
    <div className="fm-root">
      {/* Hidden upload input */}
      <input
        ref={uploadRef}
        type="file"
        style={{ display: "none" }}
        onChange={handleUpload}
      />

      {/* Toolbar */}
      <div className="fm-toolbar">
        <button
          className="fm-tool-btn"
          onClick={() => navigate(getParentPath(currentPath))}
          disabled={loading || disabled}
          title="Üst dizin"
        >
          <ArrowLeftIcon size={14} weight="bold" />
        </button>
        <button
          className="fm-tool-btn"
          onClick={() => navigate("")}
          disabled={loading || disabled}
          title="Home dizini"
        >
          <HouseIcon size={14} weight="bold" />
        </button>
        <button
          className="fm-tool-btn"
          onClick={() => navigate(isWindows ? "C:\\" : "/")}
          disabled={loading || disabled}
          title="Kök dizin"
        >
          <HardDriveIcon size={14} weight="bold" />
        </button>
        <div className="fm-toolbar-sep" />
        <button
          className="fm-tool-btn fm-tool-upload"
          onClick={() => uploadRef.current?.click()}
          disabled={loading || disabled || uploading}
          title="Dosya Yükle"
        >
          <UploadSimpleIcon size={14} weight="bold" />
          {uploading ? "Yükleniyor..." : "Yükle"}
        </button>
        {clipboard && (
          <button
            className="fm-tool-btn fm-tool-paste"
            onClick={handlePaste}
            disabled={actionBusy || disabled}
            title={`Yapıştır: ${clipboard.name}`}
          >
            <CopyIcon size={14} weight="bold" />
            Yapıştır
          </button>
        )}
      </div>

      {/* Path bar */}
      <div className="fm-pathbar">
        {editingPath ? (
          <form
            className="fm-path-edit"
            onSubmit={(e) => {
              e.preventDefault();
              setEditingPath(false);
              navigate(pathInput);
            }}
          >
            <input
              className="fm-path-input"
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              autoFocus
              onBlur={() => setEditingPath(false)}
              onKeyDown={(e) => { if (e.key === "Escape") setEditingPath(false); }}
            />
          </form>
        ) : (
          <div className="fm-breadcrumbs" onClick={() => setEditingPath(true)} title="Yol düzenle">
            <FolderOpenIcon size={13} />
            {breadcrumbs.length === 0 ? (
              <span className="fm-crumb">/</span>
            ) : (
              breadcrumbs.map((part, i) => {
                const targetPath = isWindows
                  ? breadcrumbs.slice(0, i + 1).join("\\")
                  : "/" + breadcrumbs.slice(0, i + 1).join("/");
                return (
                  <span key={i} className="fm-crumb-group">
                    {i > 0 && <CaretRightIcon size={10} className="fm-crumb-sep" />}
                    <span
                      className="fm-crumb"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(targetPath);
                      }}
                    >
                      {part}
                    </span>
                  </span>
                );
              })
            )}
          </div>
        )}
        <div className="fm-pathbar-search">
          <MagnifyingGlassIcon size={12} />
          <input
            type="text"
            placeholder="Filtre..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="fm-error">
          <WarningCircleIcon size={14} weight="fill" />
          <span>{error}</span>
          <button onClick={() => setError(null)}><XIcon size={12} /></button>
        </div>
      )}

      {/* File list */}
      <div className="fm-list">
        {loading ? (
          <div className="fm-state">
            <SpinnerGapIcon size={28} className="si-run" />
            <span>Yükleniyor...</span>
          </div>
        ) : !initialized ? (
          <div className="fm-state">
            <FolderOpenIcon size={40} weight="duotone" />
            <span>Dosya yöneticisini başlatmak için bekleyin</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="fm-state">
            <FolderIcon size={40} weight="duotone" />
            <span>{searchFilter ? "Eşleşen dosya yok" : "Boş dizin"}</span>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="fm-row fm-row-header">
              <span className="fm-col-icon" />
              <span className="fm-col-name">Ad</span>
              <span className="fm-col-size">Boyut</span>
              <span className="fm-col-date">Değiştirilme</span>
              <span className="fm-col-perm">İzin</span>
              <span className="fm-col-actions" />
            </div>
            {filtered.map((entry) => (
              <div
                key={entry.path}
                className={`fm-row ${entry.isDirectory ? "fm-row-dir" : "fm-row-file"}`}
                onDoubleClick={() => entry.isDirectory && navigate(entry.path)}
                onContextMenu={(e) => handleContextMenu(e, entry)}
              >
                <span className={`fm-col-icon ${entry.isDirectory ? "fm-icon-dir" : "fm-icon-file"}`}>
                  {getFileIcon(entry.name, entry.isDirectory)}
                </span>
                <span className="fm-col-name">
                  {entry.isDirectory ? (
                    <button className="fm-dir-link" onClick={() => navigate(entry.path)}>
                      {entry.name}
                    </button>
                  ) : (
                    <span className="fm-file-name">{entry.name}</span>
                  )}
                </span>
                <span className="fm-col-size">{entry.isDirectory ? "—" : formatSize(entry.size)}</span>
                <span className="fm-col-date">{formatDate(entry.modified)}</span>
                <span className="fm-col-perm mono">{entry.permissions || "—"}</span>
                <span className="fm-col-actions">
                  {!entry.isDirectory && (
                    <button
                      className="fm-action-btn"
                      title="İndir"
                      onClick={() => handleDownload(entry)}
                    >
                      <DownloadSimpleIcon size={13} />
                    </button>
                  )}
                  <button
                    className="fm-action-btn"
                    title="Diğer"
                    onClick={(e) => handleContextMenu(e, entry)}
                  >
                    <DotsThreeIcon size={15} weight="bold" />
                  </button>
                </span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Footer */}
      {initialized && !loading && (
        <div className="fm-footer">
          <span>{entries.length} öğe</span>
          {clipboard && (
            <span className="fm-clipboard-info">
              <CopyIcon size={11} /> Panoda: {clipboard.name}
            </span>
          )}
        </div>
      )}

      {/* Context Menu */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          entry={ctxMenu.entry}
          onClose={() => setCtxMenu(null)}
          onDownload={() => handleDownload(ctxMenu.entry)}
          onDelete={() => handleDelete(ctxMenu.entry)}
          onRename={() => {
            setCtxMenu(null);
            setDialog({ type: "rename", entry: ctxMenu.entry });
          }}
          onCopy={() => handleCopyToClipboard(ctxMenu.entry)}
        />
      )}

      {/* Dialog */}
      {dialog?.type === "rename" && dialog.entry && (
        <InputDialog
          title="Yeniden Adlandır"
          placeholder="Yeni ad..."
          defaultValue={dialog.entry.name}
          onSubmit={(newName) => handleRename(dialog.entry!, newName)}
          onCancel={() => setDialog(null)}
        />
      )}
    </div>
  );
}
