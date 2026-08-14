'use client';

import { useRef, useState } from 'react';

import { Notice } from '@/components/ui';
import { compressImage } from '@/lib/compress-image';
import { MAX_PROOF_BYTES } from '@/lib/payment';

type Status =
  | { kind: 'idle' }
  | { kind: 'uploading'; percent: number }
  | { kind: 'done' }
  | { kind: 'error'; message: string };

/**
 * Screenshot upload that behaves like a native app.
 *
 * `accept="image/*"` with no `capture` attribute is what makes the phone offer
 * its own sheet — Photo Library, Take Photo, Browse — which is where a
 * screenshot already lives. Progress comes from XHR because fetch cannot
 * report upload progress.
 */
export function PaymentProofUpload({
  bookingIds,
  owner,
  alreadySent,
}: {
  /** Every slot the receipt covers — hours booked together are paid as one. */
  bookingIds: number[];
  owner: string;
  /** A receipt is already on file. It is not shown back: the store is private. */
  alreadySent: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const onFile = alreadySent || status.kind === 'done';

  async function handleFile(file: File) {
    if (file.size > MAX_PROOF_BYTES * 4) {
      setStatus({
        kind: 'error',
        message: 'That image is very large. Please try another one.',
      });
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreview((current) => {
      if (current && current.startsWith('blob:')) URL.revokeObjectURL(current);
      return objectUrl;
    });

    setStatus({ kind: 'uploading', percent: 0 });

    const compressed = await compressImage(file);
    const body = new FormData();
    body.set('bookingIds', bookingIds.join(','));
    body.set('owner', owner);
    body.set('file', compressed);

    try {
      await new Promise<void>((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open('POST', '/api/payment-proof');

        request.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          setStatus({
            kind: 'uploading',
            percent: Math.round((event.loaded / event.total) * 100),
          });
        };

        request.onload = () => {
          if (request.status >= 200 && request.status < 300) {
            resolve();
            return;
          }
          let message = 'Upload failed. Please try again.';
          try {
            message = JSON.parse(request.responseText).error ?? message;
          } catch {
            // Keep the generic message.
          }
          reject(new Error(message));
        };

        request.onerror = () =>
          reject(new Error('Upload failed. Check your connection.'));

        request.send(body);
      });

      setStatus({ kind: 'done' });
    } catch (error) {
      setStatus({
        kind: 'error',
        message:
          error instanceof Error ? error.message : 'Upload failed.',
      });
    }
  }

  const uploading = status.kind === 'uploading';

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Proof of payment</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
          // Allow re-picking the same file after an error.
          event.target.value = '';
        }}
      />

      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="flex w-full items-center gap-3 rounded-xl border border-dashed border-edge bg-surface p-3 text-left active:bg-background disabled:opacity-60"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Payment screenshot"
            className="size-16 shrink-0 rounded-lg border border-edge object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid size-16 shrink-0 place-items-center rounded-lg bg-background text-2xl"
          >
            {onFile ? '✅' : '📷'}
          </span>
        )}

        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">
            {onFile ? 'Replace the receipt' : 'Add your GCash screenshot'}
          </span>
          <span className="block text-xs text-muted">
            {uploading
              ? `Uploading… ${status.percent}%`
              : onFile
                ? 'Already sent. Tap only if you need to send a different one.'
                : 'Take a photo or pick from your gallery'}
          </span>
        </span>
      </button>

      {uploading ? (
        <div
          className="h-1.5 overflow-hidden rounded-full bg-background"
          role="progressbar"
          aria-valuenow={status.percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-court transition-[width] duration-200"
            style={{ width: `${status.percent}%` }}
          />
        </div>
      ) : null}

      {status.kind === 'done' ? (
        <Notice tone="success">
          Screenshot received. The association will verify it and confirm your
          booking.
        </Notice>
      ) : null}

      {status.kind === 'error' ? (
        <Notice tone="error">{status.message}</Notice>
      ) : null}
    </div>
  );
}
