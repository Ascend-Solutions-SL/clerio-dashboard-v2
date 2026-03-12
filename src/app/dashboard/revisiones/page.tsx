"use client";

import React, { useEffect, useState } from 'react';
import { Clock, Download } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { RevisionsTable } from '@/components/RevisionsTable';
import { Button } from '@/components/ui/button';

const RevisionesPage = () => {
  const searchParams = useSearchParams();
  const [porRevisarCount, setPorRevisarCount] = useState<number>(0);
  const [historicoCount, setHistoricoCount] = useState<number>(0);
  const [scope, setScope] = useState<'pending' | 'history'>('pending');

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedRow, setSelectedRow] = useState<{
    id: number;
    driveFileId: string | null;
    driveType: 'googledrive' | 'onedrive' | null;
  } | null>(null);

  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const handleScopeChange = (nextScope: 'pending' | 'history') => {
    setScope(nextScope);
    setSelectedId(null);
    setSelectedRow(null);
    setEmbedUrl(null);
    setIsPreviewLoading(false);
  };

  useEffect(() => {
    const invoiceIdParam = searchParams.get('invoiceId');
    const scopeParam = searchParams.get('scope');

    if (scopeParam === 'pending' || scopeParam === 'history') {
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
      return;
    }

    const fileId = selectedRow.driveFileId;
    const driveType = selectedRow.driveType;
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
  }, [selectedRow]);

  return (
    <div className="-m-8">
      <div className="bg-white pt-6 pb-8">
        <div className="max-w-7xl mx-auto px-5">
          <div className="flex flex-col gap-4">
            <div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="lg:col-span-1">
                  <div className="flex flex-col md:flex-row md:justify-start gap-3 md:gap-4 mb-3">
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
                        <div className={`text-xs font-semibold ${scope === 'pending' ? 'text-blue-900' : 'text-slate-700'}`}>
                          Por validar
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
                          <Clock className={`h-4 w-4 ${scope === 'history' ? 'text-white' : 'text-slate-700'}`} />
                          <div className={`text-xs font-semibold ${scope === 'history' ? 'text-white' : 'text-slate-700'}`}>Histórico</div>
                        </div>
                        <div className={`text-sm font-semibold tabular-nums ${scope === 'history' ? 'text-white' : 'text-slate-900'}`}>{historicoCount}</div>
                      </div>
                    </button>
                  </div>
                  <div className="h-[72vh]">
                    <RevisionsTable
                      onPorRevisarCountChange={setPorRevisarCount}
                      onHistoricoCountChange={setHistoricoCount}
                      scope={scope}
                      onScopeChange={handleScopeChange}
                      selectedId={selectedId}
                      onSelect={(id, row) => {
                        setSelectedId(id);
                        setSelectedRow({
                          id: row.id,
                          driveFileId: row.driveFileId,
                          driveType: row.driveType,
                        });
                      }}
                      onDataLoaded={(rows) => {
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
                      }}
                    />
                  </div>
                </div>

                <div className="lg:col-span-1">
                  <div className="h-[89vh] rounded-lg border border-gray-200 bg-white p-4 flex flex-col">
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

export default RevisionesPage;
