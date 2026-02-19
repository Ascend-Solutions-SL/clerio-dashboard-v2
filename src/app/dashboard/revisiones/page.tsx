"use client";

import React, { useEffect, useState } from 'react';
import { Clock, Download } from 'lucide-react';
import { RevisionsTable } from '@/components/RevisionsTable';
import { Button } from '@/components/ui/button';

const RevisionesPage = () => {
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

    if (driveType === 'googledrive') {
      const url = `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`;
      setEmbedUrl(url);
      setIsPreviewLoading(false);
      return;
    }

    const resolve = async () => {
      setIsPreviewLoading(true);
      try {
        const base = new URL('/api/files/link', window.location.origin);
        base.searchParams.set('drive_type', 'onedrive');
        base.searchParams.set('drive_file_id', fileId);
        base.searchParams.set('kind', 'embed');

        const res = await fetch(base.toString(), { credentials: 'include' });
        const payload = (await res.json().catch(() => null)) as { url?: string } | null;

        setEmbedUrl(res.ok ? payload?.url ?? null : null);
      } catch {
        setEmbedUrl(null);
      } finally {
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
                      onClick={() => setScope('pending')}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className={`text-xs font-semibold ${scope === 'pending' ? 'text-blue-900' : 'text-slate-700'}`}>
                          Por revisar
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
                      onClick={() => setScope('history')}
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
                      onScopeChange={setScope}
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
                          return;
                        }
                        const first = rows[0];
                        if (!first) {
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
                      <div className="mt-3 flex-1 min-h-0 rounded-xl border border-slate-200 bg-slate-50 p-1">
                        <iframe
                          title="Vista previa documento"
                          src={embedUrl}
                          className="block h-full w-full rounded-lg bg-white"
                          allow="autoplay"
                          style={{ border: 0 }}
                        />
                      </div>
                    ) : isPreviewLoading ? (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        Cargando vista previa...
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
