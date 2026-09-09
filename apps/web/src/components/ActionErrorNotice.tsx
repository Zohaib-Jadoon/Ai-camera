'use client';
import { useEffect, useState } from 'react';
export default function ActionErrorNotice() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = () => setVisible(true);
    window.addEventListener('madad:action-error', show);
    return () => window.removeEventListener('madad:action-error', show);
  }, []);
  if (!visible) return null;
  return <div role="alert" className="fixed bottom-6 right-6 z-[100] max-w-md rounded-lg border border-red-500 bg-slate-950 p-4 text-sm text-red-300 shadow-xl">
    <p>The action could not be completed. Check the entered values and your connection, then try again.</p>
    <button onClick={() => setVisible(false)} className="mt-2 underline">Dismiss error</button>
  </div>;
}
