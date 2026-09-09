/** Handle expected request failures at event boundaries, never globally suppress errors. */
export async function runUiAction(work: () => unknown, report: () => void = () => {
  window.dispatchEvent(new Event('madad:action-error'));
}): Promise<void> {
  try { await work(); }
  catch { report(); }
}
