import { ArrowLeft, CheckCircle2, FileImage, ImageIcon, RotateCcw, Search, Sparkles, Square, Upload, X } from "lucide-react";
import { useEffect, useRef, type ChangeEvent } from "react";
import type {
  GetStyleProfileResult,
  GetStyleProfilePreviewResult,
  StyleProfileIndexEntry,
  WorkspaceStyleProfileSelection,
} from "../../../api/types";
import { hostUploadUrl } from "../../../runtime/appHostUploadClient";
import type {
  StyleProfileCreationViewState,
  StyleProfileDetailState,
} from "../types";

interface StyleProfileLibraryProps {
  profiles: StyleProfileIndexEntry[];
  previews: Record<string, GetStyleProfilePreviewResult | undefined>;
  selectedStyleProfileId?: string | null;
  loading: boolean;
  error: string;
  selectable?: boolean;
  onRefresh: () => Promise<void>;
  onLoadPreview: (styleProfileId: string) => Promise<void>;
  onOpenDetail: (styleProfileId: string) => Promise<void>;
  onSelect?: (styleProfileId: string) => Promise<void>;
}

export function StyleProfileCreationPage(props: {
  creation: StyleProfileCreationViewState;
  profiles: StyleProfileIndexEntry[];
  previews: Record<string, GetStyleProfilePreviewResult | undefined>;
  libraryLoading: boolean;
  libraryError: string;
  detail: StyleProfileDetailState;
  onBack: () => void;
  onNameChange: (value: string) => void;
  onFilesChange: (files: File[]) => void;
  onStart: () => Promise<void>;
  onRetry: () => Promise<void>;
  onStop: () => void;
  onReset: () => void;
  onRefreshLibrary: () => Promise<void>;
  onLoadPreview: (styleProfileId: string) => Promise<void>;
  onOpenDetail: (styleProfileId: string) => Promise<void>;
  onCloseDetail: () => void;
}) {
  const {
    creation,
    profiles,
    previews,
    libraryLoading,
    libraryError,
    detail,
    onBack,
    onNameChange,
    onFilesChange,
    onStart,
    onRetry,
    onStop,
    onReset,
    onRefreshLibrary,
    onLoadPreview,
    onOpenDetail,
    onCloseDetail,
  } = props;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const running = creation.status === "running";

  function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    onFilesChange(files);
  }

  return (
    <section className="page active style-profile-page">
      <header className="style-profile-page-header">
        <button className="secondary-btn" onClick={onBack} disabled={running}>
          <ArrowLeft size={15} />
          返回任务选择
        </button>
        <div>
          <h1>创建风格画像</h1>
          <p>上传 PPTX 或图片参考资料，生成可复用的视觉风格指导。</p>
        </div>
      </header>

      <section className="style-profile-create-panel">
        <div className="style-profile-form-grid">
          <label className="style-profile-name-field">
            <span>风格画像名称</span>
            <input
              value={creation.displayName}
              disabled={running}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="风格画像-YYYY-MM-DD"
            />
          </label>
          <div className="style-profile-upload-field">
            <span>上传参考资料（PPTX / 图片）</span>
            <button
              className="upload-btn"
              disabled={running}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={14} />
              选择文件
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pptx,.png,.jpg,.jpeg,.webp"
              className="uploaded-source-input"
              onChange={handleFileSelection}
            />
          </div>
        </div>

        {creation.files.length > 0 ? (
          <div className="style-profile-file-list">
            {creation.files.map((file) => (
              <span className="file-pill visible" key={`${file.name}-${file.size}-${file.lastModified}`}>
                <FileImage size={12} />
                {file.name}
              </span>
            ))}
          </div>
        ) : null}

        <p className="style-profile-help">最多会选取 5 张 Reference Slide Images 进行分析；上传更多文件时会自动均匀抽样。</p>

        <div className="style-profile-actions">
          {creation.status === "running" ? (
            <button className="secondary-btn" onClick={onStop}>
              <Square size={14} />
              停止
            </button>
          ) : null}
          {creation.status === "completed" ? (
            <>
              <button className="primary-btn" onClick={onReset}>
                <Sparkles size={14} />
                继续创建
              </button>
              <button className="secondary-btn" onClick={onBack}>返回任务选择</button>
            </>
          ) : creation.canRetryAnalysis ? (
            <>
              <button className="primary-btn" onClick={onRetry}>
                <RotateCcw size={14} />
                重试分析
              </button>
              <button className="secondary-btn" onClick={onReset}>重新开始</button>
            </>
          ) : (
            <button
              className="primary-btn"
              disabled={running || creation.files.length === 0 || creation.displayName.trim().length === 0}
              onClick={() => void onStart()}
            >
              {running ? <span className="spinner small" /> : <Sparkles size={14} />}
              开始分析
            </button>
          )}
        </div>

        <StyleProfileCreationProgress creation={creation} />
      </section>

      <StyleProfileLibrary
        profiles={profiles}
        previews={previews}
        loading={libraryLoading}
        error={libraryError}
        onRefresh={onRefreshLibrary}
        onLoadPreview={onLoadPreview}
        onOpenDetail={onOpenDetail}
      />

      <StyleProfileDetailModal detail={detail} onClose={onCloseDetail} />
    </section>
  );
}

export function StyleProfileBriefSelection(props: {
  profiles: StyleProfileIndexEntry[];
  previews: Record<string, GetStyleProfilePreviewResult | undefined>;
  selectedStyleProfile: WorkspaceStyleProfileSelection | null;
  libraryLoading: boolean;
  libraryError: string;
  detail: StyleProfileDetailState;
  onRefresh: () => Promise<void>;
  onLoadPreview: (styleProfileId: string) => Promise<void>;
  onOpenDetail: (styleProfileId: string) => Promise<void>;
  onCloseDetail: () => void;
  onSelect: (styleProfileId: string) => Promise<void>;
  onClear: () => Promise<void>;
}) {
  const {
    profiles,
    previews,
    selectedStyleProfile,
    libraryLoading,
    libraryError,
    detail,
    onRefresh,
    onLoadPreview,
    onOpenDetail,
    onCloseDetail,
    onSelect,
    onClear,
  } = props;
  return (
    <section className="style-selection-section">
      <div className="style-selection-heading">
        <div>
          <div className="section-label">风格画像</div>
          <p>选择一个可复用的视觉风格指导，写入当前 PPT 任务。</p>
        </div>
        {selectedStyleProfile ? (
          <button className="secondary-btn" onClick={() => void onClear()}>
            <X size={14} />
            清除选择
          </button>
        ) : null}
      </div>
      {selectedStyleProfile ? (
        <div className="style-profile-current">
          <CheckCircle2 size={16} />
          当前已选择：{selectedStyleProfile.display_name}
        </div>
      ) : null}
      <StyleProfileLibrary
        profiles={profiles}
        previews={previews}
        selectedStyleProfileId={selectedStyleProfile?.style_profile_id}
        loading={libraryLoading}
        error={libraryError}
        selectable
        onRefresh={onRefresh}
        onLoadPreview={onLoadPreview}
        onOpenDetail={onOpenDetail}
        onSelect={onSelect}
      />
      <StyleProfileDetailModal detail={detail} onClose={onCloseDetail} />
    </section>
  );
}

function StyleProfileLibrary(props: StyleProfileLibraryProps) {
  const {
    profiles,
    previews,
    selectedStyleProfileId,
    loading,
    error,
    selectable = false,
    onRefresh,
    onLoadPreview,
    onOpenDetail,
    onSelect,
  } = props;

  useEffect(() => {
    profiles.forEach((profile) => {
      void onLoadPreview(profile.style_profile_id);
    });
  }, [profiles, onLoadPreview]);

  return (
    <section className="style-profile-library">
      <div className="style-profile-library-header">
        <div>
          <div className="section-label">已有风格画像</div>
          <p>{profiles.length > 0 ? "点击卡片查看参考图片和 profile.md 原文。" : "暂无风格画像。上传 PPTX 或图片创建第一个风格画像。"}</p>
        </div>
        <button className="secondary-btn" onClick={() => void onRefresh()} disabled={loading}>
          {loading ? <span className="spinner small" /> : <RotateCcw size={14} />}
          重试
        </button>
      </div>
      {error ? <div className="task-error">{error}</div> : null}
      {profiles.length > 0 ? (
        <div className="template-grid style-template-grid">
          {profiles.map((profile) => (
            <StyleProfileCard
              key={profile.style_profile_id}
              profile={profile}
              preview={previews[profile.style_profile_id]}
              selected={selectedStyleProfileId === profile.style_profile_id}
              selectable={selectable}
              onOpenDetail={() => onOpenDetail(profile.style_profile_id)}
              onSelect={onSelect ? () => onSelect(profile.style_profile_id) : undefined}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function StyleProfileCard(props: {
  profile: StyleProfileIndexEntry;
  preview?: GetStyleProfilePreviewResult;
  selected: boolean;
  selectable: boolean;
  onOpenDetail: () => Promise<void>;
  onSelect?: () => Promise<void>;
}) {
  const { profile, preview, selected, selectable, onOpenDetail, onSelect } = props;
  const coverUrl = hostUploadUrl(preview?.cover_image?.image_upload);
  return (
    <article className={`template-card ${selected ? "active" : ""}`}>
      <button
        type="button"
        className="template-preview template-preview-button"
        onClick={() => void onOpenDetail()}
        aria-label="查看风格画像详情"
      >
        {coverUrl ? (
          <img src={coverUrl} alt="" loading="lazy" />
        ) : (
          <div className="template-preview-placeholder">
            <ImageIcon size={22} />
          </div>
        )}
        {selected ? (
          <div className="template-selected-badge">
            <CheckCircle2 size={14} />
          </div>
        ) : null}
        <div className="template-preview-overlay">
          <span className="template-preview-overlay-chip">
            <Search size={13} />
            查看详情
            <em>{profile.reference_count}</em>
          </span>
        </div>
      </button>
      <div className="template-card-body">
        <div className="template-card-title-row">
          <h2>{profile.display_name}</h2>
        </div>
        <p className="style-profile-card-meta">
          {profile.reference_count} 张参考图 · {profile.source_file_count} 个来源
        </p>
        {selectable ? (
          <button className="template-use-btn" disabled={selected} onClick={() => void onSelect?.()}>
            {selected ? <CheckCircle2 size={14} /> : <Sparkles size={14} />}
            {selected ? "已使用" : "使用画像"}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function StyleProfileCreationProgress({ creation }: { creation: StyleProfileCreationViewState }) {
  if (creation.status === "idle" && creation.stages.every((stage) => stage.state === "pending")) {
    return null;
  }
  return (
    <div className="style-profile-progress">
      {creation.stages.map((stage) => (
        <article className={`generation-stage-card ${stage.state}`} key={stage.id}>
          <header>
            <span>{stage.label}</span>
            <strong>{stage.state}</strong>
          </header>
          {stage.summaryLines.length > 0 ? (
            <ul>
              {stage.summaryLines.map((line, index) => (
                <li key={`${stage.id}-summary-${index}`}>{line}</li>
              ))}
            </ul>
          ) : null}
          {stage.activities.length > 0 ? (
            <div className="generation-activity-list">
              {stage.activities.map((activity, index) => (
                <span key={`${stage.id}-activity-${index}`}>{activity}</span>
              ))}
            </div>
          ) : null}
          {stage.lines.length > 0 ? (
            <pre className="generation-stream-text">{stage.lines.join("\n")}</pre>
          ) : null}
          {stage.error ? <p className="generation-empty-stream">{stage.error}</p> : null}
        </article>
      ))}
    </div>
  );
}

function StyleProfileDetailModal(props: {
  detail: StyleProfileDetailState;
  onClose: () => void;
}) {
  const { detail, onClose } = props;
  if (detail.status === "closed") return null;
  const profile = detail.detail?.style_profile;
  return (
    <div className="template-preview-modal" role="dialog" aria-modal="true" onClick={onClose}>
      <section className="style-profile-detail-card" onClick={(event) => event.stopPropagation()}>
        <header className="template-preview-modal-header">
          <div className="template-preview-modal-title">
            <h2>{profile?.display_name ?? "风格画像详情"}</h2>
          </div>
          <button className="template-preview-modal-close" aria-label="关闭" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        {detail.status === "loading" ? (
          <div className="template-empty"><span className="spinner small" /> 正在加载详情...</div>
        ) : detail.status === "error" ? (
          <div className="task-error">{detail.error}</div>
        ) : detail.detail ? (
          <StyleProfileDetailContent detail={detail.detail} />
        ) : null}
      </section>
    </div>
  );
}

function StyleProfileDetailContent({ detail }: { detail: GetStyleProfileResult }) {
  return (
    <div className="style-profile-detail-content">
      {detail.reference_images.length > 0 ? (
        <div className="style-profile-reference-strip">
          {detail.reference_images.map((image) => {
            const url = hostUploadUrl(image.image_upload);
            return url ? (
              <img key={image.reference_image_id} src={url} alt="" loading="lazy" />
            ) : (
              <div className="template-preview-placeholder" key={image.reference_image_id}>
                <ImageIcon size={18} />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="template-empty">没有可预览的参考图片。</div>
      )}
      <pre className="style-profile-markdown">{detail.content}</pre>
    </div>
  );
}
