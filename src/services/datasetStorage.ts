import type { NormalizedDataset } from '../types/index.ts';

// A single transaction replaces the active import only after validation succeeds.
export async function datasetStorage(action: 'read' | 'write' | 'clear', dataset?: NormalizedDataset): Promise<NormalizedDataset | undefined> {
  if (typeof indexedDB === 'undefined') {
    if (action === 'read') return undefined;
    throw new Error('Trình duyệt không hỗ trợ lưu bộ dữ liệu.');
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('central-flood-research', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('datasets');
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Hãy đóng các tab nghiên cứu khác rồi thử lại.'));
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('datasets', action === 'read' ? 'readonly' : 'readwrite');
      const store = tx.objectStore('datasets');
      const operation = action === 'read' ? store.get('active') : action === 'write' ? store.put(dataset, 'active') : store.delete('active');
      tx.oncomplete = () => { db.close(); resolve(action === 'read' ? operation.result : undefined); };
      tx.onabort = tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Không lưu được dữ liệu.')); };
    };
  });
}
