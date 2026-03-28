export let totalDocsProcessed = 0;
export let totalQRsGenerated = 0;

export function recordProcessed(qrCount: number): void {
  totalDocsProcessed++;
  totalQRsGenerated += qrCount;
}
