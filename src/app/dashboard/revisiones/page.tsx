"use client";

import React, { useEffect, useState } from 'react';
import { ArrowDownCircle, FileText } from 'lucide-react';

import StatCard from '@/components/StatCard';
import { RevisionsTable } from '@/components/RevisionsTable';

const RevisionesPage = () => {
  const [porRevisarCount, setPorRevisarCount] = useState<number>(0);
  const [noFacturasCount, setNoFacturasCount] = useState<number>(0);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedRow, setSelectedRow] = useState<{
    id: number;
    driveFileId: string | null;
    driveType: 'googledrive' | 'onedrive' | null;
    facturaUid: string;
  } | null>(null);

  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

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
      <div className="bg-white pt-8 pb-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col gap-6">
            <div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="lg:col-span-1">
                  <div className="flex flex-col md:flex-row md:justify-start gap-4 md:gap-6 mb-4">
                    <StatCard
                      title="Por Revisar"
                      value={porRevisarCount.toString()}
                      Icon={ArrowDownCircle}
                      size="compact"
                      className="md:w-[250px]"
                    />
                    <StatCard
                      title="No Facturas"
                      value={noFacturasCount.toString()}
                      Icon={FileText}
                      size="compact"
                      className="md:w-[250px]"
                    />
                  </div>
                  <div className="h-[74vh]">
                    <RevisionsTable
                      onPorRevisarCountChange={setPorRevisarCount}
                      onNoFacturasCountChange={setNoFacturasCount}
                      selectedId={selectedId}
                      onSelect={(id, row) => {
                        setSelectedId(id);
                        setSelectedRow({
                          id: row.id,
                          driveFileId: row.driveFileId,
                          driveType: row.driveType,
                          facturaUid: row.facturaUid,
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
                          facturaUid: first.facturaUid,
                        });
                      }}
                    />
                  </div>
                </div>

                <div className="lg:col-span-1">
                  <div className="h-[89vh] rounded-lg border border-gray-200 bg-white p-4 flex flex-col">
                    <div className="text-sm font-semibold text-gray-700">Vista previa</div>
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
