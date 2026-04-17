"use client";

import React, { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, CheckCircle2, Clock, Download, RefreshCw, Trash2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import RevisionsTable from '@/components/RevisionsTable';
import { Button } from '@/components/ui/button';

const RevisionesPageContent = () => {
  const VALIDATION_TABLE_HEIGHT = '89vh';
  const VALIDATION_TOP_OFFSET = '4.25rem';
  const PREVIEW_PANEL_HEIGHT = `calc(${VALIDATION_TABLE_HEIGHT} + ${VALIDATION_TOP_OFFSET})`;

  const searchParams = useSearchParams();
  const [porRevisarCount, setPorRevisarCount] = useState<number>(0);
  const [historicoCount, setHistoricoCount] = useState<number>(0);
  const [papeleraCount, setPapeleraCount] = useState<number>(0);
  const [scope, setScope] = useState<'pending' | 'history' | 'trash'>('pending');
  const [trashMoveInProgressCount, setTrashMoveInProgressCount] = useState(0);
  const [validationInProgressCount, setValidationInProgressCount] = useState(0);
  const [showTrashMoveSuccessState, setShowTrashMoveSuccessState] = useState(false);
  const [isTrashMoveStatusVisible, setIsTrashMoveStatusVisible] = useState(true);
  const [displayedTrashMoveStatus, setDisplayedTrashMoveStatus] = useState<{ text: string; tone: 'neutral' | 'success' }>({
    text: 'Sincronizado',
    tone: 'neutral',
  });
  const trashMoveSuccessTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trashMoveStatusSwapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedRow, setSelectedRow] = useState<{
    id: number;
    driveFileId: string | null;
    driveType: 'googledrive' | 'onedrive' | null;
  } | null>(null);

  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewKey, setPreviewKey] = useState<string | null>(null);

  const handleRevisionSelect = useCallback(
    (
      id: number,
      row: {
        id: number;
        driveFileId: string | null;
        driveType: 'googledrive' | 'onedrive' | null;
      }
    ) => {
      setSelectedId(id);
      setSelectedRow({
        id: row.id,
        driveFileId: row.driveFileId,
        driveType: row.driveType,
      });
    },
    []
  );

  const handleValidationActivityChange = useCallback(
    (payload: { inProgressCount: number; justCompletedSuccessfully: boolean }) => {
      setValidationInProgressCount(payload.inProgressCount);

      if (payload.inProgressCount > 0) {
        if (trashMoveSuccessTimeoutRef.current) {
          clearTimeout(trashMoveSuccessTimeoutRef.current);
          trashMoveSuccessTimeoutRef.current = null;
        }
        setShowTrashMoveSuccessState(false);
        return;
      }

      if (!payload.justCompletedSuccessfully) {
        return;
      }

      setShowTrashMoveSuccessState(true);
      if (trashMoveSuccessTimeoutRef.current) {
        clearTimeout(trashMoveSuccessTimeoutRef.current);
      }
      trashMoveSuccessTimeoutRef.current = setTimeout(() => {
        setShowTrashMoveSuccessState(false);
        trashMoveSuccessTimeoutRef.current = null;
      }, 2400);
    },
    []
  );

  const handleRowsLoaded = useCallback(
    (
      rows: Array<{
        id: number;
        driveFileId: string | null;
        driveType: 'googledrive' | 'onedrive' | null;
      }>
    ) => {
      if (selectedId != null) {
        const selectedFromQuery = rows.find((row) => row.id === selectedId);
        if (selectedFromQuery) {
          setSelectedRow({
            id: selectedFromQuery.id,
            driveFileId: selectedFromQuery.driveFileId,
            driveType: selectedFromQuery.driveType,
          });
        } else {
          const firstRow = rows[0] ?? null;
          if (firstRow) {
            setSelectedId(firstRow.id);
            setSelectedRow({
              id: firstRow.id,
              driveFileId: firstRow.driveFileId,
              driveType: firstRow.driveType,
            });
          } else {
            setSelectedId(null);
            setSelectedRow(null);
            setEmbedUrl(null);
            setIsPreviewLoading(false);
          }
        }
        return;
      }
      const first = rows[0];
      if (!first) {
        setSelectedRow(null);
        setEmbedUrl(null);
        setIsPreviewLoading(false);
        return;
      }
      setSelectedId(first.id);
      setSelectedRow({
        id: first.id,
        driveFileId: first.driveFileId,
        driveType: first.driveType,
      });
    },
    [selectedId]
  );

  const handleScopeChange = (nextScope: 'pending' | 'history' | 'trash') => {
    setScope(nextScope);
    setSelectedId(null);
    setSelectedRow(null);
    setEmbedUrl(null);
    setIsPreviewLoading(false);
  };

  const handleTrashMoveActivityChange = useCallback(
    (payload: { inProgressCount: number; justCompletedSuccessfully: boolean }) => {
      setTrashMoveInProgressCount(payload.inProgressCount);

      if (payload.inProgressCount > 0) {
        if (trashMoveSuccessTimeoutRef.current) {
          clearTimeout(trashMoveSuccessTimeoutRef.current);
          trashMoveSuccessTimeoutRef.current = null;
        }
        setShowTrashMoveSuccessState(false);
        return;
      }

      if (!payload.justCompletedSuccessfully) {
        return;
      }

      setShowTrashMoveSuccessState(true);
      if (trashMoveSuccessTimeoutRef.current) {
        clearTimeout(trashMoveSuccessTimeoutRef.current);
      }
      trashMoveSuccessTimeoutRef.current = setTimeout(() => {
        setShowTrashMoveSuccessState(false);
        trashMoveSuccessTimeoutRef.current = null;
      }, 2400);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (trashMoveSuccessTimeoutRef.current) {
        clearTimeout(trashMoveSuccessTimeoutRef.current);
        trashMoveSuccessTimeoutRef.current = null;
      }
      if (trashMoveStatusSwapTimerRef.current) {
        clearTimeout(trashMoveStatusSwapTimerRef.current);
        trashMoveStatusSwapTimerRef.current = null;
      }
    };
  }, []);

  const isTrashMoveInProgress = trashMoveInProgressCount > 0 || validationInProgressCount > 0;
  const targetTrashMoveStatus = isTrashMoveInProgress
    ? ({ text: 'Procesando cambios', tone: 'neutral' } as const)
    : showTrashMoveSuccessState
      ? ({ text: 'Sincronizado', tone: 'success' } as const)
      : ({ text: 'Sincronizado', tone: 'neutral' } as const);

  const trashMoveStatusToneClass = displayedTrashMoveStatus.tone === 'success' ? 'text-emerald-700' : 'text-gray-500';

  useLayoutEffect(() => {
    if (
      displayedTrashMoveStatus.text === targetTrashMoveStatus.text &&
      displayedTrashMoveStatus.tone === targetTrashMoveStatus.tone
    ) {
      return;
    }

    if (displayedTrashMoveStatus.text === targetTrashMoveStatus.text) {
      if (trashMoveStatusSwapTimerRef.current) {
        clearTimeout(trashMoveStatusSwapTimerRef.current);
        trashMoveStatusSwapTimerRef.current = null;
      }
      setDisplayedTrashMoveStatus(targetTrashMoveStatus);
      setIsTrashMoveStatusVisible(true);
      return;
    }

    setIsTrashMoveStatusVisible(false);

    if (trashMoveStatusSwapTimerRef.current) {
      clearTimeout(trashMoveStatusSwapTimerRef.current);
    }

    trashMoveStatusSwapTimerRef.current = setTimeout(() => {
      setDisplayedTrashMoveStatus(targetTrashMoveStatus);
      setIsTrashMoveStatusVisible(true);
      trashMoveStatusSwapTimerRef.current = null;
    }, 150);
  }, [displayedTrashMoveStatus.text, displayedTrashMoveStatus.tone, targetTrashMoveStatus]);

  useEffect(() => {
    const invoiceIdParam = searchParams.get('invoiceId');
    const scopeParam = searchParams.get('scope');

    if (scopeParam === 'pending' || scopeParam === 'history' || scopeParam === 'trash') {
      handleScopeChange(scopeParam);
    }

    if (!invoiceIdParam) {
      return;
    }

    const parsedId = Number(invoiceIdParam);
    if (Number.isFinite(parsedId)) {
      setSelectedId(parsedId);
    }
  }, [searchParams]);

  const downloadHref =
    selectedRow?.driveFileId && selectedRow.driveType
      ? `/api/files/open?drive_type=${encodeURIComponent(selectedRow.driveType)}&drive_file_id=${encodeURIComponent(
          selectedRow.driveFileId
        )}&kind=download`
      : null;

  useEffect(() => {
    if (!selectedRow?.driveFileId || !selectedRow.driveType) {
      setEmbedUrl(null);
      setIsPreviewLoading(false);
      setPreviewKey(null);
      return;
    }

    const fileId = selectedRow.driveFileId;
    const driveType = selectedRow.driveType;
    const nextPreviewKey = `${driveType}:${fileId}`;
    if (nextPreviewKey === previewKey && embedUrl) {
      return;
    }

    setPreviewKey(nextPreviewKey);
    setIsPreviewLoading(true);

    if (driveType === 'googledrive') {
      const url = `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`;
      setEmbedUrl(url);
      return;
    }

    const resolve = async () => {
      try {
        const base = new URL('/api/files/link', window.location.origin);
        base.searchParams.set('drive_type', 'onedrive');
        base.searchParams.set('drive_file_id', fileId);
        base.searchParams.set('kind', 'embed');

        const res = await fetch(base.toString(), { credentials: 'include' });
        const payload = (await res.json().catch(() => null)) as { url?: string } | null;

        const nextUrl = res.ok ? payload?.url ?? null : null;
        setEmbedUrl(nextUrl);
        if (!nextUrl) {
          setIsPreviewLoading(false);
        }
      } catch {
        setEmbedUrl(null);
        setIsPreviewLoading(false);
      }
    };

    void resolve();
  }, [selectedRow?.driveFileId, selectedRow?.driveType, previewKey, embedUrl]);

  return (
    <div className="-m-8">
      <div className="bg-white pt-6 pb-8">
        <div className="mx-auto w-full max-w-[96rem] px-5">
          <div className="flex flex-col gap-4">
            <div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="lg:col-span-1">
                  <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
                    <button
                      type="button"
                      className={`w-full md:w-[175px] rounded-xl border px-3 py-2 text-left transition-colors ${
                        scope === 'pending'
                          ? 'border-blue-200 bg-blue-50 text-slate-900'
                          : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50'
                      }`}
                      onClick={() => handleScopeChange('pending')}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Clock className={`h-4 w-4 ${scope === 'pending' ? 'text-blue-800' : 'text-slate-700'}`} />
                          <div className={`text-xs font-semibold ${scope === 'pending' ? 'text-blue-900' : 'text-slate-700'}`}>
                            Por validar
                          </div>
                        </div>
                        <div className={`text-sm font-semibold tabular-nums ${scope === 'pending' ? 'text-blue-950' : 'text-slate-900'}`}>
                          {porRevisarCount}
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      className={`w-full md:w-[175px] rounded-xl border px-3 py-2 text-left transition-colors ${
                        scope === 'history'
                          ? 'border-slate-300 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50'
                      }`}
                      onClick={() => handleScopeChange('history')}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className={`h-4 w-4 ${scope === 'history' ? 'text-white' : 'text-slate-700'}`} />
                          <div className={`text-xs font-semibold ${scope === 'history' ? 'text-white' : 'text-slate-700'}`}>Validadas</div>
                        </div>
                        <div className={`text-sm font-semibold tabular-nums ${scope === 'history' ? 'text-white' : 'text-slate-900'}`}>{historicoCount}</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      className={`w-full md:w-[175px] rounded-xl border px-3 py-2 text-left transition-colors ${
                        scope === 'trash'
                          ? 'border-red-200 bg-red-50 text-red-900'
                          : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50'
                      }`}
                      onClick={() => handleScopeChange('trash')}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Trash2 className={`h-4 w-4 ${scope === 'trash' ? 'text-red-700' : 'text-slate-700'}`} />
                          <div className={`text-xs font-semibold ${scope === 'trash' ? 'text-red-900' : 'text-slate-700'}`}>Papelera</div>
                        </div>
                        <div className={`text-sm font-semibold tabular-nums ${scope === 'trash' ? 'text-red-900' : 'text-slate-900'}`}>
                          {papeleraCount}
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5 text-sm text-gray-500 md:pl-1">
                      <div aria-live="polite" className="flex min-h-[20px] items-center gap-1.5 overflow-hidden">
                        <span
                          className={`block transform-gpu transition-all duration-300 ${isTrashMoveStatusVisible ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'} ${trashMoveStatusToneClass}`}
                        >
                          {displayedTrashMoveStatus.text}
                        </span>
                        {isTrashMoveInProgress ? (
                          <RefreshCw className="h-4 w-4 animate-spin text-slate-900" />
                        ) : showTrashMoveSuccessState ? (
                          <span className="inline-flex h-4 w-4 items-center justify-center rounded-[5px] bg-emerald-500 text-white">
                            <Check className="h-3 w-3" />
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div style={{ height: VALIDATION_TABLE_HEIGHT }}>
                    <RevisionsTable
                      key={scope}
                      onPorRevisarCountChange={setPorRevisarCount}
                      onHistoricoCountChange={setHistoricoCount}
                      onPapeleraCountChange={setPapeleraCount}
                      onTrashMoveActivityChange={handleTrashMoveActivityChange}
                      onValidationActivityChange={handleValidationActivityChange}
                      scope={scope}
                      selectedId={selectedId}
                      onSelect={handleRevisionSelect}
                      onDataLoaded={handleRowsLoaded}
                    />
                  </div>
                </div>

                <div className="lg:col-span-1">
                  <div className="rounded-lg border border-gray-200 bg-white p-4 flex flex-col" style={{ height: PREVIEW_PANEL_HEIGHT }}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-gray-700">Vista previa</div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={downloadHref ? 'h-8 w-8' : 'h-8 w-8 text-gray-400'}
                        disabled={!downloadHref}
                        onClick={() => {
                          if (!downloadHref) {
                            return;
                          }
                          window.open(downloadHref, '_blank', 'noopener,noreferrer');
                        }}
                        aria-label={downloadHref ? 'Descargar factura' : 'Archivo no disponible'}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                    {embedUrl ? (
                      <div className="relative mt-3 flex-1 min-h-0 rounded-xl border border-slate-200 bg-slate-50 p-1">
                        {isPreviewLoading ? (
                          <div className="absolute inset-1 z-10 flex items-center justify-center rounded-lg bg-slate-50/95 px-4 py-3">
                            <div className="flex flex-col items-center gap-3 text-slate-700">
                              <div className="relative h-12 w-12">
                                <div className="absolute inset-0 rounded-full border-[4px] border-slate-200/90" />
                                <div className="absolute inset-0 animate-spin rounded-full border-[4px] border-transparent border-t-slate-900 border-r-slate-500 shadow-[0_0_18px_rgba(100,116,139,0.25)] [filter:saturate(1.1)]" />
                              </div>
                              <div className="text-sm font-medium tracking-[0.01em]">Cargando vista previa...</div>
                            </div>
                          </div>
                        ) : null}
                        <iframe
                          title="Vista previa documento"
                          src={embedUrl}
                          className={`h-full w-full rounded-lg bg-white ${isPreviewLoading ? 'invisible' : 'block'}`}
                          allow="autoplay"
                          style={{ border: 0 }}
                          onLoad={() => {
                            setIsPreviewLoading(false);
                          }}
                        />
                      </div>
                    ) : isPreviewLoading ? (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-6">
                        <div className="flex flex-col items-center gap-3 text-slate-700">
                          <div className="relative h-12 w-12">
                            <div className="absolute inset-0 rounded-full border-[4px] border-slate-200/90" />
                            <div className="absolute inset-0 animate-spin rounded-full border-[4px] border-transparent border-t-slate-900 border-r-slate-500 shadow-[0_0_18px_rgba(100,116,139,0.25)] [filter:saturate(1.1)]" />
                          </div>
                          <div className="text-sm font-medium tracking-[0.01em]">Cargando vista previa...</div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        {selectedRow ? 'No hay vista previa disponible para este documento.' : 'Selecciona un documento para ver la vista previa.'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const RevisionesPage = () => {
  return (
    <Suspense fallback={<div className="-m-8 bg-white pt-6 pb-8" />}>
      <RevisionesPageContent />
    </Suspense>
  );
};

export default RevisionesPage;
