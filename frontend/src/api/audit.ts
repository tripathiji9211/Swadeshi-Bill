import { apiClient } from './client';
import { AuditedReceipt } from '@/types';

export async function uploadReceiptFile(file: File): Promise<AuditedReceipt> {
  const formData = new FormData();
  formData.append('file', file);

  const { data } = await apiClient.post<AuditedReceipt>('/upload-receipt', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: 60000, // OCR + LLM Parsing might take a few seconds
  });

  return data;
}

export async function uploadReceiptFromBlob(
  blob: Blob,
  filename = 'receipt.png'
): Promise<AuditedReceipt> {
  const file = new File([blob], filename, { type: blob.type || 'image/png' });
  return uploadReceiptFile(file);
}
